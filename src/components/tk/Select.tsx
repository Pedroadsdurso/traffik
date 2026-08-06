"use client";

import * as React from "react";
import { Popover } from "./Popover";

/**
 * Select — lista de opções própria, sobre o `Popover`.
 *
 * Existe em vez do `<select>` nativo porque o nativo não aceita o visual do
 * sistema em nenhum navegador de forma consistente. O preço disso é ter de
 * reimplementar o TECLADO à mão — e é aí que um select próprio costuma ficar
 * quebrado sem ninguém perceber, porque no mouse ele parece perfeito.
 *
 * O que está implementado, e o que se perde se for removido:
 *   ↓ / ↑        navega (e ABRE, se fechado)
 *   Home / End   primeira e última
 *   Enter/Espaço confirma a destacada
 *   Esc          fecha sem escolher
 *   Tab          fecha e segue o fluxo normal da página
 *   digitar      pula para a opção que começa com a letra
 *
 * ⚠️ O destaque segue o TECLADO **e** o mouse, e há um só destaque para os dois.
 * Dois destaques simultâneos (um do foco, outro do hover) é o defeito clássico
 * daqui: a pessoa move o mouse sem querer e o Enter escolhe outra coisa.
 */

export type OpcaoSelect<T extends string = string> = {
  valor: T;
  rotulo: string;
  /** Segunda linha — contexto que não cabe no rótulo (conta, id, período). */
  apoio?: string;
  desabilitada?: boolean;
};

type Props<T extends string> = {
  opcoes: readonly OpcaoSelect<T>[];
  valor: T | null;
  aoEscolher: (valor: T) => void;
  rotulo?: React.ReactNode;
  /** Texto quando nada está escolhido. */
  vazio?: string;
  desabilitado?: boolean;
  blocoInteiro?: boolean;
  id?: string;
};

