import type { NextRequest } from "next/server";

import { secretLookupHash } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/prisma";
import { clientIpFrom, ingestSale } from "@/lib/webhook/ingestSale";
import { finishWebhookLog, startWebhookLog } from "@/lib/webhook/logWebhook";
import { normalizeSale } from "@/lib/webhook/normalizeSale";

/**
 * Endpoint genérico de ingestão de vendas, autenticado por uma chave de API
 * própria da Traffik (bloco direito da aba Webhooks). Qualquer sistema pode
 * enviar eventos de venda com `Authorization: Bearer {api_key}`.
 *
 * Cada payload recebido vai para `WebhookLog` antes do processamento (Bloco 13).
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : (req.headers.get("x-api-key")?.trim() ?? "");
  if (!key) return Response.json({ error: "Chave de API ausente." }, { status: 401 });

  // A chave é guardada encriptada (IV aleatório), então a busca é pelo hash
  // determinístico da chave em texto puro — nunca pela coluna `key`.
  const cred = await prisma.apiCredential.findUnique({
    where: { keyHash: secretLookupHash(key) },
    select: { id: true, userId: true, revoked: true },
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
    gateway: "API",
    payload: payload ?? rawText,
    userId: cred?.userId ?? null,
  });

  const reject = async (message: string, httpStatus: number) => {
    await finishWebhookLog(logId, { status: "REJEITADO", message, httpStatus });
    return Response.json({ error: message }, { status: httpStatus });
  };

  if (!cred || cred.revoked) return reject("Chave de API inválida ou revogada.", 401);
  if (payload === null) return reject("JSON inválido.", 400);

  try {
    const data = normalizeSale(payload);
    const result = await ingestSale({ userId: cred.userId }, data, payload, clientIpFrom(req.headers));

    await prisma.apiCredential.update({
      where: { id: cred.id },
      data: { lastUsedAt: new Date() },
    });

    await finishWebhookLog(logId, { status: "PROCESSADO", saleId: result.id, httpStatus: 200 });
    return Response.json({ ok: true, sale_id: result.id, status: result.status, match: result.match });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao processar o evento.";
    await finishWebhookLog(logId, { status: "ERRO", message, httpStatus: 500 });
    console.error("[webhook/ingest]", e);
    return Response.json({ error: message }, { status: 500 });
  }
}
