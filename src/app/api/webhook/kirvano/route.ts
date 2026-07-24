import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { clientIpFrom, ingestSale } from "@/lib/webhook/ingestSale";
import { parseKirvano } from "@/lib/webhook/parseKirvano";

/**
 * Receptor dos webhooks da Kirvano.
 *
 * URL entregue ao usuário: `/api/webhook/kirvano?id={token}`, onde `token` é
 * o identificador único do webhook. O usuário configura, dentro do painel da
 * Kirvano, um "token de segurança" (texto livre) — nós o guardamos em
 * `Webhook.secret` e validamos a cada evento (header `security-token` ou campo
 * no corpo). Eventos suportados: venda gerada, paga, reembolsada e chargeback.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("id");
  if (!token) return Response.json({ error: "Parâmetro id ausente." }, { status: 400 });

  const webhook = await prisma.webhook.findUnique({
    where: { token },
    select: { id: true, userId: true, active: true, secret: true, platform: true },
  });
  if (!webhook || webhook.platform !== "KIRVANO") {
    return Response.json({ error: "Webhook não encontrado." }, { status: 404 });
  }
  if (!webhook.active) return Response.json({ error: "Webhook inativo." }, { status: 403 });

  let payload: Record<string, unknown>;
  try {
    const text = await req.text();
    payload = text ? JSON.parse(text) : {};
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  // Validação do token de segurança da Kirvano (quando o usuário definiu um).
  if (webhook.secret) {
    const sent =
      req.headers.get("security-token") ??
      req.headers.get("x-security-token") ??
      (typeof payload["token"] === "string" ? (payload["token"] as string) : null) ??
      (typeof payload["security_token"] === "string" ? (payload["security_token"] as string) : null);
    if (sent !== webhook.secret) {
      return Response.json({ error: "Token de segurança inválido." }, { status: 401 });
    }
  }

  const data = parseKirvano(payload);
  const result = await ingestSale(
    { userId: webhook.userId, webhookId: webhook.id },
    data,
    payload,
    clientIpFrom(req.headers),
  );

  return Response.json({ ok: true, sale_id: result.id, status: result.status, match: result.match });
}
