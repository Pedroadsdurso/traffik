"use server";

import { randomBytes } from "node:crypto";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface UtmCodesDTO {
  /** Identificador da conta do usuário no nosso sistema (= userId). */
  accountId: string;
  /** Separador único usado no `xcod` da Hotmart. */
  separator: string;
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

export async function getUtmCodes(): Promise<UtmCodesDTO> {
  const userId = await requireUserId();
  const separator = await ensureSeparator(userId);

  const xcod =
    `&xcod=FB${separator}{{campaign.name}}|{{campaign.id}}` +
    `${separator}{{adset.name}}|{{adset.id}}` +
    `${separator}{{ad.name}}|{{ad.id}}` +
    `${separator}{{placement}}`;

  return {
    accountId: userId,
    separator,
    hotmart: BASE + xcod,
    cartpanda: `${BASE}&cid=${userId}`,
    outros: BASE,
  };
}
