import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { clientIpFrom, ingestSale } from "@/lib/webhook/ingestSale";
import { finishWebhookLog, startWebhookLog } from "@/lib/webhook/logWebhook";
import { parseKirvano } from "@/lib/webhook/parseKirvano";

/**
 * Receptor dos webhooks da Kirvano.
 *
 * URL entregue ao usuário: `/api/webhook/kirvano?id={token}`, onde `token` é
 * o identificador único do webhook. O usuário configura, dentro do painel da
 * Kirvano, um "token de segurança" (texto livre) — nós o guardamos em
 * `Webhook.secret` e validamos a cada evento (header `security-token` ou campo
 * no corpo). Eventos suportados: venda gerada, paga, reembolsada e chargeback.
 *
 * Todo payload recebido é gravado em `WebhookLog` ANTES de ser processado —
 * inclusive os rejeitados, que são justamente os que o usuário precisa depurar
 * na aba Testes (Bloco 13).
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("id");
  if (!token) return Response.json({ error: "Parâmetro id ausente." }, { status: 400 });

  const webhook = await prisma.webhook.findUnique({
    where: { token },
    select: { id: true, userId: true, active: true, secret: true, platform: true },
  });

  // Lê o corpo antes das validações, para conseguir logá-lo mesmo quando recusado.
  const rawText = await req.text();
  let payload: Record<string, unknown> | null;
  try {
    payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    payload = null;
  }

  const logId = await startWebhookLog({
    gateway: "KIRVANO",
    payload: payload ?? rawText,
    userId: webhook?.userId ?? null,
    webhookId: webhook?.id ?? null,
  });

  const reject = async (message: string, httpStatus: number) => {
    await finishWebhookLog(logId, { status: "REJEITADO", message, httpStatus });
    return Response.json({ error: message }, { status: httpStatus });
  };

  if (!webhook || webhook.platform !== "KIRVANO") return reject("Webhook não encontrado.", 404);
  if (!webhook.active) return reject("Webhook inativo.", 403);
  if (payload === null) return reject("JSON inválido.", 400);

  // Validação do token de segurança da Kirvano (quando o usuário definiu um).
  if (webhook.secret) {
    const sent =
      req.headers.get("security-token") ??
      req.headers.get("x-security-token") ??
      (typeof payload["token"] === "string" ? (payload["token"] as string) : null) ??
      (typeof payload["security_token"] === "string" ? (payload["security_token"] as string) : null);
    if (sent !== webhook.secret) return reject("Token de segurança inválido.", 401);
  }

  try {
    const data = parseKirvano(payload);
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
    console.error("[webhook/kirvano]", e);
    return Response.json({ error: message }, { status: 500 });
  }
}
