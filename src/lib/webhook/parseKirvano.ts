import type { SaleStatus } from "@/generated/prisma/enums";
import {
  isObj,
  mapPayment,
  pick,
  toNumber,
  toStr,
  type Json,
  type NormalizedSale,
} from "./normalizeSale";

/**
 * Mapa dos eventos oficiais da Kirvano para o nosso `SaleStatus`.
 *
 * A "Taxa de Aprovação" (Bloco 5) depende de registrarmos tanto a venda
 * **gerada** (PIX/boleto emitido, carrinho) quanto a **paga** — por isso os
 * eventos de geração viram `PENDENTE` e o de aprovação vira `APROVADA`. Como
 * a rota faz upsert por `externalId`, a mesma venda transiciona gerada→paga
 * mantendo uma única linha.
 */
const KIRVANO_EVENT_STATUS: Record<string, SaleStatus> = {
  SALE_APPROVED: "APROVADA",
  SALE_REFUNDED: "REEMBOLSADA",
  SALE_CHARGEBACK: "CHARGEBACK",
  SALE_REFUSED: "CANCELADA",
  ABANDONED_CART: "PENDENTE",
  PIX_GENERATED: "PENDENTE",
  BANK_SLIP_GENERATED: "PENDENTE",
  SALE_PENDING: "PENDENTE",
  SUBSCRIPTION_CANCELED: "CANCELADA",
  SUBSCRIPTION_EXPIRED: "CANCELADA",
  SUBSCRIPTION_RENEWED: "APROVADA",
};

/** Descrição legível do evento, útil para logs/diagnóstico (Bloco 13). */
export function kirvanoEventLabel(event: string): string {
  return (
    {
      SALE_APPROVED: "Venda paga",
      SALE_REFUNDED: "Reembolso",
      SALE_CHARGEBACK: "Chargeback",
      SALE_REFUSED: "Venda recusada",
      ABANDONED_CART: "Carrinho abandonado",
      PIX_GENERATED: "Pix gerado",
      BANK_SLIP_GENERATED: "Boleto gerado",
      SALE_PENDING: "Venda gerada",
    } as Record<string, string>
  )[event] ?? event;
}

/**
 * Extrai o nome do evento da Kirvano (campo `event`), tolerante a variações.
 */
export function kirvanoEvent(payload: Json): string {
  return String(pick(payload, ["event", "event_type", "type"]) ?? "").toUpperCase();
}

/** Primeiro produto do array `products` da Kirvano, se houver. */
function firstProduct(payload: Json): Json | null {
  const products = payload["products"];
  if (Array.isArray(products) && isObj(products[0])) return products[0];
  return null;
}

/**
 * Parser dedicado do payload da Kirvano. Lê a estrutura específica
 * (`event`, `customer`, `products[]`, `utm`, `total_price`, `sale_id`) e cai
 * nos apelidos genéricos quando algum campo vier em outro formato.
 */
export function parseKirvano(payload: Json): NormalizedSale {
  const event = kirvanoEvent(payload);
  const product = firstProduct(payload);
  const utm = isObj(payload["utm"]) ? (payload["utm"] as Json) : {};

  // Status: prioriza o evento; se desconhecido, usa o campo `status` textual.
  const status: SaleStatus =
    KIRVANO_EVENT_STATUS[event] ??
    (String(pick(payload, ["status"]) ?? "").toUpperCase() === "APPROVED"
      ? "APROVADA"
      : "PENDENTE");

  const rawValue = pick(payload, ["total_price", "total", "amount", "value"]);
  const value = toNumber(rawValue ?? (product ? pick(product, ["price"]) : undefined));

  const clickId = toStr(
    pick(utm, ["click_id", "clickId", "trk_click_id", "traffik_click_id"]) ??
      pick(payload, ["click_id", "clickId", "trk_click_id", "traffik_click_id"]),
    191,
  );

  return {
    externalId: toStr(pick(payload, ["sale_id", "checkout_id", "id", "order_id"]), 191),
    value,
    currency: (toStr(pick(payload, ["currency", "currency_code"]), 8) ?? "BRL").toUpperCase(),
    product:
      toStr(product ? pick(product, ["name", "offer_name"]) : undefined, 191) ??
      toStr(pick(payload, ["product_name", "product"]), 191) ??
      "Produto",
    productId: toStr(product ? pick(product, ["id", "offer_id"]) : undefined, 191),
    status,
    paymentMethod: mapPayment(pick(payload, ["payment_method", "method"])),
    buyerEmail: toStr(pick(payload, ["customer.email", "email"]), 191),
    buyerName: toStr(pick(payload, ["customer.name", "name"]), 191),
    buyerPhone: toStr(pick(payload, ["customer.phone_number", "customer.phone", "phone"]), 64),
    country: toStr(pick(payload, ["customer.country", "country"]), 8),
    clickId,
    ip: toStr(pick(payload, ["customer.ip", "ip"]), 64),
  };
}
