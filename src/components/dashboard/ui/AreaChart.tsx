"use client";

import { useState } from "react";

import { brl0 } from "@/lib/format";
import { sx } from "@/lib/sx";

export interface SerieArea {
  labels: string[];
  revenue: number[];
  spend: number[];
}

const W = 640;
const H = 260;
const PAD = { top: 12, right: 12, bottom: 26, left: 52 };

/** Escala "bonita": arredonda o topo para 1/2/5 × 10ⁿ, para o eixo Y ter números redondos. */
function topoAgradavel(max: number): number {
  if (max <= 0) return 10;
  const mag = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (max <= mag * m) return mag * m;
  }
  return mag * 10;
}

/**
 * Área com duas séries sobrepostas, eixos, grade e tooltip (Bloco 5).
 *
 * O gráfico antigo era um `polyline` sem eixo nenhum, comprimido no meio do
 * bloco. Aqui o `viewBox` ocupa 100% da largura e o eixo Y usa uma escala
 * arredondada para os rótulos serem legíveis.
 */
export function AreaChart({ serie }: { serie: SerieArea }) {
  const [idx, setIdx] = useState<number | null>(null);

  const n = serie.labels.length;
  if (n === 0) {
    return <div className="text-muted" style={sx("font-size:13px;padding:var(--space-2) 0")}>Sem dados no período.</div>;
  }

  const max = topoAgradavel(Math.max(1, ...serie.revenue, ...serie.spend));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const linha = (vals: number[]) => vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = (vals: number[]) =>
    `${PAD.left},${PAD.top + plotH} ${linha(vals)} ${PAD.left + plotW},${PAD.top + plotH}`;

  // 4 divisões no eixo Y — mais que isso polui num bloco pequeno.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: max * f, y: y(max * f) }));
  // Rótulos do eixo X ralos o suficiente para não se sobrepor.
  const passo = Math.max(1, Math.ceil(n / 8));

  return (
    <div style={sx("position:relative;flex:1;min-height:140px;display:flex")}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%" }}
        onMouseLeave={() => setIdx(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - PAD.left) / plotW) * (n - 1));
          setIdx(Math.min(n - 1, Math.max(0, i)));
        }}
      >
        {/* Grade + eixo Y */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y}
              stroke="var(--color-divider)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={PAD.left - 6} y={t.y + 3} textAnchor="end"
              style={{ fontSize: 9, fill: "var(--color-neutral-500)" }}>
              {brl0(t.v)}
            </text>
          </g>
        ))}

        {/* Séries: gasto atrás, faturamento na frente */}
        <polygon points={area(serie.spend)} fill="var(--color-neutral-700)" opacity={0.35} />
        <polygon points={area(serie.revenue)} fill="var(--color-accent-800)" opacity={0.45} />
        <polyline points={linha(serie.spend)} fill="none" stroke="var(--color-neutral-500)"
          strokeWidth={2} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <polyline points={linha(serie.revenue)} fill="none" stroke="var(--color-accent)"
          strokeWidth={2.5} vectorEffect="non-scaling-stroke" />

        {/* Eixo X */}
        {serie.labels.map((l, i) =>
          i % passo === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle"
              style={{ fontSize: 9, fill: "var(--color-neutral-500)" }}>
              {l}
            </text>
          ) : null,
        )}

        {/* Cursor do tooltip */}
        {idx !== null && (
          <g>
            <line x1={x(idx)} x2={x(idx)} y1={PAD.top} y2={PAD.top + plotH}
              stroke="var(--color-accent)" strokeWidth={1} opacity={0.5} vectorEffect="non-scaling-stroke" />
            <circle cx={x(idx)} cy={y(serie.revenue[idx] ?? 0)} r={4} fill="var(--color-accent)" />
            <circle cx={x(idx)} cy={y(serie.spend[idx] ?? 0)} r={3.5} fill="var(--color-neutral-400)" />
          </g>
        )}
      </svg>

      {/* Tooltip em HTML (texto em SVG esticado pelo preserveAspectRatio distorce). */}
      {idx !== null && (
        <div
          style={sx(
            `position:absolute;top:8px;${idx > n / 2 ? "left:8px" : "right:8px"};pointer-events:none;background:var(--color-surface);border:1px solid var(--color-divider);border-radius:var(--radius-sm);padding:6px 9px;font-size:11.5px;box-shadow:var(--shadow-md);white-space:nowrap`,
          )}
        >
          <div style={sx("opacity:.6;margin-bottom:3px")}>{serie.labels[idx]}</div>
          <div style={sx("display:flex;align-items:center;gap:6px")}>
            <span style={sx("width:7px;height:7px;border-radius:50%;background:var(--color-accent)")} />
            Faturamento: <strong>{brl0(serie.revenue[idx] ?? 0)}</strong>
          </div>
          <div style={sx("display:flex;align-items:center;gap:6px")}>
            <span style={sx("width:7px;height:7px;border-radius:50%;background:var(--color-neutral-500)")} />
            Gasto: <strong>{brl0(serie.spend[idx] ?? 0)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
