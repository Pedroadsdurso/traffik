/**
 * §7.2 DO `07` — VAZIO CONTÍGUO DENTRO DO CARD, medido no navegador.
 *
 * Irmão de `vazamento-na-tela.js` (§7.3). Os dois medem o mesmo card e fazem
 * perguntas OPOSTAS: a §7.3 pergunta se o conteúdo PASSA do slot; a §7.2, se
 * SOBRA buraco dentro dele.
 *
 * ============================================================================
 * 1. A DEFINIÇÃO — decidida em 13/08/2026, porque duas medições divergiam
 * ============================================================================
 *
 * A §4 do `07` diz: *"nenhuma região vazia contígua maior que 32px entre o
 * conteúdo e a borda interna do card"*. A §7 acrescenta o método: *"bounding
 * box do conteúdo contra o retângulo interno do card"*.
 *
 * Isso admitia DUAS leituras, e elas achavam conjuntos diferentes:
 *
 *   (a) só o vão ENTRE pares de coisas pintadas
 *   (b) o vão em qualquer lugar, INCLUSIVE do topo do retângulo interno até a
 *       primeira coisa pintada, e da última até a borda de baixo
 *
 * ⛔ **A §7.2 é a (b), e quem decide é a queixa que ela existe para matar.** O
 * C6 era *"180–400px de vazio contínuo"* em Produtos, Vendas por país e
 * Alertas — lista curta num card alto, com o buraco EMBAIXO. A leitura (a) não
 * enxerga esse caso: não há par de folhas ao redor do vão, há folha e borda.
 *
 * ⚠️ **E a referência SAI da definição, não é escolha independente.** Se o vão
 * vai "até a borda", a borda precisa ser a do CARD — então a referência é o
 * retângulo interno do card (caixa de padding menos padding), e não o
 * `[data-tk-corpo]`. Ver §2.
 *
 * Cada vão sai classificado — `topo` · `meio` · `fim` —, que é a distinção que
 * faltava nas duas medições anteriores. Ela não é cosmética: o `CLAUDE.md`
 * (*VÃO DENTRO DE UM CARD PROMETE CONTEÚDO*) diz que os mesmos pixels se leem
 * de formas diferentes conforme o que está embaixo deles. `fim` é o card
 * acabando; `meio` é a tela afirmando que ali cabia algo.
 *
 * ============================================================================
 * 2. A REFERÊNCIA — e `[data-tk-corpo]` NÃO é a mesma coisa em dois componentes
 * ============================================================================
 *
 *   `Card` com `preencher`  → o gancho está no CORPO (`flex: 1`); o card é o pai
 *   `BlocoMetrica` (KPI)    → o gancho está no CARD; ele desenha a própria superfície
 *
 * ⛔ Então `corpo.parentElement` está certo num e ERRADO no outro: no KPI ele
 * devolve a CÉLULA da grade, que não tem padding nem borda — e medir vazio
 * contra a célula mede o gap da grade, não o card.
 *
 * Resolve-se por MEDIÇÃO (o card é quem desenha superfície, logo tem borda), e
 * a regra que disparou em cada bloco entra na saída, para o alvo ser conferível.
 *
 * ============================================================================
 * 3. O QUE CONTA COMO PINTADO — as duas formas de errar o alvo, já pagas
 * ============================================================================
 *
 * 🔴 **Falso POSITIVO (12/08):** a versão anterior colhia folhas com
 * `!e.children.length`. **`<svg>` tem filhos** (`<path>`, `<g>`), então todo
 * gráfico era descartado como não-pintado e a área dele contava como vazio:
 * `Funil` com 99px e `Receita vs. gasto` com 221px de "vazio" em cima de um
 * gráfico desenhado. Nove blocos reprovavam por isso.
 *
 * 🔴 **Falso NEGATIVO (13/08):** a correção óbvia — tomar a caixa do `<svg>`
 * como pintada — erra para o outro lado. A caixa de um medidor radial é MUITO
 * maior que o arco que ele desenha, e ela tapa vazio real: com ela,
 * `Taxa de aprovação` passava limpo tendo **58px** de banda vazia visível no
 * print, entre os arcos e os rótulos.
 *
 * ⛔ **As duas falham pela mesma porta**, e é a família *a medição não acertou
 * o alvo*: uma some com o defeito, a outra o inventa. O que vale é a TINTA, não
 * a caixa — por isso um `<svg>` entra pela união dos retângulos dos filhos que
 * de fato desenham (`fill`/`stroke` não-`none`).
 *
 * As três fontes de tinta, e nenhuma depende de contar filhos:
 *
 *   1. TEXTO — `Range.getClientRects()` por nó de texto. Devolve as CAIXAS DE
 *      LINHA: um `div` alto com uma linha no topo produz um retângulo pequeno
 *      no topo, e o resto vira vão. A caixa do elemento esconderia o defeito.
 *   2. TINTA DE SVG — os descendentes que desenham, não o `<svg>`.
 *   3. SUPERFÍCIE — descendente com fundo, borda ou sombra visível (barra de
 *      proporção, pílula, separador, célula de heatmap).
 *
 * Descartado: `display:none`, `visibility:hidden`, `opacity:0`, área zero e
 * `sr-only` (largura ≤ 1px) — este já produziu 3 falsos positivos na F2.
 *
 * ⚠️ **O limite conhecido:** a varredura projeta tudo no eixo VERTICAL e em
 * toda a largura do card. Um vão embaixo de UMA coluna, com a coluna vizinha
 * pintando na mesma faixa, não aparece. É conservador de propósito — o
 * contrário produziria uma lista dominada por espaço entre colunas.
 *
 * ============================================================================
 * 4. A GUARDA — a medição IMPRIME O ALVO, e a conclusão só vale depois
 * ============================================================================
 *
 * Toda saída começa por `alvo`: largura resolvida, **examinados sobre o total**,
 * a regra de card que disparou, e `viewportEfetivo`.
 *
 * ⛔ **`viewportEfetivo` é a guarda que mais paga, e ela nasceu de um defeito
 * REAL deste arquivo:** o cromo do shell era remedido a cada chamada, contra uma
 * grade JÁ ENCOLHIDA pela chamada anterior. Pedir 2260 devolvia **1660**, com
 * toda a cara de medição. Hoje o cromo é medido UMA vez, com a grade solta, e a
 * saída publica `viewportEfetivo` — que o caso errado faz divergir do pedido.
 *
 * ⛔ `semGancho > 0` ou `semPintadoNenhum > 0` ANULAM o veredito: são a
 * declaração de que a varredura não viu o que alegou ver. Este mesmo detector já
 * examinou 16 de 28 blocos e deu veredito como se fossem 28.
 *
 * ⚠️ **Bloco em estado vazio sai em fila SEPARADA** (`vazioComVao`), achado por
 * `[data-tk-vazio]`. O estado vazio centra o texto na folga por desenho, então
 * quase todo bloco sem dado acusa — por um motivo que não é o da §7.2. O `07`
 * já diz que o vazio do bloco entra na F3 como item nomeado.
 *
 * ============================================================================
 * 5. Como rodar — em DUAS chamadas, e o motivo é ferramenta
 * ============================================================================
 *
 *     __ajustar(1280)     // 1ª chamada: muda a largura
 *     vazioAgora()        // 2ª chamada: mede, SÍNCRONO
 *
 * ⚠️ Não há `await` aqui de propósito. A versão com `await` dentro do
 * `Runtime.evaluate` **congelou o renderer três vezes** em 13/08/2026 (45s de
 * timeout). O ida-e-volta entre as duas chamadas já dá o tempo de repintura que
 * o `requestAnimationFrame` daria.
 *
 * ⚠️ A emulação encolhe o CONTÊINER, não a janela. O que ela NÃO cobre:
 * `100vw`/`100dvh`, `@container` ancorado em outro elemento, e teclado virtual.
 * Para viewport de verdade, o CDP (`emulate`) é o instrumento — ver o `07`.
 */

