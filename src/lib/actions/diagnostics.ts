"use server";

import {
  analisarPayload,
  exemploDoGateway,
  gatewaysComExemplo,
  type Diagnostico,
} from "@/lib/gateways/testador";

import { auth } from "@/auth";
import { getLastWorkspaceId } from "@/lib/actions/workspaces";
import { escopoDeConfig } from "@/lib/areas/escopoConfig";
import { plural } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ordemDoEspelho } from "@/lib/pixel/espelho";
import { parseTrackingCodes } from "@/lib/utm/parse";
import type { WebhookLogStatus } from "@/generated/prisma/enums";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

// ─────────────────────── Teste de Webhook (payloads crus) ───────────────────────

export interface WebhookLogDTO {
  id: string;
  gateway: string;
  status: WebhookLogStatus;
  message: string | null;
  httpStatus: number | null;
  saleId: string | null;
  createdAt: string;
  /** Payload cru já serializado e indentado, pronto para exibir. */
  payload: string;
}

/** Últimos payloads recebidos, do mais recente para o mais antigo. */
export async function listWebhookLogs(limit = 20): Promise<WebhookLogDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.webhookLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map((r) => ({
    id: r.id,
    gateway: r.gateway,
    status: r.status,
    message: r.message,
    httpStatus: r.httpStatus,
    saleId: r.saleId,
    createdAt: r.createdAt.toISOString(),
    payload: JSON.stringify(r.payloadRaw, null, 2),
  }));
}

// ─────────────────── Espelho no pixel do navegador (`fbq`) ───────────────────

export interface EspelhoResumoDTO {
  dias: number;
  total: number;
  /** Só os estados com contagem > 0, na ordem de `ESTADOS_DO_ESPELHO`. */
  porEstado: { estado: string; n: number }[];
  /** Detalhe por evento, do mais frequente para o menos. */
  porEvento: { event: string; total: number; estados: { estado: string; n: number }[] }[];
}

/**
 * "Os espelhos estão saindo?" — a pergunta que só o DevTools respondia.
 *
 * O espelho no `fbq` é o que faz a Meta juntar o evento do navegador com o nosso
 * da CAPI. Quando o snippet está colado ANTES do código do Facebook, o `fbq`
 * ainda não existe no momento do disparo; hoje o script espera e, se desistir,
 * grava `sem-fbq`. **Este resumo é o único lugar em que isso aparece sem abrir o
 * console na página do cliente** — que é o que não escala com vários deles.
 */
export async function resumoEspelhos(dias = 7): Promise<EspelhoResumoDTO> {
  const userId = await requireUserId();
  const janela = Math.min(Math.max(Math.trunc(dias), 1), 90);
  const desde = new Date(Date.now() - janela * 24 * 60 * 60 * 1000);

  const linhas = await prisma.pixelEvent.groupBy({
    by: ["event", "espelho"],
    where: { userId, timestamp: { gte: desde } },
    _count: { _all: true },
  });

  // Estado que a tela não sabe nomear vira `nulo` em vez de sumir — mesma regra
  // do "Não identificado" no ranking de países.
  const chave = (v: string | null) => (v && ordemDoEspelho(v) < 99 ? v : "nulo");
  const ordenar = (m: Map<string, number>) =>
    [...m]
      .map(([estado, n]) => ({ estado, n }))
      .sort((a, b) => ordemDoEspelho(a.estado) - ordemDoEspelho(b.estado));

  const geral = new Map<string, number>();
  const porEvento = new Map<string, Map<string, number>>();
  let total = 0;

  for (const l of linhas) {
    const n = l._count._all;
    const k = chave(l.espelho);
    total += n;
    geral.set(k, (geral.get(k) ?? 0) + n);
    const doEvento = porEvento.get(l.event) ?? new Map<string, number>();
    doEvento.set(k, (doEvento.get(k) ?? 0) + n);
    porEvento.set(l.event, doEvento);
  }

  return {
    dias: janela,
    total,
    porEstado: ordenar(geral),
    porEvento: [...porEvento]
      .map(([event, m]) => ({
        event,
        total: [...m.values()].reduce((a, b) => a + b, 0),
        estados: ordenar(m),
      }))
      .sort((a, b) => b.total - a.total),
  };
}

// ─────────────────────────── Teste de Tracking ───────────────────────────

