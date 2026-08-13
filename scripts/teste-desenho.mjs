/**
 * Três desenhos cujo defeito **só existe na saída**.
 *
 * ## Por que estes três, e não outros
 *
 * O critério é o que este projeto persegue desde sempre: defeito que `tsc`,
 * `lint` e `build` não veem porque a função está certa e o CAMINHO está
 * desligado. Os três já custaram bug real nesta base.
 *
 * | Componente | O defeito que ele já teve |
 * |---|---|
 * | `DonutChart`   | a ponta arredondada come arco dos dois lados. Sem descontar a espessura junto com a folga, os segmentos se tocam e o `strokeLinecap` vira **enfeite invisível** |
 * | `Sparkline`    | buraco na série. O `null` precisa **quebrar o traçado** — ligado por cima, a interpolação inventa um dia que ninguém mediu |
 * | `MedidorRadial`| barras individuais. Um erro de arredondamento nos extremos pinta 24 de 24 num valor de 99,6%, ou 0 de 24 num de 2% |
 * | `FitaFunil`    | a linha "N acessos de robô removidos". No banco de dev `bots` é `[]`, então ela **nunca renderizou** — guarda que não dispara não é guarda |
 *
 * Nos três, a asserção é sobre o **markup renderizado**. Testar a função pura
 * provaria a conta e não provaria o desenho — que é a única coisa que o usuário
 * vê.
 *
 * ⚠️ Roda com `tsx` (lê `.tsx`), não com `--experimental-strip-types`.
 *
 *   npm run test:desenho
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   🔬 GUARDA GENÉRICA DE INSTRUMENTO — asserção sobre GEOMETRIA prova primeiro
   que LEU geometria.

   ## O padrão que ela fecha, e ele já mordeu três vezes nesta base

   | caso | o proxy medido | por que ficou verde |
   |---|---|---|
   | `test:contraste` | pares de token no `globals.css` | não vê `opacity`, então a cor pintada nunca entrou na conta |
   | `naTela` no jsdom | `scrollWidth`/`clientWidth` | jsdom não tem motor de layout e devolve `0`; `0 ≤ 0` passa |
   | a asserção da fita | o `d=` dos `<path>` do markup | a fita esconde geometria atrás de `largura > 0`, e no servidor não há layout: **0 caminhos**, `"" === ""` |

   Nos três o instrumento mede um PROXY, o verde vira atestado, e o defeito real
   fica coberto. Não é falta de atenção: é que a saída de "medi e está certo" é
   idêntica à de "não consegui medir".

   ⛔ A saída NÃO é escrever asserções melhores uma a uma — é a extração ficar
   impossível de usar sem a prova. Por isso `geometria()` **lança** quando a
   entrada é vazia, com o nome do que faltou. Ela não devolve `[]` para o
   chamador comparar: `[]` compara igual a `[]`, que é exatamente o buraco.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Extrai a geometria de `entrada` e **falha nomeando** quando não houver nenhuma.
 *
 * @param entrada  markup, lista de números, ou o que a asserção for comparar
 * @param oQue     o nome do que se está medindo, para a falha ser acionável
 */
function geometria(entrada, oQue) {
  const vals =
    typeof entrada === "string"
      ? (entrada.match(/ d="[^"]{20,}"/g) ?? [])
      : Array.isArray(entrada)
        ? entrada.filter((v) => Number.isFinite(v))
        : [];
  assert.ok(
    vals.length > 0,
    `INSTRUMENTO VAZIO: nenhuma geometria em "${oQue}". A comparação passaria ` +
      `por construção — ver a guarda genérica no topo deste arquivo. ` +
      `Se a origem é markup, lembre que a fita esconde a geometria atrás de ` +
      `'largura > 0' e que não há layout no renderToStaticMarkup.`,
  );
  return vals;
}

import { renderToStaticMarkup } from "react-dom/server";
import { interpolarNaoMedidas } from "@/components/tk/FitaFunil";
import { ehBuracoImpossivel } from "@/components/dashboard/catalogoRender";
import { calcularFluxo, segmentosDaFita } from "@/lib/funil/fita";

const { DonutChart } = await import("../src/components/tk/DonutChart.tsx");
const { Sparkline } = await import("../src/components/tk/Sparkline.tsx");
const { MedidorRadial } = await import("../src/components/tk/MedidorRadial.tsx");
const { FitaFunil } = await import("../src/components/tk/FitaFunil.tsx");

let ok = 0;
const falhas = [];
function checar(nome, fn) {
  try {
    fn();
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome}`);
  } catch (e) {
    falhas.push(nome);
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      ${e.message}`);
  }
}
const secao = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

const brl = (n) => `R$ ${n.toLocaleString("pt-BR")}`;
const fatia = (nome, valor, cor) => ({ nome, valor, cor });

/* ══════════════════════════════════════════════════════════════════════════ */
secao("DonutChart — a folga entre segmentos precisa EXISTIR no desenho");

const donut = (fatias) =>
  renderToStaticMarkup(
    React.createElement(DonutChart, { fatias, totalLabel: brl(1), formatar: brl }),
  );

/** Lê os `stroke-dasharray` dos arcos: `"<traço> <resto>"`. */
function tracos(html) {
  return [...html.matchAll(/stroke-dasharray="([\d.]+) ([\d.]+)"/g)].map((m) => ({
    traco: +m[1],
    resto: +m[2],
  }));
}

checar("a soma dos traços é MENOR que a circunferência — há folga de verdade", () => {
  const html = donut([
    fatia("A", 40, "var(--tk-primary)"),
    fatia("B", 30, "var(--tk-accent)"),
    fatia("C", 30, "var(--tk-category)"),
  ]);
  const t = tracos(html);
  assert.equal(t.length, 3, "esperava 3 arcos");
  const circ = t[0].traco + t[0].resto;
  const soma = t.reduce((s, x) => s + x.traco, 0);
  // Se alguém remover o desconto da espessura, `soma` volta a ser ~circ e a
  // ponta arredondada passa a se sobrepor ao vizinho em vez de aparecer.
  assert.ok(soma < circ * 0.97, `soma ${soma.toFixed(1)} vs circunferência ${circ.toFixed(1)}`);
});

