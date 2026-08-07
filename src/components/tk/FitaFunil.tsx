"use client";

import * as React from "react";
import { calcularFluxo, caminhoDaFita } from "@/lib/funil/fita";

/**
 * FUNIL DE CONVERSÃO — só a fita, e a perda em número.
 *
 * Referência literal: `docs/design/referencias/16-funil-referencia.png`.
 *
 * ### 🔴 A PERDA NÃO É DESENHADA — o fundo é FUNDO, não quantidade
 *
 * Cinco versões desenharam a perda como faixa cinza colada no fluxo. Com 97% de
 * queda isso pinta 97% do bloco de cinza e deixa o fluxo como um fio dentro da
 * massa — a figura fica pesada, e a ausência vira o sujeito visual. A
 * referência não tem uma única faixa de perda: ela respira porque só a fita
 * existe.
 *
 * A perda mora na **pílula da guia** (`−1.185 · 97,1%`), com precisão total.
 *
 * ### Os elementos, e onde cada um mora
 *
 * | | |
 * |---|---|
 * | nome da etapa | acima, pequeno, no centro da etapa |
 * | pílula de taxa | SOBRE a fita, centrada — o elemento mais visível |
 * | pílula de perda | ABAIXO da fita, ancorada na GUIA da transição |
 * | número absoluto | embaixo, grande e em negrito |
 * | guia vertical | ENTRE as etapas, não sobre elas |
 *
 * ⚠️ **As guias ficam entre as etapas.** Conferido na referência: guias em
 * x≈270/530/790/1048 e centros em ≈140/400/660/920/1180. Pôr a guia sobre a
 * etapa faria a pílula de perda apontar para uma etapa em vez de para a
 * transição — e perda é o que acontece ENTRE duas.
 *
 * ### 🔴 A COR NÃO SEGUE A REFERÊNCIA NA PONTA
 *
 * A referência vai de azul a ROSA. Aqui o rosa está perto demais do vermelho de
 * prejuízo, e a ponta direita é a VENDA — o objetivo. Pintar de quase-vermelho
 * afirmaria que chegar lá é ruim. A rampa vai do azul de marca a um violeta
 * mais claro da mesma família, e nunca encosta em verde nem em vermelho.
 *
 * ⚠️ Isto é um gradiente ao longo do COMPRIMENTO, e ele não codifica grandeza
 * nenhuma — codifica percurso, que é o que a figura é. Foi um gradiente de
 * OPACIDADE que quebrou a versão anterior, porque opacidade lê como
 * intensidade e ela subia enquanto a massa descia. Matiz ao longo de x não tem
 * esse problema: ninguém lê "mais violeta" como "mais quantidade".
 */

const MARGEM_X = 12;
/** Espaço acima da fita, para os nomes das etapas. */
const TOPO = 26;
/** Espaço abaixo da fita, para a pílula de perda e o número absoluto. */
const RODAPE = 58;
/** Piso da altura da FAIXA (a fita em si), sem o topo e o rodapé. */
const FAIXA_MIN = 150;

export interface EtapaEntradaFita {
  label: string;
  /** O valor cru. A fita mede com ele. */
  valor: number;
  /** Já formatado com separador de milhar — a tela não formata de novo. */
  valorFmt: string;
  /** Nome curto para a versão compacta ("chegam ao checkout"). */
  acao: string;
}

const pct1 = (t: number) => `${(t * 100).toFixed(1).replace(".", ",")}%`;

