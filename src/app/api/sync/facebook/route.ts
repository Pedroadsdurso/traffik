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
    const summary = body.accountId
      ? await syncSingleAccount(session.user.id, body.accountId)
      : await syncUser(session.user.id);
    return Response.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[sync/facebook]", e);
    return Response.json({ error: e instanceof Error ? e.message : "Falha na sincronização." }, { status: 500 });
  }
}
