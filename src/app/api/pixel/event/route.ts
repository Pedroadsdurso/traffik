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
  if (!configId || !mapped) return json({ error: "Parâmetros inválidos." }, 400);

  const config = await prisma.pixelConfig.findUnique({
    where: { id: configId },
    include: { metaPixels: true, eventRules: { where: { eventType: mapped.rule } } },
  });
  if (!config || !config.enabled) return json({ error: "Pixel não encontrado." }, 404);

  const rule = config.eventRules[0];
  if (!rule?.enabled) return json({ ok: true, skipped: "regra desabilitada" });

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
      eventName: mapped.capi,
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