window.__grade =
  window.__grade ||
  (() =>
    [...document.querySelectorAll("div")]
      .filter((e) => getComputedStyle(e).gridAutoRows === "80px" && e.getBoundingClientRect().width > 0)
      .pop());

/**
 * Muda a largura da grade.
 *
 * ⛔ O cromo é medido UMA vez e memorizado. Remedi-lo com a grade já encolhida
 * foi o defeito que devolveu 1660 para um pedido de 2260 — ver §4.
 */
window.__ajustar = (viewport) => {
  const alvo = window.__grade().parentElement;
  if (!viewport) {
    alvo.style.width = "";
    return null;
  }
  if (window.__cromo == null) {
    if (alvo.style.width) throw new Error("cromo nao medido e a grade ja esta encolhida — rode __ajustar() sem argumento primeiro");
    window.__cromo = Math.round(window.innerWidth - window.__grade().getBoundingClientRect().width);
  }
  alvo.style.width = viewport - window.__cromo + "px";
  return window.__cromo;
};

window.__cardDoBloco = (celula) => {
  const corpo = celula.querySelector("[data-tk-corpo]");
  if (!corpo) return { card: null, corpo: null, regra: "SEM GANCHO" };
  const temBorda = parseFloat(getComputedStyle(corpo).borderTopWidth) > 0;
  return temBorda
    ? { card: corpo, corpo, regra: "gancho e o card (KPI)" }
    : { card: corpo.parentElement, corpo, regra: "gancho e o corpo, card e o pai" };
};

