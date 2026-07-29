"use server";

import { auth } from "@/auth";
import { sanitizeLayout, type GridItem } from "@/components/dashboard/blocks";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type Viewport = "desktop" | "mobile";

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
 * Layouts de uma Área de Trabalho. `workspaceId` nulo = "Todas as áreas", que é
 * onde os layouts que já existiam continuam morando — sem backfill.
 */
export async function loadDashboardLayouts(workspaceId?: string | null): Promise<DashboardLayoutsDTO> {
  const userId = await requireUserId();
  const rows = await prisma.dashboardLayout.findMany({ where: { userId, workspaceId: workspaceId ?? null } });

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
  // Nunca confia no que vem do cliente: passa pelo mesmo saneamento da leitura.
  // O cast é só para o Json do Prisma — `clean` já é um array de objetos planos.
  const clean = (sanitizeLayout(layout) ?? []) as unknown as Prisma.InputJsonValue;

  // `upsert` não serve aqui: o compound unique inclui `workspaceId`, e o
  // Prisma não aceita `null` numa chave única composta (embora o Postgres
  // aceite). Então é buscar-e-decidir.
  const existente = await prisma.dashboardLayout.findFirst({
    where: { userId, workspaceId: workspaceId ?? null, viewport },
    select: { id: true },
  });
  if (existente) {
    await prisma.dashboardLayout.update({ where: { id: existente.id }, data: { layout: clean } });
  } else {
    await prisma.dashboardLayout.create({
      data: { userId, workspaceId: workspaceId ?? null, viewport, layout: clean },
    });
  }
  return { ok: true };
}

/** "Redefinir configurações": apaga o customizado e volta ao layout padrão. */
export async function resetDashboardLayout(viewport: Viewport, workspaceId?: string | null): Promise<{ ok: true }> {
  const userId = await requireUserId();
  await prisma.dashboardLayout.deleteMany({ where: { userId, workspaceId: workspaceId ?? null, viewport } });
  return { ok: true };
}
