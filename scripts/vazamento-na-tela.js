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

/** O cromo do shell (rail + paddings), MEDIDO uma vez. Ver `naTela`. */
window.__cromoDoShell = () => {
  const g = window.__grade();
  return Math.round(window.innerWidth - g.getBoundingClientRect().width);
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

  return {
    viewport: viewport ?? window.innerWidth,
    larguraDaGrade: Math.round(base.width),
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

"naTela() pronto — use await naTela(1280) / await naTela(2260)";
