import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { computeCreatives, type CreativePeriod, type CreativeSort } from "@/lib/ads/creatives";
import { filtrosDaArea } from "@/lib/actions/workspaces";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const period = (["hoje", "7d", "30d"].includes(sp.get("period") ?? "") ? sp.get("period") : "7d") as CreativePeriod;
  const sort = (["roas", "ctr", "spend", "sales"].includes(sp.get("sort") ?? "") ? sp.get("sort") : "roas") as CreativeSort;

  const area = await filtrosDaArea(sp.get("ws"));
  const creatives = await computeCreatives(session.user.id, { period, sort, ...area });
  return Response.json({ creatives });
}
