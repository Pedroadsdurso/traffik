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
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { DonutChart } = await import("../src/components/tk/DonutChart.tsx");
const { Sparkline } = await import("../src/components/tk/Sparkline.tsx");
const { MedidorRadial } = await import("../src/components/tk/MedidorRadial.tsx");

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

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}\n`
    : `\n\x1b[32m${ok} asserções, todas passando\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
