"use client";

import * as React from "react";

import { Select } from "./Select";
import { Icone } from "@/components/dashboard/ui/Icone";

/**
 * Paginação — `Mostrando 1 a 10 de 40` · `‹ 1 2 3 … 6 ›` · `10 por página`.
 *
 * ⚠️ A FRASE DA ESQUERDA NÃO É DECORAÇÃO. Sem ela, uma tabela paginada afirma
 * que as dez linhas visíveis são tudo o que existe — e no Gerenciador isso é a
 * diferença entre "minha conta tem 10 campanhas" e "estou vendo 10 das 40". Os
 * KPIs em cima somam as 40; o rodapé é o que explica por que os números não
 * batem com a soma do que está na tela.
 *
 * ⛔ Sem "Ir para a página ___". Campo de digitação para navegar entre seis
 * páginas custa mais atenção do que economiza, e a busca acima resolve melhor o
 * caso que ele atenderia (achar uma campanha específica).
 */

const POR_PAGINA = [10, 25, 50, 100] as const;
export type PorPagina = (typeof POR_PAGINA)[number];

/**
 * As páginas a desenhar, com `null` onde entra a reticência.
 *
 * A regra: primeira, última, a atual e as vizinhas dela. Entre blocos que não se
 * tocam, uma reticência — que **não é clicável**, de propósito: um "…" que salta
 * cinco páginas leva a pessoa para um lugar que ela não escolheu.
 */
export function paginasVisiveis(atual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const perto = new Set([1, total, atual, atual - 1, atual + 1]);
  const saida: (number | null)[] = [];
  for (let p = 1; p <= total; p++) {
    if (perto.has(p)) saida.push(p);
    // Só UMA reticência por buraco: a condição olha o último item empurrado.
    else if (saida[saida.length - 1] !== null) saida.push(null);
  }
  return saida;
}

export function Paginacao({
  total,
  pagina,
  porPagina,
  aoTrocarPagina,
  aoTrocarPorPagina,
  substantivo,
}: {
  /** Quantas linhas existem NO FILTRO — não quantas cabem na página. */
  total: number;
  pagina: number;
  porPagina: PorPagina;
  aoTrocarPagina: (p: number) => void;
  aoTrocarPorPagina: (n: PorPagina) => void;
  /** "campanhas", "conjuntos", "anúncios" — o rodapé fala o vocabulário do nível. */
  substantivo: string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const primeira = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ultima = Math.min(total, pagina * porPagina);

  const botao: React.CSSProperties = {
    minWidth: "var(--tk-altura-controle)",
    height: "var(--tk-altura-controle)",
    borderRadius: "var(--tk-radius-controle)",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    padding: "0 8px",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span className="text-caption text-text-muted">
        Mostrando {primeira} a {ultima} de {total} {substantivo}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <nav aria-label="Páginas" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            onClick={() => aoTrocarPagina(pagina - 1)}
            disabled={pagina <= 1}
            aria-label="Página anterior"
            className="bg-transparent border border-border text-text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
            style={botao}
          >
            <Icone nome="chevronDireita" tamanho={14} style={{ transform: "rotate(180deg)" }} />
          </button>

          {paginasVisiveis(pagina, paginas).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="text-caption text-text-muted" style={{ padding: "0 4px" }} aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => aoTrocarPagina(p)}
                aria-current={p === pagina ? "page" : undefined}
                className={
                  "text-label border " +
                  (p === pagina
                    ? "bg-primary-solid text-on-primary border-transparent"
                    : "bg-transparent text-text-secondary border-border hover:bg-surface-hover")
                }
                style={{ ...botao, fontVariantNumeric: "tabular-nums" }}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => aoTrocarPagina(pagina + 1)}
            disabled={pagina >= paginas}
            aria-label="Próxima página"
            className="bg-transparent border border-border text-text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
            style={botao}
          >
            <Icone nome="chevronDireita" tamanho={14} />
          </button>
        </nav>

        <div style={{ width: 150 }}>
          <Select
            opcoes={POR_PAGINA.map((n) => ({ valor: String(n), rotulo: `${n} por página` }))}
            valor={String(porPagina)}
            aoEscolher={(v) => aoTrocarPorPagina(Number(v) as PorPagina)}
          />
        </div>
      </div>
    </div>
  );
}
