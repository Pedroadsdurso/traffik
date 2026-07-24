"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface AdAccountDTO {
  id: string;
  fbAccountId: string;
  name: string;
  currency: string;
  status: string;
  trackingEnabled: boolean;
}

export interface AdProfileDTO {
  id: string;
  name: string;
  email: string | null;
  pictureUrl: string | null;
  accounts: AdAccountDTO[];
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

export async function listAdProfiles(): Promise<AdProfileDTO[]> {
  const userId = await requireUserId();
  const profiles = await prisma.adProfile.findMany({
    where: { userId },
    orderBy: { connectedAt: "asc" },
    include: { adAccounts: { orderBy: { name: "asc" } } },
  });
  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    pictureUrl: p.pictureUrl,
    accounts: p.adAccounts.map((a) => ({
      id: a.id,
      fbAccountId: a.fbAccountId,
      name: a.name,
      currency: a.currency,
      status: a.status,
      trackingEnabled: a.trackingEnabled,
    })),
  }));
}

export async function toggleAccountTracking(accountId: string): Promise<AdAccountDTO> {
  const userId = await requireUserId();
  const acc = await prisma.adAccount.findFirst({ where: { id: accountId, userId } });
  if (!acc) throw new Error("Conta não encontrada.");
  const updated = await prisma.adAccount.update({
    where: { id: accountId },
    data: { trackingEnabled: !acc.trackingEnabled },
  });
  return {
    id: updated.id,
    fbAccountId: updated.fbAccountId,
    name: updated.name,
    currency: updated.currency,
    status: updated.status,
    trackingEnabled: updated.trackingEnabled,
  };
}

/** Ativa/desativa o rastreamento de TODAS as contas de um perfil de uma vez. */
export async function setProfileTracking(profileId: string, enabled: boolean): Promise<{ id: string; enabled: boolean }> {
  const userId = await requireUserId();
  const profile = await prisma.adProfile.findFirst({ where: { id: profileId, userId }, select: { id: true } });
  if (!profile) throw new Error("Perfil não encontrado.");
  await prisma.adAccount.updateMany({ where: { userId, adProfileId: profileId }, data: { trackingEnabled: enabled } });
  return { id: profileId, enabled };
}

export async function disconnectProfile(profileId: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  const profile = await prisma.adProfile.findFirst({ where: { id: profileId, userId }, select: { id: true } });
  if (!profile) throw new Error("Perfil não encontrado.");
  // Remove as contas vinculadas (e, por cascata, campanhas/métricas) e o perfil.
  await prisma.adAccount.deleteMany({ where: { userId, adProfileId: profileId } });
  await prisma.adProfile.delete({ where: { id: profileId } });
  return { id: profileId };
}
