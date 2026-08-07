"use client";

import * as React from "react";
import { calcularFluxo, caminhoFluxo, caminhoPerda } from "@/lib/funil/fita";

/**
 * FUNIL COMO FLUXO COM PERDAS EXPLÍCITAS — cliques → checkouts → vendas.
 *
 * ### 🔴 A FITA QUE SÓ AFINAVA ESCONDIA A PERGUNTA
 *
 * A versão anterior era uma fita única que estreitava de 1.220 para 27. Os 1.193
 * que sumiram **não estavam em lugar nenhum do desenho** — o estreitamento diz
 * QUE se perdeu, não diz quanto nem onde, e é isso que um funil existe para
 * responder.
 *
 * Aqui a massa se conserva da esquerda para a direita: **quem sai vira faixa
 * própria, rotulada**. A conta e a garantia moram em `lib/funil/fita.ts`, e a
 * conservação é verificada como PROPRIEDADE em `npm run test:fluxo`.
 *
 * ### 🔴 A COR NÃO SEGUE A REFERÊNCIA, E O MOTIVO É O DADO
 *
 * A referência 1 vai de verde a laranja. Aqui isso seria a cor mentindo: **a
 * ponta direita é a VENDA**, que é o objetivo — pintá-la de vermelho afirma que
 * chegar lá é ruim. A regra do projeto vale: verde é lucro, vermelho é prejuízo,
 * âmbar é atenção, e **etapa de funil não é nenhuma das três**.
 *
 * Então: fluxo que continua na cor de destaque; perda em **neutro a 25%**, com o
 * rótulo FORA da faixa. A perda não é um alarme — é o normal de um funil.
 *
 * ### 🔴 ESPESSURA FIEL
 *
 * Sem raiz quadrada, sem log. O porquê e o piso de 3px estão em `fita.ts`.
 */

const FAIXA = 132;
const MARGEM_X = 12;
const TOPO = 16;
/** Espaço abaixo da faixa para os rótulos das etapas. */
const RODAPE = 30;
const ALTURA_SVG = TOPO + FAIXA + RODAPE;

export interface EtapaEntradaFita {
  label: string;
  /** O valor cru. A fita mede com ele. */
  valor: number;
  /** Já formatado com separador de milhar — a tela não formata de novo. */
  valorFmt: string;
  /** Nome curto para o cabeçalho ("chegam ao checkout"). */
  acao: string;
  /**
   * O que aconteceu com quem NÃO passou desta etapa para a seguinte.
   * "saíram sem iniciar checkout", "abandonaram o checkout".
   *
   * ⚠️ Ele descreve a PERDA que sai DAQUI, não a etapa. Sem um texto próprio a
   * faixa viraria "1.185" sem dizer o que aconteceu com eles — e um número sem
   * verbo num funil é exatamente o que a fita antiga já fazia.
   */
  perdaLabel?: string;
}

