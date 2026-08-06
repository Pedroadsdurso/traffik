"use server";

import { auth } from "@/auth";
import { sanitizeLayout, type GridItem } from "@/components/dashboard/blocks";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { garantirAreaPrincipal } from "@/lib/actions/workspaces";

export type Viewport = "desktop" | "mobile";

/**
 * Resolve para uma área REAL. Nunca devolve `null`.
 *
 * O `workspaceId` chega do cliente e pode faltar (primeiro render) ou ser de
 * outro usuário. Sem esta resolução, um id ausente gravaria de novo o layout
 * "sem área" que acabamos de eliminar.
 */
async function resolverArea(workspaceId?: string | null): Promise<string> {
  const userId = await requireUserId();
  if (workspaceId) {
    const w = await prisma.workspace.findFirst({ where: { id: workspaceId, userId }, select: { id: true } });
    if (w) return w.id;
  }
  return (await garantirAreaPrincipal(userId)).id;
}

export interface DashboardLayoutsDTO {
  desktop: GridItem[] | null;
  mobile: GridItem[] | null;
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

/**
 * Carrega os layouts salvos. `null` num viewport significa "nunca customizou" —
 * o cliente cai no `defaultLayout` nesse caso, em vez de mostrar grid vazio.
 */
/**
 * Layouts de uma Área de Trabalho.
 *
 * ⛔ Não existe mais layout "de todas as áreas": o usuário está sempre dentro
 * de uma área, e um `workspaceId` ausente cai na PRINCIPAL. Os layouts que
 * moravam no `workspaceId` nulo foram migrados para a principal pela
 * `20260729120000_sem_visao_consolidada`.
 */
export async function loadDashboardLayouts(workspaceId?: string | null): Promise<DashboardLayoutsDTO> {
  const userId = await requireUserId();
  const wsId = await resolverArea(workspaceId);
  const rows = await prisma.dashboardLayout.findMany({ where: { userId, workspaceId: wsId } });

  const byViewport = new Map(rows.map((r) => [r.viewport, r.layout]));
  return {
    desktop: sanitizeLayout(byViewport.get("desktop")),
    mobile: sanitizeLayout(byViewport.get("mobile")),
  };
}

/** Salva o layout de um viewport. Chamado só no "Salvar" do modo de edição. */
export async function saveDashboardLayout(
  viewport: Viewport,
  layout: GridItem[],
  workspaceId?: string | null,
): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const wsId = await resolverArea(workspaceId);
  // Nunca confia no que vem do cliente: passa pelo mesmo saneamento da leitura.
  // O cast é só para o Json do Prisma — `clean` já é um array de objetos planos.
  const clean = (sanitizeLayout(layout) ?? []) as unknown as Prisma.InputJsonValue;

  // `upsert` não serve aqui: o compound unique inclui `workspaceId`, e o
  // Prisma não aceita `null` numa chave única composta (embora o Postgres
  // aceite). Então é buscar-e-decidir.
  const existente = await prisma.dashboardLayout.findFirst({
    where: { userId, workspaceId: wsId, viewport },
    select: { id: true },
  });
  if (existente) {
    await prisma.dashboardLayout.update({ where: { id: existente.id }, data: { layout: clean } });
  } else {
    await prisma.dashboardLayout.create({
      data: { userId, workspaceId: wsId, viewport, layout: clean },
    });
  }
  return { ok: true };
}

/** "Redefinir configurações": apaga o customizado e volta ao layout padrão. */
export async function resetDashboardLayout(viewport: Viewport, workspaceId?: string | null): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const wsId = await resolverArea(workspaceId);
  await prisma.dashboardLayout.deleteMany({ where: { userId, workspaceId: wsId, viewport } });
  return { ok: true };
}


/* ── LAYOUT v2 — as três zonas ──────────────────────────────────────────────
   ⚠️ Grava no MESMO `DashboardLayout.layout`, que é `Json`. O envelope leva
   `v: 2` e a leitura decide: com a marca é forma nova, sem ela é grid antigo e
   passa pela migração. Uma segunda tabela para o mesmo conceito daria dois
   lugares para o layout de um usuário morar, e o dia em que divergirem ninguém
   saberia qual vale.

   ⛔ A validação NÃO acontece aqui: ela vive em `migrarLayout`, na LEITURA. É de
   propósito — o payload pode chegar ao banco por outro caminho (edição manual,
   versão futura, restore de backup), e validar só na escrita deixaria a leitura
   confiando num contrato que ela não verificou. */
export async function saveLayoutZonas(
  layout: { hero: string[]; faixa: string[]; paineis: { id: string; largura: string }[] },
  workspaceId?: string | null,
): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const wsId = await resolverArea(workspaceId);
  const payload = { v: 2, ...layout } as unknown as Prisma.InputJsonValue;

  const existente = await prisma.dashboardLayout.findFirst({
    where: { userId, workspaceId: wsId, viewport: "desktop" },
    select: { id: true },
  });
  if (existente) {
    await prisma.dashboardLayout.update({ where: { id: existente.id }, data: { layout: payload } });
  } else {
    await prisma.dashboardLayout.create({
      data: { userId, workspaceId: wsId, viewport: "desktop", layout: payload },
    });
  }
  return { ok: true };
}
