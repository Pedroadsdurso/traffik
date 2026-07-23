import { auth } from "@/auth";
import { syncUser } from "@/lib/facebook/sync";

// A sincronização pode levar alguns segundos por conta.
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const summary = await syncUser(session.user.id);
    return Response.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[sync/facebook]", e);
    return Response.json({ error: e instanceof Error ? e.message : "Falha na sincronização." }, { status: 500 });
  }
}