/** Retângulo INTERNO: caixa de conteúdo (padding box menos padding). */
window.__internoDoCard = (card) => {
  const r = card.getBoundingClientRect();
  const s = getComputedStyle(card);
  const px = (v) => parseFloat(v) || 0;
  return {
    topo: r.top + px(s.borderTopWidth) + px(s.paddingTop),
    base: r.bottom - px(s.borderBottomWidth) - px(s.paddingBottom),
  };
};

window.__ATOMOS = "svg, img, canvas, video, input, select, textarea";
window.__DESENHO = "path, rect, circle, ellipse, line, polygon, polyline, text, image, use";

window.__pintadoNoCard = (card) => {
  const A = window.__ATOMOS;
  const invisivel = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return true;
    const r = el.getBoundingClientRect();
    return r.width <= 1 || r.height <= 0;
  };
  const dentroDeAtomo = (el) => {
    const a = el.closest(A);
    return a && a !== el;
  };

  const faixas = [];
  const conta = { texto: 0, svgTinta: 0, atomos: 0, superficie: 0, svgSemTinta: 0 };

  /* 1 — TEXTO, por caixa de linha. */
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const pai = n.parentElement;
    if (!pai || invisivel(pai) || dentroDeAtomo(pai)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.height > 0 && r.width > 1) {
        faixas.push([r.top, r.bottom]);
        conta.texto++;
      }
    }
  }

  /* 2 — ÁTOMOS. `<svg>` entra pela TINTA dos filhos; a caixa dele mente para o
     lado do falso negativo (ver §3). */
  for (const el of card.querySelectorAll(A)) {
    if (invisivel(el) || dentroDeAtomo(el)) continue;
    if (el.tagName.toLowerCase() === "svg") {
      let achou = 0;
      for (const d of el.querySelectorAll(window.__DESENHO)) {
        const s = getComputedStyle(d);
        const temFill = s.fill && s.fill !== "none";
        const temStroke = s.stroke && s.stroke !== "none" && parseFloat(s.strokeWidth) > 0;
        if (!temFill && !temStroke) continue;
        if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) continue;
        const r = d.getBoundingClientRect();
        if (r.height <= 0 || r.width <= 0) continue;
        faixas.push([r.top, r.bottom]);
        achou++;
      }
      /* Um `<svg>` sem tinta nenhuma é sinal de instrumento, não de vazio. */
      if (achou) conta.svgTinta += achou;
      else conta.svgSemTinta++;
      continue;
    }
    const r = el.getBoundingClientRect();
    faixas.push([r.top, r.bottom]);
    conta.atomos++;
  }

  /* 3 — SUPERFÍCIE. */
  for (const el of card.querySelectorAll("*")) {
    if (el === card || invisivel(el) || dentroDeAtomo(el) || el.matches(A)) continue;
    const s = getComputedStyle(el);
    const fundo = s.backgroundColor && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(s.backgroundColor);
    const borda = ["Top", "Right", "Bottom", "Left"].some(
      (l) => parseFloat(s["border" + l + "Width"]) > 0 && s["border" + l + "Style"] !== "none",
    );
    const sombra = s.boxShadow && s.boxShadow !== "none";
    if (!fundo && !borda && !sombra) continue;
    const r = el.getBoundingClientRect();
    faixas.push([r.top, r.bottom]);
    conta.superficie++;
  }

  return { faixas, conta };
};

