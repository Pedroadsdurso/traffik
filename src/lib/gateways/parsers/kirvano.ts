import type { SaleStatus } from "@/generated/prisma/enums";

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
import type { Comissao, ResultadoParse, VendaNormalizada } from "../contrato";

/**
 * Parser da **Kirvano**.
 *
 * Movido de `webhook/parseKirvano.ts` na etapa 1 da arquitetura universal. A
 * leitura dos campos que já existiam é **idêntica** — congelada por
 * `npm run test:gateways` contra 90 payloads reais de produção. O que entrou de
 * novo (`pedidoId`, `fbp`, `taxaGateway`, `comissoes`, `utm`) lê campos que os
 * payloads reais já traziam e que estavam sendo **descartados**.
 *
 * ## Mapa dos eventos oficiais
 *
 * A "Taxa de Aprovação" depende de registrarmos tanto a venda **gerada**
 * (PIX/boleto emitido, carrinho) quanto a **paga** — por isso os eventos de
 * geração viram `PENDENTE` e o de aprovação vira `APROVADA`. Como o upsert é por
 * `externalId`, a mesma venda transiciona gerada→paga numa única linha.
 */
const EVENTO_STATUS: Record<string, SaleStatus> = {
  SALE_APPROVED: "APROVADA",
  SALE_REFUNDED: "REEMBOLSADA",
  SALE_CHARGEBACK: "CHARGEBACK",
  SALE_REFUSED: "CANCELADA",
  // ⚠️ ABANDONADA, não PENDENTE: o carrinho abandonado nunca gerou pagamento, e
  // somá-lo a "vendas pendentes" misturava "desistiu" com "vai pagar".
  ABANDONED_CART: "ABANDONADA",
  PIX_GENERATED: "PENDENTE",
  // 🐛 PIX_EXPIRED NÃO ESTAVA AQUI. Ele caía no fallback, que só reconhecia
  // "APPROVED", e virava PENDENTE — apesar de o payload trazer `status:
  // "CANCELED"`. Eram 12 das 14 vendas pendentes da produção, R$ 317,65
  // exibidos como dinheiro a receber que não existia.
  PIX_EXPIRED: "EXPIRADA",
  BANK_SLIP_GENERATED: "PENDENTE",
  BANK_SLIP_EXPIRED: "EXPIRADA",
  SALE_PENDING: "PENDENTE",
  SUBSCRIPTION_CANCELED: "CANCELADA",
  SUBSCRIPTION_EXPIRED: "CANCELADA",
  SUBSCRIPTION_RENEWED: "APROVADA",
};

/**
 * Eventos que significam "o comprador chegou ao checkout", independente do
 * status resultante. Ver `VendaNormalizada.gerouCheckout`.
 */
const EVENTO_GEROU_CHECKOUT = new Set([
  "PIX_GENERATED",
  "PIX_EXPIRED",
  "BANK_SLIP_GENERATED",
  "BANK_SLIP_EXPIRED",
  "SALE_PENDING",
  "ABANDONED_CART",
]);