export function Select<T extends string>({
  opcoes,
  valor,
  aoEscolher,
  rotulo,
  vazio = "Selecione",
  desabilitado = false,
  blocoInteiro = true,
  id,
}: Props<T>) {
  const [aberto, setAberto] = React.useState(false);
  const [destaque, setDestaque] = React.useState(0);
  /* Estado, e NÃO `useRef`: o `Popover` precisa do nó para medir a posição, e um
     ref lido durante o render chega `null` na primeira passada — o painel abriria
     sem ancoragem e só se corrigiria num render seguinte que pode não vir. Com
     estado, o callback de ref dispara um render assim que o nó existe. */
  const [gatilho, setGatilho] = React.useState<HTMLButtonElement | null>(null);
  const gerado = React.useId();
  const idBase = id ?? gerado;
  const idLista = `${idBase}-lista`;

  const escolhida = opcoes.find((o) => o.valor === valor) ?? null;
  const navegaveis = opcoes.filter((o) => !o.desabilitada);
  const busca = React.useRef({ termo: "", quando: 0 });

  /* Ao abrir, o destaque começa na opção ESCOLHIDA — não no topo. Começar no
     topo faz o ↓ imediato pular a atual, que é o movimento mais comum.

     Isto acontece em quem ABRE, e não num efeito que observa `aberto`: o efeito
     rodava um setState em cascata a cada abertura (o lint acusa), e ainda
     reposicionaria o destaque se `valor` mudasse com a lista já aberta — ou
     seja, o cursor pularia sozinho debaixo da mão de quem navega. */
  const abrir = React.useCallback(() => {
    setDestaque(Math.max(0, opcoes.findIndex((o) => o.valor === valor)));
    setAberto(true);
  }, [opcoes, valor]);

  const fechar = React.useCallback(() => setAberto(false), []);

  function mover(passo: number) {
    setDestaque((atual) => {
      let i = atual;
      // Pula desabilitadas em vez de parar nelas; se todas forem, devolve o atual.
      for (let n = 0; n < opcoes.length; n++) {
        i = (i + passo + opcoes.length) % opcoes.length;
        if (!opcoes[i]?.desabilitada) return i;
      }
      return atual;
    });
  }

  function confirmar(i: number) {
    const o = opcoes[i];
    if (!o || o.desabilitada) return;
    aoEscolher(o.valor);
    setAberto(false);
    gatilho?.focus();
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (desabilitado) return;

    if (!aberto) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrir();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown": e.preventDefault(); mover(1); return;
      case "ArrowUp": e.preventDefault(); mover(-1); return;
      case "Home": e.preventDefault(); setDestaque(opcoes.indexOf(navegaveis[0]!)); return;
      case "End": e.preventDefault(); setDestaque(opcoes.indexOf(navegaveis[navegaveis.length - 1]!)); return;
      case "Enter":
      case " ": e.preventDefault(); confirmar(destaque); return;
      case "Escape": e.preventDefault(); fechar(); gatilho?.focus(); return;
      case "Tab": fechar(); return;
    }

    /* Busca por digitação. O termo ACUMULA dentro de 700ms: sem isso, digitar
       "ca" acharia tudo que começa com "c" e depois tudo com "a", e a segunda
       tecla desfaria a primeira. */
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const agora = Date.now();
      busca.current.termo = agora - busca.current.quando > 700 ? e.key : busca.current.termo + e.key;
      busca.current.quando = agora;
      const t = busca.current.termo.toLowerCase();
      const i = opcoes.findIndex((o) => !o.desabilitada && o.rotulo.toLowerCase().startsWith(t));
      if (i >= 0) setDestaque(i);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: blocoInteiro ? "100%" : undefined }}>
      {rotulo && (
        <label htmlFor={idBase} className="text-label text-text-secondary">
          {rotulo}
        </label>
      )}

      <button
        ref={setGatilho}
        id={idBase}
        type="button"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={aberto ? idLista : undefined}
        aria-haspopup="listbox"
        disabled={desabilitado}
        onClick={() => (aberto ? fechar() : abrir())}
        onKeyDown={aoTeclar}
        className={
          "flex items-center justify-between gap-2 text-body bg-surface-hover border rounded-controle " +
          "cursor-pointer text-left transition-[border-color] " +
          "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 " +
          "disabled:opacity-45 disabled:cursor-not-allowed " +
          (aberto ? "border-primary " : "border-border ")
        }
        style={{ height: "var(--tk-altura-controle)", padding: "0 10px", width: "100%" }}
      >
        <span className={escolhida ? "text-text" : "text-text-muted"} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {escolhida?.rotulo ?? vazio}
        </span>
        <Seta aberto={aberto} />
      </button>

      <Popover
        aberto={aberto}
        aoFechar={fechar}
        gatilho={gatilho}
        papel="listbox"
        id={idLista}
      >
        {opcoes.map((o, i) => {
          const ativa = i === destaque;
          const atual = o.valor === valor;
          return (
            <div
              key={o.valor}
              role="option"
              aria-selected={atual}
              aria-disabled={o.desabilitada || undefined}
              // O destaque acompanha o mouse para não existirem dois ao mesmo tempo.
              onPointerEnter={() => !o.desabilitada && setDestaque(i)}
              onClick={() => confirmar(i)}
              className={
                "flex items-center justify-between gap-2 rounded-controle " +
                (o.desabilitada ? "opacity-45 cursor-not-allowed " : "cursor-pointer ") +
                (ativa && !o.desabilitada ? "bg-tint-primary " : "")
              }
              style={{ padding: "6px 10px" }}
            >
              <span style={{ minWidth: 0 }}>
                <span className={`text-body ${atual ? "text-primary" : "text-text"}`} style={{ display: "block" }}>
                  {o.rotulo}
                </span>
                {o.apoio && <span className="text-caption text-text-muted">{o.apoio}</span>}
              </span>
              {atual && <Confere />}
            </div>
          );
        })}
      </Popover>
    </div>
  );
}

function Seta({ aberto }: { aberto: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
      className="text-text-muted"
      style={{
        flex: "none",
        transform: aberto ? "rotate(180deg)" : undefined,
        transition: "transform var(--tk-dur-padrao) var(--tk-ease-padrao)",
      }}
    >
      <path d="M3 4.5 6 8l3-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Confere() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="text-primary" style={{ flex: "none" }}>
      <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