export interface TrackingTestDTO {
  ok: boolean;
  error?: string;
  /** Parâmetros crus lidos da querystring. */
  params: { key: string; value: string }[];
  parsed: {
    campaignName: string | null;
    campaignId: string | null;
    adsetName: string | null;
    adsetId: string | null;
    adName: string | null;
    adId: string | null;
    placement: string | null;
  };
  /** A qual campanha/anúncio do nosso banco a venda seria vinculada. */
  match: {
    campaign: { name: string; fbCampaignId: string; by: "id" | "nome" } | null;
    ad: { name: string; fbAdId: string; by: "id" | "nome" } | null;
  };
  /** Explicação em português do que aconteceria. */
  notes: string[];
}

/**
 * Interpreta uma URL com UTMs exatamente como o webhook faria: extrai os
 * códigos e tenta casar com a campanha/anúncio sincronizados — primeiro pelo id
 * do Facebook (confiável) e, se não achar, pelo nome (frágil, é o fallback).
 */
export async function analyzeTrackingUrl(rawUrl: string): Promise<TrackingTestDTO> {
  const userId = await requireUserId();

  const empty: TrackingTestDTO["parsed"] = {
    campaignName: null,
    campaignId: null,
    adsetName: null,
    adsetId: null,
    adName: null,
    adId: null,
    placement: null,
  };

  let url: URL;
  try {
    // Aceita tanto a URL completa quanto só a querystring colada.
    const text = rawUrl.trim();
    url = new URL(text.startsWith("http") ? text : `https://exemplo.com/?${text.replace(/^[?&]/, "")}`);
  } catch {
    return { ok: false, error: "URL inválida.", params: [], parsed: empty, match: { campaign: null, ad: null }, notes: [] };
  }

  const params = [...url.searchParams.entries()].map(([key, value]) => ({ key, value }));

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { xcodSeparator: true } });
  const parsed = parseTrackingCodes(
    {
      utmCampaign: url.searchParams.get("utm_campaign"),
      utmMedium: url.searchParams.get("utm_medium"),
      utmContent: url.searchParams.get("utm_content"),
      utmTerm: url.searchParams.get("utm_term"),
      xcod: url.searchParams.get("xcod"),
    },
    user?.xcodSeparator,
  );

  const notes: string[] = [];
  if (params.length === 0) notes.push("Nenhum parâmetro na URL — nada seria rastreado.");
  if (!url.searchParams.get("utm_campaign") && !url.searchParams.get("xcod")) {
    notes.push("Sem utm_campaign nem xcod: a venda não teria como ser ligada a uma campanha.");
  }
  if (url.searchParams.get("xcod") && !user?.xcodSeparator) {
    notes.push("Há xcod, mas este usuário ainda não tem separador gerado — abra a aba UTMs para gerá-lo.");
  }
  if (url.searchParams.get("fbclid")) notes.push("fbclid presente: dá para deduplicar e enriquecer o evento da CAPI.");

  // ── Casamento com o que já foi sincronizado do Facebook ──
  let campaign: TrackingTestDTO["match"]["campaign"] = null;
  if (parsed.campaignId) {
    const c = await prisma.campaign.findFirst({
      where: { fbCampaignId: parsed.campaignId, adAccount: { userId } },
      select: { name: true, fbCampaignId: true },
    });
    if (c) campaign = { ...c, by: "id" };
  }
  if (!campaign && parsed.campaignName) {
    const c = await prisma.campaign.findFirst({
      where: { name: parsed.campaignName, adAccount: { userId } },
      select: { name: true, fbCampaignId: true },
    });
    if (c) campaign = { ...c, by: "nome" };
  }

  let ad: TrackingTestDTO["match"]["ad"] = null;
  if (parsed.adId) {
    const a = await prisma.ad.findFirst({
      where: { fbAdId: parsed.adId, adAccount: { userId } },
      select: { name: true, fbAdId: true },
    });
    if (a) ad = { ...a, by: "id" };
  }
  if (!ad && parsed.adName) {
    const a = await prisma.ad.findFirst({
      where: { name: parsed.adName, adAccount: { userId } },
      select: { name: true, fbAdId: true },
    });
    if (a) ad = { ...a, by: "nome" };
  }

  if (parsed.campaignId && !campaign) {
    notes.push(`Campanha ${parsed.campaignId} não existe no banco — rode a sincronização na aba Anúncios.`);
  }
  if (parsed.adId && !ad) {
    notes.push(`Anúncio ${parsed.adId} não existe no banco — rode a sincronização na aba Anúncios.`);
  }
  if (campaign?.by === "nome" || ad?.by === "nome") {
    notes.push("Casou por NOME (frágil: dois anúncios com o mesmo nome ficam ambíguos). Use os códigos da aba UTMs para casar por id.");
  }

  return { ok: true, params, parsed, match: { campaign, ad }, notes };
}

// ─────────────────────── Checklist de instalação ───────────────────────