checar("todo arco tem ponta ARREDONDADA — senão a folga vira só um buraco", () => {
  const html = donut([fatia("A", 60, "var(--tk-primary)"), fatia("B", 40, "var(--tk-accent)")]);
  const redondas = (html.match(/stroke-linecap="round"/g) || []).length;
  assert.ok(redondas >= 2, `só ${redondas} pontas arredondadas`);
});

checar("fatia minúscula (0,4%) vira PONTO — não some do anel", () => {
  // A legenda ao lado a lista. Se ela sumir do anel, o olho procura no desenho
  // uma fatia que não está lá.
  const html = donut([
    fatia("Grande", 5400, "var(--tk-primary)"),
    fatia("Média", 3600, "var(--tk-accent)"),
    fatia("Mínima", 40, "var(--tk-category)"),
  ]);
  const t = tracos(html);
  assert.equal(t.length, 3);
  assert.ok(t[2].traco > 0, "a fatia minúscula saiu com traço zero — sumiu");
});

checar("uma fatia só NÃO desenha anel — vira a frase", () => {
  // Um anel de 100% não informa nada. O atalho existe e precisa continuar.
  const html = donut([fatia("Meta Ads", 100, "var(--tk-primary)")]);
  assert.equal(tracos(html).length, 0, "desenhou anel para fatia única");
  assert.ok(/Todo o faturamento veio de/.test(html), "sumiu a frase do caso de fatia única");
});

/* ══════════════════════════════════════════════════════════════════════════ */
secao("Sparkline — o buraco INTERROMPE o traçado");

const spark = (valores) =>
  renderToStaticMarkup(React.createElement(Sparkline, { valores, cor: "var(--tk-primary)" }));
const conta = (html, tag) => (html.match(new RegExp(`<${tag}`, "g")) || []).length;

checar("série contínua desenha UM caminho de linha", () => {
  const html = spark([1, 5, 3, 8, 4, 9]);
  // linha + área = 2 <path>.
  assert.equal(conta(html, "path"), 2, html.slice(0, 300));
});

checar("a ÁREA também é partida — ela não preenche por baixo do buraco", () => {
  /* 🔴 O defeito histórico: o servidor mandava 0 e o ponto era plotado no CHÃO,
     indistinguível de "o ROAS despencou". Hoje manda null, e o null quebra.

     ⚠️ A asserção é sobre SUBCAMINHOS (`M`), não sobre a contagem de `<path>`:
     o componente junta todos os trechos num elemento só. Contar elementos daria
     2 aqui e 2 numa série contínua — o teste passaria sem medir nada, que é
     exatamente a asserção que não pode falhar pelo motivo que alega. */
  const html = spark([1, 5, 3, null, 8, 4, 9]);
  const area = html.match(/<path d="([^"]+)" fill="url/);
  assert.ok(area, "não achei o caminho da área");
  assert.equal((area[1].match(/M/g) || []).length, 2, area[1]);
  // E o contraste: série sem buraco tem UM subcaminho de área.
  const cheia = spark([1, 5, 3, 8, 4, 9]).match(/<path d="([^"]+)" fill="url/);
  assert.equal((cheia[1].match(/M/g) || []).length, 1, "série contínua veio partida");
});

checar("os trechos NÃO são ligados por cima do buraco", () => {
  const html = spark([1, 5, 3, null, 8, 4, 9]);
  // Dois `M` no atributo da linha = dois trechos independentes. Um só = alguém
  // religou os lados e inventou a interpolação que o null existe para impedir.
  const linha = html.match(/<path d="([^"]+)" fill="none"/);
  assert.ok(linha, "não achei o caminho da linha");
  assert.equal((linha[1].match(/M/g) || []).length, 2, linha[1]);
});

checar("ponto ISOLADO entre dois buracos vira <circle> — não some", () => {
  const html = spark([1, 2, 3, null, 7, null, 4, 5, 6]);
  assert.ok(conta(html, "circle") >= 1, "o dia isolado sumiu do desenho");
});

checar("menos de 3 pontos não desenha — e DIZ por quê", () => {
  const html = spark([4, 9]);
  assert.equal(conta(html, "path"), 0);
  assert.ok(/sem histórico/.test(html), "sumiu a explicação da ausência");
});

checar("série sem nenhum ponto reserva a altura e fica MUDA", () => {
  // Escrever "dados insuficientes" culparia o dado por uma ausência da
  // ferramenta — e repetiria a mensagem em todo carregamento.
  const html = spark([]);
  assert.equal(conta(html, "path"), 0);
  assert.ok(!/insuficiente|sem histórico/.test(html), html);
});

/* ══════════════════════════════════════════════════════════════════════════ */
secao("MedidorRadial — 24 barras, sempre, e os extremos não arredondam errado");

const medidor = (valor) =>
  renderToStaticMarkup(
    React.createElement(MedidorRadial, { valor, cor: "var(--tk-success)", rotulo: `${valor}%` }),
  );
/** Barras pintadas = as que NÃO usam o traço neutro. */
const pintadas = (html) =>
  [...html.matchAll(/stroke="([^"]+)"/g)].filter((m) => m[1] !== "var(--tk-surface-hover)").length;

checar("sempre 24 barras, qualquer que seja o valor", () => {
  for (const v of [0, 1, 50, 99.6, 100]) {
    const n = (medidor(v).match(/<line/g) || []).length;
    assert.equal(n, 24, `valor ${v} desenhou ${n} barras`);
  }
});

checar("0% não pinta NENHUMA barra", () => {
  assert.equal(pintadas(medidor(0)), 0);
});

checar("100% pinta TODAS as 24", () => {
  assert.equal(pintadas(medidor(100)), 24);
});

