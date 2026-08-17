"use client";

import * as React from "react";

import { useTamanho } from "@/components/dashboard/ui/useTamanho";

import { Icone } from "@/components/dashboard/ui/Icone";

/**
 * AlertList — o painel que não existia, e a única coisa do Dashboard que EXIGE
 * AÇÃO.
 *
 * Todo o resto da tela é monitoramento: números que você olha e segue a vida.
 * Aqui é o contrário — cada linha é um problema custando dinheiro agora. É por
 * isso que ele fica acima da dobra e ao lado do gráfico principal, e não num
 * rodapé.
 *
 * 🔴 REGRA DE CONTEÚDO: alerta é o que pede DECISÃO, não o que é apenas
 * verdadeiro. "Faturamento caiu 3%" não é alerta — é o KPI fazendo o trabalho
 * dele. "Gasto de R$ 2.340 sem nenhuma conversão em 4 campanhas" é, porque a
 * pessoa precisa ir pausar alguma coisa. Se um dia esta lista encher de coisas
 * que ninguém aciona, ela vira decoração e para de ser lida — e aí o alerta que
 * importa chega no meio de dez que já estavam lá. É o mesmo raciocínio do
 * `ACEITOS` no teste de contraste.
 *
 * ⚠️ Sem alerta é BOA NOTÍCIA, e o estado vazio precisa dizer isso. Um "nenhum
 * resultado" cinza aqui lê como falha de carregamento.
 */

export type Severidade = "danger" | "warning" | "info";

export type Alerta = {
  id: string;
  severidade: Severidade;
  titulo: string;
  detalhe?: string;
  href?: string;
  /**
   * A AÇÃO INLINE — para o alerta cuja resolução não tem tela para onde mandar.
   *
   * ⛔ **Ela não é a forma preferida, e a preferida é o `href`.** Um alerta que
   * leva para a tela do assunto mostra o contexto inteiro antes de o usuário
   * mexer; um botão aqui resolve às cegas, com o detalhe de uma linha como toda
   * a informação. Por isso a regra:
   *
   * > ## `acao` só quando NÃO EXISTE tela que resolva aquilo. Se existe, é `href`.
   *
   * O caso que a trouxe: os padrões de host aprovados bloqueiam envio à Meta e
   * são **irreversíveis** se ninguém puder removê-los. A remoção existe
   * (`removerPadraoDeTeste`) e a tela que a chamava foi deletada — ou seja, o
   * produto tinha o remédio e nenhuma porta. O alerta é a porta.
   *
   * ⚠️ `href` e `acao` são MUTUAMENTE EXCLUSIVOS no desenho: com `acao` a linha
   * nunca vira `<a>`, porque `<button>` dentro de `<a>` é markup inválido e o
   * clique fica ambíguo — o usuário mira "remover" e navega.
   */
  acao?: {
    rotulo: string;
    /** ⚠️ Quem chama é a TELA, não este componente: aqui não há server action. */
    aoAcionar: () => void | Promise<void>;
  };
};

/* ⚠️ NÃO ACRESCENTE UM CARIMBO DE TEMPO AQUI ("há 2h", `06` §14.3).
   Havia uma prop `quando`, com ZERO chamadores, e ela não tinha como ser
   preenchida: alerta nesta base é DERIVADO do período filtrado
   (`dadosDosBlocos.tsx`), não uma linha guardada com instante de criação. Não
   existe o dado. É a mesma razão que removeu a `aoVerTodos` — ver o comentário
   do rodapé, mais abaixo. */

const TOM: Record<Severidade, { classe: string; glifo: string; rotulo: string }> = {
  danger: { classe: "bg-tint-danger text-on-tint-danger", glifo: "✕", rotulo: "Crítico" },
  warning: { classe: "bg-tint-warning text-on-tint-warning", glifo: "!", rotulo: "Atenção" },
  info: { classe: "bg-tint-primary text-on-tint-primary", glifo: "i", rotulo: "Informação" },
};

/** Crítico primeiro. Dentro da mesma severidade, mantém a ordem de chegada. */
const PESO: Record<Severidade, number> = { danger: 0, warning: 1, info: 2 };