export function FitaFunil({ etapas }: { etapas: EtapaEntradaFita[] }) {
  const [caixa, setCaixa] = React.useState<HTMLDivElement | null>(null);
  const [desenho, setDesenho] = React.useState<HTMLDivElement | null>(null);
  const [largura, setLargura] = React.useState(0);
  const [alturaDisp, setAlturaDisp] = React.useState(0);

  /* ⚠️ A largura é MEDIDA, não derivada de breakpoint: o mesmo bloco pode ter 4
     ou 12 colunas, e a espessura da fita é em px. */
  React.useEffect(() => {
    if (!caixa) return;
    const ro = new ResizeObserver(([e]) => setLargura(e?.contentRect.width ?? 0));
    ro.observe(caixa);
    return () => ro.disconnect();
  }, [caixa]);

  /* 🔴 A ALTURA TAMBÉM É MEDIDA. A altura de um card não vem de container query
     nenhuma: ela vem do irmão mais alto da linha da grade, e não existe consulta
     sobre a altura de um irmão. Sem medir, um card esticado pelo vizinho deixa
     ar embaixo — e na referência a fita ocupa quase tudo. */
  React.useEffect(() => {
    if (!desenho) return;
    const ro = new ResizeObserver(([e]) => setAlturaDisp(e?.contentRect.height ?? 0));
    ro.observe(desenho);
    return () => ro.disconnect();
  }, [desenho]);

  const faixaAlt = Math.max(FAIXA_MIN, Math.round(alturaDisp) - TOPO - RODAPE);
  const alturaSvg = TOPO + faixaAlt + RODAPE;
  const centroY = TOPO + faixaAlt / 2;

  const fluxo = React.useMemo(
    () => calcularFluxo(etapas.map((e) => e.valor), { largura, faixa: faixaAlt, margem: MARGEM_X }),
    [etapas, largura, faixaAlt],
  );

  if (etapas.length === 0) {
    return (
      <p className="text-caption text-text-muted" style={{ margin: 0 }}>
        Sem dados de funil no período.
      </p>
    );
  }

  const xFim = Math.max(1, largura);

  /* A pílula é HTML, não `<text>` do SVG: cápsula com raio, padding e peso de
     fonte são três coisas que o SVG faria à mão. Como o `viewBox` é 1:1 com a
     altura renderizada (ver abaixo), as coordenadas valem nos dois. */
  const pilula = (fundo: string, cor: string): React.CSSProperties => ({
    position: "absolute",
    transform: "translate(-50%, -50%)",
    background: fundo,
    color: cor,
    borderRadius: 999,
    padding: "3px 10px",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    fontVariantNumeric: "tabular-nums",
  });

  return (
    /* ⚠️ `flex: 1` + `minHeight: 0` NA RAIZ, e não só no desenho. Medido em
       07/08/2026: o desenho crescia dentro de uma `.tk-fita` que era `flex: 0 1
       auto` e parava nos 234px do próprio mínimo, dentro de um pai com 421
       disponíveis. O `flex: 1` do filho não serve de nada enquanto o pai não
       cresce — e o sintoma era ~60px de ar em cima e ~65 embaixo.
       `minHeight: 0` é o que deixa a coluna encolher abaixo do conteúdo em vez
       de estourar o card. */
    <div
      ref={setCaixa}
      className="tk-fita"
      style={{ minWidth: 0, minHeight: 0, flex: 1, display: "flex", flexDirection: "column" }}
    >
      {/* ── Versão COMPACTA: só ela sobra abaixo de 360px ────────────────────
          A fita some por container query (o desenho fica ilegível e ainda
          ocuparia 200px de altura). Isto tem a mesma informação sem a forma.
          ⚠️ `.tk-fita-compacto` é escondido enquanto o desenho aparece — os
          dois nunca convivem, senão os números apareceriam duplicados. */}
      <div className="tk-fita-compacto" style={{ display: "none", flexDirection: "column", gap: 6 }}>
        {etapas.map((e, i) => (
          <div key={e.label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span className="text-caption text-text-secondary">{e.label}</span>
            <span className="text-caption" style={{ fontVariantNumeric: "tabular-nums" }}>
              <strong style={{ color: "var(--tk-text)" }}>{e.valorFmt}</strong>
              {fluxo.etapas[i]?.fracao != null && (
                <span className="text-text-muted"> · {pct1(fluxo.etapas[i]!.fracao!)}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div
        ref={setDesenho}
        className="tk-fita-desenho"
        /* `flex: 1` + piso: a fita OCUPA a altura sobrando do card em vez de ter
           altura própria. Se o vizinho de linha esticou o card, ela estica. */
        style={{ position: "relative", flex: 1, minHeight: FAIXA_MIN + TOPO + RODAPE }}
      >
        {/* ⛔ `viewBox` 1:1 COM A ALTURA RENDERIZADA. Nada de esticar por
            `preserveAspectRatio`: nomes, pílulas e números são HTML posicionado
            nas mesmas coordenadas, e qualquer escala entre os dois os desalinha
            em silêncio. A fita cresce porque a GEOMETRIA foi recalculada com a
            altura medida, não porque o desenho foi esticado. */}
        <svg
          width="100%"
          height={alturaSvg}
          viewBox={`0 0 ${xFim} ${alturaSvg}`}
          role="img"
          aria-label={
            `Funil: ${etapas
              .map((e, i) => {
                const f = fluxo.etapas[i]?.fracao;
                return `${e.label} ${e.valorFmt}${f != null ? ` (${pct1(f)} do maior)` : ""}`;
              })
              .join(", ")}` +
            (fluxo.perdas.length
              ? `. Perdas: ${fluxo.perdas
                  .map(
                    (p) =>
                      `${p.valor.toLocaleString("pt-BR")} entre ${etapas[p.de]?.label} e ${etapas[p.de + 1]?.label}${p.pct != null ? ` (${pct1(p.pct)})` : ""}`,
                  )
                  .join(", ")}`
              : "")
          }
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id="tk-fita-rampa" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--tk-fluxo)" />
              <stop offset="100%" stopColor="var(--tk-fluxo-fim)" />
            </linearGradient>
          </defs>

          {/* As guias primeiro: a fita passa POR CIMA delas. */}
          {largura > 0 &&
            fluxo.guias.map((x, i) => (
              <line
                key={`guia-${i}`}
                x1={x}
                x2={x}
                y1={TOPO - 14}
                y2={TOPO + faixaAlt + 26}
                stroke="var(--tk-border)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

          {largura > 0 && (
            <path
              d={caminhoDaFita(fluxo.etapas, centroY, { x0: 0, x1: xFim })}
              fill="url(#tk-fita-rampa)"
            />
          )}
        </svg>

        {/* ── Nome da etapa, ACIMA ─────────────────────────────────────────── */}
        {largura > 0 &&
          fluxo.etapas.map((e, i) => (
            <div
              key={`nome-${etapas[i]!.label}`}
              className="text-caption text-text-secondary"
              style={{
                position: "absolute",
                left: e.x,
                top: 4,
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                fontWeight: 600,
              }}
            >
              {etapas[i]!.label}
            </div>
          ))}

        {/* ── Pílula da TAXA, SOBRE a fita ─────────────────────────────────────
            O elemento mais visível da figura, e é assim de propósito: a
            pergunta do bloco é "que fração sobrevive", e a resposta fica em
            cima da forma que a representa, não numa legenda ao lado. */}
        {largura > 0 &&
          fluxo.etapas.map((e, i) =>
            e.fracao == null ? null : (
              <div
                key={`taxa-${etapas[i]!.label}`}
                className="text-caption"
                style={{
                  ...pilula("var(--tk-pilula)", "var(--tk-on-pilula)"),
                  left: e.x,
                  top: centroY,
                  fontWeight: 700,
                }}
              >
                {pct1(e.fracao)}
              </div>
            ),
          )}

        {/* ── Pílula da PERDA, ABAIXO da fita, na GUIA ─────────────────────────
            🔴 É AQUI que a perda existe: em número, não em área. Ancorada na
            guia porque perda acontece ENTRE duas etapas — ancorá-la num centro
            de etapa a atribuiria a uma delas. */}
        {largura > 0 &&
          fluxo.perdas.map((p) => (
            <div
              key={`perda-${p.de}`}
              className="text-caption"
              style={{
                ...pilula("var(--tk-pilula)", "var(--tk-on-pilula)"),
                left: p.x,
                top: TOPO + faixaAlt + 12,
              }}
            >
              −{p.valor.toLocaleString("pt-BR")}
              {p.pct != null && <span style={{ opacity: 0.72 }}> · {pct1(p.pct)}</span>}
            </div>
          ))}

        {/* ── Número absoluto, EMBAIXO, grande e em negrito ────────────────── */}
        {largura > 0 &&
          fluxo.etapas.map((e, i) => (
            <div
              key={`abs-${etapas[i]!.label}`}
              className="text-metric-md"
              style={{
                position: "absolute",
                left: e.x,
                top: TOPO + faixaAlt + 34,
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                color: "var(--tk-text)",
                fontVariantNumeric: "tabular-nums",
                fontSize: "var(--tk-b-fita-num, 22px)",
                lineHeight: 1.1,
              }}
            >
              {etapas[i]!.valorFmt}
            </div>
          ))}
      </div>
    </div>
  );
}
