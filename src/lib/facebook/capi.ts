import { createHash } from "node:crypto";

import { GRAPH_URL } from "@/lib/facebook/graph";

/** Normaliza + faz hash SHA-256 (exigido pela Conversions API para PII). */
function hash(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized).digest("hex");
}

export interface PurchaseEventInput {
  pixelId: string;
  accessToken: string;
  value: number;
  currency: string;
  eventId: string; // deduplicação com o pixel do navegador
  eventTime?: number; // epoch em segundos
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  fbclid?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  eventSourceUrl?: string | null;
  testEventCode?: string | null;
}

/**
 * Envia um evento Purchase para a Conversions API do Facebook (server-side).
 * Retorna { ok, error? } sem lançar, para não derrubar o fluxo do webhook.
 */
export async function sendPurchaseEvent(input: PurchaseEventInput): Promise<{ ok: boolean; error?: string }> {
  const userData: Record<string, unknown> = {};
  const em = hash(input.email);
  const ph = hash(input.phone?.replace(/\D/g, ""));
  const country = hash(input.country);
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (country) userData.country = [country];
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;
  // fbc é derivado do fbclid: fb.1.<timestamp>.<fbclid>
  if (input.fbclid) userData.fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${input.fbclid}`;

  const event: Record<string, unknown> = {
    event_name: "Purchase",
    event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: "website",
    user_data: userData,
    custom_data: { currency: input.currency, value: input.value },
  };
  if (input.eventSourceUrl) event.event_source_url = input.eventSourceUrl;

  const payload: Record<string, unknown> = { data: [event] };
  if (input.testEventCode) payload.test_event_code = input.testEventCode;

  try {
    const res = await fetch(`${GRAPH_URL}/${input.pixelId}/events?access_token=${encodeURIComponent(input.accessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const json = (await res.json()) as { error?: { message: string }; events_received?: number };
    if (!res.ok || json.error) return { ok: false, error: json.error?.message || `CAPI ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede na CAPI." };
  }
}