export interface ChecklistItemDTO {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  /** Para onde mandar o usuário resolver. */
  href: string | null;
}

/**
 * 🎯 FONTE ÚNICA das pendências de uma Área de Trabalho.
 *
 * Três telas fazem a MESMA pergunta — "o que falta configurar aqui?" — e antes
 * cada uma respondia por conta própria:
 *
 * | Tela | Consumia |
 * |---|---|
 * | Banner do Dashboard | (não existia) |
 * | Cards de `/dashboard/areas` | uma função local, olhando as listas do `Workspace` |
 * | Checklist de Integrações › Testes | `getInstallChecklist` |
 *
 * Duas fontes divergindo é questão de tempo: a da tela de Áreas olhava
 * `Workspace.accountIds`, que a Sessão 1 substituiu por FK — ela continuaria
 * dizendo "sem conta de anúncio" para uma área já configurada.
 *
 * Agora `getInstallChecklist` é a fonte, e as três telas só a apresentam de
 * formas diferentes.
 */
export interface PendenciasDTO {
  areaId: string;
  ehPrincipal: boolean;
  /** Itens que faltam, em ordem de impacto. Vazio = área configurada. */
  faltando: ChecklistItemDTO[];
  /** Todos os itens, para quem quer mostrar os concluídos também. */
  itens: ChecklistItemDTO[];
  total: number;
  ok: number;
}

/**
 * Pendências de VÁRIAS áreas de uma vez — para a tela que lista todas.
 *
 * `Promise.all` em vez de sequencial: cada área custa 5 consultas, e em série
 * seriam N × 5 × ~99ms de ida e volta ao Supabase numa tela que abre com todas
 * as áreas na frente.
 */
export async function getPendenciasDasAreas(ids: string[]): Promise<Record<string, PendenciasDTO>> {
  const r = await Promise.all(ids.map((id) => getPendenciasDaArea(id)));
  return Object.fromEntries(r.map((p) => [p.areaId, p]));
}

/**
 * As pendências da área ativa, prontas para o banner e para os cards.
 *
 * ⚠️ **A Principal não gera banner.** Ela é o catch-all e é o estado normal de
 * quem só tem uma operação: um aviso permanente ali viraria ruído que se
 * aprende a ignorar — inclusive quando passar a dizer outra coisa. É a mesma
 * regra da faixa de banco de desenvolvimento.
 */
export async function getPendenciasDaArea(workspaceId?: string | null): Promise<PendenciasDTO> {
  const userId = await requireUserId();
  const escopo = await escopoDeConfig(userId, workspaceId ?? (await getLastWorkspaceId()));
  const itens = await getInstallChecklist(escopo.areaId);
  const faltando = itens.filter((i) => !i.ok);
  return {
    areaId: escopo.areaId,
    ehPrincipal: escopo.ehPrincipal,
    faltando: escopo.ehPrincipal ? [] : faltando,
    itens,
    total: itens.length,
    ok: itens.length - faltando.length,
  };
}

/**
 * Checklist de instalação **da Área de Trabalho ativa**.
 *
 * ⚠️ É diagnóstico de CONFIGURAÇÃO, e configuração agora pertence à área — um
 * checklist global diria "tudo certo" para uma área recém-criada que ainda não
 * tem webhook nem pixel nenhum, que é justamente quando ele precisa avisar.
 *
 * ⚠️ **Cliques não são recortados por área**: um `Click` não tem dono
 * declarado (a área dele sai da atribuição por campanha). O item "script de
 * UTM" continua sendo do nível da conta — e é coerente, porque o script de UTM
 * também é, por desenho.
 */