checar("99,6% NÃO pinta as 24 — arredondar para cima mentiria 'completo'", () => {
  // round(0.996 * 24) = 24. É o caso em que o arredondamento afirma que a taxa
  // fechou quando não fechou.
  const n = pintadas(medidor(99.6));
  assert.ok(n < 24, `99,6% pintou ${n} de 24 — indistinguível de 100%`);
});

checar("2% pinta ao menos UMA — o medidor não finge que não houve nada", () => {
  assert.ok(pintadas(medidor(2)) >= 1, "2% ficou idêntico a 0%");
});

checar("valor fora da faixa é grampeado, não estoura", () => {
  // `rate` vem do servidor; um arredondamento de 100,4% pintaria uma barra que
  // não existe no arco.
  assert.equal(pintadas(medidor(140)), 24);
  assert.equal(pintadas(medidor(-10)), 0);
});

checar("a cor vem de FORA — o medidor não deriva tom nenhum do valor", () => {
  // Se ele derivasse, `1 de 1 = 100%` sairia verde e a regra das 5 tentativas
  // morreria em silêncio. Ver a nota do componente.
  const html = renderToStaticMarkup(
    React.createElement(MedidorRadial, { valor: 100, cor: "var(--tk-text-muted)", rotulo: "100%" }),
  );
  assert.ok(html.includes("var(--tk-text-muted)"), "ignorou a cor recebida");
  assert.ok(!html.includes("var(--tk-success)"), "inventou verde a partir do valor");
});

/* ── A DECLARAÇÃO DO QUE SAIU DO CÁLCULO ───────────────────────────────────────

   🔴 Ela existe porque afirmar "removemos os robôs" sem mostrar o número é pedir
   que o usuário aceite no escuro — ele não consegue julgar se o filtro exagera
   ou se falha.

   ⚠️ E ela está aqui porque NÃO DISPARA no ambiente de desenvolvimento: o
   `/api/dashboard` do dev devolve `bots: []`, medido em 07/08/2026. Sem este
   teste, a linha teria sido escrita, revisada, commitada e nunca vista — que é
   exatamente a família "passa no build com a coisa desligada".

   As duas metades importam: que ela APAREÇA com dado, e que ela SUMA sem. Uma
   linha fixa dizendo "0 removidos" seria ruído em todo período limpo. */

const ETAPAS_FALSAS = [
  { label: "Cliques", valor: 1220, valorFmt: "1.220" },
  { label: "ICs", valor: 35, valorFmt: "35" },
  { label: "Vendas Apr.", valor: 25, valorFmt: "25" },
];

checar("a linha de exclusão RENDERIZA o número e o texto", () => {
  const html = renderToStaticMarkup(
    React.createElement(FitaFunil, {
      etapas: ETAPAS_FALSAS,
      exclusoes: [{ texto: "119 acessos de robô removidos" }, { texto: "42 eventos de teste fora do funil" }],
    }),
  );
  assert.ok(html.includes("119 acessos de robô removidos"), "a linha dos robôs não saiu no markup");
  assert.ok(html.includes("42 eventos de teste fora do funil"), "a linha dos ambientes de teste não saiu");
});

checar("sem exclusão nenhuma, a linha SOME — não vira '0 removidos'", () => {
  const html = renderToStaticMarkup(React.createElement(FitaFunil, { etapas: ETAPAS_FALSAS }));
  assert.ok(!/removid|fora do funil/.test(html), `apareceu declaração sem ter o que declarar: ${html.slice(0, 200)}`);
});

checar("a fita renderiza as pílulas de etapa e a de perda", () => {
  /* ⚠️ `largura` nasce 0 no servidor (o ResizeObserver só roda no cliente),
     então a GEOMETRIA não sai daqui — o que se prova é que os rótulos existem
     e que o componente não quebra sem medida. A forma quem responde é a tela. */
  const html = renderToStaticMarkup(React.createElement(FitaFunil, { etapas: ETAPAS_FALSAS }));
  assert.ok(html.includes("1.220"), "o número absoluto não saiu");
  assert.ok(!/NaN|Infinity/.test(html), "coordenada inválida no markup");
});

/* ── MEDIDO × NÃO MEDIDO na etapa de ICs ───────────────────────────────────────

   🔴 `Click.checkoutAt` tem dois escritores, e um é o webhook do gateway: TODA
   VENDA PRODUZ UM IC. Numa conta sem o pixel instalado, `ICs === Vendas
   Iniciadas` por construção, e o trecho do meio da fita desenha 100% de
   conversão — "meu checkout converte tudo" — quando o que houve foi ausência de
   fonte independente.

   É o denominador zero outra vez, em outra camada: `100%` e `não medido` não
   são a mesma afirmação, do mesmo jeito que `0,00x` e `—` não são.

   ⚠️ As duas asserções abaixo têm o par POSITIVO e o NEGATIVO. Só a positiva
   passaria com o componente escrevendo "não medido" em toda etapa, sempre. */

const FUNIL_SEM_PIXEL = [
  { label: "Cliques", valor: 1220, valorFmt: "1.220" },
  { label: "ICs", valor: 35, valorFmt: "35", trechoNaoMedido: "sem pixel no período" },
  { label: "Vendas Inic.", valor: 35, valorFmt: "35" },
];

