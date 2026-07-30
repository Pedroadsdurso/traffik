"use client";

import { useState } from "react";

import { sx } from "@/lib/sx";
import { ChartEmpty, ChartTooltip, GRAD_BARRA, useEntrada } from "./chartKit";
import { useTamanho } from "./useTamanho";

/** Largura mínima que um rótulo do eixo X precisa para não encostar no vizinho. */
const LARGURA_ROTULO = 42;

export interface BarraDado {
  /** Rótulo curto do eixo X (vazio esconde). */
  rotulo: string;
  valor: number;
  /** Título do tooltip (ex.: "14h00 – 15h00"). */
  titulo: string;
  /** Linhas extras do tooltip, além do valor principal. */
  detalhes: { label: string; valor: string }[];
}

/** Topo "redondo" para o eixo Y ter números legíveis. */
function topoAgradavel(max: number): number {
  if (max <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (max <= mag * m) return mag * m;
  }
  return mag * 10;
}

/**
 * Barras verticais com grade, eixos, animação de subida e tooltip detalhado.
 *
 * Barras **fantasma**: posições sem valor continuam desenhadas, bem apagadas.
 * Sem isso, um período com 1 venda virava uma barra solitária num campo vazio,
 * sem transmitir que o eixo é uma série temporal contínua.
 */
