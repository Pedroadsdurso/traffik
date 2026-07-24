import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { clientIpFrom, ingestSale } from "@/lib/webhook/ingestSale";
import { normalizeSale } from "@/lib/webhook/normalizeSale";

/**
 * Endpoint genérico de ingestão de vendas, autenticado por uma chave de API
 * própria da Traffik (bloco direito da aba Webhooks). Qualquer sistema pode
 * enviar eventos de venda com `Authorization: Bearer {api_key}`.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : (req.headers.get("x-api-key")?.trim() ?? "");
  if (!key) return Response.json({ error: "Chave de API ausente." }, { status: 401 });

  const cred = await prisma.apiCredential.findUnique({
    where: { key },
    select: { id: true, userId: true, revoked: true },
  });
  if (!cred || cred.revoked) {
    return Response.json({ error: "Chave de API inválida ou revogada." }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const text = await req.text();
    payload = text ? JSON.parse(text) : {};
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const data = normalizeSale(payload);
  const result = await ingestSale({ userId: cred.userId }, data, payload, clientIpFrom(req.headers));

  await prisma.apiCredential.update({
    where: { id: cred.id },
    data: { lastUsedAt: new Date() },
  });

  return Response.json({ ok: true, sale_id: result.id, status: result.status, match: result.match });
}
