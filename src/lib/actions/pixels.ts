"use server";

import { auth } from "@/auth";
import { encryptSecret } from "@/lib/crypto/secrets";
import { getLastWorkspaceId } from "@/lib/actions/workspaces";
import { escopoDeConfig } from "@/lib/areas/escopoConfig";
import { REGISTRO } from "@/lib/gateways/registro";
import { prisma } from "@/lib/prisma";
import type { PixelEventType, PurchaseSendMode, PurchaseValueMode } from "@/generated/prisma/enums";

/**
 * `clique_checkout` é o padrão: dispara no clique num link que leva ao gateway,
 * na página de vendas. É o único modo que funciona quando o checkout é hospedado
 * pelo gateway (pay.kirvano.com), onde o cliente não consegue instalar script.
 */
import { lerDonos, donosCorrompidos, type DonoCorrompido, type MapaDeDonos } from "@/lib/pixel/donos";
import { assinaturaDetectores, avisoDeVersao, diferencasDeDetectores } from "@/lib/pixel/detectores";
import { EVENTOS_DO_PIXEL, donoDoEvento } from "@/lib/pixel/donos";
import { PRESET_PADRAO, donosDoPreset, lerPreset, type PresetPixel } from "@/lib/pixel/preset";
import { TIPO_IC_PADRAO } from "@/lib/pixel/script";

export type DetectionType = "clique_checkout" | "contem_texto" | "contem_css" | "contem_url";

export interface MetaPixelDTO {
  id: string;
  pixelId: string;
  nickname: string | null;
  hasToken: boolean;
}

export interface EventRuleDTO {
  eventType: PixelEventType;
  enabled: boolean;
  detectionType: DetectionType | null;
  detectionValue: string | null;
  sendMode: PurchaseSendMode | null;
  valueMode: PurchaseValueMode | null;
  fixedValue: number | null;
  targetProduct: string | null;
}

export interface PixelConfigDTO {
  id: string;
  name: string;
  enabled: boolean;
  metaPixels: MetaPixelDTO[];
  rules: EventRuleDTO[];
  /**
   * Quem envia cada evento para a Meta. Evento ausente = `traffik`.
   *
   * ⚠️ Só decide quem fala com a META. O evento continua sendo GRAVADO em
   * qualquer caso — o funil e o Dashboard contam do nosso banco.
   */
  eventOwners: MapaDeDonos;
  /**
   * 🔴 AS ENTRADAS DE `eventOwners` QUE NÃO PUDERAM SER LIDAS — aditivo,
   * 14/08/2026. Nenhum campo existente mudou de valor.
   *
   * ⛔ Até aqui a corrupção MORRIA NESTA LINHA: `lerDonos` descarta o ilegível
   * e devolve um mapa limpo, então nenhuma tela tinha como saber que a escolha
   * do usuário havia sido perdida. O dono cai no PADRÃO — que para `Purchase`
   * é `traffik` —, ou seja **o envio é RELIGADO** e a contagem dobrada na Meta
   * volta, sem nada acusar.
   *
   * A direcao NAO muda (falhar fechado apagaria conversao real). O que muda e
   * que ela deixa de ser muda: o bloco de Alertas nomeia o evento e o dono
   * assumido, e o usuario decide.
   */
  donosCorrompidos: DonoCorrompido[];
  /**
   * Respostas do preset. Pixel anterior à coluna vem **inferido** do estado
   * atual, nunca vazio — ver `lib/pixel/preset.ts`.
   */
  preset: PresetPixel;
}

/** Input do formulário do popup (Bloco 12). */
export interface PixelFormInput {
  name: string;
  /** Área dona. Omitido = a área ativa. Só é lido na criação. */
  workspaceId?: string | null;
  metaPixels: { pixelId: string; accessToken?: string; nickname?: string }[];
  lead: boolean;
  addToCart: boolean;
  initiateCheckout: { enabled: boolean; detectionType?: DetectionType; detectionValue?: string };
  purchase: {
    enabled: boolean;
    sendMode: PurchaseSendMode;
    valueMode: PurchaseValueMode;
    fixedValue?: number | null;
    targetProduct?: string | null;
  };
  /** Quem envia cada evento. Omitido = mantém o que está gravado. */
  eventOwners?: MapaDeDonos;
  /** Respostas do preset. Omitido = mantém o que está gravado. */
  preset?: PresetPixel;
}

