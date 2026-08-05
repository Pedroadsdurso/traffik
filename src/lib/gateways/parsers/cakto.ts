import type { SaleStatus } from "@/generated/prisma/enums";

import {
  comoLista,
  isObj,
  chegouAoCheckout,
  mapPayment,
  pick,
  statusPeloTexto,
  toNumber,
  toNumeroOuNulo,
  toStr,
  type Json,
} from "../campos";
import type { Comissao, ResultadoParse, TipoDeItem, VendaNormalizada } from "../contrato";

/**
 * Parser da **Cakto**.
 *
 * ## O que a torna diferente da Kirvano
 *
 * | | Kirvano | Cakto |
 * |---|---|---|
 * | Order bump | dentro de `products[]`, uma venda só | **entradas separadas**, com id próprio |
 * | `data` | objeto | **objeto OU array** (individual × agrupado) |
 * | IP do comprador | manda | 🔴 **não manda** |
 * | `fbc`/`fbp` | só `fbp` | **os dois** |
 * | Nomes de evento | inglês | **mistura português e inglês** (`pix_gerado` × `purchase_approved`) |
 *
 * A mistura de idiomas nos eventos é justamente por que o mapa é POR
 * PLATAFORMA: não existe regra geral que traduza `pix_gerado` e
 * `purchase_approved` ao mesmo tempo.
 */

/** Os 14 eventos oficiais, para os quais o status é inequívoco. */
const EVENTO_STATUS: Record<string, SaleStatus> = {
  purchase_approved: "APROVADA",
  purchase_refused: "CANCELADA",
  refund: "REEMBOLSADA",
  chargeback: "CHARGEBACK",

  // Pagamento gerado, aguardando. Os quatro meios que a Cakto emite.
  pix_gerado: "PENDENTE",
  boleto_gerado: "PENDENTE",
  picpay_gerado: "PENDENTE",
  openfinance_nubank_gerado: "PENDENTE",

  // ⚠️ Chegou ao checkout e NÃO gerou pagamento — não é venda pendente.
  // `initiate_checkout` e `checkout_abandonment` caem no mesmo estado porque a
  // diferença entre eles ("começou" × "desistiu") não muda o que a venda é:
  // um carrinho sem pagamento. O que os dois FAZEM é alimentar o funil, e isso
  // vem de `gerouCheckout`, não do status.
  initiate_checkout: "ABANDONADA",
  checkout_abandonment: "ABANDONADA",

  subscription_canceled: "CANCELADA",
  subscription_renewed: "APROVADA",
  subscription_renewal_refused: "CANCELADA",
};

/**
 * Eventos CONHECIDOS cujo status depende do campo `status`, não do nome.
 *
 * ⚠️ `subscription_created` é o caso: criar a assinatura pode ou não implicar
 * cobrança aprovada, e a documentação não diz. Mapeá-lo para APROVADA inventaria
 * faturamento; mapeá-lo para PENDENTE esconderia uma venda paga. Deixar o campo
 * `status` decidir é a única leitura honesta — e listá-lo AQUI é o que impede o
 * aviso de "evento desconhecido", que seria ruído para um evento documentado.
 */
const EVENTOS_PELO_TEXTO = new Set(["subscription_created"]);

/** Eventos que significam "o comprador chegou ao checkout". */
const GEROU_CHECKOUT = new Set([
  "initiate_checkout",
  "checkout_abandonment",
  "pix_gerado",
  "boleto_gerado",
  "picpay_gerado",
  "openfinance_nubank_gerado",
]);

