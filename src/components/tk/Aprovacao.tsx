"use client";

import * as React from "react";

import { MedidorRadial } from "./MedidorRadial";

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
    /* 🎨 MEDIDOR RADIAL POR FORMA, em vez de barra reta empilhada (`06` §6).
       A barra reta é a leitura errada para uma TAXA: ela se lê como "quanto de
       um total", e aqui não há total — cada forma tem o seu próprio
       denominador. O arco fechado diz "de tudo que esta forma gerou", que é a
       pergunta do bloco.

       ⛔ `flex-wrap` e não grade de N colunas: são 1 a 6 formas de pagamento, e
       uma grade fixa deixaria buraco com duas ou espremeria com seis. */
    <div className="tk-aprov" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
        {linhas.map((l) => {
          const cor = tom(l.rate, l.geradas);
          return (
            <div
              key={l.name}
              title={`${l.name}: ${l.pagas} aprovadas de ${l.geradas} geradas`}
              style={{ display: "grid", justifyItems: "center", gap: 2, minWidth: 0 }}
            >
              <MedidorRadial
                valor={l.rate}
                cor={cor}
                rotulo={`${l.rate.toFixed(0)}%`}
                /* `pagas de geradas` fica DENTRO do medidor de propósito: é o
                   denominador, e é ele que permite desconfiar de uma taxa alta
                   sobre 3 tentativas. Longe do número, ninguém liga os dois. */
                texto={`${l.pagas} de ${l.geradas}`}
                tamanho={124}
              />
              <span
                className="text-label text-text"
                style={{ maxWidth: 124, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}
              >
                {l.name}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.4 }}>
        Formas com menos de 5 tentativas ficam sem cor — a taxa ainda não é sinal.
      </p>
    </div>
  );
}
