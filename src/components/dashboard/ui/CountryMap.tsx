"use client";

import { useRef, useState } from "react";

import { PAIS, nomePais } from "@/lib/countries";
import { brl } from "@/lib/format";
import { sx } from "@/lib/sx";
import { WORLD_PATH } from "@/lib/worldPaths";

export interface PaisVenda {
  code: string;
  sales: number;
  revenue: number;
}

const W = 360;
const H = 180; // proporção 2:1 da projeção equirretangular

/**
 * "Vendas por País" com alternância Ranking | **Mapa** (padrão).
 *
 * Os contornos vêm de `lib/worldPaths.ts`, **pré-computado em build** a partir
 * do world-atlas (ver `scripts/gen-world-paths.mjs`): o navegador não baixa
 * TopoJSON nem depende de CDN, e o app não ganhou dependência nova.
 * `react-simple-maps` foi descartado porque só suporta até React 18.
 */
export function CountryMap({ dados }: { dados: PaisVenda[] }) {
  const [modo, setModo] = useState<"mapa" | "ranking">("mapa");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const arrasto = useRef<{ x: number; y: number } | null>(null);
  const [ativo, setAtivo] = useState<string | null>(null);

  const maxVendas = Math.max(1, ...dados.map((d) => d.sales));
  const totalRev = dados.reduce((a, d) => a + d.revenue, 0);
  const semPais = dados.length === 0;
  const marcado = dados.find((d) => d.code === ativo);

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);flex:1;min-height:0")}>
      <div style={sx("display:flex;gap:4px;align-self:flex-end")}>
        {(["ranking", "mapa"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={modo === m ? "btn btn-primary" : "btn btn-ghost"}
            style={sx("padding:2px 10px;font-size:11.5px")}
            onClick={() => setModo(m)}
          >
            {m === "ranking" ? "Ranking" : "Mapa"}
          </button>
        ))}
      </div>

      {modo === "ranking" ? (
        <div style={sx("display:flex;flex-direction:column;gap:8px;overflow:auto;flex:1")}>
          {semPais ? (
            <div className="text-muted" style={sx("font-size:13px")}>Nenhuma venda com país identificado.</div>
          ) : (
            dados.map((d) => {
              const pct = totalRev ? (d.revenue / totalRev) * 100 : 0;
              return (
                <div key={d.code} style={sx("display:flex;flex-direction:column;gap:3px")}>
                  <div style={sx("display:flex;justify-content:space-between;font-size:12.5px;gap:8px")}>
                    <span>
                      {nomePais(d.code)} <span className="text-muted">· {d.sales} venda(s)</span>
                    </span>
                    <span style={sx("font-variant-numeric:tabular-nums;white-space:nowrap")}>
                      {brl(d.revenue)} · {pct.toFixed(1).replace(".", ",")}%
                    </span>
                  </div>
                  <div style={sx("height:6px;border-radius:3px;background:var(--color-neutral-800);overflow:hidden")}>
                    <div style={sx(`height:100%;background:var(--color-accent);width:${pct}%`)} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div style={sx("position:relative;flex:1;min-height:160px;overflow:hidden;border-radius:var(--radius-md);background:#0f1220")}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "100%", display: "block", cursor: arrasto.current ? "grabbing" : "grab" }}
            onMouseDown={(e) => (arrasto.current = { x: e.clientX - pan.x, y: e.clientY - pan.y })}
            onMouseUp={() => (arrasto.current = null)}
            onMouseLeave={() => (arrasto.current = null)}
            onMouseMove={(e) => {
              if (!arrasto.current) return;
              setPan({ x: e.clientX - arrasto.current.x, y: e.clientY - arrasto.current.y });
            }}
            onWheel={(e) => setZoom((z) => Math.min(8, Math.max(1, z - e.deltaY * 0.002)))}
          >
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {/* Continentes */}
              <path d={WORLD_PATH} fill="#2a3050" stroke="#3b4370" strokeWidth={0.2} vectorEffect="non-scaling-stroke" />

              {/* Marcadores: halo + núcleo, tamanho proporcional ao volume */}
              {dados.map((d) => {
                const p = PAIS[d.code];
                if (!p) return null;
                const x = ((p.lng + 180) / 360) * W;
                const y = ((90 - p.lat) / 180) * H;
                // Divide pelo zoom para o marcador não inchar ao aproximar.
                const r = (2 + (d.sales / maxVendas) * 4) / Math.sqrt(zoom);
                const on = ativo === d.code;
                return (
                  <g key={d.code} onMouseEnter={() => setAtivo(d.code)} onMouseLeave={() => setAtivo(null)}
                    style={{ cursor: "pointer" }}>
                    <circle cx={x} cy={y} r={r * 2.6} fill="var(--color-accent)" opacity={on ? 0.45 : 0.22}>
                      <animate attributeName="opacity" values={`${on ? 0.45 : 0.22};0.08;${on ? 0.45 : 0.22}`}
                        dur="2.4s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={x} cy={y} r={r} fill="#c9c2ff" stroke="#fff" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
                    <title>{`${nomePais(d.code)}: ${d.sales} venda(s) · ${brl(d.revenue)}`}</title>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Controles */}
          <div style={sx("position:absolute;bottom:6px;right:6px;display:flex;gap:4px")}>
            <button type="button" className="btn btn-secondary" style={sx("padding:1px 8px;font-size:13px")}
              onClick={() => setZoom((z) => Math.min(8, z + 0.6))} aria-label="Aproximar">+</button>
            <button type="button" className="btn btn-secondary" style={sx("padding:1px 8px;font-size:13px")}
              onClick={() => setZoom((z) => Math.max(1, z - 0.6))} aria-label="Afastar">−</button>
            <button type="button" className="btn btn-secondary" style={sx("padding:1px 8px;font-size:11px")}
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</button>
          </div>

          {/* Caixa de leitura: mostra o país sob o mouse, ou o total */}
          <div style={sx("position:absolute;top:6px;right:6px;background:color-mix(in srgb, var(--color-surface) 92%, transparent);border:1px solid var(--color-divider);border-radius:var(--radius-sm);padding:6px 10px;font-size:11.5px;pointer-events:none;min-width:120px")}>
            {marcado ? (
              <>
                <strong>{nomePais(marcado.code)}</strong>
                <div className="text-muted">{marcado.sales} venda(s) · {brl(marcado.revenue)}</div>
              </>
            ) : semPais ? (
              <>
                <strong>Sem país identificado</strong>
                <div className="text-muted">O país vem do gateway ou do clique.</div>
              </>
            ) : (
              <>
                <strong>{dados.length} paí{dados.length === 1 ? "s" : "ses"}</strong>
                <div className="text-muted">{brl(totalRev)} no período</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
