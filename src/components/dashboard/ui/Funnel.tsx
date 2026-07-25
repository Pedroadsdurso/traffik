"use client";

import { useRef, useState } from "react";

import { sx } from "@/lib/sx";
import { ChartEmpty, ChartTooltip, GRAD_FUNIL, useEntrada } from "./chartKit";

export interface EtapaFunil {
  label: string;
  /** Rótulo curto para o cabeçalho da coluna. */
  curto: string;
  value: number;
}

const W = 1000;
const H = 300;
const TOPO = 8;
const BASE = 8;

/**
 * Funil de conversão de verdade (3ª versão).
 *
 * A altura de cada segmento é **proporcional ao valor real** (`value / max`),
 * sem forçar decrescimento. Uma tentativa anterior clampava cada etapa ao mínimo
 * acumulado para garantir a forma de funil, mas isso quebrava no caso mais
 * comum: com o Facebook ainda não sincronizado, "cliques" é 0, o teto vira 0 e
 * o funil inteiro colapsava numa linha.
 *
 * Com dados reais e encadeados a forma afunila sozinha. Quando um estágio
 * posterior é maior (os ICs vêm do pixel e as vendas do gateway — fontes
 * independentes), o desenho engrossa ali, e isso é informação verdadeira: as
 * fontes não estão casando.
 */
export function Funnel({ etapas }: { etapas: EtapaFunil[] }) {
  const pronto = useEntrada();
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const n = etapas.length;
  const max = Math.max(0, ...etapas.map((e) => e.value));

  if (n === 0 || max <= 0) {
    return (
      <ChartEmpty
        titulo="Sem tráfego no período"
        dica="O funil aparece assim que houver cliques, visitas ou vendas na janela filtrada."
      />
    );
  }

  // Piso de 3% para uma etapa zerada continuar sendo um fio visível em vez de
  // um buraco no meio do desenho.
  const alturas = etapas.map((e) => Math.max(0.03, e.value / max));

  const col = W / n;
  const alturaUtil = H - TOPO - BASE;
  const meia = (f: number) => (f * alturaUtil) / 2;
  const eixo = H / 2;

  /** Segmento i: retângulo curvo do início ao fim da coluna. */
  function segmento(i: number): string {
    const x0 = col * i;
    const x1 = col * (i + 1);
    const hE = meia(alturas[i]!);
    // Conecta com a próxima altura por Bézier — nada de degrau reto.
    const hD = meia(i === n - 1 ? alturas[i]! * 0.82 : alturas[i + 1]!);
    const c = col * 0.5;
    return [
      `M${x0} ${eixo - hE}`,
      `C${x0 + c} ${eixo - hE} ${x1 - c} ${eixo - hD} ${x1} ${eixo - hD}`,
      `L${x1} ${eixo + hD}`,
      `C${x1 - c} ${eixo + hD} ${x0 + c} ${eixo + hE} ${x0} ${eixo + hE}`,
      "Z",
    ].join(" ");
  }

  return (
    <div ref={boxRef} style={sx("position:relative;display:flex;flex-direction:column;flex:1;min-height:220px;padding:var(--space-2) var(--space-1) 0")}>
      {/* Rótulos das etapas */}
      <div style={sx(`display:grid;grid-template-columns:repeat(${n},1fr);text-align:center;gap:4px`)}>
        {etapas.map((e) => (
          <div key={e.label} title={e.label}
            style={sx("font-size:11.5px;font-weight:600;color:color-mix(in srgb, var(--color-text) 82%, transparent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
            {e.curto}
          </div>
        ))}
      </div>

      <div style={sx("position:relative;flex:1;min-height:140px;margin-top:6px")}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", display: "block" }} role="img" aria-label="Funil de conversão">
          <defs>
            {/* `userSpaceOnUse` é essencial: no padrão (objectBoundingBox) cada
                segmento aplicaria o gradiente inteiro à própria caixa, e o funil
                sairia listrado em vez de com uma transição contínua. */}
            <linearGradient id="funil-grad" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={W} y2={0}>
              {GRAD_FUNIL.map((c, i) => (
                <stop key={i} offset={`${(i / (GRAD_FUNIL.length - 1)) * 100}%`} stopColor={c} />
              ))}
            </linearGradient>
            {/* Máscara animada: revela o funil da esquerda para a direita. */}
            <clipPath id="funil-reveal">
              <rect x="0" y="0" height={H} width={pronto ? W : 0}
                style={{ transition: "width 900ms cubic-bezier(0.22,0.61,0.36,1)" }} />
            </clipPath>
          </defs>

          <g clipPath="url(#funil-reveal)">
            {etapas.map((e, i) => (
              <path
                key={e.label}
                d={segmento(i)}
                fill="url(#funil-grad)"
                opacity={tip && tip.i !== i ? 0.45 : 1}
                style={{ transition: "opacity 200ms var(--ease-out), d 400ms var(--ease-out)", cursor: "pointer" }}
                onMouseEnter={(ev) => {
                  const b = boxRef.current?.getBoundingClientRect();
                  if (b) setTip({ x: ev.clientX - b.left, y: ev.clientY - b.top, i });
                }}
                onMouseLeave={() => setTip(null)}
              />
            ))}
          </g>

          {/* Divisórias entre etapas */}
          {etapas.slice(1).map((_, i) => (
            <line key={i} x1={col * (i + 1)} x2={col * (i + 1)} y1={0} y2={H}
              stroke="var(--color-divider)" strokeWidth={1} opacity={0.5} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        {/* Taxa de conversão no centro de cada segmento (HTML: o SVG está esticado) */}
        <div style={sx(`position:absolute;inset:0;display:grid;grid-template-columns:repeat(${n},1fr);align-items:center;text-align:center;pointer-events:none`)}>
          {etapas.map((e, i) => {
            const ant = i > 0 ? etapas[i - 1]!.value : null;
            const taxa = i === 0 ? null : ant && ant > 0 ? (e.value / ant) * 100 : 0;
            return (
              <span key={e.label}
                style={sx(`font-size:14px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.65);opacity:${pronto ? 1 : 0};transition:opacity 500ms 400ms var(--ease-out)`)}>
                {taxa === null ? "—" : `${taxa.toFixed(1).replace(".", ",")}%`}
              </span>
            );
          })}
        </div>
      </div>

      {/* Valores absolutos */}
      <div style={sx(`display:grid;grid-template-columns:repeat(${n},1fr);text-align:center;padding-top:8px;gap:4px`)}>
        {etapas.map((e) => (
          <div key={e.label}
            style={sx("font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;font-family:var(--font-heading)")}>
            {e.value.toLocaleString("pt-BR")}
          </div>
        ))}
      </div>

      {tip && (
        <ChartTooltip
          x={tip.x}
          y={tip.y}
          ancorarDireita={tip.x > (boxRef.current?.clientWidth ?? 0) * 0.6}
          titulo={etapas[tip.i]!.label}
          linhas={[
            { cor: GRAD_FUNIL[Math.min(tip.i, GRAD_FUNIL.length - 1)], label: "Total", valor: etapas[tip.i]!.value.toLocaleString("pt-BR") },
            ...(tip.i > 0
              ? [{
                  label: `vs. ${etapas[tip.i - 1]!.curto}`,
                  valor:
                    etapas[tip.i - 1]!.value > 0
                      ? `${((etapas[tip.i]!.value / etapas[tip.i - 1]!.value) * 100).toFixed(1).replace(".", ",")}%`
                      : "—",
                }]
              : []),
          ]}
        />
      )}
    </div>
  );
}
