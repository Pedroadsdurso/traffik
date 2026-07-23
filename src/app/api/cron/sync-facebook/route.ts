import type { NextRequest } from "next/server";

import { syncUser } from "@/lib/facebook/sync";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/**
 * Chamado pelo Vercel Cron (ver vercel.json). Sincroniza todos os usuários que
 * têm ao menos um perfil do Facebook conectado. Protegido por CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  // O Vercel Cron envia "Authorization: Bearer <CRON_SECRET>".
  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const users = await prisma.adProfile.findMany({ distinct: ["userId"], select: { userId: true } });

  let totalMetrics = 0;
  const results: { userId: string; accounts: number; metrics: number; errors: number }[] = [];
  for (const u of users) {
    try {
      const s = await syncUser(u.userId);
      totalMetrics += s.metrics;
      results.push({ userId: u.userId, accounts: s.accounts, metrics: s.metrics, errors: s.errors.length });
    } catch {
      results.push({ userId: u.userId, accounts: 0, metrics: 0, errors: 1 });
    }
  }

  return Response.json({ ok: true, users: users.length, totalMetrics, results });
}
