"use client";

import * as React from "react";

/**
 * DonutChart — a rosca de Canais, com a legenda em COLUNA à direita.
 *
 * A legenda em coluna não é escolha estética: ela carrega três dados por linha
 * (nome, percentual e valor em reais), e legenda embaixo do gráfico não comporta
 * isso sem virar duas colunas desalinhadas. Em tela estreita ela desce para
 * baixo do donut — aí sim empilhada, porque não há largura para o par.
 *
 * ⛔ AS CORES SÃO DE CANAL, e este é o lugar onde elas PODEM aparecer: dentro da
 * área de plotagem e na legenda dela. Meta não é azul e TikTok não é ciano de
 * propósito — azul é `primary` (onde eu clico) e ciano é `accent` (o que está
 * acontecendo) neste sistema. Quatro tons do mesmo azul, que é o que o mockup
 * mostra, apagaria a fronteira e ainda deixaria as fatias indistinguíveis em
 * deuteranopia.
 */

export type FatiaDonut = { nome: string; valor: number; cor: string };

export function DonutChart({
  fatias,
  totalLabel,
  formatar,
  tamanho = 168,
}: {
  fatias: FatiaDonut[];
  totalLabel: string;
  formatar: (n: number) => string;
  tamanho?: number;
}) {
  const [ativa, setAtiva] = React.useState<number | null>(null);
  const total = fatias.reduce((s, f) => s + f.valor, 0);

  const R = 70;
  const ESPESSURA = 20;
  const C = 2 * Math.PI * R;

  /* Soma acumulada SEM mutação. O acumulador clássico (`let acc` dentro do map)
     é recusado pelo lint, e com razão: em Strict Mode o React roda o corpo do
     componente duas vezes, e um acumulador de escopo externo somaria dobrado —
     as fatias sairiam giradas na segunda passada. */
  const arcos = React.useMemo(() => {
    /* ⚠️ Aqui o 0 e CORRETO e fica. `fracoes` e GEOMETRIA — quanto de
       circunferencia cada fatia ocupa —, nao uma metrica exibida. Sem total,
       nenhuma fatia tem arco, que e o desenho certo. O percentual que a pessoa
       LE vem da legenda, e esse passa por `pct1`, que devolve "—". */
    const fracoes = fatias.map((f) => (total ? f.valor / total : 0));
    return fatias.map((f, i) => ({
      ...f,
      i,
      fracao: fracoes[i]!,
      dash: fracoes[i]! * C,
      offset: -fracoes.slice(0, i).reduce((s, x) => s + x, 0) * C,
    }));
  }, [fatias, total, C]);

  /* 🔴 UM ANEL DE 100% NÃO INFORMA NADA — só ocupa espaço para dizer "tudo veio
     de um lugar", que a frase diz melhor e em uma linha. A rosca existe para
     COMPARAR fatias; com uma fatia não há comparação. */
  if (fatias.length === 1) {
    const unica = fatias[0]!;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0, justifyContent: "center" }}>
        <p className="text-body text-text" style={{ margin: 0 }}>
          Todo o faturamento veio de <strong>{unica.nome}</strong>.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden="true" style={{ height: 10, flex: 1, borderRadius: "var(--tk-radius-pill)", background: unica.cor }} />
          <span className="text-metric-md text-text" style={{ flex: "none" }}>{totalLabel}</span>
        </div>
        <p className="text-caption text-text-muted" style={{ margin: 0 }}>
          A rosca aparece quando houver mais de um canal para comparar.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        alignItems: "center",
        flexWrap: "wrap",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div style={{ position: "relative", width: tamanho, height: tamanho, flex: "none" }}>
        <svg viewBox="0 0 180 180" width={tamanho} height={tamanho} style={{ transform: "rotate(-90deg)" }}>
          <circle cx="90" cy="90" r={R} fill="none" stroke="var(--tk-surface-hover)" strokeWidth={ESPESSURA} />
          {arcos.map((a) => (
            <circle
              key={a.nome}
              cx="90" cy="90" r={R}
              fill="none"
              stroke={a.cor}
              strokeWidth={ativa === a.i ? ESPESSURA + 4 : ESPESSURA}
              strokeDasharray={`${a.dash} ${C - a.dash}`}
              strokeDashoffset={a.offset}
              onMouseEnter={() => setAtiva(a.i)}
              onMouseLeave={() => setAtiva(null)}
              style={{ transition: "stroke-width var(--tk-dur-rapida) var(--tk-ease-padrao)", cursor: "default" }}
            />
          ))}
        </svg>
        {/* O total no miolo — o número que a pessoa procura primeiro. */}
        <div
          style={{
            position: "absolute", inset: 0, display: "grid", placeItems: "center",
            textAlign: "center", pointerEvents: "none",
          }}
        >
          <div>
            <div className="text-caption text-text-muted">Total</div>
            <div className="text-title text-text" style={{ fontVariantNumeric: "tabular-nums" }}>{totalLabel}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 180 }}>
        {arcos.map((a) => (
          <div
            key={a.nome}
            onMouseEnter={() => setAtiva(a.i)}
            onMouseLeave={() => setAtiva(null)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              opacity: ativa == null || ativa === a.i ? 1 : 0.45,
              transition: "opacity var(--tk-dur-rapida) var(--tk-ease-padrao)",
            }}
          >
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "var(--tk-radius-pill)", background: a.cor, flex: "none" }} />
            <span className="text-caption text-text" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.nome}
            </span>
            <span className="text-caption text-text-secondary" style={{ fontVariantNumeric: "tabular-nums", flex: "none" }}>
              {(a.fracao * 100).toFixed(1).replace(".", ",")}%
            </span>
            <span className="text-caption text-text-muted" style={{ fontVariantNumeric: "tabular-nums", flex: "none", minWidth: 84, textAlign: "right" }}>
              {formatar(a.valor)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
