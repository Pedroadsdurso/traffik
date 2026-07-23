import { auth } from "@/auth";
import { runUserRules } from "@/lib/rules/engine";

export const maxDuration = 60;

/** Executa manualmente as regras ativas do usuário logado ("rodar agora"). */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const result = await runUserRules(session.user.id);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Falha ao executar regras." }, { status: 500 });
  }
}
