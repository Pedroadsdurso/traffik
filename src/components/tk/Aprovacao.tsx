"use client";

import * as React from "react";

/**
 * Taxa de aprovação por forma de pagamento.
 *
 * 🔴 A PERGUNTA QUE ELE RESPONDE não é "quanto vendi no Pix" — isso é o
 * `BreakdownPanel`. É **"quantas das que eu gerei foram aprovadas"**, que é a
 * diferença entre um gateway saudável e um recusando cartão. Por isso as duas
 * contagens ficam visíveis ao lado da taxa: `pagas de geradas` é o que permite
 * desconfiar de uma taxa alta sobre 3 tentativas.
 *
 * ⚠️ A `rate` vem do servidor. **Não recalculo aqui** — nem quando o
 * denominador é zero: quem decide o que fazer com "zero geradas" é quem tem a
 * conta, e duas divisões da mesma coisa divergem sempre.
 */

export interface LinhaAprovacao {
  name: string;
  geradas: number;
  pagas: number;
  /** Percentual 0–100, já calculado pelo servidor. */
  rate: number;
}

/** Verde acima de 80, atenção entre 50 e 80, vermelho abaixo. */
function tom(rate: number, geradas: number): string {
  /* ⚠️ Com pouquíssimas tentativas a taxa não é sinal — 1 de 1 é 100% e não diz
     nada. Abaixo de 5 geradas a cor fica NEUTRA em vez de verde: pintar de
     verde uma amostra de uma venda é a tela afirmando confiança que não tem. */
  if (geradas < 5) return "var(--tk-text-muted)";
  if (rate >= 80) return "var(--tk-success)";
  if (rate >= 50) return "var(--tk-warning)";
  return "var(--tk-danger)";
}

export function Aprovacao({ linhas }: { linhas: LinhaAprovacao[] }) {
  if (linhas.length === 0) {
    return <p className="text-caption text-text-muted" style={{ margin: 0 }}>Nenhuma venda gerada no período.</p>;
  }

  return (
    <div className="tk-aprov" style={{ display: "flex", flexDirection: "column" }}>
      {linhas.map((l, i) => {
        const cor = tom(l.rate, l.geradas);
        return (
          <div key={l.name} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--tk-border)" : undefined }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="text-label text-text" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {l.name}
              </span>
              <span className="text-caption text-text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                {l.pagas} de {l.geradas}
              </span>
              <span className="text-label" style={{ color: cor, width: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {l.rate.toFixed(0)}%
              </span>
            </div>
            <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: "var(--tk-surface-hover)", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, Math.max(0, l.rate))}%`, height: "100%", background: cor, borderRadius: 2 }} />
            </div>
          </div>
        );
      })}
      <p className="text-caption text-text-muted" style={{ margin: "8px 0 0", lineHeight: 1.4 }}>
        Formas com menos de 5 tentativas ficam sem cor — a taxa ainda não é sinal.
      </p>
    </div>
  );
}
