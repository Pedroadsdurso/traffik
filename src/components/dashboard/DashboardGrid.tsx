"use client";

import { Responsive, useContainerWidth, type Layout } from "react-grid-layout";

import type { Viewport } from "@/lib/actions/dashboardLayout";
import { sx } from "@/lib/sx";
import { BLOCK_BY_ID, GRID_BREAKPOINTS, GRID_COLS, GRID_ROW_HEIGHT, viewportDoBreakpoint } from "./blocks";
import { BlockContent } from "./BlockContent";
import type { DashboardLayoutState } from "./useDashboardLayout";
import type { TraffikView } from "./useTraffikState";

/**
 * Renderiza o grid. O estado (layouts, modo de edição, salvar/cancelar) vem do
 * `useDashboardLayout`, que fica na `DashboardView` — os botões de edição moram
 * no container de filtros, acima daqui (Bloco 3).
 */
export function DashboardGrid({ v, grid }: { v: TraffikView; grid: DashboardLayoutState }) {
  const { width, containerRef } = useContainerWidth();
  const { editing, itens, disponiveis, viewport } = grid;

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
      {editing && (
        <span className="text-muted" style={sx("font-size:12px")}>
          Arraste pelo título, redimensione pelo canto inferior direito.
        </span>
      )}
      {grid.erro && <p style={sx("margin:0;font-size:12.5px;color:var(--color-danger,#f87171)")}>{grid.erro}</p>}

      <div style={sx(`display:grid;gap:var(--space-4);${editing ? "grid-template-columns:minmax(0,1fr) 260px" : "grid-template-columns:minmax(0,1fr)"}`)}>
        <div ref={containerRef} style={sx("min-width:0")}>
          {width > 0 && (
            <Responsive
              width={width}
              breakpoints={GRID_BREAKPOINTS}
              cols={GRID_COLS}
              layouts={{
                desktop: grid.layouts.desktop as Layout,
                laptop: grid.layouts.desktop as Layout,
                tablet: grid.layouts.mobile as Layout,
                mobile: grid.layouts.mobile as Layout,
              }}
              rowHeight={GRID_ROW_HEIGHT}
              margin={[16, 16]}
              containerPadding={[0, 0]}
              onLayoutChange={grid.onLayoutChange}
              onBreakpointChange={(bp) => grid.setViewport(viewportDoBreakpoint(bp))}
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
                          onClick={() => grid.removerBloco(it.i)}
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
                    onClick={() => grid.adicionarBloco(b.id)}
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
