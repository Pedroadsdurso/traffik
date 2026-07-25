"use client";

import { useRef, useState } from "react";

import { brl } from "@/lib/format";
import { PAIS, centroide } from "@/lib/countries";
import { sx } from "@/lib/sx";

export interface PaisVenda {
  code: string;
  sales: number;
  revenue: number;
}

/**
 * "Vendas por País" (Bloco 5), com alternância **Ranking | Mapa**.
 *
 * O roteiro sugeria `react-simple-maps`. Não adotei: ele exige carregar um
 * TopoJSON de mundo (~100 KB+) que, por padrão, vem de CDN — dependência de
 * rede em tempo de execução para um bloco secundário. Aqui a projeção
 * equirretangular é calculada na mão (lat/long → x/y é uma conta linear) sobre
 * uma grade de referência, com pan e zoom próprios. O custo é não ter as
 * fronteiras desenhadas; o ganho é zero dependência e zero fetch.
 */
export function CountryMap({ dados }: { dados: PaisVenda[] }) {
  const [modo, setModo] = useState<"ranking" | "mapa">("ranking");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const arrastando = useRef<{ x: number; y: number } | null>(null);
  const [ativo, setAtivo] = useState<string | null>(null);

  const maxVendas = Math.max(1, ...dados.map((d) => d.sales));
  const totalRev = dados.reduce((a, d) => a + d.revenue, 0);

  if (dados.length === 0) {
    return (
      <div className="text-muted" style={sx("font-size:13px;padding:var(--space-2) 0")}>
        Nenhuma venda com país identificado no período. O país vem do gateway ou do clique.
      </div>
    );
  }

  const W = 360;
  const H = 180; // proporção 2:1 da projeção equirretangular

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);flex:1")}>
      <div style={sx("display:flex;gap:4px")}>
        {(["ranking", "mapa"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={modo === m ? "btn btn-primary" : "btn btn-secondary"}
            style={sx("padding:3px 12px;font-size:12px")}
            onClick={() => setModo(m)}
          >
            {m === "ranking" ? "Ranking" : "Mapa"}
          </button>
        ))}
      </div>

      {modo === "ranking" ? (
        <div style={sx("display:flex;flex-direction:column;gap:6px;overflow:auto;flex:1")}>
          {dados.map((d) => {
            const pct = totalRev ? (d.revenue / totalRev) * 100 : 0;
            return (
              <div key={d.code} style={sx("display:flex;flex-direction:column;gap:3px")}>
                <div style={sx("display:flex;justify-content:space-between;font-size:12.5px;gap:8px")}>
                  <span>
                    {PAIS[d.code]?.nome ?? d.code} <span className="text-muted">· {d.sales} venda(s)</span>
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
          })}
        </div>
      ) : (
        <div style={sx("position:relative;flex:1;min-height:150px;overflow:hidden;border-radius:var(--radius-sm);background:var(--color-bg)")}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "100%", cursor: arrastando.current ? "grabbing" : "grab" }}
            onMouseDown={(e) => (arrastando.current = { x: e.clientX - pan.x, y: e.clientY - pan.y })}
            onMouseUp={() => (arrastando.current = null)}
            onMouseLeave={() => (arrastando.current = null)}
            onMouseMove={(e) => {
              if (!arrastando.current) return;
              setPan({ x: e.clientX - arrastando.current.x, y: e.clientY - arrastando.current.y });
            }}
            onWheel={(e) => setZoom((z) => Math.min(6, Math.max(1, z - e.deltaY * 0.002)))}
          >
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {/* Grade de referência: meridianos/paralelos a cada 30°. */}
              {Array.from({ length: 11 }, (_, i) => (
                <line key={`v${i}`} x1={(i * W) / 12} x2={(i * W) / 12} y1={0} y2={H}
                  stroke="var(--color-divider)" strokeWidth={0.3} />
              ))}
              {Array.from({ length: 5 }, (_, i) => (
                <line key={`h${i}`} x1={0} x2={W} y1={((i + 1) * H) / 6} y2={((i + 1) * H) / 6}
                  stroke="var(--color-divider)" strokeWidth={0.3} />
              ))}
              {/* Equador e Greenwich mais marcados, para dar referência. */}
              <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--color-divider)" strokeWidth={0.6} />
              <line x1={W / 2} x2={W / 2} y1={0} y2={H} stroke="var(--color-divider)" strokeWidth={0.6} />

              {dados.map((d) => {
                const c = centroide(d.code);
                if (!c) return null;
                // Equirretangular: long -180..180 → 0..W, lat 90..-90 → 0..H
                const x = ((c.lng + 180) / 360) * W;
                const y = ((90 - c.lat) / 180) * H;
                const r = 2 + (d.sales / maxVendas) * 6;
                const destaque = ativo === d.code;
                return (
                  <g key={d.code} onMouseEnter={() => setAtivo(d.code)} onMouseLeave={() => setAtivo(null)}>
                    {/* Halo = o "brilho" proporcional ao volume. */}
                    <circle cx={x} cy={y} r={r * 2.2} fill="var(--color-accent)" opacity={destaque ? 0.35 : 0.18} />
                    <circle cx={x} cy={y} r={r / zoom > 1 ? r : r} fill="var(--color-accent-300)" />
                    <title>{`${PAIS[d.code]?.nome ?? d.code}: ${d.sales} venda(s) · ${brl(d.revenue)}`}</title>
                  </g>
                );
              })}
            </g>
          </svg>

          <div style={sx("position:absolute;bottom:6px;right:6px;display:flex;gap:4px")}>
            <button type="button" className="btn btn-secondary" style={sx("padding:2px 8px;font-size:12px")}
              onClick={() => setZoom((z) => Math.min(6, z + 0.5))} aria-label="Aproximar">+</button>
            <button type="button" className="btn btn-secondary" style={sx("padding:2px 8px;font-size:12px")}
              onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Afastar">−</button>
            <button type="button" className="btn btn-secondary" style={sx("padding:2px 8px;font-size:11px")}
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</button>
          </div>

          {ativo && (
            <div style={sx("position:absolute;top:6px;left:6px;background:var(--color-surface);border:1px solid var(--color-divider);border-radius:var(--radius-sm);padding:5px 8px;font-size:11.5px;pointer-events:none")}>
              <strong>{PAIS[ativo]?.nome ?? ativo}</strong>
              <div className="text-muted">
                {dados.find((d) => d.code === ativo)?.sales} venda(s) · {brl(dados.find((d) => d.code === ativo)?.revenue ?? 0)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
