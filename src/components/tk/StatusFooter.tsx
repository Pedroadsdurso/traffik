"use client";

import * as React from "react";

/**
 * StatusFooter — o rodapé de estado do SISTEMA.
 *
 * 🔴 Ele mede SAÚDE, não dinheiro, e essa é a distinção que justifica não ser
 * mais uma fileira de KPI. Os KPIs de cima respondem "como foi o período"; estes
 * respondem "a ferramenta está funcionando". Misturar os dois é como o Dashboard
 * antigo acabou com doze cards iguais: quando tudo tem o mesmo peso, nada tem.
 *
 * Cada bloco tem um número principal e uma segunda leitura opcional que só
 * aparece quando é ruim ("2 com erro"). Bloco silencioso = está tudo bem, e é
 * assim que a pessoa aprende a varrer o rodapé com o olho.
 */

export type BlocoEstado = {
  chave: string;
  rotulo: string;
  valor: string;
  /** Só aparece quando há o que reportar. Vermelho/âmbar conforme a gravidade. */
  alerta?: { texto: string; tom: "danger" | "warning" | "success" } | null;
  icone?: React.ReactNode;
  href?: string;
};

const TOM = {
  danger: "var(--tk-danger)",
  warning: "var(--tk-warning)",
  success: "var(--tk-success)",
} as const;

export function StatusFooter({ blocos }: { blocos: BlocoEstado[] }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--tk-gap-grid)",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      }}
    >
      {blocos.map((b) => {
        const conteudo = (
          <>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="text-caption text-text-muted" style={{ whiteSpace: "nowrap" }}>{b.rotulo}</div>
              <div className="text-metric-md text-text" style={{ whiteSpace: "nowrap" }}>{b.valor}</div>
              {b.alerta && (
                <div className="text-caption" style={{ color: TOM[b.alerta.tom], whiteSpace: "nowrap" }}>
                  {b.alerta.texto}
                </div>
              )}
            </div>
            {b.icone && (
              <span
                aria-hidden="true"
                /* §13 — QUADRADO ARREDONDADO E NEUTRO. Era tingido de marca, e a
                   diferença carrega significado: círculo tingido por categoria
                   CLASSIFICA uma linha ("isto é um erro"); quadrado neutro
                   ILUSTRA um bloco. Tingido de azul, o ícone do rodapé parecia
                   um selo de estado — e o estado do bloco é a linha colorida
                   logo acima dele, não o ícone. */
                className="bg-tint-neutral text-on-tint-neutral"
                style={{ width: 36, height: 36, flex: "none", borderRadius: 10, display: "grid", placeItems: "center" }}
              >
                {b.icone}
              </span>
            )}
          </>
        );

        const estilo: React.CSSProperties = {
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "var(--tk-pad-card)",
          borderRadius: "var(--tk-radius-card)",
          boxShadow: "var(--tk-shadow-card)",
          textDecoration: "none",
        };

        return b.href ? (
          <a key={b.chave} href={b.href} className="bg-surface border border-border transition-[background-color] hover:bg-surface-hover" style={estilo}>
            {conteudo}
          </a>
        ) : (
          <div key={b.chave} className="bg-surface border border-border" style={estilo}>
            {conteudo}
          </div>
        );
      })}
    </div>
  );
}
