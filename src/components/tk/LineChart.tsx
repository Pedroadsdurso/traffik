"use client";

import * as React from "react";

import { caminhoSuave, fecharArea } from "@/lib/grafico/curva";

/**
 * LineChart — duas séries com pontos e a LINHA DE BREAK-EVEN.
 *
 * 🔴 A linha tracejada é a razão de este componente existir, e não é enfeite: o
 * break-even vem de Taxas e Despesas (gateway, imposto, coprodução, custo de
 * produto, despesa fixa) e é o único jeito de olhar "receita vs. gasto" e saber
 * se o dia foi LUCRO. Sem ela, duas linhas subindo juntas parecem boa notícia e
 * podem ser prejuízo.
 *
 * ⚠️ Quando o break-even não estiver configurado, a linha NÃO É DESENHADA e o
 * gráfico diz isso na legenda. Desenhar uma linha em zero seria pior que
 * omiti-la: pareceria que qualquer receita acima de zero é lucro, que é
 * exatamente a conta errada que a ferramenta existe para corrigir.
 */

export type PontoSerie = { rotulo: string; a: number; b: number };

const AVISO_ESTIMATIVA =
  "A taxa efetiva (gateway, coprodução, imposto e custo de produto) é medida sobre as vendas " +
  "deste período, então o break-even se move com o mix de produtos vendidos. Ele é uma " +
  "estimativa do período, não um valor fixo.";

