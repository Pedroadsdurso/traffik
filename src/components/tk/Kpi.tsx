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
  /**
   * 🔴 QUAL POPULAÇÃO ESTÁ EM CIMA E QUAL ESTÁ EMBAIXO.
   *
   * Uma linha pequena e neutra sob o número, quando ele é uma RAZÃO entre duas
   * medições que não cobrem a mesma coisa. O caso que criou o campo: o ROAS do
   * Dashboard divide receita de **todos os canais** pelo gasto **só da Meta**.
   *
   * ⛔ **NÃO é alerta.** Sem cor, sem ícone, sem juízo — declarar a base não é
   * dizer que o número está errado, é dizer o que ele mede. Tingir isto de
   * atenção transformaria uma nota de rodapé honesta numa acusação, e ela
   * apareceria em toda conta, sempre.
   *
   * É a mesma solução da faixa de cobertura do funil, e pelo mesmo motivo: o
   * usuário não pode ler um número sem saber o que ele cobre.
   */
  base?: string;
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

/** Fundo tingido do tom, a 12% — o `06` §2. `muted` usa o texto de apoio. */
const TINTA_TOM = {
  success: "var(--tk-tint-success)",
  danger: "var(--tk-tint-danger)",
  muted: "var(--tk-tint-neutral)",
} as const;

/** Texto sobre o tingimento. ⛔ Nunca a cor pura: é o par de 3.55:1 que os
 *  tokens `on-tint-*` existem para não deixar acontecer. */
const COR_SOBRE_TINTA = {
  success: "var(--tk-on-tint-success)",
  danger: "var(--tk-on-tint-danger)",
  muted: "var(--tk-on-tint-neutral)",
} as const;

/**
 * PílulaDelta — a cápsula de variação, AO LADO do número.
 *
 * 🎨 Ela era texto solto embaixo do valor, e trocá-la de lugar é o item 1 da
 * ordem de aplicação do `06` — "maior mudança de percepção, menor custo". O
 * motivo é que texto solto se lê como legenda e cápsula se lê como OBJETO: a
 * variação deixa de ser uma nota de rodapé do número e passa a ser um dado ao
 * lado dele.
 *
 * ⛔ A SETA SEGUE O SINAL E A COR SEGUE O SIGNIFICADO, e são coisas separadas.
 * Um CPA que cai tem seta para BAIXO e cor VERDE — as duas certas ao mesmo
 * tempo. Amarrar a seta à cor faria "o CPA caiu" aparecer com seta para cima.
 */
export function PilulaVariacao({
  texto,
  tom,
  seta,
}: {
  /** Já formatado — "18,6%". O componente não calcula nada. */
  texto: string;
  tom: "success" | "danger" | "muted";
  /** `null` some com a seta — para variação que não tem direção. */
  seta?: "cima" | "baixo" | null;
}) {
  return (
    <span
      className="text-caption"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        flex: "none",
        height: 22,
        padding: "0 8px",
        borderRadius: "var(--tk-radius-pill)",
        background: TINTA_TOM[tom],
        color: COR_SOBRE_TINTA[tom],
        fontWeight: 600,
        // Sem isto a pílula muda de largura a cada atualização do tempo real e
        // o número ao lado dela balança junto.
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}
    >
      {seta !== null && (
        <span aria-hidden="true" style={{ fontSize: 12 }}>
          {seta === "cima" ? "↑" : seta === "baixo" ? "↓" : "—"}
        </span>
      )}
      {texto}
    </span>
  );
}

/**
 * A pílula a partir de um DELTA numérico. Ela decide tom e seta; quem só tem o
 * texto pronto usa a `PilulaVariacao` direto.
 *
 * ⛔ UMA implementação de pílula, e não duas. O `CardMetrica` tinha a variação
 * como texto colorido solto e ia ganhar a sua — duas pílulas com o mesmo papel
 * divergem no primeiro ajuste de padding, e o usuário vê as duas lado a lado
 * sem saber qual está certa.
 */
function PilulaDelta({ delta, invertido }: { delta: number; invertido?: boolean }) {
  return (
    <PilulaVariacao
      tom={tomDoDelta(delta, invertido)}
      seta={delta === 0 ? undefined : delta > 0 ? "cima" : "baixo"}
      texto={`${Math.abs(delta).toFixed(1).replace(".", ",")}%`}
    />
  );
}

