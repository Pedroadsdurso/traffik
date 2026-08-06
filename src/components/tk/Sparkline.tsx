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
  /** `null` = bucket sem denominador. A linha se INTERROMPE ali. */
  valores: (number | null)[];
  cor?: string;
  altura?: number;
}) {
  const id = React.useId();

  /* 🔴 BURACO NA SÉRIE É INFORMAÇÃO, E ELE NÃO PODE VIRAR UM PONTO NO CHÃO.
     ──────────────────────────────────────────────────────────────────────────
     As séries de razão (`roas`, `ticket`, `arpu`, `cpa`) dividem por gasto ou
     por vendas. Num dia sem gasto o servidor mandava `0`, e `0` é plotado no
     PISO do desenho — indistinguível de "o ROAS despencou para zero". Medido:
     `[0, 0, 3.2, 0, 2.8, 0, 0]` produzia y = `[29, 29, 3, 29, 6.3, 29, 29]`
     num viewBox de altura 32. Quatro quedas ao chão que nunca aconteceram.

     Hoje o servidor manda `null`, e o `null` **quebra o traçado**: o ponto não
     existe, e os vizinhos NÃO são ligados por cima dele. Ligar seria inventar
     uma interpolação que ninguém mediu — o mesmo defeito do arco no globo,
     decoração se passando por dado.

     ⚠️ O filtro anterior era `valores.filter(Number.isFinite)`, e ele não podia
     disparar: o produtor devolvia `0`, nunca `Infinity`. Pior que inerte — ele
     ENCOLHIA o array, então o `x` dos pontos restantes se redistribuía e a
     série ficava mais curta sem nada dizer. O `null` agora ocupa a posição
     dele: o eixo x continua com o número certo de buckets.

     O `Number.isFinite` continua aqui como rede para numerador corrompido
     (`NaN` que venha de outro lugar) — mas ele agora vira `null`, não some. */
  const pontos = React.useMemo(
    () => valores.map((v) => (v != null && Number.isFinite(v) ? v : null)),
    [valores],
  );
  const limpos = React.useMemo(() => pontos.filter((v): v is number => v !== null), [pontos]);

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
        {/* 🔴 O TEXTO FALA DA TENDÊNCIA, NÃO DO VALOR — e a diferença apareceu
            na tela: o card mostrava "4,55x" e, uma linha abaixo, "dados
            insuficientes". O número existe e está certo; o que falta é o
            HISTÓRICO para desenhar a linha. "Dados insuficientes" negava o
            valor que o próprio card acabou de afirmar. */}
        <span className="text-caption text-text-muted" style={{ opacity: 0.7 }}>
          sem histórico para a tendência
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

  /* ⚠️ O `x` vem do índice no array COMPLETO, não na lista sem buracos. É isso
     que faz o buraco ocupar espaço: os dias restantes não se espremem para
     fechar a lacuna, e a largura continua sendo a do período. */
  const larguraX = Math.max(1, pontos.length - 1);
  const coord = (v: number, i: number) =>
    [
      PX + (i / larguraX) * (L - PX * 2),
      // Série achatada (todos iguais) fica no MEIO, não colada no topo: encostar
      // no topo lê como "no máximo histórico", que é uma afirmação falsa.
      max === min ? A / 2 : PY + (A - PY * 2) - ((v - min) / amplitude) * (A - PY * 2),
    ] as const;

  /* Trechos CONTÍNUOS. Cada `null` fecha o trecho corrente e o próximo valor
     abre um novo — nenhum `L` atravessa o buraco. */
  const trechos: (readonly [number, number])[][] = [];
  let atual: (readonly [number, number])[] = [];
  pontos.forEach((v, i) => {
    if (v === null) {
      if (atual.length) trechos.push(atual);
      atual = [];
      return;
    }
    atual.push(coord(v, i));
  });
  if (atual.length) trechos.push(atual);

  const dDe = (t: readonly (readonly [number, number])[]) =>
    t.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

  const linha = trechos.map(dDe).join(" ");
  /* A área também é por trecho, e fecha na base do PRÓPRIO trecho — uma área
     única de ponta a ponta preencheria por baixo do buraco e desfaria, no
     preenchimento, a interrupção que a linha acabou de mostrar. */
  const area = trechos
    .filter((t) => t.length > 1)
    .map((t) => `${dDe(t)} L${t[t.length - 1]![0].toFixed(2)},${A} L${t[0]![0].toFixed(2)},${A} Z`)
    .join(" ");

  /* Um trecho de 1 ponto não vira `<path>` visível (nem linha, nem área). Ele
     ganha um ponto explícito: um dia isolado entre dois buracos é dado, e sumir
     com ele é a mesma omissão silenciosa que o zero-no-chão era. */
  const isolados = trechos.filter((t) => t.length === 1).map((t) => t[0]!);

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
      {area && <path d={area} fill={`url(#g${id})`} />}
      <path
        d={linha}
        fill="none"
        stroke={cor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {isolados.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill={cor} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
