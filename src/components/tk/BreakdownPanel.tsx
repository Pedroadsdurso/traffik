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

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        className="text-caption text-text-muted"
        style={{ display: "flex", gap: 10, paddingBottom: 6, borderBottom: "1px solid var(--tk-border)" }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>{rotuloDimensao}</span>
        {mostrarVendas && <span style={{ width: 54, textAlign: "right" }}>Vendas</span>}
        <span style={{ width: 78, textAlign: "right" }}>Receita</span>
        <span style={{ width: 44, textAlign: "right" }}>%</span>
      </div>

      {linhas.map((l) => (
        <div key={l.name} style={{ padding: "8px 0", borderBottom: "1px solid var(--tk-border)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
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
            <span className="text-caption text-text-muted" style={{ width: 44, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {l.pctLabel ?? "—"}
            </span>
          </div>
          {/* A barra é RELATIVA AO MAIOR da lista, não ao total — quem já vem
              calculada é a `barWidth` do hook. Ela existe para comparar as
              linhas entre si; a participação no total é a coluna de %. */}
          <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: "var(--tk-surface-hover)", overflow: "hidden" }}>
            <div style={{ width: l.barWidth, height: "100%", background: "var(--tk-primary)", borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
