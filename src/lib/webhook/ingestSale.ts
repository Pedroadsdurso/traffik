import { after } from "next/server";
import { extrairIpDoCliente } from "@/lib/geo/clientIp";

import type { Prisma } from "@/generated/prisma/client";
import type { SaleStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { registrarCheckoutDoGateway } from "@/lib/webhook/checkoutEvent";
import { dispatchSaleNotification } from "@/lib/webhook/dispatchNotification";
import { dispatchPurchaseEvents } from "@/lib/webhook/dispatchPixel";
import { matchClick } from "@/lib/webhook/matchClick";
import type { NormalizedSale } from "@/lib/webhook/normalizeSale";

export interface IngestContext {
  userId: string;
  /** Webhook de origem (quando a venda chega por um gateway). */
  webhookId?: string | null;
}

export interface IngestResult {
  id: string;
  status: string;
  match: string;
}

/**
 * Pipeline única de ingestão de venda, compartilhada por todos os canais de
 * entrada (webhook Kirvano, webhook genérico por token, API por chave):
 * casa o clique, faz upsert idempotente da venda por `externalId`, atualiza
 * os contadores do webhook e dispara Pixel/CAPI + notificação.
 */
export async function ingestSale(
  ctx: IngestContext,
  data: NormalizedSale,
  rawPayload: unknown,
  fallbackIp: string | null,
): Promise<IngestResult> {
  const match = await matchClick(ctx.userId, data.clickId, data.ip ?? fallbackIp);

  const saleData = {
    userId: ctx.userId,
    webhookId: ctx.webhookId ?? null,
    externalId: data.externalId,
    value: data.value,
    currency: data.currency,
    product: data.product,
    productId: data.productId,
    status: data.status,
    paymentMethod: data.paymentMethod,
    buyerEmail: data.buyerEmail,
    buyerName: data.buyerName,
    buyerPhone: data.buyerPhone,
    country: data.country,
    matchMethod: match.method,
    clickId: match.clickId,
    approvedAt: data.status === "APROVADA" ? new Date() : null,
    rawPayload: rawPayload as object,
  };

  const sale =
    data.externalId != null
      ? await upsertMonotonico(ctx.userId, data.externalId, saleData, match, rawPayload)
      : await prisma.sale.create({ data: saleData, select: { id: true, status: true, matchMethod: true } });

  if (ctx.webhookId) {
    await prisma.webhook.update({
      where: { id: ctx.webhookId },
      data: { eventCount: { increment: 1 }, lastEventAt: new Date() },
    });
  }

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
      await registrarCheckoutDoGateway(sale.id);
      await dispatchPurchaseEvents(sale.id);
      await dispatchSaleNotification(sale.id);
    } catch (e) {
      console.error("[ingestSale] efeitos pós-resposta:", e);
    }
  });

  return { id: sale.id, status: sale.status, match: sale.matchMethod ?? "none" };
}

/**
 * Ordem de "força" do status. O gateway **não garante a ordem de entrega**: a
 * confirmação de pagamento pode chegar antes (ou junto) do evento de venda
 * gerada, e ambos disputam a mesma linha.
 */
const FORCA: Record<SaleStatus, number> = {
  PENDENTE: 0,
  APROVADA: 1,
  // Terminais: acontecem depois de uma aprovação e nunca devem ser revertidos.
  REEMBOLSADA: 2,
  CHARGEBACK: 2,
  CANCELADA: 2,
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
) {
  const novoStatus = saleData.status as SaleStatus;

  // 1) Garante a linha. `skipDuplicates` transforma a corrida de criação num
  //    no-op em vez de erro P2002.
  await prisma.sale.createMany({ data: [saleData], skipDuplicates: true });

  // 2) Atualiza só se o evento não for um "retrocesso" de status.
  await prisma.sale.updateMany({
    where: { userId, externalId, status: { in: podeSobrescrever(novoStatus) } },
    data: {
      status: novoStatus,
      // Eventos posteriores (ex.: reembolso) vêm com payload esparso; não
      // sobrescrevemos valor/pagamento já conhecidos com 0/OUTRO.
      ...(Number(saleData.value) > 0 ? { value: saleData.value } : {}),
      ...(saleData.paymentMethod !== "OUTRO" ? { paymentMethod: saleData.paymentMethod } : {}),
      ...(novoStatus === "APROVADA" ? { approvedAt: new Date() } : {}),
      // Só melhora o match; nunca desvincula um clique já casado.
      ...(match.clickId ? { clickId: match.clickId, matchMethod: match.method } : {}),
      rawPayload: rawPayload as object,
    },
  });

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
