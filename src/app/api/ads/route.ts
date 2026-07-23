import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { computeAdsOverview, type AdsFilters } from "@/lib/ads/overview";

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

  const data = await computeAdsOverview(session.user.id, filters);
  return Response.json(data);
}
