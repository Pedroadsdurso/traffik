import type { AdProfileDTO } from "@/lib/actions/facebook";
import type { WhereDaArea } from "@/lib/areas/escopoWhere";
import { prisma } from "@/lib/prisma";

/**
 * OS PERFIS DE ANÚNCIO VISÍVEIS NUMA ÁREA — e o recorte aqui é INDIRETO.
 *
 * ## 🔴 A FORMA NÃO É A DO PIXEL, e a diferença cria um caso a mais
 *
 * | | Pixel | Anúncios |
 * |---|---|---|
 * | a entidade listada tem `workspaceId`? | ✅ `PixelConfig.workspaceId` | 🔴 **`AdProfile` NÃO TEM** |
 * | onde o recorte entra | direto na entidade | **nas CONTAS** (`adAccounts: { where }`) |
 * | como o item some da lista | o `where` não o traz | `.filter((p) => p.adAccounts.length > 0)` |
 *
 * > ## O perfil não é recortado: as CONTAS dele são, e ele desaparece por consequência de ficar sem nenhuma.
 *
 * 🔴 **Daí o caso que o Pixel não tem:** um perfil com contas em **duas áreas**
 * aparece nas **duas**, com **listas de contas diferentes**. Não é
 * presença/ausência — é o mesmo item mudando de conteúdo conforme a área.
 *
 * ⚠️ E por isso uma asserção de *"trocar de área muda a lista"* que olhe só a
 * PRESENÇA do perfil **passa sem tocar no caso**. O que mede é o conjunto de
 * ids das contas.
 *
 * ## ⛔ POR QUE ISTO É UM MÓDULO, e não o corpo da server action
 *
 * `listAdProfiles` começa com `requireUserId()`, que exige sessão — e nenhum
 * script de teste tem uma. Enquanto o corpo morava lá, o recorte por área era
 * **inalcançável por teste**. É a mesma razão que tirou o `where` de dentro do
 * `escopoDeConfig` (`escopoWhere.ts`) e o construtor de alertas do `useMemo`.
 *
 * ⚠️ **MOVE**: nem uma vírgula do que se calcula mudou.
 */
export interface PerfisDaArea {
  perfis: AdProfileDTO[];
  /**
   * 🔴 Quantos perfis CONECTADOS não aparecem nesta área.
   *
   * ⚠️ Sai de graça: a consulta já carrega todos os perfis do usuário e o
   * recorte é o `.filter` depois. Contar aqui não custa ida ao banco nenhuma —
   * e sem este número a tela não tem como dizer que eles existem.
   *
   * ⛔ Sem ele, quem conectou um perfil e não o vê procura um bug que não
   * existe. É a distinção central: **ausente ≠ inexistente**.
   */
  ocultos: number;
}

export async function perfisNoEscopo(userId: string, where: WhereDaArea): Promise<AdProfileDTO[]> {
  return (await perfisEOcultos(userId, where)).perfis;
}

export async function perfisEOcultos(userId: string, where: WhereDaArea): Promise<PerfisDaArea> {
  const profiles = await prisma.adProfile.findMany({
    where: { userId },
    orderBy: { connectedAt: "asc" },
    include: {
      /* 🔑 O TOTAL de contas do perfil, SEM o recorte de área — é ele que
         permite dizer `3 de 8 contas nesta área`. Sem o total, a tela mostra 3
         e quem sabe que há 8 conclui que perdeu contas.
         ⚠️ `_count` é SUBQUERY: não carrega linha e não custa ida ao banco. */
      _count: { select: { adAccounts: true } },
      adAccounts: {
        where,
        orderBy: { name: "asc" },
        // Contagens para a tela de Integracoes. `_count` e uma subquery do
        // Prisma — nao carrega as linhas.
        include: { _count: { select: { campaigns: true, pixelConfigs: true } } },
      },
    },
  });
  const visiveis = profiles.filter((p) => p.adAccounts.length > 0);
  return {
    ocultos: profiles.length - visiveis.length,
    perfis: visiveis.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      pictureUrl: p.pictureUrl,
      /** Contas do perfil em TODAS as áreas — o denominador de `N de M`. */
      contasNoTotal: p._count.adAccounts,
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
    })),
  };
}
