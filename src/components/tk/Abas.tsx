"use client";

import * as React from "react";

/**
 * Abas — navegação por SEÇÃO, com sublinhado no ativo.
 *
 * ⚠️ NÃO É O `Segmented`, e a diferença não é estética. O `Segmented` troca a
 * LENTE sobre o mesmo conjunto (Diário/Semanal, Ranking/Globo): as opções são
 * simétricas e nenhuma é "a principal". A aba RECORTA o conjunto — `Todas` é o
 * estado de partida e as outras são subconjuntos dela. Por isso o ativo ganha
 * uma âncora na régua, e não uma cápsula solta.
 *
 * ⛔ E ela não vive em cabeçalho de cartão. Lá o controle é um só, com a caixa
 * de `--tk-altura-controle` (`06` §14.1); aqui a fileira é a divisória entre o
 * cabeçalho da seção e o conteúdo dela.
 *
 * ## A contagem é opcional, e quando existe ela tem de bater com a lista
 *
 * 🔴 Este componente já custou um bug nesta base — em outra encarnação, escrita
 * à mão: a contagem da aba vinha do array cru e a tabela aplicava mais um
 * filtro, então a tela dizia **"12 campanhas" com a tabela vazia**. Quem passa
 * `contagem` tem de contá-la com EXATAMENTE os mesmos filtros que produzem as
 * linhas.
 */

export type Aba<T extends string> = {
  id: T;
  rotulo: string;
  /** Opcional — ver o ⚠️ do cabeçalho. */
  contagem?: number;
};

export function Abas<T extends string>({
  abas,
  ativa,
  aoTrocar,
  rotuloAcessivel,
}: {
  abas: readonly Aba<T>[];
  ativa: T;
  aoTrocar: (id: T) => void;
  rotuloAcessivel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={rotuloAcessivel}
      style={{
        display: "flex",
        gap: 2,
        borderBottom: "1px solid var(--tk-border)",
        /* Rola na horizontal em vez de quebrar em duas fileiras: aba na segunda
           linha perde a relação com a régua e passa a parecer outro controle. */
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      {abas.map((a) => {
        const sel = a.id === ativa;
        return (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={sel}
            onClick={() => aoTrocar(a.id)}
            className={`text-label ${sel ? "text-text" : "text-text-secondary hover:text-text"}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 12px",
              whiteSpace: "nowrap",
              /* O sublinhado come a régua: `-1` faz os 2px do ativo cobrirem o
                 1px do contêiner, em vez de empilharem 3px de linha. */
              borderBottom: `2px solid ${sel ? "var(--tk-primary)" : "transparent"}`,
              marginBottom: -1,
              transition: "color var(--tk-dur-rapida) var(--tk-ease-padrao)",
            }}
          >
            {a.rotulo}
            {a.contagem != null && (
              /* A contagem é APOIO, não estado: fundo neutro sempre, inclusive
                 na aba ativa. Tingi-la de primary faria duas coisas dizerem
                 "esta está selecionada" e nenhuma dizer "há 12 aqui". */
              <span
                className="text-caption bg-tint-neutral text-on-tint-neutral"
                style={{
                  padding: "0 6px",
                  borderRadius: "var(--tk-radius-pill)",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: "18px",
                }}
              >
                {a.contagem}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
