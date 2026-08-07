"use client";

import * as React from "react";

/**
 * ALÇA DE REDIMENSIONAR — o canto inferior direito do bloco, no modo de edição.
 *
 * ⛔ ELA NÃO CONHECE A GRADE. A alça sabe quantos pixels o ponteiro andou e
 * reporta o tamanho DESEJADO em px; quem converte para colunas, encaixa no passo
 * e aplica o mínimo do bloco é o hook. Ensinar a alça a fazer isso criaria a
 * segunda implementação da mesma regra — e a de cá não teria como avisar quando
 * divergisse do mínimo declarado.
 *
 * ### Por que Pointer Events e não o arrasto HTML5
 *
 * O `draggable` do HTML5 é para TRANSPORTAR uma coisa até outro lugar: ele leva
 * imagem de arrasto, `dataTransfer` e um `dragover` que só dispara de tempos em
 * tempos. Redimensionar é o oposto — é contínuo, não transporta nada e precisa
 * de cada quadro para o bloco encaixar debaixo do ponteiro.
 *
 * ⚠️ `setPointerCapture` não é detalhe: sem ele, arrastar rápido tira o ponteiro
 * de cima da alça e o gesto morre no meio, deixando o bloco num tamanho que o
 * usuário não escolheu.
 */

export function AlcaRedimensionar({
  rotulo,
  aoArrastar,
  aoTerminar,
  aoTeclado,
}: {
  /** Nomeia o bloco. Só-ícone sem rótulo é controle mudo para leitor de tela. */
  rotulo: string;
  /** Tamanho desejado, em px, a cada quadro. */
  aoArrastar: (larguraPx: number, alturaPx: number) => void;
  aoTerminar?: () => void;
  /**
   * Setas do teclado: `(dCol, dLinhas)` em PASSOS, não em pixels.
   *
   * ⛔ Arrasto não tem equivalente de teclado, e uma alça que só responde ao
   * mouse é um controle que parte dos usuários não tem. Aqui o passo é discreto
   * porque é o que o teclado sabe expressar.
   */
  aoTeclado: (dCol: number, dLinhas: number) => void;
}) {
  const [ativa, setAtiva] = React.useState(false);

  const mover = React.useCallback(
    (e: React.PointerEvent) => {
      if (!ativa) return;
      const bloco = e.currentTarget.parentElement;
      if (!bloco) return;
      const r = bloco.getBoundingClientRect();
      // O tamanho desejado é a distância do canto superior esquerdo até o ponteiro.
      aoArrastar(Math.max(0, e.clientX - r.left), Math.max(0, e.clientY - r.top));
    },
    [ativa, aoArrastar],
  );

  return (
    <button
      type="button"
      aria-label={`Redimensionar ${rotulo}`}
      title="Arraste para redimensionar · setas ajustam por passo"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setAtiva(true);
      }}
      onPointerMove={mover}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        setAtiva(false);
        aoTerminar?.();
      }}
      onPointerCancel={() => {
        setAtiva(false);
        aoTerminar?.();
      }}
      onKeyDown={(e) => {
        const passos: Record<string, [number, number]> = {
          ArrowRight: [1, 0],
          ArrowLeft: [-1, 0],
          ArrowDown: [0, 1],
          ArrowUp: [0, -1],
        };
        const p = passos[e.key];
        if (!p) return;
        e.preventDefault();
        aoTeclado(p[0], p[1]);
      }}
      className="text-text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1"
      style={{
        position: "absolute",
        right: 2,
        bottom: 2,
        width: 18,
        height: 18,
        padding: 0,
        border: 0,
        background: "transparent",
        cursor: "nwse-resize",
        // `touch-action: none` — sem isto o navegador rola a página em vez de
        // deixar o ponteiro chegar aqui, e a alça não funciona no toque.
        touchAction: "none",
        display: "grid",
        placeItems: "center",
        lineHeight: 1,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none">
        <path d="M9 1v8H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
        <path d="M9 5v4H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}
