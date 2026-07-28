import type { NextRequest } from "next/server";

import { cronAutorizado, naoAutorizado } from "@/lib/cronAuth";

import { runUserRules } from "@/lib/rules/engine";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/** Vercel Cron: avalia as regras ativas de todos os usuários. Protegido por CRON_SECRET. */
export async function GET(req: NextRequest) {
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