export function AlertList({
  alertas,
  limite = 3,
}: {
  alertas: Alerta[];
  limite?: number;
}) {
  const [expandido, setExpandido] = React.useState(false);
  /* Qual `acao` está em curso. Sem isto, dois cliques disparam duas remoções e
     a segunda opera sobre a lista que a primeira ainda não devolveu. */
  const [emCurso, setEmCurso] = React.useState<string | null>(null);
  /**
   * 🔴 F3 — QUANTOS ALERTAS CABEM É MEDIDO (§4 do `07`).
   *
   * `limite = 3` era fixo. Num bloco de 4 colunas a 1280 o título de cada alerta
   * quebra em duas linhas, três alertas passam do slot e o bloco estourava **+24px**.
   *
   * ⚠️ **A derivação só é possível porque a LINHA tem altura fixa**, e é por isso
   * que o título ganhou `line-clamp: 2` no mesmo commit. Com linhas de altura
   * variável não existe "quantas cabem" calculável sem medir cada uma — e medir
   * cada uma realimenta, porque esconder linha muda o que há para medir.
   *
   * ⛔ O texto inteiro não se perde: ele fica no `title`, e o alerta continua
   * clicável para a tela que o resolve.
   */
  const { ref: raizLista, altura: ch } = useTamanho<HTMLDivElement>();
  const [hLinha, setHLinha] = React.useState(0);
  const medirLinha = React.useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    setHLinha((a) => (Math.abs(a - h) < 0.5 ? a : h));
  }, []);
  const ordenados = React.useMemo(
    () => [...alertas].sort((a, b) => PESO[a.severidade] - PESO[b.severidade]),
    [alertas],
  );
  /* 8 é o `gap` da coluna; o rodapé do `+ N` mede ~26. Os dois entram na conta
     porque ocupam a mesma altura que uma linha disputaria.

     ## ⛔ AS DUAS CONTAS PRECISAM DA MESMA GUARDA — e por duas semanas só uma tinha
     `cabem` já caía para `limite` sem medição. `comRodape` não caía: com
     `ch = 0` e `hLinha = 0` ele calculava `Math.floor(-18 / 8) = -3`, e o
     `Math.max(1, …)` o segurava em **1**. Como o visível é
     `min(limite, comRodape)`, o `1` vencia e **o HTML inicial desenhava UM
     alerta** onde o `limite` declara três.

     E o estado não medido não é caso de borda: é **todo render de servidor** e o
     primeiro render do cliente, antes de o `ResizeObserver` disparar.

     ⚠️ Foi *endurecer uma porta com a outra aberta*, na camada de layout — e
     invisível porque o cliente se corrige sozinho um quadro depois. Quem paga é
     quem lê o HTML: SSR, leitor de tela e qualquer teste de render.

     ⛔ Antes de medir, quem manda é o `limite` DECLARADO. Não invente um piso
     aqui: sem altura de linha não há "quantas cabem", e chutar 1 é afirmar uma
     medição que não houve. */
  const medido = ch > 0 && hLinha > 0;
  const cabem = medido ? Math.max(1, Math.floor((ch + 8) / (hLinha + 8))) : limite;
  const comRodape =
    ordenados.length > cabem
      ? medido
        ? Math.max(1, Math.floor((ch + 8 - 26) / (hLinha + 8)))
        : limite
      : cabem;
  const visiveis = expandido ? ordenados : ordenados.slice(0, Math.min(limite, comRodape));
  const restantes = ordenados.length - visiveis.length;

  if (alertas.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", padding: "20px 12px" }}>
        <span
          aria-hidden="true"
          className="bg-tint-success text-on-tint-success"
          style={{ width: 28, height: 28, borderRadius: "var(--tk-radius-pill)", display: "grid", placeItems: "center", fontSize: 14 }}
        >
          ✓
        </span>
        <p className="text-label text-text" style={{ margin: 0 }}>Nada exigindo ação</p>
        <p className="text-caption text-text-muted" style={{ margin: 0, maxWidth: 240, lineHeight: 1.5 }}>
          Sem ROI abaixo da meta, gasto sem conversão ou integração desconectada no período.
        </p>
      </div>
    );
  }

  return (
    <div ref={raizLista} style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0, overflow: "hidden" }}>
      {visiveis.map((a, i) => {
        const t = TOM[a.severidade];
        const Conteudo = (
          <>
            <span
              aria-hidden="true"
              className={t.classe}
              style={{ width: 28, height: 28, flex: "none", borderRadius: "var(--tk-radius-pill)", display: "grid", placeItems: "center", fontSize: 14 }}
            >
              {t.glifo}
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              {/* `line-clamp: 2` — ver a nota de `cabem`: é ele que torna a linha
                  de altura FIXA, e sem altura fixa não há "quantas cabem". */}
              <span
                className="text-label text-text"
                style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              >
                {/* A severidade também vira TEXTO para leitor de tela: cor e
                    ícone sozinhos não comunicam gravidade (WCAG 1.4.1). */}
                <span className="sr-only">{t.rotulo}: </span>
                {a.titulo}
              </span>
              {a.detalhe && (
                <span
                  className="text-caption text-text-muted"
                  style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {a.detalhe}
                </span>
              )}
            </span>
            {a.acao && (
              /* ⚠️ `flex: none` e `alignSelf: center`: o botão não pode encolher
                 quando o título ocupa duas linhas — área de clique que muda de
                 tamanho com o texto ao lado é a mesma falha muda do rail
                 recolhido, onde a `Tooltip` derrubou o alvo de 43px para 17. */
              <button
                type="button"
                disabled={emCurso === a.id}
                onClick={() => {
                  setEmCurso(a.id);
                  void Promise.resolve(a.acao!.aoAcionar()).finally(() => setEmCurso(null));
                }}
                className="text-caption text-primary hover:bg-surface-hover"
                style={{
                  flex: "none",
                  alignSelf: "center",
                  background: "none",
                  border: "1px solid var(--tk-borda)",
                  borderRadius: "var(--tk-radius-controle)",
                  padding: "4px 9px",
                  cursor: emCurso === a.id ? "progress" : "pointer",
                  opacity: emCurso === a.id ? 0.6 : 1,
                  transition: "background-color var(--tk-dur-rapida) var(--tk-ease-padrao)",
                }}
              >
                {emCurso === a.id ? "…" : a.acao.rotulo}
              </button>
            )}
          </>
        );

        const estilo: React.CSSProperties = {
          display: "flex", gap: 10, alignItems: "flex-start",
          padding: "8px 10px", borderRadius: "var(--tk-radius-controle)",
          background: "var(--tk-surface-hover)", textDecoration: "none",
          flex: "none",
        };

        /* A PRIMEIRA linha é a medida — com o clamp, todas têm a mesma altura. */
        const medir = i === 0 ? medirLinha : undefined;
        /* ⛔ Com `acao`, NUNCA âncora: `<button>` dentro de `<a>` é inválido, e
           o clique fica ambíguo — o usuário mira "remover" e navega. */
        return a.href && !a.acao ? (
          <a key={a.id} ref={medir} href={a.href} title={a.titulo} style={estilo} className="transition-[background-color]">{Conteudo}</a>
        ) : (
          <div key={a.id} ref={medir} title={a.titulo} style={estilo}>{Conteudo}</div>
        );
      })}

      {/* ── O controle de EXPANSÃO, no rodapé e centrado (`06` §14.2) ────────
          Na referência a lista de alertas tem DOIS controles, e a distinção é
          por posição: `Ver todos` no CABEÇALHO navega para outra tela; o
          `+ N ⌄` no RODAPÉ expande no lugar. Não é acaso — trocar um pelo outro
          promete navegação e entrega expansão.

          🔧 **Aqui só existe o do rodapé, e é decisão com motivo:** não há tela
          de "todos os alertas". Alerta nesta base é DERIVADO do período filtrado
          (`computeDashboard`), não uma linha guardada em lugar nenhum — não há
          para onde navegar. Um `Ver todos` no cabeçalho seria affordance
          mentindo, que é a regra que matou a interação do globo.

          ⚠️ Havia uma prop `aoVerTodos` para isso, com ZERO chamadores. Foi
          removida em vez de mantida "para quando existir": prop inerte é o que
          faz o próximo commit acreditar que o caminho está pronto. */}
      {restantes > 0 && !expandido && (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          aria-expanded={false}
          className="text-caption text-primary hover:bg-surface-hover"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            width: "100%",
            /* 🔴 C6 — o `+N` fica ANCORADO NO FIM do card, como o do `FeedVendas`.
               Um "+3 alertas" colado na última linha, com vão morto embaixo, diz
               "não coube mais" logo acima do espaço que sobrou. */
            marginTop: "auto",
            flex: "none",
            background: "none",
            border: 0,
            cursor: "pointer",
            padding: "6px 10px",
            borderRadius: "var(--tk-radius-controle)",
            transition: "background-color var(--tk-dur-rapida) var(--tk-ease-padrao)",
          }}
        >
          + {restantes} {restantes === 1 ? "alerta" : "alertas"}
          <Icone nome="chevronBaixo" tamanho={13} cor="marca" />
        </button>
      )}

      {/* Expandido, o caminho de volta precisa existir: sem ele a lista cresce e
          não encolhe, e o bloco fica ocupando a coluna inteira até recarregar. */}
      {expandido && ordenados.length > limite && (
        <button
          type="button"
          onClick={() => setExpandido(false)}
          aria-expanded
          className="text-caption text-text-muted hover:bg-surface-hover hover:text-text"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            width: "100%",
            background: "none",
            border: 0,
            cursor: "pointer",
            padding: "6px 10px",
            borderRadius: "var(--tk-radius-controle)",
            transition: "background-color var(--tk-dur-rapida) var(--tk-ease-padrao)",
          }}
        >
          Mostrar menos
          <Icone nome="chevronCima" tamanho={13} cor="suave" />
        </button>
      )}
    </div>
  );
}