checar("sem IC de navegador: a pílula do trecho diz NÃO MEDIDO e nunca 100%", () => {
  const html = renderToStaticMarkup(React.createElement(FitaFunil, { etapas: FUNIL_SEM_PIXEL }));
  assert.ok(html.includes("não medido"), "a pílula de não medido não saiu");
  assert.ok(html.includes("sem pixel no período"), "o tooltip do motivo não foi para o markup");
  /* 🔴 A ASSERÇÃO É COMPARATIVA, e três versões dela já falharam pelo motivo
     errado — vale registrar as três, porque cada uma parecia certa:

     | tentativa | por que não servia |
     |---|---|
     | `!html.includes("100%")` | pegava o `100,0%` da etapa de TOPO, que é a fração do máximo e está correta |
     | `count("100,0%") === 1`  | são 3 ocorrências legítimas do MESMO valor: a pílula, o `aria-label` e a versão compacta |
     | `count(naoMedido) === count(medido)` | ver abaixo — a igualdade só valia enquanto a pílula era INDEPENDENTE do estado |

     O que se quer dizer é **"o estado não medido não ACRESCENTA nenhuma
     afirmação de conversão"**, e a relação que diz isso é `<=`, não `===`.

     A igualdade passava porque a pílula mostrava a FRAÇÃO DO MÁXIMO, que não
     depende de o trecho ter sido medido: os dois lados desenhavam o mesmo
     número e a comparação não exercia nada. Desde que a pílula virou TAXA DE
     PASSO, o estado não medido a SUPRIME — ele remove uma afirmação, que é
     exatamente o comportamento desejado, e é o `===` que passa a acusar.

     ⚠️ O `>` na linha de baixo é o que impede a contagem-vazia: sem ele, um
     componente que parasse de escrever `100,0%` nos dois lados passaria com
     `0 <= 0`. A linha de base PRECISA afirmar a conversão para que suprimi-la
     signifique alguma coisa. */
  const medido = FUNIL_SEM_PIXEL.map((e) => ({ ...e, trechoNaoMedido: undefined }));
  const htmlMedido = renderToStaticMarkup(React.createElement(FitaFunil, { etapas: medido }));
  const cem = (h) => (h.match(/100,0%/g) ?? []).length;
  assert.ok(
    cem(htmlMedido) > 0,
    "a linha de base não afirma 100% em lugar nenhum — não há supressão a medir",
  );
  assert.ok(
    cem(html) <= cem(htmlMedido),
    "o estado NÃO MEDIDO acrescentou uma afirmação de conversão que a linha de base não tem",
  );
  /* E não existe pílula de perda no trecho: ICs e Vendas Inic. têm o mesmo
     valor, então não houve queda. Uma "−0" ali seria perda fabricada. */
  assert.ok(!/−0[^\d]/.test(html), "apareceu uma perda de zero no trecho não medido");
});

checar("a etapa NÃO SOME quando o trecho é não medido", () => {
  /* ⛔ Etapa que desaparece muda a forma do funil em silêncio, e a forma é o
     que a pessoa compara entre períodos. */
  const html = renderToStaticMarkup(React.createElement(FitaFunil, { etapas: FUNIL_SEM_PIXEL }));
  for (const e of FUNIL_SEM_PIXEL) {
    assert.ok(html.includes(e.label), `a etapa ${e.label} sumiu do funil`);
  }
});

checar("COM IC de navegador, o 'não medido' NÃO aparece", () => {
  /* O lado negativo. Sem ele, um componente que escrevesse "não medido" sempre
     passaria na asserção de cima. */
  const medido = FUNIL_SEM_PIXEL.map((e) => ({ ...e, trechoNaoMedido: undefined }));
  const html = renderToStaticMarkup(React.createElement(FitaFunil, { etapas: medido }));
  assert.ok(!html.includes("não medido"), "declarou não medido onde havia medição");
});

checar("origem MISTA: a composição aparece com os dois números", () => {
  const html = renderToStaticMarkup(
    React.createElement(FitaFunil, {
      etapas: [
        { label: "Cliques", valor: 1220, valorFmt: "1.220" },
        { label: "ICs", valor: 35, valorFmt: "35", composicao: "35 ICs · 11 do navegador" },
        { label: "Vendas Inic.", valor: 20, valorFmt: "20" },
      ],
    }),
  );
  assert.ok(html.includes("35 ICs"), "o total não saiu na composição");
  assert.ok(html.includes("11 do navegador"), "a parcela do navegador não saiu");
});

/* ── A FAIXA DE COBERTURA ──────────────────────────────────────────────────────

   🔴 SUBSTITUI o teste `"a perda de RASTREAMENTO é rotulada"`, que ficou VERDE
   sobre caminho morto quando `Cliques` saiu da fita: `perdaLabel` perdeu todos
   os chamadores de produção e só a fixture o exercia. Um símbolo cujo único
   consumidor é o teste que o testa está morto com atestado de saúde.

   A preocupação não morreu — perda de rastreamento não é abandono, e continua
   precisando de tratamento próprio. Ela MUDOU DE LUGAR: quem a mostra agora é
   a faixa de cobertura, e é ela que passa a ter teste. */

const COM_COBERTURA = (fracao, extra = {}) => ({
  etapas: [
    { label: "Cliques", valor: 1220, valorFmt: "1.220", foraDaFita: true },
    { label: "Sessões", valor: 400, valorFmt: "400" },
    { label: "Vendas", valor: 25, valorFmt: "25" },
  ],
  cobertura: { fracao, pct: "32,8%", perdidos: "820 cliques perdidos", ...extra },
});

/* 🔴 O RÓTULO DIZ "DA META", e a palavra é a informação — não é enfeite.
   A razão tem `DailyAdMetric.clicks` no denominador, que só cobre a Meta. Um
   rótulo que diga só "dos cliques" faz o número parecer cobrir o tráfego
   inteiro, e ele cobre o pedaço que tem denominador. Ancorar aqui é o que
   impede a palavra de cair fora num "ajuste de microcópia". */
const ROTULO_COBERTURA = "dos cliques da Meta rastreados";

checar("a cobertura renderiza o número E o que se perdeu", () => {
  const html = renderToStaticMarkup(React.createElement(FitaFunil, COM_COBERTURA(0.328)));
  assert.ok(html.includes("32,8%"), "a porcentagem de cobertura não saiu");
  assert.ok(html.includes("820 cliques perdidos"), "o número de perdidos não saiu");
  assert.ok(html.includes(ROTULO_COBERTURA), "o rótulo do que o número significa não saiu");
});

