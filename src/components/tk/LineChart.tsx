"use client";

import * as React from "react";

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

export function LineChart({
  pontos,
  rotuloA = "Receita",
  rotuloB = "Gasto",
  /** Linha tracejada. `null` = não configurado; não inventamos zero. */
  breakEven = null,
  formatar,
  altura = 260,
}: {
  pontos: PontoSerie[];
  rotuloA?: string;
  rotuloB?: string;
  breakEven?: number | null;
  formatar: (n: number) => string;
  altura?: number;
}) {
  const [alvo, setAlvo] = React.useState<number | null>(null);

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
    pontos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[chave]).toFixed(1)}`).join(" ");

  const linhas = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* 🔴 DENTRO DA ÁREA DE DADO só existe neutro, lucro, prejuízo, atenção
            e cor de canal — `primary` e `accent` são cores de INTERFACE. Receita
            e gasto em dois azuis eram duas linhas quase da mesma cor num gráfico
            de duas séries: exatamente o problema que este redesign desfaz.
            Receita fica com a cor de valor positivo; gasto vai para o neutro. */}
        <Legenda cor="var(--tk-success)" texto={rotuloA} />
        <Legenda cor="var(--tk-text-muted)" texto={rotuloB} />
        {breakEven != null ? (
          <Legenda cor="var(--tk-warning)" texto={`Break-even ${formatar(breakEven)}`} tracejada />
        ) : (
          <span className="text-caption text-text-muted">
            Break-even não configurado —{" "}
            <a className="text-primary" href="/dashboard/taxas">defina em Taxas e Despesas</a>
          </span>
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

        <path d={caminho("b")} fill="none" stroke="var(--tk-text-muted)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={caminho("a")} fill="none" stroke="var(--tk-success)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {pontos.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.b)} r={alvo === i ? 4.5 : 3} fill="var(--tk-text-muted)" />
            <circle cx={x(i)} cy={y(p.a)} r={alvo === i ? 4.5 : 3} fill="var(--tk-success)" />
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
          <span style={{ color: "var(--tk-success)" }}>{rotuloA} {formatar(pontos[alvo]!.a)}</span>
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
