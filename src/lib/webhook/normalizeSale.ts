import type { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";

/** Payload de venda já normalizado, independente da plataforma de origem. */
export interface NormalizedSale {
  externalId: string | null;
  value: number;
  currency: string;
  product: string;
  productId: string | null;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  buyerEmail: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  country: string | null;
  clickId: string | null;
  ip: string | null;
}

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Lê a primeira chave presente, aceitando caminhos aninhados "a.b.c". */
function pick(obj: Json, keys: string[]): unknown {
  for (const key of keys) {
    if (key.includes(".")) {
      let cur: unknown = obj;
      for (const part of key.split(".")) {
        if (!isObj(cur)) {
          cur = undefined;
          break;
        }
        cur = cur[part];
      }
      if (cur !== undefined && cur !== null && cur !== "") return cur;
    } else if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return undefined;
}

function toStr(v: unknown, max = 512): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

/** Converte "1.234,56" | "1,234.56" | "R$ 197,00" | centavos em número. */
function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  let s = v.replace(/[^\d.,-]/g, "");
  if (s.includes(",") && s.includes(".")) {
    // O último separador é o decimal.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function mapStatus(raw: unknown): SaleStatus {
  const s = String(raw ?? "").toLowerCase();
  if (/reembol|refund|estorn/.test(s)) return "REEMBOLSADA";
  if (/chargeback|contest/.test(s)) return "CHARGEBACK";
  if (/cancel|recus|refus|declin|expir/.test(s)) return "CANCELADA";
  if (/aprov|approv|paid|pago|complet|authorized|active/.test(s)) return "APROVADA";
  return "PENDENTE";
}

function mapPayment(raw: unknown): PaymentMethod {
  const s = String(raw ?? "").toLowerCase();
  if (/pix/.test(s)) return "PIX";
  if (/cart|card|credit|debit/.test(s)) return "CARTAO";
  if (/boleto|bank_slip|slip/.test(s)) return "BOLETO";
  return "OUTRO";
}

/**
 * Normaliza um payload genérico de venda. Tolerante aos formatos mais comuns
 * de Kirvano, Hotmart, Kiwify e checkouts próprios — parsers dedicados por
 * plataforma ficam para as fases avançadas.
 */
export function normalizeSale(payload: Json): NormalizedSale {
  const rawValue = pick(payload, [
    "value",
    "valor",
    "amount",
    "price",
    "total",
    "purchase.price.value",
    "data.amount",
    "order.total",
  ]);
  let value = toNumber(rawValue);
  // Alguns gateways mandam centavos como inteiro.
  const inCents = pick(payload, ["amount_cents", "value_cents", "price_cents"]);
  if (inCents !== undefined) value = toNumber(inCents) / 100;

  return {
    externalId: toStr(
      pick(payload, ["transaction_id", "transaction", "order_id", "orderId", "id", "sale_id", "checkout_id"]),
      191,
    ),
    value,
    currency: (toStr(pick(payload, ["currency", "moeda", "currency_code"]), 8) ?? "BRL").toUpperCase(),
    product:
      toStr(pick(payload, ["product", "produto", "product_name", "productName", "plan", "offer", "items.0.name"]), 191) ??
      "Produto",
    productId: toStr(pick(payload, ["product_id", "productId", "offer_id", "plan_id"]), 191),
    status: mapStatus(pick(payload, ["status", "situacao", "payment_status", "order_status", "event"])),
    paymentMethod: mapPayment(pick(payload, ["payment_method", "forma_pagamento", "paymentMethod", "payment_type", "method"])),
    buyerEmail: toStr(pick(payload, ["email_comprador", "buyer_email", "email", "customer.email", "customer_email", "cliente.email"]), 191),
    buyerName: toStr(pick(payload, ["nome_comprador", "buyer_name", "name", "customer.name", "customer_name", "cliente.nome"]), 191),
    buyerPhone: toStr(pick(payload, ["phone", "telefone", "customer.phone", "customer_phone", "whatsapp"]), 64),
    country: toStr(pick(payload, ["country", "pais", "customer.country", "country_code"]), 8),
    clickId: toStr(pick(payload, ["click_id", "clickId", "trk_click_id", "traffik_click_id", "utm.click_id"]), 191),
    ip: toStr(pick(payload, ["ip", "buyer_ip", "customer.ip", "ip_address"]), 64),
  };
}
