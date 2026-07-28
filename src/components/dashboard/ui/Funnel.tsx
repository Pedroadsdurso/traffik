"use client";

import { useRef, useState } from "react";

import { brl } from "@/lib/format";
import { calcularFunil, type EtapaEntrada } from "@/lib/funnel";
import { sx } from "@/lib/sx";
import { ChartEmpty, ChartTooltip, GRAD_FUNIL, useEntrada } from "./chartKit";

export type { EtapaEntrada as EtapaFunil };

const W = 1000;
const H = 260;
const TOPO = 8;
const BASE = 8;

/**
 * Funil de conversão **analítico** (4ª versão).
 *
 * ## Percentual: sobre a MAIOR etapa, não sobre a anterior
 *
 * O método antigo dividia cada etapa pela anterior, e por isso passava de 100%
 * sempre que uma etapa era maior que a precedente — "Visita na página" (220
 * visitas do nosso script) sobre "Cliques no anúncio" (98 cliques do Meta) dava
 * **224,49%**. Não era erro de conta: as duas contagens vêm de fontes
 * independentes e podem se cruzar de verdade.
 *
 * Agora cada etapa é exibida como **% da maior etapa do funil** (método da
 * Utmify): a maior fica em 100% e nada a ultrapassa por construção. A espessura
 * do segmento usa esse mesmo percentual, então o desenho e o número contam a
 * mesma história.
 *
 * ⚠️ A taxa vs. etapa anterior **não sumiu** — ela é a informação analítica de
 * verdade e continua no tooltip. Só deixou de ser o número em destaque.
 *
 * ## O que o funil aponta
 *
 * Além dos números, ele destaca o **gargalo**: a transição com a maior queda
 * percentual, marcada no desenho e resumida em texto no rodapé. Entre as etapas
 * aparece a perda ("−195 · 88,6%") sem precisar de hover.
 */
