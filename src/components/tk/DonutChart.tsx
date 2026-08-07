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
  /* 14% do raio (`06` §5) — anel FINO, não pizza grossa. Era 20px, quase o
     dobro: com o anel gordo o buraco do meio encolhe e o total no miolo, que é
     o número que a pessoa procura primeiro, fica espremido. */
  const ESPESSURA = Math.round(R * 0.14);
  const C = 2 * Math.PI * R;
  /* Folga de 2° entre segmentos (`06` §5), em comprimento de arco. */
  const FOLGA = (2 / 360) * C;

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
    return fatias.map((f, i) => {
      const inicio = fracoes.slice(0, i).reduce((s, x) => s + x, 0) * C;
      const vaga = fracoes[i]! * C;

      /* ⛔ A PONTA ARREDONDADA COME ARCO DOS DOIS LADOS — meia espessura em
         cada. Sem descontar `ESPESSURA` junto com a folga, os segmentos
         voltariam a se tocar e o `strokeLinecap` viraria enfeite invisível:
         seria "raio implementado e desligado", que é a família de defeito que
         este projeto persegue.

         O piso de 0.1 deixa a fatia minúscula virar um PONTO em vez de sumir.
         Some seria pior: a legenda ao lado a lista, e o olho procuraria no anel
         uma fatia que não está lá. Todas as minúsculas ficam do mesmo tamanho,
         e é o preço aceito — quem precisa do valor lê a legenda. */
      const desconto = FOLGA + ESPESSURA;
      const dash = Math.max(0.1, vaga - desconto);

      return {
        ...f,
        i,
        fracao: fracoes[i]!,
        dash,
        // O traço fica CENTRADO na vaga: metade do desconto de cada lado.
        offset: -(inicio + Math.min(desconto, vaga) / 2),
      };
    });
  }, [fatias, total, C, FOLGA, ESPESSURA]);

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
              strokeWidth={ativa === a.i ? ESPESSURA + 3 : ESPESSURA}
              strokeLinecap="round"
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
