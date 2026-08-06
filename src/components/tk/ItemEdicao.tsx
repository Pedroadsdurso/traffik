"use client";

import * as React from "react";
import { Tooltip } from "./Tooltip";

/**
 * ITEM DE EDIÇÃO — a moldura de controle em volta de um bloco, no modo de edição.
 *
 * ⛔ ELE NÃO SUBSTITUI O BLOCO, ENVOLVE. O usuário edita vendo o conteúdo real:
 * uma lista de nomes em vez do painel faria a escolha ser feita sobre um rótulo,
 * e o "não era isso que eu queria" só apareceria depois de salvar.
 *
 * ### 🔴 BLOCO FIXO APARECE SEM ✕ — não com o ✕ desabilitado
 *
 * Um ✕ apagado é um controle que existe e não funciona, e a pessoa clica nele
 * antes de ler qualquer coisa. A ausência dele, com o selo `Fixo` e o motivo a
 * um hover de distância, é uma afirmação sobre o produto em vez de um botão
 * quebrado. **O motivo vem do catálogo**, não escrito aqui: segunda cópia da
 * mesma decisão diverge no primeiro dia em que alguém mudar uma delas.
 *
 * ### ⛔ REORDENAR POR BOTÃO EXISTE MESMO COM ARRASTO
 *
 * Não é redundância nem plano B: arrasto não tem equivalente de teclado, e uma
 * zona cuja única forma de reordenar é o mouse é uma zona que parte dos usuários
 * não reordena. Os dois caminhos chamam a MESMA operação do hook.
 */

export interface OpcaoLargura {
  valor: string;
  rotulo: string;
}

