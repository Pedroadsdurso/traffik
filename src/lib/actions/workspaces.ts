"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface WorkspaceDTO {
  id: string;
  name: string;
  color: string | null;
  archived: boolean;
  accountIds: string[];
  products: string[];
  sources: string[];
}

/**
 * Áreas de Trabalho — filtros salvos, **não** isolamento de dados.
 *
 * Excluir uma área nunca apaga venda, clique ou evento: ela só descreve o que a
 * tela mostra. É por isso que a exclusão aqui não pede confirmação por digitação
 * como pediria um projeto de verdade — não há o que perder.
 */
async function uid(): Promise<string> {
  const s = await auth();
  if (!s?.user?.id) throw new Error("Não autenticado.");
  return s.user.id;
}

const dto = (w: {
  id: string; name: string; color: string | null; archived: boolean;
  accountIds: string[]; products: string[]; sources: string[];
}): WorkspaceDTO => ({ ...w });

export async function listWorkspaces(): Promise<WorkspaceDTO[]> {
  const userId = await uid();
  const rows = await prisma.workspace.findMany({
    where: { userId },
    orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, color: true, archived: true, accountIds: true, products: true, sources: true },
  });
  return rows.map(dto);
}

/** A área lembrada do último acesso. `null` = "Todas as áreas". */
export async function getLastWorkspaceId(): Promise<string | null> {
  const userId = await uid();
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { lastWorkspaceId: true } });
  return u?.lastWorkspaceId ?? null;
}

export async function setLastWorkspaceId(workspaceId: string | null): Promise<void> {
  const userId = await uid();
  // Valida a posse antes de gravar: um id de outro usuário viraria uma FK
  // válida apontando para área alheia.
  if (workspaceId) {
    const existe = await prisma.workspace.findFirst({ where: { id: workspaceId, userId }, select: { id: true } });
    if (!existe) return;
  }
  await prisma.user.update({ where: { id: userId }, data: { lastWorkspaceId: workspaceId } });
}

export async function createWorkspace(input: {
  name: string; color?: string | null; accountIds?: string[]; products?: string[]; sources?: string[];
}): Promise<WorkspaceDTO> {
  const userId = await uid();
  const w = await prisma.workspace.create({
    data: {
      userId,
      name: input.name.trim() || "Nova área",
      color: input.color ?? null,
      accountIds: input.accountIds ?? [],
      products: input.products ?? [],
      sources: input.sources ?? [],
    },
    select: { id: true, name: true, color: true, archived: true, accountIds: true, products: true, sources: true },
  });
  return dto(w);
}

export async function updateWorkspace(id: string, input: {
  name?: string; color?: string | null; archived?: boolean;
  accountIds?: string[]; products?: string[]; sources?: string[];
}): Promise<WorkspaceDTO | null> {
  const userId = await uid();
  // `updateMany` com userId no where: `update` por id sozinho deixaria editar
  // área de outro usuário se o id vazasse.
  const r = await prisma.workspace.updateMany({
    where: { id, userId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() || "Sem nome" } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
      ...(input.accountIds !== undefined ? { accountIds: input.accountIds } : {}),
      ...(input.products !== undefined ? { products: input.products } : {}),
      ...(input.sources !== undefined ? { sources: input.sources } : {}),
    },
  });
  if (r.count === 0) return null;
  const w = await prisma.workspace.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, color: true, archived: true, accountIds: true, products: true, sources: true },
  });
  return dto(w);
}

/** Duplica só a CONFIGURAÇÃO — não há dado para copiar. */
export async function duplicateWorkspace(id: string): Promise<WorkspaceDTO | null> {
  const userId = await uid();
  const o = await prisma.workspace.findFirst({ where: { id, userId } });
  if (!o) return null;
  return createWorkspace({
    name: `${o.name} (cópia)`, color: o.color,
    accountIds: o.accountIds, products: o.products, sources: o.sources,
  });
}

/**
 * Remove o agrupamento. **Nenhum dado é apagado** — só a área e o layout de
 * dashboard dela (que é configuração de tela, não dado de negócio).
 */
export async function deleteWorkspace(id: string): Promise<{ ok: boolean }> {
  const userId = await uid();
  const r = await prisma.workspace.deleteMany({ where: { id, userId } });
  return { ok: r.count > 0 };
}

/**
 * Quantas vendas cada produto configurado casou no período.
 *
 * Existe porque `Sale.product` é texto livre vindo do gateway: renomear o
 * produto lá faz o filtro parar de casar **em silêncio**. Zero vendas aqui é o
 * sinal de que o nome quebrou — melhor ver na tela de gerenciar do que
 * descobrir por um número estranho no dashboard.
 */
export async function checarProdutosDaArea(id: string, dias = 30): Promise<{ produto: string; vendas: number }[]> {
  const userId = await uid();
  const w = await prisma.workspace.findFirst({ where: { id, userId }, select: { products: true } });
  if (!w || w.products.length === 0) return [];
  const desde = new Date(Date.now() - dias * 864e5);
  const grupos = await prisma.sale.groupBy({
    by: ["product"],
    where: { userId, product: { in: w.products }, timestamp: { gte: desde } },
    _count: { _all: true },
  });
  const mapa = new Map(grupos.map((g) => [g.product, g._count._all]));
  return w.products.map((p) => ({ produto: p, vendas: mapa.get(p) ?? 0 }));
}

/**
 * Filtros base de uma área, para o servidor aplicar.
 *
 * Recebe o **id** e carrega os filtros aqui — o cliente nunca manda as listas.
 * Se mandasse, bastaria forjar a querystring para montar um escopo arbitrário;
 * e a validação de posse (`userId` no `where`) é o que impede ler área alheia.
 */
export async function filtrosDaArea(
  workspaceId: string | null | undefined,
): Promise<{ accounts?: string[]; products?: string[]; sources?: string[] }> {
  if (!workspaceId) return {};
  const userId = await uid();
  const w = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId },
    select: { accountIds: true, products: true, sources: true },
  });
  if (!w) return {}; // área inexistente ou de outro usuário: sem filtro
  return {
    ...(w.accountIds.length ? { accounts: w.accountIds } : {}),
    ...(w.products.length ? { products: w.products } : {}),
    ...(w.sources.length ? { sources: w.sources } : {}),
  };
}
