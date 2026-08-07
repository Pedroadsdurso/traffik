"use client";

import * as React from "react";
import { AlcaRedimensionar } from "./AlcaRedimensionar";
import { Tooltip } from "./Tooltip";

/**
 * ITEM DE EDIÇÃO — a moldura de controle em volta de um bloco, no modo de edição.
 *
 * ⛔ ELE NÃO SUBSTITUI O BLOCO, ENVOLVE. O usuário edita vendo o conteúdo real:
 * uma lista de nomes em vez do painel faria a escolha ser feita sobre um rótulo,
 * e o "não era isso que eu queria" só apareceria depois de salvar.
 *
 * ### ⛔ OS BOTÕES DE LARGURA (`⅓ ½ cheia`) SAÍRAM — 07/08/2026
 *
 * No lugar entrou a alça do canto, com encaixe na grade de 12. Escolher entre
 * três rótulos é preencher um formulário sobre o bloco; arrastar o canto e ver
 * ele encaixar é manipular o bloco. O produto tinha um formulário disfarçado de
 * layout.
 *
 * ### 🔴 BLOCO FIXO APARECE SEM ✕ — não com o ✕ desabilitado
 *
 * Um ✕ apagado é um controle que existe e não funciona, e a pessoa clica nele
 * antes de ler qualquer coisa. A ausência dele, com o selo `Fixo` e o motivo a
 * um hover de distância, é uma afirmação sobre o produto em vez de um botão
 * quebrado. **O motivo vem do catálogo**, não escrito aqui.
 *
 * ### ⛔ REORDENAR POR BOTÃO EXISTE MESMO COM ARRASTO
 *
 * Não é redundância nem plano B: arrasto não tem equivalente de teclado, e uma
 * zona cuja única forma de reordenar é o mouse é uma zona que parte dos usuários
 * não reordena. Os dois caminhos chamam a MESMA operação do hook.
 */

/**
 * O corpo do item, no modo de edicao.
 *
 * ⚠️ `justifyContent: center` e o mesmo `distribuir` que o `Card` ganhou para
 * Canais e Alertas, e pelo mesmo motivo: blocos de uma linha esticam ate a
 * altura do MAIOR (e o `stretch` da grade), e o menor ficava com o conteudo
 * colado no topo e um bloco de ar embaixo. Visto na tela em 07/08/2026, com
 * "Taxa de aprovacao" de uma linha ao lado do Funil de tres.
 *
 * ⛔ Nao e para trocar por `space-between`: com UM filho ele nao distribui
 * nada, e teria a aparencia de conserto sem efeito nenhum.
 */
const CORPO: React.CSSProperties = {
  padding: "var(--tk-pad-card)",
  minWidth: 0,
  flex: 1,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};


