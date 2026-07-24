"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Responsive, useContainerWidth, type Layout } from "react-grid-layout";

import {
  loadDashboardLayouts,
  resetDashboardLayout,
  saveDashboardLayout,
  type Viewport,
} from "@/lib/actions/dashboardLayout";
import { sx } from "@/lib/sx";
import {
  ALL_BLOCKS,
  BLOCK_BY_ID,
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_ROW_HEIGHT,
  defaultLayout,
  type GridItem,
} from "./blocks";
import { BlockContent } from "./BlockContent";
import type { TraffikView } from "./useTraffikState";

type Layouts = Record<Viewport, GridItem[]>;

const VIEWPORTS: Viewport[] = ["desktop", "mobile"];

function fallbackLayouts(): Layouts {
  return { desktop: defaultLayout("desktop"), mobile: defaultLayout("mobile") };
}

/** O react-grid-layout devolve `Layout` (com campos extras); guardamos só o que interessa. */
function toGridItems(layout: Layout): GridItem[] {
  return layout.map((l) => {
    const def = BLOCK_BY_ID.get(l.i);
    return {
      i: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
      minW: def?.minW,
      minH: def?.minH,
    };
  });
}

export function DashboardGrid({ v }: { v: TraffikView }) {
  const { width, containerRef } = useContainerWidth();

  const [layouts, setLayouts] = useState<Layouts>(fallbackLayouts);
  /** Snapshot tirado ao entrar em edição — é para onde o "Cancelar" volta. */
  const [snapshot, setSnapshot] = useState<Layouts | null>(null);
  const [editing, setEditing] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const carregado = useRef(false);

  // Carrega o layout salvo uma vez. Enquanto não chega, o padrão já está na tela
  // (nada de grid vazio piscando).
  useEffect(() => {
    loadDashboardLayouts()
      .then((saved) => {
        carregado.current = true;
        setLayouts({
          desktop: saved.desktop?.length ? saved.desktop : defaultLayout("desktop"),
          mobile: saved.mobile?.length ? saved.mobile : defaultLayout("mobile"),
        });
      })
      .catch(() => {
        carregado.current = true;
      });
  }, []);

  const visiveis = useMemo(() => new Set(layouts[viewport].map((l) => l.i)), [layouts, viewport]);
  const disponiveis = useMemo(() => ALL_BLOCKS.filter((b) => !visiveis.has(b.id)), [visiveis]);

  const onLayoutChange = useCallback(
    (current: Layout, all: Partial<Record<string, Layout>>) => {
      // Só grava mexidas do usuário; fora do modo de edição o RGL ainda dispara
      // este callback (compactação inicial), e aceitá-lo sujaria o estado.
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

  function entrarEdicao() {
    setSnapshot(layouts);
    setErro(null);
    setEditing(true);
  }

  function cancelar() {
    if (snapshot) setLayouts(snapshot);
    setSnapshot(null);
    setEditing(false);
  }

  async function salvar() {
    setBusy(true);
    setErro(null);
    try {
      // Salva os dois viewports: o usuário pode ter mexido em um e trocado de tela.
      await Promise.all(VIEWPORTS.map((vp) => saveDashboardLayout(vp, layouts[vp])));
      setSnapshot(null);
      setEditing(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o layout.");
    } finally {
      setBusy(false);
    }
  }

  async function redefinir() {
    setBusy(true);
    setErro(null);
    try {
      await Promise.all(VIEWPORTS.map((vp) => resetDashboardLayout(vp)));
      setLayouts(fallbackLayouts());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível redefinir.");
    } finally {
      setBusy(false);
    }
  }

  function adicionarBloco(id: string) {
    const def = BLOCK_BY_ID.get(id);
    if (!def) return;
    setLayouts((prev) => {
      const atual = prev[viewport];
      const cols = GRID_COLS[viewport];
      // Entra no fim: y grande + compactação vertical do RGL o encaixa embaixo.
      const y = atual.reduce((max, it) => Math.max(max, it.y + it.h), 0);
      const w = Math.min(def.w, cols);
      return { ...prev, [viewport]: [...atual, { i: id, x: 0, y, w, h: def.h, minW: def.minW, minH: def.minH }] };
    });
  }

  function removerBloco(id: string) {
    setLayouts((prev) => ({ ...prev, [viewport]: prev[viewport].filter((it) => it.i !== id) }));
  }

  const itens = layouts[viewport];

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      {/* Barra do modo de edição */}
      <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap")}>
        {editing ? (
          <>
            <div style={sx("display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap")}>
              <span className="tag tag-accent">Modo de edição</span>
              <span className="text-muted" style={sx("font-size:12px")}>
                Arraste pelo título, redimensione pelo canto inferior direito.
              </span>
            </div>
            <div style={sx("display:flex;gap:var(--space-2);flex-wrap:wrap")}>
              <button className="btn btn-ghost" type="button" onClick={redefinir} disabled={busy}>
                Redefinir configurações
              </button>
              <button className="btn btn-secondary" type="button" onClick={cancelar} disabled={busy}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={salvar} disabled={busy}>
                {busy ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </>
        ) : (
          <>
            <span />
            <button className="btn btn-secondary" type="button" onClick={entrarEdicao}>
              <svg viewBox="0 0 256 256" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round">
                <line x1="40" y1="80" x2="216" y2="80" />
                <circle cx="96" cy="80" r="18" fill="var(--color-surface)" />
                <line x1="40" y1="176" x2="216" y2="176" />
                <circle cx="168" cy="176" r="18" fill="var(--color-surface)" />
              </svg>
              Editar dashboard
            </button>
          </>
        )}
      </div>

      {erro && <p style={sx("margin:0;font-size:12.5px;color:var(--color-danger,#f87171)")}>{erro}</p>}

      <div style={sx(`display:grid;gap:var(--space-4);${editing ? "grid-template-columns:minmax(0,1fr) 260px" : "grid-template-columns:minmax(0,1fr)"}`)}>
        <div ref={containerRef} style={sx("min-width:0")}>
          {width > 0 && (
            <Responsive
              width={width}
              breakpoints={GRID_BREAKPOINTS}
              cols={GRID_COLS}
              layouts={{ desktop: layouts.desktop as Layout, mobile: layouts.mobile as Layout }}
              rowHeight={GRID_ROW_HEIGHT}
              margin={[16, 16]}
              containerPadding={[0, 0]}
              onLayoutChange={onLayoutChange}
              onBreakpointChange={(bp) => setViewport(bp as Viewport)}
              dragConfig={{ enabled: editing, handle: ".bloco-alca" }}
              resizeConfig={{ enabled: editing, handles: ["se"] }}
              className={editing ? "grid-editando" : undefined}
            >
              {itens.map((it) => {
                const def = BLOCK_BY_ID.get(it.i);
                return (
                  <div key={it.i} style={sx("overflow:hidden")}>
                    {editing && (
                      <div className="bloco-alca">
                        <span style={sx("overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{def?.label ?? it.i}</span>
                        <button
                          type="button"
                          className="bloco-remover"
                          onClick={() => removerBloco(it.i)}
                          aria-label={`Remover ${def?.label ?? it.i}`}
                          title="Remover do dashboard"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <div style={sx(`height:${editing ? "calc(100% - 26px)" : "100%"}`)}>
                      <BlockContent id={it.i} v={v} />
                    </div>
                  </div>
                );
              })}
            </Responsive>
          )}
        </div>

        {/* Painel lateral: blocos ainda não adicionados */}
        {editing && (
          <aside className="card" style={sx("align-self:start;position:sticky;top:var(--space-4);max-height:70vh;overflow:auto")}>
            <div className="card-kicker">Métricas disponíveis</div>
            <p className="card-body" style={sx("margin:0;font-size:12px")}>
              Clique para adicionar ao dashboard ({viewport === "desktop" ? "desktop" : "mobile"}).
            </p>
            {disponiveis.length === 0 ? (
              <p className="text-muted" style={sx("font-size:12px;margin:var(--space-2) 0 0")}>
                Todos os blocos já estão no dashboard.
              </p>
            ) : (
              <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:var(--space-2)")}>
                {disponiveis.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => adicionarBloco(b.id)}
                    style={sx("justify-content:space-between;font-size:12.5px;padding:6px 10px")}
                  >
                    <span style={sx("overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{b.label}</span>
                    <span aria-hidden style={sx("opacity:.6")}>+</span>
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
