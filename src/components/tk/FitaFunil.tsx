"use client";

import * as React from "react";
import { calcularFita, caminhoDaFita } from "@/lib/funil/fita";

/**
 * FITA DE FLUXO — cliques → checkouts → vendas.
 *
 * ⛔ SUBSTITUIU AS TRÊS BARRAS. Três barras em ordem decrescente não dizem nada
 * que a faixa de KPIs já não diga; o que só o funil responde é **onde se perde
 * gente**, e numa fita o estreitamento É a desistência — não precisa de outro
 * elemento para mostrá-la.
 *
 * ### 🔴 A COR NÃO SEGUE A REFERÊNCIA, E O MOTIVO É O DADO
 *
 * A referência vai de verde a laranja/vermelho. Aqui isso seria a cor mentindo:
 * **a ponta direita é a VENDA**, que é o objetivo. Pintá-la de vermelho afirma
 * que chegar lá é ruim.
 *
 * A regra do projeto continua: verde é lucro, vermelho é prejuízo, âmbar é
 * atenção. **Etapa de funil não é nenhuma das três.** Então a fita é um matiz
 * só, do neutro na entrada à cor de marca na saída.
 *
 * ⚠️ E a rampa é ESTILO, não dado — ela não codifica nada que a posição em x já
 * não diga. Escolhi neutro→marca em vez de opacidade CAINDO por um motivo de
 * leitura, não de informação: uma fita que desbota para a direita se lê como
 * "perdendo força", e o lado direito é justamente onde a venda acontece. Quem
 * mostra a perda é a ESPESSURA.
 *
 * ### 🔴 ESPESSURA FIEL — ver `lib/funil/fita.ts`
 *
 * A conta e o porquê de não usar raiz quadrada moram lá, com o piso de 3px e a
 * distinção dele para o `|| 1` que este projeto condenou.
 */

const FAIXA = 130;
const ALTURA_SVG = 190;
const MARGEM_X = 12;
const CENTRO_Y = ALTURA_SVG / 2;

export interface EtapaEntradaFita {
  label: string;
  /** O valor cru. A fita mede com ele. */
  valor: number;
  /** Já formatado com separador de milhar — a tela não formata de novo. */
  valorFmt: string;
  /** Nome curto para a frase do cabeçalho ("chegam ao checkout"). */
  acao: string;
}