const EVENT_TYPES: PixelEventType[] = ["LEAD", "ADD_TO_CART", "INITIATE_CHECKOUT", "PURCHASE"];

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

type DetectionJson = { tipo?: DetectionType; valor?: string } | null;

function toDTO(px: {
  id: string;
  name: string;
  enabled: boolean;
  eventOwners: unknown;
  setup: unknown;
  metaPixels: { id: string; pixelId: string; nickname: string | null; accessToken: string | null }[];
  eventRules: {
    eventType: PixelEventType;
    enabled: boolean;
    detection: unknown;
    sendMode: PurchaseSendMode | null;
    valueMode: PurchaseValueMode | null;
    fixedValue: unknown;
    targetProduct: string | null;
  }[];
}): PixelConfigDTO {
  const byType = new Map(px.eventRules.map((r) => [r.eventType, r]));
  const detIC = (byType.get("INITIATE_CHECKOUT")?.detection as DetectionJson) ?? null;
  return {
    id: px.id,
    name: px.name,
    enabled: px.enabled,
    eventOwners: lerDonos(px.eventOwners),
    /* ⚠️ Do BRUTO, não do saneado — se viesse de `lerDonos` seria sempre vazio,
       que é a definição de guarda que nunca dispara. */
    donosCorrompidos: donosCorrompidos(px.eventOwners),
    // A regra de IC entra porque `ondeSePaga` é inferível dela para os pixels
    // anteriores ao campo — ver `lerPreset`.
    preset: lerPreset(px.setup, px.eventOwners, detIC?.tipo ?? null),
    metaPixels: px.metaPixels.map((m) => ({
      id: m.id,
      pixelId: m.pixelId,
      nickname: m.nickname,
      hasToken: Boolean(m.accessToken),
    })),
    rules: EVENT_TYPES.map((t) => {
      const r = byType.get(t);
      const det = (r?.detection as DetectionJson) ?? null;
      return {
        eventType: t,
        enabled: r?.enabled ?? false,
        detectionType: det?.tipo ?? null,
        detectionValue: det?.valor ?? null,
        sendMode: r?.sendMode ?? "APENAS_APROVADAS",
        valueMode: r?.valueMode ?? "VALOR_DA_VENDA",
        fixedValue: r?.fixedValue != null ? Number(r.fixedValue) : null,
        targetProduct: r?.targetProduct ?? null,
      };
    }),
  };
}

const INCLUDE = { metaPixels: true, eventRules: true } as const;

/**
 * Pixels da Área de Trabalho ativa. Na Principal inclui os de `workspaceId`
 * NULO (catch-all) — senão todo pixel existente sumiria da tela enquanto o
 * script dele continuaria disparando no site do cliente.
 */
export async function listPixels(workspaceId?: string | null): Promise<PixelConfigDTO[]> {
  const userId = await requireUserId();
  const escopo = await escopoDeConfig(userId, workspaceId ?? (await getLastWorkspaceId()));
  const pixels = await prisma.pixelConfig.findMany({
    where: { userId, ...escopo.where },
    orderBy: { createdAt: "asc" },
    include: INCLUDE,
  });
  return pixels.map(toDTO);
}

/** Produtos distintos que já têm venda trackeada (para a regra de Purchase). */
export async function listTrackedProducts(): Promise<string[]> {
  const userId = await requireUserId();
  const rows = await prisma.sale.findMany({
    where: { userId },
    distinct: ["product"],
    select: { product: true },
    orderBy: { product: "asc" },
  });
  return rows.map((r) => r.product).filter(Boolean);
}

