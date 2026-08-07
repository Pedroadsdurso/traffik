"use client";

import * as React from "react";

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
 * ## O que este componente NÃO faz
 *
 * ⛔ Ele **não calcula taxa nenhuma**. Recebe `valor` de 0 a 100 já pronto. Duas
 * divisões da mesma coisa divergem sempre, e aqui a divergência seria muda: o
 * medidor mostraria um número e a linha ao lado outro.
 *
 * ⛔ E ele **não decide cor**. Quem sabe se 100% sobre 1 tentativa merece verde é
 * quem tem o denominador — ver `tom()` em `Aprovacao.tsx`, que fica neutro
 * abaixo de 5 tentativas. Um medidor que escolhesse a própria cor pintaria de
 * verde uma amostra de uma venda.
 */

/** Abertura embaixo, em graus. 240° de arco desenhado (`06` §6). */
const ARCO = 240;
const BARRAS = 24;
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
  const R = 50;
  const raioInterno = R * 0.72;

  /* O clamp não é paranoia: `rate` vem do servidor e um arredondamento de
     100,4% pintaria uma barra a mais que não existe no arco. */
  const fracao = Math.min(1, Math.max(0, valor / 100));
  const preenchidas = Math.round(fracao * BARRAS);

  const inicio = 90 + (360 - ARCO) / 2; // abre embaixo, simétrico
  const passo = ARCO / BARRAS;

  return (
    <div style={{ display: "grid", placeItems: "center", position: "relative", width: tamanho, height: tamanho }}>
      <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} aria-hidden="true" style={{ display: "block" }}>
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