export function LineChart({
  pontos,
  rotuloA = "Receita",
  rotuloB = "Gasto",
  /** Linha tracejada. `null` = não configurado; não inventamos zero. */
  breakEven = null,
  semBreakEven = null,
  unicasFora = 0,
  formatar,
  altura = 260,
}: {
  pontos: PontoSerie[];
  rotuloA?: string;
  rotuloB?: string;
  breakEven?: number | null;
  /** Por que não há break-even, quando há um motivo melhor que "não configurado". */
  semBreakEven?: string | null;
  /** Quantas despesas ÚNICAS ativas ficaram fora do cálculo. */
  unicasFora?: number;
  formatar: (n: number) => string;
  altura?: number;
}) {
  const [alvo, setAlvo] = React.useState<number | null>(null);
  const id = React.useId();

  const L = 760;
  const A = 260;
  const PAD = { t: 14, r: 12, b: 26, l: 56 };
  const larg = L - PAD.l - PAD.r;
  const alt = A - PAD.t - PAD.b;

  const maxBruto = Math.max(...pontos.flatMap((p) => [p.a, p.b]), breakEven ?? 0, 1);
  // Teto "redondo" para a régua não sair com 37.412 no topo.
  const passo = Math.pow(10, Math.floor(Math.log10(maxBruto))) / 2;
  const max = Math.ceil(maxBruto / passo) * passo;

  const x = (i: number) => PAD.l + (pontos.length === 1 ? larg / 2 : (i / (pontos.length - 1)) * larg);
  const y = (v: number) => PAD.t + alt - (v / max) * alt;

  const caminho = (chave: "a" | "b") =>
    caminhoSuave(pontos.map((p, i) => [x(i), y(p[chave])] as const));

  /* ⛔ SÓ A SÉRIE PRINCIPAL GANHA ÁREA. Duas áreas sobrepostas viram lama: a de
     baixo fica visível através da de cima e o olho lê uma terceira cor que não
     significa nada. O `06` §3 dá a outra metade da resposta — a série secundária
     se distingue por TEXTURA (hachura), não por preenchimento. Isso é o item 5
     da ordem de aplicação e ainda não foi feito; até lá o Gasto é linha nua. */
  const area = fecharArea(caminho("a"), x(0), x(pontos.length - 1), PAD.t + alt);

  const linhas = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* 🔄 A RECEITA ERA VERDE, E MUDOU EM 07/08/2026. Aqui dizia que `primary`
            é "cor de interface" e que a receita devia usar a cor de valor
            positivo. O `06` §10 inverte, e a razão é mais forte que a anterior:

            **verde/vermelho significam LUCRO E PREJUÍZO nesta ferramenta.** Uma
            linha de faturamento verde afirma que faturar é lucrar — e no dia em
            que o ROAS está em 0,4 a linha continua verde, dizendo o contrário do
            que o card de Lucro logo acima diz em vermelho.

            A regra que fica: destaque (azul de marca) é a série PRINCIPAL;
            lucro/prejuízo/atenção existem EXCLUSIVAMENTE na pílula de variação,
            no valor de lucro e no alerta. O medo antigo — "dois azuis quase
            iguais" — não se aplica: o gasto é neutro, não um segundo azul, e a
            partir do item 5 ele também é hachurado. */}
        <Legenda cor="var(--tk-primary)" texto={rotuloA} />
        <Legenda cor="var(--tk-text-muted)" texto={rotuloB} />
        {breakEven != null ? (
          /* ⚠️ "(estimado pelo período)" NÃO é modéstia: a taxa efetiva é medida
             sobre as vendas DESTE período, então a linha se move com o mix de
             produtos. Sem o aviso ela vira promessa — e uma linha de equilíbrio
             que promete precisão é pior que uma que admite ser estimativa. A
             explicação inteira está no `title`, que é onde cabe. */
          <span title={AVISO_ESTIMATIVA} style={{ cursor: "help" }}>
            <Legenda cor="var(--tk-warning)" texto={`Break-even ${formatar(breakEven)} (estimado pelo período)`} tracejada />
          </span>
        ) : (
          <span className="text-caption text-text-muted" title={semBreakEven ?? undefined}>
            {semBreakEven ?? (
              <>
                Break-even não configurado —{" "}
                <a className="text-primary" href="/dashboard/taxas">defina em Taxas e Despesas</a>
              </>
            )}
          </span>
        )}
        {unicasFora > 0 && (
          /* 🔴 O CUSTO QUE SUMIU PRECISA APARECER ONDE O NÚMERO SERIA DIFERENTE
             POR CAUSA DELE. Despesa única fica fora do cálculo porque o schema
             não guarda quando ela ocorreu — mas some no gráfico, no card de
             Lucro e na linha de Taxas, nunca em silêncio. */
          <a
            className="text-caption"
            href="/dashboard/taxas"
            style={{ color: "var(--tk-warning)" }}
            title="Despesa única não tem data de ocorrência, então não dá para saber em que período ela entra. Ela não é somada ao custo."
          >
            {unicasFora === 1 ? "1 despesa única fora do cálculo" : `${unicasFora} despesas únicas fora do cálculo`}
          </a>
        )}
      </div>

      <svg
        viewBox={`0 0 ${L} ${A}`}
        width="100%"
        height={altura}
        role="img"
        aria-label={`${rotuloA} contra ${rotuloB} ao longo do período`}
        style={{ display: "block", flex: 1, minHeight: 0 }}
        onMouseLeave={() => setAlvo(null)}
      >
        <defs>
          {/* 18% no topo → 0 na base (`06` §3). O gradiente é o que faz a área
              "morrer para baixo" em vez de ser um bloco chapado — sem ele o
              preenchimento compete com a grade e com a linha de break-even. */}
          <linearGradient id={`areaA${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tk-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--tk-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {linhas.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={L - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--tk-border)" strokeWidth="1" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fill="var(--tk-text-muted)" style={{ fontSize: 11 }}>
              {formatar(v)}
            </text>
          </g>
        ))}

        {breakEven != null && breakEven <= max && (
          <line
            x1={PAD.l} x2={L - PAD.r} y1={y(breakEven)} y2={y(breakEven)}
            stroke="var(--tk-warning)" strokeWidth="1.5" strokeDasharray="6 4"
          />
        )}

        {/* A área vai ANTES das duas linhas: desenhada depois, o preenchimento
            lavaria o traço do Gasto que passa por dentro dela. */}
        <path d={area} fill={`url(#areaA${id})`} />
        <path d={caminho("b")} fill="none" stroke="var(--tk-text-muted)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={caminho("a")} fill="none" stroke="var(--tk-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {pontos.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.b)} r={alvo === i ? 4.5 : 3} fill="var(--tk-text-muted)" />
            <circle cx={x(i)} cy={y(p.a)} r={alvo === i ? 4.5 : 3} fill="var(--tk-primary)" />
            {/* Faixa invisível de captura: mirar num ponto de 3px é o que faz
                gráfico custom parecer quebrado no mouse. */}
            <rect
              x={x(i) - larg / Math.max(pontos.length, 1) / 2}
              y={PAD.t}
              width={larg / Math.max(pontos.length, 1)}
              height={alt}
              fill="transparent"
              onMouseEnter={() => setAlvo(i)}
            />
            {(i === 0 || i === pontos.length - 1 || i % Math.ceil(pontos.length / 7) === 0) && (
              <text x={x(i)} y={A - 8} textAnchor="middle" fill="var(--tk-text-muted)" style={{ fontSize: 11 }}>
                {p.rotulo}
              </text>
            )}
          </g>
        ))}

        {alvo != null && pontos[alvo] && (
          <line x1={x(alvo)} x2={x(alvo)} y1={PAD.t} y2={PAD.t + alt} stroke="var(--tk-text-muted)" strokeWidth="1" strokeDasharray="3 3" />
        )}
      </svg>

      {alvo != null && pontos[alvo] && (
        <div className="text-caption" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span className="text-text-secondary">{pontos[alvo]!.rotulo}</span>
          <span style={{ color: "var(--tk-primary)" }}>{rotuloA} {formatar(pontos[alvo]!.a)}</span>
          <span style={{ color: "var(--tk-text-muted)" }}>{rotuloB} {formatar(pontos[alvo]!.b)}</span>
        </div>
      )}
    </div>
  );
}

function Legenda({ cor, texto, tracejada }: { cor: string; texto: string; tracejada?: boolean }) {
  return (
    <span className="text-caption text-text-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden="true"
        style={
          tracejada
            ? { width: 14, height: 0, borderTop: `2px dashed ${cor}` }
            : { width: 8, height: 8, borderRadius: "var(--tk-radius-pill)", background: cor }
        }
      />
      {texto}
    </span>
  );
}