export function Funnel({ etapas, ticketMedio = 0 }: { etapas: EtapaEntrada[]; ticketMedio?: number }) {
  const pronto = useEntrada();
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const { etapas: calc, gargalo } = calcularFunil(etapas, ticketMedio);
  const n = calc.length;

  if (n === 0 || calc.every((e) => e.value === 0)) {
    return (
      <ChartEmpty
        titulo="Sem tráfego no período"
        dica="O funil aparece assim que houver cliques, visitas ou vendas na janela filtrada."
      />
    );
  }

  const col = W / n;
  const alturaUtil = H - TOPO - BASE;
  // Piso de 4,5% para uma etapa quase zerada continuar sendo um fio visível em
  // vez de um buraco no meio do desenho.
  const meia = (pct: number) => (Math.max(0.045, pct / 100) * alturaUtil) / 2;
  const eixo = H / 2;

  /** Segmento i: da espessura desta etapa até a da próxima, por Bézier. */
  function segmento(i: number): string {
    const x0 = col * i;
    const x1 = col * (i + 1);
    const hE = meia(calc[i]!.pct);
    const hD = meia(i === n - 1 ? calc[i]!.pct * 0.82 : calc[i + 1]!.pct);
    const c = col * 0.5;
    return [
      `M${x0} ${eixo - hE}`,
      `C${x0 + c} ${eixo - hE} ${x1 - c} ${eixo - hD} ${x1} ${eixo - hD}`,
      `L${x1} ${eixo + hD}`,
      `C${x1 - c} ${eixo + hD} ${x0 + c} ${eixo + hE} ${x0} ${eixo + hE}`,
      "Z",
    ].join(" ");
  }

  const pctFmt = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
  const num = (v: number) => v.toLocaleString("pt-BR");

  return (
    <div style={sx("display:flex;flex-direction:column;flex:1;min-height:230px")}>
      <div ref={boxRef} style={sx("position:relative;display:flex;flex-direction:column;flex:1;padding:var(--space-2) var(--space-1) 0")}>
        {/* Rótulos das etapas */}
        <div style={sx(`display:grid;grid-template-columns:repeat(${n},1fr);text-align:center;gap:4px`)}>
          {calc.map((e) => (
            <div key={e.label} title={e.label}
              style={sx("font-size:11.5px;font-weight:600;color:color-mix(in srgb, var(--color-text) 82%, transparent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
              {e.curto}
            </div>
          ))}
        </div>

        <div style={sx("position:relative;flex:1;min-height:130px;margin-top:6px")}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
            style={{ width: "100%", height: "100%", display: "block" }} role="img" aria-label="Funil de conversão">
            <defs>
              {/* `userSpaceOnUse` é essencial: no padrão (objectBoundingBox) cada
                  segmento aplicaria o gradiente inteiro à própria caixa, e o
                  funil sairia listrado em vez de contínuo. */}
              <linearGradient id="funil-grad" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={W} y2={0}>
                {GRAD_FUNIL.map((c, i) => (
                  <stop key={i} offset={`${(i / (GRAD_FUNIL.length - 1)) * 100}%`} stopColor={c} />
                ))}
              </linearGradient>
              <clipPath id="funil-reveal">
                <rect x="0" y="0" height={H} width={pronto ? W : 0}
                  style={{ transition: "width 900ms cubic-bezier(0.22,0.61,0.36,1)" }} />
              </clipPath>
            </defs>

            <g clipPath="url(#funil-reveal)">
              {calc.map((e, i) => (
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

            {/* Divisórias. A do gargalo fica em âmbar e mais forte. */}
            {calc.slice(1).map((_, i) => {
              const ehGargalo = gargalo?.indice === i;
              return (
                <line key={i} x1={col * (i + 1)} x2={col * (i + 1)} y1={0} y2={H}
                  stroke={ehGargalo ? "#f59e0b" : "var(--color-divider)"}
                  strokeWidth={ehGargalo ? 2 : 1}
                  strokeDasharray={ehGargalo ? "5 4" : undefined}
                  opacity={ehGargalo ? 0.9 : 0.5} vectorEffect="non-scaling-stroke" />
              );
            })}
          </svg>

          {/* Percentual (método Utmify) no centro de cada etapa */}
          <div style={sx(`position:absolute;inset:0;display:grid;grid-template-columns:repeat(${n},1fr);align-items:center;text-align:center;pointer-events:none`)}>
            {calc.map((e) => (
              <span key={e.label} style={sx("display:flex;justify-content:center")}>
                <span style={sx(`font-size:14px;font-weight:700;color:#fff;padding:2px 9px;border-radius:999px;background:rgba(10,12,24,.42);backdrop-filter:blur(2px);text-shadow:0 1px 3px rgba(0,0,0,.8);opacity:${pronto ? 1 : 0};transition:opacity 500ms 400ms var(--ease-out)`)}>
                  {pctFmt(e.pct)}
                </span>
              </span>
            ))}
          </div>

          {/* Perda ENTRE as etapas — visível sem hover. Fica no rodapé da
              divisória para não brigar com o percentual, que é centralizado. */}
          <div style={sx(`position:absolute;inset:0;pointer-events:none`)}>
            {calc.map((e, i) =>
              e.perdaPct !== null && e.perdaPct > 0 ? (
                <span key={e.label}
                  style={sx(`position:absolute;left:${((i + 1) / n) * 100}%;bottom:2px;transform:translateX(-50%);font-size:10.5px;font-weight:700;white-space:nowrap;padding:2px 7px;border-radius:999px;border:1px solid ${e.gargalo ? "#f59e0b" : "var(--color-border)"};background:${e.gargalo ? "rgba(120,53,15,.85)" : "rgba(10,12,24,.6)"};color:${e.gargalo ? "#fcd34d" : "var(--color-text-muted)"};opacity:${pronto ? 1 : 0};transition:opacity 500ms 600ms var(--ease-out)`)}>
                  −{num(e.perdaAbs!)} · {pctFmt(e.perdaPct)}
                </span>
              ) : null,
            )}
          </div>
        </div>

        {/* Valores absolutos */}
        <div style={sx(`display:grid;grid-template-columns:repeat(${n},1fr);text-align:center;padding-top:10px;gap:4px`)}>
          {calc.map((e) => (
            <div key={e.label}
              style={sx("font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;font-family:var(--font-heading)")}>
              {num(e.value)}
            </div>
          ))}
        </div>

        {tip && (
          <ChartTooltip
            x={tip.x}
            y={tip.y}
            ancorarDireita={tip.x > (boxRef.current?.clientWidth ?? 0) * 0.6}
            titulo={calc[tip.i]!.label}
            linhas={[
              { cor: GRAD_FUNIL[Math.min(tip.i, GRAD_FUNIL.length - 1)], label: "Total", valor: num(calc[tip.i]!.value) },
              { label: "% do maior estágio", valor: pctFmt(calc[tip.i]!.pct) },
              ...(calc[tip.i]!.fonte ? [{ label: "Origem", valor: calc[tip.i]!.fonte! }] : []),
              ...(calc[tip.i]!.taxaVsAnterior !== null
                ? [{ label: `Conversão vs. ${calc[tip.i - 1]!.curto}`, valor: pctFmt(calc[tip.i]!.taxaVsAnterior!) }]
                : []),
              ...(calc[tip.i]!.perdaAbs !== null && calc[tip.i]!.perdaPct! > 0
                ? [
                    {
                      label: `Perda até ${calc[tip.i + 1]!.curto}`,
                      valor: `${num(calc[tip.i]!.perdaAbs!)} (${pctFmt(calc[tip.i]!.perdaPct!)})`,
                    },
                  ]
                : []),
              ...(calc[tip.i]!.perdaValor !== null
                ? [{ label: "Faturamento na mesa", valor: brl(calc[tip.i]!.perdaValor!) }]
                : []),
            ]}
          />
        )}
      </div>

      {/* Resumo do gargalo, em linguagem direta */}
      {gargalo && (
        <div style={sx("display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 11px;border-radius:var(--radius-md);background:rgba(120,53,15,.22);border:1px solid rgba(245,158,11,.35)")}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#f59e0b" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
            <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
          <span style={sx("font-size:12.5px;line-height:1.45")}>
            <strong>Maior perda: entre {gargalo.de} e {gargalo.para}</strong> — {pctFmt(gargalo.perdaPct)} não
            avançaram ({num(gargalo.perdaAbs)} {gargalo.perdaAbs === 1 ? "pessoa" : "pessoas"})
            {calc[gargalo.indice]!.perdaValor !== null && (
              <> · ~{brl(calc[gargalo.indice]!.perdaValor!)} de faturamento estimado na mesa</>
            )}
            .
          </span>
        </div>
      )}
    </div>
  );
}
