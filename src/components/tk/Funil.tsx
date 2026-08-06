"use client";

import * as React from "react";

/**
 * Funil — cliques → checkouts → vendas, com a taxa de cada passo.
 *
 * 🔴 A TAXA É O PRODUTO, NÃO AS BARRAS. Três números em ordem decrescente não
 * dizem nada que a faixa de KPIs já não diga; o que só o funil responde é
 * **onde se perde gente**. Por isso a taxa fica ao lado de cada passo e não num
 * tooltip.
 *
 * ⚠️ A taxa vem PRONTA do hook (`rate`), já com `"—"` quando não há etapa
 * anterior. Recalculá-la aqui criaria a segunda divisão da mesma conta — que é
 * como nasceram os dois `div` de contratos opostos nesta base.
 *
 * ⛔ Substitui `ui/Funnel.tsx` (329 linhas), deletada. A lógica continua em
 * `lib/funnel.ts`; o que morreu foi o desenho antigo.
 */

export interface EtapaFunil {
  label: string;
  /** Já formatado com separador de milhar. */
  count: string;
  /** Altura relativa, já em `px` — vem do hook. */
  height: string;
  color: string;
  hasRate: boolean;
  /** `"63,2%"` ou `"—"`. Nunca recalculado aqui. */
  rate: string;
}

export function Funil({ etapas }: { etapas: EtapaFunil[] }) {
  if (etapas.length === 0) {
    return <p className="text-caption text-text-muted" style={{ margin: 0 }}>Sem dados de funil no período.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {etapas.map((e, i) => (
        <div key={e.label}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span className="text-caption text-text-secondary" style={{ flex: 1, minWidth: 0 }}>
              {e.label}
            </span>
            <span className="text-label text-text" style={{ fontVariantNumeric: "tabular-nums" }}>
              {e.count}
            </span>
            {/* A taxa só existe a partir do segundo passo — o primeiro não tem
                de onde cair. `hasRate` vem do hook justamente para a tela não
                ter de saber disso. */}
            {e.hasRate && (
              <span
                className="text-caption"
                style={{ color: "var(--tk-text-muted)", width: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                title={`Do passo anterior para ${e.label.toLowerCase()}`}
              >
                {e.rate}
              </span>
            )}
          </div>
          <div
            style={{
              /* A LARGURA é o dado — barra horizontal, não trapézio. O trapézio
                 do desenho antigo distorcia a leitura: a área do polígono não é
                 proporcional ao número, e o olho lê área.

                 🐛 ERA `calc(${e.height} / 120 * 100%)`, e **`e.height` já vem
                 com a unidade** (`"120px"`) — a expressão virava
                 `calc(120px / 120 * 100%)`, que é CSS inválido: mistura px com
                 porcentagem numa divisão. O navegador descarta a declaração e
                 TODA barra fica com 100%. Medido na tela: cliques 1.220 e
                 vendas 0 desenhavam a mesma barra — o gráfico afirmando que
                 ninguém desiste. `tsc`, `lint` e `build` passaram os três.

                 `parseFloat` tira o `px`; a conta vira número puro. */
              width: `${(parseFloat(e.height) / 120) * 100}%`,
              minWidth: 6,
              height: 22,
              borderRadius: "var(--tk-radius-controle)",
              background: e.color,
              opacity: 1 - i * 0.12,
            }}
          />
        </div>
      ))}
    </div>
  );
}
