"use client";

import * as React from "react";

/**
 * Sparkline — a linha miúda que vive DENTRO do KPI hero.
 *
 * ⚠️ Ela não tem eixo, rótulo nem tooltip, e isso é a definição do componente,
 * não uma simplificação. Sparkline responde "a tendência subiu ou desceu", e
 * mais nada. Quem precisa ler valor por ponto está olhando o gráfico errado — o
 * `LineChart` é o lugar.
 *
 * O preenchimento é um degradê que morre para baixo (`--tk-gradient-chart` faz
 * isso no sistema, mas aqui a cor vem da MÉTRICA, porque um sparkline de lucro
 * negativo precisa ser vermelho). Por isso o gradiente é montado com a cor
 * recebida em vez de usar o token direto.
 */

export function Sparkline({
  valores,
  cor = "var(--tk-primary)",
  altura = 40,
}: {
  valores: number[];
  cor?: string;
  altura?: number;
}) {
  const id = React.useId();

  /* 🐛 SANEAMENTO — a barra azul sólida do ROAS vinha daqui. As séries de razão
     (`roas`, `ticket`, `arpu`, `cpa`) são divisões feitas no servidor, e num
     bucket com denominador zero elas saem `Infinity` ou `NaN`. Com um
     `Infinity` no meio, `Math.max` vira `Infinity`, a amplitude vira `Infinity`,
     todo `y` vira `NaN`, e o `<path>` da ÁREA degenera num retângulo cheio —
     que na tela é exatamente "uma barra azul sólida". */
  const limpos = React.useMemo(() => valores.filter((v) => Number.isFinite(v)), [valores]);

  /* 🔴 MENOS DE 3 PONTOS NÃO É TENDÊNCIA, e some com um estado EXPLÍCITO em vez
     de sumir. Com 2 pontos o desenho vira um triângulo que parece bug; com 0 a
     área colapsava e a fileira de KPIs ficava desalinhada, com um card mais
     baixo que os outros três. A altura é reservada nos dois casos. */
  /* SÉRIE INEXISTENTE ≠ SÉRIE CURTA, e a diferença é o que a pessoa vê:
       - o servidor não emite série para esta métrica  → espaço NEUTRO e mudo.
         Escrever "dados insuficientes" culparia o dado por uma ausência que é
         da ferramenta, e ainda repetiria a mensagem em todo carregamento.
       - a série existe mas tem 1 ou 2 pontos          → aí sim a mensagem, que
         explica por que não há desenho. */
  if (limpos.length === 0) return <div style={{ height: altura }} aria-hidden="true" />;
  if (limpos.length < 3) {
    return (
      <div style={{ height: altura, display: "grid", placeItems: "center" }}>
        <span className="text-caption text-text-muted" style={{ opacity: 0.7 }}>
          dados insuficientes
        </span>
      </div>
    );
  }

  const L = 100;
  const A = 32;
  /* Respiro nas quatro bordas. Sem ele a linha encosta na moldura do card e o
     último ponto — que costuma ser o pico — fica cortado pela borda direita. */
  const PX = 3;
  const PY = 3;
  const min = Math.min(...limpos);
  const max = Math.max(...limpos);
  const amplitude = max - min || 1;

  const pts = limpos.map((v, i) => {
    const x = PX + (i / (limpos.length - 1)) * (L - PX * 2);
    // Série achatada (todos iguais) fica no MEIO, não colada no topo: encostar
    // no topo lê como "no máximo histórico", que é uma afirmação falsa.
    const y = max === min ? A / 2 : PY + (A - PY * 2) - ((v - min) / amplitude) * (A - PY * 2);
    return [x, y] as const;
  });

  const linha = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${linha} L${L - PX},${A} L${PX},${A} Z`;

  return (
    <svg
      viewBox={`0 0 ${L} ${A}`}
      preserveAspectRatio="none"
      width="100%"
      height={altura}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g${id})`} />
      <path
        d={linha}
        fill="none"
        stroke={cor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
