import type { NextRequest } from "next/server";

import { autoSyncSeNecessario } from "@/lib/facebook/autoSync";
import { syncUser } from "@/lib/facebook/sync";
import { cronAutorizado, naoAutorizado } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/**
 * Chamado pelo Vercel Cron (ver vercel.json). Sincroniza todos os usuários que
 * têm ao menos um perfil do Facebook conectado. Protegido por CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return naoAutorizado();

  // `?full=1` força a janela LONGA (30 dias) para todo mundo, ignorando os
  // intervalos. Use no máximo 1×/dia: são ~4 chamadas por conta e serve só para
  // recuperar dias antigos que a Meta reconsolidou.
  const full = req.nextUrl.searchParams.get("full") === "1";

  const users = await prisma.adProfile.findMany({ distinct: ["userId"], select: { userId: true } });

  let totalMetrics = 0;
  const results: { userId: string; accounts: number; metrics: number; errors: number }[] = [];

  for (const u of users) {
    try {
      if (full) {
        const s = await syncUser(u.userId, 30);
        totalMetrics += s.metrics;
        results.push({ userId: u.userId, accounts: s.accounts, metrics: s.metrics, errors: s.errors.length });
      } else {
        // Delega ao MESMO auto-sync que o painel usa. Ele já decide sozinho se
        // toca só as métricas (20s, 1 chamada por conta) ou o ciclo completo
        // (3 min), e a reserva no banco impede execução concorrente.
        //
        // É o que torna esta rota **segura de chamar a cada 1 minuto**: a
        // frequência da chamada deixa de determinar a carga na Graph API — os
        // intervalos internos determinam. Chamar mais vezes só faz a maioria
        // sair sem tocar na Meta.
        await autoSyncSeNecessario(u.userId);
        results.push({ userId: u.userId, accounts: 0, metrics: 0, errors: 0 });
      }
    } catch {
      results.push({ userId: u.userId, accounts: 0, metrics: 0, errors: 1 });
    }
  }

  return Response.json({ ok: true, modo: full ? "completo-30d" : "auto", users: users.length, totalMetrics, results });
}