/**
 * Gateways conectados que têm **configuração de pixel própria** — os que podem
 * estar disparando `Purchase` sem que a Trackhub saiba.
 *
 * > ### 🔴 Por que a tela precisa NOMEAR o gateway
 * > O `Purchase` é o único evento sem dedup possível (ver `pixelProprio` no
 * > contrato): ou nós enviamos, ou o gateway. O aviso genérico — "confira se
 * > alguém mais envia" — pede uma investigação que o usuário não sabe por onde
 * > começar. "A Cakto tem campo de pixel no painel dela" diz onde olhar.
 *
 * ⚠️ Lê a capacidade do REGISTRO, nunca um `if (platform === "CAKTO")`. Gateway
 * novo com painel de pixel entra declarando a linha, sem tocar nesta função nem
 * na tela.
 *
 * ⚠️ Só webhooks ATIVOS: um gateway desligado não está recebendo venda, então
 * não pode estar disparando Purchase.
 */
export async function gatewaysComPixelProprio(workspaceId?: string | null): Promise<string[]> {
  const userId = await requireUserId();
  const escopo = await escopoDeConfig(userId, workspaceId ?? (await getLastWorkspaceId()));
  const webhooks = await prisma.webhook.findMany({
    where: { userId, active: true, ...escopo.where },
    select: { platform: true },
    distinct: ["platform"],
  });
  return webhooks
    .map((w) => REGISTRO[w.platform])
    .filter((g): g is NonNullable<typeof g> => Boolean(g?.capacidades.pixelProprio))
    .map((g) => g.nome);
}

/** Monta os event rules a partir do formulário. */
function rulesFromForm(input: PixelFormInput) {
  /**
   * 🔴 O TIPO É GRAVADO MESMO SEM VALOR — e é a metade dos dados do bug.
   *
   * A condição antiga exigia `detectionValue?.trim()`, e o valor vazio é a
   * configuração RECOMENDADA (`clique_checkout` sem domínios = "vazio já cobre
   * Kirvano, Cakto, Hotmart…"). Então o caso comum gravava `detection:
   * undefined`, o DTO devolvia `detectionType: null`, e o script saía com
   * `var IC = { type: "" }` — que não casa com nenhum ramo. **Todo pixel criado
   * com os padrões nunca disparou InitiateCheckout pelo clique.**
   *
   * O script já materializa o padrão (ver `tipoDeIC` em `pixel/script.ts`), o
   * que conserta os pixels já salvos sem migração. Gravar o tipo aqui é o outro
   * lado: faz o dado no banco dizer o que o script faz, em vez de depender de
   * dois lugares aplicarem o mesmo `??`.
   */
  const detection = input.initiateCheckout.enabled
    ? {
        tipo: input.initiateCheckout.detectionType ?? "clique_checkout",
        valor: input.initiateCheckout.detectionValue?.trim() ?? "",
      }
    : undefined;
  return [
    { eventType: "LEAD" as const, enabled: input.lead },
    { eventType: "ADD_TO_CART" as const, enabled: input.addToCart },
    { eventType: "INITIATE_CHECKOUT" as const, enabled: input.initiateCheckout.enabled, detection },
    {
      eventType: "PURCHASE" as const,
      enabled: input.purchase.enabled,
      sendMode: input.purchase.sendMode,
      valueMode: input.purchase.valueMode,
      fixedValue: input.purchase.valueMode === "VALOR_FIXO" ? input.purchase.fixedValue ?? 0 : null,
      targetProduct: input.purchase.targetProduct?.trim() || null,
    },
  ];
}

/** Normaliza o form e **encripta** os tokens antes de tocar no banco. */
function cleanMetaPixels(list: PixelFormInput["metaPixels"]) {
  return list
    .filter((m) => m.pixelId?.trim())
    .map((m) => {
      const token = m.accessToken?.trim();
      return {
        pixelId: m.pixelId.trim(),
        accessToken: token ? encryptSecret(token) : null,
        nickname: m.nickname?.trim() || null,
      };
    });
}