checar("a cobertura declara as OUTRAS ORIGENS em contagem, e sem percentual", () => {
  /* 🔴 A razão e a contagem são grandezas DIFERENTES, de propósito. Estas
     sessões não têm denominador nesta base — não existe "cliques do Google" —,
     então um percentual sobre elas seria inventado.

     ⚠️ A asserção é DIFERENCIAL: o mesmo fixture nos dois estados, e o que se
     mede é o que o estado tem PERMISSÃO de acrescentar. Um `includes` literal
     passaria também se alguém trocasse a contagem por um percentual. */
  const semOutras = renderToStaticMarkup(React.createElement(FitaFunil, COM_COBERTURA(0.328)));
  const comOutras = renderToStaticMarkup(
    React.createElement(FitaFunil, COM_COBERTURA(0.328, { outrasOrigens: "20 sessões de outras origens" })),
  );
  /* Linha de base: sem ela, "não achei percentual" passaria com markup vazio. */
  assert.ok(semOutras.length > 1000, "linha de base: a fita não renderizou");
  assert.ok(!semOutras.includes("outras origens"), "a linha apareceu sem ninguém pedir");
  assert.ok(comOutras.includes("20 sessões de outras origens"), "a contagem não saiu");
  /* O estado só pode ACRESCENTAR contagem — nunca uma segunda porcentagem. */
  const pcts = (h) => (h.match(/\d+,\d%/g) ?? []).length;
  assert.equal(
    pcts(comOutras),
    pcts(semOutras),
    "as outras origens acrescentaram uma PORCENTAGEM — elas não têm denominador",
  );
});

checar("a JANELA só é declarada quando as duas pontas não se cobrem", () => {
  /* ⚠️ Declarar sempre viraria ruído que se aprende a ignorar, e aí a linha não
     denunciaria o dia em que a divergência importasse. O par positivo/negativo
     é o que prova que ela é condicional em vez de decorativa. */
  const sem = renderToStaticMarkup(React.createElement(FitaFunil, COM_COBERTURA(0.328)));
  const com = renderToStaticMarkup(
    React.createElement(FitaFunil, COM_COBERTURA(0.328, { janela: "cliques 30/07–12/08 · sessões 04/08–07/08" })),
  );
  assert.ok(sem.length > 1000, "linha de base: a fita não renderizou");
  assert.ok(!sem.includes("cliques 30/07"), "a janela saiu sem haver desencontro");
  assert.ok(com.includes("cliques 30/07–12/08 · sessões 04/08–07/08"), "a janela não saiu");
});

checar("abaixo do limiar a cobertura ganha COR DE ATENÇÃO", () => {
  /* O par positivo/negativo em torno de `LIMIAR_ATENCAO_COBERTURA` (0,25). Sem
     as duas metades, um componente que tingisse SEMPRE passaria na primeira. */
  const baixa = renderToStaticMarkup(React.createElement(FitaFunil, COM_COBERTURA(0.029)));
  const alta = renderToStaticMarkup(React.createElement(FitaFunil, COM_COBERTURA(0.80)));
  const tons = (h) => (h.match(/--tk-warning/g) ?? []).length;
  assert.ok(tons(baixa) > 0, "2,9% de cobertura não acendeu a cor de atenção");
  assert.equal(tons(alta), 0, "80% de cobertura acendeu atenção — o limiar não está sendo lido");
});

checar("cobertura INDEFINIDA não é cobertura ruim", () => {
  /* 🔴 A distinção central do projeto, nesta camada: sem clique nenhum não se
     divide, e `null` não pode virar alarme. Tingir o indefinido afirmaria falha
     de instalação onde não houve tráfego. */
  const html = renderToStaticMarkup(
    React.createElement(FitaFunil, COM_COBERTURA(null, { pct: "—", perdidos: undefined })),
  );
  assert.equal(
    (html.match(/--tk-warning/g) ?? []).length,
    0,
    "cobertura indefinida acendeu a cor de atenção",
  );
});

checar("sem a prop de cobertura, nada de cobertura é desenhado", () => {
  /* O lado negativo da faixa inteira: ela é opcional, e um componente que a
     desenhasse sempre inventaria uma medição em toda tela que não a passa. */
  const html = renderToStaticMarkup(
    React.createElement(FitaFunil, { etapas: ETAPAS_FALSAS }),
  );
  /* ⚠️ LINHA DE BASE antes da negação. Sem ela, esta asserção passaria com
     markup vazio — e passaria também se alguém trocasse o texto do rótulo, que
     é exatamente o que acabou de acontecer: a âncora era `"dos cliques
     rastreados"` e o rótulo virou `"dos cliques da Meta rastreados"`. A
     negativa continuou verde afirmando o contrário do que mede. */
  assert.ok(html.length > 1000, "linha de base: a fita não renderizou");
  assert.ok(!html.includes(ROTULO_COBERTURA), "a faixa de cobertura saiu sem ninguém pedir");
});

checar("a pílula de perda mostra só o NÚMERO — não há mais rótulo de perda", () => {
  /* Guarda contra a volta do órfão: `perdaLabel` foi deletado, e um `<span>` de
     rótulo reaparecendo ali significa que alguém religou o caminho morto. */
  const html = renderToStaticMarkup(React.createElement(FitaFunil, COM_COBERTURA(0.328)));
  assert.ok(html.includes("−375"), "a perda Sessões → Vendas sumiu da pílula");
  assert.ok(!html.includes("sem rastreamento"), "voltou um rótulo de perda na pílula");
});

/* ── 🕳️ O BURACO IMPOSSÍVEL — etapa ZERO com posterior POSITIVA ──────────────

   🔴 O caso real (07/08/2026): com o seed novo o funil ficou
   `Cliques 1.962 → Sessões 22 → ICs 0 → Vendas Inic. 22 → Vendas Apr. 22`, e a
   fita desenhou GRAVATA-BORBOLETA: fechou em nada nos ICs e reabriu. Lê como
   "todo mundo sumiu e voltou" — e é impossível, porque 22 vendas iniciadas não
   saem de 0 checkouts. Aquele zero não era medição, era ausência dela.

   ⛔ A distinção que estas asserções protegem, e que é fácil de perder:

     etapa MAIOR que a anterior   → pode ser REAL (dois instrumentos)
     etapa ZERO com posterior > 0 → IMPOSSÍVEL, logo não medida

   A primeira é o `Cliques → Sessões`; tratá-la como buraco esconderia uma
   discordância de instrumentos que o produto declara de propósito. */

