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
  const results: Record<string, unknown>[] = [];

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
        // O resultado vem do auto-sync — antes eram zeros LITERAIS aqui, e a
        // resposta dizia "accounts: 0" mesmo quando a sincronização tinha
        // corrido bem. Um cron que mente sobre o próprio resultado esconde o
        // erro justamente onde se olha para diagnosticar.
        const r = await autoSyncSeNecessario(u.userId);
        // Quantas contas o filtro do sync considera elegíveis — é a resposta
        // para "por que nenhuma conta apareceu?" sem ter que abrir o banco.
        const elegiveis = await prisma.adAccount.count({
          where: { userId: u.userId, trackingEnabled: true, adProfile: { isNot: null } },
        });
        const total = await prisma.adAccount.count({ where: { userId: u.userId } });
        totalMetrics += r.modo === "metricas" || r.modo === "completo" ? r.summary.metrics : 0;
        results.push({
          userId: u.userId,
          modo: r.modo,
          ...(r.modo === "pulado" ? { motivo: r.motivo } : {}),
          ...(r.modo === "erro" ? { erro: r.erro } : {}),
          ...(r.modo === "metricas" || r.modo === "completo"
            ? { accounts: r.summary.accounts, metrics: r.summary.metrics, errors: r.summary.errors.length, detalheErros: r.summary.errors }
            : {}),
          contasElegiveis: elegiveis,
          contasTotais: total,
          ...(elegiveis === 0 && total > 0
            ? { aviso: "Nenhuma conta com rastreamento ligado. Ative em Integrações › Anúncios." }
            : {}),
        });
      }
    } catch {
      results.push({ userId: u.userId, accounts: 0, metrics: 0, errors: 1 });
    }
  }

  return Response.json({ ok: true, modo: full ? "completo-30d" : "auto", users: users.length, totalMetrics, results });
}
