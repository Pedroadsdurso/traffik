import { after } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { computeAdsOverview, type AdsFilters } from "@/lib/ads/overview";
import { autoSyncSeNecessario, estadoSync } from "@/lib/facebook/autoSync";
import { ehPeriodoValido } from "@/lib/periodo";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  // ⚠️ Valida pelo `ehPeriodoValido` da fonte única, não por uma lista escrita à
  // mão aqui: a lista local ficaria para trás a cada período novo e o valor cairia
  // no fallback em silêncio.
  const bruto = sp.get("period");
  const period: AdsFilters["period"] = ehPeriodoValido(bruto) ? bruto : "7d";
  const filters: AdsFilters = {
    // Só o ID da área viaja; a posse é validada no servidor. Ver o CLAUDE.md.
    workspaceId: sp.get("ws"),
    period,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    account: sp.get("account") || "todas",
    status: sp.get("status") || "todos",
    search: sp.get("search") || "",
  };

  const userId = session.user.id;
  const [data, sync] = await Promise.all([computeAdsOverview(userId, filters), estadoSync(userId)]);

  // `after()` roda DEPOIS da resposta sair: o polling não fica esperando a Graph
  // API. Na maioria das chamadas a função sai no primeiro `if` (ainda não deu o
  // intervalo) e não custa nada.
  after(() => autoSyncSeNecessario(userId));

  return Response.json({
    ...data,
    sync: { lastSyncedAt: sync.lastSyncedAt?.toISOString() ?? null, sincronizando: sync.sincronizando },
  });
}
