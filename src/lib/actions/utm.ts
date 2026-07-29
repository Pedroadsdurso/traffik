"use server";

import { randomBytes } from "node:crypto";

import { auth } from "@/auth";
import { getLastWorkspaceId } from "@/lib/actions/workspaces";
import { escopoDeConfig } from "@/lib/areas/escopoConfig";
import { prisma } from "@/lib/prisma";

export interface UtmCodesDTO {
  /** Identificador da conta do usuário no nosso sistema (= userId). */
  accountId: string;
  /** Separador único usado no `xcod` da Hotmart. */
  separator: string;
  /** Área de Trabalho ativa — embutida no script para o clique nascer nela. */
  workspaceId: string;
  workspaceName: string;
  ehPrincipal: boolean;
  /**
   * Cliques desta área que chegaram COM o parâmetro de área (script novo).
   * Zero numa área secundária = o script dela ainda não foi instalado.
   */
  cliquesComArea: number;
  /** Cliques do usuário sem parâmetro de área (script antigo, ou orgânico). */
  cliquesSemArea: number;
  hotmart: string;
  cartpanda: string;
  outros: string;
}

const BASE =
  "utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}" +
  "&utm_medium={{adset.name}}|{{adset.id}}" +
  "&utm_content={{ad.name}}|{{ad.id}}" +
  "&utm_term={{placement}}";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

/** Garante que o usuário tenha um separador persistido e o devolve. */
async function ensureSeparator(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { xcodSeparator: true } });
  if (user?.xcodSeparator) return user.xcodSeparator;
  const separator = `_${randomBytes(6).toString("hex")}_`;
  await prisma.user.update({ where: { id: userId }, data: { xcodSeparator: separator } });
  return separator;
}

export async function getUtmCodes(workspaceId?: string | null): Promise<UtmCodesDTO> {
  const userId = await requireUserId();
  const separator = await ensureSeparator(userId);
  const escopo = await escopoDeConfig(userId, workspaceId ?? (await getLastWorkspaceId()));
  const [area, cliquesComArea, cliquesSemArea] = await Promise.all([
    prisma.workspace.findFirst({ where: { id: escopo.areaId }, select: { name: true } }),
    prisma.click.count({ where: { userId, workspaceId: escopo.areaId } }),
    prisma.click.count({ where: { userId, workspaceId: null } }),
  ]);

  const xcod =
    `&xcod=FB${separator}{{campaign.name}}|{{campaign.id}}` +
    `${separator}{{adset.name}}|{{adset.id}}` +
    `${separator}{{ad.name}}|{{ad.id}}` +
    `${separator}{{placement}}`;

  return {
    accountId: userId,
    separator,
    workspaceId: escopo.areaId,
    workspaceName: area?.name ?? "Principal",
    ehPrincipal: escopo.ehPrincipal,
    cliquesComArea,
    cliquesSemArea,
    hotmart: BASE + xcod,
    cartpanda: `${BASE}&cid=${userId}`,
    outros: BASE,
  };
}
