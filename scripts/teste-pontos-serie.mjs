/**
 * O ponto da série aparece até 15 e some acima disso (`06` §3).
 *
 * ## Por que este teste renderiza o COMPONENTE, e não uma função pura
 *
 * A regra é uma linha (`pontos.length <= 15`). Testá-la isolada provaria que a
 * comparação está certa e **não provaria que o `<circle>` deixou de sair** — que
 * é a única coisa que importa. Seria o buraco de sempre nesta base: função certa
 * e caminho desligado.
 *
 * Aqui a asserção é sobre o SVG de verdade, contando `<circle>` no markup que o
 * React produz. Ela cai se alguém mexer no limiar, se esquecer de aplicar o
 * `mostrarPontos` numa das duas séries, ou se mover o desenho do ponto para
 * outro lugar do componente.
 *
 * ⚠️ Roda com `tsx` e não com `--experimental-strip-types`, porque este é o
 * primeiro teste da base que precisa ler `.tsx` — o strip-types do Node não lê
 * JSX. Ver o `test:pontos` no `package.json`.
 *
 *   npm run test:pontos
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { LineChart } = await import("../src/components/tk/LineChart.tsx");

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

/** Série sintética de N dias com valores que variam — nada de série achatada. */
const serie = (n) =>
  Array.from({ length: n }, (_, i) => ({
    rotulo: `d${i}`,
    a: 1000 + Math.round(Math.sin(i) * 400) + i * 30,
    b: 400 + Math.round(Math.cos(i) * 120),
  }));

const circulos = (n) => {
  const html = renderToStaticMarkup(
    React.createElement(LineChart, { pontos: serie(n), formatar: (v) => `R$ ${v}` }),
  );
  return (html.match(/<circle/g) || []).length;
};

console.log("\n\x1b[1mPonto da série — visível até 15, escondido acima\x1b[0m\n");

/* ── A faixa que APARECE ───────────────────────────────────────────────────── */

checar("4 pontos → 8 círculos (dois por ponto: Receita e Gasto)", () => {
  assert.equal(circulos(4), 8);
});

checar("15 pontos (o limite) → ainda visíveis, 30 círculos", () => {
  assert.equal(circulos(15), 30);
});

/* ── A faixa que SOME — o caso que a guarda existe para cobrir ─────────────── */

checar("16 pontos (um acima do limite) → NENHUM círculo", () => {
  assert.equal(circulos(16), 0);
});

checar("20 pontos → NENHUM círculo", () => {
  assert.equal(circulos(20), 0);
});

checar("90 pontos (trimestre diário) → NENHUM círculo", () => {
  assert.equal(circulos(90), 0);
});

/* ── A asserção precisa poder falhar pelo motivo que alega medir ───────────── */

checar("a virada acontece EXATAMENTE entre 15 e 16, não em outro lugar", () => {
  // Sem isto, "0 círculos em 20" passaria também com o ponto removido de vez —
  // e a contagem em 15 passaria com o limiar em qualquer número acima de 15.
  assert.ok(circulos(15) > 0, "15 deveria mostrar");
  assert.equal(circulos(16), 0, "16 deveria esconder");
});

/* ── O desenho em si não pode sumir junto ──────────────────────────────────── */

checar("com 20 pontos as LINHAS continuam sendo desenhadas", () => {
  // O modo de falha que esconderia o defeito: alguém "resolve" o ruído dos
  // pontos deixando de renderizar a série inteira acima de 15.
  const html = renderToStaticMarkup(
    React.createElement(LineChart, { pontos: serie(20), formatar: (v) => `R$ ${v}` }),
  );
  const paths = (html.match(/<path/g) || []).length;
  assert.ok(paths >= 4, `esperava ao menos 4 <path> (2 áreas + 2 linhas), veio ${paths}`);
  assert.ok(/hachura/.test(html), "a hachura do Gasto sumiu");
});

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}\n`
    : `\n\x1b[32m${ok} asserções, todas passando\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
