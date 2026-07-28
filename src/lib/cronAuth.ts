import type { NextRequest } from "next/server";

/**
 * Autenticação das rotas `/api/cron/*`.
 *
 * **Formato aceito — único:** `Authorization: Bearer <CRON_SECRET>`.
 * Nunca query string: a URL completa fica gravada no log de acesso do servidor,
 * no histórico do serviço de cron e em qualquer proxy no caminho. Um secret que
 * aciona `run-rules` — que pausa campanha e altera orçamento de verdade — não
 * pode viajar em lugar que é logado por padrão.
 *
 * ## Falha FECHADA
 *
 * A checagem era `if (secret && auth !== ...)`: **sem a env var definida, as
 * rotas ficavam públicas** e qualquer um podia disparar `run-rules`. O modo
 * seguro é o contrário — sem secret configurado, ninguém entra. Um cron que
 * para de funcionar é um problema visível; uma rota de escrita aberta na
 * internet não é.
 */
export function cronAutorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export function naoAutorizado(): Response {
  return Response.json(
    { error: "Não autorizado.", dica: "Envie o header: Authorization: Bearer <CRON_SECRET>" },
    { status: 401 },
  );
}