export function BarChart({
  dados,
  formatarEixo,
  vazio,
  dicaVazio,
}: {
  dados: BarraDado[];
  formatarEixo: (v: number) => string;
  vazio: string;
  dicaVazio?: string;
}) {
  const pronto = useEntrada();
  const [ativo, setAtivo] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  /**
   * ⚠️ DESTRUTURE o retorno de `useTamanho`. Guardar o objeto inteiro
   * (`const caixa = useTamanho()`) faz o `react-hooks/refs` tratar todo acesso a
   * `caixa.*` como leitura de ref durante o render e acusar erro — inclusive em
   * `caixa.largura`, que é estado comum.
   */
  /**
   * Um `useTamanho` serve às duas necessidades: `largura` é lida DURANTE o
   * render (para ancorar o tooltip) e `no` é o próprio elemento, para
   * `getBoundingClientRect()` dentro de evento.
   *
   * ⚠️ Não volte a ler `algumRef.current` no render: devolve o valor do frame
   * anterior e não redispara render quando muda.
   */
  const { ref: caixaRef, no: caixaNo, largura: larguraCaixa } = useTamanho<HTMLDivElement>();
  /** Largura da FAIXA DAS BARRAS (já sem o eixo Y), para ralear os rótulos. */
  const { ref: faixaRef, largura: larguraFaixa } = useTamanho<HTMLDivElement>();

  const max = Math.max(0, ...dados.map((d) => d.valor));

  const topo = topoAgradavel(max);
  const ticks = [1, 0.5, 0];
  // Com poucas colunas, barras largas demais ficam grotescas.
  const larguraMax = dados.length <= 3 ? 72 : dados.length <= 8 ? 56 : 999;

  /**
   * ⚠️ Rótulo a cada `passoRotulo` barras, calculado pela LARGURA MEDIDA.
   *
   * Antes todas as barras eram rotuladas, então "Vendas por dia" com 30 dias
   * empilhava 30 datas de 5 caracteres em qualquer largura — elas se encostavam
   * e viravam um borrão. Agora só entram os rótulos que caibam, e a **última**
   * barra sempre entra (é a data que o usuário procura primeiro).
   */
  const passoRotulo = (() => {
    if (larguraFaixa <= 0 || dados.length === 0) return 1;
    const cabem = Math.max(1, Math.floor(larguraFaixa / LARGURA_ROTULO));
    return Math.max(1, Math.ceil(dados.length / cabem));
  })();

  // ⚠️ O `return` do estado vazio vem DEPOIS dos hooks — sair antes deles
  // mudaria a quantidade de hooks entre renders e o React quebraria.
  if (dados.length === 0 || max <= 0) {
    return <ChartEmpty titulo={vazio} dica={dicaVazio} />;
  }

  return (
    <div ref={caixaRef} style={sx("position:relative;display:flex;flex-direction:column;flex:1;min-height:150px;padding:var(--space-2) 0 0")}>
      <div style={sx("display:flex;gap:8px;flex:1;min-height:110px")}>
        {/* Eixo Y */}
        <div style={sx("display:flex;flex-direction:column;justify-content:space-between;font-size:9.5px;color:var(--color-neutral-500);text-align:right;padding-bottom:18px;flex:none;min-width:34px")}>
          {ticks.map((f) => (
            <span key={f} style={sx("font-variant-numeric:tabular-nums")}>{formatarEixo(topo * f)}</span>
          ))}
        </div>

        <div ref={faixaRef} style={sx("position:relative;flex:1;min-width:0")}>
          {/* Grade */}
          {ticks.map((f) => (
            <div key={f} aria-hidden
              style={sx(`position:absolute;left:0;right:0;top:${(1 - f) * 100}%;bottom:auto;height:1px;background:var(--color-divider);opacity:.55;margin-bottom:18px;transform:translateY(-18px)`)} />
          ))}

          <div style={sx("position:absolute;inset:0 0 18px 0;display:flex;align-items:flex-end;justify-content:flex-start;gap:3px")}>
            {dados.map((d, i) => {
              const alturaPct = (d.valor / topo) * 100;
              const on = ativo === i;
              const vazia = d.valor <= 0;
              return (
                <div
                  key={i}
                  style={sx(`flex:1;min-width:0;max-width:${larguraMax}px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;position:relative;cursor:pointer`)}
                  onMouseEnter={(e) => {
                    setAtivo(i);
                    // Ler o ref num EVENTO é legítimo; o que o lint proíbe é ler no render.
                    const b = caixaNo?.getBoundingClientRect();
                    if (b) setTip({ x: e.clientX - b.left, y: e.clientY - b.top });
                  }}
                  onMouseLeave={() => { setAtivo(null); setTip(null); }}
                >
                  {/* Fantasma: dá contexto de série temporal sem fingir valor */}
                  <div aria-hidden
                    style={sx(`position:absolute;inset:0;border-radius:5px 5px 0 0;background:color-mix(in srgb, var(--color-text) ${on ? 6 : 3}%, transparent);transition:background var(--dur-fast) var(--ease-out)`)} />
                  <div
                    style={sx(
                      `position:relative;width:100%;border-radius:5px 5px 0 0;` +
                        `height:${pronto ? Math.max(vazia ? 0 : 2, alturaPct) : 0}%;` +
                        `background:linear-gradient(180deg, ${GRAD_BARRA[0]} 0%, ${GRAD_BARRA[1]} 100%);` +
                        `box-shadow:${on ? `0 0 16px color-mix(in srgb, ${GRAD_BARRA[0]} 60%, transparent)` : "none"};` +
                        `opacity:${on || ativo === null ? 1 : 0.5};` +
                        // Escalonar o delay dá o efeito de "onda" ao carregar.
                        `transition:height 520ms ${Math.min(i * 22, 320)}ms cubic-bezier(0.22,0.61,0.36,1), opacity 200ms var(--ease-out), box-shadow 200ms var(--ease-out)`,
                    )}
                  />
                  {d.rotulo && (i % passoRotulo === 0 || i === dados.length - 1) && (
                    /* `overflow:visible` + largura folgada: com 30 barras cada
                       coluna tem ~20px, e um rótulo de 5 caracteres cortado em
                       20px não se lê. Ele transborda para os vizinhos, que estão
                       sem rótulo justamente por isso. */
                    <span
                      style={sx(
                        "position:absolute;bottom:-17px;left:50%;transform:translateX(-50%);" +
                          "text-align:center;font-size:10px;color:var(--color-neutral-500);" +
                          "white-space:nowrap;font-variant-numeric:tabular-nums;pointer-events:none",
                      )}
                    >
                      {d.rotulo}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {tip && ativo !== null && (
        <ChartTooltip
          x={tip.x}
          y={tip.y}
          ancorarDireita={larguraCaixa > 0 && tip.x > larguraCaixa * 0.6}
          titulo={dados[ativo]!.titulo}
          linhas={dados[ativo]!.detalhes}
        />
      )}
    </div>
  );
}
