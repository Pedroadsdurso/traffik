"use server";

import { auth } from "@/auth";
import { encryptSecret } from "@/lib/crypto/secrets";
import { getLastWorkspaceId } from "@/lib/actions/workspaces";
import { escopoDeConfig } from "@/lib/areas/escopoConfig";
import { prisma } from "@/lib/prisma";
import type { PixelEventType, PurchaseSendMode, PurchaseValueMode } from "@/generated/prisma/enums";

/**
 * `clique_checkout` é o padrão: dispara no clique num link que leva ao gateway,
 * na página de vendas. É o único modo que funciona quando o checkout é hospedado
 * pelo gateway (pay.kirvano.com), onde o cliente não consegue instalar script.
 */
import { lerDonos, type MapaDeDonos } from "@/lib/pixel/donos";
import { assinaturaDetectores, avisoDeVersao, diferencasDeDetectores } from "@/lib/pixel/detectores";
import { EVENTOS_DO_PIXEL, donoDoEvento } from "@/lib/pixel/donos";
import { donosDoPreset, lerPreset, type PresetPixel } from "@/lib/pixel/preset";

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
  return {
    id: px.id,
    name: px.name,
    enabled: px.enabled,
    eventOwners: lerDonos(px.eventOwners),
    preset: lerPreset(px.setup, px.eventOwners),
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

/** Monta os event rules a partir do formulário. */
function rulesFromForm(input: PixelFormInput) {
  const detection =
    input.initiateCheckout.enabled && input.initiateCheckout.detectionType && input.initiateCheckout.detectionValue?.trim()
      ? { tipo: input.initiateCheckout.detectionType, valor: input.initiateCheckout.detectionValue.trim() }
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
      // Objeto literal, não a interface: o Json do Prisma exige index signature,
      // e escrever os campos aqui também impede que uma propriedade nova do
      // preset vá parar no banco sem ninguém decidir.
      setup: input.preset ? { temPixelNativo: input.preset.temPixelNativo } : undefined,
      eventOwners: input.eventOwners ?? donosDoPreset(input.preset ?? { temPixelNativo: true }),
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
        // qualquer outra coisa do pixel devolveria todos os eventos à Traffik em
        // silêncio, que é o mesmo defeito do token apagado ao renomear.
        eventOwners: input.eventOwners ?? undefined,
        // Objeto literal, não a interface: o Json do Prisma exige index signature,
      // e escrever os campos aqui também impede que uma propriedade nova do
      // preset vá parar no banco sem ninguém decidir.
      setup: input.preset ? { temPixelNativo: input.preset.temPixelNativo } : undefined,
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
    ic: ic?.enabled ? (det?.tipo ?? "clique_checkout") : null,
    icValor: det?.valor ?? null,
    // As duas linhas abaixo são o achado que a v1 não cobria: as duas viajam
    // ASSADAS no snippet, e mudá-las sem reinstalar produzia script defasado
    // que o aviso não pegava.
    nativo: lerPreset(config.setup, config.eventOwners).temPixelNativo,
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

  if (!ultimo) return { estado: "sem-dados", visto: null, divergencias: [], nota: null };
  const visto = ultimo.timestamp.toISOString();
  if (!ultimo.detectores) return { estado: "script-antigo", visto, divergencias: [], nota: null };

  const divergencias = diferencasDeDetectores(ultimo.detectores, esperado);
  return {
    estado: divergencias.length ? "divergente" : "ok",
    visto,
    divergencias,
    nota: avisoDeVersao(ultimo.detectores),
  };
}

export async function togglePixel(id: string): Promise<{ id: string; enabled: boolean }> {
  const userId = await requireUserId();
  const px = await prisma.pixelConfig.findFirst({ where: { id, userId }, select: { enabled: true } });
  if (!px) throw new Error("Pixel não encontrado.");
  const updated = await prisma.pixelConfig.update({ where: { id }, data: { enabled: !px.enabled } });
  return { id, enabled: updated.enabled };
}
