import type { NextRequest } from "next/server";

import { decryptSecretSafe } from "@/lib/crypto/secrets";
import { sendServerEvent, type CapiEventName } from "@/lib/facebook/capi";
import { prisma } from "@/lib/prisma";
import type { PixelEventType } from "@/generated/prisma/enums";

// Chamado a partir do script instalado em sites de terceiros → CORS liberado.
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers: CORS });
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Eventos que dependem de uma regra habilitada na aba Pixel. `PageView` NÃO
 * entra aqui de propósito: é o evento base do pixel, sempre ativo, e não existe
 * `PAGE_VIEW` no enum `PixelEventType` — tratá-lo como regra exigiria migration
 * para nada, já que não há o que configurar.
 */
const EVENT_MAP: Record<string, { capi: CapiEventName; rule: PixelEventType }> = {
  Lead: { capi: "Lead", rule: "LEAD" },
  AddToCart: { capi: "AddToCart", rule: "ADD_TO_CART" },
  InitiateCheckout: { capi: "InitiateCheckout", rule: "INITIATE_CHECKOUT" },
};

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0]!.trim() : req.headers.get("x-real-ip");
}

/**
 * Recebe um evento do script de pixel próprio (Lead/AddToCart/InitiateCheckout)
 * e repassa para a Conversions API de cada pixel da Meta do config, se a regra
 * do evento estiver habilitada. Purchase NÃO passa aqui (é server-side no webhook).
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const t = await req.text();
    body = t ? JSON.parse(t) : {};
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const configId = typeof body.pixelConfigId === "string" ? body.pixelConfigId : null;
  const eventKey = typeof body.event === "string" ? body.event : "";
  const mapped = EVENT_MAP[eventKey];
  const isPageView = eventKey === "PageView";
  if (!configId || (!mapped && !isPageView)) return json({ error: "Parâmetros inválidos." }, 400);

  const config = await prisma.pixelConfig.findUnique({
    where: { id: configId },
    include: {
      metaPixels: true,
      eventRules: mapped ? { where: { eventType: mapped.rule } } : false,
    },
  });
  if (!config || !config.enabled) return json({ error: "Pixel não encontrado." }, 404);

  if (mapped) {
    const rule = config.eventRules[0];
    if (!rule?.enabled) return json({ ok: true, skipped: "regra desabilitada" });
  }

  const capiEvent: CapiEventName = mapped ? mapped.capi : "PageView";

  // Persiste o evento (Bloco 5): sem isto o funil não tem como contar o
  // "Initiate Checkout" — antes o evento só era repassado à CAPI e descartado.
  // Falhar aqui não pode impedir o envio, que é o que o usuário realmente quer.
  try {
    await prisma.pixelEvent.create({
      data: {
        userId: config.userId,
        pixelConfigId: config.id,
        event: eventKey,
        eventId: typeof body.eventId === "string" ? body.eventId : null,
        url: typeof body.url === "string" ? body.url.slice(0, 500) : null,
        fbclid: typeof body.fbclid === "string" ? body.fbclid : null,
      },
    });
  } catch (e) {
    console.error("[pixel/event] falha ao persistir evento:", e);
  }

  const targets =
    config.metaPixels.length > 0
      ? config.metaPixels
      : config.pixelId
        ? [{ pixelId: config.pixelId, accessToken: config.accessToken }]
        : [];

  const eventId = typeof body.eventId === "string" ? body.eventId : `${eventKey}-${Date.now()}`;
  let sent = 0;
  for (const mp of targets) {
    // O token fica encriptado no banco; decripta só aqui, para a chamada.
    const accessToken = decryptSecretSafe(mp.accessToken);
    if (!accessToken) continue;
    const r = await sendServerEvent({
      eventName: capiEvent,
      pixelId: mp.pixelId,
      accessToken,
      eventId,
      value: typeof body.value === "number" ? body.value : undefined,
      currency: typeof body.currency === "string" ? body.currency : undefined,
      fbclid: typeof body.fbclid === "string" ? body.fbclid : undefined,
      eventSourceUrl: typeof body.url === "string" ? body.url : undefined,
      clientIp: clientIp(req),
      clientUserAgent: req.headers.get("user-agent"),
    });
    if (r.ok) sent++;
    else console.error(`[CAPI] evento ${eventKey} pixel ${mp.pixelId}: ${r.error}`);
  }

  return json({ ok: true, event: eventKey, sent });
}
