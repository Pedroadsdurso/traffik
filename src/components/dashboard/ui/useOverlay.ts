"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Comportamento compartilhado por **todas** as camadas flutuantes da ferramenta
 * (gaveta lateral e modal). Existe para que a correção do bug de sobreposição
 * viva num lugar só e não precise ser redescoberta a cada popup novo.
 *
 * ⚠️ **O portal para o `<body>` é obrigatório, não estético.** Um overlay é
 * `position:fixed`, e qualquer ancestral com `transform` passa a ser o bloco de
 * contenção dele — o `.page-enter` do shell (que anima com `translateY`) fazia
 * exatamente isso. O resultado eram popups presos ao topo da página, cortados,
 * com o conteúdo de trás vazando por cima porque o fundo escuro cobria apenas a
 * caixa da página, não a viewport.
 *
 * Devolve, além do portal: fechar no Esc, trava do scroll do fundo, foco preso
 * dentro da camada e foco devolvido a quem abriu.
 */
export function useOverlay(aberta: boolean, onClose: () => void) {
  const painelRef = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  // `document` não existe no SSR; só portamos depois de montar.
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!aberta) return;
    focoAnterior.current = document.activeElement as HTMLElement | null;

    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const foco = painelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!foco || foco.length === 0) return;
      const primeiro = foco[0]!;
      const ultimo = foco[foco.length - 1]!;
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    const t = setTimeout(() => {
      painelRef.current
        ?.querySelector<HTMLElement>("input, select, textarea, button:not([data-fechar])")
        ?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflowAntes;
      clearTimeout(t);
      focoAnterior.current?.focus?.();
    };
  }, [aberta, onClose]);

  return { painelRef, podeRenderizar: aberta && montado };
}