export async function getInstallChecklist(workspaceId?: string | null): Promise<ChecklistItemDTO[]> {
  const userId = await requireUserId();
  const escopo = await escopoDeConfig(userId, workspaceId ?? (await getLastWorkspaceId()));

  const [contasComPerfil, trackedAccounts, webhooks, clicks, pixels] = await Promise.all([
    prisma.adAccount.count({ where: { userId, adProfileId: { not: null }, ...escopo.where } }),
    prisma.adAccount.count({ where: { userId, trackingEnabled: true, ...escopo.where } }),
    prisma.webhook.count({ where: { userId, active: true, ...escopo.where } }),
    prisma.click.count({ where: { userId } }),
    prisma.pixelConfig.findMany({
      where: { userId, enabled: true, ...escopo.where },
      select: { id: true, metaPixels: { select: { accessToken: true } } },
    }),
  ]);

  const pixelsComToken = pixels.filter((p) => p.metaPixels.some((m) => m.accessToken)).length;

  return [
    {
      key: "facebook",
      label: "Conta de anúncio nesta área",
      ok: contasComPerfil > 0,
      detail:
        contasComPerfil > 0
          ? `${plural(contasComPerfil, "conta de anúncio vinculada", "contas de anúncio vinculadas")} a esta área.`
          : "Nenhuma conta de anúncio nesta área — sem ela, o gasto exibido não é o desta operação.",
      href: "/dashboard/integracoes/anuncios",
    },
    {
      key: "adAccount",
      label: "Ao menos uma conta de anúncio ativa",
      ok: trackedAccounts > 0,
      detail:
        trackedAccounts > 0
          ? `${plural(trackedAccounts, "conta com rastreamento ligado", "contas com rastreamento ligado")}.`
          : "Nenhuma conta de anúncio com rastreamento ligado.",
      href: "/dashboard/integracoes/anuncios",
    },
    {
      key: "webhook",
      label: "Webhook de gateway configurado",
      ok: webhooks > 0,
      detail: webhooks > 0 ? `${plural(webhooks, "webhook ativo", "webhooks ativos")}.` : "Nenhum webhook ativo — as vendas não chegam.",
      href: "/dashboard/integracoes/webhooks",
    },
    {
      key: "utmScript",
      label: "Script de UTM detectado",
      ok: clicks > 0,
      detail:
        clicks > 0
          ? `${plural(clicks, "clique já recebido", "cliques já recebidos")} — o script está reportando.`
          : "Nenhum clique recebido ainda. Copie o script na aba UTMs e instale no <head> do site.",
      // ⚠️ Único item que NÃO é por área: o script de UTM é único por conta,
      // por desenho, e um `Click` não tem dono declarado.
      href: "/dashboard/integracoes/utms",
    },
    {
      key: "pixel",
      label: "Pixel configurado",
      ok: pixelsComToken > 0,
      detail:
        // "token da CAPI" é ESTADO interno — o vocabulário que o resto do
        // produto já trocou por "conectado". O token só é nomeado onde ele é o
        // que o usuário cola (o campo da gaveta do Pixel).
        pixelsComToken > 0
          ? `${plural(pixelsComToken, "pixel conectado", "pixels conectados")}.`
          : "Nenhum pixel conectado — os eventos não chegam ao Facebook.",
      href: "/dashboard/integracoes/pixel",
    },
  ];
}

// ───────────────────── Opções do teste de pixel ─────────────────────

export interface PixelOptionDTO {
  id: string;
  name: string;
  metaCount: number;
}

/** Pixels que têm ao menos um token da CAPI — os únicos testáveis. */
export async function listTestablePixels(): Promise<PixelOptionDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.pixelConfig.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, accessToken: true, metaPixels: { select: { accessToken: true } } },
  });
  return rows
    .filter((p) => p.metaPixels.some((m) => m.accessToken) || p.accessToken)
    .map((p) => ({ id: p.id, name: p.name, metaCount: p.metaPixels.length }));
}

// ─────────────────────── Testador de payload de gateway ───────────────────────

/**
 * Analisa um payload colado contra o parser de um gateway.
 *
 * É como se valida uma integração **antes de ter conta no gateway**: cola-se o
 * JSON da documentação e a resposta diz o que foi extraído, o que ficou vazio e
 * — o que mais importa — **por quê**.
 *
 * ⚠️ Leitura pura: não cria venda, não toca no banco, não chama ninguém. O
 * `auth()` está aqui porque server action é endpoint público, não porque haja
 * dado de usuário envolvido.
 */
export async function testarPayloadDeGateway(input: {
  gateway: string;
  json: string;
}): Promise<{ ok: true; diagnostico: Diagnostico } | { ok: false; erro: string }> {
  await requireUserId();

  const texto = input.json.trim();
  if (!texto) return { ok: false, erro: "Cole o JSON do webhook para analisar." };

  let payload: unknown;
  try {
    payload = JSON.parse(texto);
  } catch (e) {
    // A mensagem do próprio JSON.parse costuma apontar a posição do erro, que é
    // mais útil que um "JSON inválido" genérico.
    return { ok: false, erro: `JSON inválido: ${e instanceof Error ? e.message : "não foi possível ler"}` };
  }

  return { ok: true, diagnostico: analisarPayload(input.gateway, payload) };
}

/** Gateways que o testador oferece, com os exemplos embutidos de cada um. */
export async function listarGatewaysDoTestador() {
  await requireUserId();
  return gatewaysComExemplo();
}

/** Um payload de exemplo, já formatado para colar no campo. */
export async function carregarExemploDeGateway(gateway: string, indice: number) {
  await requireUserId();
  return exemploDoGateway(gateway, indice);
}