/** Rótulo legível, para o log e o testador. */
export function rotuloDoEventoCakto(evento: string): string {
  return (
    {
      purchase_approved: "Compra aprovada",
      purchase_refused: "Compra recusada",
      refund: "Reembolso",
      chargeback: "Chargeback",
      pix_gerado: "Pix gerado",
      boleto_gerado: "Boleto gerado",
      picpay_gerado: "PicPay gerado",
      openfinance_nubank_gerado: "Open Finance (Nubank) gerado",
      initiate_checkout: "Checkout iniciado",
      checkout_abandonment: "Carrinho abandonado",
      subscription_created: "Assinatura criada",
      subscription_canceled: "Assinatura cancelada",
      subscription_renewed: "Assinatura renovada",
      subscription_renewal_refused: "Renovação recusada",
    } as Record<string, string>
  )[evento] ?? evento;
}

/**
 * Campos de data que denunciam o estado final, independente do nome do evento.
 *
 * É a terceira camada de defesa: se a Cakto criar um evento que não conhecemos,
 * um `chargedbackAt` preenchido ainda coloca a venda no lugar certo.
 */
const STATUS_POR_DATA: [string, SaleStatus][] = [
  ["chargedbackAt", "CHARGEBACK"],
  ["refundedAt", "REEMBOLSADA"],
  ["canceledAt", "CANCELADA"],
];

const TIPO_DE_ITEM: Record<string, TipoDeItem> = {
  main: "principal",
  orderbump: "orderbump",
  upsell: "upsell",
};

/**
 * Comissões — **conservador de propósito**.
 *
 * A documentação da Cakto só mostra entradas `type: "producer"`, que é o que
 * SOBRA para o dono da conta, não um custo. Não sabemos como um afiliado ou
 * coprodutor aparece ali.
 *
 * ⛔ Por isso: enquanto só houver `producer`, devolvemos **`null`** ("não
 * sabemos"), não `0` ("não houve"). Gravar `0` afirmaria que não há coprodução e
 * o Faturamento Líquido apareceria MAIOR que a realidade — plausível e falso,
 * que é o pior modo de falha. Ver a REGRA 1 do contrato.
 *
 * Quando aparecer um tipo diferente, ele entra na lista **e** vira aviso no
 * testador — é assim que a estrutura real vai ser descoberta.
 */
function comissoes(item: Json, avisos: string[]): Comissao[] | null {
  const bruto = item["commissions"];
  if (!Array.isArray(bruto)) return null;

  const lista: Comissao[] = [];
  for (const c of bruto) {
    if (!isObj(c)) continue;
    const tipo = toStr(c["type"], 64) ?? "";
    if (/producer|produtor/i.test(tipo)) continue; // é o resultado, não custo
    lista.push({
      tipo,
      valor: toNumber(c["totalAmount"] ?? c["amount"]),
      percentual: toNumeroOuNulo(c["percentage"]),
      quem: toStr(c["user"], 191),
    });
    if (!/affiliate|afiliad|coproduc|coprodut/i.test(tipo)) {
      avisos.push(
        `Comissão de tipo desconhecido: "${tipo}". Ela está sendo contada como custo — confira se é isso mesmo.`,
      );
    }
  }
  // Só produtor = não sabemos se houve coprodução. `null`, nunca `0`.
  return lista.length ? lista : null;
}

