import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { dispatchSaleNotification } from "@/lib/webhook/dispatchNotification";
import { dispatchPurchaseEvents } from "@/lib/webhook/dispatchPixel";
import { matchClick } from "@/lib/webhook/matchClick";
import { normalizeSale } from "@/lib/webhook/normalizeSale";

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await ctx.params;

  const webhook = await prisma.webhook.findUnique({
    where: { token: webhookId },
    select: { id: true, userId: true, active: true },
  });
  if (!webhook) return Response.json({ error: "Webhook não encontrado." }, { status: 404 });
  if (!webhook.active) return Response.json({ error: "Webhook inativo." }, { status: 403 });

  let payload: Record<string, unknown>;
  try {
    const text = await req.text();
    payload = text ? JSON.parse(text) : {};
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const data = normalizeSale(payload);
  const match = await matchClick(webhook.userId, data.clickId, data.ip ?? clientIp(req));

  const saleData = {
    userId: webhook.userId,
    webhookId: webhook.id,
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
    rawPayload: payload as object,
  };

  // Idempotência: quando a plataforma manda um id de transação, reprocessos
  // (ex.: pendente → aprovada) atualizam a mesma venda.
  const sale =
    data.externalId != null
      ? await prisma.sale.upsert({
          where: { userId_externalId: { userId: webhook.userId, externalId: data.externalId } },
          update: {
            status: saleData.status,
            value: saleData.value,
            paymentMethod: saleData.paymentMethod,
            approvedAt: saleData.approvedAt,
            // Só melhora o match; nunca sobrescreve um clique já vinculado por nada.
            ...(match.clickId ? { clickId: match.clickId, matchMethod: match.method } : {}),
            rawPayload: payload as object,
          },
          create: saleData,
          select: { id: true, status: true, matchMethod: true },
        })
      : await prisma.sale.create({ data: saleData, select: { id: true, status: true, matchMethod: true } });

  await prisma.webhook.update({
    where: { id: webhook.id },
    data: { eventCount: { increment: 1 }, lastEventAt: new Date() },
  });

  // Dispara o evento Purchase para a Conversions API (Fase 10).
  await dispatchPurchaseEvents(sale.id);
  // Cria a notificação de venda para o dashboard (Fase 12).
  await dispatchSaleNotification(sale.id);

  return Response.json({
    ok: true,
    sale_id: sale.id,
    status: sale.status,
    match: sale.matchMethod,
  });
}
