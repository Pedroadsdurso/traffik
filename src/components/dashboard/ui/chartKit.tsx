"use client";

import { useEffect, useState } from "react";

import { sx } from "@/lib/sx";

/**
 * Peças compartilhadas por todos os gráficos do Dashboard, para que tooltip,
 * estado vazio e paleta sejam **os mesmos** em toda parte — antes cada gráfico
 * inventava o seu.
 */

/** Paleta análoga dentro da identidade roxa: nada de cor aleatória gritante. */
export const PALETA = [
  "#8b7ff0",
  "#a78bfa",
  "#6d5fe0",
  "#c4b5fd",
  "#5b4fc7",
  "#d8cbff",
  "#4a3fa8",
];

/** Par (claro, escuro) para gradiente vertical das barras. */
export const GRAD_BARRA = ["#a78bfa", "#6d5fe0"] as const;

/** Escala do funil: azul → roxo → magenta, atravessando as 5 etapas. */
export const GRAD_FUNIL = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946a6"];

/**
 * Tooltip padrão: fundo escuro translúcido, borda sutil, sombra, cantos
 * arredondados. Posicionado em coordenadas do container (o pai precisa ser
 * `position:relative`).
 */
export function ChartTooltip({
  x,
  y,
  titulo,
  linhas,
  ancorarDireita,
}: {
  x: number;
  y: number;
  titulo: string;
  linhas: { cor?: string; label: string; valor: string }[];
  ancorarDireita?: boolean;
}) {
  return (
    <div
      role="tooltip"
      style={sx(
        `position:absolute;left:${x}px;top:${y}px;transform:translate(${ancorarDireita ? "-100%" : "0"}, -100%) translateY(-10px);pointer-events:none;z-index:5;` +
          "background:color-mix(in srgb, #12141f 88%, transparent);backdrop-filter:blur(8px);" +
          "border:1px solid color-mix(in srgb, var(--color-text) 14%, transparent);border-radius:10px;" +
          "padding:8px 11px;box-shadow:0 8px 24px rgba(0,0,0,.45);white-space:nowrap;font-size:11.5px;" +
          "animation:fade-in 120ms var(--ease-out) both",
      )}
    >
      <div style={sx("font-weight:600;margin-bottom:5px;font-size:12px")}>{titulo}</div>
      {linhas.map((l, i) => (
        <div key={i} style={sx("display:flex;align-items:center;gap:7px;line-height:1.7")}>
          {l.cor && <span style={sx(`width:7px;height:7px;border-radius:50%;flex:none;background:${l.cor}`)} />}
          <span className="text-muted">{l.label}</span>
          <strong style={sx("margin-left:auto;font-variant-numeric:tabular-nums")}>{l.valor}</strong>
        </div>
      ))}
    </div>
  );
}

/** Estado vazio: ícone discreto + frase útil, nunca um bloco cinza morto. */
export function ChartEmpty({ titulo, dica }: { titulo: string; dica?: string }) {
  return (
    <div style={sx("display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;flex:1;min-height:120px;padding:var(--space-4);text-align:center")}>
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth={1.4}
        strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.28 }} aria-hidden>
        <path d="M3 3v18h18" />
        <path d="M7 15l3.5-3.5 3 3L21 7" />
      </svg>
      <div style={sx("font-size:13px;opacity:.75")}>{titulo}</div>
      {dica && <div className="text-muted" style={sx("font-size:11.5px;max-width:280px;line-height:1.5")}>{dica}</div>}
    </div>
  );
}

/**
 * `false` no primeiro frame e `true` logo depois — é o gatilho das animações de
 * entrada (barra subindo, funil preenchendo). Sem isso o elemento já nasce no
 * estado final e não há transição para animar.
 */
export function useEntrada(delayMs = 40): boolean {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPronto(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return pronto;
}

/** Seta + cor para a comparação "vs. período anterior". */
export function Delta({ pct, invertido }: { pct: number | null; invertido?: boolean }) {
  if (pct === null || !isFinite(pct)) {
    return <span className="text-muted" style={sx("font-size:11.5px")}>vs. período anterior</span>;
  }
  const subiu = pct >= 0;
  // Em métricas de custo (CPA, gasto) subir é ruim — daí o `invertido`.
  const bom = invertido ? !subiu : subiu;
  const cor = bom ? "#4ade80" : "#f87171";
  return (
    <span style={sx(`display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:${cor}`)}>
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2.6}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden
        style={{ transform: subiu ? "none" : "rotate(180deg)" }}>
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      {Math.abs(pct).toFixed(1).replace(".", ",")}%
      <span className="text-muted">vs. anterior</span>
    </span>
  );
}

/** Sparkline: linha + área, sem eixos. Vive atrás/abaixo do número do KPI. */
export function Sparkline({ valores, cor = "var(--color-accent)" }: { valores: number[]; cor?: string }) {
  if (valores.length < 2) return null;
  const W = 100;
  const H = 28;
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const span = max - min || 1;
  const pt = (v: number, i: number) =>
    `${(i / (valores.length - 1)) * W},${H - ((v - min) / span) * (H - 3) - 1.5}`;
  const linha = valores.map(pt).join(" ");
  const id = `spark-${cor.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden
      style={{ width: "100%", height: 28, display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity={0.32} />
          <stop offset="100%" stopColor={cor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${linha} ${W},${H}`} fill={`url(#${id})`} />
      <polyline points={linha} fill="none" stroke={cor} strokeWidth={1.6}
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