checar("etapa ZERO com posterior positiva é buraco; a que CRESCE não é", () => {
  const funil = [1962, 22, 0, 22, 22];
  assert.equal(ehBuracoImpossivel(funil, 2), true, "o zero do meio não foi marcado");
  assert.equal(ehBuracoImpossivel(funil, 0), false, "a primeira etapa não é buraco");
  assert.equal(ehBuracoImpossivel(funil, 1), false, "etapa com valor não é buraco");
  /* A etapa que CRESCE (dois instrumentos) nunca é buraco — ela tem valor. */
  assert.equal(ehBuracoImpossivel([10, 90, 5], 1), false, "crescer não é buraco");
  /* Zero no FIM é legítimo: o funil terminou ali, não há massa depois. */
  assert.equal(ehBuracoImpossivel([100, 50, 0], 2), false, "zero final não é buraco");
  assert.equal(ehBuracoImpossivel([100, 0, 0], 1), false, "zero seguido só de zeros não é buraco");
});

checar("a fita ATRAVESSA o buraco — nenhum ponto de espessura zero no meio", () => {
  const etapas = [1962, 22, 0, 22, 22].map((valor, i) => ({
    valor,
    trechoNaoMedido: i === 2 ? "não medida" : undefined,
  }));
  const g = interpolarNaoMedidas(etapas);

  /* A afirmação central: o ponto do meio deixou de ser zero. */
  assert.ok(g[2] > 0, `a etapa não medida continua com espessura zero: ${JSON.stringify(g)}`);
  /* E ficou ENTRE os vizinhos medidos, em vez de virar um número inventado. */
  assert.ok(g[2] >= Math.min(g[1], g[3]) && g[2] <= Math.max(g[1], g[3]),
    `o valor interpolado saiu do intervalo dos vizinhos: ${JSON.stringify(g)}`);
  /* ⛔ E as etapas MEDIDAS não podem ter sido tocadas — senão a correção do
     buraco teria mexido em número que alguém mediu, que é o defeito oposto. */
  assert.deepEqual([g[0], g[1], g[3], g[4]], [1962, 22, 22, 22], "etapa medida foi alterada");
});

checar("etapa não medida com valor POSITIVO não é interpolada", () => {
  /* O caso do `AVISO_SEM_PIXEL`: os ICs vêm todos do gateway, então a conversão
     não foi medida — mas o NÚMERO é real. Interpolar ali apagaria uma medição. */
  const etapas = [100, 40, 40].map((valor, i) => ({
    valor,
    trechoNaoMedido: i === 1 ? "derivado do gateway" : undefined,
  }));
  assert.deepEqual(interpolarNaoMedidas(etapas), [100, 40, 40]);
});

/* ⚠️ TUDO QUE VIER DEPOIS DO `process.exit` LÁ EMBAIXO NÃO EXECUTA, e o total
   no rodapé sobe do mesmo jeito. Asserção nova entra ACIMA dele. */

checar("razão ACIMA DE 1 não é impressa como taxa — ela nomeia a causa", () => {
  /* 🔴 Uma taxa de conversão pressupõe numerador SUBCONJUNTO do denominador.
     Quando ela passa de 100% a premissa quebrou, e o número não tem intervalo
     válido — imprimir "150,0%" ali afirma que mais gente comprou do que chegou.

     O caso medido no dev em 13/08/2026: `ICs` sai da tabela `Click` (nosso
     script) e `Vendas Inic.` sai do gateway. 57 contra 38 = 150%. */
  const crescente = renderToStaticMarkup(
    React.createElement(FitaFunil, {
      etapas: [
        { label: "ICs", valor: 38, valorFmt: "38", fonte: "Nosso script" },
        { label: "Vendas Inic.", valor: 57, valorFmt: "57", fonte: "Gateway" },
      ],
    }),
  );
  assert.ok(crescente.length > 1000, "linha de base: a fita não renderizou");
  assert.ok(crescente.includes("fontes diferentes"), "a guarda não nomeou a causa");
  assert.ok(!crescente.includes("150,0%"), "a razão acima de 1 foi impressa como taxa");

  /* O LADO NEGATIVO, e sem ele a guarda passaria tingindo tudo: uma razão que
     cabe em [0,1] continua sendo taxa, e continua sendo impressa como taxa. */
  const normal = renderToStaticMarkup(
    React.createElement(FitaFunil, {
      etapas: [
        { label: "Sessões", valor: 57, valorFmt: "57", fonte: "Nosso script" },
        { label: "ICs", valor: 38, valorFmt: "38", fonte: "Nosso script" },
      ],
    }),
  );
  assert.ok(normal.includes("66,7%"), "a taxa legítima deixou de ser impressa");
  assert.ok(!normal.includes("fontes diferentes"), "a guarda disparou sobre uma taxa válida");
});

