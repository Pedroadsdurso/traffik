"use client";

import * as React from "react";
import { brl0 } from "@/lib/format";
import { useTamanho } from "@/components/dashboard/ui/useTamanho";
import { LARGURA_EIXO, escalaArredondada, intervalosDoEixoY, passoDoRotuloX } from "@/lib/grafico/eixo";

/**
 * SerieTemporal — barras verticais para "quanto em cada momento".
 *
 * 🔴 ELE ABSORVE TRÊS BLOCOS: Vendas por dia, Vendas por horário e Lucro por
 * horário. A granularidade não é prop dele — quem monta os pontos já resolveu
 * isso —, e é por isso que os três couberam sem inchar a assinatura.
 *
 * ⛔ NÃO ABSORVEU o `LineChart` do Receita × Gasto, e a decisão é deliberada:
 * aquele tem DUAS séries, linha de break-even, seletor de granularidade e
 * tooltip por ponto. Fundir os dois exigiria umas seis props novas para atender
 * um caso que o outro não tem — e forçar abstração para ganhar um número é
 * exatamente como nascem componentes com dez props. **Dois componentes com
 * responsabilidades distintas são mais baratos que um com um `modo`.**
 *
 * ### O negativo é opcional, e isso não é detalhe
 *
 * Receita nunca é negativa; lucro é. Com `permitirNegativo` o eixo ganha uma
 * linha de zero e a barra cresce para baixo — sem ele, um lucro negativo seria
 * desenhado como barra positiva minúscula, que é o oposto do que aconteceu.
 */

export interface PontoSerieTemporal {
  rotulo: string;
  valor: number;
  /** Segundo número, só no tooltip. Ex.: a contagem de vendas do dia. */
  apoio?: number;
}

