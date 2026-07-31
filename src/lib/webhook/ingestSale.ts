import { after } from "next/server";
import { extrairIpDoCliente } from "@/lib/geo/clientIp";
import { normalizarPais, paisDoIp } from "@/lib/geo/pais";

import type { Prisma } from "@/generated/prisma/client";
import type { SaleStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { registrarCheckoutDoGateway } from "@/lib/webhook/checkoutEvent";
import { dispatchSaleNotification } from "@/lib/webhook/dispatchNotification";
import { dispatchPurchaseEvents } from "@/lib/webhook/dispatchPixel";
import { matchClick, type ClickMatch } from "@/lib/webhook/matchClick";
import type { VendaNormalizada } from "@/lib/gateways/contrato";
import { matchesSobrescreviveis, paisesSobrescreviveis } from "@/lib/gateways/fontes";

export interface IngestContext {
  userId: string;
  /** Webhook de origem (quando a venda chega por um gateway). */
  webhookId?: string | null;
  /**
   * Credencial de API que ingeriu a venda, quando não veio por webhook.
   *
   * 🐛 Esta coluna era **lida em 6 lugares e escrita em NENHUM**. Ela é o passo 4
   * da precedência de área ("credencial de API dona"), então toda venda ingerida
   * por chave de API caía na Principal em vez da área da credencial — e o ramo
   * inteiro da precedência nunca disparava. Ver o 5º caso do PROCEDIMENTO no
   * CLAUDE.md.
   */
  apiCredentialId?: string | null;
  /**
   * Gateway de origem (`KIRVANO`, `CAKTO`, `API`…), gravado em `Sale.platform`.
   *
   * 🔴 **Procedência não pode viver só na FK.** Antes disto, a única forma de
   * saber de qual gateway uma venda veio era `sale.webhook.platform` — e como a
   * FK é `SetNull`, excluir o webhook apagava a resposta para sempre. O
   * receptor conhece o gateway neste exato instante; guardar aqui é o que torna
   * o dado autossuficiente.
   */
  platform?: string | null;
}

export interface IngestResult {
  id: string;
  status: string;
  match: string;
}

/**
 * Pipeline única de ingestão de venda, compartilhada por todos os canais de
 * entrada: casa o clique, faz upsert idempotente da venda por `externalId` e
 * dispara Pixel/CAPI + notificação.
 *
 * ⚠️ Ela recebe **uma venda já normalizada** e não sabe de qual gateway veio —
 * é o que garante que o décimo gateway não a faça mudar. Quem traduz payload em
 * `VendaNormalizada` é o parser; quem orquestra é `lib/gateways/receber.ts`.
 *
 * ⚠️ O contador do webhook (`eventCount`/`lastEventAt`) saiu daqui para o
 * receptor: com order bump um payload vira N vendas, e incrementar por venda
 * faria "43 vendas recebidas" contar itens em vez de eventos recebidos.
 */
export async function ingestSale(
  ctx: IngestContext,
  data: VendaNormalizada,
  rawPayload: unknown,
  fallbackIp: string | null,
): Promise<IngestResult> {
  const match = await matchClick(ctx.userId, data.clickId, data.ipDoComprador ?? fallbackIp, data.fbc);
  const { pais: country, fonte: countrySource } = paisDaVenda(data, match);

  const saleData = {
    userId: ctx.userId,
    webhookId: ctx.webhookId ?? null,
    apiCredentialId: ctx.apiCredentialId ?? null,
    platform: ctx.platform ?? null,
    externalId: data.externalId,
    // Agrupador do checkout: order bump e upsell do mesmo carrinho compartilham.
    // Faturamento soma LINHAS; conversões contam PEDIDOS. Ver `lib/pedidos.ts`.
    pedidoId: data.pedidoId,
    itemTipo: data.itemTipo,
    value: data.valor,
    currency: data.moeda,
    product: data.produto,
    productId: data.produtoId,
    status: data.status,
    paymentMethod: data.formaDePagamento,
    buyerEmail: data.email,
    buyerName: data.nome,
    buyerPhone: data.telefone,
    country,
    countrySource,
    // Taxas que o GATEWAY informou. `null` quando ele não manda — e aí o
    // `financeiro.ts` cai na taxa cadastrada. Ver a REGRA 1 do contrato.
    // Cookies da Meta que o gateway mandou. Vão para a CAPI como sinal de
    // correspondência — o `fbp` nunca era enviado.
    fbc: data.fbc,
    fbp: data.fbp,
    taxaGateway: data.taxaGateway,
    coproducao: somaDeComissoes(data),
    matchMethod: match.method,
    clickId: match.clickId,
    approvedAt: data.status === "APROVADA" ? new Date() : null,
    rawPayload: rawPayload as object,
  };

  const sale =
    data.externalId != null
      ? await upsertMonotonico(ctx.userId, data.externalId, saleData, match, rawPayload, country)
      : await prisma.sale.create({ data: saleData, select: { id: true, status: true, matchMethod: true } });

  // Efeitos colaterais saem do caminho da resposta (`after` do Next 16): a CAPI
  // é uma chamada HTTP ao Facebook e estava sendo aguardada DENTRO do request,
  // segurando conexão do pool. Com 5 webhooks simultâneos a rajada levava ~2,5s
  // e aumentava a janela em que dois eventos disputavam a mesma linha.
  // O gateway recebe o 200 assim que a venda está gravada.
  after(async () => {
    try {
      // Venda gerada e ainda não paga = checkout iniciado, direto da fonte.
      // É a única via que funciona com checkout hospedado pelo gateway, onde
      // não há como instalar o nosso script na página.
      await registrarCheckoutDoGateway(sale.id, data.gerouCheckout);
      await dispatchPurchaseEvents(sale.id);
      await dispatchSaleNotification(sale.id);
    } catch (e) {
      console.error("[ingestSale] efeitos pós-resposta:", e);
    }
  });

  return { id: sale.id, status: sale.status, match: sale.matchMethod ?? "none" };
}

/**
 * Coprodução/afiliados que o gateway informou nesta venda.
 *
 * ⚠️ Devolve `null` quando o gateway não mandou comissão nenhuma — e `0` quando
 * ele mandou dizendo que não houve. A diferença decide se o cálculo de lucro usa
 * este número ou a taxa que o usuário cadastrou à mão.
 *
 * ⚠️ A comissão do PRODUTOR fica de fora: ela é o que sobra para o dono da
 * conta, não um custo. Somá-la zeraria o lucro de toda venda.
 */
function somaDeComissoes(data: VendaNormalizada): number | null {
  if (data.comissoes == null) return null;
  return data.comissoes
    .filter((c) => !/produtor|producer/i.test(c.tipo))
    .reduce((a, c) => a + c.valor, 0);
}

/**
 * País de uma venda — em ordem de confiabilidade.
 *
 * > ### 🔴 O IP DA CONEXÃO DO WEBHOOK NÃO É O COMPRADOR
 * > Quem abre a conexão aqui é o servidor do gateway (Kirvano, Hotmart…), não a
 * > pessoa que comprou. Passar esse IP — ou o `x-vercel-ip-country` da
 * > requisição — para a resolução carimbaria **toda venda** com o país do
 * > datacenter do gateway. O número continuaria plausível (um país real, com
 * > vendas de verdade), e o mapa inteiro apontaria para o lugar errado sem nada
 * > denunciar. Por isso `resolverPais()` **não** é chamada neste caminho.
 * >
 * > É o oposto de `/api/track/click`, onde quem faz a requisição é o visitante.
 *
 * | # | Fonte | Por quê |
 * |---|---|---|
 * | 1 | `country` do payload, se já for ISO-2 | o gateway conhece o comprador |
 * | 2 | IP **do payload** (`buyer_ip`, `customer.ip`) | é o IP do comprador, não o do gateway |
 * | 3 | País do clique casado | o visitante falou direto conosco naquele momento |
 * | 4 | `country` do payload cru | último recurso: não casa no mapa, mas aparece no ranking em vez de sumir |
 */
function paisDaVenda(data: VendaNormalizada, match: ClickMatch): { pais: string | null; fonte: string | null } {
  const doPayload = normalizarPais(data.pais);
  if (doPayload) return { pais: doPayload, fonte: "payload" };
  const doIp = paisDoIp(data.ipDoComprador);
  if (doIp) return { pais: doIp, fonte: "ip" };
  const doClique = normalizarPais(match.country);
  if (doClique) return { pais: doClique, fonte: "clique" };
  // ⚠️ Texto livre do gateway ("Brasil"): não casa no mapa, mas aparece no
  // ranking em vez de sumir. A fonte diz que é fraco.
  return { pais: data.pais, fonte: data.pais ? "payload_cru" : null };
}

/**
 * Ordem de "força" do status. O gateway **não garante a ordem de entrega**: a
 * confirmação de pagamento pode chegar antes (ou junto) do evento de venda
 * gerada, e ambos disputam a mesma linha.
 */
const FORCA: Record<SaleStatus, number> = {
  // Chegou ao checkout e não gerou pagamento. É o estado MENOS avançado: um
  // ABANDONED_CART reentregue não pode rebaixar um PIX que já foi gerado.
  ABANDONADA: 0,
  PENDENTE: 1,
  // ⚠️ EXPIRADA fica ACIMA de PENDENTE e ABAIXO de APROVADA, e as duas coisas
  // importam. Acima: a reentrega do PIX_GENERATED antigo não ressuscita um PIX
  // vencido como pendente. Abaixo: se o cliente gerar outro PIX e PAGAR, o
  // SALE_APPROVED sobrescreve e a venda entra no faturamento.
  //
  // O custo consciente: cliente que gera um PIX NOVO depois do vencimento fica
  // exibido como EXPIRADA até pagar. Erra para o lado de subnotificar pendente,
  // que é o oposto do bug que estamos consertando — e o faturamento, que é o
  // número que mais importa, sai certo nos dois casos.
  EXPIRADA: 2,
  APROVADA: 3,
  // Terminais: acontecem depois de uma aprovação e nunca devem ser revertidos.
  REEMBOLSADA: 4,
  CHARGEBACK: 4,
  CANCELADA: 4,
};

/** Status atuais que um status novo tem permissão de sobrescrever. */
function podeSobrescrever(novo: SaleStatus): SaleStatus[] {
  const alvo = FORCA[novo];
  return (Object.keys(FORCA) as SaleStatus[]).filter((s) => FORCA[s] <= alvo);
}

/**
 * Grava a venda de forma **idempotente e à prova de corrida**.
 *
 * O `upsert` do Prisma era last-write-wins: com "gerada" e "paga" do mesmo
 * `externalId` chegando em paralelo, a "gerada" que terminasse por último
 * rebaixava a venda de APROVADA para PENDENTE — a venda sumia do faturamento
 * mesmo tendo respondido 200 e gerado notificação. Era essa a perda de dados.
 *
 * Agora são duas instruções, cada uma atômica no banco e **independente da ordem
 * de chegada**:
 *  1. `createMany({ skipDuplicates: true })` garante que a linha exista, sem
 *     estourar violação de unicidade quando duas requisições criam ao mesmo tempo.
 *  2. `updateMany` com filtro de status: o `WHERE` só deixa passar quando o
 *     status novo é **igual ou mais forte** que o gravado. É o banco que decide,
 *     então dois writes concorrentes convergem para o mesmo resultado.
 */
async function upsertMonotonico(
  userId: string,
  externalId: string,
  saleData: Prisma.SaleCreateManyInput,
  match: { clickId: string | null; method: string },
  rawPayload: unknown,
  country: string | null,
) {
  const novoStatus = saleData.status as SaleStatus;
  const countrySource = saleData.countrySource ?? null;

  // 1) Garante a linha. `skipDuplicates` transforma a corrida de criação num
  //    no-op em vez de erro P2002.
  await prisma.sale.createMany({ data: [saleData], skipDuplicates: true });

  // 2) Campos DECLARADOS: atualiza só se o evento não for um "retrocesso" de status.
  await prisma.sale.updateMany({
    where: { userId, externalId, status: { in: podeSobrescrever(novoStatus) } },
    data: {
      status: novoStatus,
      // Eventos posteriores (ex.: reembolso) vêm com payload esparso; não
      // sobrescrevemos valor/pagamento já conhecidos com 0/OUTRO.
      ...(Number(saleData.value) > 0 ? { value: saleData.value } : {}),
      ...(saleData.paymentMethod !== "OUTRO" ? { paymentMethod: saleData.paymentMethod } : {}),
      ...(novoStatus === "APROVADA" ? { approvedAt: new Date() } : {}),
      rawPayload: rawPayload as object,
    },
  });

  // 3) Campos DERIVADOS: instrução SEPARADA, com o `WHERE` da precedência de
  //    fonte. A REGRA 2 do contrato — reprocessar nunca degrada dado resolvido.
  //
  //    ⚠️ Por que não cabe no update acima: lá o `WHERE` é sobre o STATUS, e
  //    aqui é sobre a PROCEDÊNCIA. São perguntas diferentes ("este evento é mais
  //    novo?" × "esta inferência é melhor?") e um evento pode responder sim a uma
  //    e não à outra — o reembolso que chega sem clique casado é exatamente isso.
  if (country) {
    await prisma.sale.updateMany({
      where: {
        userId,
        externalId,
        // Vazio, ou preenchido por uma fonte que a nova pode substituir.
        OR: [{ country: null }, { countrySource: { in: paisesSobrescreviveis(countrySource) } }],
      },
      data: { country, countrySource },
    });
  }

  if (match.clickId) {
    await prisma.sale.updateMany({
      where: {
        userId,
        externalId,
        OR: [{ clickId: null }, { matchMethod: { in: matchesSobrescreviveis(match.method) } }],
      },
      data: { clickId: match.clickId, matchMethod: match.method },
    });
  }

  const sale = await prisma.sale.findUniqueOrThrow({
    where: { userId_externalId: { userId, externalId } },
    select: { id: true, status: true, matchMethod: true },
  });
  return sale;
}

/**
 * Extrai o IP do cliente dos headers de proxy.
 *
 * ⚠️ Delega para `lib/geo/clientIp.ts`. Esta era a TERCEIRA cópia do mesmo
 * `x-forwarded-for.split(",")[0]` — que pega o valor que o CLIENTE controla e
 * quebra atrás de nginx. As três divergiam por acidente, não por decisão.
 */
export function clientIpFrom(headers: Headers): string | null {
  return extrairIpDoCliente({ header: (n) => headers.get(n) });
}