export async function createPixel(input: PixelFormInput): Promise<PixelConfigDTO> {
  const userId = await requireUserId();
  // Nasce vinculado à área ativa. O `PixelConfig.id` embutido no script NÃO
  // muda por isso — nenhum identificador já emitido muda de significado.
  const escopo = await escopoDeConfig(userId, input.workspaceId ?? (await getLastWorkspaceId()));
  const name = input.name?.trim() || "Meta Pixel";
  const metaPixels = cleanMetaPixels(input.metaPixels);
  if (metaPixels.length === 0) throw new Error("Adicione ao menos um pixel da Meta.");

  const px = await prisma.pixelConfig.create({
    data: {
      userId,
      name,
      provider: "META",
      workspaceId: escopo.areaId || null,
      // Pixel novo nasce com o preset respondido pela tela; sem resposta, o
      // padrão (`tem pixel nativo`) é o caso comum e o mapa de donos vem dele.
      // Objeto literal, não a interface: o Json do Prisma exige index signature.
      //
      // 🔴 Escrever campo a campo custou os dois campos que vieram depois:
      // `outroEnviaPurchase` e `ondeSePaga` eram descartados aqui, e só não
      // apareceram como bug porque `lerPreset` sabe INFERIR os dois. Uma
      // resposta explícita que sobrevive por inferência é uma resposta que
      // ninguém guardou — e a inferência só empata enquanto o mapa de donos e a
      // regra de IC não puderem dizer outra coisa.
      //
      // ⚠️ Preset com campo novo: acrescente aqui, ou ele nasce morto igual.
      // ⚠️ `ondeSePaga` fica de FORA: ele é derivado da regra de IC, que já é
      // gravada. Duas fontes para a mesma pergunta divergem no primeiro ajuste
      // pelo avançado — ver a nota em `PresetPixel.ondeSePaga`.
      setup: input.preset
        ? {
            temPixelNativo: input.preset.temPixelNativo,
            outroEnviaPurchase: input.preset.outroEnviaPurchase,
          }
        : undefined,
      eventOwners: input.eventOwners ?? donosDoPreset(input.preset ?? PRESET_PADRAO),
      metaPixels: { create: metaPixels },
      eventRules: { create: rulesFromForm(input) },
    },
    include: INCLUDE,
  });
  return toDTO(px);
}

export async function updatePixel(id: string, input: PixelFormInput): Promise<PixelConfigDTO> {
  const userId = await requireUserId();
  const existing = await prisma.pixelConfig.findFirst({
    where: { id, userId },
    select: { id: true, metaPixels: { select: { pixelId: true, accessToken: true } } },
  });
  if (!existing) throw new Error("Pixel não encontrado.");

  // O token nunca volta para o cliente, então o formulário reenvia vazio para os
  // pixels já salvos. Preserva o token atual quando o form não trouxer um novo.
  const tokenByPixelId = new Map(existing.metaPixels.map((m) => [m.pixelId, m.accessToken]));
  const metaPixels = cleanMetaPixels(input.metaPixels).map((m) => ({
    ...m,
    accessToken: m.accessToken ?? tokenByPixelId.get(m.pixelId) ?? null,
  }));
  if (metaPixels.length === 0) throw new Error("Adicione ao menos um pixel da Meta.");

  // Substitui pixels e regras (mais simples e previsível que fazer diff).
  await prisma.$transaction([
    prisma.metaPixel.deleteMany({ where: { pixelConfigId: id } }),
    prisma.pixelEventRule.deleteMany({ where: { pixelConfigId: id } }),
    prisma.pixelConfig.update({
      where: { id },
      data: {
        name: input.name?.trim() || "Meta Pixel",
        // ⚠️ `undefined` MANTÉM o valor gravado; `{}` o zera. O formulário só
        // manda o mapa quando o usuário mexeu nele — sem esta distinção, salvar
        // qualquer outra coisa do pixel devolveria todos os eventos à Trackhub em
        // silêncio, que é o mesmo defeito do token apagado ao renomear.
        eventOwners: input.eventOwners ?? undefined,
        // Objeto literal, não a interface: o Json do Prisma exige index signature.
      //
      // 🔴 Escrever campo a campo custou os dois campos que vieram depois:
      // `outroEnviaPurchase` e `ondeSePaga` eram descartados aqui, e só não
      // apareceram como bug porque `lerPreset` sabe INFERIR os dois. Uma
      // resposta explícita que sobrevive por inferência é uma resposta que
      // ninguém guardou — e a inferência só empata enquanto o mapa de donos e a
      // regra de IC não puderem dizer outra coisa.
      //
      // ⚠️ Preset com campo novo: acrescente aqui, ou ele nasce morto igual.
      // ⚠️ `ondeSePaga` fica de FORA: ele é derivado da regra de IC, que já é
      // gravada. Duas fontes para a mesma pergunta divergem no primeiro ajuste
      // pelo avançado — ver a nota em `PresetPixel.ondeSePaga`.
      setup: input.preset
        ? {
            temPixelNativo: input.preset.temPixelNativo,
            outroEnviaPurchase: input.preset.outroEnviaPurchase,
          }
        : undefined,
        metaPixels: { create: metaPixels },
        eventRules: { create: rulesFromForm(input) },
      },
    }),
  ]);
  const px = await prisma.pixelConfig.findUnique({ where: { id }, include: INCLUDE });
  return toDTO(px!);
}

