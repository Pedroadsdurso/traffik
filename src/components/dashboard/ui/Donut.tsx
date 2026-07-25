"use client";

import { useState } from "react";

import { sx } from "@/lib/sx";

export interface Fatia {
  name: string;
  value: number;
  /** Texto pronto do valor absoluto (ex.: "R$ 1.238,70"). */
  label: string;
}

/** Paleta derivada dos tokens — mesma família roxa, variando luminosidade. */
const CORES = [
  "var(--color-accent)",
  "var(--color-accent-2-400)",
  "var(--color-accent-600)",
  "var(--color-accent-2-600)",
  "var(--color-accent-300)",
  "var(--color-neutral-500)",
];

/**
 * Donut com legenda lateral (Bloco 5). Desenhado com `stroke-dasharray` num
 * círculo em vez de `path` com arcos: menos matemática, e a transição de
 * `stroke-dashoffset` anima sozinha quando os dados mudam.
 */
export function Donut({ fatias, vazio }: { fatias: Fatia[]; vazio: string }) {
  const [ativa, setAtiva] = useState<number | null>(null);

  const total = fatias.reduce((a, f) => a + f.value, 0);
  if (total <= 0) {
    return <div className="text-muted" style={sx("font-size:13px;padding:var(--space-2) 0")}>{vazio}</div>;
  }

  const R = 60;
  const CIRC = 2 * Math.PI * R;
  let acumulado = 0;

  return (
    // `align-items:stretch` + `flex:1` no SVG: o donut cresce com o bloco em vez
    // de ficar um disco de 140px perdido num card alto (era o "raso e vazio").
    <div style={sx("display:flex;align-items:stretch;gap:var(--space-4);flex:1;min-height:0;margin-top:var(--space-2)")}>
      <svg viewBox="0 0 160 160" style={{ flex: "1 1 40%", minWidth: 120, maxWidth: 260, height: "100%", minHeight: 130 }}
        role="img" aria-label="Distribuição">
        {/* Trilho de fundo, para o donut ter forma mesmo com uma fatia só. */}
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--color-neutral-900)" strokeWidth={22} />
        {fatias.map((f, i) => {
          const frac = f.value / total;
          const dash = frac * CIRC;
          const offset = -acumulado * CIRC;
          acumulado += frac;
          const destaque = ativa === i;
          return (
            <circle
              key={f.name}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={CORES[i % CORES.length]}
              strokeWidth={destaque ? 28 : 22}
              strokeDasharray={`${dash} ${CIRC - dash}`}
              strokeDashoffset={offset}
              // -90° para começar no topo em vez de às 3 horas.
              transform="rotate(-90 80 80)"
              style={{ transition: "stroke-width 180ms, stroke-dasharray 320ms, stroke-dashoffset 320ms", cursor: "default" }}
              onMouseEnter={() => setAtiva(i)}
              onMouseLeave={() => setAtiva(null)}
            >
              <title>{`${f.name}: ${f.label} (${((frac * 100).toFixed(1)).replace(".", ",")}%)`}</title>
            </circle>
          );
        })}
        <text x="80" y="77" textAnchor="middle" style={{ fontSize: 19, fontWeight: 600, fill: "var(--color-text)" }}>
          {ativa !== null ? `${((fatias[ativa]!.value / total) * 100).toFixed(1).replace(".", ",")}%` : fatias.length}
        </text>
        <text x="80" y="95" textAnchor="middle" style={{ fontSize: 8.5, fill: "var(--color-neutral-500)" }}>
          {ativa !== null ? fatias[ativa]!.name.slice(0, 16) : fatias.length === 1 ? "item" : "itens"}
        </text>
      </svg>

      <div style={sx("display:flex;flex-direction:column;justify-content:center;gap:7px;flex:1 1 60%;min-width:150px;overflow:auto")}>
        {fatias.map((f, i) => {
          const pct = ((f.value / total) * 100).toFixed(1).replace(".", ",");
          return (
            <div
              key={f.name}
              onMouseEnter={() => setAtiva(i)}
              onMouseLeave={() => setAtiva(null)}
              style={sx(
                `display:flex;align-items:center;gap:8px;font-size:12.5px;padding:3px 6px;border-radius:var(--radius-sm);transition:background var(--dur-fast) var(--ease-out);${ativa === i ? "background:color-mix(in srgb, var(--color-text) 8%, transparent);" : ""}`,
              )}
            >
              <span style={sx(`width:9px;height:9px;border-radius:2px;flex:none;background:${CORES[i % CORES.length]}`)} />
              <span style={sx("flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{f.name}</span>
              <span style={sx("font-variant-numeric:tabular-nums;white-space:nowrap")}>{f.label}</span>
              <span className="text-muted" style={sx("font-variant-numeric:tabular-nums;white-space:nowrap;min-width:44px;text-align:right")}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