window.__vaosVerticais = (faixas, topo, base, limiar) => {
  const uteis = faixas
    .map(([a, b]) => [Math.max(a, topo), Math.min(b, base)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const unido = [];
  for (const [a, b] of uteis) {
    const u = unido[unido.length - 1];
    if (u && a <= u[1] + 0.5) u[1] = Math.max(u[1], b);
    else unido.push([a, b]);
  }
  const vaos = [];
  /* ⛔ AS DUAS BORDAS ENTRAM — é a diferença entre a definição (a) e a (b), e é
     a borda de BAIXO que carrega o C6 inteiro. */
  let cursor = topo;
  for (const [a, b] of unido) {
    if (a - cursor > limiar) vaos.push({ onde: cursor === topo ? "topo" : "meio", px: Math.round(a - cursor) });
    cursor = Math.max(cursor, b);
  }
  if (base - cursor > limiar) vaos.push({ onde: unido.length ? "fim" : "vazio inteiro", px: Math.round(base - cursor) });
  return { vaos, pintados: unido.length };
};

/** Mede na largura ATUAL. Síncrono de propósito — ver §5. */
window.vazioAgora = (limiar = 32) => {
  const g = window.__grade();
  const base = g.getBoundingClientRect();
  const celulas = [...g.children];
  let semGancho = 0;
  const regras = {};
  const blocos = [];

  for (const c of celulas) {
    const nome = (c.innerText || "").split("\n")[0].slice(0, 24) || "(sem titulo)";
    const { card, regra } = window.__cardDoBloco(c);
    regras[regra] = (regras[regra] || 0) + 1;
    if (!card) {
      semGancho++;
      continue;
    }
    const interno = window.__internoDoCard(card);
    const { faixas, conta } = window.__pintadoNoCard(card);
    const { vaos, pintados } = window.__vaosVerticais(faixas, interno.topo, interno.base, limiar);
    const rc = card.getBoundingClientRect();
    blocos.push({
      bloco: nome,
      semDado: !!card.querySelector("[data-tk-vazio]"),
      cardL: Math.round(rc.width),
      cardA: Math.round(rc.height),
      internoA: Math.round(interno.base - interno.topo),
      h: Number(getComputedStyle(c).gridRow.replace("span ", "")) || null,
      fontes: conta,
      pintados,
      vaos,
    });
  }

  const larguraDaGrade = Math.round(base.width);
  const cromo = window.__cromo ?? 0;
  const comDado = blocos.filter((b) => !b.semDado);

  return {
    /* ⛔ A GUARDA. Confira o alvo ANTES de a conclusão valer. */
    alvo: {
      larguraDaGrade,
      viewportEfetivo: larguraDaGrade + cromo,
      cromo,
      innerWidth: window.innerWidth,
      celulasNaGrade: celulas.length,
      examinados: blocos.length,
      semGancho,
      limiar,
      comDado: comDado.length,
      semDado: blocos.length - comDado.length,
      semPintadoNenhum: blocos.filter((b) => b.pintados === 0).length,
      svgSemTinta: blocos.reduce((s, b) => s + b.fontes.svgSemTinta, 0),
      kpi: regras["gancho e o card (KPI)"] || 0,
      painel: regras["gancho e o corpo, card e o pai"] || 0,
    },
    violam: comDado.filter((b) => b.vaos.length),
    vazioComVao: blocos.filter((b) => b.semDado && b.vaos.length).map((b) => b.bloco),
    todos: blocos,
  };
};

/**
 * O DONO de cada vão — o menor elemento que contém a banda inteira.
 *
 * É o que transforma "oito blocos reprovam" em "uma origem": foi ele que
 * mostrou que todas as bandas resolvidas têm dono `flex` com
 * `justify-content: center`.
 */
window.__donoDoVao = (nomePref, limiar = 32) => {
  const g = window.__grade();
  const cel = [...g.children].find((c) => (c.innerText || "").startsWith(nomePref));
  if (!cel) return [{ erro: "bloco nao encontrado: " + nomePref }];
  const { card } = window.__cardDoBloco(cel);
  const int = window.__internoDoCard(card);
  const { faixas } = window.__pintadoNoCard(card);
  const { vaos } = window.__vaosVerticais(faixas, int.topo, int.base, limiar);
  if (!vaos.length) return [];

  const uteis = faixas
    .map(([a, b]) => [Math.max(a, int.topo), Math.min(b, int.base)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const un = [];
  for (const [a, b] of uteis) {
    const u = un[un.length - 1];
    if (u && a <= u[1] + 0.5) u[1] = Math.max(u[1], b);
    else un.push([a, b]);
  }
  const bandas = [];
  let cur = int.topo;
  for (const [a, b] of un) {
    if (a - cur > limiar) bandas.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (int.base - cur > limiar) bandas.push([cur, int.base]);

  return bandas.map(([a, b]) => {
    let melhor = null;
    for (const el of card.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.top <= a + 1 && r.bottom >= b - 1 && r.height > 0) {
        if (!melhor || r.height < melhor.r.height) melhor = { el, r };
      }
    }
    const e = melhor ? melhor.el : card;
    const s = getComputedStyle(e);
    return {
      vao: Math.round(b - a),
      offset: Math.round(a - int.topo),
      tag: e.tagName.toLowerCase(),
      alturaDoDono: Math.round(melhor ? melhor.r.height : 0),
      display: s.display,
      justify: s.justifyContent,
      align: s.alignItems + "/" + s.alignContent,
    };
  });
};

"vazio pronto — __ajustar(1280) numa chamada, vazioAgora() na seguinte";
