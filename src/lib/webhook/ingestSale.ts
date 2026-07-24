import { prisma } from "@/lib/prisma";
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

  // Idempotência: quando a plataforma manda um id de transação, reprocessos
  // (ex.: gerada → paga) atualizam a mesma venda.
  const sale =
    data.externalId != null
      ? await prisma.sale.upsert({
          where: { userId_externalId: { userId: ctx.userId, externalId: data.externalId } },
          update: {
            // O status sempre reflete o último evento (gerada→paga→reembolso…).
            status: saleData.status,
            // Eventos posteriores (ex.: reembolso) podem vir com payload esparso;
            // não sobrescrevemos o valor/pagamento já conhecidos com 0/OUTRO.
            ...(saleData.value > 0 ? { value: saleData.value } : {}),
            ...(saleData.paymentMethod !== "OUTRO" ? { paymentMethod: saleData.paymentMethod } : {}),
            // Preserva o carimbo de aprovação: só grava quando aprova, nunca zera.
            ...(saleData.status === "APROVADA" ? { approvedAt: new Date() } : {}),
            // Só melhora o match; nunca sobrescreve um clique já vinculado por nada.
            ...(match.clickId ? { clickId: match.clickId, matchMethod: match.method } : {}),
            rawPayload: rawPayload as object,
          },
          create: saleData,
          select: { id: true, status: true, matchMethod: true },
        })
      : await prisma.sale.create({ data: saleData, select: { id: true, status: true, matchMethod: true } });

  if (ctx.webhookId) {
    await prisma.webhook.update({
      where: { id: ctx.webhookId },
      data: { eventCount: { increment: 1 }, lastEventAt: new Date() },
    });
  }

  // Dispara o evento Purchase para a Conversions API (Fase 10).
  await dispatchPurchaseEvents(sale.id);
  // Cria a notificação de venda para o dashboard (Fase 12).
  await dispatchSaleNotification(sale.id);

  return { id: sale.id, status: sale.status, match: sale.matchMethod ?? "none" };
}

/** Extrai o IP do cliente dos headers de proxy. */
export function clientIpFrom(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip");
}
