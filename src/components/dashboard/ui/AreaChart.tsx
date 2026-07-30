"use client";

import { useState } from "react";

import { brl0 } from "@/lib/format";
import { sx } from "@/lib/sx";
import { useTamanho } from "./useTamanho";

export interface SerieArea {
  labels: string[];
  revenue: number[];
  spend: number[];
}

/** Usado só até a primeira medida do container. */
const W_PADRAO = 640;
const H_PADRAO = 260;
const PAD = { top: 12, right: 14, bottom: 26, left: 56 };
/** Largura estimada de um rótulo do eixo X (`01/07`) + respiro. */
const LARGURA_ROTULO_X = 52;

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
 * ### ⛔ O `viewBox` acompanha o TAMANHO REAL. Não volte a esticar.
 *
 * Isto usava `viewBox="0 0 640 260"` + `preserveAspectRatio="none"`, o que
 * deforma o texto junto com a geometria: num bloco estreito "R$ 100" e "01/07"
 * ficavam **achatados**, e num bloco largo ficavam **esticados e enormes** — o
 * mesmo gráfico com duas tipografias erradas, dependendo do arraste do usuário.
 *
 * Hoje o `viewBox` é medido (`useTamanho`), então **1 unidade do SVG = 1 pixel**
 * e o texto sai sempre no mesmo corpo. De quebra, saber a largura real permite
 * decidir **quantos** rótulos cabem no eixo X em vez de chutar `n / 8`.
 *
 * ⚠️ Com o `viewBox` em pixels, `vectorEffect="non-scaling-stroke"` deixou de ser
 * necessário (não há mais escala), mas fica: é inofensivo e protege caso alguém
 * volte a mexer na proporção.
 */
export function AreaChart({ serie }: { serie: SerieArea }) {
  const [idx, setIdx] = useState<number | null>(null);
  const { ref, largura, altura } = useTamanho<HTMLDivElement>();

  const n = serie.labels.length;

  // Antes da primeira medida do ResizeObserver cai no padrão — nunca em 0, que
  // produziria plotW negativo e coordenadas NaN.
  const W = largura > 0 ? largura : W_PADRAO;
  const H = altura > 0 ? altura : H_PADRAO;

  const max = topoAgradavel(Math.max(1, ...serie.revenue, ...serie.spend));
  const plotW = Math.max(10, W - PAD.left - PAD.right);
  const plotH = Math.max(10, H - PAD.top - PAD.bottom);

  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const linha = (vals: number[]) => vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = (vals: number[]) =>
    `${PAD.left},${PAD.top + plotH} ${linha(vals)} ${PAD.left + plotW},${PAD.top + plotH}`;

  // 4 divisões no eixo Y — mais que isso polui num bloco pequeno.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: max * f, y: y(max * f) }));

  /**
   * Quantos rótulos cabem DE FATO, pela largura medida.
   *
   * ⚠️ Era `Math.ceil(n / 8)`: sempre ~8 rótulos, independente do tamanho. Num
   * bloco estreito eles se encostavam; num bloco largo sobrava espaço vazio
   * enquanto o texto ia esticado. Agora o passo é o menor que respeita a largura
   * mínima de um rótulo, e a primeira e a última datas sempre aparecem.
   */
  const cabem = Math.max(2, Math.floor(plotW / LARGURA_ROTULO_X));
  const passo = Math.max(1, Math.ceil((n - 1) / Math.max(1, cabem - 1)));

  return (
    <div ref={ref} style={sx("position:relative;flex:1;min-height:140px;display:flex;min-width:0")}>
      {n === 0 ? (
        <div className="text-muted" style={sx("font-size:13px;padding:var(--space-2) 0")}>Sem dados no período.</div>
      ) : (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "100%", display: "block" }}
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
            {/* 10,5px de verdade — antes era 9 numa escala que variava com o bloco. */}
            <text x={PAD.left - 8} y={t.y + 3.5} textAnchor="end"
              style={{ fontSize: 10.5, fill: "var(--color-neutral-500)", fontVariantNumeric: "tabular-nums" }}>
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

        {/* Eixo X — a ÚLTIMA data sempre aparece, e a âncora encosta nas pontas
            para o texto não vazar do bloco. */}
        {serie.labels.map((l, i) => {
          const ultimo = i === n - 1;
          if (i % passo !== 0 && !ultimo) return null;
          // Perto do fim, um rótulo do passo colado no último viraria borrão.
          if (!ultimo && n > 1 && (n - 1 - i) < passo * 0.6) return null;
          return (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : ultimo ? "end" : "middle"}
              style={{ fontSize: 10.5, fill: "var(--color-neutral-500)", fontVariantNumeric: "tabular-nums" }}
            >
              {l}
            </text>
          );
        })}

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
      )}

      {/* Tooltip em HTML: fica fora do SVG para acompanhar a tipografia do produto. */}
      {n > 0 && idx !== null && (
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
