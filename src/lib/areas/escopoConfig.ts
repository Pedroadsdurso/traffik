import { prisma } from "@/lib/prisma";

/**
 * Escopo de CONFIGURAÇÃO por Área de Trabalho.
 *
 * Separado da atribuição de métrica (`./precedencia.ts`) de propósito — são
 * perguntas diferentes:
 *
 * - **Métrica**: "de quem é esta VENDA?" → cadeia de precedência, porque a
 *   venda chega por atribuição e não tem dono declarado.
 * - **Configuração**: "de quem é este WEBHOOK?" → uma FK, e pronto. Webhook,
 *   pixel, conta, regra e despesa têm dono explícito.
 *
 * Por isso aqui é uma consulta leve, e não o mapa de 6 consultas.
 *
 * ## ⚠️ A Principal é catch-all também na configuração
 *
 * `workspaceId` NULO = "sem dono". Se a Principal filtrasse por
 * `workspaceId = principal.id`, todo webhook e pixel existente (que a migration
 * deixou NULO de propósito) ficaria **invisível** — o usuário abriria
 * Integrações e veria a tela vazia, com as integrações funcionando normalmente
 * no servidor. É a mesma lógica do dashboard: o não atribuído precisa aparecer
 * em algum lugar, e esse lugar é a Principal.
 */
export interface EscopoConfig {
  areaId: string;
  ehPrincipal: boolean;
  /** `where` do Prisma para listar o que pertence a esta área. */
  where: { workspaceId: string } | { OR: [{ workspaceId: string }, { workspaceId: null }] };
}

export async function escopoDeConfig(
  userId: string,
  workspaceId?: string | null,
): Promise<EscopoConfig> {
  // Valida a posse: id de outra pessoa (ou área arquivada) cai na Principal,
  // nunca em "sem filtro". Mesma garantia do `areaValida` das métricas.
  const w =
    (workspaceId
      ? await prisma.workspace.findFirst({
          where: { id: workspaceId, userId, archived: false },
          select: { id: true, isDefault: true },
        })
      : null) ??
    (await prisma.workspace.findFirst({
      where: { userId, isDefault: true },
      select: { id: true, isDefault: true },
    }));

  // Sem área nenhuma (usuário no meio da primeira requisição): não filtra, em
  // vez de esconder tudo. `garantirAreaPrincipal` cria a área logo em seguida.
  if (!w) return { areaId: "", ehPrincipal: true, where: { OR: [{ workspaceId: "" }, { workspaceId: null }] } };

  return {
    areaId: w.id,
    ehPrincipal: w.isDefault,
    where: w.isDefault
      ? { OR: [{ workspaceId: w.id }, { workspaceId: null }] }
      : { workspaceId: w.id },
  };
}

/**
 * 🔴 Despesas são diferentes: **NULO = vale para TODAS as áreas**, não "sem
 * dono". Taxa de gateway e imposto são globais por natureza, então a lista
 * SEMPRE inclui as nulas — inclusive numa área secundária.
 */
export function whereDespesas(areaId: string) {
  return { OR: [{ workspaceId: null }, { workspaceId: areaId }] };
}
