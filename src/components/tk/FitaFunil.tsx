"use client";

import * as React from "react";
import { calcularFluxo, caminhoFluxo, caminhoPerda } from "@/lib/funil/fita";

/**
 * FUNIL COMO FLUXO COM PERDAS EXPLÍCITAS — cliques → checkouts → vendas.
 *
 * ### 🔴 A FITA QUE SÓ AFINAVA ESCONDIA A PERGUNTA
 *
 * A versão anterior era uma fita única que estreitava de 1.220 para 27. Os 1.193
 * que sumiram **não estavam em lugar nenhum do desenho** — o estreitamento diz
 * QUE se perdeu, não diz quanto nem onde, e é isso que um funil existe para
 * responder.
 *
 * Aqui a massa se conserva da esquerda para a direita: **quem sai vira faixa
 * própria, rotulada**. A conta e a garantia moram em `lib/funil/fita.ts`, e a
 * conservação é verificada como PROPRIEDADE em `npm run test:fluxo`.
 *
 * ### 🔴 A COR NÃO SEGUE A REFERÊNCIA, E O MOTIVO É O DADO
 *
 * A referência 1 vai de verde a laranja. Aqui isso seria a cor mentindo: **a
 * ponta direita é a VENDA**, que é o objetivo — pintá-la de vermelho afirma que
 * chegar lá é ruim. A regra do projeto vale: verde é lucro, vermelho é prejuízo,
 * âmbar é atenção, e **etapa de funil não é nenhuma das três**.
 *
 * Então: fluxo que continua na cor de destaque; perda em **neutro a 25%**, com o
 * rótulo FORA da faixa. A perda não é um alarme — é o normal de um funil.
 *
 * ### 🔴 ESPESSURA FIEL
 *
 * Sem raiz quadrada, sem log. O porquê e o piso de 3px estão em `fita.ts`.
 */

const FAIXA = 132;
const MARGEM_X = 12;
const TOPO = 16;
/** Espaço abaixo da faixa para os rótulos das etapas. */
const RODAPE = 30;
/* ⛔ `ALTURA_SVG` foi DELETADA (07/08/2026). Ela era `TOPO + FAIXA + RODAPE`,
   uma altura de desenho constante — e a altura passou a ser MEDIDA, porque um
   card esticado pelo vizinho de linha deixava ~220px de ar. Deixá-la aqui como
   constante órfã seria o próximo a reintroduzir a altura fixa "porque já
   existia". Quem responde pela altura mínima é o `--tk-b-fita`; quem responde
   pela real é o `ResizeObserver` do desenho. */

export interface EtapaEntradaFita {
  label: string;
  /** O valor cru. A fita mede com ele. */
  valor: number;
  /** Já formatado com separador de milhar — a tela não formata de novo. */
  valorFmt: string;
  /** Nome curto para o cabeçalho ("chegam ao checkout"). */
  acao: string;
  /**
   * O que aconteceu com quem NÃO passou desta etapa para a seguinte.
   * "saíram sem iniciar checkout", "abandonaram o checkout".
   *
   * ⚠️ Ele descreve a PERDA que sai DAQUI, não a etapa. Sem um texto próprio a
   * faixa viraria "1.185" sem dizer o que aconteceu com eles — e um número sem
   * verbo num funil é exatamente o que a fita antiga já fazia.
   */
  perdaLabel?: string;
}

