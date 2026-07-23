import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { createCampaign } from "@/lib/facebook/manage";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    accountId?: string;
    name?: string;
    objective?: string;
    dailyBudget?: number;
  };
  const name = body.name?.trim();
  const objective = body.objective || "OUTCOME_TRAFFIC";
  if (!body.accountId || !name) return Response.json({ error: "Informe conta e nome." }, { status: 400 });

  const account = await prisma.adAccount.findFirst({
    where: { id: body.accountId, userId },
    select: { id: true, fbAccountId: true, adProfile: { select: { accessToken: true } } },
  });
  if (!account) return Response.json({ error: "Conta não encontrada." }, { status: 404 });
  const token = account.adProfile?.accessToken;
  if (!token) return Response.json({ error: "Perfil do Facebook sem token." }, { status: 400 });

  let fbCampaignId: string;
  try {
    fbCampaignId = await createCampaign(account.fbAccountId, token, { name, objective, dailyBudget: body.dailyBudget });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Falha ao criar campanha." }, { status: 502 });
  }

  // A campanha nasce pausada no Facebook; espelha no banco.
  await prisma.campaign.upsert({
    where: { adAccountId_fbCampaignId: { adAccountId: account.id, fbCampaignId } },
    update: { name, status: "PAUSED", objective, dailyBudget: body.dailyBudget ?? null },
    create: { adAccountId: account.id, fbCampaignId, name, status: "PAUSED", objective, dailyBudget: body.dailyBudget ?? null },
  });

  return Response.json({ ok: true, fbCampaignId });
}