checar("a entrada LATERAL é declarada e NÃO entra na espessura da fita", () => {
  /* 🔴 A regressão que esta asserção existe para impedir é a de antes de
     13/08/2026: `semJornada` era somado à etapa, e a fita ENGORDAVA no meio —
     38 + 35 = 73 contra 57 sessões, com a pílula imprimindo 128,1%.

     ⚠️ A prova de que ela não vira espessura é DIFERENCIAL: a geometria da fita
     tem de ser IDÊNTICA com e sem a entrada lateral. Um `includes` do número
     provaria só que o texto saiu. */
  const base = { label: "ICs", valor: 38, valorFmt: "38" };
  const semLateral = [{ label: "Sessões", valor: 57, valorFmt: "57" }, base];
  const comLateral = [semLateral[0], { ...base, entradaLateral: 35 }];

  const hSem = renderToStaticMarkup(React.createElement(FitaFunil, { etapas: semLateral }));
  const hCom = renderToStaticMarkup(React.createElement(FitaFunil, { etapas: comLateral }));

  assert.ok(hSem.length > 1000, "linha de base: a fita não renderizou");
  assert.ok(hCom.includes("+35 sem jornada"), "a entrada lateral não foi declarada");
  assert.ok(!hSem.includes("sem jornada"), "a declaração saiu sem ninguém pedir");

  /* ── A GEOMETRIA ───────────────────────────────────────────────────────────
     🔴 A PRIMEIRA VERSÃO DESTA METADE NÃO MEDIA NADA, e o modo de erro é o do
     dia: eu comparei os atributos `d` dos caminhos SVG do markup estático. Só
     que a fita guarda toda a geometria atrás de `largura > 0`, e no
     `renderToStaticMarkup` não existe layout — medido, **0 caminhos `d=`** nos
     dois lados. A asserção comparava `"" === ""`, passava por construção, e
     tinha a mesma cara de uma medição.

     ⛔ Não troque de volta por leitura do markup. A costura mensurável é
     `interpolarNaoMedidas`: ela é a ÚNICA entrada de `calcularFluxo`
     (`FitaFunil.tsx:402-406`), então qualquer vazamento da entrada lateral para
     a espessura passaria por aqui obrigatoriamente. */
  /* ⚠️ Passa pela guarda genérica: ela LANÇA se a lista vier vazia, em vez de
     deixar `[] === []` passar. Ver o bloco no topo do arquivo. */
  const geo = (es, nome) => geometria(interpolarNaoMedidas(es), nome);
  assert.deepEqual(geo(semLateral, "fita sem lateral"), [57, 38], "linha de base");
  assert.deepEqual(
    geo(comLateral, "fita com lateral"),
    geo(semLateral, "fita sem lateral"),
    "a entrada lateral mexeu na espessura — ela tem de ficar FORA da geometria",
  );
  /* E o valor ERRADO é nomeado, para o teste falhar pelo motivo que alega: se
     alguém somar de volta, a etapa vira 73 e esta linha é a que cai. */
  assert.ok(
    !geo(comLateral, "fita com lateral").includes(73),
    "a entrada lateral foi somada à etapa (38 + 35 = 73)",
  );

  /* E a taxa da etapa continua sendo 38/57, não 73/57. */
  assert.ok(hCom.includes("66,7%"), "a taxa deixou de ser calculada sobre a população da cadeia");
});

checar("a guarda genérica de instrumento FALHA quando a geometria vem vazia", () => {
  /* 🔴 O LADO NEGATIVO DA PRÓPRIA GUARDA. Sem ele ela seria mais uma proteção
     que nunca disparou — e este arquivo já registrou que guarda sem disparo é
     comentário com sintaxe de código.
     Os três casos abaixo são exatamente as três formas que passaram verde nesta
     base: markup sem caminho, markup sem NENHUM `d=`, e lista vazia. */
  for (const [entrada, nome] of [
    ["<svg></svg>", "markup sem path"],
    ['<svg><path d="M0,0"/></svg>', "markup com d= curto demais para ser geometria"],
    [[], "lista vazia"],
  ]) {
    assert.throws(
      () => geometria(entrada, nome),
      /INSTRUMENTO VAZIO/,
      `a guarda não disparou para: ${nome}`,
    );
  }
  /* E o positivo: com geometria de verdade ela devolve e não atrapalha. */
  assert.equal(geometria([57, 38], "controle").length, 2);
});

