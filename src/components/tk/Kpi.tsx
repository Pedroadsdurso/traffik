"use client";

import * as React from "react";
import { Sparkline } from "./Sparkline";

/**
 * KpiHero e MetricStrip — os dois pesos de número da tela.
 *
 * 🔴 ELES EXISTEM AOS PARES, E É ESSE O PONTO. O Dashboard antigo tinha doze
 * cards idênticos em duas fileiras de seis: doze números do mesmo tamanho não
 * respondem pergunta nenhuma, porque nada na tela diz qual olhar primeiro. A
 * tela listava tudo e deixava a pessoa procurar.
 *
 * `KpiHero` são QUATRO, e só quatro. `MetricStrip` é uma linha, sem card e sem
 * sparkline, para o resto. A hierarquia é o produto — se um dia alguém puser
 * cinco heros ou der sparkline à faixa, o Dashboard volta a ser a grade de doze.
 */

export type DadosKpi = {
  chave: string;
  rotulo: string;
  valor: string;
  /** Variação percentual vs. período anterior. `null` = a métrica não compara. */
  delta: number | null;
  /** Métrica em que CAIR é bom (CPA, reembolso). Inverte a cor, não o sinal. */
  invertido?: boolean;
  /** Texto quando não há delta — "12 vendas aguardando", não "vs. período". */
  trendLabel?: string;
  /** Cor do número quando a métrica é financeira e está negativa. */
  cor?: string | null;
  /** `null` num bucket = sem denominador. O `Sparkline` interrompe a linha ali. */
  serie?: (number | null)[];
};

/** Verde/vermelho pelo que o número SIGNIFICA, não pelo sinal aritmético. */
function tomDoDelta(delta: number, invertido?: boolean): "success" | "danger" | "muted" {
  if (delta === 0) return "muted";
  const bom = invertido ? delta < 0 : delta > 0;
  return bom ? "success" : "danger";
}

const COR_TOM = {
  success: "var(--tk-success)",
  danger: "var(--tk-danger)",
  muted: "var(--tk-text-muted)",
} as const;

/**
 * O `trendLabel` só vale a linha se ele AFIRMA alguma coisa. "vs. período
 * anterior" e "no período" são legendas de comparação — sem número ao lado, são
 * moldura vazia ocupando a última linha dos quatro cards.
 */
function apoioUtil(texto?: string): boolean {
  if (!texto) return false;
  return !/^(vs\.?\s|no per[ií]odo$|sem compara)/i.test(texto.trim());
}

function Delta({ delta, invertido }: { delta: number; invertido?: boolean }) {
  const tom = tomDoDelta(delta, invertido);
  const sobe = delta > 0;
  return (
    <span className="text-caption" style={{ color: COR_TOM[tom], display: "inline-flex", alignItems: "center", gap: 4 }}>
      {/* A seta segue o SINAL e a cor segue o SIGNIFICADO. Um CPA que cai tem
          seta para baixo e cor verde — as duas coisas certas ao mesmo tempo.
          Amarrar a seta à cor faria "CPA caiu" aparecer com seta para cima. */}
      <span aria-hidden="true">{delta === 0 ? "—" : sobe ? "↑" : "↓"}</span>
      {Math.abs(delta).toFixed(1).replace(".", ",")}%
      <span className="text-text-muted">vs. período anterior</span>
    </span>
  );
}

export function KpiHero({ dados, carregando = false }: { dados: DadosKpi; carregando?: boolean }) {
  const corNumero = dados.cor ?? "var(--tk-text)";
  const corLinha = dados.delta != null ? COR_TOM[tomDoDelta(dados.delta, dados.invertido)] : "var(--tk-primary)";

  return (
    <div
      className="bg-surface border border-border"
      style={{
        borderRadius: "var(--tk-radius-card)",
        padding: "var(--tk-pad-card)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <span className="text-label text-text-secondary" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {dados.rotulo}
      </span>

      <span
        className="text-metric-xl"
        style={{ color: corNumero, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {carregando ? "—" : dados.valor}
      </span>

      {/* O sparkline vem ANTES do delta e depois do número: ele é o contexto do
          número, e o delta é a conclusão. Lido de cima para baixo dá
          "quanto → como veio → o que isso quer dizer".

          A área tem altura FIXA nos quatro cards, com ou sem série — senão um
          card sem dado fica mais baixo e a fileira desalinha. */}
      <div style={{ margin: "2px -4px 0", height: 38 }}>
        <Sparkline valores={dados.serie ?? []} cor={corLinha} altura={38} />
      </div>

      {/* 🔴 RÓTULO DE COMPARAÇÃO SEM VALOR É PIOR QUE NADA. Sem delta, o hook
          devolve "vs. período anterior" como `trendLabel` — uma legenda de
          comparação para um card que não compara coisa nenhuma. Ela some. O que
          fica é `trendLabel` que DIZ algo ("12 vendas aguardando pagamento"). */}
      {dados.delta != null ? (
        <Delta delta={dados.delta} invertido={dados.invertido} />
      ) : apoioUtil(dados.trendLabel) ? (
        <span className="text-caption text-text-muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {dados.trendLabel}
        </span>
      ) : (
        /* Sem delta, o motivo é sempre o mesmo: não há período anterior com
           dado para comparar. Dizer isso é diferente de repetir a legenda "vs.
           período anterior" sem número — aquilo prometia uma comparação que não
           existia; isto explica a ausência dela. */
        <span className="text-caption text-text-muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          sem período anterior para comparar
        </span>
      )}
    </div>
  );
}

/**
 * A faixa dos sete restantes. Uma linha, sem card, sem sparkline — e rola na
 * horizontal em tela estreita em vez de quebrar em grade, porque quebrar em
 * grade a transforma de volta em "mais cards".
 */
export function MetricStrip({ itens, carregando = false }: { itens: DadosKpi[]; carregando?: boolean }) {
  if (itens.length === 0) return null;
  return (
    <div
      className="bg-surface border border-border"
      style={{
        borderRadius: "var(--tk-radius-card)",
        display: "flex",
        alignItems: "stretch",
        overflowX: "auto",
        padding: "10px 4px",
      }}
    >
      {itens.map((m, i) => (
        <div
          key={m.chave}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            padding: "0 16px",
            minWidth: 132,
            flex: "1 0 auto",
            borderLeft: i ? "1px solid var(--tk-border)" : undefined,
          }}
        >
          <span className="text-caption text-text-muted" style={{ whiteSpace: "nowrap" }}>{m.rotulo}</span>
          {/* 🔴 SEM ISTO A FAIXA MENTIA DURANTE O CARREGAMENTO. O `KpiHero`
              recebia `carregando` e mostrava "—"; a faixa não recebia e seguia
              imprimindo os SETE números do período ANTERIOR. Trocar o filtro e
              ler dado velho achando que é novo não é detalhe de polimento — é a
              tela afirmando um número que não corresponde ao filtro na tela.

              Os dois pesos de número agora dizem a mesma coisa ao mesmo tempo. */}
          <span
            className="text-metric-md"
            style={{ color: m.cor ?? "var(--tk-text)", whiteSpace: "nowrap" }}
          >
            {carregando ? "—" : m.valor}
          </span>
          {!carregando && m.delta != null && (
            <span className="text-caption" style={{ color: COR_TOM[tomDoDelta(m.delta, m.invertido)], whiteSpace: "nowrap" }}>
              {m.delta > 0 ? "↑" : m.delta < 0 ? "↓" : "—"} {Math.abs(m.delta).toFixed(1).replace(".", ",")}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
