/**
 * §7.2 — A DISTINÇÃO ENTRE-CONTEÚDOS (A) × ATÉ-A-BORDA (B), sob asserção.
 *
 * 🔴 POR QUE ESTE ARQUIVO EXISTE, se o cabeçalho do `vazio-na-tela.js` diz que
 * a §7.2 não vira asserção do agregado
 *
 * Aquela frase vale para a parte de LAYOUT — `getBoundingClientRect`, tinta de
 * SVG, retângulo interno do card. Nada disso existe em jsdom, e um verde ali
 * seria a "asserção que não pode falhar".
 *
 * ⛔ Mas a CLASSIFICAÇÃO não é layout: `__vaosVerticais` recebe uma lista de
 * bandas já medidas e decide `topo` / `meio` / `fim`. Isso é aritmética de
 * intervalos, é pura, e é exatamente onde a distinção A × B vive. Deixá-la fora
 * do agregado só porque o arquivo vizinho é de navegador seria confundir o
 * arquivo com a pergunta.
 *
 * O que ESTE arquivo NÃO cobre, e está escrito para ninguém ler verde demais:
 * se as bandas de entrada estão certas. Isso continua sendo o procedimento de
 * navegador.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const FONTE = readFileSync(join(AQUI, "vazio-na-tela.js"), "utf8").replace(/\r\n/g, "\n");

/* ---------------------------------------------------------------------------
 * Carrega o instrumento REAL, não uma cópia. Uma reimplementação aqui seria a
 * segunda fonte de verdade que esta base já pagou várias vezes: ela passaria
 * mesmo depois de o arquivo de produção divergir.
 * ------------------------------------------------------------------------ */
const janela = {};
new Function("window", FONTE)(janela);

assert.equal(typeof janela.__vaosVerticais, "function", "linha de base: o instrumento nao carregou");

/* A origem A e a origem B, exatamente como o `vazioAgora` as deriva. */
const A = (vaos) => vaos.filter((v) => v.onde === "meio");
const B = (vaos) => vaos;

const medir = (bandas, topo, base, limiar = 32) =>
  janela.__vaosVerticais(bandas, topo, base, limiar).vaos;

let n = 0;
const ok = (nome, cond) => {
  assert.ok(cond, nome);
  console.log("  ✓ " + nome);
  n++;
};
const eq = (nome, a, b) => {
  assert.deepEqual(a, b, nome + " — obtido " + JSON.stringify(a));
  console.log("  ✓ " + nome + " — " + JSON.stringify(a));
  n++;
};

console.log("\nCARD 0..400, limiar 32");

/* ---- 1. Vão no MEIO: as duas origens veem ---- */
{
  const vaos = medir([[0, 100], [300, 400]], 0, 400);
  eq("meio: A ve 1", A(vaos).map((v) => v.px), [200]);
  eq("meio: B ve 1", B(vaos).map((v) => v.px), [200]);
  ok("meio: A e B concordam", A(vaos).length === B(vaos).length);
}

/* ---- 2. Vão no FIM: SÓ a origem B ve. É o C6. ---- */
{
  const vaos = medir([[0, 100]], 0, 400);
  eq("fim: A ve 0 (nao ha par ao redor)", A(vaos).map((v) => v.px), []);
  eq("fim: B ve 1, de 300px", B(vaos).map((v) => [v.onde, v.px]), [["fim", 300]]);
}

/* ---- 3. Vão no TOPO: SÓ a origem B ve ---- */
{
  const vaos = medir([[300, 400]], 0, 400);
  eq("topo: A ve 0", A(vaos).map((v) => v.px), []);
  eq("topo: B ve 1, de 300px", B(vaos).map((v) => [v.onde, v.px]), [["topo", 300]]);
}

