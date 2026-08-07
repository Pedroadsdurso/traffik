"use client";

import * as React from "react";

/**
 * TabelaCampanhas — "as que mais faturaram no período".
 *
 * 🔴 SAIU DE DENTRO DO `DashboardScreen` (07/08/2026), onde era JSX solto com
 * largura cheia cravada. Virou componente por dois motivos, e o segundo é o que
 * importa: o bloco entrou no catálogo (tem alça e muda de largura), e a **ordem
 * em que as colunas desaparecem** é uma decisão de produto que precisa morar
 * junto do markup, não numa tela.
 *
 * ### ⛔ A ORDEM DE SACRIFÍCIO DAS COLUNAS
 *
 * `06` §"o que sai primeiro é sempre a coluna de APOIO, nunca a que responde a
 * pergunta do bloco". Aqui a pergunta é *"que campanha me deu dinheiro, e valeu
 * a pena?"* — então:
 *
 * | Coluna | Papel | Sai em |
 * |---|---|---|
 * | Campanha | a identidade | nunca |
 * | Receita | **a resposta** | nunca |
 * | ROAS | **o julgamento** | nunca |
 * | Vendas | apoio — o volume por trás da receita | < 440px úteis |
 * | Gasto | apoio — o ROAS já o incorpora | < 380px úteis |
 *
 * ⚠️ Gasto sai DEPOIS de Vendas mesmo sendo "mais importante" isolado, e a razão
 * é que o ROAS já é receita ÷ gasto: perder a coluna de gasto perde o número
 * cru, não o julgamento. Perder Vendas perde a única informação de volume da
 * linha, que nada mais recupera.
 *
 * ⛔ Nenhuma coluna some por caber "apertada". Some porque abaixo daquela
 * largura o nome da campanha seria truncado em três letras — e o nome é a única
 * coisa que torna a linha acionável.
 */

export interface LinhaCampanha {
  id: string;
  nome: string;
  receita: number;
  gasto: number;
  vendas: number;
  /** `null` quando não houve gasto — vira "—", nunca `0,00x`. */
  roas: number | null;
}

export function TabelaCampanhas({
  linhas,
  formatar,
  corDoRoas,
}: {
  linhas: LinhaCampanha[];
  formatar: (n: number) => string;
  /** A cor financeira do ROAS. Vem de fora: a regra de cor é do domínio. */
  corDoRoas: (roas: number) => string | undefined;
}) {
  return (
    /* 🎨 O CABEÇALHO APARECE UMA VEZ, e antes ele se repetia em TODA linha —
       "Receita / Gasto / Vendas / ROAS" quatro vezes por campanha, cinco
       campanhas, vinte rótulos para quatro colunas.

       Era o que mais fazia o bloco parecer protótipo ao lado da imagem 1, onde a
       tabela tem cabeçalho único. E não era só estética: rótulo repetido em toda
       linha faz o olho reler a estrutura a cada item em vez de varrer a coluna.

       ⛔ O cabeçalho e o corpo compartilham a MESMA `gridTemplateColumns`, pela
       classe `.tk-camp-linha`. Duas listas de coluna escritas à mão divergem no
       primeiro ajuste, e a divergência aparece como coluna desalinhada — que se
       atribui a arredondamento por semanas. */
    <div className="tk-camp" style={{ display: "flex", flexDirection: "column" }}>
      <div
        className="text-caption text-text-muted tk-camp-linha"
        style={{
          padding: "0 8px 6px",
          borderBottom: "1px solid var(--tk-border)",
          marginBottom: 2,
        }}
      >
        <span style={{ minWidth: 0 }}>Campanha</span>
        <span style={{ textAlign: "right" }}>Receita</span>
        <span className="tk-camp-gasto" style={{ textAlign: "right" }}>Gasto</span>
        <span className="tk-camp-vendas" style={{ textAlign: "right" }}>Vendas</span>
        <span style={{ textAlign: "right" }}>ROAS</span>
      </div>

      {linhas.map((c) => (
        <div key={c.id} className="tk-linha tk-camp-linha" style={{ minHeight: 40, padding: "0 8px", borderRadius: 8 }}>
          <span
            className="text-label text-text"
            style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {c.nome}
          </span>
          <Celula valor={formatar(c.receita)} />
          <Celula valor={formatar(c.gasto)} classe="tk-camp-gasto" />
          <Celula valor={String(c.vendas)} classe="tk-camp-vendas" />
          {/* 🔴 "—" quando não houve gasto. `0,00x` diria "gastou e não voltou
              nada", que é uma acusação diferente de "não gastou". */}
          <Celula
            valor={c.roas == null ? "—" : `${c.roas.toFixed(2).replace(".", ",")}x`}
            cor={c.roas == null ? undefined : corDoRoas(c.roas)}
          />
        </div>
      ))}
    </div>
  );
}

/** Uma célula numérica. O rótulo vive no cabeçalho. */
function Celula({ valor, cor, classe }: { valor: string; cor?: string; classe?: string }) {
  return (
    <span
      className={"text-label" + (classe ? ` ${classe}` : "")}
      style={{ textAlign: "right", minWidth: 0, color: cor ?? "var(--tk-text)", fontVariantNumeric: "tabular-nums" }}
    >
      {valor}
    </span>
  );
}
