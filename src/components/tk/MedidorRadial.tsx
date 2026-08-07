"use client";

import * as React from "react";

import { useTamanho } from "@/components/dashboard/ui/useTamanho";

/**
 * MedidorRadial — arco feito de BARRAS INDIVIDUAIS arredondadas, não de um traço
 * contínuo. É a versão da referência 4 (Insighta), que o `06` §6 aponta como a
 * melhor.
 *
 * ## Por que barras e não um arco contínuo
 *
 * Um arco contínuo é uma barra de progresso enrolada: ele diz "76% do caminho"
 * e o olho tem de estimar a fração de uma curva, que é a leitura mais difícil
 * que existe em gráfico. As barras dão **passos contáveis** — 24 delas, 19
 * pintadas —, e contar é mais fácil que medir ângulo.
 *
 * ⚠️ E o arredondamento das pontas não é enfeite aqui: com pontas retas as
 * barras viram os dentes de uma serra e o conjunto lê como engrenagem.
 *
 * ## ⛔ AS DUAS COISAS QUE ELE NÃO FAZ — e não são omissão
 *
 * As duas parecem simplificação esperando para acontecer. Alguém vai olhar este
 * componente, ver que ele recebe `valor` E `cor` de fora, e pensar *"por que ele
 * não deriva a cor do valor? É a mesma regra em todo lugar"*. **Não é.**
 *
 * **1. Ele não calcula taxa nenhuma.** Recebe 0–100 pronto. Duas divisões da
 * mesma coisa divergem sempre, e aqui a divergência seria muda: o medidor
 * mostraria um número e a linha ao lado outro, os dois plausíveis.
 *
 * **2. Ele não decide cor** — e este é o que dói. A cor da taxa de aprovação
 * **depende do DENOMINADOR, que o medidor não tem**: `tom()` em `Aprovacao.tsx`
 * devolve NEUTRO abaixo de 5 tentativas, porque `1 de 1 = 100%` não é sinal de
 * nada. Um medidor que derivasse a própria cor de `valor >= 80` pintaria essa
 * amostra de verde, e a tela afirmaria uma confiança que não existe.
 *
 * O defeito não apareceria como erro: apareceria como um medidor verde, bonito,
 * sobre uma venda. E a regra das 5 tentativas morreria em silêncio — que é a
 * definição de proteção morta nesta base.
 *
 * ⛔ **Não "limpe" isso.** Se um dia o medidor precisar saber a cor sozinho, ele
 * precisa receber o denominador junto, não adivinhar.
 */

/** Abertura embaixo, em graus. 240° de arco desenhado (`06` §6). */
const ARCO = 240;

/**
 * Quantas barras o arco tem, pela largura MEDIDA do medidor (`06` §6: "24 a 32
 * barras").
 *
 * 🔴 ESTE É O ÚNICO PEDAÇO DA ESCALA QUE CSS NÃO EXPRESSA. Diâmetro, altura e
 * tamanho de fonte saem de container query; **quantidade de elementos SVG não**
 * — as barras são geradas em JS, e nenhuma consulta de contêiner conta nós.
 *
 * ⚠️ É por isso que aqui (e só aqui) entra um `ResizeObserver`. Não é o começo
 * de medir tudo em JS: é o caso que a folha de estilo não alcança.
 *
 * ⛔ `BARRAS_PADRAO` é o que sai na renderização do SERVIDOR, onde não há
 * medida. Ele é o piso da faixa, não um número neutro: um medidor que nascesse
 * com 32 barras e encolhesse para 24 na hidratação piscaria.
 */
const BARRAS_PADRAO = 24;
function barrasPara(largura: number): number {
  if (largura <= 0) return BARRAS_PADRAO; // ainda não medido — ver `useTamanho`
  if (largura >= 150) return 32;
  if (largura >= 118) return 28;
  return BARRAS_PADRAO;
}
/** Fração do passo ocupada pela barra. O resto é a folga entre elas. */
const OCUPACAO = 0.62;

