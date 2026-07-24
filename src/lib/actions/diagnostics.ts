"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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

export async function getInstallChecklist(): Promise<ChecklistItemDTO[]> {
  const userId = await requireUserId();

  const [profiles, trackedAccounts, webhooks, clicks, pixels] = await Promise.all([
    prisma.adProfile.count({ where: { userId } }),
    prisma.adAccount.count({ where: { userId, trackingEnabled: true } }),
    prisma.webhook.count({ where: { userId, active: true } }),
    prisma.click.count({ where: { userId } }),
    prisma.pixelConfig.findMany({
      where: { userId, enabled: true },
      select: { id: true, metaPixels: { select: { accessToken: true } } },
    }),
  ]);

  const pixelsComToken = pixels.filter((p) => p.metaPixels.some((m) => m.accessToken)).length;

  return [
    {
      key: "facebook",
      label: "Conta do Facebook conectada",
      ok: profiles > 0,
      detail: profiles > 0 ? `${profiles} perfil(is) conectado(s).` : "Nenhum perfil do Facebook conectado.",
      href: "/dashboard/integracoes/anuncios",
    },
    {
      key: "adAccount",
      label: "Ao menos uma conta de anúncio ativa",
      ok: trackedAccounts > 0,
      detail:
        trackedAccounts > 0
          ? `${trackedAccounts} conta(s) com rastreamento ligado.`
          : "Nenhuma conta de anúncio com rastreamento ligado.",
      href: "/dashboard/integracoes/anuncios",
    },
    {
      key: "webhook",
      label: "Webhook de gateway configurado",
      ok: webhooks > 0,
      detail: webhooks > 0 ? `${webhooks} webhook(s) ativo(s).` : "Nenhum webhook ativo — as vendas não chegam.",
      href: "/dashboard/integracoes/webhooks",
    },
    {
      key: "utmScript",
      label: "Script de UTM detectado",
      ok: clicks > 0,
      detail:
        clicks > 0
          ? `${clicks} clique(s) já recebido(s) — o script está reportando.`
          : "Nenhum clique recebido ainda. Baixe o script na aba UTMs e instale no <head> do site.",
      href: "/dashboard/integracoes/utms",
    },
    {
      key: "pixel",
      label: "Pixel configurado",
      ok: pixelsComToken > 0,
      detail:
        pixelsComToken > 0
          ? `${pixelsComToken} pixel(is) com token da Conversions API.`
          : "Nenhum pixel com token da CAPI — os eventos não seriam enviados.",
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