/* ---- 4. A INVARIANTE que o instrumento afirma: B superconjunto de A ---- */
{
  /* Fuzz com semente FIXA — aleatorio de verdade da teste que falha uma vez por
     semana e ninguem reproduz. */
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let casos = 0;
  let viuA = 0;
  let viuSoB = 0;
  for (let t = 0; t < 300; t++) {
    const bandas = [];
    let cur = Math.floor(rnd() * 120);
    const k = 1 + Math.floor(rnd() * 4);
    for (let i = 0; i < k; i++) {
      const ini = cur + Math.floor(rnd() * 90);
      const fim = ini + 5 + Math.floor(rnd() * 60);
      bandas.push([ini, fim]);
      cur = fim;
    }
    const vaos = medir(bandas, 0, 600);
    const a = A(vaos);
    const b = B(vaos);
    assert.ok(a.length <= b.length, "B deve conter A — bandas " + JSON.stringify(bandas));
    assert.ok(a.every((v) => b.includes(v)), "todo vao de A esta em B — " + JSON.stringify(bandas));
    if (a.length) viuA++;
    if (b.length > a.length) viuSoB++;
    casos++;
  }
  ok("fuzz(300, semente 7): B contem A em todos", casos === 300);
  /* ⛔ LINHA DE BASE. Sem estas duas, o fuzz passaria com 300 funis sem vao
     nenhum — que e a colecao vazia satisfazendo tudo. */
  ok("linha de base: o fuzz produziu caso com vao de A (" + viuA + ")", viuA > 0);
  ok("linha de base: o fuzz produziu caso SO de B (" + viuSoB + ")", viuSoB > 0);
}

/* ---- 5. O limiar e por VAO, nao pela soma ---- */
{
  const vaos = medir([[0, 50], [80, 130], [160, 400]], 0, 400);
  eq("dois vaos de 30 nao reprovam (limiar 32)", B(vaos).map((v) => v.px), []);
}

/* ---- 6. Card sem tinta nenhuma: B acusa 'vazio inteiro', A nao acusa nada ---- */
{
  const vaos = medir([], 0, 400);
  eq("sem tinta: B diz vazio inteiro", B(vaos).map((v) => [v.onde, v.px]), [["vazio inteiro", 400]]);
  eq("sem tinta: A ve 0", A(vaos).map((v) => v.px), []);
}

/* ---------------------------------------------------------------------------
 * 7. A PROVA PELO LADO NEGATIVO — a asserção só conta se derrubar com o defeito
 *    plantado.
 *
 * PLANTIO: trocar a classificacao de `fim` para `meio` na FONTE, que e
 * literalmente o erro que colapsaria as duas origens numa so. Se as assercoes
 * acima ainda passassem com isso, elas nao mediriam a distincao.
 * ------------------------------------------------------------------------ */
{
  const alvo = 'vaos.push({ onde: unido.length ? "fim" : "vazio inteiro", px: Math.round(base - cursor) });';
  assert.equal(
    FONTE.split(alvo).length - 1,
    1,
    "linha de base do plantio: a linha alvo nao existe (ou existe mais de uma vez) na FONTE",
  );
  const adulterada = FONTE.replace(
    alvo,
    'vaos.push({ onde: unido.length ? "meio" : "vazio inteiro", px: Math.round(base - cursor) });',
  );
  assert.notEqual(adulterada, FONTE, "o plantio nao pegou");

  const j2 = {};
  new Function("window", adulterada)(j2);
  const vaosRuins = j2.__vaosVerticais([[0, 100]], 0, 400, 32).vaos;

  /* Com o defeito plantado, a origem A passa a enxergar o buraco do FIM —
     ou seja, A e B ficam indistinguiveis, que e o estado que a §7.2 nao pode ter. */
  ok("PLANTIO: com `fim`->`meio`, A passa a ver o buraco de borda", A(vaosRuins).length === 1);
  ok("PLANTIO: e A e B ficam iguais (a distincao morreu)", A(vaosRuins).length === B(vaosRuins).length);

  /* E a asserção 2 deste arquivo cairia — provado rodando-a contra a adulterada. */
  let caiu = false;
  try {
    assert.deepEqual(A(vaosRuins).map((v) => v.px), []);
  } catch {
    caiu = true;
  }
  ok("PLANTIO: a assercao 'fim: A ve 0' DERRUBA com o defeito", caiu);
}

console.log("\n[32m" + n + " asserções, 0 falha(s).[0m\n");
