"use client";

import * as React from "react";
import { createPortal } from "react-dom";

/**
 * Popover — a base de TODA camada flutuante NÃO-modal do sistema novo
 * (Tooltip, Select, DropdownMenu, Combobox).
 *
 * ⚠️ O PORTAL PARA O `<body>` É OBRIGATÓRIO, NÃO ESTÉTICO. Um overlay é
 * `position: fixed`, e qualquer ancestral com `transform` vira o bloco de
 * contenção dele. O `.page-enter` do shell anima com `translateY`, então uma
 * camada escrita direto na árvore da página cobre apenas a caixa da página:
 * aparece colada no topo, cortada, com o conteúdo de trás vazando por cima.
 * Essa é a causa raiz que o `dashboard/ui/useOverlay.ts` já corrigiu para gaveta
 * e modal, e ela vale igual aqui.
 *
 * 🔴 POR QUE NÃO REUSAR O `useOverlay` — os dois NÃO são a mesma coisa.
 *
 * | | `useOverlay` (gaveta, modal) | este (popover, dropdown) |
 * |---|---|---|
 * | scroll do fundo | **trava** | **não trava** — a página tem de rolar |
 * | foco | **preso dentro** | livre; volta ao gatilho ao fechar |
 * | rolar a página | não acontece (travado) | **fecha a camada** |
 * | clique fora | no backdrop | em qualquer lugar |
 *
 * Um dropdown que trava o scroll do fundo é um bug, e um que prende o foco é
 * outro. Reusar o hook modal aqui pareceria economia e entregaria os dois.
 *
 * ✅ E ele CONSERTA a limitação conhecida do `.tk-pop` legado, que está escrita
 * no `globals.css`: lá a ancoragem é `left: 0` fixo, e o comentário admite que
 * "um seletor colado na borda direita ainda pode transbordar para fora". Aqui a
 * posição é medida e **grudada na borda da viewport** quando não cabe — vira e
 * encolhe em vez de vazar.
 */

export type LadoPopover = "baixo" | "cima";
export type AlinhamentoPopover = "inicio" | "fim" | "centro";

const MARGEM = 8; // respiro entre a camada e a borda da viewport
const AFASTAMENTO = 6; // distância entre o gatilho e a camada

type Posicao = { top: number; left: number; maxHeight: number; lado: LadoPopover };

export function usePopover() {
  const [aberto, setAberto] = React.useState(false);
  const gatilhoRef = React.useRef<HTMLElement | null>(null);
  return { aberto, abrir: () => setAberto(true), fechar: () => setAberto(false), alternar: () => setAberto((v) => !v), gatilhoRef };
}

type Props = {
  aberto: boolean;
  aoFechar: () => void;
  /** O elemento a que a camada se ancora. */
  gatilho: HTMLElement | null;
  lado?: LadoPopover;
  alinhamento?: AlinhamentoPopover;
  /** Largura mínima = a do gatilho. Liga por padrão (é o certo para Select). */
  larguraDoGatilho?: boolean;
  /** `menu`/`listbox` para DropdownMenu e Select; `dialog` para conteúdo livre. */
  papel?: "menu" | "listbox" | "dialog" | "tooltip";
  /** Tooltip não recebe clique nem foco — só informa. */
  inerte?: boolean;
  children: React.ReactNode;
  id?: string;
};