export function FitaFunil({ etapas }: { etapas: EtapaEntradaFita[] }) {
  const [caixa, setCaixa] = React.useState<HTMLDivElement | null>(null);
  const [largura, setLargura] = React.useState(0);

  /* ⚠️ A largura é MEDIDA, não derivada de breakpoint: o mesmo bloco pode ter 4
     ou 12 colunas, e a espessura da fita é em px. Um `viewBox` que escalasse
     junto distorceria o texto dos rótulos. */
  React.useEffect(() => {
    if (!caixa) return;
    const ro = new ResizeObserver(([e]) => setLargura(e?.contentRect.width ?? 0));
    ro.observe(caixa);
    return () => ro.disconnect();
  }, [caixa]);

  const fluxo = React.useMemo(
    () => calcularFluxo(etapas.map((e) => e.valor), { largura, faixa: FAIXA, margem: MARGEM_X }),
    [etapas, largura],
  );

  if (etapas.length === 0) {
    return (
      <p className="text-caption text-text-muted" style={{ margin: 0 }}>
        Sem dados de funil no período.
      </p>
    );
  }

  const pct = (t: number | null) => (t === null ? "—" : `${(t * 100).toFixed(1).replace(".", ",")}%`);
  const xFim = Math.max(1, largura);

  return (
    <div ref={setCaixa} className="tk-fita" style={{ minWidth: 0 }}>
      {/* ── Cabeçalho: TRÊS NÚMEROS GRANDES lado a lado (`06` §9) ─────────────
          🔴 Era uma frase corrida ("1.220 cliques · 2,9% chegam ao checkout ·
          77,1% compram"). Frase se lê da esquerda para a direita, uma palavra
          por vez; três números lado a lado se leem de relance, que é o trabalho
          de um cabeçalho de bloco.

          É também a versão que SOBREVIVE ao container estreito: abaixo de
          ~360px o desenho some por container query e isto fica sozinho,
          empilhado. Mesma informação sem a forma — melhor que uma fita
          espremida, que não se lê e ainda ocupa espaço. */}
      <div className="tk-fita-cabecalho" style={{ display: "flex", flexWrap: "wrap", gap: 24, margin: "0 0 14px" }}>
        {etapas.map((e, i) => {
          const taxa = fluxo.etapas[i]?.taxa ?? null;
          return (
            <div key={e.label} style={{ minWidth: 0 }}>
              {/* 🎨 Os três números do cabeçalho (`06` §9) escalam em degraus com
                  a largura do bloco. Eles são a leitura rápida do funil — e no
                  mínimo do bloco são a ÚNICA coisa que sobra, porque abaixo de
                  360px úteis a fita some. */}
              <div
                className="text-metric-md"
                style={{ fontSize: "var(--tk-b-fita-num, 24px)", color: i === 0 ? "var(--tk-text)" : "var(--tk-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}
              >
                {/* A primeira etapa é o TOTAL e não tem taxa — mostrar "—" ali
                    prometeria uma comparação que não existe. Ela mostra o
                    número; as seguintes mostram a fração que sobreviveu. */}
                {i === 0 ? e.valorFmt : pct(taxa)}
              </div>
              <div className="text-caption text-text-muted" style={{ whiteSpace: "nowrap" }}>
                {i === 0 ? e.label : `${e.valorFmt} ${e.acao}`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="tk-fita-desenho" style={{ position: "relative" }}>
        {/* 🎨 A ALTURA DESENHADA escala (`--tk-b-fita`), o `viewBox` não muda.
            O SVG estica a geometria e o texto de dentro junto — e aqui isso é o
            certo, ao contrário dos gráficos com eixo: a fita não tem rótulo de
            valor dentro do desenho, só as duas pílulas de perda, que crescem na
            mesma proporção da faixa a que pertencem.

            ⚠️ `preserveAspectRatio` fica no padrão (`xMidYMid meet`), então a
            fita cresce sem distorcer. O `--tk-b-fita` é um TETO de altura, não
            um esticamento. */}
        <svg
          width="100%"
          height={`var(--tk-b-fita, ${ALTURA_SVG}px)`}
          viewBox={`0 0 ${xFim} ${ALTURA_SVG}`}
          role="img"
          aria-label={
            `Funil: ${etapas.map((e, i) => `${e.label} ${e.valorFmt}${fluxo.etapas[i]?.taxa != null ? ` (${pct(fluxo.etapas[i]!.taxa)})` : ""}`).join(", ")}` +
            (fluxo.perdas.length
              ? `. Perdas: ${fluxo.perdas.map((p) => `${p.valor.toLocaleString("pt-BR")} ${etapas[p.de]?.perdaLabel ?? "saíram"}`).join(", ")}`
              : "")
          }
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            {/* O fluxo escurece da entrada para a saída — e a rampa é ESTILO,
                não dado: ela não codifica nada que a posição em x já não diga.
                Neutro→marca e não o contrário porque uma fita que desbota para
                a direita se lê como "perdendo força", e a direita é onde a
                venda acontece. Quem mostra a perda é a ESPESSURA. */}
            <linearGradient id="tk-fluxo-rampa" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--tk-primary)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--tk-primary)" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* As guias primeiro: o fluxo passa POR CIMA delas. */}
          {fluxo.etapas.map((e, i) => (
            <line
              key={`guia-${etapas[i]!.label}`}
              x1={e.x} x2={e.x} y1={TOPO - 8} y2={TOPO + FAIXA + 8}
              stroke="var(--tk-border)" strokeWidth="1" strokeDasharray="3 4"
            />
          ))}

          {/* ⛔ AS PERDAS VÊM ANTES DO FLUXO no z-order. Elas encostam nele por
              uma borda comum; desenhadas por cima, o neutro a 25% lavaria o
              contorno do fluxo justamente onde ele é mais fino. */}
          {largura > 0 &&
            fluxo.perdas.map((p) => (
              <path
                key={`perda-${p.de}`}
                d={caminhoPerda(p, TOPO, xFim - MARGEM_X)}
                fill="var(--tk-text-muted)"
                fillOpacity="0.25"
              />
            ))}

          {largura > 0 && <path d={caminhoFluxo(fluxo.etapas, TOPO)} fill="url(#tk-fluxo-rampa)" />}
        </svg>

        {/* ── Rótulo de cada perda, FORA da faixa ──────────────────────────────
            🔴 Fora, e não dentro: a faixa mais fina tem 3px, e texto dentro dela
            é impossível. Dentro da mais grossa e fora da mais fina seria pior —
            duas convenções para a mesma coisa na mesma figura.

            Ancorado à DIREITA da faixa, na altura do meio dela. */}
        {fluxo.perdas.map((p) => {
          const meioY = TOPO + (p.topo + p.base) / 2;
          const cabeDentro = p.base - p.topo >= 26;
          return (
            <div
              key={`rot-perda-${p.de}`}
              className={cabeDentro ? "text-caption" : "text-caption bg-surface border border-border"}
              style={{
                position: "absolute",
                right: MARGEM_X + 6,
                top: meioY,
                transform: "translateY(-50%)",
                textAlign: "right",
                maxWidth: "62%",
                pointerEvents: "none",
                color: "var(--tk-text-secondary)",
                /* 🎨 O CHIP É FUNÇÃO, NÃO ESTILO — e é essa a razão de ele não
                   ser aplicado às duas faixas.

                   Ele existe porque **o rótulo cairia sobre o fluxo**: medido
                   na tela, a perda do checkout tem 3px e o texto centrado nela
                   ocupa o mesmo pixel do fio que passa logo acima. O chip tira
                   o rótulo do desenho sem tirá-lo do lugar, que é o que o `06`
                   §9 pede ("rótulo FORA da faixa").

                   ⛔ Na faixa de 126px não há colisão nenhuma — ali o chip
                   viraria uma caixa flutuando num vazio, decoração pura. E duas
                   convenções para a mesma coisa na mesma figura é pior que
                   nenhuma: o leitor procuraria o significado da diferença.

                   ⚠️ Logo, o limiar acompanha a ALTURA DO TEXTO (26px), não um
                   número escolhido por gosto. Se a tipografia crescer, ele
                   cresce junto — senão o chip some justo quando passa a ser
                   necessário. */
                ...(cabeDentro
                  ? null
                  : {
                      padding: "2px 8px",
                      borderRadius: "var(--tk-radius-pill)",
                      whiteSpace: "nowrap" as const,
                    }),
              }}
            >
              <strong className="text-text" style={{ fontVariantNumeric: "tabular-nums" }}>
                {p.valor.toLocaleString("pt-BR")}
              </strong>{" "}
              {etapas[p.de]?.perdaLabel ?? "saíram nesta etapa"}
            </div>
          );
        })}

        {/* Os rótulos das etapas, na base. */}
        {fluxo.etapas.map((e, i) => (
          <span
            key={`rot-${etapas[i]!.label}`}
            className="text-caption text-text-muted"
            style={{
              position: "absolute",
              left: e.x,
              top: TOPO + FAIXA + 14,
              transform: `translateX(${i === 0 ? "0" : i === fluxo.etapas.length - 1 ? "-100%" : "-50%"})`,
              whiteSpace: "nowrap",
            }}
          >
            {etapas[i]!.label}
          </span>
        ))}
      </div>
    </div>
  );
}
