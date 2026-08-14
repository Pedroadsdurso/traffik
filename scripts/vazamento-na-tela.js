/**
 * §7.3 DO `07` — MEDIDA NO NAVEGADOR, porque jsdom não tem motor de layout.
 *
 * 🔴 POR QUE ESTE ARQUIVO NÃO É UM TESTE DO `npm test`
 *
 * A §7.3 pede `scrollHeight ≤ clientHeight` de cada bloco no `h` migrado. Isso é
 * uma pergunta de LAYOUT, e `jsdom` — o que roda em `renderToStaticMarkup` e nas
 * suítes desta base — **não calcula posição nem tamanho**: ele devolve `0` para
 * toda medida, e `0 ≤ 0` passa. Um teste verde de vazamento em jsdom não é
 * evidência de nada; ele é a forma mais convincente da "asserção que não pode
 * falhar", porque o número que ela imprime parece uma medição.
 *
 * ⛔ Então a §7.3 **não vira asserção do agregado**. Ela é este procedimento, e
 * o `teste-grade.mjs` diz isso no lugar em que ela caberia — para o verde de lá
 * não ser lido como "não há vazamento".
 *
 * ### Como rodar
 *
 * Cole o conteúdo no console do navegador, com o Dashboard aberto e um período
 * COM DADO (o vazio não exercita nada — bloco sem dado colapsa).
 *
 *     await naTela()            // mede na largura atual
 *     await naTela(1280)        // emula a largura de viewport 1280
 *     await naTela(2260)
 *
 * ⚠️ **A emulação encolhe o CONTÊINER, não a janela.** O `resize_window` do MCP
 * mente com a janela maximizada — cinco vezes até 12/08/2026 —, e o método do
 * contêiner mede a mesma propriedade sem depender dele. O que ele NÃO cobre:
 * `100vw`/`100dvh`, `@container` ancorado em outro elemento, e teclado virtual.
 */

/**
 * O cromo do shell (rail + paddings), MEDIDO uma vez e MEMORIZADO.
 *
 * 🔴 ELE ERA REMEDIDO A CADA CHAMADA, e isso é um defeito medido em 13/08/2026.
 * A segunda chamada media `innerWidth − grade` com a grade **já encolhida pela
 * primeira**, então o cromo crescia a cada rodada e a largura pedida encolhia
 * junto: pedir 2260 devolveu **1660**, com toda a cara de medição.
 *
 * ⛔ É a família *a medição não acertou o alvo* dentro do próprio instrumento —
 * e o que a denunciou foi a guarda publicar `viewportEfetivo` ao lado do
 * pedido. Sem esse par, 1660 é um número perfeitamente plausível para uma grade.
 */
window.__cromoDoShell = () => {
  if (window.__cromo != null) return window.__cromo;
  const alvo = window.__grade().parentElement;
  if (alvo.style.width) {
    throw new Error("cromo nao medido e a grade ja esta encolhida — limpe a largura antes");
  }
  window.__cromo = Math.round(window.innerWidth - window.__grade().getBoundingClientRect().width);
  return window.__cromo;
};

/**
 * A grade dos painéis.
 *
 * ⚠️ O filtro de largura NÃO é zelo: o streaming SSR do Next deixa marcadores de
 * Suspense (`DIV#S:0[hidden]`, 0×0) na árvore, e sem ele o `.pop()` devolve um
 * deles — foi assim que uma medição desta base leu "grade de largura 0" e quase
 * virou relatório de defeito.
 */
window.__grade = () =>
  [...document.querySelectorAll("div")]
    .filter((e) => getComputedStyle(e).gridAutoRows === "80px" && e.getBoundingClientRect().width > 0)
    .pop();

