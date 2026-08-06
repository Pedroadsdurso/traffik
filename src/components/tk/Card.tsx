"use client";

import * as React from "react";

/**
 * Card — a superfície de conteúdo.
 *
 * ⛔ CARD NÃO TEM SOMBRA. No tema escuro a elevação se faz com COR
 * (`background` → `surface` → `surface-hover`); sombra existe apenas em overlay
 * (popover, dropdown, modal, toast), e é o `--tk-shadow-overlay`. Um card com
 * sombra no escuro não parece elevado, parece sujo — e some de vez no claro,
 * onde o fundo já é quase branco.
 *
 * O padding e o espaçamento vêm da DENSIDADE. O card não conhece densidade: ele
 * lê `--tk-pad-card`, e quem decide o valor é o atributo `[data-density]` da
 * raiz, que responde à preferência do usuário.
 *
 * ⚠️ Isto é a densidade-PREFERÊNCIA, e não o `useDensidade`/`useTamanho` que já
 * existe em `dashboard/ui/` — aquele mede o espaço do BLOCO com um
 * ResizeObserver, porque o grid é redimensionável e nenhum breakpoint de janela
 * descreve a largura de um bloco. Os dois são legítimos e não se substituem: um
 * bloco estreito precisa simplificar mesmo que a pessoa tenha pedido
 * "confortável".
 */

type PropsCard = {
  children: React.ReactNode;
  /** Cabeçalho pronto. Se precisar de algo fora deste formato, use `<CardCabecalho>`. */
  titulo?: React.ReactNode;
  descricao?: React.ReactNode;
  /** Canto superior direito: botão, selo, menu. */
  acao?: React.ReactNode;
  /** Card clicável inteiro. Vira `<button>` — não um `<div onClick>`. */
  aoClicar?: () => void;
  /** Anel do dado ao vivo. Sem pulso: card inteiro piscando é ruído, não sinal. */
  aoVivo?: boolean;
  /** Remove o padding do corpo — para tabela que sangra até a borda do card. */
  semPadding?: boolean;
  /**
     Corpo ocupa a altura sobrando. Prop nova (Dashboard, 06/08/2026) em vez de
     um `PainelDeGrafico` irmão: gráfico, tabela e globo precisam esticar até o
     rodapé do card, e um segundo componente quase igual é como esta base virou
     seis dialetos de card. */
  preencher?: boolean;
  /**
   * Centra o conteúdo na altura sobrando, em vez de colá-lo no topo.
   *
   * 🔴 Nasceu de um defeito visto na tela: três blocos lado a lado igualam pela
   * altura do maior (o gráfico), e Canais e Alertas ficavam com ~300px de vazio
   * EMBAIXO do conteúdo. A regra de igualar altura está certa; o que estava
   * errado era o conteúdo ancorado no topo de uma caixa que cresceu por causa
   * do vizinho.
   *
   * ⚠️ É `center`, não `space-between`: os dois cards têm UM filho, e
   * `space-between` com um filho só não distribui nada — teria a aparência de
   * conserto sem efeito nenhum, que é pior que não consertar.
   *
   * Só faz sentido junto de `preencher` — sem altura sobrando não há o que
   * centrar.
   */
  distribuir?: boolean;
  style?: React.CSSProperties;
};

export function Card({
  children,
  titulo,
  descricao,
  acao,
  aoClicar,
  aoVivo = false,
  semPadding = false,
  preencher = false,
  distribuir = false,
  style,
}: PropsCard) {
  const Tag = aoClicar ? "button" : "div";

  return (
    <Tag
      {...(aoClicar ? { type: "button" as const, onClick: aoClicar } : {})}
      className={
        "bg-surface border border-border rounded-card text-left w-full " +
        "transition-[background-color,border-color] " +
        (aoClicar
          ? "cursor-pointer hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 "
          : "")
      }
      style={{
        display: "flex",
        flexDirection: "column",
        gap: titulo || descricao || acao ? "var(--tk-gap-grid)" : 0,
        padding: semPadding ? 0 : "var(--tk-pad-card)",
        boxShadow: aoVivo ? "var(--tk-glow-live)" : undefined,
        ...(preencher ? { height: "100%", minHeight: 0 } : null),
        ...style,
      }}
    >
      {(titulo || descricao || acao) && (
        <CardCabecalho titulo={titulo} descricao={descricao} acao={acao} embutido={semPadding} />
      )}
      {preencher ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            ...(distribuir ? { justifyContent: "center" } : null),
          }}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </Tag>
  );
}

export function CardCabecalho({
  titulo,
  descricao,
  acao,
  embutido = false,
}: {
  titulo?: React.ReactNode;
  descricao?: React.ReactNode;
  acao?: React.ReactNode;
  embutido?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        padding: embutido ? "var(--tk-pad-card) var(--tk-pad-card) 0" : undefined,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {/* `text-title` é o nível que faltava na base de hoje: a Fase 0 achou 19
            tamanhos de fonte distintos porque tamanho e peso eram escolhidos
            separados, caso a caso. Aqui a escolha é UMA. */}
        {titulo && <div className="text-title text-text">{titulo}</div>}
        {descricao && (
          <div className="text-caption text-text-secondary" style={{ marginTop: 2 }}>
            {descricao}
          </div>
        )}
      </div>
      {acao && <div style={{ flex: "none" }}>{acao}</div>}
    </div>
  );
}

/**
 * O KPI das telas de referência: rótulo em caixa de FRASE (não em caixa alta —
 * `text-micro` é restrito a cabeçalho de tabela e eyebrow de seção), número
 * grande e tabular, e a variação embaixo.
 */
export function CardMetrica({
  rotulo,
  valor,
  variacao,
  icone,
  ajuda,
}: {
  rotulo: React.ReactNode;
  valor: React.ReactNode;
  /** Já formatado ("+12,4%"). O SINAL decide a cor — não o chamador. */
  variacao?: { texto: string; positiva: boolean };
  /** Quadrado tingido do ícone. O tom é o do dado, não decoração. */
  icone?: { no: React.ReactNode; tom: "primary" | "accent" | "success" | "warning" | "danger" };
  ajuda?: string;
}) {
  const TINTA = {
    primary: "bg-tint-primary text-on-tint-primary",
    accent: "bg-tint-accent text-on-tint-accent",
    success: "bg-tint-success text-on-tint-success",
    warning: "bg-tint-warning text-on-tint-warning",
    danger: "bg-tint-danger text-on-tint-danger",
  } as const;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="text-label text-text-secondary" title={ajuda}>
            {rotulo}
          </div>
          <div className="text-metric-xl text-text" style={{ marginTop: 4 }}>
            {valor}
          </div>
          {variacao && (
            <div
              className={`text-caption ${variacao.positiva ? "text-success" : "text-danger"}`}
              style={{ marginTop: 4 }}
            >
              {variacao.texto}
            </div>
          )}
        </div>
        {icone && (
          <div
            aria-hidden="true"
            className={TINTA[icone.tom]}
            style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 8, flex: "none" }}
          >
            {icone.no}
          </div>
        )}
      </div>
    </Card>
  );
}