export function FitaFunil({ etapas }: { etapas: EtapaEntradaFita[] }) {
  const [caixa, setCaixa] = React.useState<HTMLDivElement | null>(null);
  const [desenho, setDesenho] = React.useState<HTMLDivElement | null>(null);
  const [largura, setLargura] = React.useState(0);
  const [alturaDisp, setAlturaDisp] = React.useState(0);

  /* ⚠️ A largura é MEDIDA, não derivada de breakpoint: o mesmo bloco pode ter 4
     ou 12 colunas, e a espessura da fita é em px. Um `viewBox` que escalasse
     junto distorceria o texto dos rótulos. */
  React.useEffect(() => {
    if (!caixa) return;
    const ro = new ResizeObserver(([e]) => setLargura(e?.contentRect.width ?? 0));
    ro.observe(caixa);
    return () => ro.disconnect();
  }, [caixa]);

  /* 🔴 A ALTURA TAMBÉM É MEDIDA — e antes era um número fixo, o que produziu
     ~220px de ar num card esticado pelo vizinho de linha.

     O `--tk-b-fita` das faixas de escala respondia pela LARGURA do bloco, e a
     altura de um card não vem dela: vem do irmão mais alto da linha da grade.
     Nenhuma container query mede isso, porque não existe consulta sobre a
     altura de um irmão.

     ⚠️ E a medida tinha de ser exata, não aproximada: os rótulos das perdas e
     das etapas são HTML posicionado nas MESMAS coordenadas do `viewBox`. Com o
     SVG renderizado numa altura diferente da do `viewBox`, o `xMidYMid meet`
     centraliza o desenho e os rótulos passam a apontar para o lugar errado —
     era o que já estava acontecendo, deslocado em 6px. */
  React.useEffect(() => {
    if (!desenho) return;
    const ro = new ResizeObserver(([e]) => setAlturaDisp(e?.contentRect.height ?? 0));
    ro.observe(desenho);
    return () => ro.disconnect();
  }, [desenho]);

  /* A faixa ocupa a altura disponível menos o que o cabeçalho do desenho e os
     rótulos das etapas precisam. `FAIXA` vira o PISO, não o valor. */
  const faixaAlt = Math.max(FAIXA, Math.round(alturaDisp) - TOPO - RODAPE);
  const alturaSvg = TOPO + faixaAlt + RODAPE;

  const fluxo = React.useMemo(
    () => calcularFluxo(etapas.map((e) => e.valor), { largura, faixa: faixaAlt, margem: MARGEM_X }),
    [etapas, largura, faixaAlt],
  );

  if (etapas.length === 0) {
    return (
      <p className="text-caption text-text-muted" style={{ margin: 0 }}>
        Sem dados de funil no período.
      </p>
    );
  }

  const pct = (t: number | null) => (t === null ? "—" : `${(t * 100).toFixed(1).replace(".", ",")}%`);
  /* Qual perda leva o tom escuro. ⚠️ Pelo VALOR, não pelo índice — ver a nota
     no z-order das faixas. */
  const maiorPerda = Math.max(0, ...fluxo.perdas.map((p) => p.valor));
  const xFim = Math.max(1, largura);

  return (
    <div ref={setCaixa} className="tk-fita" style={{ minWidth: 0 }}>
      {/* ── Cabeçalho: TRÊS NÚMEROS GRANDES lado a lado (`06` §9) ─────────────
          🔴 Era uma frase corrida ("1.220 cliques · 2,9% chegam ao checkout ·
          77,1% compram"). Frase se lê da esquerda para a direita, uma palavra
          por vez; três números lado a lado se leem de relance, que é o trabalho
          de um cabeçalho de bloco.

          É também a versão que SOBREVIVE ao container estreito: abaixo de
          ~360px o desenho some por container query e isto fica sozinho,
          empilhado. Mesma informação sem a forma — melhor que uma fita
          espremida, que não se lê e ainda ocupa espaço. */}
      <div className="tk-fita-cabecalho" style={{ display: "flex", flexWrap: "wrap", gap: 24, margin: "0 0 14px" }}>
        {etapas.map((e, i) => {
          const taxa = fluxo.etapas[i]?.taxa ?? null;
          return (
            <div key={e.label} style={{ minWidth: 0 }}>
              {/* 🎨 Os três números do cabeçalho (`06` §9) escalam em degraus com
                  a largura do bloco. Eles são a leitura rápida do funil — e no
                  mínimo do bloco são a ÚNICA coisa que sobra, porque abaixo de
                  360px úteis a fita some. */}
              <div
                className="text-metric-md"
                style={{ fontSize: "var(--tk-b-fita-num, 24px)", color: i === 0 ? "var(--tk-text)" : "var(--tk-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}
              >
                {/* A primeira etapa é o TOTAL e não tem taxa — mostrar "—" ali
                    prometeria uma comparação que não existe. Ela mostra o
                    número; as seguintes mostram a fração que sobreviveu. */}
                {i === 0 ? e.valorFmt : pct(taxa)}
              </div>
              <div className="text-caption text-text-muted" style={{ whiteSpace: "nowrap" }}>
                {i === 0 ? e.label : `${e.valorFmt} ${e.acao}`}
              </div>
            </div>
          );
        })}
      </div>

      <div
        ref={setDesenho}
        className="tk-fita-desenho"
        /* `flex: 1` + `minHeight` do piso: a fita OCUPA a altura sobrando do
           card em vez de ter altura própria. É o mesmo princípio do `distribuir`
           do `Card` — se o vizinho de linha esticou o card, o desenho estica
           junto em vez de deixar ar embaixo. */
        style={{ position: "relative", flex: 1, minHeight: `var(--tk-b-fita, ${FAIXA + TOPO + RODAPE}px)` }}
      >
        {/* ⛔ `viewBox` 1:1 COM A ALTURA RENDERIZADA. Nada de esticar por
            `preserveAspectRatio`: os rótulos das perdas e das etapas são HTML
            posicionado nas mesmas coordenadas, e qualquer escala entre as duas
            os desalinha em silêncio. A faixa cresce porque a GEOMETRIA foi
            recalculada com a altura medida, não porque o desenho foi esticado. */}
        <svg
          width="100%"
          height={alturaSvg}
          viewBox={`0 0 ${xFim} ${alturaSvg}`}
          role="img"
          aria-label={
            `Funil: ${etapas.map((e, i) => `${e.label} ${e.valorFmt}${fluxo.etapas[i]?.taxa != null ? ` (${pct(fluxo.etapas[i]!.taxa)})` : ""}`).join(", ")}` +
            (fluxo.perdas.length
              ? `. Perdas: ${fluxo.perdas.map((p) => `${p.valor.toLocaleString("pt-BR")} ${etapas[p.de]?.perdaLabel ?? "saíram"}`).join(", ")}`
              : "")
          }
          style={{ display: "block", overflow: "visible" }}
        >
          {/* 🔴🔴 A RAMPA DE OPACIDADE FOI REMOVIDA — ela era a causa do "a fita
              lê como CRESCIMENTO", e a 4ª tentativa é sobre isto.

              Ela ia de `stopOpacity 0.55` na esquerda a `1` na direita, e o
              comentário que a defendia dizia que era "ESTILO, não dado: ela não
              codifica nada que a posição em x já não diga". **Codificava.**
              Opacidade é intensidade percebida, e ela subia da esquerda para a
              direita — exatamente ao contrário da massa, que desce de 132px a
              0,8px. O fluxo ficava lavado onde tem corpo e vívido onde é um
              fio: medido, 1,24:1 contra a perda na ponta grossa e 2,48:1 na
              fina. Com a fronteira apagada justamente onde há área, o olho não
              acha a borda do fluxo na esquerda — sobra uma névoa que resolve
              num traço nítido à direita, e isso se lê como algo EMERGINDO.

              O dono leu a figura como crescimento e concluiu que a orientação
              estava invertida. A orientação estava certa (medido: 132 → 3,8 →
              0,8px, ancorado no topo). Invertido estava o CANAL DE COR.

              ⛔ Não reintroduza gradiente nesta fita. Se um dia parecer chapada
              demais, o que falta é contraste de token, não rampa: qualquer
              variação ao longo de x compete com a espessura, que é o dado. */}

          {/* As guias primeiro: o fluxo passa POR CIMA delas. */}
          {fluxo.etapas.map((e, i) => (
            <line
              key={`guia-${etapas[i]!.label}`}
              x1={e.x} x2={e.x} y1={TOPO - 8} y2={TOPO + faixaAlt + 8}
              stroke="var(--tk-border)" strokeWidth="1" strokeDasharray="3 4"
            />
          ))}

          {/* ⛔ AS PERDAS VÊM ANTES DO FLUXO no z-order. Elas encostam nele por
              uma borda comum; desenhadas por cima, o neutro lavaria o contorno
              do fluxo justamente onde ele é mais fino.

              🔴 CADA PERDA É UMA FAIXA PRÓPRIA, COM TOM PRÓPRIO — antes as duas
              tinham a mesma opacidade (0,25) e encostavam uma na outra, então
              elas liam como uma massa cinza só. O "10 abandonaram o checkout"
              era um fio de 3px grudado nos 128px do "1.185", e ninguém via que
              eram DOIS eventos.

              ⚠️ O tom segue o TAMANHO da perda, não a ordem no funil: a maior
              recebe o tom mais escuro. É a mesma leitura de intensidade do
              heatmap — mais escuro é mais —, e ela funciona sem legenda porque
              a espessura já diz a mesma coisa. Tom por ordem seria uma segunda
              codificação competindo com a primeira.

              🔴 O LIMITE DESTE TOM, escrito porque ele é fácil de superestimar:
              `perda-forte` e `perda-fraca` estão a 1,46:1 uma da outra. Isso
              NÃO separa duas faixas encostadas — quem separa é o contorno de
              1px na cor da superfície, abaixo. O tom é reforço, e sozinho ele
              não sustentaria a distinção; se alguém remover o `stroke` achando
              que o tom basta, as duas perdas voltam a ler como uma massa só.

              Subir o tom da perda até 3:1 contra a outra foi RECUSADO: ela
              passaria a competir em peso com o fluxo, que é o sujeito da
              figura. A folga resolve pelo mesmo preço sem custar hierarquia.

              ⚠️ E o contorno de 1px na cor da SUPERFÍCIE é o que produz a folga
              visível entre faixas vizinhas sem tirar espessura de nenhuma. Um
              recuo geométrico de 2px comeria dois terços da faixa de 3px — e
              faria o desenho deixar de conservar a massa, que é a invariante
              que o `test:fluxo` protege. */}
          {largura > 0 &&
            fluxo.perdas.map((p) => (
              <path
                key={`perda-${p.de}-${p.lado}`}
                d={caminhoPerda(p, TOPO, xFim - MARGEM_X)}
                fill={p.valor === maiorPerda ? "var(--tk-perda-forte)" : "var(--tk-perda-fraca)"}
                stroke="var(--tk-surface)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

          {/* Preenchimento CHAPADO. `--tk-fluxo` diverge de `--tk-primary` no
              escuro justamente para vencer 3:1 contra a perda — ver o token. */}
          {largura > 0 && <path d={caminhoFluxo(fluxo.etapas, TOPO, faixaAlt)} fill="var(--tk-fluxo)" />}

          {/* ⛔ NÃO VOLTE A DESENHAR UMA LINHA SOBRE A BORDA DO FLUXO.

              Tentado em 07/08/2026 e removido no mesmo dia, medido na tela: a
              borda de baixo do fluxo vai de y=160 a y=17 no viewBox, ou seja
              ela SOBE da esquerda para a direita. É geometricamente forçado —
              o fluxo está ancorado no topo e afina, então a fronteira dele com
              a perda só pode subir.

              Traçá-la com 2,5px de `--tk-fluxo` punha a marca mais saliente da
              figura no vetor exato da leitura errada ("a fita cresce"). A ideia
              era dar ao olho um percurso para seguir, já que com 97% de queda o
              fluxo é fino demais para ser massa; o efeito foi reforçar o que se
              queria desfazer.

              Quem responde pela leitura de queda é a silhueta do fluxo — cheia
              à esquerda, fio à direita — e o contraste de 3,6:1 contra a perda
              (`--tk-fluxo` × `--tk-perda-forte`, no `test:contraste`). */}
        </svg>

        {/* ── Rótulo de cada perda, FORA da faixa ──────────────────────────────
            🔴 Fora, e não dentro: a faixa mais fina tem 3px, e texto dentro dela
            é impossível. Dentro da mais grossa e fora da mais fina seria pior —
            duas convenções para a mesma coisa na mesma figura.

            🔴 ANCORADO NO EVENTO, e antes ficava colado na borda direita do
            bloco (`right: MARGEM_X + 6`) para TODAS as perdas. Com isso o
            "1.185 saíram sem iniciar checkout" flutuava a 600px de onde a perda
            acontece — o rótulo pertence ao evento, e ali ele pertencia à
            margem do card.

            O ponto de ancoragem é o MEIO DA ABERTURA da faixa: entre `x0` (onde
            a perda começa a se descolar do fluxo) e `x1` (onde ela atinge a
            espessura cheia). Ali a faixa já tem metade da espessura — texto
            cabe — e ainda está visualmente presa à curva que a gerou.

            ⚠️ `x0` sozinho não serve: lá a faixa tem espessura ZERO e o rótulo
            cairia em cima do fluxo. `x1` sozinho também não: na última perda ele
            é a guia final, e o texto sairia do bloco. */}
        {/* ⚠️ UM rótulo por EVENTO, não por faixa. Cada perda virou duas metades
            (cima e baixo) desde que o fluxo passou a ser centrado, e as duas
            têm o mesmo `valor` — desenhar as duas escreveria "1.185 saíram sem
            iniciar checkout" duas vezes na mesma figura, sugerindo dois
            eventos. A metade de BAIXO é a escolhida porque é onde o rótulo não
            disputa espaço com os três números do cabeçalho. */}
        {fluxo.perdas.filter((p) => p.lado === "baixo").map((p) => {
          const meioY = TOPO + (p.topo + p.base) / 2;
          const cabeDentro = p.base - p.topo >= 26;
          const ancora = (p.x0 + p.x1) / 2;
          /* Passou de 55% da largura, o texto cresce para a ESQUERDA — senão
             ele estoura a borda direita do bloco. */
          const paraEsquerda = ancora > xFim * 0.55;
          return (
            <div
              key={`rot-perda-${p.de}`}
              className={cabeDentro ? "text-caption" : "text-caption bg-surface border border-border"}
              style={{
                position: "absolute",
                ...(paraEsquerda
                  ? { right: Math.max(MARGEM_X, xFim - ancora) }
                  : { left: ancora }),
                top: meioY,
                transform: "translateY(-50%)",
                textAlign: paraEsquerda ? ("right" as const) : ("left" as const),
                maxWidth: "58%",
                pointerEvents: "none",
                color: "var(--tk-text-secondary)",
                /* 🎨 O CHIP É FUNÇÃO, NÃO ESTILO — e é essa a razão de ele não
                   ser aplicado às duas faixas.

                   Ele existe porque **o rótulo cairia sobre o fluxo**: medido
                   na tela, a perda do checkout tem 3px e o texto centrado nela
                   ocupa o mesmo pixel do fio que passa logo acima. O chip tira
                   o rótulo do desenho sem tirá-lo do lugar, que é o que o `06`
                   §9 pede ("rótulo FORA da faixa").

                   ⛔ Na faixa de 126px não há colisão nenhuma — ali o chip
                   viraria uma caixa flutuando num vazio, decoração pura. E duas
                   convenções para a mesma coisa na mesma figura é pior que
                   nenhuma: o leitor procuraria o significado da diferença.

                   ⚠️ Logo, o limiar acompanha a ALTURA DO TEXTO (26px), não um
                   número escolhido por gosto. Se a tipografia crescer, ele
                   cresce junto — senão o chip some justo quando passa a ser
                   necessário. */
                ...(cabeDentro
                  ? null
                  : {
                      padding: "2px 8px",
                      borderRadius: "var(--tk-radius-pill)",
                      whiteSpace: "nowrap" as const,
                    }),
              }}
            >
              <strong className="text-text" style={{ fontVariantNumeric: "tabular-nums" }}>
                {p.valor.toLocaleString("pt-BR")}
              </strong>{" "}
              {etapas[p.de]?.perdaLabel ?? "saíram nesta etapa"}
            </div>
          );
        })}

        {/* Os rótulos das etapas, na base. */}
        {fluxo.etapas.map((e, i) => (
          <span
            key={`rot-${etapas[i]!.label}`}
            className="text-caption text-text-muted"
            style={{
              position: "absolute",
              left: e.x,
              top: TOPO + faixaAlt + 14,
              transform: `translateX(${i === 0 ? "0" : i === fluxo.etapas.length - 1 ? "-100%" : "-50%"})`,
              whiteSpace: "nowrap",
            }}
          >
            {etapas[i]!.label}
          </span>
        ))}
      </div>
    </div>
  );
}
