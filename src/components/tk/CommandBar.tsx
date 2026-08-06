"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { useOverlay } from "@/components/dashboard/ui/useOverlay";
import { Icone, type NomeIcone } from "@/components/dashboard/ui/Icone";

/**
 * CommandBar — a paleta ⌘K. Busca global sobre telas, campanhas, criativos e
 * integrações.
 *
 * 🔴 POR QUE `useOverlay` E NÃO O `Popover`, apesar de o pedido dizer "com o
 * Popover que já existe".
 *
 * O `Popover` documenta, na própria tabela dele, que **não prende o foco** e
 * **não trava o scroll do fundo** — e as duas ausências são deliberadas, porque
 * um dropdown que faz isso é um bug. A paleta precisa exatamente do oposto: foco
 * preso enquanto aberta, fundo travado, e ela não é ancorada a gatilho nenhum
 * (nasce centralizada, invocável de qualquer tela, inclusive sem clique).
 *
 * O `useOverlay` entrega os quatro: portal para o `<body>`, Esc, trava de
 * scroll, foco preso e foco devolvido a quem abriu. É o mesmo primitivo de
 * `Drawer` e `Modal`, que é o que a paleta estruturalmente é.
 *
 * A intenção do pedido — não instalar `cmdk`, reusar o que a base já tem — está
 * cumprida: zero dependência nova.
 *
 * ⌘K é registrado em `useAtalhoPaleta`, no shell, e não aqui: o atalho tem de
 * funcionar com a paleta FECHADA, e um componente que só existe quando está
 * aberto nunca ouviria a tecla que o abre.
 */

export type ItemComando = {
  id: string;
  rotulo: string;
  /** Segunda linha: nome da campanha do criativo, plataforma do webhook. */
  apoio?: string;
  icone: NomeIcone;
  href: string;
  /** Texto extra que a busca considera mas a tela não mostra (ex.: "gerenciador ads"). */
  sinonimos?: string;
};

export type GrupoComando = { titulo: string; itens: ItemComando[] };

/** Teto por grupo: a lista de campanhas pode ter centenas, e rolar não é buscar. */
const MAX_POR_GRUPO = 6;

