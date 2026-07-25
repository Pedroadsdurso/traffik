"use client";

import { sx } from "@/lib/sx";

export interface EtapaFunil {
  label: string;
  /** Rótulo curto para o cabeçalho (o longo não cabe em coluna estreita). */
  curto: string;
  value: number;
}

/** Gradiente por etapa: azul → roxo → rosa, como no funil de referência. */
const CORES = [
  ["#3b6ef5", "#4f7ffb"],
  ["#5b63f0", "#7b5fe6"],
  ["#8b5cf0", "#a855e8"],
  ["#a855e8", "#c4499f"],
  ["#d1478a", "#e0457a"],
];

const W = 1000;
const H = 260;
const EIXO = H / 2;

/**
 * Funil em "bulbos" (Bloco 5, refeito): cada etapa é uma faixa simétrica em
 * torno do eixo central cuja meia-altura é proporcional ao valor. As bordas são
 * curvas de Bézier, o que produz o estrangulamento suave entre etapas em vez de
 * trapézios com quinas.
 *
 * A altura é sempre relativa ao **maior** estágio: com o Facebook ainda não
 * sincronizado, "cliques" é 0 e um funil ancorado no primeiro estágio ficaria
 * invisível mesmo havendo vendas.
 */
export function Funnel({ etapas }: { etapas: EtapaFunil[] }) {
  const max = Math.max(0, ...etapas.map((e) => e.value));
  const n = etapas.length;

  if (n === 0 || max <= 0) {
    return (
      <div className="text-muted" style={sx("display:grid;place-items:center;flex:1;font-size:13px;min-height:120px")}>
        Sem tráfego no período — o funil aparece quando houver cliques ou vendas.
      </div>
    );
  }

  const col = W / n;
  // Meia-altura de cada etapa. O piso garante que uma etapa zerada continue
  // sendo uma linha visível, e não um buraco no desenho.
  const meia = etapas.map((e) => Math.max(1.5, (e.value / max) * (H / 2 - 26)));

  /** Faixa da etapa i: do meio da coluna anterior ao meio da próxima. */
  function faixa(i: number): string {
    const cx = col * i + col / 2;
    const x0 = i === 0 ? 0 : cx - col;
    const x1 = i === n - 1 ? W : cx + col;
    const h = meia[i]!;
    const hEsq = i === 0 ? Math.min(h, 2) : Math.max(1.5, (meia[i - 1]! + h) / 2) * 0.35;
    const hDir = i === n - 1 ? Math.min(h, 2) : Math.max(1.5, (meia[i + 1]! + h) / 2) * 0.35;
    const c = col * 0.42; // "força" da curva

    return [
      `M${x0} ${EIXO - hEsq}`,
      `C${x0 + c} ${EIXO - hEsq} ${cx - c} ${EIXO - h} ${cx} ${EIXO - h}`,
      `C${cx + c} ${EIXO - h} ${x1 - c} ${EIXO - hDir} ${x1} ${EIXO - hDir}`,
      `L${x1} ${EIXO + hDir}`,
      `C${x1 - c} ${EIXO + hDir} ${cx + c} ${EIXO + h} ${cx} ${EIXO + h}`,
      `C${cx - c} ${EIXO + h} ${x0 + c} ${EIXO + hEsq} ${x0} ${EIXO + hEsq}`,
      "Z",
    ].join(" ");
  }

  return (
    <div style={sx("display:flex;flex-direction:column;flex:1;min-height:200px;margin-top:var(--space-2)")}>
      {/* Cabeçalho: nome de cada etapa */}
      <div style={sx(`display:grid;grid-template-columns:repeat(${n},1fr);text-align:center`)}>
        {etapas.map((e) => (
          <div key={e.label} style={sx("font-size:12px;font-weight:600;padding-bottom:6px")} title={e.label}>
            {e.curto}
          </div>
        ))}
      </div>

      <div style={sx("position:relative;flex:1;min-height:130px")}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}
          role="img" aria-label="Funil de conversão">
          <defs>
            {etapas.map((_, i) => (
              <linearGradient key={i} id={`funil-g${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={CORES[i % CORES.length]![0]} />
                <stop offset="100%" stopColor={CORES[i % CORES.length]![1]} />
              </linearGradient>
            ))}
          </defs>

          {/* Divisórias entre etapas */}
          {etapas.slice(1).map((_, i) => (
            <line key={i} x1={col * (i + 1)} x2={col * (i + 1)} y1={0} y2={H}
              stroke="var(--color-divider)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}

          {etapas.map((e, i) => (
            <path key={e.label} d={faixa(i)} fill={`url(#funil-g${i})`}
              style={{ transition: "d 320ms cubic-bezier(0.22,0.61,0.36,1)" }}>
              <title>{`${e.label}: ${e.value}`}</title>
            </path>
          ))}
        </svg>

        {/* Percentuais sobre o eixo — em HTML, porque o SVG está esticado */}
        <div style={sx(`position:absolute;inset:0;display:grid;grid-template-columns:repeat(${n},1fr);align-items:center;text-align:center;pointer-events:none`)}>
          {etapas.map((e, i) => {
            const ant = i > 0 ? etapas[i - 1]!.value : null;
            const taxa = i === 0 ? null : ant && ant > 0 ? (e.value / ant) * 100 : 0;
            return (
              <span key={e.label} style={sx("font-size:15px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.5)")}>
                {taxa === null ? "—" : `${taxa.toFixed(1).replace(".", ",")}%`}
              </span>
            );
          })}
        </div>
      </div>

      {/* Valores absolutos */}
      <div style={sx(`display:grid;grid-template-columns:repeat(${n},1fr);text-align:center;padding-top:6px`)}>
        {etapas.map((e) => (
          <div key={e.label} style={sx("font-size:15px;font-variant-numeric:tabular-nums")}>{e.value}</div>
        ))}
      </div>
    </div>
  );
}
