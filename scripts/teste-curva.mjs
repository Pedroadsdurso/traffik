/**
 * `caminhoSuave` — a curva das séries NÃO pode ultrapassar os pontos que a geraram.
 *
 * ## Por que este teste amostra a Bézier em vez de comparar a string
 *
 * Um teste que congelasse o `d=` defenderia o bug: ele passaria igual com uma
 * curva que passa pelos pontos certos e afunda abaixo de zero entre eles, que é
 * exatamente o defeito que a interpolação monotônica existe para impedir. O que
 * vale é a PROPRIEDADE, e ela não conhece número nenhum:
 *
 *   > entre dois pontos consecutivos, a curva fica dentro do intervalo entre eles.
 *
 * Ela cai sozinha no dia em que alguém trocar Fritsch–Carlson por Catmull-Rom
 * "porque fica mais bonito", sem ninguém ter previsto o valor novo.
 *
 * ## O caso que a faz DISPARAR
 *
 * `[0, 0, 4200, 0]` — faturamento parado, um dia bom, e parado de novo. Com
 * tangente por diferença central a curva desce a ~-500 depois do pico: um
 * prejuízo desenhado onde o dado diz zero. A asserção `overshoot` reprova nessa
 * série, e ela está aqui nomeada para não virar guarda que nunca disparou.
 *
 * Puro: sem banco, sem rede, sem DOM.
 *
 *   npm run test:curva
 */
import assert from "node:assert/strict";

const { caminhoSuave, fecharArea } = await import("../src/lib/grafico/curva.ts");

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

/** Lê o caminho de volta como lista de cúbicas. Se o formato mudar, cai aqui. */
function segmentos(d) {
  const nums = (s) => s.trim().split(/[\s,]+/).map(Number);
  const m = d.match(/^M([-\d.,]+)/);
  assert.ok(m, `caminho sem M inicial: ${d}`);
  let atual = nums(m[1]);
  const out = [];
  for (const c of d.matchAll(/C([-\d.,\s]+?)(?=[MLCZ]|$)/g)) {
    const v = nums(c[1]);
    assert.equal(v.length, 6, `C com ${v.length} números`);
    out.push({ p0: atual, c1: [v[0], v[1]], c2: [v[2], v[3]], p1: [v[4], v[5]] });
    atual = [v[4], v[5]];
  }
  return out;
}

const bezierY = (s, t) => {
  const u = 1 - t;
  return u * u * u * s.p0[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t * t * t * s.p1[1];
};

/** Maior distância em que a curva sai do intervalo [min,max] do próprio trecho. */
function overshoot(serie) {
  const pts = serie.map((y, i) => [i * 10, y]);
  const d = caminhoSuave(pts);
  let pior = 0;
  for (const s of segmentos(d)) {
    const lo = Math.min(s.p0[1], s.p1[1]);
    const hi = Math.max(s.p0[1], s.p1[1]);
    for (let k = 0; k <= 40; k++) {
      const y = bezierY(s, k / 40);
      pior = Math.max(pior, lo - y, y - hi);
    }
  }
  return pior;
}

console.log("\n\x1b[1mcaminhoSuave — a curva não inventa valor entre os pontos\x1b[0m\n");

/* ── A propriedade, na série que faz a ingênua falhar ─────────────────────── */

checar("pico isolado ([0,0,4200,0]) não desce abaixo do menor vizinho", () => {
  // Com Catmull-Rom este número passa de 400. É o caso que nomeia o teste.
  assert.ok(overshoot([0, 0, 4200, 0]) < 0.01, `ultrapassou em ${overshoot([0, 0, 4200, 0])}`);
});

checar("vale isolado ([900,900,0,900]) não sobe acima do maior vizinho", () => {
  assert.ok(overshoot([900, 900, 0, 900]) < 0.01);
});

checar("série real com ruído nunca sai do intervalo do trecho", () => {
  assert.ok(overshoot([120, 340, 90, 780, 410, 1200, 60, 950, 300]) < 0.01);
});

checar("série monótona crescente permanece monótona", () => {
  const d = caminhoSuave([0, 1, 2, 3, 4, 5].map((i) => [i * 10, i * i]));
  let ant = -Infinity;
  for (const s of segmentos(d)) {
    for (let k = 0; k <= 20; k++) {
      const y = bezierY(s, k / 20);
      assert.ok(y >= ant - 1e-9, `desceu: ${y} depois de ${ant}`);
      ant = y;
    }
  }
});

checar("série achatada produz curva achatada (sem ondulação)", () => {
  for (const s of segmentos(caminhoSuave([0, 1, 2, 3].map((i) => [i * 10, 50])))) {
    for (let k = 0; k <= 20; k++) assert.ok(Math.abs(bezierY(s, k / 20) - 50) < 1e-9);
  }
});

/* ── A curva PASSA pelos pontos. Suavizar não é aproximar ─────────────────── */

checar("todo ponto de entrada é extremidade de uma cúbica", () => {
  const serie = [10, 90, 40, 70, 20];
  const segs = segmentos(caminhoSuave(serie.map((y, i) => [i * 10, y])));
  assert.equal(segs.length, serie.length - 1);
  segs.forEach((s, i) => {
    assert.ok(Math.abs(s.p0[1] - serie[i]) < 0.01, `inicio do trecho ${i}`);
    assert.ok(Math.abs(s.p1[1] - serie[i + 1]) < 0.01, `fim do trecho ${i}`);
  });
});

/* ── Degenerados: o desenho correto para "não há o que desenhar" ──────────── */

checar("lista vazia devolve string vazia (path que não desenha nada)", () => {
  assert.equal(caminhoSuave([]), "");
});

checar("um ponto devolve só o M — sem C inventada", () => {
  const d = caminhoSuave([[5, 7]]);
  assert.equal(d, "M5.00,7.00");
  assert.ok(!d.includes("C"));
});

checar("dois pontos viram segmento reto, não cúbica", () => {
  const d = caminhoSuave([[0, 0], [10, 10]]);
  assert.ok(d.includes("L"), d);
  assert.ok(!d.includes("C"), d);
});

checar("x repetido não produz Infinity nem NaN no caminho", () => {
  // dx = 0 já degenerou um <path> nesta base (o sparkline do ROAS virou um
  // retângulo cheio). Aqui a guarda devolve inclinação zero.
  const d = caminhoSuave([[0, 10], [0, 50], [10, 20], [20, 80]]);
  assert.ok(!/NaN|Infinity/.test(d), d);
});

/* ── fecharArea reusa o caminho da linha, não recalcula ───────────────────── */

checar("fecharArea preserva o caminho da linha intacto como prefixo", () => {
  const linha = caminhoSuave([[0, 10], [10, 40], [20, 20]]);
  const area = fecharArea(linha, 0, 20, 100);
  assert.ok(area.startsWith(linha), "a área divergiu da linha");
  assert.ok(area.endsWith("Z"));
});

checar("fecharArea sobre caminho vazio não inventa um retângulo", () => {
  // Sem isto, série ausente viraria um bloco chapado do tamanho do gráfico —
  // o defeito exato que o Sparkline do ROAS teve.
  assert.equal(fecharArea("", 0, 100, 50), "");
});

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}\n`
    : `\n\x1b[32m${ok} asserções, todas passando\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