export function KpiHero({ dados, carregando = false }: { dados: DadosKpi; carregando?: boolean }) {
  const corNumero = dados.cor ?? "var(--tk-text)";

  /* 🔄 A LINHA SEGUIA O TOM DO DELTA, e parou em 07/08/2026. Um sparkline verde
     porque a variação foi positiva pinta de "lucro" uma série que é de
     FATURAMENTO — e o `06` §10 reserva verde/vermelho para a pílula de variação,
     o valor de lucro e o alerta. A pílula ao lado já diz o tom; a linha dizendo
     de novo é a mesma informação ocupando a cor que dá significado.

     A exceção é o `dados.cor`, e ela é a regra e não um furo: quando ele vem
     preenchido é porque o VALOR é negativo (Lucro em prejuízo), que é
     literalmente o "valor de lucro" que o §10 permite colorir. Aí a linha
     acompanha o número, e as duas coisas na tela dizem a mesma verdade. */
  const corLinha = dados.cor ?? "var(--tk-primary)";

  return (
    /* 🎨 `tk-escala` — o número e o sparkline crescem com a largura DESTE card.
       ⛔ Ele depende de estar dentro de um `.tk-medida`, que é quem carrega o
       `container-type`. Sem o ancestral, a consulta cai na raiz e responde
       sobre a janela: ver o ⛔ da prop `escala` no `Card`. */
    <div
      className="bg-surface border border-border tk-escala"
      style={{
        borderRadius: "var(--tk-radius-card)",
        padding: "var(--tk-pad-hero)",
        boxShadow: "var(--tk-shadow-card)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
        flex: 1,
        overflow: "hidden",
      }}
    >
      <span className="text-label text-text-secondary" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {dados.rotulo}
      </span>

      {/* Número e pílula na MESMA linha. O `baseline` alinha a cápsula pela
          linha do texto do valor, não pelo topo da caixa dele — com `center` ela
          flutua alto, porque a caixa do número é bem mais alta que a glifa.

          `flexWrap` porque a fileira tem 4 cards e a largura de cada um depende
          do arranjo que o usuário salvou: no card mais estreito a pílula desce
          para a linha de baixo em vez de espremer o número. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
        {/* 🎨 O NÚMERO ESCALA EM DEGRAUS com a largura do card (`--tk-b-metrica`,
            4 faixas). `text-metric-xl` continua definindo peso, tracking e
            `font-variant-numeric`; só o TAMANHO passa a vir da escala — senão
            um hero de 12 colunas teria o mesmo número de um de 3, perdido no
            meio do quadro.

            ⛔ Degrau e não interpolação: em tamanho intermediário o dígito perde
            hinting e pesa diferente do card vizinho. */}
        <span
          className="text-metric-xl"
          style={{ fontSize: "var(--tk-b-metrica, 30px)", lineHeight: 1.05, color: corNumero, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
        >
          {carregando ? "—" : dados.valor}
        </span>

        {/* ⛔ Some durante o carregamento junto com o número. Uma cápsula verde
            de "+18,6%" ao lado de um "—" afirma uma comparação que a tela acabou
            de dizer que não tem. */}
        {!carregando && dados.delta != null && (
          <PilulaDelta delta={dados.delta} invertido={dados.invertido} />
        )}
      </div>

      {/* O sparkline vem ANTES do delta e depois do número: ele é o contexto do
          número, e o delta é a conclusão. Lido de cima para baixo dá
          "quanto → como veio → o que isso quer dizer".

          A área tem altura FIXA nos quatro cards, com ou sem série — senão um
          card sem dado fica mais baixo e a fileira desalinha. */}
      {/* ⚠️ A altura vem da MESMA faixa do número, e é o que mantém a proporção
          entre os dois quando o card cresce. Continua FIXA dentro de cada faixa,
          com ou sem série — senão um card sem dado fica mais baixo e a fileira
          desalinha. */}
      <div className="tk-spark" style={{ margin: "2px -4px 0", height: "var(--tk-b-spark, 32px)" }}>
        <Sparkline valores={dados.serie ?? []} cor={corLinha} altura={38} />
      </div>

      {/* 🔴 RÓTULO DE COMPARAÇÃO SEM VALOR É PIOR QUE NADA. Sem delta, o hook
          devolve "vs. período anterior" como `trendLabel` — uma legenda de
          comparação para um card que não compara coisa nenhuma. Ela some. O que
          fica é `trendLabel` que DIZ algo ("12 vendas aguardando pagamento"). */}
      {dados.delta != null ? (
        /* A pílula subiu para junto do número; o que sobra aqui é a LEGENDA dela
           — contra o que a variação está sendo medida. Ela é neutra de propósito:
           a cor já foi dita uma vez, e dizê-la duas vezes na mesma coluna faz o
           card inteiro parecer vermelho num dia ruim. */
        <span className="text-caption text-text-muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          vs. período anterior
        </span>
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

      {/* ── A BASE DA RAZÃO ─────────────────────────────────────────────────
          Ver `DadosKpi.base`. Fica ABAIXO da legenda de comparação porque
          responde outra pergunta: aquela diz contra o que a variação foi
          medida, esta diz o que o número cobre.

          ⛔ `--tk-text-muted` e nada mais. Sem cor de atenção — declarar a base
          não é acusar o número. */}
      {dados.base && (
        <span
          className="text-caption text-text-muted"
          style={{ marginTop: 2, lineHeight: 1.35, opacity: 0.85 }}
        >
          {dados.base}
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
        /* A faixa tem fundo, borda e raio de card — então tem a SOMBRA de card
           (`06` §1). Sem ela a faixa ficava rente ao fundo logo abaixo de quatro
           heros elevados, e a fileira inteira parecia meio desenhada. Os ITENS
           dentro continuam sem card, que é o que o comentário acima diz. */
        boxShadow: "var(--tk-shadow-card)",
        display: "flex",
        alignItems: "stretch",
        overflowX: "auto",
        padding: "10px 4px",
      }}
    >
      {/* 🔴 `.tk-medida` NO ITEM e `.tk-escala` NO NÚMERO — nunca os dois no
          mesmo elemento, e eu escrevi assim primeiro. **Um elemento com
          `container-type` não é contêiner de si mesmo**: a consulta sobe para o
          ancestral, e como a faixa não está numa célula da grade ela cairia na
          RAIZ, respondendo sobre a janela.

          ⚠️ E medir o ITEM, não a faixa: a faixa é sempre da largura da tela, e
          o que varia é a QUANTIDADE de métricas nela — com três, cada item tem o
          dobro do espaço de quando há oito. Medir a faixa daria a mesma resposta
          sempre, que é um controle que não controla nada.

          São só duas faixas aqui (17 → 23px): a strip é compacta por desenho, e
          escalar mais a transformaria de volta em "mais cards". */}
      {itens.map((m, i) => (
        <div
          key={m.chave}
          className="tk-medida"
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
            className="text-metric-md tk-escala"
            style={{ fontSize: "var(--tk-b-metrica-sm, 17px)", color: m.cor ?? "var(--tk-text)", whiteSpace: "nowrap" }}
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
