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

/* ⚠️ O `justifyContent: center` é o mesmo `distribuir` que o `Card` ganhou para
   Canais e Alertas, e pelo mesmo motivo: blocos de uma linha esticam até a
   altura do slot, e o menor ficava com o conteúdo colado no topo e um bloco de ar
   embaixo. Visto na tela em 07/08/2026, com "Taxa de aprovação" de uma linha ao
   lado do Funil de três.

   ⛔ Não é para trocar por `space-between`: com UM filho ele não distribui nada, e
   teria a aparência de conserto sem efeito nenhum. */
/**
 * 🔴 O CORPO É O CONTÊINER DAS CONSULTAS DO BLOCO — e isso é conserto, não
 * detalhe. Achado na passada visual da F5, 12/08/2026.
 *
 * A célula da grade é `container-type: size`, então as container queries de
 * dentro do bloco respondem sobre ELA. No modo de edição isso passou a mentir: a
 * moldura come o cabeçalho (~28px) e o padding, e o bloco recebe MENOS do que a
 * célula mede. Medido num slot de 2 células: célula **176px**, corpo **139**, e o
 * KPI ficou com **99** enquanto pedia **119** — o rótulo foi cortado inteiro
 * (`altura 0`) nos quatro cards de destaque, e nos compactos também.
 *
 * ⛔ Não é "aumentar o slot" nem "encolher o conteúdo". É a pergunta do
 * *defeito acidentalmente invisível*: **que valor deveria ser igual a este, e
 * é?** A caixa que a query mede tem de ser a caixa que o conteúdo recebe. Como o
 * corpo tem altura definida (`flex: 1` dentro de uma moldura de `height: 100%`),
 * ele pode ser contêiner — e aí a conta fecha sozinha.
 *
 * ⚠️ `size` implica `contain: size`: o conteúdo deixa de contribuir para o
 * tamanho do próprio corpo. Só é seguro porque a altura vem do flex, nunca do
 * que está dentro. Foi tentar `container-type: size` numa caixa em `auto` que
 * colapsou blocos a zero na F1.
 */
const corpoDoItem = (semPadding: boolean): React.CSSProperties => ({
  /* ⚠️ Bloco que desenha a própria superfície (a métrica) já traz o padding
     dele. Somar o da moldura dava 40px de casca dupla — e num slot de uma célula
     esses 40px são metade do que existe. */
  /* 🔴 C7 — o cabeçalho virou SOBREPOSTO (ver o comentário na moldura), então o
     corpo recebe o slot inteiro. O recuo do topo existe só para o conteúdo não
     nascer por baixo dos controles — e só onde a moldura desenha o padding: o
     bloco que traz a própria superfície já centra o que tem dentro. */
  /* ⚠️ O RECUO VALE NOS DOIS RAMOS, e a primeira versão só o deu a um.
     Visto na tela: com o cabeçalho sobreposto e `padding: 0`, os cards de
     métrica compacta perderam o RÓTULO — ele nascia em y=0, debaixo dos
     controles, e o card virava um número sem nome. É o defeito que o `06` já
     nomeia: some o apoio, nunca a resposta — só que aqui sumiu o apoio sem
     ninguém ter decidido. */
  padding: semPadding ? "22px 0 0" : "calc(var(--tk-pad-card) + 22px) var(--tk-pad-card) var(--tk-pad-card)",
  minWidth: 0,
  flex: 1,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  containerType: "size",
});


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
  semPadding = false,
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
   * O bloco desenha a própria superfície (fundo, borda, raio, padding).
   *
   * ⚠️ Só tira o padding do corpo — a moldura de edição continua inteira. É a
   * mesma prop do `Card`, com o mesmo nome de propósito: dois vocabulários para
   * "este filho já tem casca" seria mais um dialeto de card nesta base.
   */
  semPadding?: boolean;
  /**
   * O bloco de verdade.
   *
   * ⚠️ Isto dizia *"ausente só nos fixos, que já estão desenhados em outro lugar
   * da tela"*, e a premissa morreu em 07/08/2026: os fixos deixaram de ter
   * "outro lugar" — eles vivem na zona Painéis como todo mundo, e o que os
   * separa é só não terem ✕. **Fixo desenha o conteúdo dele aqui, como os
   * outros.** Havia uma zona "Sempre visíveis" com quatro molduras vazias; ela
   * não existe mais.
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
      {/* 🔴 C7 — O CABEÇALHO SOBREPÕE, ELE NÃO CONSOME ALTURA DO SLOT.
          Medido em 13/08/2026: no fluxo, ele comia **37px** — um slot de 2
          células (176px) entregava **139** ao bloco. O modo de edição é onde a
          pessoa DECIDE o tamanho, e ele era justamente o lugar que mostrava o
          bloco menor do que ele vai ficar.

          ⛔ Dar mais altura à moldura não era saída: com `grid-row: span h` ela
          ocupa exatamente `h` células, e esticar invadiria a linha de baixo.
          Sobrepor é o que devolve o slot inteiro ao corpo.

          ⚠️ O corpo ganhou `paddingTop` do tamanho do cabeçalho SÓ quando ele
          traz o próprio padding — senão o conteúdo nasceria por baixo dos
          controles. Bloco que desenha a própria superfície (a métrica) já centra
          o conteúdo e não precisa. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1,
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

        {/* 🔴 C7 — O TÍTULO PODE ENCURTAR, MAS NUNCA FICA INALCANÇÁVEL.
            Medido em 13/08/2026: no modo de edição a grade cai de 1140 para
            **782px** (o catálogo lateral leva ~300), o card de KPI vai a 182px e
            este cabeçalho a **122** — "Formas de pagamento" passava por 2px e
            saía `Formas de pagament…`.

            ⛔ Aqui o `ellipsis` FICA, e a diferença com o número do KPI é o que
            decide: o número é a RESPOSTA do bloco e um dígito a menos o torna
            falso; o título é o RÓTULO, e um rótulo abreviado continua
            identificando enquanto a íntegra estiver a um hover. É a ordem de
            sacrifício de sempre — encurta o apoio, nunca a resposta.

            ⚠️ Encolher a fonte aqui seria pior: o cabeçalho tem controles de
            altura fixa ao lado, e texto de 9px entre botões de 13 vira ruído. */}
        <span
          className="text-caption text-text"
          title={tituloVisivel ? titulo : undefined}
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
        <div style={corpoDoItem(semPadding)}>{children}</div>
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