export function ItemEdicao({
  titulo,
  tituloVisivel = true,
  fixo,
  aoRemover,
  aoMover,
  podeAntes = false,
  podeDepois = false,
  arrastando = false,
  alvo = false,
  avisoAlvo,
  aoIniciarArrasto,
  aoTerminarArrasto,
  destino,
  redimensionar,
  children,
}: {
  titulo: string;
  /**
   * `false` quando o próprio bloco já escreve o nome dele — o KPI hero é o caso.
   *
   * ⚠️ O título continua existindo: ele é o que nomeia os botões para o leitor
   * de tela (`Mover Faturamento para antes`). O que sai é a REPETIÇÃO VISUAL.
   */
  tituloVisivel?: boolean;
  /** O motivo de o bloco ser estrutural. Presente = sem ✕, com selo `Fixo`. */
  fixo?: string;
  aoRemover?: () => void;
  aoMover?: (direcao: -1 | 1) => void;
  podeAntes?: boolean;
  podeDepois?: boolean;
  /** Este item é o que está sendo arrastado agora. */
  arrastando?: boolean;
  /** O item arrastado está por cima DESTE, e a soltura é permitida. */
  alvo?: boolean;
  /**
   * O que vai acontecer se soltar AQUI. Aparece só enquanto `alvo`.
   *
   * 🔴 Existe por causa do hero cheio: soltar um quinto KPI ali TROCA pelo que
   * está debaixo do cursor, e sem a prévia o usuário descobre qual saiu depois
   * de ter acontecido. "Sai: Margem de lucro" antes da soltura transforma uma
   * surpresa numa escolha.
   */
  avisoAlvo?: string;
  aoIniciarArrasto?: () => void;
  aoTerminarArrasto?: () => void;
  /**
   * Handlers do destino, vindos do `useArrasto`. **`null` significa que este
   * item não aceita a carga atual** — e é a ausência de `onDragOver` que faz o
   * navegador desenhar o cursor de proibido durante o gesto.
   */
  destino?: { onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void } | null;
  redimensionar?: {
    aoArrastar: (larguraPx: number, alturaPx: number) => void;
    aoTeclado: (dCol: number, dLinhas: number) => void;
  };
  /**
   * O bloco de verdade. **Ausente só nos fixos**, que já estão desenhados em
   * outro lugar da tela — repetir o conteúdo deles aqui mostraria o mesmo dado
   * duas vezes na mesma página.
   */
  children?: React.ReactNode;
}) {
  /* O item inteiro é arrastável, mas o gesto só COMEÇA pela alça. Sem isto, um
     texto selecionado dentro do bloco vira arrasto acidental — e o usuário
     reordena sem ter pedido. */
  const [pelaAlca, setPelaAlca] = React.useState(false);
  const podeArrastar = pelaAlca && !!aoIniciarArrasto;

  return (
    <div
      draggable={podeArrastar}
      onDragStart={(e) => {
        /* `dataTransfer` precisa de ALGUM dado, senão o Firefox não inicia o
           arrasto. O conteúdo não é lido: quem sabe o que está sendo arrastado é
           o `useArrasto`, e enfiar índice numa string seria uma segunda fonte de
           verdade para a mesma coisa. */
        e.dataTransfer.setData("text/plain", titulo);
        e.dataTransfer.effectAllowed = "move";
        aoIniciarArrasto?.();
      }}
      onDragEnd={() => {
        setPelaAlca(false);
        aoTerminarArrasto?.();
      }}
      {...(destino ?? {})}
      style={{
        position: "relative",
        border: `1px solid ${alvo ? "var(--tk-primary)" : "var(--tk-border)"}`,
        borderRadius: "var(--tk-radius-card)",
        background: alvo ? "var(--tk-tint-primary)" : "var(--tk-surface)",
        opacity: arrastando ? 0.4 : 1,
        transition: "border-color 120ms, opacity 120ms, background-color 120ms",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        height: "100%",
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
          flex: "none",
        }}
      >
        {aoIniciarArrasto && (
          <span
            aria-hidden="true"
            onPointerDown={() => setPelaAlca(true)}
            onPointerUp={() => setPelaAlca(false)}
            title="Arraste para mover"
            className="text-text-muted"
            style={{ cursor: "grab", lineHeight: 1, padding: "0 2px", touchAction: "none" }}
          >
            ⠿
          </span>
        )}

        <span
          className="text-caption text-text"
          style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {tituloVisivel ? titulo : ""}
        </span>

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

        {alvo && avisoAlvo && (
          <span
            className="text-caption bg-tint-warning text-on-tint-warning"
            style={{ padding: "1px 7px", borderRadius: "var(--tk-radius-pill)", lineHeight: 1.5, whiteSpace: "nowrap" }}
          >
            {avisoAlvo}
          </span>
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

      {children != null && (
        <div style={CORPO}>{children}</div>
      )}

      {redimensionar && (
        <AlcaRedimensionar
          rotulo={titulo}
          aoArrastar={redimensionar.aoArrastar}
          aoTeclado={redimensionar.aoTeclado}
        />
      )}
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
        (perigo
          ? "text-text-secondary hover:text-danger hover:bg-tint-danger "
          : "text-text-secondary hover:text-text hover:bg-surface ") +
        "disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent " +
        "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1"
      }
      style={{ padding: "1px 5px", lineHeight: 1.5 }}
    >
      {children}
    </button>
  );
}
