import type { NextRequest } from "next/server";

import { cronAutorizado, naoAutorizado } from "@/lib/cronAuth";
import { registrarExecucao } from "@/lib/cronBatimento";

import { runUserRules } from "@/lib/rules/engine";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/** Vercel Cron: avalia as regras ativas de todos os usuários. Protegido por CRON_SECRET. */
async function executar(req: NextRequest) {
  if (!cronAutorizado(req)) return naoAutorizado();

  const users = await prisma.automationRule.findMany({
    where: { active: true },
    distinct: ["userId"],
    select: { userId: true },
  });

  let evaluated = 0;
  let acted = 0;
  for (const u of users) {
    try {
      const r = await runUserRules(u.userId);
      evaluated += r.evaluated;
      acted += r.acted;
    } catch {
      /* segue para o próximo usuário */
    }
  }
  return Response.json({ ok: true, users: users.length, evaluated, acted });
}

/**
 * Envolve a rotina para registrar o BATIMENTO.
 *
 * Agendador externo avisa quando a execucao falha; nenhum avisa quando ele
 * proprio para. Quem detecta a ausencia e o servidor — ver `lib/cronBatimento.ts`.
 *
 * ⚠️ Registra nos DOIS caminhos, e com `ok` diferente: silencio (nunca rodou) e
 * falha (rodou e quebrou) sao sinais distintos, e a tela os separa. Registrar so
 * o sucesso faria uma rotina que falha sempre parecer uma rotina que parou.
 *
 * ⚠️ 401 NAO conta como execucao: chamada sem o segredo nao e o agendador
 * trabalhando, e marcar batimento ali esconderia justamente o caso em que o
 * `CRON_SECRET` foi trocado e o agendador parou de ser aceito.
 */
export async function GET(req: NextRequest) {
  const t0 = Date.now();
  try {
    const res = await executar(req);
    if (res.status !== 401) {
      await registrarExecucao("run-rules", { ok: res.ok, duracaoMs: Date.now() - t0 });
    }
    return res;
  } catch (e) {
    await registrarExecucao("run-rules", {
      ok: false,
      duracaoMs: Date.now() - t0,
      erro: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