export async function deletePixel(id: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  const px = await prisma.pixelConfig.findFirst({ where: { id, userId }, select: { id: true } });
  if (!px) throw new Error("Pixel não encontrado.");
  await prisma.pixelConfig.delete({ where: { id } });
  return { id };
}

// ───────────────── O script instalado bate com a configuração? ─────────────────

export interface SnippetCheckDTO {
  /**
   * - `ok` — o script instalado detecta exatamente o que está configurado
   * - `divergente` — 🔴 as duas pontas discordam; as frases dizem em quê
   * - `script-antigo` — ele está rodando, mas é anterior a este diagnóstico
   * - `sem-dados` — nenhum evento do script chegou; não dá para afirmar nada
   */
  estado: "ok" | "divergente" | "script-antigo" | "sem-dados";
  /** Quando o último evento do script chegou (ISO). */
  visto: string | null;
  /** O que muda, em linguagem de consequência. Vazio quando `ok`. */
  divergencias: string[];
  /**
   * O que a VERSÃO do script instalado não permite conferir.
   *
   * ⚠️ É nota, não divergência: um script v1 pode estar perfeitamente correto —
   * ele só não sabe reportar "quem envia cada evento". Marcá-lo como divergente
   * pintaria de âmbar a gaveta de todo usuário no dia do deploy.
   */
  nota: string | null;
  /**
   * Estado real **por evento**, não só "chegou alguma coisa".
   *
   * 🔴 É o que faltava quando o InitiateCheckout ficou morto: a gaveta dizia
   * "último evento recebido há 5min" — verdade, era o PageView — enquanto o IC
   * não disparava havia semanas. Um agregado esconde exatamente o evento que
   * parou.
   *
   * ⚠️ `visto: null` com o evento LIGADO é o sinal que importa: configurado e
   * nunca recebido. Com o evento desligado, `null` é o esperado e a tela não
   * alarma.
   */
  porEvento: { evento: string; ligado: boolean; visto: string | null; total: number }[];
}

/**
 * Compara o snippet que está no site do cliente com a regra ao vivo.
 *
 * > ### ⛔ `sem-dados` NÃO é `ok`
 * > A ausência de evento pode significar "script não instalado", "site sem
 * > tráfego" ou "script instalado e quebrado" — e não temos como distinguir os
 * > três. Dizer "tudo certo" aqui seria afirmar o que não sabemos, e é
 * > exatamente o silêncio que este diagnóstico existe para acabar.
 *
 * ⚠️ Decide pelo evento **mais recente vindo do script**, não pela última
 * assinatura já vista: um script REINSTALADO numa versão anterior tem de
 * aparecer como antigo, e não como a assinatura boa que ele mandou semana
 * passada. Eventos com `eventId` começando em `gw:` são do webhook do gateway
 * (`webhook/checkoutEvent.ts`), não do navegador — eles nunca têm detector.
 */
