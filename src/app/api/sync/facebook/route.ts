import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { syncSingleAccount, syncUser } from "@/lib/facebook/sync";

// A sincronização pode levar alguns segundos por conta.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { accountId?: string };

  try {
    /* 🔴 `"exigir"` NOS DOIS — este era o pior dos seis chamadores.
       `syncUser(id)` sem o segundo argumento caía no default de **30 dias**:
       a mesma janela do sync profundo diário, cujo cabeçalho diz "use no
       máximo 1×/dia" — e aqui ela ia a CADA CLIQUE, sem reserva nem teto.

       ⚠️ Os 30 dias ficam EXPLÍCITOS. O default escondia a janela de quem lia
       a chamada, e foi assim que ela passou despercebida. */
    const summary = body.accountId
      ? await syncSingleAccount(session.user.id, body.accountId, 30, "exigir")
      : await syncUser(session.user.id, 30, "exigir");

    /* ⛔ `reservaNegada` NÃO é erro — é "já está sincronizando", e a tela
       precisa poder dizer isso. Devolver 200 com `ok: true` e um resumo zerado
       faria o segundo clique parecer um sync que não achou nada. */
    if (summary.reservaNegada) {
      return Response.json({ ok: true, jaSincronizando: true, ...summary });
    }
    return Response.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[sync/facebook]", e);
    return Response.json({ error: e instanceof Error ? e.message : "Falha na sincronização." }, { status: 500 });
  }
}