export function FitaFunil({ etapas }: { etapas: EtapaEntradaFita[] }) {
  const [caixa, setCaixa] = React.useState<HTMLDivElement | null>(null);
  const [largura, setLargura] = React.useState(0);
  const [ativa, setAtiva] = React.useState<number | null>(null);

  /* ⚠️ A largura é MEDIDA, não derivada de breakpoint: o mesmo bloco pode ter 4
     ou 12 colunas, e a espessura da fita é em px. Um `viewBox` que escalasse
     junto distorceria o texto das pílulas. */
  React.useEffect(() => {
    if (!caixa) return;
    const ro = new ResizeObserver(([e]) => setLargura(e?.contentRect.width ?? 0));
    ro.observe(caixa);
    return () => ro.disconnect();
  }, [caixa]);

  const fita = React.useMemo(
    () => calcularFita(etapas.map((e) => e.valor), { largura, faixa: FAIXA, margem: MARGEM_X }),
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

  return (
    <div ref={setCaixa} className="tk-fita" style={{ minWidth: 0 }}>
      {/* ── Cabeçalho ────────────────────────────────────────────────────────
          🔴 Ele é a VERSÃO COMPACTA, não um resumo redundante: abaixo de ~360px
          a fita some por container query e ele fica sozinho, empilhado. É a
          mesma informação sem a forma — melhor que uma fita espremida, que não
          se lê e ainda ocupa espaço. */}
      <p className="tk-fita-cabecalho text-caption text-text-secondary" style={{ margin: "0 0 10px", lineHeight: 1.5 }}>
        <strong className="text-text">{etapas[0]!.valorFmt}</strong> {etapas[0]!.label.toLowerCase()}
        {fita.slice(1).map((e, i) => (
          <React.Fragment key={etapas[i + 1]!.label}>
            {" · "}
            <strong className="text-text">{pct(e.taxa)}</strong> {etapas[i + 1]!.acao}
          </React.Fragment>
        ))}
      </p>

      <div className="tk-fita-desenho" style={{ position: "relative" }}>
        <svg
          width="100%"
          height={ALTURA_SVG}
          viewBox={`0 0 ${Math.max(1, largura)} ${ALTURA_SVG}`}
          role="img"
          aria-label={`Funil: ${etapas.map((e, i) => `${e.label} ${e.valorFmt}${fita[i]?.taxa != null ? ` (${pct(fita[i]!.taxa)})` : ""}`).join(", ")}`}
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id="tk-fita-rampa" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--tk-text-muted)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--tk-primary)" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* As guias primeiro: a fita passa POR CIMA delas, como na referência. */}
          {fita.map((e, i) => (
            <line
              key={`guia-${etapas[i]!.label}`}
              x1={e.x}
              x2={e.x}
              y1={CENTRO_Y - FAIXA / 2 - 14}
              y2={CENTRO_Y + FAIXA / 2 + 14}
              stroke="var(--tk-border)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
          ))}

          {largura > 0 && <path d={caminhoDaFita(fita, CENTRO_Y)} fill="url(#tk-fita-rampa)" />}

          {/* Faixas de captura do hover — uma por etapa, largura do meio-vão.
              ⚠️ `pointer-events` só aqui: a fita em si não recebe, senão o hover
              morreria no vão entre as etapas, que é onde o ponteiro passa. */}
          {fita.map((e, i) => {
            const meia = fita.length > 1 ? (fita[1]!.x - fita[0]!.x) / 2 : largura;
            return (
              <rect
                key={`alvo-${etapas[i]!.label}`}
                x={e.x - meia}
                width={meia * 2}
                y={0}
                height={ALTURA_SVG}
                fill="transparent"
                onMouseEnter={() => setAtiva(i)}
                onMouseLeave={() => setAtiva((a) => (a === i ? null : a))}
              />
            );
          })}
        </svg>

        {/* ── Pílulas ──────────────────────────────────────────────────────
            🔴 Ancoradas NA GUIA da etapa de destino, porque é dela que a taxa
            fala: "77,1%" pertence a Vendas, não ao vão antes dela. Fundo sólido
            para a fita não vazar por trás do número. */}
        {fita.map((e, i) =>
          e.taxa === null ? null : (
            <Pilula
              key={`taxa-${etapas[i]!.label}`}
              x={e.x}
              texto={pct(e.taxa)}
              destaque={i === fita.length - 1}
              /* ⚠️ A pílula da ÚLTIMA guia encosta na margem, e centrá-la
                 jogaria metade dela para fora do card — visto na tela. O
                 alinhamento acompanha a borda, como já acontece com os rótulos
                 das etapas logo abaixo. */
              ancora={i === 0 ? "inicio" : i === fita.length - 1 ? "fim" : "centro"}
            />
          ),
        )}

        {/* Hover: número e taxa sem depender do cabeçalho. */}
        {ativa !== null && fita[ativa] && (
          <div
            className="bg-surface border border-border text-caption text-text"
            style={{
              position: "absolute",
              left: fita[ativa]!.x,
              top: CENTRO_Y + FAIXA / 2 + 22,
              transform: "translateX(-50%)",
              padding: "4px 9px",
              borderRadius: "var(--tk-radius-pill)",
              whiteSpace: "nowrap",
              boxShadow: "var(--tk-shadow-overlay)",
              pointerEvents: "none",
            }}
          >
            {etapas[ativa]!.label}: <strong>{etapas[ativa]!.valorFmt}</strong>
            {fita[ativa]!.taxa !== null && <> · {pct(fita[ativa]!.taxa)} do passo anterior</>}
          </div>
        )}

        {/* Os rótulos das etapas, na base. */}
        {fita.map((e, i) => (
          <span
            key={`rot-${etapas[i]!.label}`}
            className="text-caption text-text-muted"
            style={{
              position: "absolute",
              left: e.x,
              top: CENTRO_Y + FAIXA / 2 + 18,
              transform: `translateX(${i === 0 ? "0" : i === fita.length - 1 ? "-100%" : "-50%"})`,
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

/**
 * A pílula da taxa. Fundo sólido e ancorada na guia.
 *
 * ⚠️ `destaque` é o último passo — a VENDA. Ele ganha o tom de marca em vez do
 * neutro, e é o único ponto da fita em que a cor diz algo: onde o fluxo termina.
 */
function Pilula({
  x,
  texto,
  destaque,
  ancora,
}: {
  x: number;
  texto: string;
  destaque: boolean;
  ancora: "inicio" | "centro" | "fim";
}) {
  const deslocamento = ancora === "inicio" ? "0" : ancora === "fim" ? "-100%" : "-50%";
  return (
    <span
      className={`text-caption ${destaque ? "bg-tint-primary text-on-tint-primary" : "bg-surface-hover text-text"}`}
      style={{
        position: "absolute",
        left: x,
        top: CENTRO_Y - FAIXA / 2 - 34,
        transform: `translateX(${deslocamento})`,
        padding: "2px 9px",
        borderRadius: "var(--tk-radius-pill)",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        border: "1px solid var(--tk-border)",
      }}
    >
      {texto}
    </span>
  );
}