function normalizar(s: string) {
  // Sem acento e sem caixa: "criativos" tem de achar "Criativos" e "análise"
  // tem de ser achado por "analise", que é como as pessoas digitam com pressa.
  //
  // ⚠️ A classe do `replace` é o bloco COMBINING DIACRITICAL MARKS, U+0300 a
  // U+036F, escrito com os caracteres literais — que são invisíveis num editor.
  // Se esta linha parecer `[-]` vazia, ela NÃO está corrompida; confira com
  // `codePointAt` antes de "consertar", porque reescrevê-la à mão é como ela
  // quebra de verdade.
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CommandBar({
  aberta,
  aoFechar,
  grupos,
  aoEscolher,
}: {
  aberta: boolean;
  aoFechar: () => void;
  grupos: GrupoComando[];
  aoEscolher: (item: ItemComando) => void;
}) {
  const { painelRef, podeRenderizar } = useOverlay(aberta, aoFechar);
  const [busca, setBusca] = React.useState("");
  const [indice, setIndice] = React.useState(0);
  const listaRef = React.useRef<HTMLDivElement>(null);

  /* ⚠️ A busca não sobrevive ao fechamento — reabrir com o texto anterior mostra
     o resultado de outra pergunta e parece que a paleta ignorou o ⌘K. Quem
     garante isso é o `AppShell`, que **desmonta** este componente quando fecha:
     o estado nasce limpo a cada abertura, sem efeito de reset.

     Um `useEffect` zerando os campos no fechamento funcionaria e é o desenho
     óbvio — mas é `setState` dentro de efeito, que o lint desta base recusa com
     razão: ele produz um render a mais logo depois de cada fechamento. */

  const filtrados = React.useMemo(() => {
    const q = normalizar(busca.trim());
    return grupos
      .map((g) => ({
        titulo: g.titulo,
        itens: (q
          ? g.itens.filter((i) => normalizar(`${i.rotulo} ${i.apoio ?? ""} ${i.sinonimos ?? ""}`).includes(q))
          : g.itens
        ).slice(0, MAX_POR_GRUPO),
      }))
      .filter((g) => g.itens.length > 0);
  }, [grupos, busca]);

  /* A lista achatada é o que a seta percorre: o usuário navega por ITENS, e os
     títulos de grupo são rótulo, não parada. Sem isto, descer com a seta pararia
     em "Campanhas" como se fosse escolhível. */
  const achatados = React.useMemo(() => filtrados.flatMap((g) => g.itens), [filtrados]);

  React.useEffect(() => {
    if (!aberta) return;
    listaRef.current?.querySelector<HTMLElement>('[data-ativo="sim"]')?.scrollIntoView({ block: "nearest" });
  }, [indice, aberta]);

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (achatados.length === 0) return;
      setIndice((i) =>
        e.key === "ArrowDown" ? (i + 1) % achatados.length : (i - 1 + achatados.length) % achatados.length,
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const alvo = achatados[indice];
      if (alvo) {
        aoEscolher(alvo);
        aoFechar();
      }
    }
    // Esc não é tratado aqui — o `useOverlay` já o escuta na captura, e tratar
    // nos dois lugares fecharia duas vezes.
  }

  if (!podeRenderizar) return null;

  return createPortal(
    <div
      // Backdrop. `z-index` acima do Popover (90) porque a paleta pode ser
      // aberta com um dropdown do header ainda montado.
      className="fixed inset-0 grid justify-items-center"
      style={{ zIndex: 120, background: "rgb(0 0 0 / .5)", alignContent: "start", paddingTop: "12vh" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
        onKeyDown={aoTeclar}
        className="bg-surface border border-border rounded-painel flex flex-col overflow-hidden"
        style={{
          width: "min(620px, calc(100vw - 32px))",
          maxHeight: "min(60vh, 520px)",
          boxShadow: "var(--tk-shadow-overlay)",
        }}
      >
        <div className="border-b border-border flex items-center gap-2.5 px-3.5" style={{ height: 48, flex: "none" }}>
          <Icone nome="bussola" tamanho={17} cor="suave" />
          <input
            value={busca}
            /* O índice zera AQUI, no evento, e não num efeito sobre `busca`:
               digitar muda o conjunto filtrado, e manter o índice antigo
               deixaria a marca de seleção num item que saiu da lista — o Enter
               abriria o errado. */
            onChange={(e) => {
              setBusca(e.target.value);
              setIndice(0);
            }}
            placeholder="Buscar telas, campanhas, criativos e integrações…"
            aria-label="Buscar"
            // `role=combobox` + `aria-activedescendant` é o que faz o leitor de
            // tela anunciar o item marcado sem tirar o foco do campo — que é o
            // que permite continuar digitando enquanto se navega com a seta.
            role="combobox"
            aria-expanded
            aria-controls="tk-paleta-lista"
            aria-activedescendant={achatados[indice] ? `tk-cmd-${achatados[indice].id}` : undefined}
            className="text-body text-text min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-text-muted"
          />
          <kbd className="text-caption text-text-muted border border-border rounded-controle px-1.5 py-0.5">esc</kbd>
        </div>

        <div id="tk-paleta-lista" ref={listaRef} role="listbox" aria-label="Resultados" className="overflow-y-auto p-1.5">
          {achatados.length === 0 ? (
            <p className="text-body text-text-secondary px-3 py-6 text-center">
              Nada com esse nome em telas, campanhas, criativos ou integrações.
            </p>
          ) : (
            filtrados.map((g) => (
              <div key={g.titulo}>
                <div className="text-micro text-text-muted px-2.5 pt-2.5 pb-1">{g.titulo}</div>
                {g.itens.map((item) => {
                  const ativo = achatados[indice]?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      id={`tk-cmd-${item.id}`}
                      role="option"
                      aria-selected={ativo}
                      data-ativo={ativo ? "sim" : "nao"}
                      onPointerDown={(e) => {
                        // `pointerdown` e não `click`: o click viria depois do
                        // blur do campo, e o overlay já teria começado a fechar.
                        e.preventDefault();
                        aoEscolher(item);
                        aoFechar();
                      }}
                      onPointerEnter={() => setIndice(achatados.findIndex((i) => i.id === item.id))}
                      className={
                        "flex cursor-pointer items-center gap-2.5 rounded-controle px-2.5 py-2 " +
                        (ativo ? "bg-tint-primary" : "")
                      }
                    >
                      <Icone nome={item.icone} tamanho={16} cor={ativo ? "marca" : "suave"} />
                      <span className="min-w-0 flex-1">
                        <span className={`text-label block truncate ${ativo ? "text-primary" : "text-text"}`}>
                          {item.rotulo}
                        </span>
                        {item.apoio && (
                          <span className="text-caption text-text-muted block truncate">{item.apoio}</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className="border-t border-border text-caption text-text-muted flex items-center gap-4 px-3.5"
          style={{ height: 34, flex: "none" }}
        >
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * O atalho global. Mora fora do componente porque ele precisa estar ouvindo com
 * a paleta FECHADA — é a tecla que a abre.
 *
 * Ignora a tecla quando o foco está num campo de texto: ⌘K dentro de um input é
 * "apagar até o fim da linha" em terminal e mac, e roubar isso surpreende. A
 * exceção é o próprio campo da paleta, que já está dentro dela.
 */
export function useAtalhoPaleta(abrir: () => void) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      const alvo = e.target as HTMLElement | null;
      const editando =
        alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA" || alvo?.isContentEditable;
      if (editando) return;
      e.preventDefault();
      abrir();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abrir]);
}