export function SerieTemporal({
  pontos,
  rotuloValor,
  rotuloApoio,
  permitirNegativo = false,
  formatar = brl0,
}: {
  pontos: PontoSerieTemporal[];
  rotuloValor: string;
  rotuloApoio?: string;
  permitirNegativo?: boolean;
  formatar?: (n: number) => string;
}) {
  /* ⛔ O hook vem ANTES do `return` de lista vazia: hook depois de saída
     condicional é a regra dos hooks quebrada, e o React reclama em runtime, não
     no `tsc`. */
  const { ref: plotRef, largura: cwPlot, altura: chPlot } = useTamanho<HTMLDivElement>();

  if (pontos.length === 0) {
    return (
      <p className="text-caption text-text-muted" style={{ margin: 0 }}>
        Nada para mostrar neste período.
      </p>
    );
  }

  const valores = pontos.map((p) => p.valor);
  const temNegativo = permitirNegativo && valores.some((v) => v < 0);
  /* 🔴 C3 — A ESCALA É ARREDONDADA E O EIXO SAI DELA. Antes, `max` era o maior
     valor cru: a barra mais alta encostava no teto e a régua sairia com
     `R$ 3.847` na ponta. `escalaArredondada` é a MESMA função do `LineChart`
     (`lib/grafico/eixo.ts`) — os dois gráficos arredondam igual por construção,
     não "parecido". */
  const escala = escalaArredondada(
    permitirNegativo ? Math.min(...valores, 0) : 0,
    Math.max(...valores, 0),
  );
  const max = escala.max;
  const min = escala.min;
  /* `|| 1` evita dividir por zero quando tudo é zero. Nesse caso toda barra fica
     no piso, que é a leitura certa: observamos, não houve movimento. */
  const amplitude = max - min || 1;
  const zeroPct = permitirNegativo ? ((max - 0) / amplitude) * 100 : 100;

  /* Aqui `ch` e a altura útil são a MESMA caixa: diferente do `LineChart`, o
     `SerieTemporal` não desenha dentro de um `viewBox` com padding — as barras
     ocupam a área medida inteira. Por isso os dois argumentos são `chPlot`. */
  const nY = intervalosDoEixoY(chPlot, chPlot, temNegativo);

  /* 🔴 C2 — o passo dos rótulos de x sai da LARGURA MEDIDA da plotagem, não de
     um "8 rótulos" fixo. Ver `passoDoRotuloX`: o que decide é quantas células
     um rótulo de 36px precisa para caber. */
  const passoX = passoDoRotuloX(cwPlot, pontos.length);

  return (
    <div className="tk-serie" style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%", minHeight: 0, overflow: "hidden" }}>
      {/* ⛔ `gap: 0` AQUI DE PROPÓSITO. A folga entre barras é 40% do PASSO
          (`06` §4), e ela é feita por dentro do slot — `left/right: 20%` na
          barra. Com `gap` no contêiner a folga seria fixa em pixels: com 7 dias
          as barras ficariam gordas e a folga sumiria, com 90 dias o contrário.
          A proporção só se mantém se a folga escalar junto com o passo. */}
      {/* 🔴 F3 — A ALTURA DA ÁREA DE BARRAS VEM DO SLOT.

          Era `height: var(--tk-b-barras, 120px)` — quatro degraus derivados da
          LARGURA (`cqw`). O comentário defendia o degrau com um argumento que
          continua correto sobre outra coisa: *"um valor intermediário muda a
          inclinação percebida sem que o dado tenha mudado"*. Isso vale para
          comparar DOIS MOMENTOS do mesmo gráfico — e a altura muda igual quando
          o degrau muda. O que ele não podia defender é a altura da PLOTAGEM ser
          decidida pela largura do bloco: medido, `vendas-por-dia`,
          `vendas-por-hora` e `lucro-por-hora` estouravam **+9px** cada a 2260.

          ⚠️ `--tk-b-barras` deixou de ter consumidor e saiu do `globals.css`. */}
      {/* 🔴 C3 — O EIXO Y. A gaveta de rótulos fica FORA da área de barras, senão
          o primeiro rótulo entraria no cálculo do passo e a barra 1 nasceria
          mais estreita que as outras. O `plotRef` mede a área DAS BARRAS, que é
          o que o §4 chama de `ch` — medir o cartão inteiro contaria título,
          rótulos de x e legenda, e o eixo sumiria cedo demais. */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 0 }}>
        {nY > 0 && (
          <div
            aria-hidden="true"
            style={{
              width: LARGURA_EIXO, flex: "none", position: "relative",
              /* ⚠️ `overflow: visible` — o rótulo do topo e o do piso ficam
                 CENTRADOS na própria linha de grade, então metade de cada um
                 sai da caixa por desenho. Cortá-los daria meia glifa. */
              overflow: "visible",
            }}
          >
            {Array.from({ length: nY + 1 }, (_, i) => {
              const v = max - ((max - min) * i) / nY;
              /* 🐛 OS EXTREMOS NÃO SÃO CENTRADOS, e isto veio do print.
                 Centrar todo rótulo na sua linha põe METADE do primeiro acima da
                 plotagem e metade do último abaixo — e o `.tk-serie` tem
                 `overflow: hidden`, então os dois saíam cortados ao meio. O
                 `overflow: visible` da gaveta não salva: quem clipa é o
                 ANCESTRAL, e um `visible` no filho não desfaz o `hidden` de cima.

                 ⚠️ É a mesma lição do `getBoundingClientRect` clipado — clip é
                 propriedade da CADEIA, não do elemento. */
              const alinhamento =
                i === 0 ? "translateY(0)" : i === nY ? "translateY(-100%)" : "translateY(-50%)";
              return (
                <span
                  key={i}
                  className="text-caption text-text-muted"
                  style={{
                    position: "absolute", right: 8, top: `${(i / nY) * 100}%`,
                    transform: alinhamento, whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatar(v)}
                </span>
              );
            })}
          </div>
        )}
        <div ref={plotRef} style={{ position: "relative", flex: 1, minWidth: 0, minHeight: 0, display: "flex", alignItems: "flex-end", gap: 0 }}>
        {permitirNegativo && (
          /* A linha de zero. Sem ela, uma barra para baixo não tem referência e
             o desenho não diz onde o lucro deixou de existir. */
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: 0, right: 0, top: `${zeroPct}%`, borderTop: "1px dashed var(--tk-border)" }}
          />
        )}
        {pontos.map((p, i) => {
          const negativo = p.valor < 0;
          const alturaPct = (Math.abs(p.valor) / amplitude) * 100;
          const titulo = [
            p.rotulo,
            `${rotuloValor}: ${formatar(p.valor)}`,
            p.apoio != null && rotuloApoio ? `${p.apoio} ${rotuloApoio}` : null,
          ]
            .filter(Boolean)
            .join("\n");

          return (
            <div
              key={i}
              title={titulo}
              aria-label={titulo}
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: permitirNegativo ? "flex-start" : "flex-end",
                position: "relative",
              }}
            >
              <div
                style={{
                  /* 🐛 ERA `relative` NO CASO POSITIVO, e isso é um bug de CSS,
                     não de estilo: em posicionamento RELATIVO o `right` é
                     ignorado quando o `left` está presente (em LTR), então
                     `left: 20%; right: 20%` virava um DESLOCAMENTO de 20% em vez
                     de uma inserção dos dois lados — a barra saía por fora do
                     próprio slot. Medido em 13/08/2026: 3px de fuga por barra,
                     em toda barra positiva, invisível porque o `.tk-serie` tem
                     `overflow: hidden` e engolia a sobra.

                     ⚠️ `absolute` nos DOIS casos torna as duas inserções
                     efetivas, e o `bottom` do positivo cai sozinho em `0%`
                     porque `zeroPct` é 100 quando não há negativo — um caminho
                     só, em vez de dois que precisam concordar. */
                  position: "absolute",
                  ...(permitirNegativo && negativo
                    ? { top: `${zeroPct}%` }
                    : { bottom: `${100 - zeroPct}%` }),
                  // 60% de barra, 40% de folga — 20% de cada lado do passo.
                  left: "20%",
                  right: "20%",
                  height: `${Math.max(alturaPct, p.valor === 0 ? 0 : 1.5)}%`,
                  /* Raio no TOPO, e na base quando a barra desce do zero (`06`
                     §4). O canto que encosta na linha de base fica vivo: barra
                     arredondada nos quatro cantos flutua, e uma série temporal
                     precisa parecer apoiada no eixo.
                     `borderRadius` com 6px maior que metade da altura degenera
                     sozinho no navegador, então a barra baixinha vira cápsula
                     sem precisar de conta — que é o "raio total se a barra for
                     fina" do mesmo parágrafo. */
                  borderRadius: negativo ? "0 0 6px 6px" : "6px 6px 0 0",
                  /* 🔴 Prejuízo em vermelho, e não é enfeite: numa série de
                     lucro a cor é o que faz o dia ruim saltar antes de a pessoa
                     ler o eixo. É a mesma regra do `corFinanceira` — só o
                     negativo ganha cor. */
                  background: negativo ? "var(--tk-danger)" : "var(--tk-primary)",
                }}
              />
            </div>
          );
        })}
        </div>
      </div>

      {/* ⚠️ A fileira de rótulos de x leva o MESMO recuo da gaveta do eixo. Sem
          ele os rótulos ficariam deslocados meia barra à esquerda das colunas
          que nomeiam — o tipo de desalinhamento que ninguém sabe nomear e todo
          mundo sente. */}
      <div style={{ display: "flex", gap: 2, paddingLeft: nY > 0 ? LARGURA_EIXO : 0 }}>
        {pontos.map((p, i) => (
          /* Rótulo a cada N pontos: 24 ou 30 rótulos de 11px lado a lado viram
             uma régua ilegível. Quem precisa do valor exato tem o tooltip. */
          <span
            key={i}
            className="text-caption text-text-muted"
            /* 🔴 C2 — `overflow: visible`, e ele é METADE do conserto.
               A célula mede `larguraPlot / n` (7px com 30 dias), e um rótulo de
               36px NUNCA caberia nela: cortar aqui era o `07-15` virando `07-1`
               na tela. Ele transborda para as vizinhas, que estão vazias por
               construção — quem garante isso é o `passoDoRotuloX`, a outra
               metade. As duas juntas ou nenhuma: só `visible` faria rótulo
               encostar em rótulo. */
            style={{ flex: 1, minWidth: 0, textAlign: "center", overflow: "visible", whiteSpace: "nowrap" }}
          >
            {i % passoX === 0 ? p.rotulo : ""}
          </span>
        ))}
      </div>

      <span className="text-caption text-text-muted">{rotuloValor}</span>
    </div>
  );
}
