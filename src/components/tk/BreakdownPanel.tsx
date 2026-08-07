"use client";

import * as React from "react";

/**
 * BreakdownPanel — "quanto veio de cada X", para qualquer X.
 *
 * 🔴 ELE ABSORVE TRÊS BLOCOS: Fontes de tráfego, Produtos e Formas de pagamento.
 * Os três respondem a mesma pergunta com uma dimensão diferente — nome, valor,
 * participação, barra —, e a versão antiga tinha três componentes quase iguais.
 *
 * ⛔ Três componentes quase iguais divergem sempre, e divergem em silêncio: um
 * ganha o rótulo de participação, outro não; um arredonda para inteiro, outro
 * não. O usuário lê os três lado a lado e não sabe qual está certo.
 *
 * ### O que é prop e o que NÃO é
 *
 * `mostrarVendas` existe porque Produtos e Pagamentos têm contagem e Fontes não
 * — uma coluna a mais. **Uma prop booleana por uma coluna é mais barato que um
 * quarto componente**, e o limite é conhecido: quando as diferenças passarem de
 * duas ou três props, a abstração está sendo forçada e o certo é separar. Forçar
 * abstração para ganhar um número é como nascem componentes com dez props.
 */

export interface LinhaBreakdown {
  name: string;
  totalLabel: string;
  /** Já formatado — `"32%"` ou `"—"` quando não há total sobre o que calcular. */
  pctLabel?: string;
  /** Largura da barra, já em `%`. */
  barWidth: string;
  /** Contagem de vendas. Só aparece com `mostrarVendas`. */
  sales?: number;
  count?: number;
}

export function BreakdownPanel({
  linhas,
  rotuloDimensao,
  mostrarVendas = false,
}: {
  linhas: LinhaBreakdown[];
  /** "Fonte", "Produto", "Forma" — vai para o cabeçalho da coluna. */
  rotuloDimensao: string;
  mostrarVendas?: boolean;
}) {
  if (linhas.length === 0) {
    return (
      <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.45 }}>
        Nada para mostrar neste período.
      </p>
    );
  }

  /* 🔴 COLUNA SEM DADO NÃO É COLUNA DE "—". `v.placements` não traz `pctLabel`:
     o denominador dele seria o faturamento com posicionamento conhecido, que
     NÃO é o faturamento total — parte das vendas não tem `{{placement}}`. Uma
     coluna inteira de traços gasta 44px para afirmar que não sabemos, e o
     cabeçalho `%` promete um número que nunca vem.

     ⚠️ A checagem é `!== undefined`, não truthy: `pctLabel` legítimo pode ser
     a string `"—"` de UMA linha (denominador zero naquela linha), e isso é
     diferente da dimensão inteira não ter participação. */
  const temPct = linhas.some((l) => l.pctLabel !== undefined);

  return (
    <div className="tk-breakdown" style={{ display: "flex", flexDirection: "column" }}>
      <div
        className="text-caption text-text-muted"
        style={{ display: "flex", gap: 10, padding: "0 8px 6px", borderBottom: "1px solid var(--tk-border)", marginBottom: 2 }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>{rotuloDimensao}</span>
        {mostrarVendas && <span style={{ width: 54, textAlign: "right" }}>Vendas</span>}
        <span style={{ width: 78, textAlign: "right" }}>Receita</span>
        {temPct && <span className="tk-col-pct" style={{ width: 44, textAlign: "right" }}>%</span>}
      </div>

      {/* 🎨 A BARRA DE PROPORÇÃO FICA ATRÁS DO TEXTO (`06` §8), e não numa linha
          própria embaixo. Três ganhos, e o terceiro é o que importa:

          1. some uma linha por item — a lista encolhe quase à metade;
          2. a comparação entre linhas passa a ser lida no MESMO gesto em que se
             lê o nome, em vez de exigir um segundo passe pelos tracinhos;
          3. a borda entre linhas some. Com a barra embaixo, ela era necessária
             para dizer onde um item termina; com o preenchimento, cada linha já
             é um bloco. Separação por ESPAÇO e por hover, que é o §8 inteiro.

          ⚠️ A barra é RELATIVA AO MAIOR da lista, não ao total. Ela existe para
          comparar as linhas entre si; a participação no total é a coluna de %.
          `barWidth` já vem calculada do hook — aqui não se divide nada, que é
          como nasceram os dois `div` de contratos opostos. */}
      {linhas.map((l) => (
        <div
          key={l.name}
          className="tk-linha"
          style={{ position: "relative", padding: "0 8px", borderRadius: 8, overflow: "hidden" }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: l.barWidth,
              /* 10% (`06` §8). Mais que isso e o preenchimento compete com o
                 texto por cima dele; menos e some no tema claro. */
              background: "color-mix(in oklch, var(--tk-primary) 10%, transparent)",
            }}
          />
          <div style={{ position: "relative", display: "flex", gap: 10, alignItems: "center", minHeight: 40 }}>
            <span
              className="text-label text-text"
              style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {l.name}
            </span>
            {mostrarVendas && (
              <span className="text-caption text-text-secondary" style={{ width: 54, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {l.sales ?? l.count ?? 0}
              </span>
            )}
            <span className="text-label text-text" style={{ width: 78, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {l.totalLabel}
            </span>
            {/* `pctLabel` já vem "—" quando não há denominador — ver `pct1` no
                hook. Aqui não se recalcula nada: dois lugares fazendo a mesma
                divisão é como nasceram os dois `div` de contratos opostos. */}
            {temPct && (
              <span className="text-caption text-text-muted tk-col-pct" style={{ width: 44, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {l.pctLabel ?? "—"}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
