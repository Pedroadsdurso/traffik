"use client";

import * as React from "react";
import { calcularFluxo, caminhoDaFita } from "@/lib/funil/fita";

/**
 * FUNIL DE CONVERSÃO — só a fita, e a perda em número.
 *
 * Referência literal: `docs/design/referencias/16-funil-referencia.png`.
 *
 * ### 🔴 A PERDA NÃO É DESENHADA — o fundo é FUNDO, não quantidade
 *
 * Cinco versões desenharam a perda como faixa cinza colada no fluxo. Com 97% de
 * queda isso pinta 97% do bloco de cinza e deixa o fluxo como um fio dentro da
 * massa — a figura fica pesada, e a ausência vira o sujeito visual. A
 * referência não tem uma única faixa de perda: ela respira porque só a fita
 * existe.
 *
 * A perda mora na **pílula da guia** (`−1.185 · 97,1%`), com precisão total.
 *
 * ### Os elementos, e onde cada um mora
 *
 * | | |
 * |---|---|
 * | nome da etapa | acima, pequeno, no centro da etapa |
 * | pílula de taxa | SOBRE a fita, centrada — o elemento mais visível |
 * | pílula de perda | ABAIXO da fita, ancorada na GUIA da transição |
 * | número absoluto | embaixo, grande e em negrito |
 * | guia vertical | ENTRE as etapas, não sobre elas |
 *
 * ⚠️ **As guias ficam entre as etapas.** Conferido na referência: guias em
 * x≈270/530/790/1048 e centros em ≈140/400/660/920/1180. Pôr a guia sobre a
 * etapa faria a pílula de perda apontar para uma etapa em vez de para a
 * transição — e perda é o que acontece ENTRE duas.
 *
 * ### 🔴 A COR NÃO SEGUE A REFERÊNCIA NA PONTA
 *
 * A referência vai de azul a ROSA. Aqui o rosa está perto demais do vermelho de
 * prejuízo, e a ponta direita é a VENDA — o objetivo. Pintar de quase-vermelho
 * afirmaria que chegar lá é ruim. A rampa vai do azul de marca a um violeta
 * mais claro da mesma família, e nunca encosta em verde nem em vermelho.
 *
 * ⚠️ Isto é um gradiente ao longo do COMPRIMENTO, e ele não codifica grandeza
 * nenhuma — codifica percurso, que é o que a figura é. Foi um gradiente de
 * OPACIDADE que quebrou a versão anterior, porque opacidade lê como
 * intensidade e ela subia enquanto a massa descia. Matiz ao longo de x não tem
 * esse problema: ninguém lê "mais violeta" como "mais quantidade".
 */

const MARGEM_X = 12;
/** Espaço acima da fita: os nomes das etapas E a pílula que não coube. */
const TOPO = 26 + 22 + 10;
/** Espaço abaixo da fita: pílula de perda, número absoluto e a composição. */
const RODAPE = 58 + 20;
/** Piso da altura da FAIXA (a fita em si), sem o topo e o rodapé. */
const FAIXA_MIN = 150;
/** Altura aproximada da cápsula: 2 × padding + a linha do `text-caption`. */
const ALTURA_PILULA = 22;
/** Quanto a pílula que saiu fica acima da fita — é o tamanho do traço. */
const FOLGA_PILULA = 10;

