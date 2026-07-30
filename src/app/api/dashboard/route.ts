import { after } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { computeDashboard, type DashPeriod, type DashboardFilters } from "@/lib/dashboard/metrics";
import { autoSyncSeNecessario, estadoSync } from "@/lib/facebook/autoSync";
import { ehPeriodoValido } from "@/lib/periodo";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  // Valida pela fonte única (`lib/periodo.ts`), não por lista local.
  const bruto = sp.get("period");
  const period: DashPeriod = ehPeriodoValido(bruto) ? bruto : "hoje";

  const filters: DashboardFilters = {
    // Só o ID da área viaja. A posse é validada no servidor (`areaValida`), e a
    // pertinência de cada linha é resolvida lá — o cliente nunca manda filtros.
    workspaceId: sp.get("ws"),
    period,
    account: sp.get("account") || "todas",
    product: sp.get("product") || "todos",
    source: sp.get("source") || "todas",
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
  };

  const userId = session.user.id;
  const [data, sync] = await Promise.all([computeDashboard(userId, filters), estadoSync(userId)]);

  // Sincroniza em segundo plano, depois da resposta (ver `autoSync.ts`). O
  // Dashboard também dispara, e não só o Gerenciador: quem deixa a ferramenta
  // aberta no Dashboard espera ver o gasto subir ali também.
  after(() => autoSyncSeNecessario(userId));

  return Response.json({
    ...data,
    sync: { lastSyncedAt: sync.lastSyncedAt?.toISOString() ?? null, sincronizando: sync.sincronizando },
  });
}