export function MedidorRadial({
  valor,
  cor,
  rotulo,
  texto,
  tamanho = 132,
}: {
  /** 0–100, JÁ CALCULADO. Ver a nota do componente. */
  valor: number;
  /** Cor das barras preenchidas. As vazias são sempre neutras. */
  cor: string;
  /** O número grande no centro. Já formatado — `"77%"`. */
  rotulo: string;
  /** Linha pequena abaixo do número. */
  texto?: string;
  tamanho?: number;
}) {
  const id = React.useId();
  /* 🔴 PRIMEIRO CONSUMIDOR DO `useTamanho`, que estava ÓRFÃO desde que foi
     escrito — hook completo, comentado, testado por ninguém e importado por
     ninguém. Achado ao construir a escala, em 07/08/2026. Ele é exatamente a
     ferramenta certa para a única medida que CSS não dá. */
  const { ref: refMedida, largura } = useTamanho<HTMLDivElement>();
  const BARRAS = barrasPara(largura);
  const R = 50;
  const raioInterno = R * 0.72;

  /* O clamp não é paranoia: `rate` vem do servidor e um arredondamento de
     100,4% pintaria uma barra a mais que não existe no arco. */
  const fracao = Math.min(1, Math.max(0, valor / 100));

  /**
   * 🔴 OS EXTREMOS SÃO RESERVADOS, e `Math.round` sozinho os roubava. Achado
   * pelo `test:desenho` em 07/08/2026 — os dois casos são de mentira, não de
   * arredondamento:
   *
   * | Taxa | `round` dava | Lia-se como |
   * |---|---|---|
   * | **99,6%** | 24 de 24 | "fechou" — indistinguível de 100% |
   * | **2%** | 0 de 24 | "nenhuma" — indistinguível de 0% |
   *
   * É a distinção central deste projeto na camada do desenho: *medido e quase
   * nada* ≠ *nada*, e *quase tudo* ≠ *tudo*. A mesma razão do piso de 3px na
   * fita do funil e do `null` que quebra o sparkline.
   *
   * Então: `0` só com fração zero, `BARRAS` só com fração cheia, e tudo entre
   * os dois fica entre 1 e 23 — por mais perto que esteja da ponta.
   */
  const preenchidas =
    fracao <= 0
      ? 0
      : fracao >= 1
        ? BARRAS
        : Math.min(BARRAS - 1, Math.max(1, Math.round(fracao * BARRAS)));

  const inicio = 90 + (360 - ARCO) / 2; // abre embaixo, simétrico
  const passo = ARCO / BARRAS;

  return (
    /* 🎨 DIÂMETRO CONTÍNUO (`--tk-b-radial`), pelo mesmo motivo do donut:
       geometria não tem meio-tamanho feio. A prop `tamanho` é o fallback para
       uso fora de um `.tk-escala`. */
    <div
      ref={refMedida}
      style={{ display: "grid", placeItems: "center", position: "relative", width: `var(--tk-b-radial, ${tamanho}px)`, aspectRatio: "1" }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
        {Array.from({ length: BARRAS }, (_, i) => {
          const ang = ((inicio + i * passo + passo / 2) * Math.PI) / 180;
          const cos = Math.cos(ang);
          const sen = Math.sin(ang);
          const cheia = i < preenchidas;
          return (
            <line
              key={i}
              x1={50 + cos * raioInterno}
              y1={50 + sen * raioInterno}
              x2={50 + cos * R}
              y2={50 + sen * R}
              stroke={cheia ? cor : "var(--tk-surface-hover)"}
              /* A largura sai do comprimento do arco no meio da barra, vezes a
                 ocupação. Fixá-la em pixels faria as barras se tocarem num
                 medidor pequeno e se espalharem num grande. */
              strokeWidth={((passo * Math.PI) / 180) * ((R + raioInterno) / 2) * OCUPACAO}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* O texto é HTML sobre o SVG, e não `<text>`: ele herda a tipografia do
          sistema (tabular, peso, tracking) em vez de reimplementá-la em
          atributos de SVG que ninguém mantém. */}
      <div
        id={id}
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          alignContent: "center",
          gap: 2,
          pointerEvents: "none",
        }}
      >
        <span className="text-metric-md" style={{ color: cor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {rotulo}
        </span>
        {texto && (
          <span className="text-caption text-text-muted" style={{ textAlign: "center", lineHeight: 1.2 }}>
            {texto}
          </span>
        )}
      </div>
    </div>
  );
}
