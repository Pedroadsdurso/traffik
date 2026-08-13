"use client";

import * as React from "react";

import { useTamanho } from "@/components/dashboard/ui/useTamanho";
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

/** Largura do rótulo da forma + folgas, dentro do medidor. */
const GAP = 16;
/** Abaixo de `sm` (§4) o arco não se lê: os medidores viram barras. */
const SM = 300;

/**
 * 🔴 F3 — AS BARRAS HORIZONTAIS, abaixo de `sm` (C5 do `07`).
 *
 * Quatro arcos de 60px lado a lado não são quatro medidores: são quatro manchas.
 * A barra reta perde a leitura "de tudo que esta forma gerou" — mas com o
 * denominador ao lado, **por linha**, ela recupera exatamente o que o arco dizia,
 * e cabe.
 *
 * ⚠️ O `tom` continua vindo de fora e continua NEUTRO abaixo de 5 tentativas.
 * Trocar a forma do desenho não pode trocar a regra de confiança — foi para isso
 * que o `MedidorRadial` nunca decidiu a própria cor.
 */
function BarrasDeAprovacao({ linhas }: { linhas: LinhaAprovacao[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
      {linhas.map((l) => (
        <div key={l.name} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span className="text-caption text-text" style={{ flex: "none", width: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {l.name}
          </span>
          <span aria-hidden="true" style={{ flex: 1, minWidth: 0, height: 8, borderRadius: "var(--tk-radius-pill)", background: "var(--tk-surface-hover)", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${Math.min(100, Math.max(0, l.rate))}%`, background: tom(l.rate, l.geradas), borderRadius: "var(--tk-radius-pill)" }} />
          </span>
          <span className="text-caption" style={{ flex: "none", color: tom(l.rate, l.geradas), fontVariantNumeric: "tabular-nums" }}>
            {l.rate.toFixed(0)}%
          </span>
          {/* O DENOMINADOR fica, e é o que impede a barra de mentir sobre 1 de 1. */}
          <span className="text-caption text-text-muted" style={{ flex: "none", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {l.pagas}/{l.geradas}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Aprovacao({ linhas }: { linhas: LinhaAprovacao[] }) {
  /**
   * §4 — `diâmetro = min((cw − gaps) / n, ch − rótulo)`.
   *
   * ⛔ Os dois termos importam, e a primeira versão só tinha o primeiro
   * (`--tk-b-radial`, derivado de `cqw`): a largura decidia sozinha, os quatro
   * medidores não cabiam na linha e o `flex-wrap` os empilhava em duas fileiras —
   * o bloco estourava por ALTURA por causa de uma decisão de LARGURA.
   */
  const { ref, largura: cw, altura: ch } = useTamanho<HTMLDivElement>();
  const n = Math.max(1, linhas.length);
  /* ~20px do rótulo da forma, que fica FORA do medidor, embaixo dele. */
  const ROTULO = 20;
  const porLargura = (cw - GAP * (n - 1)) / n;
  const porAltura = ch - ROTULO;
  /* O piso de 56 é onde o arco de 24 barras ainda tem barras distinguíveis.
     Abaixo dele a resposta não é encolher mais — é trocar de forma. */
  const diametro = cw > 0 && ch > 0 ? Math.max(56, Math.floor(Math.min(porLargura, porAltura))) : undefined;

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
    /* ⚠️ `height: 100%` + a fileira em `flex: 1` — F1, 12/08/2026. Sem eles o
       `MedidorRadial` não tem contra o que resolver o `height: 100%` dele e cai
       no piso de 88px, ignorando o slot. É a cadeia inteira que precisa de
       altura definida, não só a ponta. */
    <div className="tk-aprov" style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0, overflow: "hidden" }}>
      <div ref={ref} style={{ display: "flex", flexWrap: "nowrap", gap: GAP, justifyContent: "center", flex: 1, minHeight: 0 }}>
        {/* ⛔ `nowrap`, e não `wrap`. Era `wrap`, e a quebra é justamente o modo
            de falha: com o diâmetro derivado só da largura, os medidores não
            cabiam e a fileira virava duas, dobrando a altura do bloco. Com o
            diâmetro medido eles cabem por construção — e se um dia não couberem,
            o `nowrap` faz aparecer na hora em vez de crescer em silêncio. */}
        {cw > 0 && cw < SM ? (
          <BarrasDeAprovacao linhas={linhas} />
        ) : (
        linhas.map((l) => {
          const cor = tom(l.rate, l.geradas);
          return (
            <div
              key={l.name}
              title={`${l.name}: ${l.pagas} aprovadas de ${l.geradas} geradas`}
              /* `minmax(0, 1fr) auto`: o medidor fica com a folga da coluna e o
                 rótulo com o que ele precisa. Sem a primeira faixa em `1fr` o
                 medidor voltaria a ter altura de conteúdo. */
              style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr) auto", justifyItems: "center", gap: 2, minWidth: 0, alignContent: "center" }}
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
                diametro={diametro}
              />
              <span
                className="text-label text-text"
                style={{ maxWidth: diametro ?? 124, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}
              >
                {l.name}
              </span>
            </div>
          );
        })
        )}
      </div>

      <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.4 }}>
        Formas com menos de 5 tentativas ficam sem cor — a taxa ainda não é sinal.
      </p>
    </div>
  );
}