export function ItemEdicao({
  titulo,
  tituloVisivel = true,
  fixo,
  aoRemover,
  aoMover,
  podeAntes = false,
  podeDepois = false,
  larguras,
  arrastando = false,
  alvo = false,
  aoIniciarArrasto,
  aoTerminarArrasto,
  aoPassarPorCima,
  aoSoltar,
  children,
}: {
  titulo: string;
  /**
   * `false` quando o próprio bloco já escreve o nome dele — o KPI hero é o caso.
   *
   * ⚠️ O título continua existindo: ele é o que nomeia os botões para o leitor
   * de tela (`Mover Faturamento para antes`). O que sai é a REPETIÇÃO VISUAL, e
   * só ela. Aceitar `titulo` opcional deixaria os `aria-label` como "Mover para
   * antes" — indistinguíveis entre si numa fileira de quatro.
   */
  tituloVisivel?: boolean;
  /** O motivo de o bloco ser estrutural. Presente = sem ✕, com selo `Fixo`. */
  fixo?: string;
  aoRemover?: () => void;
  aoMover?: (direcao: -1 | 1) => void;
  podeAntes?: boolean;
  podeDepois?: boolean;
  larguras?: { atual: string; opcoes: readonly OpcaoLargura[]; aoTrocar: (valor: string) => void };
  /** Este item é o que está sendo arrastado agora. */
  arrastando?: boolean;
  /** O item arrastado está por cima DESTE, e a soltura é permitida. */
  alvo?: boolean;
  aoIniciarArrasto?: () => void;
  aoTerminarArrasto?: () => void;
  aoPassarPorCima?: (e: React.DragEvent) => void;
  aoSoltar?: (e: React.DragEvent) => void;
  /**
   * O bloco de verdade. **Ausente só nos fixos**, que já estão desenhados em
   * outro lugar da tela — repetir o conteúdo deles aqui mostraria o mesmo dado
   * duas vezes na mesma página, e o segundo não seria o que o usuário vê fora
   * do modo de edição.
   */
  children?: React.ReactNode;
}) {
  /* O item inteiro é arrastável, mas o gesto só COMEÇA pela alça. Sem isto, um
     clique no seletor de largura ou um texto selecionado dentro do bloco viram
     arrasto acidental — e o usuário reordena sem ter pedido. */
  const [pelaAlca, setPelaAlca] = React.useState(false);
  const podeArrastar = pelaAlca && !!aoIniciarArrasto;

  return (
    <div
      draggable={podeArrastar}
      onDragStart={(e) => {
        /* `dataTransfer` precisa de ALGUM dado, senão o Firefox não inicia o
           arrasto. O conteúdo não é lido: quem sabe o que está sendo arrastado é
           o estado do React, e enfiar índice numa string seria uma segunda fonte
           de verdade para a mesma coisa. */
        e.dataTransfer.setData("text/plain", titulo);
        e.dataTransfer.effectAllowed = "move";
        aoIniciarArrasto?.();
      }}
      onDragEnd={() => {
        setPelaAlca(false);
        aoTerminarArrasto?.();
      }}
      onDragOver={aoPassarPorCima}
      onDrop={aoSoltar}
      style={{
        border: `1px solid ${alvo ? "var(--tk-primary)" : "var(--tk-border)"}`,
        borderRadius: "var(--tk-radius-card)",
        background: "var(--tk-surface)",
        opacity: arrastando ? 0.4 : 1,
        transition: "border-color 120ms, opacity 120ms",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderBottom: "1px solid var(--tk-border)",
          background: "var(--tk-surface-hover)",
        }}
      >
        {aoIniciarArrasto && (
          <span
            aria-hidden="true"
            onPointerDown={() => setPelaAlca(true)}
            onPointerUp={() => setPelaAlca(false)}
            title="Arraste para reordenar"
            className="text-text-muted"
            style={{ cursor: "grab", lineHeight: 1, padding: "0 2px", touchAction: "none" }}
          >
            ⠿
          </span>
        )}

        <span className="text-caption text-text" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tituloVisivel ? titulo : ""}
        </span>

        {larguras && larguras.opcoes.length > 1 && (
          /* ⛔ SÓ AS LARGURAS QUE O BLOCO DECLAROU. É o que separa escolher entre
             opções de redimensionamento livre — e é o que impede o painel de
             voltar a ser uma grade de doze caixas iguais. */
          <span style={{ display: "inline-flex", gap: 2 }}>
            {larguras.opcoes.map((o) => {
              const ativa = o.valor === larguras.atual;
              return (
                <button
                  key={o.valor}
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => larguras.aoTrocar(o.valor)}
                  className={`text-caption cursor-pointer rounded-controle border ${
                    ativa
                      ? "bg-tint-primary text-on-tint-primary border-transparent"
                      : "bg-transparent text-text-secondary border-border hover:bg-surface"
                  } focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1`}
                  style={{ padding: "1px 6px", lineHeight: 1.5 }}
                >
                  {o.rotulo}
                </button>
              );
            })}
          </span>
        )}

        {aoMover && (
          <>
            <BotaoMini rotulo={`Mover ${titulo} para antes`} desabilitado={!podeAntes} aoClicar={() => aoMover(-1)}>
              ←
            </BotaoMini>
            <BotaoMini rotulo={`Mover ${titulo} para depois`} desabilitado={!podeDepois} aoClicar={() => aoMover(1)}>
              →
            </BotaoMini>
          </>
        )}

        {fixo ? (
          <Tooltip texto={fixo}>
            <span
              tabIndex={0}
              className="text-caption bg-tint-neutral text-on-tint-neutral"
              style={{ padding: "1px 7px", borderRadius: "var(--tk-radius-pill)", lineHeight: 1.5, cursor: "help" }}
            >
              Fixo
            </span>
          </Tooltip>
        ) : (
          aoRemover && (
            <BotaoMini rotulo={`Remover ${titulo}`} aoClicar={aoRemover} perigo>
              ✕
            </BotaoMini>
          )
        )}
      </div>

      {children != null && <div style={{ padding: "var(--tk-pad-card)", minWidth: 0, flex: 1 }}>{children}</div>}
    </div>
  );
}

/** Botão de barra de ferramentas do item. Só ícone, e por isso exige rótulo. */
function BotaoMini({
  rotulo,
  aoClicar,
  desabilitado = false,
  perigo = false,
  children,
}: {
  rotulo: string;
  aoClicar: () => void;
  desabilitado?: boolean;
  perigo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
      className={
        "text-caption border border-transparent rounded-controle cursor-pointer " +
        (perigo ? "text-text-secondary hover:text-danger hover:bg-tint-danger " : "text-text-secondary hover:text-text hover:bg-surface ") +
        "disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent " +
        "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1"
      }
      style={{ padding: "1px 5px", lineHeight: 1.5 }}
    >
      {children}
    </button>
  );
}