window.naTela = async (viewport) => {
  /**
   * 🔴 ABA DE FUNDO NÃO MEDE — e o modo de falha era MUDO.
   *
   * Medido em 13/08/2026: com `document.hidden`, o navegador **não dispara
   * `requestAnimationFrame`**. A espera de duas passagens de quadro abaixo
   * nunca resolve, a promessa fica pendente para sempre, e não há exceção —
   * `naTela(2260)` devolveu uma promessa que jamais assentou, com o `catch`
   * vazio e o resultado `null`.
   *
   * ⛔ Isso é indistinguível de "ainda está rodando", que é a pior forma de
   * silêncio: quem chamou conclui que a medição demora, não que ela não vai
   * acontecer. É a mesma família do teste que passa sem examinar nada — a saída
   * de "não consegui" é igual à de "estou quase".
   *
   * ⚠️ Não troque a espera por `setTimeout` puro "para funcionar em aba de
   * fundo". A dupla passagem de quadro existe porque ler logo depois de mexer
   * no layout devolve o valor ANTERIOR com cara de medição — foi o que produziu
   * "13 descendentes vazando" nesta base. Em aba oculta não há repintura para
   * esperar, então a medição **não é possível**, e o certo é dizer isso.
   */
  if (document.hidden) {
    throw new Error(
      "ABA OCULTA: requestAnimationFrame não dispara em aba de fundo, e a espera " +
        "de repintura nunca resolveria. Traga esta aba para a frente e rode de novo. " +
        "⛔ Sem isto a chamada ficaria pendente para sempre, sem erro.",
    );
  }
  const g0 = window.__grade();
  const alvo = g0.parentElement;
  if (viewport) {
    /* O cromo é medido ANTES de encolher: depois, o rail pode ter recolhido. */
    alvo.style.width = viewport - window.__cromoDoShell() + "px";
  } else {
    alvo.style.width = "";
  }

  /* ⛔ DUAS PASSAGENS DE QUADRO + FOLGA. Ler logo depois de mexer no layout
     devolve o valor ANTERIOR com a mesma cara de medição — foi o que produziu
     "13 descendentes vazando" numa sessão desta base, que na releitura eram 0. */
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300))));

  const g = window.__grade();
  const base = g.getBoundingClientRect();
  const blocos = [...g.children].map((c) => {
    /* O card é o pai do corpo `flex: 1` — a mesma âncora que o colapso do vazio
       usa. `c.firstElementChild` não serve: em modo de edição há uma moldura. */
    const card = c.querySelector("[data-tk-corpo]")?.parentElement;
    return {
      bloco: c.innerText.split("\n")[0].slice(0, 22),
      h: Number(getComputedStyle(c).gridRow.replace("span ", "")),
      /* A pergunta da §7.3, literal. */
      estouro: card ? Math.round(card.scrollHeight - card.clientHeight) : null,
      /* O gêmeo horizontal, e ele SUBSTITUIU uma varredura por bounding box.
         ⛔ A versão anterior comparava `getBoundingClientRect()` de cada
         descendente contra a borda da grade, e ela dava **13 falsos positivos**
         no Funil: o retângulo de um elemento clipado por um ancestral
         (`overflow: hidden`, ou o `viewBox` de um SVG) continua reportando a
         geometria NÃO clipada. O print mostrava o bloco inteiro dentro do card
         enquanto a medição jurava 465px de fuga.
         `scrollWidth − clientWidth` respeita o clip do mesmo jeito que o
         `scrollHeight` — os dois eixos passam a medir a mesma coisa. */
      estouroH: card ? Math.round(card.scrollWidth - card.clientWidth) : null,
    };
  });

  const larguraDaGrade = Math.round(base.width);
  return {
    /* ⛔ A GUARDA — o ALVO, e a conclusão só vale depois de alguém conferir que
       é o alvo. Saída plausível não é evidência de que o instrumento mediu o
       que se pediu.

       `viewportEfetivo` é o par que denuncia: o caso errado o faz DIVERGIR do
       pedido, e foi assim que o cromo remedido apareceu (2260 pedido → 1660
       efetivo). Um número sozinho não tem como acusar nada.

       `semGancho` e `blocosExaminados` são o DENOMINADOR — a metade mais
       esquecida. Este detector já examinou 16 de 28 blocos e deu veredito como
       se fossem 28. */
    alvo: {
      viewportPedido: viewport ?? null,
      viewportEfetivo: larguraDaGrade + (window.__cromo ?? 0),
      confere: viewport ? larguraDaGrade + window.__cromo === viewport : true,
      innerWidth: window.innerWidth,
      celulasNaGrade: g.children.length,
      blocosExaminados: blocos.filter((b) => b.estouro !== null).length,
      semGancho: blocos.filter((b) => b.estouro === null).map((b) => b.bloco),
    },
    viewport: viewport ?? window.innerWidth,
    larguraDaGrade,
    /* Linha de base: sem ela, "0 estouros" é indistinguível de "não havia o que
       examinar" — a grade pode ter renderizado vazia. */
    blocosExaminados: blocos.length,
    estouramNaVertical: blocos.filter((b) => b.estouro > 1),
    estouramNaHorizontal: blocos.filter((b) => b.estouroH > 1),
    /* A confirmação independente: se nada estoura, a página não rola de lado. */
    rolagemDaPagina: Math.round(
      document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
    ),
  };
};

/* ⚠️ ATRIBUICAO, nao expressao solta: o valor continua sendo o retorno do REPL
   (que e o ponto — colar o arquivo no console imprime esta linha), e o lint
   para de emitir no-unused-expressions. Um warning ignorado ja escondeu um
   defeito real nesta base em 14/08. */
globalThis.__naTelaPronto = "naTela() pronto — use await naTela(1280) / await naTela(2260)";
