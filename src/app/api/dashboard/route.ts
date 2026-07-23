import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { computeDashboard, type DashPeriod, type DashboardFilters } from "@/lib/dashboard/metrics";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const period = (["hoje", "7d", "30d", "custom"].includes(sp.get("period") ?? "")
    ? sp.get("period")
    : "7d") as DashPeriod;

  const filters: DashboardFilters = {
    period,
    account: sp.get("account") || "todas",
    product: sp.get("product") || "todos",
    source: sp.get("source") || "todas",
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
  };

  const data = await computeDashboard(session.user.id, filters);
  return Response.json(data);
}
