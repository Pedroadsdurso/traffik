import {
  isObj,
  mapPayment,
  pick,
  statusPeloTexto,
  toNumber,
  toNumeroOuNulo,
  toStr,
  type Json,
} from "../campos";
import type { ResultadoParse, VendaNormalizada } from "../contrato";

/**
 * Parser **genérico**, para a plataforma `CUSTOM` e para a ingestão por chave de
 * API — os dois casos em que quem envia é um sistema do próprio usuário, não um
 * gateway conhecido.
 *
 * Movido de `webhook/normalizeSale.ts` na etapa 1. A leitura é **idêntica** à de
 * antes, congelada por `npm run test:gateways` contra 77 payloads reais.
 *
 * ⚠️ Ele é tolerante de propósito: aceita os apelidos mais comuns de cada campo,
 * em português e em inglês. Isso é certo aqui e **errado** num parser de gateway
 * — quando se sabe qual é o gateway, sabe-se exatamente onde o campo está, e
 * adivinhar só esconde uma mudança de formato do outro lado.
 */
function parseUmaVenda(payload: Json): VendaNormalizada {
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
  let valor = toNumber(rawValue);
  // Alguns gateways mandam centavos como inteiro.
  const emCentavos = pick(payload, ["amount_cents", "value_cents", "price_cents"]);
  if (emCentavos !== undefined) valor = toNumber(emCentavos) / 100;

  const externalId = toStr(
    pick(payload, ["transaction_id", "transaction", "order_id", "orderId", "id", "sale_id", "checkout_id"]),
    191,
  );

  return {
    externalId,
    // Sem agrupador conhecido, cada venda é o próprio pedido — o comportamento
    // de sempre. Quem enviar order bump por esta porta manda duas requisições
    // independentes, e elas contam como duas conversões (corretamente: não há
    // como afirmar que são o mesmo checkout).
    pedidoId: externalId,
    itemTipo: "principal",
    itemPaiExternalId: null,

    valor,
    valorBruto: null,
    desconto: toNumeroOuNulo(pick(payload, ["discount", "desconto"])),
    moeda: (toStr(pick(payload, ["currency", "moeda", "currency_code"]), 8) ?? "BRL").toUpperCase(),

    produto:
      toStr(
        pick(payload, ["product", "produto", "product_name", "productName", "plan", "offer", "items.0.name"]),
        191,
      ) ?? "Produto",
    produtoId: toStr(pick(payload, ["product_id", "productId", "offer_id", "plan_id"]), 191),
    status: statusPeloTexto(pick(payload, ["status", "situacao", "payment_status", "order_status", "event"])),
    // Sem gateway conhecido não há como saber se o evento é de checkout. O
    // comportamento antigo — "PENDENTE gera InitiateCheckout" — é preservado
    // aqui, e só aqui, para a ingestão por chave de API não mudar.
    gerouCheckout: statusPeloTexto(pick(payload, ["status", "situacao", "payment_status", "order_status", "event"])) === "PENDENTE",
    formaDePagamento: mapPayment(
      pick(payload, ["payment_method", "forma_pagamento", "paymentMethod", "payment_type", "method"]),
    ),

    email: toStr(
      pick(payload, ["email_comprador", "buyer_email", "email", "customer.email", "customer_email", "cliente.email"]),
      191,
    ),
    nome: toStr(
      pick(payload, ["nome_comprador", "buyer_name", "name", "customer.name", "customer_name", "cliente.nome"]),
      191,
    ),
    telefone: toStr(pick(payload, ["phone", "telefone", "customer.phone", "customer_phone", "whatsapp"]), 64),
    documento: toStr(pick(payload, ["document", "documento", "cpf", "customer.document"]), 64),
    pais: toStr(pick(payload, ["country", "pais", "customer.country", "country_code"]), 8),
    ipDoComprador: toStr(pick(payload, ["ip", "buyer_ip", "customer.ip", "ip_address"]), 64),

    clickId: toStr(
      pick(payload, ["click_id", "clickId", "trk_click_id", "traffik_click_id", "utm.click_id"]),
      191,
    ),
    fbc: toStr(pick(payload, ["fbc", "_fbc", "cookies.fbc"]), 512),
    fbp: toStr(pick(payload, ["fbp", "_fbp", "cookies.fbp"]), 512),
    utm: {
      source: toStr(pick(payload, ["utm_source", "utm.utm_source"]), 191),
      medium: toStr(pick(payload, ["utm_medium", "utm.utm_medium"]), 191),
      campaign: toStr(pick(payload, ["utm_campaign", "utm.utm_campaign"]), 191),
      term: toStr(pick(payload, ["utm_term", "utm.utm_term"]), 191),
      content: toStr(pick(payload, ["utm_content", "utm.utm_content"]), 191),
      sck: toStr(pick(payload, ["sck", "src"]), 191),
    },

    taxaGateway: toNumeroOuNulo(pick(payload, ["fee", "fees", "taxa"])),
    comissoes: null,
  };
}

export function parseGenerico(payload: unknown): ResultadoParse {
  if (!isObj(payload)) return { vendas: [], ignorado: "Payload não é um objeto JSON." };
  return { vendas: [parseUmaVenda(payload)] };
}
