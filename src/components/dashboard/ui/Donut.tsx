"use client";

import { useRef, useState } from "react";

import { sx } from "@/lib/sx";
import { ChartEmpty, ChartTooltip, PALETA, useEntrada } from "./chartKit";

export interface Fatia {
  name: string;
  value: number;
  /** Texto pronto do valor absoluto (ex.: "R$ 1.238,70"). */
  label: string;
}

const R = 62;
const ESPESSURA = 26;
const GAP_GRAUS = 2.5; // respiro entre fatias

/** Ponto na circunferência, com 0° no topo. */
function pt(cx: number, cy: number, r: number, graus: number): [number, number] {
  const rad = ((graus - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** Arco espesso com cantos arredondados, desenhado como um path fechado. */
function arco(cx: number, cy: number, rExt: number, rInt: number, ini: number, fim: number): string {
  const varre = fim - ini;
  if (varre <= 0) return "";
  const grande = varre > 180 ? 1 : 0;
  const [x1, y1] = pt(cx, cy, rExt, ini);
  const [x2, y2] = pt(cx, cy, rExt, fim);
  const [x3, y3] = pt(cx, cy, rInt, fim);
  const [x4, y4] = pt(cx, cy, rInt, ini);
  return [
    `M${x1} ${y1}`,
    `A${rExt} ${rExt} 0 ${grande} 1 ${x2} ${y2}`,
    `L${x3} ${y3}`,
    `A${rInt} ${rInt} 0 ${grande} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

export function Donut({
  fatias,
  vazio,
  totalLabel,
  unidade = "itens",
}: {
  fatias: Fatia[];
  vazio: string;
  /** Texto grande no centro (ex.: "R$ 1.528"). Sem ele mostra a contagem. */
  totalLabel?: string;
  unidade?: string;
}) {
  const pronto = useEntrada();
  const [ativa, setAtiva] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const total = fatias.reduce((a, f) => a + f.value, 0);
  if (total <= 0) {
    return <ChartEmpty titulo={vazio} dica="Assim que houver vendas no período, a distribuição aparece aqui." />;
  }

  const cx = 80;
  const cy = 80;
  let acumulado = 0;

  return (
    <div ref={boxRef}
      style={sx("position:relative;display:flex;align-items:center;gap:var(--space-4);flex:1;min-height:0;padding:var(--space-2) 0")}>
      <svg viewBox="0 0 160 160" style={{ flex: "0 1 42%", minWidth: 130, maxWidth: 220, height: "100%", minHeight: 150 }}
        role="img" aria-label="Distribuição">
        {/* Trilho: dá forma ao donut mesmo com uma fatia só */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--color-neutral-900)" strokeWidth={ESPESSURA} opacity={0.55} />

        {fatias.map((f, i) => {
          const frac = f.value / total;
          const ini = acumulado * 360;
          const fim = (acumulado + frac) * 360;
          acumulado += frac;
          const on = ativa === i;
          const meio = (ini + fim) / 2;
          // Fatia ativa cresce um pouco e "salta" para fora do centro.
          const desloc = on ? 4 : 0;
          const [dx, dy] = pt(0, 0, desloc, meio);
          const rExt = R + ESPESSURA / 2 + (on ? 3 : 0);
          const rInt = R - ESPESSURA / 2;
          // Só aplica gap se a fatia for grande o bastante para sobrar arco.
          const gap = fim - ini > GAP_GRAUS * 2 ? GAP_GRAUS / 2 : 0;

          return (
            <path
              key={f.name}
              d={arco(cx + dx, cy + dy, rExt, rInt, ini + gap, fim - gap)}
              fill={PALETA[i % PALETA.length]}
              opacity={ativa === null || on ? 1 : 0.32}
              strokeLinejoin="round"
              style={{
                transition: "opacity 250ms var(--ease-out), d 250ms var(--ease-out)",
                cursor: "pointer",
                transformOrigin: "center",
                transform: pronto ? "scale(1)" : "scale(0.85)",
              }}
              onMouseEnter={(e) => {
                setAtiva(i);
                const b = boxRef.current?.getBoundingClientRect();
                if (b) setTip({ x: e.clientX - b.left, y: e.clientY - b.top });
              }}
              onMouseLeave={() => { setAtiva(null); setTip(null); }}
            />
          );
        })}

        <text x={cx} y={ativa !== null ? cy - 2 : cy + 2} textAnchor="middle"
          style={{ fontSize: ativa !== null ? 17 : 19, fontWeight: 600, fill: "var(--color-text)" }}>
          {ativa !== null
            ? `${((fatias[ativa]!.value / total) * 100).toFixed(1).replace(".", ",")}%`
            : totalLabel ?? String(fatias.length)}
        </text>
        <text x={cx} y={ativa !== null ? cy + 14 : cy + 18} textAnchor="middle"
          style={{ fontSize: 8.5, fill: "var(--color-neutral-500)" }}>
          {ativa !== null ? fatias[ativa]!.name.slice(0, 18) : totalLabel ? "total" : unidade}
        </text>
      </svg>

      {/* Legenda em colunas alinhadas: nome | valor | % */}
      <div style={sx("display:flex;flex-direction:column;justify-content:center;gap:2px;flex:1 1 58%;min-width:0;overflow:auto")}>
        {fatias.map((f, i) => {
          const pct = ((f.value / total) * 100).toFixed(1).replace(".", ",");
          const on = ativa === i;
          return (
            <div
              key={f.name}
              onMouseEnter={() => setAtiva(i)}
              onMouseLeave={() => { setAtiva(null); setTip(null); }}
              style={sx(
                `display:grid;grid-template-columns:12px minmax(0,1fr) auto 52px;align-items:center;gap:9px;font-size:12.5px;padding:5px 7px;border-radius:var(--radius-sm);cursor:default;transition:background var(--dur-fast) var(--ease-out);${on ? "background:color-mix(in srgb, var(--color-text) 9%, transparent);" : ""}`,
              )}
            >
              <span style={sx(`width:9px;height:9px;border-radius:50%;background:${PALETA[i % PALETA.length]};transition:transform var(--dur-fast) var(--ease-out);transform:scale(${on ? 1.35 : 1})`)} />
              <span style={sx("overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{f.name}</span>
              <span style={sx("font-variant-numeric:tabular-nums;white-space:nowrap")}>{f.label}</span>
              <span className="text-muted" style={sx("font-variant-numeric:tabular-nums;text-align:right")}>{pct}%</span>
            </div>
          );
        })}
      </div>

      {tip && ativa !== null && (
        <ChartTooltip
          x={tip.x}
          y={tip.y}
          titulo={fatias[ativa]!.name}
          linhas={[
            { cor: PALETA[ativa % PALETA.length], label: "Valor", valor: fatias[ativa]!.label },
            { label: "Participação", valor: `${((fatias[ativa]!.value / total) * 100).toFixed(1).replace(".", ",")}%` },
          ]}
        />
      )}
    </div>
  );
}
