import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { setEntityStatus } from "@/lib/facebook/manage";
import { prisma } from "@/lib/prisma";

type EntityType = "campaign" | "adset" | "ad";

/** Descobre o id do Facebook, o token do perfil e valida a posse da entidade. */
async function resolveEntity(userId: string, type: EntityType, id: string) {
  if (type === "campaign") {
    const c = await prisma.campaign.findFirst({
      where: { id, adAccount: { userId } },
      select: { fbCampaignId: true, status: true, adAccount: { select: { adProfile: { select: { accessToken: true } } } } },
    });
    return c && { fbId: c.fbCampaignId, status: c.status, token: c.adAccount.adProfile?.accessToken };
  }
  if (type === "adset") {
    const a = await prisma.adSet.findFirst({
      where: { id, adAccount: { userId } },
      select: { fbAdSetId: true, status: true, adAccount: { select: { adProfile: { select: { accessToken: true } } } } },
    });
    return a && { fbId: a.fbAdSetId, status: a.status, token: a.adAccount.adProfile?.accessToken };
  }
  const ad = await prisma.ad.findFirst({
    where: { id, adAccount: { userId } },
    select: { fbAdId: true, status: true, adAccount: { select: { adProfile: { select: { accessToken: true } } } } },
  });
  return ad && { fbId: ad.fbAdId, status: ad.status, token: ad.adAccount.adProfile?.accessToken };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { type?: EntityType; id?: string };
  const { type, id } = body;
  if (!type || !id || !["campaign", "adset", "ad"].includes(type)) {
    return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const entity = await resolveEntity(session.user.id, type, id);
  if (!entity) return Response.json({ error: "Entidade não encontrada." }, { status: 404 });
  if (!entity.token) return Response.json({ error: "Perfil do Facebook sem token." }, { status: 400 });

  const next = entity.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
  try {
    await setEntityStatus(entity.fbId, next, entity.token);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Falha ao atualizar no Facebook." }, { status: 502 });
  }

  // Reflete no banco após sucesso na API.
  const data = { status: next as "ACTIVE" | "PAUSED" };
  if (type === "campaign") await prisma.campaign.update({ where: { id }, data });
  else if (type === "adset") await prisma.adSet.update({ where: { id }, data });
  else await prisma.ad.update({ where: { id }, data });

  return Response.json({ ok: true, status: next });
}