checar("a fita se PARTE onde a fonte muda — e nenhum segmento engorda", () => {
  /* 🔴 A regressão que esta asserção impede é a silhueta afirmando ganho de
     massa numa troca de instrumento: 38 ICs (nossa tabela `Click`) para 57
     vendas (gateway) desenhava a fita ENGORDANDO, e forma se lê antes de texto.

     ⛔ E ela prova as três consequências do corte de uma vez, porque provar só
     a partição deixaria taxa e perda livres para atravessar. */
  const etapas = [
    { label: "Sessões", valor: 57, valorFmt: "57", fonte: "Nosso script" },
    { label: "ICs", valor: 38, valorFmt: "38", fonte: "Nosso script" },
    { label: "Vendas Inic.", valor: 57, valorFmt: "57", fonte: "Gateway", fonteMuda: "o gateway assume" },
    { label: "Vendas Apr.", valor: 47, valorFmt: "47", fonte: "Gateway" },
  ];
  const html = renderToStaticMarkup(React.createElement(FitaFunil, { etapas }));
  assert.ok(html.length > 1000, "linha de base: a fita não renderizou");

  /* 1 · O VÃO É DECLARADO. Vão sem rótulo é indistinguível de bug de layout. */
  assert.ok(html.includes("o gateway assume"), "o corte não foi rotulado na tela");

  /* 1b · 🔴 A FITA ESTÁ MESMO PARTIDA — e isto precisa de asserção PRÓPRIA.
     Medido: plantando `if (false && …)` em `segmentosDaFita`, as asserções de
     rótulo, taxa e perda seguiram TODAS verdes. Elas verificam as consequências
     do corte, não a partição — e a partição é o que o dono decidiu.
     ⛔ E não dá para contar `<path>` no markup: sem layout, `largura` é 0 e não
     sai caminho nenhum. A costura mensurável é a função pura. */
  const fluxo = calcularFluxo(etapas.map((e) => e.valor), {
    largura: 1000,
    faixa: 200,
    margem: 12,
    naFita: etapas.map(() => true),
    corte: etapas.map((e) => e.fonteMuda != null),
  });
  const segs = segmentosDaFita(fluxo);
  /* Passa pela guarda genérica: cada segmento tem de ter espessura de verdade,
     senão "2 segmentos" poderia ser dois vazios. */
  segs.forEach((s, i) => geometria(s.map((e) => e.espessura), `segmento ${i}`));
  assert.equal(segs.length, 2, "a fita NÃO se partiu no corte — ela atravessa a troca de fonte");
  assert.deepEqual(
    segs.map((s) => s.map((e) => e.valor)),
    [[57, 38], [57, 47]],
    "os segmentos não são os dois trechos de mesma fonte",
  );
  /* E o que o dono pediu, em uma linha: NENHUM segmento engorda por dentro. */
  segs.forEach((s, i) =>
    s.forEach((e, j) => {
      if (j === 0) return;
      assert.ok(
        e.valor <= s[j - 1].valor,
        `o segmento ${i} engorda de ${s[j - 1].valor} para ${e.valor}`,
      );
    }),
  );

  /* 2 · AS DUAS TAXAS LEGÍTIMAS CONTINUAM DESENHADAS — é o motivo de partir em
         vez de tirar `Vendas` da geometria, que jogaria o 82,5% fora junto. */
  assert.ok(html.includes("66,7%"), "a taxa dentro do rastreamento sumiu");
  assert.ok(html.includes("82,5%"), "a taxa dentro do gateway sumiu — partir não pode custar ela");

  /* 3 · NADA É AFIRMADO ATRAVÉS DO CORTE: nem taxa, nem perda. */
  assert.ok(!html.includes("150,0%"), "a razão atravessou o corte como taxa");
  assert.ok(!html.includes("fontes diferentes"), "a pílula sobrou: quem declara agora é o vão");
  /* A perda LEGÍTIMA continua: 57 → 38 é queda dentro do rastreamento. Ela é a
     linha de base da asserção seguinte — sem ela, "não achei perda" passaria
     com um componente que parou de desenhar perda nenhuma. */
  assert.ok(html.includes("−19"), "linha de base: a perda legítima dentro do instrumento sumiu");

  /* ⚠️ COM ESTES NÚMEROS A PERDA ATRAVÉS DO CORTE NEM PODERIA APARECER — 38 →
     57 é ganho, e ganho já não vira pílula de perda. Uma asserção aqui passaria
     sem exercer a regra do corte. O caso que exerce é a etapa PÓS-corte ser
     MENOR: aí, sem a regra, sairia `−8`. */
  const caindo = [
    ...etapas.slice(0, 2),
    { label: "Vendas Inic.", valor: 30, valorFmt: "30", fonte: "Gateway", fonteMuda: "o gateway assume" },
  ];
  const hCaindo = renderToStaticMarkup(React.createElement(FitaFunil, { etapas: caindo }));
  assert.ok(hCaindo.includes("−19"), "linha de base: a perda legítima sumiu no segundo fixture");
  assert.ok(
    !/−8\b/.test(hCaindo),
    "desenhou PERDA através do corte — a diferença ali é discordância de medição, não gente que sumiu",
  );
});

checar("sem corte declarado, a fita continua INTEIRA — o lado negativo", () => {
  /* Sem este par, um componente que partisse SEMPRE passaria na asserção acima.
     E partir sem motivo é pior que não partir: inventa uma troca de fonte. */
  const semCorte = [
    { label: "Sessões", valor: 57, valorFmt: "57" },
    { label: "ICs", valor: 38, valorFmt: "38" },
    { label: "Vendas Inic.", valor: 30, valorFmt: "30" },
  ];
  const html = renderToStaticMarkup(React.createElement(FitaFunil, { etapas: semCorte }));
  assert.ok(html.length > 1000, "linha de base: a fita não renderizou");
  assert.ok(!html.includes("✂"), "partiu a fita sem ninguém declarar troca de fonte");
  assert.ok(html.includes("78,9%"), "a taxa do trecho sem corte sumiu");
});

checar("a etapa da fita NÃO soma a entrada lateral antes de chegar ao componente", () => {
  /* 🔴 SÃO DUAS REGRESSÕES DIFERENTES, e a asserção acima só pega uma.
     Ela prova que a `FitaFunil` não dobra a entrada lateral na espessura. Mas o
     caminho histórico do defeito é OUTRO: a soma vivia rio acima, e a fita
     recebia o total já somado. Medido: plantando
     `valor: e.value + (e.entradaLateral ?? 0)` no `catalogoRender`, a suíte
     inteira seguiu VERDE — porque a fixture do teste monta as etapas à mão e
     nunca passa por `ETAPAS_PARA_FITA`.

     ⚠️ Por isso esta guarda lê a FONTE. A costura é o `valor:` do
     `ETAPAS_PARA_FITA`, e o que ela proíbe é ele mencionar a entrada lateral. */
  const bruto = readFileSync(
    new URL("../src/components/dashboard/catalogoRender.tsx", import.meta.url),
    "utf8",
    /* ⚠️ 402 arquivos desta base estão em CRLF, e âncora com `\n` falha em
       silêncio neles — devolve "não achei" com a cara de "está tudo certo". */
  ).replace(/\r\n/g, "\n");

  /* ⛔ APAGA COMENTÁRIO ANTES DE MEDIR. Sexta ocorrência da família nesta base:
     o arquivo explica a entrada lateral em prosa, e a prosa contém o nome do
     campo justamente por estar explicando. Preserva a quebra de linha para o
     número reportado continuar sendo o do arquivo. */
  const codigo = bruto
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");

  const linhasValor = codigo
    .split("\n")
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /^\s*valor:/.test(l));

  /* LINHA DE BASE: sem ela, "nenhuma linha ofensora" passaria também com a
     âncora quebrada — e âncora quebrada e código correto dão o mesmo verde. */
  assert.ok(
    linhasValor.length > 0,
    "linha de base: nenhuma linha `valor:` no catalogoRender — a âncora quebrou",
  );

  const ofensoras = linhasValor.filter(([, l]) => /entradaLateral/.test(l));
  assert.deepEqual(
    ofensoras,
    [],
    "a entrada lateral foi somada ao valor da etapa antes de chegar à fita",
  );
});

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}\n`
    : `\n\x1b[32m${ok} asserções, todas passando\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);