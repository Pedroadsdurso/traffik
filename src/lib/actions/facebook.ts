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
  /** `account_status` cru da Meta. Traduzido por `lib/facebook/contaStatus.ts`. */
  accountStatus: number | null;
  /** Ultimo erro CRU da Graph API para esta conta. */
  lastSyncError: string | null;
  /** Quando a ultima falha aconteceu. Alimenta o backoff e o "nova tentativa em". */
  lastSyncErrorAt: Date | null;
  /** NULO = o historico desta conta ainda nao foi buscado. Ver o schema. */
  backfillFeitoEm: Date | null;
  /** Falhas consecutivas. Distingue "falhou agora" de "falha ha dois dias". */
  syncErrorCount: number;
  trackingEnabled: boolean;
  /** Fuso da conta na Meta. `null` = a Meta nao informou. */
  timezone: string | null;
  /** Campanhas desta conta no banco. Contagem, nao as linhas. */
  campanhas: number;
  /** Configuracoes de pixel vinculadas a esta conta. */
  pixels: number;
}

export interface AdProfileDTO {
  id: string;
  name: string;
  email: string | null;
  pictureUrl: string | null;
  /** Erro CRU da descoberta de contas. Explica `accountStatus` nulo em massa. */
  lastDiscoveryError: string | null;
  /** `true` enquanto o perfil nunca completou uma sincronizacao. */
  nuncaSincronizou: boolean;
  /**
   * Quando o token da Marketing API expira. **`null` = NAO SABEMOS**, nunca
   * "nao expira" — ver `lib/integracoes/token.ts`.
   *
   * ⚠️ Campo ADITIVO, so leitura, exposto para a tela de Integracoes poder
   * avisar ANTES de a sincronizacao parar. A coluna ja existia e ja era escrita
   * no callback do OAuth; o que faltava era ela chegar ate a tela. O
   * `/api/cron/manutencao` ja notificava, mas notificacao se perde.
   */
  tokenExpiresAt: Date | null;
  /** Quando o perfil foi conectado. Alimenta "Criada em" no painel. */
  connectedAt: Date;
  /** Ultima sincronizacao COMPLETA bem-sucedida. `null` = nunca. */
  lastSyncedAt: Date | null;
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
    include: {
      adAccounts: {
        where: escopo.where,
        orderBy: { name: "asc" },
        // Contagens para a tela de Integracoes. `_count` e uma subquery do
        // Prisma — nao carrega as linhas.
        include: { _count: { select: { campaigns: true, pixelConfigs: true } } },
      },
    },
  });
  return profiles
    .filter((p) => p.adAccounts.length > 0)
    .map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    pictureUrl: p.pictureUrl,
    lastDiscoveryError: p.lastDiscoveryError,
    // ⚠️ Distingue "ainda nao sincronizamos" de "a Meta nao informou". Sem
    // isso, `accountStatus` nulo dizia "Status nao informado" nos dois casos —
    // e so um deles pede acao.
    nuncaSincronizou: p.lastSyncedAt == null,
    tokenExpiresAt: p.tokenExpiresAt,
    connectedAt: p.connectedAt,
    lastSyncedAt: p.lastSyncedAt,
    accounts: p.adAccounts.map((a) => ({
      id: a.id,
      fbAccountId: a.fbAccountId,
      name: a.name,
      currency: a.currency,
      status: a.status,
      accountStatus: a.accountStatus,
      lastSyncError: a.lastSyncError,
      lastSyncErrorAt: a.lastSyncErrorAt,
      backfillFeitoEm: a.backfillFeitoEm,
      syncErrorCount: a.syncErrorCount,
      trackingEnabled: a.trackingEnabled,
      timezone: a.timezone,
      campanhas: a._count.campaigns,
      pixels: a._count.pixelConfigs,
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
    include: { _count: { select: { campaigns: true, pixelConfigs: true } } },
  });
  return {
    id: updated.id,
    fbAccountId: updated.fbAccountId,
    name: updated.name,
    currency: updated.currency,
    status: updated.status,
    accountStatus: updated.accountStatus,
    lastSyncError: updated.lastSyncError,
    lastSyncErrorAt: updated.lastSyncErrorAt,
    backfillFeitoEm: updated.backfillFeitoEm,
    syncErrorCount: updated.syncErrorCount,
    trackingEnabled: updated.trackingEnabled,
    timezone: updated.timezone,
    campanhas: updated._count.campaigns,
    pixels: updated._count.pixelConfigs,
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
