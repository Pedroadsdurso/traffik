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
export async function loadDashboardLayouts(): Promise<DashboardLayoutsDTO> {
  const userId = await requireUserId();
  const rows = await prisma.dashboardLayout.findMany({ where: { userId } });

  const byViewport = new Map(rows.map((r) => [r.viewport, r.layout]));
  return {
    desktop: sanitizeLayout(byViewport.get("desktop")),
    mobile: sanitizeLayout(byViewport.get("mobile")),
  };
}

/** Salva o layout de um viewport. Chamado só no "Salvar" do modo de edição. */
export async function saveDashboardLayout(viewport: Viewport, layout: GridItem[]): Promise<{ ok: true }> {
  const userId = await requireUserId();
  // Nunca confia no que vem do cliente: passa pelo mesmo saneamento da leitura.
  // O cast é só para o Json do Prisma — `clean` já é um array de objetos planos.
  const clean = (sanitizeLayout(layout) ?? []) as unknown as Prisma.InputJsonValue;

  await prisma.dashboardLayout.upsert({
    where: { userId_viewport: { userId, viewport } },
    update: { layout: clean },
    create: { userId, viewport, layout: clean },
  });
  return { ok: true };
}

/** "Redefinir configurações": apaga o customizado e volta ao layout padrão. */
export async function resetDashboardLayout(viewport: Viewport): Promise<{ ok: true }> {
  const userId = await requireUserId();
  await prisma.dashboardLayout.deleteMany({ where: { userId, viewport } });
  return { ok: true };
}
