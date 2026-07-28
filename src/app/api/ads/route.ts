import { after } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { computeAdsOverview, type AdsFilters } from "@/lib/ads/overview";
import { autoSyncSeNecessario, estadoSync } from "@/lib/facebook/autoSync";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const period = (["hoje", "7d", "30d"].includes(sp.get("period") ?? "") ? sp.get("period") : "7d") as AdsFilters["period"];
  const filters: AdsFilters = {
    period,
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