/** Descrição legível do evento, para o log e a aba Testes. */
export function rotuloDoEvento(event: string): string {
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

/** Nome do evento, tolerante a variações do campo. */
export function eventoKirvano(payload: Json): string {
  return String(pick(payload, ["event", "event_type", "type"]) ?? "").toUpperCase();
}

/** Primeiro produto do array `products`, se houver. */
function primeiroProduto(payload: Json): Json | null {
  const products = payload["products"];
  if (Array.isArray(products) && isObj(products[0])) return products[0];
  return null;
}

/**
 * Comissões, a partir do bloco `fiscal` — que os payloads reais trazem em 36 de
 * 46 eventos e que o parser antigo ignorava por completo.
 *
 * ⚠️ Devolve `null` quando o bloco não veio, e **não** uma lista vazia: lista
 * vazia afirmaria "não houve comissão", e a diferença decide se o cálculo de
 * lucro usa este número ou a taxa cadastrada pelo usuário (REGRA 1 do contrato).
 */
function comissoes(payload: Json): Comissao[] | null {
  const fiscal = isObj(payload["fiscal"]) ? (payload["fiscal"] as Json) : null;
  const afiliado = toNumeroOuNulo(fiscal ? fiscal["affiliate_commission"] : pick(payload, ["affiliateCommission"]));
  const coprod = toNumeroOuNulo(fiscal ? fiscal["coproduction_commission"] : pick(payload, ["coproductionCommission"]));
  if (afiliado === null && coprod === null) return null;

  const lista: Comissao[] = [];
  if (afiliado !== null) lista.push({ tipo: "affiliate", valor: afiliado, percentual: null, quem: null });
  if (coprod !== null) lista.push({ tipo: "coproducer", valor: coprod, percentual: null, quem: null });
  return lista;
}

function parseUmaVenda(payload: Json): VendaNormalizada {
  const evento = eventoKirvano(payload);
  const produto = primeiroProduto(payload);
  const utm = isObj(payload["utm"]) ? (payload["utm"] as Json) : {};
  const cookies = isObj(payload["cookies"]) ? (payload["cookies"] as Json) : {};

  // Status: prioriza o evento; se desconhecido, lê o campo `status` textual.
  //
  // 🐛 O fallback antigo comparava com a string literal "APPROVED" e devolvia
  // PENDENTE para todo o resto. Foi ele que transformou 12 PIX vencidos em
  // vendas pendentes: o payload dizia `status: "CANCELED"` e ninguém olhava.
  //
  // ⚠️ Esta é a correção ESTRUTURAL, mais importante que acrescentar
  // `PIX_EXPIRED` ao mapa: em vez de tentar adivinhar a lista completa de
  // eventos da Kirvano, um evento que a gente não conheça passa a ser lido pelo
  // campo de situação — que o gateway preenche de qualquer jeito. Assim o
  // próximo evento novo cai no lugar certo em vez de virar "pendente" por
  // omissão.
  const conhecido = EVENTO_STATUS[evento];
  const status: SaleStatus = conhecido ?? statusPeloTexto(pick(payload, ["status"]));

  const valorBruto = pick(payload, ["total_price", "total", "amount", "value"]);
  const valor = toNumber(valorBruto ?? (produto ? pick(produto, ["price"]) : undefined));

  const clickId = toStr(
    pick(utm, ["click_id", "clickId", "trk_click_id", "traffik_click_id"]) ??
      pick(payload, ["click_id", "clickId", "trk_click_id", "traffik_click_id"]),
    191,
  );

  const externalId = toStr(pick(payload, ["sale_id", "checkout_id", "id", "order_id"]), 191);

  return {
    externalId,
    // A Kirvano não separa order bump em linhas: os itens extras vêm dentro de
    // `products[]`, dentro da MESMA venda. Então cada venda já é o seu pedido —
    // que é exatamente o comportamento de hoje.
    pedidoId: externalId,
    itemTipo: "principal",
    itemPaiExternalId: null,

    valor,
    valorBruto: null,
    desconto: toNumeroOuNulo(pick(payload, ["couponDiscount", "automaticDiscount"])),
    moeda: (toStr(pick(payload, ["currency", "currency_code"]), 8) ?? "BRL").toUpperCase(),

    produto:
      toStr(produto ? pick(produto, ["name", "offer_name"]) : undefined, 191) ??
      toStr(pick(payload, ["product_name", "product"]), 191) ??
      "Produto",
    produtoId: toStr(produto ? pick(produto, ["id", "offer_id"]) : undefined, 191),
    status,
    gerouCheckout: EVENTO_GEROU_CHECKOUT.has(evento),
    formaDePagamento: mapPayment(pick(payload, ["payment_method", "method"])),

    email: toStr(pick(payload, ["customer.email", "email"]), 191),
    nome: toStr(pick(payload, ["customer.name", "name"]), 191),
    telefone: toStr(pick(payload, ["customer.phone_number", "customer.phone", "phone"]), 64),
    documento: toStr(pick(payload, ["customer.document"]), 64),
    pais: toStr(pick(payload, ["customer.country", "country"]), 8),
    ipDoComprador: toStr(pick(payload, ["customer.ip", "ip"]), 64),

    clickId,
    // A Kirvano não manda `fbc` (verificado nos 64 payloads reais), mas manda
    // `cookies.fbp` em 45 deles — que estava sendo descartado.
    fbc: toStr(pick(cookies, ["fbc", "_fbc"]), 512),
    fbp: toStr(pick(cookies, ["fbp", "_fbp"]), 512),
    utm: {
      source: toStr(pick(utm, ["utm_source"]), 191),
      medium: toStr(pick(utm, ["utm_medium"]), 191),
      campaign: toStr(pick(utm, ["utm_campaign"]), 191),
      term: toStr(pick(utm, ["utm_term"]), 191),
      content: toStr(pick(utm, ["utm_content"]), 191),
      sck: toStr(pick(utm, ["src", "sck"]), 191),
    },

    taxaGateway: toNumeroOuNulo(pick(payload, ["fee", "fiscal.fee"])),
    comissoes: comissoes(payload),
  };
}

export function parseKirvano(payload: unknown): ResultadoParse {
  if (!isObj(payload)) return { vendas: [], ignorado: "Payload não é um objeto JSON." };
  return { vendas: [parseUmaVenda(payload)] };
}
