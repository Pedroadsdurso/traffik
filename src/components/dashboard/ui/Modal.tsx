"use client";

import { createPortal } from "react-dom";

import { sx } from "@/lib/sx";
import { useOverlay } from "./useOverlay";

/**
 * Modal centralizado — o **único** jeito de abrir popup na ferramenta.
 *
 * Compartilha o `useOverlay` com a gaveta lateral, o que garante o portal para o
 * `<body>`. Sem ele, o overlay herda como bloco de contenção qualquer ancestral
 * transformado (o `.page-enter` do shell) e o popup aparece colado no topo,
 * cortado e com o conteúdo de trás vazando por cima.
 *
 * O corpo rola por dentro quando o conteúdo passa da altura da tela, então o
 * modal nunca estoura a viewport.
 */
export function Modal({
  aberta,
  titulo,
  descricao,
  largura = 460,
  onClose,
  children,
  rodape,
}: {
  aberta: boolean;
  titulo: string;
  descricao?: string;
  largura?: number;
  onClose: () => void;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  const { painelRef, podeRenderizar } = useOverlay(aberta, onClose);
  if (!podeRenderizar) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      // `mousedown` no próprio backdrop: com `click` um arraste que começa
      // dentro do modal e termina fora fecharia sem o usuário querer.
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={painelRef}
        className="modal-painel"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={sx(`width:min(${largura}px, 100%)`)}
      >
        <header style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);padding:var(--space-4) var(--space-4) var(--space-3);border-bottom:1px solid var(--color-divider)")}>
          <div style={sx("min-width:0")}>
            <div className="card-title" style={sx("font-size:16px")}>{titulo}</div>
            {descricao && <p className="card-body" style={sx("margin:4px 0 0;font-size:12.5px")}>{descricao}</p>}
          </div>
          <button type="button" className="btn btn-ghost" data-fechar onClick={onClose}
            aria-label="Fechar" style={sx("padding:4px 9px;font-size:15px;line-height:1")}>
            ✕
          </button>
        </header>

        <div style={sx("flex:1;min-height:0;overflow-y:auto;padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-3)")}>
          {children}
        </div>

        {rodape && (
          <footer style={sx("display:flex;justify-content:flex-end;gap:var(--space-2);padding:var(--space-3) var(--space-4);border-top:1px solid var(--color-divider)")}>
            {rodape}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
