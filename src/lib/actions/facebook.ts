"use server";

import { auth } from "@/auth";
import { getLastWorkspaceId } from "@/lib/actions/workspaces";
import { escopoDeConfig } from "@/lib/areas/escopoConfig";
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

/**
 * Perfis do Facebook, com **apenas as contas da Área de Trabalho ativa**.
 *
 * ⚠️ Perfil que não tem nenhuma conta nesta área **não aparece** — dentro de
 * uma área, um perfil sem conta dela é ruído. A vitrine continua com o tile
 * "+ Adicionar perfil", e a conta existente é trazida para cá pela tela de
 * Áreas ("Mover para cá").
 *
 * ⚠️ Na Principal entram também as contas de `workspaceId` NULO — catch-all.
 * É o estado de toda conta após a migração e de toda conta nova descoberta na
 * BM: elas precisam aparecer em algum lugar, e vincular sozinho violaria a
 * regra de "uma conta, uma área".
 */
export async function listAdProfiles(workspaceId?: string | null): Promise<AdProfileDTO[]> {
  const userId = await requireUserId();
  const escopo = await escopoDeConfig(userId, workspaceId ?? (await getLastWorkspaceId()));
  const profiles = await prisma.adProfile.findMany({
    where: { userId },
    orderBy: { connectedAt: "asc" },
    include: { adAccounts: { where: escopo.where, orderBy: { name: "asc" } } },
  });
  return profiles
    .filter((p) => p.adAccounts.length > 0)
    .map((p) => ({
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
