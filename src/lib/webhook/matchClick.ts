import { prisma } from "@/lib/prisma";

export interface ClickMatch {
  clickId: string | null; // Click.id (cuid) para o FK, não o uuid público
  method: "direct" | "ip" | "none";
}

/** Janela de fallback por IP: cliques nas últimas 12h contam como origem. */
const IP_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Encontra o clique de origem de uma venda.
 *  1. Match direto pelo click_id público enviado no checkout.
 *  2. Fallback simples: clique mais recente do mesmo IP dentro da janela.
 */
export async function matchClick(
  userId: string,
  publicClickId: string | null,
  ip: string | null,
): Promise<ClickMatch> {
  if (publicClickId) {
    const click = await prisma.click.findFirst({
      where: { userId, clickId: publicClickId },
      select: { id: true },
    });
    if (click) return { clickId: click.id, method: "direct" };
  }

  if (ip) {
    const click = await prisma.click.findFirst({
      where: { userId, ip, timestamp: { gte: new Date(Date.now() - IP_WINDOW_MS) } },
      orderBy: { timestamp: "desc" },
      select: { id: true },
    });
    if (click) return { clickId: click.id, method: "ip" };
  }

  return { clickId: null, method: "none" };
}
