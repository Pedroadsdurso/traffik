import type { NextRequest } from "next/server";
import { ipDaRequisicao } from "@/lib/geo/clientIp";

import { decryptSecretSafe } from "@/lib/crypto/secrets";
import { sendServerEvent, type CapiEventName } from "@/lib/facebook/capi";
import { prisma } from "@/lib/prisma";
import { traffikEnvia } from "@/lib/pixel/donos";
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
  const idDoEvento = typeof body.eventId === "string" ? body.eventId : null;

  // ⚠️ `createMany({ skipDuplicates: true })` e não `create`: com o `eventId`
  // determinístico, duas cópias do script na mesma página (ou um reenvio)
  // mandam o MESMO id, e o índice único parcial recusa a segunda. O
  // `ON CONFLICT DO NOTHING` resolve isso no banco, sem `try/catch` engolindo
  // erro de verdade — mesmo padrão do upsert monotônico de vendas e da trava do
  // auto-sync: quem decide o vencedor é o banco.
  try {
    await prisma.pixelEvent.createMany({
      data: [
        {
          userId: config.userId,
          pixelConfigId: config.id,
          event: eventKey,
          eventId: idDoEvento,
          url: typeof body.url === "string" ? body.url.slice(0, 500) : null,
          fbclid: typeof body.fbclid === "string" ? body.fbclid : null,
        },
      ],
      skipDuplicates: true,
    });
  } catch (e) {
    console.error("[pixel/event] falha ao persistir evento:", e);
  }

  // 🔴 O evento JÁ FOI GRAVADO acima — o funil e o Dashboard contam do nosso
  // banco. O dono decide só quem fala com a Meta: com o pixel do gateway
  // mandando o mesmo evento, os dois chegariam com `event_id` diferentes e
  // ela contaria em dobro. Ver `lib/pixel/donos.ts`.
  if (!traffikEnvia(config.eventOwners, eventKey)) {
    return json({ ok: true, registrado: true, enviado: false, motivo: "outro dono" });
  }

  const targets =
    config.metaPixels.length > 0
      ? config.metaPixels
      : config.pixelId
        ? [{ pixelId: config.pixelId, accessToken: config.accessToken }]
        : [];

  // 🔴 É ESTE valor que a Meta usa para casar o evento do navegador com o
  // nosso. O script manda o mesmo id para o `fbq` e para cá — se as duas pontas
  // divergirem, a Meta conta o evento DUAS VEZES e otimiza com sinal inflado.
  // O fallback só existe para um `traffikPixel.track()` manual sem id.
  const eventId = idDoEvento ?? `${eventKey}-${Date.now()}`;
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
      clientIp: ipDaRequisicao(req),
      clientUserAgent: req.headers.get("user-agent"),
    });
    if (r.ok) sent++;
    else console.error(`[CAPI] evento ${eventKey} pixel ${mp.pixelId}: ${r.error}`);
  }

  return json({ ok: true, event: eventKey, sent });
}
