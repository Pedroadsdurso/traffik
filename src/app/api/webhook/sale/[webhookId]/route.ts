import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { clientIpFrom, ingestSale } from "@/lib/webhook/ingestSale";
import { normalizeSale } from "@/lib/webhook/normalizeSale";
import { parseKirvano } from "@/lib/webhook/parseKirvano";

export async function POST(req: NextRequest, ctx: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await ctx.params;

  const webhook = await prisma.webhook.findUnique({
    where: { token: webhookId },
    select: { id: true, userId: true, active: true, platform: true },
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

  const data = webhook.platform === "KIRVANO" ? parseKirvano(payload) : normalizeSale(payload);
  const result = await ingestSale(
    { userId: webhook.userId, webhookId: webhook.id },
    data,
    payload,
    clientIpFrom(req.headers),
  );

  return Response.json({ ok: true, sale_id: result.id, status: result.status, match: result.match });
}
