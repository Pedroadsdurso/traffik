"use server";

import { auth } from "@/auth";
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

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

/* ⛔ `loadDashboardLayouts` e `saveDashboardLayout` foram DELETADAS em
   06/08/2026, junto de `components/dashboard/blocks.ts` e do
   `useDashboardLayout`. Elas falavam a língua do grid de 12 colunas
   (`{i,x,y,w,h}`, `sanitizeLayout`, viewport `mobile`), que deixou de existir
   quando o Dashboard virou três zonas.

   ⚠️ **A leitura do layout ANTIGO não se perdeu com elas** — quem migra o grid
   salvo é `layout/migrar.ts`, que recebe o Json cru de `loadLayoutZonas`. O que
   morreu foi o saneamento no dialeto antigo, não a compatibilidade. */

/** "Redefinir configurações": apaga o customizado e volta ao layout padrão. */
export async function resetDashboardLayout(viewport: Viewport, workspaceId?: string | null): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const wsId = await resolverArea(workspaceId);
  await prisma.dashboardLayout.deleteMany({ where: { userId, workspaceId: wsId, viewport } });
  return { ok: true };
}


/* ── LAYOUT v2 — as três zonas ──────────────────────────────────────────────
   ⚠️ Grava no MESMO `DashboardLayout.layout`, que é `Json`. O envelope leva
   `v: 3` (era `v: 2` até 07/08/2026, quando a largura por rótulo virou coluna
   de uma grade de 12) e a leitura decide: `v: 3` e `v: 2` são formas novas,
   sem marca é grid antigo e passa pela migração. Uma segunda tabela para o mesmo conceito daria dois
   lugares para o layout de um usuário morar, e o dia em que divergirem ninguém
   saberia qual vale.

   ⛔ A validação NÃO acontece aqui: ela vive em `migrarLayout`, na LEITURA. É de
   propósito — o payload pode chegar ao banco por outro caminho (edição manual,
   versão futura, restore de backup), e validar só na escrita deixaria a leitura
   confiando num contrato que ela não verificou. */
/**
 * Lê o layout de `desktop` **CRU**, sem saneamento nenhum.
 *
 * 🔴 ELE EXISTE PORQUE `loadDashboardLayouts` DESTRUÍA O QUE ACABAVA DE SER
 * SALVO. Aquela função passa o valor por `sanitizeLayout`, cuja primeira linha é
 * `if (!Array.isArray(raw)) return null` — o dialeto do grid antigo. O envelope
 * v2 é um OBJETO (`{ v: 2, hero, faixa, paineis }`), então voltava `null`, e
 * `migrarLayout(null)` devolvia o padrão.
 *
 * O modo de falha era mudo e do pior tipo: **salvar parecia funcionar** — a tela
 * fica com o estado editado, porque quem a desenha é o estado do cliente — e o
 * arranjo só sumia no recarregamento seguinte, longe do clique que o causou.
 *
 * ⛔ E NÃO É PARA "CONSERTAR" O `sanitizeLayout` PARA ACEITAR OBJETO. Ele fala a
 * língua do grid — `{i,x,y,w,h}`, `BLOCK_BY_ID`, `minW`/`minH` —, e ensiná-lo um
 * segundo formato daria duas validações do mesmo dado em dois vocabulários. Quem
 * valida o v2 é `migrarLayout`, na leitura, e está escrito lá por quê.
 *
 * ⏳ Esta função morre junto de `loadDashboardLayouts`, `saveDashboardLayout` e
 * `blocks.ts`, quando o último consumidor do grid antigo sair.
 */
export async function loadLayoutZonas(workspaceId?: string | null): Promise<unknown> {
  const userId = await requireUserId();
  const wsId = await resolverArea(workspaceId);
  const row = await prisma.dashboardLayout.findFirst({
    where: { userId, workspaceId: wsId, viewport: "desktop" },
    select: { layout: true },
  });
  return row?.layout ?? null;
}

export async function saveLayoutZonas(
  layout: { hero: string[]; faixa: string[]; paineis: { id: string; col: number; linhas?: number }[] },
  workspaceId?: string | null,
): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const wsId = await resolverArea(workspaceId);
  const payload = { v: 3, ...layout } as unknown as Prisma.InputJsonValue;

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
