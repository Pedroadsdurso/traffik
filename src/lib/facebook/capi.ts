import { createHash } from "node:crypto";
import { podeIrParaCapi } from "@/lib/geo/anonimizarIp";

import { GRAPH_URL } from "@/lib/facebook/graph";
import { normalizarTelefoneE164 } from "@/lib/facebook/telefone";

/** Normaliza + faz hash SHA-256 (exigido pela Conversions API para PII). */
function hash(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized).digest("hex");
}

/** Nomes de evento aceitos pela Conversions API que a Trackhub dispara. */
export type CapiEventName = "Purchase" | "Lead" | "AddToCart" | "InitiateCheckout" | "PageView";

export interface ServerEventInput {
  eventName: CapiEventName;
  pixelId: string;
  accessToken: string;
  value?: number;
  currency?: string;
  eventId: string; // deduplicação com o pixel do navegador
  eventTime?: number; // epoch em segundos
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  fbclid?: string | null;
  /**
   * O `_fbc` REAL, quando o gateway o enviou. Vence a reconstrução.
   */
  fbc?: string | null;
  /** O `_fbp` do navegador do comprador, quando o gateway o enviou. */
  fbp?: string | null;
  /**
   * Instante do CLIQUE no anúncio, em epoch de segundos. Usado só para
   * reconstruir o `_fbc` quando não temos o real — ver `sendServerEvent`.
   */
  fbclidEm?: number | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  eventSourceUrl?: string | null;
  testEventCode?: string | null;
}

export type PurchaseEventInput = Omit<ServerEventInput, "eventName" | "value" | "currency"> & {
  value: number;
  currency: string;
};

/** Wrapper de compatibilidade: dispara um Purchase. */
export function sendPurchaseEvent(input: PurchaseEventInput): Promise<{ ok: boolean; error?: string }> {
  return sendServerEvent({ ...input, eventName: "Purchase" });
}

/**
 * Envia um evento server-side para a Conversions API do Facebook.
 * Retorna { ok, error? } sem lançar, para não derrubar o fluxo chamador.
 */
export async function sendServerEvent(input: ServerEventInput): Promise<{ ok: boolean; error?: string }> {
  const userData: Record<string, unknown> = {};
  const em = hash(input.email);
  // ⚠️ E.164 ANTES do hash. `replace(/\D/g,"")` só tirava a pontuação e deixava
  // o número sem DDI — o hash resultante não casava com o da Meta, e o telefone
  // virava um sinal de correspondência perdido em toda venda.
  const ph = hash(normalizarTelefoneE164(input.phone, input.country));
  const country = hash(input.country);
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (country) userData.country = [country];
  // ⚠️ `client_ip_address` e `client_user_agent` são os DOIS únicos campos que
  // a Meta exige em CLARO — ela recusa os dois hasheados. Depois da purga
  // progressiva (`lib/geo/anonimizarIp.ts`) o `Click.ip` pode estar anonimizado,
  // e enviar um hash aqui não faria a chamada falhar: degradaria em silêncio a
  // correspondência de todo `Purchase`. A guarda pede que o valor PAREÇA um IP.
  //
  // ⚠️ Omitir é melhor que enviar um IP velho. Passados 7 dias ele
  // provavelmente já é de outro assinante — seria sinal ERRADO, não fraco.
  if (podeIrParaCapi(input.clientIp)) userData.client_ip_address = input.clientIp.trim();
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;
  // ── _fbc e _fbp ───────────────────────────────────────────────────────────
  //
  // ⚠️ O `_fbc` REAL vence sempre. O terceiro segmento dele
  // (`fb.<sub>.<criado_em>.<fbclid>`) é QUANDO O COOKIE FOI CRIADO, ou seja
  // quando a pessoa clicou no anúncio. Aqui havia `Date.now()`, que é o instante
  // em que a VENDA foi processada — dias depois, num Pix pago com atraso. A
  // string que mandávamos não batia com a do navegador do comprador, o que
  // enfraquece a correspondência e a deduplicação navegador↔servidor.
  //
  // Sem o cookie real, reconstruímos — mas com o instante do CLIQUE, que é o
  // que o campo significa.
  if (input.fbc) {
    userData.fbc = input.fbc;
  } else if (input.fbclid) {
    const criadoEm = input.fbclidEm ?? Math.floor(Date.now() / 1000);
    userData.fbc = `fb.1.${criadoEm}.${input.fbclid}`;
  }
  // ⚠️ O `_fbp` NUNCA era enviado — o campo simplesmente não existia aqui,
  // enquanto a Kirvano o manda em 45 de 46 eventos. Sinal de correspondência
  // descartado em toda venda, mesma categoria do telefone sem DDI.
  if (input.fbp) userData.fbp = input.fbp;

  const customData: Record<string, unknown> = {};
  if (input.currency) customData.currency = input.currency;
  if (input.value != null) customData.value = input.value;

  const event: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: "website",
    user_data: userData,
    custom_data: customData,
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
