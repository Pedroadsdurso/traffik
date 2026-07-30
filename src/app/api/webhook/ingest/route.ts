import type { NextRequest } from "next/server";

import { receberDeCredencial } from "@/lib/gateways/receber";

/**
 * Ingestão de vendas por **chave de API** da Traffik, para quem envia de um
 * sistema próprio: `Authorization: Bearer {chave}`.
 *
 * Passa pelo mesmo receptor universal dos webhooks — muda só como o dono é
 * identificado (chave em vez de token na URL) e o parser, que aqui é o genérico.
 */
export async function POST(req: NextRequest) {
  return receberDeCredencial(req);
}
