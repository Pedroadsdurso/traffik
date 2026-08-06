"use client";

import * as React from "react";

import { Popover, type AlinhamentoPopover, type LadoPopover } from "./Popover";

/**
 * DropdownMenu — menu de ações ancorado a um gatilho.
 *
 * Ele existe para que UserMenu, HelpMenu e WorkspaceMenu não escrevam três vezes
 * o mesmo teclado. O `Popover` já resolve portal, posicionamento, Esc e clique
 * fora; o que falta em cima dele é a navegação por seta e a semântica de menu, e
 * é só isso que mora aqui.
 *
 * ⚠️ NÃO use isto para a paleta ⌘K. O `Popover` **não prende o foco** e **não
 * trava o scroll** de propósito (a tabela do próprio componente explica por
 * quê), e a paleta precisa das duas coisas. Lá o primitivo certo é o
 * `useOverlay`. Reusar este aqui pareceria economia e entregaria um diálogo do
 * qual o Tab escapa para a página atrás.
 *
 * O foco vai para o primeiro item ao abrir, porque um menu aberto que não recebe
 * o foco obriga quem usa teclado a adivinhar quantos Tabs faltam para alcançá-lo.
 */

export type ItemMenu = {
  /** `separador` não é focável nem clicável — é só a linha entre grupos. */
  tipo?: "acao" | "separador";
  rotulo?: React.ReactNode;
  icone?: React.ReactNode;
  /** Texto à direita: atalho de teclado, contagem, "principal". */
  apoio?: React.ReactNode;
  aoEscolher?: () => void;
  /** Marca visual de item selecionado (área ativa, tema atual). */
  selecionado?: boolean;
  /** Ação irreversível ou que sai da sessão — herda a cor de perigo. */
  perigo?: boolean;
};

const SELETOR_ITEM = '[data-item-menu]:not([disabled])';

export function DropdownMenu({
  aberto,
  aoFechar,
  gatilho,
  itens,
  lado,
  alinhamento = "inicio",
  larguraDoGatilho = false,
  rotuloAcessivel,
  /** Conteúdo livre acima dos itens (cabeçalho com nome e e-mail, campo de busca). */
  cabecalho,
  rodape,
}: {
  aberto: boolean;
  aoFechar: () => void;
  gatilho: HTMLElement | null;
  itens: ItemMenu[];
  lado?: LadoPopover;
  alinhamento?: AlinhamentoPopover;
  larguraDoGatilho?: boolean;
  rotuloAcessivel: string;
  cabecalho?: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  const painel = React.useRef<HTMLDivElement>(null);

  /* Foco no primeiro item ao abrir. O `requestAnimationFrame` espera o Popover
     medir e pintar: focar antes disso rola a página para a posição provisória
     (fora da tela) que o Popover usa enquanto não mediu. */
  React.useEffect(() => {
    if (!aberto) return;
    const raf = requestAnimationFrame(() => {
      painel.current?.querySelector<HTMLElement>(SELETOR_ITEM)?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [aberto]);

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const focaveis = Array.from(painel.current?.querySelectorAll<HTMLElement>(SELETOR_ITEM) ?? []);
    if (focaveis.length === 0) return;
    e.preventDefault();

    const atual = focaveis.indexOf(document.activeElement as HTMLElement);
    // Circula nas duas pontas: cair no fim e não conseguir voltar ao topo é o
    // que faz teclado parecer quebrado num menu curto.
    const proximo =
      e.key === "Home" ? 0
      : e.key === "End" ? focaveis.length - 1
      : e.key === "ArrowDown" ? (atual + 1) % focaveis.length
      : (atual - 1 + focaveis.length) % focaveis.length;

    focaveis[proximo]?.focus();
  }

  return (
    <Popover
      aberto={aberto}
      aoFechar={aoFechar}
      gatilho={gatilho}
      lado={lado}
      alinhamento={alinhamento}
      larguraDoGatilho={larguraDoGatilho}
      papel="menu"
    >
      <div ref={painel} aria-label={rotuloAcessivel} onKeyDown={aoTeclar} style={{ minWidth: 200 }}>
        {cabecalho}

        {itens.map((item, i) =>
          item.tipo === "separador" ? (
            <div key={`sep-${i}`} role="separator" className="bg-border" style={{ height: 1, margin: "4px 2px" }} />
          ) : (
            <button
              key={`${item.rotulo}-${i}`}
              type="button"
              role="menuitem"
              data-item-menu
              onClick={() => {
                item.aoEscolher?.();
                aoFechar();
              }}
              className={
                "flex w-full items-center gap-2.5 rounded-controle px-2.5 py-2 text-left text-label cursor-pointer " +
                "border-0 bg-transparent hover:bg-surface-hover " +
                "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px] " +
                (item.perigo ? "text-danger" : item.selecionado ? "text-primary" : "text-text")
              }
            >
              {item.icone && <span className="flex-none">{item.icone}</span>}
              <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
              {item.apoio && <span className="text-caption text-text-muted flex-none">{item.apoio}</span>}
            </button>
          ),
        )}

        {rodape}
      </div>
    </Popover>
  );
}
