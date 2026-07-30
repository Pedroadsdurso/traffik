import type { NextRequest } from "next/server";

import { receberDeWebhook } from "@/lib/gateways/receber";

/**
 * **Receptor universal de webhooks** — `/api/webhook/sale/{token}`.
 *
 * O token identifica o webhook; o webhook diz qual é a plataforma; o registro
 * (`lib/gateways/registro.ts`) diz como autenticar e como ler o payload. Por
 * isso **um gateway novo não precisa de rota nova**: esta serve todos.
 *
 * O nome do arquivo é histórico (a URL já foi emitida). Não renomeie.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await ctx.params;
  return receberDeWebhook(req, webhookId);
}
