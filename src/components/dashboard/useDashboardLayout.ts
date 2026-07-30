"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Layout } from "react-grid-layout";

import {
  loadDashboardLayouts,
  resetDashboardLayout,
  saveDashboardLayout,
  type Viewport,
} from "@/lib/actions/dashboardLayout";
import { ALL_BLOCKS, BLOCK_BY_ID, GRID_COLS, defaultLayout, type GridItem } from "./blocks";

type Layouts = Record<Viewport, GridItem[]>;

const VIEWPORTS: Viewport[] = ["desktop", "mobile"];

function fallbackLayouts(): Layouts {
  return { desktop: defaultLayout("desktop"), mobile: defaultLayout("mobile") };
}

function toGridItems(layout: Layout): GridItem[] {
  return layout.map((l) => {
    const def = BLOCK_BY_ID.get(l.i);
    return { i: l.i, x: l.x, y: l.y, w: l.w, h: l.h, minW: def?.minW, minH: def?.minH };
  });
}

/**
 * Estado do grid do Dashboard, extraído do `DashboardGrid` no Bloco 3: o botão
 * "Editar dashboard" e os controles de Salvar/Cancelar/Redefinir passaram a
 * viver no container de filtros, então o estado precisa ficar acima dos dois.
 */
/**
 * Estado do grid do Dashboard, POR ÁREA DE TRABALHO.
 *
 * O `workspaceId` vem do contexto: cada área tem o seu arranjo de blocos, e
 * trocar de área recarrega o layout dela. Sem passar o id, o servidor cai na
 * área principal — o que faria toda área secundária editar o layout da
 * principal sem avisar.
 */
export function useDashboardLayout(workspaceId?: string | null) {
  const [layouts, setLayouts] = useState<Layouts>(fallbackLayouts);
  /** Snapshot tirado ao entrar em edição — é para onde o "Cancelar" volta. */
  const [snapshot, setSnapshot] = useState<Layouts | null>(null);
  const [editing, setEditing] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardLayouts(workspaceId)
      .then((saved) => {
        setLayouts({
          desktop: saved.desktop?.length ? saved.desktop : defaultLayout("desktop"),
          mobile: saved.mobile?.length ? saved.mobile : defaultLayout("mobile"),
        });
      })
      .catch(() => {
        /* mantém o padrão que já está na tela */
      });
    // Recarrega ao trocar de área: cada uma tem o seu arranjo de blocos.
  }, [workspaceId]);

  const visiveis = useMemo(() => new Set(layouts[viewport].map((l) => l.i)), [layouts, viewport]);
  const disponiveis = useMemo(() => ALL_BLOCKS.filter((b) => !visiveis.has(b.id)), [visiveis]);

  const onLayoutChange = useCallback(
    (current: Layout, all: Partial<Record<string, Layout>>) => {
      // Fora do modo de edição o RGL ainda dispara este callback (compactação
      // inicial); aceitá-lo sujaria o estado sem o usuário ter mexido em nada.
      if (!editing) return;
      setLayouts((prev) => {
        const next = { ...prev };
        for (const vp of VIEWPORTS) {
          const l = all[vp];
          if (l) next[vp] = toGridItems(l);
        }
        if (!all[viewport]) next[viewport] = toGridItems(current);
        return next;
      });
    },
    [editing, viewport],
  );

  const abrirEdicao = useCallback(() => {
    setSnapshot(layouts);
    setErro(null);
    setEditing(true);
  }, [layouts]);

  const cancelar = useCallback(() => {
    if (snapshot) setLayouts(snapshot);
    setSnapshot(null);
    setEditing(false);
  }, [snapshot]);

  /**
   * ### 🔴 `workspaceId` PRECISA estar nas dependências. Não remova.
   *
   * `salvar` e `redefinir` mandam o `workspaceId` para o servidor, e um
   * `useCallback` congela o valor do render em que foi criado. Sem o id nas
   * dependências, o callback continua carregando a área que estava ativa quando
   * o Dashboard montou — então **trocar de área e clicar aqui grava (ou apaga) o
   * layout da área ERRADA**.
   *
   * No `redefinir` era certeza: o array era `[]`, então ele nunca era recriado.
   * No `salvar` era uma corrida — `[layouts]` mascarava o problema porque o
   * efeito de carregamento troca `layouts` pouco depois da troca de área, mas a
   * janela entre a troca e a resposta do servidor ficava errada.
   *
   * ⚠️ Agrava o caso do `redefinir`: ele é destrutivo, imediato e **o "Cancelar"
   * não desfaz** — o layout da outra área ia embora de verdade.
   */
  const salvar = useCallback(async () => {
    setBusy(true);
    setErro(null);
    try {
      // Salva os dois viewports: o usuário pode ter mexido em um e trocado de tela.
      await Promise.all(VIEWPORTS.map((vp) => saveDashboardLayout(vp, layouts[vp], workspaceId)));
      setSnapshot(null);
      setEditing(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o layout.");
    } finally {
      setBusy(false);
    }
  }, [layouts, workspaceId]);

  const redefinir = useCallback(async () => {
    setBusy(true);
    setErro(null);
    try {
      await Promise.all(VIEWPORTS.map((vp) => resetDashboardLayout(vp, workspaceId)));
      setLayouts(fallbackLayouts());
      // O snapshot antigo não vale mais: "Cancelar" depois disso voltaria ao
      // layout que o usuário acabou de mandar apagar.
      setSnapshot(fallbackLayouts());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível redefinir.");
    } finally {
      setBusy(false);
    }
  }, [workspaceId]);

  const adicionarBloco = useCallback(
    (id: string) => {
      const def = BLOCK_BY_ID.get(id);
      if (!def) return;
      setLayouts((prev) => {
        const atual = prev[viewport];
        // Entra no fim: y grande + compactação vertical do RGL o encaixa embaixo.
        const y = atual.reduce((max, it) => Math.max(max, it.y + it.h), 0);
        const w = Math.min(def.w, GRID_COLS[viewport]);
        return { ...prev, [viewport]: [...atual, { i: id, x: 0, y, w, h: def.h, minW: def.minW, minH: def.minH }] };
      });
    },
    [viewport],
  );

  const removerBloco = useCallback(
    (id: string) => {
      setLayouts((prev) => ({ ...prev, [viewport]: prev[viewport].filter((it) => it.i !== id) }));
    },
    [viewport],
  );

  return {
    layouts,
    itens: layouts[viewport],
    disponiveis,
    viewport,
    setViewport,
    editing,
    busy,
    erro,
    onLayoutChange,
    abrirEdicao,
    cancelar,
    salvar,
    redefinir,
    adicionarBloco,
    removerBloco,
  };
}

export type DashboardLayoutState = ReturnType<typeof useDashboardLayout>;