export async function conferirSnippet(pixelConfigId: string): Promise<SnippetCheckDTO> {
  const userId = await requireUserId();
  const config = await prisma.pixelConfig.findFirst({
    where: { id: pixelConfigId, userId },
    include: { eventRules: true },
  });
  if (!config) throw new Error("Pixel não encontrado.");

  const ic = config.eventRules.find((r) => r.eventType === "INITIATE_CHECKOUT");
  const det = (ic?.detection as DetectionJson) ?? null;
  const esperado = assinaturaDetectores({
    lead: config.eventRules.find((r) => r.eventType === "LEAD")?.enabled ?? false,
    addToCart: config.eventRules.find((r) => r.eventType === "ADD_TO_CART")?.enabled ?? false,
    // Mesma constante que o gerador usa (`tipoDeIC`). Com o padrão escrito à
    // mão nos dois lados, o verificador podia concordar consigo mesmo sobre um
    // tipo que o script não tinha — foi o que deixou um detector morto passar
    // por "ok".
    ic: ic?.enabled ? (det?.tipo ?? TIPO_IC_PADRAO) : null,
    icValor: det?.valor ?? null,
    // As duas linhas abaixo são o achado que a v1 não cobria: as duas viajam
    // ASSADAS no snippet, e mudá-las sem reinstalar produzia script defasado
    // que o aviso não pegava.
    nativo: lerPreset(config.setup, config.eventOwners, det?.tipo ?? null).temPixelNativo,
    donos: Object.fromEntries(
      EVENTOS_DO_PIXEL.map((e) => [e, donoDoEvento(config.eventOwners, e)]),
    ),
  });

  const ultimo = await prisma.pixelEvent.findFirst({
    where: {
      pixelConfigId,
      userId,
      OR: [{ eventId: null }, { NOT: { eventId: { startsWith: "gw:" } } }],
    },
    orderBy: { timestamp: "desc" },
    select: { detectores: true, timestamp: true },
  });

  /**
   * ⚠️ Conta só o que veio do NAVEGADOR (`gw:` fora), pela mesma razão do
   * `ultimo`: o InitiateCheckout criado pelo webhook do gateway provaria que o
   * gateway está avisando, não que o script está funcionando — e é o script
   * que esta tela existe para conferir.
   */
  const porEventoBruto = await prisma.pixelEvent.groupBy({
    by: ["event"],
    where: {
      pixelConfigId,
      userId,
      OR: [{ eventId: null }, { NOT: { eventId: { startsWith: "gw:" } } }],
    },
    _count: { _all: true },
    _max: { timestamp: true },
  });

  const ligados: Record<string, boolean> = {
    PageView: true, // sempre ativo — não passa por regra
    Lead: config.eventRules.find((r) => r.eventType === "LEAD")?.enabled ?? false,
    AddToCart: config.eventRules.find((r) => r.eventType === "ADD_TO_CART")?.enabled ?? false,
    InitiateCheckout: ic?.enabled ?? false,
    Purchase: config.eventRules.find((r) => r.eventType === "PURCHASE")?.enabled ?? false,
  };
  const porEvento = EVENTOS_DO_PIXEL.map((e) => {
    const linha = porEventoBruto.find((x) => x.event === e);
    return {
      evento: e,
      ligado: ligados[e] ?? false,
      visto: linha?._max.timestamp?.toISOString() ?? null,
      total: linha?._count._all ?? 0,
    };
  });

  if (!ultimo) return { estado: "sem-dados", visto: null, divergencias: [], nota: null, porEvento };
  const visto = ultimo.timestamp.toISOString();
  if (!ultimo.detectores) return { estado: "script-antigo", visto, divergencias: [], nota: null, porEvento };

  const divergencias = diferencasDeDetectores(ultimo.detectores, esperado);
  return {
    estado: divergencias.length ? "divergente" : "ok",
    visto,
    divergencias,
    nota: avisoDeVersao(ultimo.detectores),
    porEvento,
  };
}

export async function togglePixel(id: string): Promise<{ id: string; enabled: boolean }> {
  const userId = await requireUserId();
  const px = await prisma.pixelConfig.findFirst({ where: { id, userId }, select: { enabled: true } });
  if (!px) throw new Error("Pixel não encontrado.");
  const updated = await prisma.pixelConfig.update({ where: { id }, data: { enabled: !px.enabled } });
  return { id, enabled: updated.enabled };
}