function parseItem(item: Json, evento: string, avisos: string[]): VendaNormalizada {
  const conhecido = EVENTO_STATUS[evento];
  const pelaData = STATUS_POR_DATA.find(([campo]) => toStr(item[campo]))?.[1];

  let status: SaleStatus;
  if (pelaData && (!conhecido || conhecido === "APROVADA")) {
    // ⚠️ A data vence quando o evento não é conhecido, e também quando ele diz
    // APROVADA mas há reembolso/chargeback marcado: um payload de reentrega
    // pode trazer o evento original já com a data do estorno preenchida.
    status = pelaData;
  } else if (conhecido) {
    status = conhecido;
  } else {
    status = statusPeloTexto(item["status"]);
    if (!EVENTOS_PELO_TEXTO.has(evento)) {
      // ⛔ NUNCA em silêncio. Evento novo tem de virar uma linha visível na aba
      // Testes, não um 200 que parece sucesso dos dois lados.
      avisos.push(
        `Evento desconhecido "${evento}". O status foi lido do campo \`status\` ("${toStr(item["status"]) ?? "vazio"}") → ${status}.`,
      );
    }
  }

  const externalId = toStr(pick(item, ["id", "refId"]), 191);
  // O `checkout` agrupa os itens de UMA compra, e vem nos DOIS modos de disparo
  // (individual e agrupado). É o que faz o order bump contar como 1 conversão.
  const checkout = toStr(item["checkout"], 128);

  return {
    externalId,
    pedidoId: checkout ? `cakto:${checkout}` : externalId,
    itemTipo: TIPO_DE_ITEM[toStr(item["offer_type"], 32) ?? ""] ?? "principal",
    // ⚠️ `parent_order` traz o `refId` do item principal, não o `id` — são
    // identificadores diferentes na Cakto. Guardamos como o gateway mandou;
    // quem agrupa de verdade é o `pedidoId`.
    itemPaiExternalId: toStr(item["parent_order"], 191),

    valor: toNumber(item["amount"]),
    valorBruto: toNumeroOuNulo(item["baseAmount"]),
    desconto: toNumeroOuNulo(item["discount"]),
    moeda: (toStr(pick(item, ["currency"]), 8) ?? "BRL").toUpperCase(),

    produto: toStr(pick(item, ["product.name", "offer.name"]), 191) ?? "Produto",
    produtoId: toStr(pick(item, ["product.id", "product.short_id", "offer.id"]), 191),
    status,
    gerouCheckout: chegouAoCheckout(evento, conhecido != null, GEROU_CHECKOUT, status),
    formaDePagamento: mapPayment(pick(item, ["paymentMethod", "paymentMethodName"])),

    email: toStr(pick(item, ["customer.email"]), 191),
    nome: toStr(pick(item, ["customer.name"]), 191),
    telefone: toStr(pick(item, ["customer.phone"]), 64),
    documento: toStr(pick(item, ["customer.docNumber"]), 64),
    // 🔴 A Cakto NÃO envia país nem IP do comprador. A venda vai depender do
    // país do CLIQUE — ver a capacidade `ipDoComprador: false` no registro e o
    // aviso que a tela mostra por causa dela.
    pais: toStr(pick(item, ["address.country", "customer.country"]), 8),
    ipDoComprador: null,

    clickId: toStr(pick(item, ["click_id", "clickId", "trk_click_id"]), 191),
    // ✅ A melhor via de atribuição da Cakto: sem IP, o `fbc` é o que liga a
    // venda ao clique no anúncio.
    fbc: toStr(item["fbc"], 512),
    fbp: toStr(item["fbp"], 512),
    utm: {
      source: toStr(item["utm_source"], 191),
      medium: toStr(item["utm_medium"], 191),
      campaign: toStr(item["utm_campaign"], 191),
      term: toStr(item["utm_term"], 191),
      content: toStr(item["utm_content"], 191),
      sck: toStr(item["sck"], 191),
    },

    taxaGateway: toNumeroOuNulo(item["fees"]),
    comissoes: comissoes(item, avisos),
  };
}

export function parseCakto(payload: unknown): ResultadoParse {
  if (!isObj(payload)) return { vendas: [], ignorado: "Payload não é um objeto JSON." };

  const evento = toStr(pick(payload, ["event", "event_type"]), 64) ?? "";
  // ⚠️ `data` é OBJETO no disparo individual e ARRAY no agrupado. Assumir objeto
  // faria o modo agrupado processar só o primeiro item — ou nenhum — em
  // silêncio, com o gateway recebendo 200.
  const itens = comoLista(payload["data"]);

  if (itens.length === 0) {
    return {
      vendas: [],
      ignorado: `Evento "${evento || "(sem nome)"}" sem itens em \`data\`.`,
    };
  }

  const avisos: string[] = [];
  const vendas = itens.map((item) => parseItem(item, evento, avisos));
  return { vendas, avisos: avisos.length ? [...new Set(avisos)] : undefined };
}
