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

/** O painel como o envelope v4 o guarda. */
export interface PainelSalvo {
  id: string;
  col: number;
  /** Altura em CÉLULAS de 96px. Ver `layout/migrar.ts`. */
  h?: number;
  /**
   * 🔴 O `linhas` de antes da F1, em unidade de 44px — **PRESERVADO DE PROPÓSITO**.
   *
   * ⛔ Este campo dizia "a unidade de 44px morreu" e era descartado na gravação.
   * Ele não pode ser: a conversão `linhas → h` é **irreversível** (`h` é o `max()`
   * com a medição F0b), a migração roda sozinha ao abrir o Dashboard, e a partir
   * de 12/08/2026 ela roda em PRODUÇÃO. Sem ele, uma conversão errada não tem de
   * onde ser desfeita — o layout do usuário vira o que a conta decidiu.
   *
   * ⚠️ Ele NÃO é lido para desenhar. Quem impede a reconversão é o `h` existir.
   */
  linhas?: number;
}

export type LayoutSalvo = { hero: string[]; faixa: string[]; paineis: PainelSalvo[] };

/** ⚠️ `v: 4` desde 12/08/2026 (F1). Era `v: 3` com altura em `linhas` de 44px. */
const VERSAO = 4;

export async function saveLayoutZonas(layout: LayoutSalvo, workspaceId?: string | null): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const wsId = await resolverArea(workspaceId);
  const payload = { v: VERSAO, ...layout } as unknown as Prisma.InputJsonValue;

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

/**
 * 🔴 A MIGRAÇÃO DE ALTURA — a TERCEIRA camada da guarda: a RESERVA.
 *
 * As duas primeiras são puras e moram em `layout/migrar.ts` (elegibilidade por
 * bloco, completude do layout). Esta é a única que precisa do banco, e ela
 * responde uma pergunta que só o banco pode responder: **eu sou quem grava?**
 *
 * ### Por que ela não é `saveLayoutZonas`
 *
 * O Salvar do usuário é um CLIQUE: ele quer sobrescrever, e sobrescrever é o
 * certo. Esta escrita não tem clique nenhum — ela acontece sozinha ao abrir o
 * Dashboard. Duas abas abertas ao mesmo tempo, ou um `StrictMode` rodando o
 * efeito duas vezes, disparariam duas migrações do MESMO layout; e se entre uma
 * e outra o usuário tiver salvo algo, a segunda migração escreveria por cima de
 * uma escolha que ela nem leu.
 *
 * ⛔ **A reserva é `updatedAt`, e não uma leitura seguida de escrita.** Ler,
 * checar e gravar em três passos é a corrida clássica: as duas instâncias leem
 * o mesmo estado antigo e as duas se acham autorizadas. O `updateMany` com o
 * `updatedAt` no `where` faz o **banco** decidir — quem chega depois recebe
 * `count: 0` e desiste, que é o padrão desta base ("quem decide o vencedor é o
 * BANCO, não o processo").
 *
 * ⚠️ E ela **NÃO cria linha**. Quem não tem layout salvo vê o padrão, que já
 * nasce com `h` — não há nada para migrar, e criar uma linha por conta própria
 * transformaria "nunca customizei" em "tenho um layout gravado".
 */
export async function migrarAlturaDoLayout(
  layout: LayoutSalvo,
  workspaceId?: string | null,
): Promise<{ migrado: boolean }> {
  const userId = await requireUserId();
  const wsId = await resolverArea(workspaceId);

  const row = await prisma.dashboardLayout.findFirst({
    where: { userId, workspaceId: wsId, viewport: "desktop" },
    select: { id: true, updatedAt: true, layout: true },
  });
  /* Sem linha salva não há migração — o usuário está no padrão. */
  if (!row) return { migrado: false };

  /* Alguém já migrou entre a leitura do cliente e agora. Desistir aqui é o
     barato; a próxima abertura lê o v4 e não tenta de novo. */
  const versao = (row.layout as { v?: unknown } | null)?.v;
  if (versao === VERSAO) return { migrado: false };

  const escrita = await prisma.dashboardLayout.updateMany({
    /* 🔑 A RESERVA. `updatedAt` é escalar e muda a cada escrita: se outra
       instância gravou depois da nossa leitura, o `where` não casa e `count` é
       0. Comparar o Json inteiro faria o mesmo e dependeria da ordem de chaves
       do jsonb — um escalar não tem essa dúvida. */
    where: { id: row.id, updatedAt: row.updatedAt },
    data: { layout: { v: VERSAO, ...layout } as unknown as Prisma.InputJsonValue },
  });

  return { migrado: escrita.count === 1 };
}
