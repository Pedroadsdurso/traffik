import type { NextRequest } from "next/server";

import { receberDeWebhook } from "@/lib/gateways/receber";

/**
 * Receptor **legado** da Kirvano: `/api/webhook/kirvano?id={token}`.
 *
 * ⛔ Esta rota não pode ser removida nem mudar de comportamento. A URL já está
 * colada no painel do gateway do usuário, e a regra permanente do projeto é que
 * **nenhum identificador já emitido muda de significado** — é o que garante que
 * webhook e script instalados nunca param de reportar.
 *
 * Ela é só um alias: quem recebe é o receptor universal, o mesmo de todos os
 * outros gateways. Gateway novo **não** ganha rota; usa `/api/webhook/sale/{token}`.
 *
 * ⚠️ O `exigirPlataforma` preserva o 404 para um token que não seja da Kirvano.
 * Sem ele, esta URL passaria a aceitar webhook de qualquer plataforma — o que
 * seria uma mudança de comportamento numa rota pública.
 *
 * ⚠️ As duas rotas aceitam o MESMO `Webhook.token`. Foi por aí que existiu um
 * bypass de autenticação: bastava trocar o caminho para cair na rota que não
 * validava o segredo. Hoje as duas passam pelo mesmo `autenticar()`, então o
 * bypass é estruturalmente impossível em vez de depender de lembrar.
 */
export async function POST(req: NextRequest) {
  return receberDeWebhook(req, req.nextUrl.searchParams.get("id"), "KIRVANO");
}
