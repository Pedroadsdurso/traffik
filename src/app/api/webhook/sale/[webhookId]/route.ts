import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { clientIpFrom, ingestSale } from "@/lib/webhook/ingestSale";
import { finishWebhookLog, startWebhookLog } from "@/lib/webhook/logWebhook";
import { normalizeSale } from "@/lib/webhook/normalizeSale";
import { parseKirvano } from "@/lib/webhook/parseKirvano";

/** Webhook por token na URL (formato antigo). O parser é escolhido pela `platform`. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await ctx.params;

  const webhook = await prisma.webhook.findUnique({
    where: { token: webhookId },
    select: { id: true, userId: true, active: true, platform: true },
  });

  // Lê o corpo antes das validações, para logá-lo mesmo quando recusado.
  const rawText = await req.text();
  let payload: Record<string, unknown> | null;
  try {
    payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    payload = null;
  }

  const logId = await startWebhookLog({
    gateway: webhook?.platform ?? "CUSTOM",
    payload: payload ?? rawText,
    userId: webhook?.userId ?? null,
    webhookId: webhook?.id ?? null,
  });

  const reject = async (message: string, httpStatus: number) => {
    await finishWebhookLog(logId, { status: "REJEITADO", message, httpStatus });
    return Response.json({ error: message }, { status: httpStatus });
  };

  if (!webhook) return reject("Webhook não encontrado.", 404);
  if (!webhook.active) return reject("Webhook inativo.", 403);
  if (payload === null) return reject("JSON inválido.", 400);

  try {
    const data = webhook.platform === "KIRVANO" ? parseKirvano(payload) : normalizeSale(payload);
    const result = await ingestSale(
      { userId: webhook.userId, webhookId: webhook.id },
      data,
      payload,
      clientIpFrom(req.headers),
    );
    await finishWebhookLog(logId, { status: "PROCESSADO", saleId: result.id, httpStatus: 200 });
    return Response.json({ ok: true, sale_id: result.id, status: result.status, match: result.match });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao processar o evento.";
    await finishWebhookLog(logId, { status: "ERRO", message, httpStatus: 500 });
    console.error("[webhook/sale]", e);
    return Response.json({ error: message }, { status: 500 });
  }
}