export function Popover({
  aberto,
  aoFechar,
  gatilho,
  lado = "baixo",
  alinhamento = "inicio",
  larguraDoGatilho = true,
  papel = "dialog",
  inerte = false,
  children,
  id,
}: Props) {
  const painelRef = React.useRef<HTMLDivElement>(null);
  const [montado, setMontado] = React.useState(false);
  const [pos, setPos] = React.useState<Posicao | null>(null);
  const [larguraMin, setLarguraMin] = React.useState<number>();

  // eslint-disable-next-line react-hooks/set-state-in-effect -- `document` só existe depois de montar; sem isto o portal quebra no SSR
  React.useEffect(() => setMontado(true), []);

  /* Mesmo padrão de ref do `useOverlay`, e pelo mesmo motivo: `aoFechar` chega
     como arrow inline do pai e é recriada a cada render. No array de
     dependências, ela faria o efeito rodar o cleanup a cada tecla digitada
     dentro da camada — foi assim que os campos das gavetas perdiam o foco a cada
     letra. Não devolva `aoFechar` para as dependências. */
  const aoFecharRef = React.useRef(aoFechar);
  React.useEffect(() => {
    aoFecharRef.current = aoFechar;
  });

  /** Mede e posiciona. Roda ao abrir e a cada scroll/resize enquanto aberto. */
  const posicionar = React.useCallback(() => {
    if (!gatilho) return;
    const g = gatilho.getBoundingClientRect();
    const painel = painelRef.current;
    const larguraPainel = painel?.offsetWidth ?? g.width;
    const alturaPainel = painel?.offsetHeight ?? 0;

    const espacoAbaixo = window.innerHeight - g.bottom - AFASTAMENTO - MARGEM;
    const espacoAcima = g.top - AFASTAMENTO - MARGEM;

    /* Vira para cima quando não cabe embaixo E cabe melhor em cima. Não basta
       "não cabe embaixo": num viewport curto não cabe em lugar nenhum, e virar
       para o lado ainda menor deixaria a camada pior do que estava. */
    const viraPraCima =
      lado === "cima" || (alturaPainel > espacoAbaixo && espacoAcima > espacoAbaixo);

    const maxHeight = Math.max(120, viraPraCima ? espacoAcima : espacoAbaixo);
    const top = viraPraCima
      ? Math.max(MARGEM, g.top - AFASTAMENTO - Math.min(alturaPainel, maxHeight))
      : g.bottom + AFASTAMENTO;

    let left =
      alinhamento === "fim"
        ? g.right - larguraPainel
        : alinhamento === "centro"
          ? g.left + g.width / 2 - larguraPainel / 2
          : g.left;

    /* O conserto do `.tk-pop`: em vez de confiar no `left` da âncora, a camada é
       grudada na viewport quando não cabe. Sem isto, um gatilho colado na borda
       direita empurra a camada para fora e cria rolagem horizontal na PÁGINA
       inteira — que é o defeito que o `max-width` do legado só disfarçava. */
    left = Math.min(left, window.innerWidth - larguraPainel - MARGEM);
    left = Math.max(MARGEM, left);

    setPos({ top, left, maxHeight, lado: viraPraCima ? "cima" : "baixo" });
    if (larguraDoGatilho) setLarguraMin(g.width);
  }, [gatilho, lado, alinhamento, larguraDoGatilho]);

  React.useLayoutEffect(() => {
    if (!aberto || !montado) return;
    posicionar();
    // Segunda medição depois de pintar: a primeira roda com o painel ainda sem
    // altura, então o "vira para cima" decidiria com `alturaPainel = 0`.
    const raf = requestAnimationFrame(posicionar);
    return () => cancelAnimationFrame(raf);
  }, [aberto, montado, posicionar, children]);

  React.useEffect(() => {
    if (!aberto) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        aoFecharRef.current();
      }
    }
    function onForaClique(e: PointerEvent) {
      const alvo = e.target as Node;
      if (painelRef.current?.contains(alvo)) return;
      if (gatilho?.contains(alvo)) return; // o gatilho alterna sozinho
      aoFecharRef.current();
    }
    /* Rolar FECHA em vez de reposicionar. Reposicionar durante o scroll faz a
       camada "perseguir" o gatilho e é pior do que fechar — e o `capture` pega
       o scroll de qualquer contêiner interno, não só o da janela. */
    function onScroll(e: Event) {
      if (painelRef.current?.contains(e.target as Node)) return;
      aoFecharRef.current();
    }

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onForaClique, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", posicionar);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onForaClique, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", posicionar);
    };
    // ⚠️ `aoFechar` fora das dependências de propósito — ver o `aoFecharRef`.
  }, [aberto, gatilho, posicionar]);

  if (!aberto || !montado) return null;

  return createPortal(
    <div
      ref={painelRef}
      id={id}
      role={papel === "dialog" ? undefined : papel}
      className="bg-surface border border-border rounded-card"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        // Antes de medir, a camada fica fora da tela em vez de piscar no canto.
        visibility: pos ? "visible" : "hidden",
        zIndex: 90,
        minWidth: larguraMin,
        maxWidth: `calc(100vw - ${MARGEM * 2}px)`,
        maxHeight: pos?.maxHeight,
        overflowY: "auto",
        // Overlay usa a sombra FORTE; card usa a `--tk-shadow-card`, mais fraca.
        boxShadow: "var(--tk-shadow-overlay)",
        padding: 4,
        pointerEvents: inerte ? "none" : undefined,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
