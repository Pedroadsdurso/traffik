import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { computeCreatives, type CreativePeriod, type CreativeSort } from "@/lib/ads/creatives";
import { ehPeriodoValido } from "@/lib/periodo";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const bruto = sp.get("period");
  const period: CreativePeriod = ehPeriodoValido(bruto) ? bruto : "7d";
  const sort = (["roas", "ctr", "spend", "sales"].includes(sp.get("sort") ?? "") ? sp.get("sort") : "roas") as CreativeSort;

  // Só o ID da área viaja; a posse é validada no servidor (`areaValida`).
  const creatives = await computeCreatives(session.user.id, {
    period,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    sort,
    workspaceId: sp.get("ws"),
  });
  return Response.json({ creatives });
}
