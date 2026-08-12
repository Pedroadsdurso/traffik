"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { useOverlay } from "@/components/dashboard/ui/useOverlay";

/**
 * Gaveta lateral do sistema novo — o painel de detalhe que desliza da direita.
 *
 * > ### 🔴 POR QUE ELA NASCEU, se `ui/Drawer` já existe e funciona
 * >
 * > O `ui/Drawer` porta para o `<body>`, e **a ponte `.tk-tema` vive num `div`
 * > dentro do `AppShell`** — ou seja, fora do alcance do portal. O painel dele
 * > pinta com `--color-surface`/`--color-divider` do sistema LEGADO, enquanto o
 * > conteúdo escrito com os primitivos `tk/` pinta com `--tk-*`.
 * >
 * > O resultado é a costura mais visível que existe: moldura antiga em volta de
 * > conteúdo novo, na camada que cobre a tela inteira.
 *
 * ⛔ **Ela NÃO é um popup escrito à mão.** Passa pelo mesmo `useOverlay` do
 * `Drawer` e do `Modal`, que é onde vivem o portal (obrigatório: `position:fixed`
 * dentro de um ancestral com `transform` fica preso à caixa da página), o Esc, a
 * trava de scroll do fundo e o foco preso. Camada nova que não passe por ele
 * redescobre aquele bug inteiro.
 *
 * ⚠️ O `tk-tema` na raiz do portal não é redundância: é o que faz um componente
 * legado usado DENTRO da gaveta (`Icone`, `InfoTip`) resolver os tokens novos,
 * exatamente como no shell.
 */
export function Gaveta({
  aberta,
  titulo,
  descricao,
  largura = 560,
  aoFechar,
  children,
  rodape,
}: {
  aberta: boolean;
  titulo: string;
  descricao?: React.ReactNode;
  largura?: number;
  aoFechar: () => void;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  const { painelRef, podeRenderizar } = useOverlay(aberta, aoFechar);
  if (!podeRenderizar) return null;

  return createPortal(
    <div
      className="tk-tema tk-gaveta-fundo"
      onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}
    >
      <div
        ref={painelRef}
        /* ⚠️ O fundo é da CLASSE, não de `bg-surface`. Regra sem camada vence
           utilitário do Tailwind (que sai em `@layer utilities`), então as duas
           juntas dariam uma fonte vencedora e outra morta — a mesma armadilha do
           `a { color }` que pintou 6 de 10 âncoras do rail de azul. */
        className="tk-gaveta-painel"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        /* `min(largura, 100%)` é o clamp que já foi exercido em 430/390/360/320px
           no `Drawer`: sem ele a gaveta estoura a viewport no celular. */
        style={{ width: `min(${largura}px, 100%)` }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: "var(--tk-pad-card)",
            borderBottom: "1px solid var(--tk-border)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="text-h3 text-text">{titulo}</div>
            {descricao && (
              <p className="text-caption text-text-muted" style={{ margin: "4px 0 0", lineHeight: 1.6 }}>
                {descricao}
              </p>
            )}
          </div>
          {/* `data-fechar` mantém o contrato do `useOverlay`: ele foca o primeiro
              controle do painel que NÃO seja este, senão a gaveta abriria com o
              foco no botão de fechar. */}
          <button
            type="button"
            data-fechar
            onClick={aoFechar}
            aria-label="Fechar"
            className="text-text-secondary hover:text-text"
            style={{
              flex: "none",
              width: "var(--tk-altura-controle)",
              height: "var(--tk-altura-controle)",
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--tk-radius-controle)",
              border: "1px solid var(--tk-border)",
              background: "transparent",
              cursor: "pointer",
              fontSize: 15,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--tk-pad-card)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--tk-gap-grid)",
          }}
        >
          {children}
        </div>

        {rodape && (
          <footer
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              padding: "12px var(--tk-pad-card)",
              borderTop: "1px solid var(--tk-border)",
            }}
          >
            {rodape}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
