"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";

import { sx } from "@/lib/sx";
import { useOverlay } from "./useOverlay";

/**
 * Gaveta lateral que desliza da direita — o padrão de "revelar sob demanda" da
 * ferramenta: a listagem mostra só o essencial, e o detalhe (URL de webhook,
 * token, script, configuração) vive aqui dentro.
 *
 * Acessibilidade que um `<div>` solto não daria: fecha no Esc, trava o scroll do
 * fundo, devolve o foco a quem abriu e prende o Tab dentro da gaveta enquanto
 * estiver aberta.
 */
export function Drawer({
  aberta,
  titulo,
  descricao,
  largura = 520,
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
  // Mesmo comportamento do Modal: portal, Esc, trava de scroll e foco preso.
  const { painelRef, podeRenderizar } = useOverlay(aberta, onClose);
  if (!podeRenderizar) return null;


  // Portal para o <body>: a gaveta é `position:fixed`, e qualquer ancestral com
  // `transform` (a animação `.page-enter` do shell) ou `overflow` vira o bloco
  // de contenção dela — foi o que fazia o painel abrir com a altura colapsada.
  return createPortal(
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={painelRef}
        className="drawer-painel"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={sx(`width:min(${largura}px, 100%)`)}
      >
        <header style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);padding:var(--space-4) var(--space-4) var(--space-3);border-bottom:1px solid var(--color-divider)")}>
          <div style={sx("min-width:0")}>
            <div className="card-title" style={sx("font-size:17px")}>{titulo}</div>
            {descricao && (
              <p className="card-body" style={sx("margin:4px 0 0;font-size:12.5px")}>{descricao}</p>
            )}
          </div>
          <button type="button" className="btn btn-ghost" data-fechar onClick={onClose}
            aria-label="Fechar" style={sx("padding:4px 9px;font-size:15px;line-height:1")}>
            ✕
          </button>
        </header>

        <div style={sx("flex:1;overflow-y:auto;padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-4)")}>
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

/**
 * Campo de leitura com botão de copiar — o jeito padrão de revelar um valor
 * sensível (URL de webhook, chave, id) dentro de uma gaveta.
 */
export function CampoCopiavel({
  label,
  valor,
  dica,
  mono = true,
}: {
  label: string;
  valor: string;
  dica?: string;
  mono?: boolean;
}) {
  const copiadoRef = useRef<HTMLSpanElement>(null);

  function copiar() {
    navigator.clipboard.writeText(valor).then(() => {
      const el = copiadoRef.current;
      if (!el) return;
      el.textContent = "Copiado!";
      setTimeout(() => (el.textContent = "Copiar"), 1500);
    });
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div style={sx("display:flex;gap:8px;align-items:stretch")}>
        <input className="input" readOnly value={valor}
          onFocus={(e) => e.currentTarget.select()}
          style={sx(mono ? "font-family:ui-monospace,monospace;font-size:12.5px" : "")} />
        <button type="button" className="btn btn-secondary" onClick={copiar} style={sx("white-space:nowrap;flex:none")}>
          <span ref={copiadoRef}>Copiar</span>
        </button>
      </div>
      {dica && <p className="text-muted" style={sx("margin:5px 0 0;font-size:11.5px;line-height:1.5")}>{dica}</p>}
    </div>
  );
}