export interface EtapaEntradaFita {
  label: string;
  /** O valor cru. A fita mede com ele. */
  valor: number;
  /** Já formatado com separador de milhar — a tela não formata de novo. */
  valorFmt: string;
  /** De onde o número vem ("Meta Ads", "Gateway — status APROVADA"). */
  fonte?: string;
  /** Texto do `title` — o que a etapa conta, e por que difere de fontes vizinhas. */
  ajuda?: string;
  /** Linha sob o número absoluto: "11 do navegador". */
  composicao?: string;
  /**
   * Como se chama a perda que SAI desta etapa, quando ela não é abandono.
   *
   * 🔴 O caso que criou o campo: `Cliques → Sessões`. A etapa 1 é a métrica da
   * Meta e a 2 é a nossa tabela `Click` — quem clicou no anúncio e não virou
   * sessão nossa **não desistiu, não foi VISTO**. Bloqueador, redirect que come
   * a UTM, snippet ausente na página.
   *
   * Chamar isso de abandono manda o gestor otimizar a oferta quando o problema
   * é a instalação. Sem `perdaLabel` a pílula mostra só o número, que é o
   * comportamento certo para as perdas que SÃO abandono.
   */
  perdaLabel?: string;
  /** Texto do `title` da pílula de perda, quando ela precisa de explicação. */
  perdaAjuda?: string;
  /**
   * 🔴 O TRECHO QUE SAI DESTA ETAPA NÃO FOI MEDIDO.
   *
   * Preenchido quando o valor desta etapa é DERIVADO da seguinte, e não de uma
   * fonte independente. O caso real: `ICs` cujo `Click.checkoutAt` foi todo
   * escrito pelo webhook do gateway — toda venda produz um IC, então a etapa
   * repete "Vendas iniciadas" e a conversão entre as duas seria 100% por
   * construção.
   *
   * ⛔ **A etapa NUNCA some por causa disto.** Etapa que desaparece muda a
   * forma do funil em silêncio, e a forma é o que a pessoa compara entre
   * períodos. Ela fica, hachurada, dizendo que não foi medida — que é a mesma
   * distinção do heatmap (célula não observada ≠ célula com zero) e do
   * denominador zero (`—` ≠ `0,00x`).
   */
  trechoNaoMedido?: string;
}

const pct1 = (t: number) => `${(t * 100).toFixed(1).replace(".", ",")}%`;

/**
 * Uma linha do canto: o que foi TIRADO do cálculo.
 *
 * 🔴 Declarar o que saiu é a disciplina deste projeto, e a referência faz o
 * mesmo ("119 acessos de robô removidos"). Sem isto, "removemos os robôs" é uma
 * afirmação que o usuário teria de aceitar no escuro — ele não consegue julgar
 * se o filtro exagera ou se falha.
 *
 * ⚠️ Só aparece quando há o que declarar. Uma linha fixa dizendo "0 removidos"
 * seria ruído em todo período limpo, e o que importa é o caso em que houve
 * remoção.
 */
export interface ExclusaoFita {
  /** Já formatado e por extenso: "119 acessos de robô removidos". */
  texto: string;
}

