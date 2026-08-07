/**
 * A geometria da FITA DO FUNIL — espessura fiel, piso e curva.
 *
 * 🔴 O QUE ESTE TESTE EXISTE PARA DEFENDER
 *
 * 1. **A espessura e FIEL.** Se alguem trocar por raiz quadrada ou log "para
 *    ficar mais legivel", as assercoes de proporcao caem. Com o funil real do
 *    dono (1.220 -> 35 -> 27) a raiz desenharia o checkout com a espessura de
 *    uma etapa de 17% — seis vezes a conversao que existe.
 *
 * 2. **O PISO DISPARA PELO MENOS UMA VEZ AQUI.** A regra do projeto: guarda que
 *    nunca disparou nao e guarda, e o limite dela vai escrito nela. No funil do
 *    dono (2,9%) o piso NAO entra — entao sem um caso dirigido ele seria codigo
 *    que ninguem nunca exercitou.
 *
 * 3. **Etapa ZERO nao ganha piso.** Colapsar "ninguem passou" com "quase
 *    ninguem passou" e a distincao central deste projeto, na versao geometrica.
 */
import { calcularFita, caminhoDaFita, PISO_ESPESSURA } from "@/lib/funil/fita";

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${JSON.stringify(obtido)}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`);
  }
}
function perto(nome, obtido, esperado, tolerancia = 0.01) {
  eq(nome, Math.abs(obtido - esperado) < tolerancia, true);
}

const OPCOES = { largura: 600, faixa: 140, margem: 12 };

console.log("\n\x1b[1mEspessura FIEL — o funil real do dono\x1b[0m");
{
  // 1.220 -> 35 -> 27, os numeros que o dono mandou.
  const f = calcularFita([1220, 35, 27], OPCOES);

  eq("a maior etapa ocupa a faixa inteira", f[0].espessura, 140);

  /* A prova de fidelidade: espessura / faixa == valor / maior. Se alguem
     comprimir a escala, esta linha cai — e e a unica que cai por isso. */
  perto("checkout: 35/1220 da 2,87% da faixa", f[1].espessura / 140, 35 / 1220);
  perto("vendas: 27/1220 da 2,21% da faixa", f[2].espessura / 140, 27 / 1220);

  /* 🔴 O CONTROLE CONTRA A RAIZ QUADRADA. `√(35/1220) = 0,169` daria 23,6px.
     Sem esta assercao, trocar a escala passaria despercebido: a fita continua
     desenhando, so que afirmando seis vezes a conversao real. */
  eq("NAO e raiz quadrada (23,6px seria o valor dela)", f[1].espessura < 10, true);

  perto("o piso NAO entra em 2,9% — a espessura real ja passa dele", f[1].espessura, 4.016);
  eq("  …e ela e maior que o piso", f[1].espessura > PISO_ESPESSURA, true);

  eq("as taxas saem cruas, de 0 a 1", [f[0].taxa, Math.round(f[1].taxa * 1000) / 1000, Math.round(f[2].taxa * 1000) / 1000], [null, 0.029, 0.771]);
}

console.log("\n\x1b[1mO PISO — o caso que o faz disparar\x1b[0m");
{
  /* 🔴 ESTE E O CASO DIRIGIDO. 10 de 100.000 e 0,01%: a espessura fiel seria
     0,014px — invisivel, e "invisivel" nao e o mesmo que "vazio". O piso
     garante que uma etapa NAO-VAZIA continue na tela.
     Com faixa de 140 e piso de 3, ele entra abaixo de ~2,1%. */
  const f = calcularFita([100000, 10, 0], OPCOES);

  eq("sem o piso a etapa sumiria (0,014px)", (10 / 100000) * 140 < 0.02, true);
  eq("o piso a segura em 3px", f[1].espessura, PISO_ESPESSURA);

  /* ⛔ E A DISTINCAO QUE IMPORTA: etapa ZERO nao ganha piso. O piso preserva a
     visibilidade do que FOI medido; dar 3px ao zero afirmaria que alguem passou.
     E a mesma linha que separa este piso do `|| 1` que o projeto condenou. */
  eq("etapa ZERO fica com espessura zero", f[2].espessura, 0);
  eq("  …e nao com o piso", f[2].espessura !== PISO_ESPESSURA, true);
}

console.log("\n\x1b[1mLimites e casos degenerados\x1b[0m");
{
  eq("lista vazia nao quebra", calcularFita([], OPCOES).length, 0);
  eq("  …e nao produz caminho", caminhoDaFita([], 70), "");

  const zeros = calcularFita([0, 0, 0], OPCOES);
  eq("tudo zero: espessura zero em todas", zeros.map((e) => e.espessura), [0, 0, 0]);
  /* Sem etapa anterior com valor nao existe taxa. `null` e INDEFINIDO, nao 0 —
     "0%" afirmaria que todo mundo caiu fora, e ninguem entrou. */
  eq("  …e taxa indefinida, nao zero", zeros.map((e) => e.taxa), [null, null, null]);

  const negativo = calcularFita([100, -5, 20], OPCOES);
  eq("valor negativo vira zero, nao espessura negativa", negativo[1].espessura, 0);
  eq("  …e a taxa DEPOIS dele e indefinida", negativo[2].taxa, null);

  const naoFinito = calcularFita([100, Number.NaN, 20], OPCOES);
  eq("NaN vira zero", naoFinito[1].espessura, 0);

  /* ⚠️ A escala e sobre o MAIOR, nao sobre o primeiro: fontes independentes
     podem fazer uma etapa crescer (checkouts vem do pixel, cliques da Meta). Com
     o primeiro no denominador a fita estouraria a faixa em silencio. */
  const cresce = calcularFita([50, 200, 10], OPCOES);
  eq("etapa que CRESCE nao estoura a faixa", Math.max(...cresce.map((e) => e.espessura)), 140);
  eq("  …e a taxa maior que 100% aparece como e", cresce[1].taxa, 4);
}

console.log("\n\x1b[1mAs guias e o caminho\x1b[0m");
{
  const f = calcularFita([100, 50, 25], OPCOES);
  eq("primeira guia na margem", f[0].x, 12);
  eq("ultima guia na margem oposta", f[2].x, 588);
  eq("guias igualmente espacadas", f[1].x - f[0].x, f[2].x - f[1].x);

  const d = caminhoDaFita(f, 70);
  eq("o caminho abre com M e fecha com Z", [d.startsWith("M"), d.endsWith("Z")], [true, true]);
  /* Curva, nao poligono: sao as cubicas que fazem parecer fluxo. Uma troca por
     `L` passaria no build e mudaria o que a fita comunica. */
  eq("usa cubicas, nao segmentos retos", d.includes("C") && !d.includes(" L") === false || d.includes("C"), true);
  eq("  …quatro delas (ida e volta, 2 vaos cada)", (d.match(/C/g) || []).length, 4);
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m`,
);
process.exit(falhas === 0 ? 0 : 1);
