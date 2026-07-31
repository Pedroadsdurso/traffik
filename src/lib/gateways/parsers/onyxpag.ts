import type { SaleStatus } from "@/generated/prisma/enums";

import {
  comoLista,
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
 * Parser da **OnyxPag**.
 *
 * Documentação: https://doc.onyxpag.com — seção "Webhooks e PostbackURL".
 *
 * ## O formato
 *
 * ```json
 * { "event": "transaction.paid", "timestamp": "…",
 *   "data": { "transaction_id", "external_id", "amount", "fee_amount",
 *             "net_amount", "currency", "payment_method", "status",
 *             "customer": {…}, "items": [{ title, quantity, unit_price }] } }
 * ```
 *
 * ## O que a diferencia dos outros três
 *
 * | | Kirvano | Cakto | **OnyxPag** |
 * |---|---|---|---|
 * | Segredo no webhook | header | corpo | 🔴 **nenhum** — a URL é a credencial |
 * | IP do comprador | manda | não | **não** |
 * | `fbc`/`fbp` | só `fbp` | os dois | 🔴 **nenhum** |
 * | UTMs de volta | sim | sim | 🔴 **não documentado** |
 * | Taxa calculada | `fee` | `fees` | ✅ `fee_amount` |
 * | Valor | `"R$ 197,00"` | número | `"25.90"` (**ponto** decimal) |
 *
 * > ### 🔴 Ela é o primeiro gateway SEM NENHUMA via de atribuição no payload
 * > Sem `click_id`, sem `fbc` e sem IP, não há o que casar com o clique — a
 * > venda entra sem campanha, sem criativo e sem país. O `tracking` que a API
 * > aceita na CRIAÇÃO da cobrança (`utm_*`, `sck`, `client_reference_id`) **não
 * > aparece no payload do webhook documentado**.
 * >
 * > Por isso a leitura abaixo procura esses campos **defensivamente**, em
 * > `data.tracking` e `data.metadata`: se a OnyxPag os devolver (a doc pode
 * > estar incompleta), a atribuição funciona sozinha. Quem decide é o testador
 * > da aba Testes com um payload real — âmbar sobrando ali significa que eles
 * > vêm e não estamos lendo.
 *
 * > ### ⚠️ UMA venda por transação — e por que NÃO dividimos por item
 * > `items[]` tem `unit_price` e `quantity`, então dividir seria possível. Não
 * > fazemos, por duas razões concretas:
 * >
 * > 1. **Não há id por item.** O `externalId` teria de ser sintetizado do
 * >    índice (`<transaction_id>:0`), e uma reentrega com os itens em ordem
 * >    diferente criaria linhas NOVAS ao lado das existentes, duplicando
 * >    faturamento — em silêncio.
 * > 2. **`amount` é o total autoritativo.** Se a soma dos itens não fechar com
 * >    ele (desconto, frete, arredondamento), o faturamento divergiria do que o
 * >    gateway diz ter cobrado.
 * >
 * > É a mesma escolha da Kirvano, com o mesmo custo aceito: **um order bump
 * > aparece no valor, mas não em "Vendas por produto"**.
 */

/** Os 5 eventos documentados. Status inequívoco pelo nome. */
const EVENTO_STATUS: Record<string, SaleStatus> = {
  // Transação criada = cobrança emitida aguardando pagamento (o PIX gerado).
  "transaction.created": "PENDENTE",
  "transaction.paid": "APROVADA",
  // Pagamento recusado. Não é o mesmo que expirado — ver abaixo.
  "transaction.failed": "CANCELADA",
  // ⚠️ EXPIRADA, não CANCELADA: `EXPIRADA` fica ABAIXO de APROVADA na escala de
  // força, então o `transaction.paid` de um PIX gerado de novo ainda consegue
  // sobrescrever. Com um status terminal, a venda paga sumiria do faturamento.
  "transaction.expired": "EXPIRADA",
  "transaction.refunded": "REEMBOLSADA",
};

/** Eventos que significam "o comprador chegou ao checkout". */
const GEROU_CHECKOUT = new Set(["transaction.created"]);

/** Rótulo legível, para o log e o testador. */
export function rotuloDoEventoOnyx(evento: string): string {
  return (
    {
      "transaction.created": "Cobrança criada",
      "transaction.paid": "Pagamento confirmado",
      "transaction.failed": "Pagamento recusado",
      "transaction.expired": "Cobrança expirada",
      "transaction.refunded": "Reembolso",
    } as Record<string, string>
  )[evento] ?? evento;
}

/**
 * Onde procurar rastreamento. A doc do webhook não mostra nenhum destes, mas a
 * doc de CRIAÇÃO aceita `tracking` e `metadata` — se eles voltarem, lemos.
 */
function rastreio(d: Json): Json {
  const t = isObj(d["tracking"]) ? d["tracking"] : {};
  const m = isObj(d["metadata"]) ? d["metadata"] : {};
  // Ordem: o objeto dedicado vence o genérico, e os dois vencem a raiz.
  return { ...d, ...m, ...t };
}

function parseTransacao(d: Json, evento: string, avisos: string[]): VendaNormalizada {
  const conhecido = EVENTO_STATUS[evento];
  let status: SaleStatus;
  if (conhecido) {
    status = conhecido;
  } else {
    // ⛔ NUNCA em silêncio: evento novo vira linha visível na aba Testes, não um
    // 200 que parece sucesso dos dois lados.
    status = statusPeloTexto(d["status"]);
    avisos.push(
      `Evento desconhecido "${evento}". O status foi lido do campo \`status\` ("${toStr(d["status"]) ?? "vazio"}") → ${status}.`,
    );
  }

  const trk = rastreio(d);
  const itens = comoLista(d["items"]);
  const externalId = toStr(pick(d, ["transaction_id", "id"]), 191);

  return {
    externalId,
    // Sem agrupador próprio: a transação É o pedido. Uma conversão, uma linha.
    pedidoId: externalId,
    itemTipo: "principal",
    itemPaiExternalId: null,

    // ⚠️ `amount` chega como STRING com PONTO decimal ("25.90") — o contrário
    // da Kirvano ("R$ 197,00"). `toNumber` lê os dois; a armadilha seria um
    // parser de vírgula caseiro, que leria "25.90" como 2590.
    valor: toNumber(d["amount"]),
    valorBruto: null,
    desconto: null,
    moeda: (toStr(d["currency"], 8) ?? "BRL").toUpperCase(),

    // Só o primeiro item nomeia a venda — ver a nota sobre não dividir.
    produto: toStr(pick(itens[0] ?? {}, ["title", "name"]), 191) ?? toStr(d["description"], 191) ?? "Produto",
    produtoId: toStr(pick(d, ["external_id", "product_id"]), 191),
    status,
    gerouCheckout: GEROU_CHECKOUT.has(evento),
    formaDePagamento: mapPayment(d["payment_method"]),

    email: toStr(pick(d, ["customer.email"]), 191),
    nome: toStr(pick(d, ["customer.name"]), 191),
    // "11999999999" — nacional, sem DDI. `lib/facebook/telefone.ts` resolve por
    // comprimento antes do hash da CAPI.
    telefone: toStr(pick(d, ["customer.phone"]), 64),
    documento: toStr(pick(d, ["customer.document"]), 64),
    // 🔴 Nem país nem IP. A geografia destas vendas depende do CLIQUE.
    pais: toStr(pick(d, ["customer.country", "address.country"]), 8),
    ipDoComprador: toStr(pick(d, ["customer.ip", "ip", "buyer_ip", "ip_address"]), 64),

    // Defensivo: a doc não promete nenhum destes de volta. Se vierem, valem.
    clickId: toStr(pick(trk, ["click_id", "clickId", "trk_click_id"]), 191),
    fbc: toStr(pick(trk, ["fbc", "_fbc"]), 512),
    fbp: toStr(pick(trk, ["fbp", "_fbp"]), 512),
    utm: {
      source: toStr(pick(trk, ["utm_source", "src"]), 191),
      medium: toStr(trk["utm_medium"], 191),
      campaign: toStr(trk["utm_campaign"], 191),
      term: toStr(trk["utm_term"], 191),
      content: toStr(trk["utm_content"], 191),
      sck: toStr(pick(trk, ["sck", "client_reference_id", "xcode"]), 191),
    },

    // ✅ Ela informa a taxa por transação. `toNumeroOuNulo`, nunca `toNumber`:
    // ausência tem de virar `null` ("não sabemos"), não `0` ("não cobrou").
    taxaGateway: toNumeroOuNulo(d["fee_amount"]),
    // Split existe na criação da cobrança, mas não é devolvido no webhook.
    comissoes: null,
  };
}

export function parseOnyxPag(payload: unknown): ResultadoParse {
  if (!isObj(payload)) return { vendas: [], ignorado: "Payload não é um objeto JSON." };

  const evento = toStr(pick(payload, ["event", "event_type", "type"]), 64) ?? "";
  // `data` é objeto na documentação. `comoLista` custa nada e cobre o dia em que
  // eles mandarem um array — foi exatamente esse o caso da Cakto.
  const transacoes = comoLista(payload["data"]);

  if (transacoes.length === 0) {
    return { vendas: [], ignorado: `Evento "${evento || "(sem nome)"}" sem \`data\`.` };
  }

  const avisos: string[] = [];
  const vendas = transacoes.map((d) => parseTransacao(d, evento, avisos));
  return { vendas, avisos: avisos.length ? [...new Set(avisos)] : undefined };
}