export function FitaFunil({
  etapas,
  exclusoes = [],
}: {
  etapas: EtapaEntradaFita[];
  exclusoes?: ExclusaoFita[];
}) {
  const [caixa, setCaixa] = React.useState<HTMLDivElement | null>(null);
  const [desenho, setDesenho] = React.useState<HTMLDivElement | null>(null);
  const [largura, setLargura] = React.useState(0);
  const [alturaDisp, setAlturaDisp] = React.useState(0);

  /* ⚠️ A largura é MEDIDA, não derivada de breakpoint: o mesmo bloco pode ter 4
     ou 12 colunas, e a espessura da fita é em px. */
  React.useEffect(() => {
    if (!caixa) return;
    const ro = new ResizeObserver(([e]) => setLargura(e?.contentRect.width ?? 0));
    ro.observe(caixa);
    return () => ro.disconnect();
  }, [caixa]);

  /* 🔴 A ALTURA TAMBÉM É MEDIDA. A altura de um card não vem de container query
     nenhuma: ela vem do irmão mais alto da linha da grade, e não existe consulta
     sobre a altura de um irmão. Sem medir, um card esticado pelo vizinho deixa
     ar embaixo — e na referência a fita ocupa quase tudo. */
  React.useEffect(() => {
    if (!desenho) return;
    const ro = new ResizeObserver(([e]) => setAlturaDisp(e?.contentRect.height ?? 0));
    ro.observe(desenho);
    return () => ro.disconnect();
  }, [desenho]);

  const faixaAlt = Math.max(FAIXA_MIN, Math.round(alturaDisp) - TOPO - RODAPE);
  const alturaSvg = TOPO + faixaAlt + RODAPE;
  const centroY = TOPO + faixaAlt / 2;

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

  const xFim = Math.max(1, largura);

  /* Os trechos cuja conversão não foi MEDIDA: a etapa `i` declarou que o valor
     dela é derivado da seguinte. O trecho vai do centro dela ao centro da
     próxima — é exatamente o pedaço da fita cuja inclinação seria lida como
     conversão. */
  /* ⚠️ SEM filtro de largura aqui. Houve uma versão com `.filter(t => t.x1 >
     t.x0)`, e ela matava a PÍLULA junto com o retângulo: no servidor `largura`
     é 0, todos os x são 0, e o rótulo "não medido" sumia do markup. São duas
     coisas diferentes — a geometria precisa de largura, o rótulo não. O guarda
     ficou só no `<rect>`, que é quem degenera. */
  const trechosNaoMedidos = fluxo.etapas
    .map((e, i) => ({ i, x0: e.x, x1: fluxo.etapas[i + 1]?.x ?? e.x }))
    .filter((t) => !!etapas[t.i]?.trechoNaoMedido);

  /* A pílula é HTML, não `<text>` do SVG: cápsula com raio, padding e peso de
     fonte são três coisas que o SVG faria à mão. Como o `viewBox` é 1:1 com a
     altura renderizada (ver abaixo), as coordenadas valem nos dois. */
  const pilula = (fundo: string, cor: string): React.CSSProperties => ({
    position: "absolute",
    transform: "translate(-50%, -50%)",
    background: fundo,
    color: cor,
    borderRadius: 999,
    padding: "3px 10px",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    fontVariantNumeric: "tabular-nums",
  });

  return (
    /* ⚠️ `flex: 1` + `minHeight: 0` NA RAIZ, e não só no desenho. Medido em
       07/08/2026: o desenho crescia dentro de uma `.tk-fita` que era `flex: 0 1
       auto` e parava nos 234px do próprio mínimo, dentro de um pai com 421
       disponíveis. O `flex: 1` do filho não serve de nada enquanto o pai não
       cresce — e o sintoma era ~60px de ar em cima e ~65 embaixo.
       `minHeight: 0` é o que deixa a coluna encolher abaixo do conteúdo em vez
       de estourar o card. */
    <div
      ref={setCaixa}
      className="tk-fita"
      style={{ minWidth: 0, minHeight: 0, flex: 1, display: "flex", flexDirection: "column" }}
    >
      {/* ── Versão COMPACTA: só ela sobra abaixo de 360px ────────────────────
          A fita some por container query (o desenho fica ilegível e ainda
          ocuparia 200px de altura). Isto tem a mesma informação sem a forma.
          ⚠️ `.tk-fita-compacto` é escondido enquanto o desenho aparece — os
          dois nunca convivem, senão os números apareceriam duplicados. */}
      <div className="tk-fita-compacto" style={{ display: "none", flexDirection: "column", gap: 6 }}>
        {etapas.map((e, i) => (
          <div key={e.label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span className="text-caption text-text-secondary">{e.label}</span>
            <span className="text-caption" style={{ fontVariantNumeric: "tabular-nums" }}>
              <strong style={{ color: "var(--tk-text)" }}>{e.valorFmt}</strong>
              {fluxo.etapas[i]?.fracao != null && (
                <span className="text-text-muted"> · {pct1(fluxo.etapas[i]!.fracao!)}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* ── O que saiu do cálculo, no canto superior direito ─────────────────
          Discreto de propósito: é procedência, não resultado. Quem lê o bloco
          quer o funil; quem desconfia do funil quer isto, e vai procurar. */}
      {exclusoes.length > 0 && (
        <div
          className="text-caption text-text-muted"
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, marginBottom: 2 }}
        >
          {exclusoes.map((x) => (
            <span key={x.texto}>{x.texto}</span>
          ))}
        </div>
      )}

      <div
        ref={setDesenho}
        className="tk-fita-desenho"
        /* `flex: 1` + piso: a fita OCUPA a altura sobrando do card em vez de ter
           altura própria. Se o vizinho de linha esticou o card, ela estica. */
        style={{ position: "relative", flex: 1, minHeight: FAIXA_MIN + TOPO + RODAPE }}
      >
        {/* ⛔ `viewBox` 1:1 COM A ALTURA RENDERIZADA. Nada de esticar por
            `preserveAspectRatio`: nomes, pílulas e números são HTML posicionado
            nas mesmas coordenadas, e qualquer escala entre os dois os desalinha
            em silêncio. A fita cresce porque a GEOMETRIA foi recalculada com a
            altura medida, não porque o desenho foi esticado. */}
        <svg
          width="100%"
          height={alturaSvg}
          viewBox={`0 0 ${xFim} ${alturaSvg}`}
          role="img"
          aria-label={
            `Funil: ${etapas
              .map((e, i) => {
                const f = fluxo.etapas[i]?.fracao;
                return `${e.label} ${e.valorFmt}${f != null ? ` (${pct1(f)} do maior)` : ""}`;
              })
              .join(", ")}` +
            (fluxo.perdas.length
              ? `. Perdas: ${fluxo.perdas
                  .map(
                    (p) =>
                      `${p.valor.toLocaleString("pt-BR")} entre ${etapas[p.de]?.label} e ${etapas[p.de + 1]?.label}${p.pct != null ? ` (${pct1(p.pct)})` : ""}`,
                  )
                  .join(", ")}`
              : "")
          }
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id="tk-fita-rampa" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--tk-fluxo)" />
              <stop offset="100%" stopColor="var(--tk-fluxo-fim)" />
            </linearGradient>
            {/* A hachura do NÃO MEDIDO. Mesma linguagem do heatmap e do Gasto no
                `LineChart`: textura não é intensidade, é OUTRA CATEGORIA. Uma
                cor mais fraca aqui leria como "converteu menos"; a diagonal lê
                como "isto não é uma medição".

                ⚠️ `patternUnits="userSpaceOnUse"` é obrigatório: em
                `objectBoundingBox` o passo escala com o tamanho da área, e a
                mesma listra passaria a significar coisas diferentes conforme a
                espessura da fita. */}
            <pattern id="tk-fita-naomedido" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="var(--tk-surface)" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--tk-text-muted)" strokeWidth="2" opacity="0.5" />
            </pattern>
            {/* O recorte é a PRÓPRIA FITA: a hachura preenche um retângulo do
                trecho e só aparece dentro da forma. Desenhar um segundo `path`
                com a geometria do trecho seria uma segunda implementação da
                mesma curva — e as duas divergem no primeiro ajuste. */}
            <clipPath id="tk-fita-recorte">
              <path d={caminhoDaFita(fluxo.etapas, centroY, { x0: 0, x1: xFim })} />
            </clipPath>
          </defs>

          {/* As guias primeiro: a fita passa POR CIMA delas. */}
          {largura > 0 &&
            fluxo.guias.map((x, i) => (
              <line
                key={`guia-${i}`}
                x1={x}
                x2={x}
                y1={TOPO - 14}
                y2={TOPO + faixaAlt + 26}
                stroke="var(--tk-border)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

          {largura > 0 && (
            <path
              d={caminhoDaFita(fluxo.etapas, centroY, { x0: 0, x1: xFim })}
              fill="url(#tk-fita-rampa)"
            />
          )}

          {/* O trecho NÃO MEDIDO, por cima da rampa e recortado pela fita. */}
          {largura > 0 &&
            trechosNaoMedidos.map(({ i, x0, x1 }) => (
              x1 <= x0 ? null : (
              <rect
                key={`nm-${i}`}
                x={x0}
                y={TOPO}
                width={Math.max(0, x1 - x0)}
                height={faixaAlt}
                fill="url(#tk-fita-naomedido)"
                clipPath="url(#tk-fita-recorte)"
              />
            )))}
        </svg>

        {/* ── A CAMADA DOS RÓTULOS ─────────────────────────────────────────────
            🔴 Ela renderiza SEMPRE e fica OCULTA até a primeira medida, em vez
            de não existir enquanto `largura === 0`.

            Duas razões, e as duas são melhorias de verdade:

            1. O `ResizeObserver` só corre no cliente, depois da pintura. Com
               `largura > 0 &&`, o primeiro quadro não tinha rótulo nenhum e
               eles apareciam de repente. Com `visibility`, o espaço já está
               reservado e nada salta.
            2. O markup do SERVIDOR passa a conter os textos. Sem isso não há
               como assertar "a pílula diz não medido" sem um DOM completo — e
               esta base não tem jsdom. A alternativa seria uma prop só de
               teste, que é pior: código de produção que existe para o teste.

            ⚠️ `visibility: hidden` e não `display: none`: o primeiro mantém a
            caixa, o segundo faria o layout pular quando os rótulos entrassem. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            visibility: largura > 0 ? "visible" : "hidden",
            pointerEvents: "none",
          }}
        >

        {/* ── Nome da etapa, ACIMA ─────────────────────────────────────────── */}
        {fluxo.etapas.map((e, i) => (
            <div
              key={`nome-${etapas[i]!.label}`}
              className="text-caption text-text-secondary"
              title={etapas[i]!.ajuda ?? etapas[i]!.fonte}
              style={{
                position: "absolute",
                left: e.x,
                top: 4,
                cursor: etapas[i]!.ajuda ? "help" : undefined,
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                fontWeight: 600,
              }}
            >
              {etapas[i]!.label}
            </div>
          ))}

        {/* ── Pílula da TAXA ───────────────────────────────────────────────────
            O elemento mais visível da figura, e é assim de propósito: a
            pergunta do bloco é "que fração sobrevive", e a resposta fica na
            forma que a representa, não numa legenda ao lado.

            🔴 QUANDO NÃO CABE, ELA SAI — A FITA NÃO ENGORDA.

            Houve uma versão com piso de 10px justamente para a pílula caber
            sobre a fita. Isso desenha 2,9% como ~7,6%: a legibilidade da
            etiqueta paga com a espessura, e o bloco deixa de responder "quanto
            sobrou", que é a única pergunta que ele existe para responder.

            ⛔ Se um dia a pílula voltar a ficar apertada, a saída é mexer NELA
            (fonte, padding, sair para o outro lado) — nunca no piso da fita. */}
        {fluxo.etapas.map((e, i) => {
            if (e.fracao == null) return null;
            const cabe = e.espessura >= ALTURA_PILULA + 4;
            /* Fora, ela sobe: abaixo ficaria em cima da pílula de perda, que
               mora logo ali. `topoDaFita` é a borda de cima da etapa. */
            const topoDaFita = centroY - e.espessura / 2;
            const y = cabe ? centroY : topoDaFita - FOLGA_PILULA - ALTURA_PILULA / 2;
            return (
              <React.Fragment key={`taxa-${etapas[i]!.label}`}>
                {/* O traço só existe quando a pílula saiu: ele é o que a mantém
                    LIGADA à etapa. Sem ele, uma etiqueta solta no ar acima de
                    uma fita fina não diz a qual etapa pertence. */}
                {!cabe && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: e.x,
                      top: topoDaFita - FOLGA_PILULA,
                      width: 1,
                      height: FOLGA_PILULA,
                      /* ⚠️ Cor da FITA, não da cápsula. `--tk-pilula` é #090D14
                         no escuro — mais escuro que o card (1,15:1): o traço
                         existia no DOM e era invisível na tela. E a cor da fita
                         é a certa também por significado: o traço liga a
                         etiqueta à ETAPA, não a si mesma. */
                      background: "var(--tk-fluxo)",
                      pointerEvents: "none",
                    }}
                  />
                )}
                <div
                  className="text-caption"
                  style={{
                    ...pilula("var(--tk-pilula)", "var(--tk-on-pilula)"),
                    left: e.x,
                    top: y,
                    fontWeight: 700,
                  }}
                >
                  {pct1(e.fracao)}
                </div>
              </React.Fragment>
            );
          })}

        {/* ── Pílula do NÃO MEDIDO, na guia do trecho ─────────────────────────
            🔴 Ela ocupa o lugar onde a leitura ingênua veria "100%". Sem ela, um
            trecho reto entre duas etapas de mesmo valor afirma conversão total —
            "meu checkout converte tudo" — quando o que houve foi ausência de
            fonte independente. `100%` e `não medido` não são a mesma frase, do
            mesmo jeito que `0,00x` e `—` não são.

            ⚠️ Fica ACIMA da fita, não abaixo: a pílula de perda mora embaixo, e
            duas cápsulas na mesma guia se encostariam. */}
        {trechosNaoMedidos.map((t) => (
            <div
              key={`nm-rot-${t.i}`}
              className="text-caption"
              title={etapas[t.i]!.trechoNaoMedido}
              style={{
                ...pilula("var(--tk-surface-hover)", "var(--tk-text-secondary)"),
                left: (t.x0 + t.x1) / 2,
                top: TOPO + faixaAlt - ALTURA_PILULA,
                border: "1px dashed var(--tk-border)",
                pointerEvents: "auto",
              }}
            >
              não medido
            </div>
          ))}

        {/* ── Pílula da PERDA, ABAIXO da fita, na GUIA ─────────────────────────
            🔴 É AQUI que a perda existe: em número, não em área. Ancorada na
            guia porque perda acontece ENTRE duas etapas — ancorá-la num centro
            de etapa a atribuiria a uma delas. */}
        {fluxo.perdas.map((p) => (
            <div
              key={`perda-${p.de}`}
              className="text-caption"
              title={etapas[p.de]?.perdaAjuda}
              style={{
                ...pilula("var(--tk-pilula)", "var(--tk-on-pilula)"),
                left: p.x,
                top: TOPO + faixaAlt + 12,
              }}
            >
              −{p.valor.toLocaleString("pt-BR")}
              {p.pct != null && <span style={{ opacity: 0.72 }}> · {pct1(p.pct)}</span>}
              {etapas[p.de]?.perdaLabel && (
                <span style={{ opacity: 0.72 }}> {etapas[p.de]!.perdaLabel}</span>
              )}
            </div>
          ))}

        {/* ── Número absoluto, EMBAIXO, grande e em negrito ────────────────── */}
        {fluxo.etapas.map((e, i) => (
            <div
              key={`abs-${etapas[i]!.label}`}
              className="text-metric-md"
              style={{
                position: "absolute",
                left: e.x,
                top: TOPO + faixaAlt + 34,
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                color: "var(--tk-text)",
                fontVariantNumeric: "tabular-nums",
                fontSize: "var(--tk-b-fita-num, 22px)",
                lineHeight: 1.1,
              }}
            >
              {etapas[i]!.valorFmt}
            </div>
          ))}

        {/* ── A COMPOSIÇÃO, sob o número ───────────────────────────────────────
            "35 ICs · 11 do navegador". Só aparece quando a etapa tem parcelas de
            origens diferentes e o usuário precisa saber a proporção — é o que
            transforma "confie no número" em "veja de onde ele vem". */}
        {fluxo.etapas.map((e, i) =>
            !etapas[i]!.composicao ? null : (
              <div
                key={`comp-${etapas[i]!.label}`}
                className="text-caption text-text-muted"
                style={{
                  position: "absolute",
                  left: e.x,
                  top: TOPO + faixaAlt + 34 + 26,
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {etapas[i]!.composicao}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
