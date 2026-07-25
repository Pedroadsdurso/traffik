import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import type { EntityStatus } from "@/generated/prisma/enums";
import {
  deleteEntity,
  duplicateCampaign,
  setEntityStatus,
  updateBidCap,
  updateDailyBudget,
} from "@/lib/facebook/manage";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

type Nivel = "campaign" | "adset" | "ad";
type Acao = "activate" | "pause" | "budget" | "bidcap" | "duplicate" | "delete";

interface Alvo {
  id: string;
  fbId: string;
  nome: string;
  token: string | null;
}

/** Resolve os alvos **validando a posse**: o `where` sempre filtra por userId. */
async function resolverAlvos(userId: string, nivel: Nivel, ids: string[]): Promise<Alvo[]> {
  const perfil = { adAccount: { select: { adProfile: { select: { accessToken: true } } } } };

  if (nivel === "campaign") {
    const rows = await prisma.campaign.findMany({
      where: { id: { in: ids }, adAccount: { userId } },
      select: { id: true, fbCampaignId: true, name: true, ...perfil },
    });
    return rows.map((r) => ({ id: r.id, fbId: r.fbCampaignId, nome: r.name, token: r.adAccount.adProfile?.accessToken ?? null }));
  }
  if (nivel === "adset") {
    const rows = await prisma.adSet.findMany({
      where: { id: { in: ids }, adAccount: { userId } },
      select: { id: true, fbAdSetId: true, name: true, ...perfil },
    });
    return rows.map((r) => ({ id: r.id, fbId: r.fbAdSetId, nome: r.name, token: r.adAccount.adProfile?.accessToken ?? null }));
  }
  const rows = await prisma.ad.findMany({
    where: { id: { in: ids }, adAccount: { userId } },
    select: { id: true, fbAdId: true, name: true, ...perfil },
  });
  return rows.map((r) => ({ id: r.id, fbId: r.fbAdId, nome: r.name, token: r.adAccount.adProfile?.accessToken ?? null }));
}

/** Reflete no banco o que acabou de ser aplicado no Facebook. */
async function espelharLocal(nivel: Nivel, id: string, acao: Acao, valor?: number) {
  const status: EntityStatus | null =
    acao === "activate" ? "ACTIVE" : acao === "pause" ? "PAUSED" : acao === "delete" ? "DELETED" : null;

  if (nivel === "campaign") {
    if (status) await prisma.campaign.update({ where: { id }, data: { status } });
    else if (acao === "budget" && valor != null) await prisma.campaign.update({ where: { id }, data: { dailyBudget: valor } });
    return;
  }
  if (nivel === "adset") {
    if (status) await prisma.adSet.update({ where: { id }, data: { status } });
    else if (acao === "budget" && valor != null) await prisma.adSet.update({ where: { id }, data: { dailyBudget: valor } });
    else if (acao === "bidcap" && valor != null) await prisma.adSet.update({ where: { id }, data: { bidAmount: valor } });
    return;
  }
  if (status) await prisma.ad.update({ where: { id }, data: { status } });
}

/**
 * Ações em massa do Gerenciador (Bloco 7). **Toda ação chama a Marketing API de
 * verdade** — não há simulação.
 *
 * Cada alvo é processado isoladamente e o resultado volta por item: uma falha
 * (token expirado, permissão, entidade removida no Facebook) não aborta os
 * demais, e a UI consegue dizer exatamente o que passou e o que não passou.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    nivel?: Nivel;
    acao?: Acao;
    ids?: string[];
    valor?: number;
  };
  const { nivel, acao, ids, valor } = body;

  if (!nivel || !acao || !Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }
  if ((acao === "budget" || acao === "bidcap") && (typeof valor !== "number" || valor <= 0)) {
    return Response.json({ error: "Valor inválido." }, { status: 400 });
  }
  if (acao === "duplicate" && nivel !== "campaign") {
    return Response.json({ error: "Só é possível duplicar campanhas." }, { status: 400 });
  }
  if (acao === "bidcap" && nivel !== "adset") {
    return Response.json({ error: "O bid cap vive no conjunto." }, { status: 400 });
  }

  const alvos = await resolverAlvos(session.user.id, nivel, ids);
  if (alvos.length === 0) return Response.json({ error: "Nada encontrado." }, { status: 404 });

  const resultados: { id: string; nome: string; ok: boolean; erro?: string }[] = [];

  for (const alvo of alvos) {
    try {
      if (!alvo.token) throw new Error("Perfil do Facebook sem token — reconecte em Integrações › Anúncios.");

      if (acao === "activate") await setEntityStatus(alvo.fbId, "ACTIVE", alvo.token);
      else if (acao === "pause") await setEntityStatus(alvo.fbId, "PAUSED", alvo.token);
      else if (acao === "budget") await updateDailyBudget(alvo.fbId, valor!, alvo.token);
      else if (acao === "bidcap") await updateBidCap(alvo.fbId, valor!, alvo.token);
      else if (acao === "delete") await deleteEntity(alvo.fbId, alvo.token);
      else if (acao === "duplicate") await duplicateCampaign(alvo.fbId, alvo.token);

      // Duplicar cria um objeto novo no Facebook; ele entra no banco no
      // próximo sync, não aqui.
      if (acao !== "duplicate") await espelharLocal(nivel, alvo.id, acao, valor);

      resultados.push({ id: alvo.id, nome: alvo.nome, ok: true });
    } catch (e) {
      resultados.push({
        id: alvo.id,
        nome: alvo.nome,
        ok: false,
        erro: e instanceof Error ? e.message : "Falha desconhecida.",
      });
    }
  }

  const sucessos = resultados.filter((r) => r.ok).length;
  return Response.json({ ok: sucessos > 0, sucessos, falhas: resultados.length - sucessos, resultados });
}
