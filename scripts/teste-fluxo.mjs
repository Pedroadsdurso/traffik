/**
 * A MASSA SE CONSERVA no funil de fluxo com perdas.
 *
 * ## A propriedade, e por que ela é a asserção certa
 *
 * O desenho promete UMA coisa: quem sai não desaparece, vira faixa. Em qualquer
 * ponto da esquerda para a direita,
 *
 *     fluxo que continua  +  todas as perdas até ali  =  a faixa inteira
 *
 * Um teste de COORDENADA passaria igual com uma faixa de perda desenhada com a
 * espessura errada — os números seriam outros, mas o teste só saberia se alguém
 * tivesse previsto os novos. A soma não: ela cai sozinha no dia em que uma
 * perda for calculada por outra conta que a do fluxo, sem ninguém prever nada.
 *
 * É a mesma escolha do break-even ("faturar o break-even dá lucro zero") e da
 * curva ("não ultrapassa o intervalo do trecho").
 *
 * Puro: sem banco, sem DOM.
 *
 *   npm run test:fluxo
 */
import assert from "node:assert/strict";

const { calcularFluxo, caminhoPerda, caminhoFluxo, PISO_ESPESSURA } = await import(
  "../src/lib/funil/fita.ts"
);

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

const OPC = { largura: 600, faixa: 130, margem: 12 };
const somaPerdas = (f) => f.perdas.reduce((s, p) => s + (p.base - p.topo), 0);
const fluxoFinal = (f) => f.etapas[f.etapas.length - 1].espessura;

console.log("\n\x1b[1mFunil de fluxo — a massa se conserva\x1b[0m\n");

/* ── A propriedade ─────────────────────────────────────────────────────────── */

checar("funil real do dono (1220 → 35 → 27): fluxo + perdas = faixa", () => {
  const f = calcularFluxo([1220, 35, 27], OPC);
  assert.ok(
    Math.abs(fluxoFinal(f) + somaPerdas(f) - OPC.faixa) < 0.01,
    `fluxo ${fluxoFinal(f)} + perdas ${somaPerdas(f)} ≠ ${OPC.faixa}`,
  );
});

checar("conserva em 200 funis aleatórios, inclusive com etapas minúsculas", () => {
  let semente = 7;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let t = 0; t < 200; t++) {
    const n = 2 + Math.floor(rnd() * 4);
    const vals = [Math.ceil(rnd() * 5000)];
    for (let i = 1; i < n; i++) vals.push(Math.floor(vals[i - 1] * rnd()));
    const f = calcularFluxo(vals, OPC);
    const total = fluxoFinal(f) + somaPerdas(f);
    assert.ok(
      Math.abs(total - OPC.faixa) < 0.01 || vals[0] === 0,
      `[${vals}] somou ${total.toFixed(2)}, esperado ${OPC.faixa}`,
    );
  }
});

/* ── O piso, e a razão de ele ser DESCONTADO em vez de somado ──────────────── */

checar("perda minúscula recebe o piso — e não some", () => {
  // 1000 → 999 → 1: a perda de 1 vale 0,13px na faixa de 130.
  const f = calcularFluxo([1000, 999, 1], OPC);
  const primeira = f.perdas.find((p) => p.de === 0);
  assert.ok(primeira, "a perda de 1 deveria existir");
  assert.ok(
    primeira.base - primeira.topo >= PISO_ESPESSURA - 0.01,
    `veio ${(primeira.base - primeira.topo).toFixed(2)}px, piso é ${PISO_ESPESSURA}`,
  );
});

checar("o piso NÃO estoura a faixa — ele afina o FLUXO, não engrossa a perda", () => {
  // Engrossar a perda direto somaria altura por cima do total. O piso mexe na
  // sequência que gera as faixas, então não há o que compensar.
  const f = calcularFluxo([1000, 999, 1], OPC);
  const total = fluxoFinal(f) + somaPerdas(f);
  assert.ok(Math.abs(total - OPC.faixa) < 0.01, `estourou: ${total.toFixed(2)} > ${OPC.faixa}`);
});

/* ── As faixas se ENCAIXAM, sem sobrepor nem deixar vão ────────────────────── */

checar("as perdas não se sobrepõem entre si nem invadem o fluxo", () => {
  const f = calcularFluxo([1220, 400, 120, 27], OPC);
  const espFinal = fluxoFinal(f);
  const cimaFinal = (OPC.faixa - espFinal) / 2; // o fluxo é CENTRADO
  const faixas = [{ topo: cimaFinal, base: cimaFinal + espFinal }, ...f.perdas.map((p) => ({ topo: p.topo, base: p.base }))]
    .sort((a, b) => a.topo - b.topo);
  for (let i = 1; i < faixas.length; i++) {
    assert.ok(
      faixas[i].topo >= faixas[i - 1].base - 0.01,
      `faixa ${i} começa em ${faixas[i].topo} e a anterior termina em ${faixas[i - 1].base}`,
    );
  }
});

/* ── Casos que não são perda ───────────────────────────────────────────────── */

checar("etapa que CRESCE não vira perda negativa", () => {
  // Cliques vêm da Meta e checkouts do pixel: as duas fontes não se conversam.
  const f = calcularFluxo([100, 140, 20], OPC);
  assert.ok(f.perdas.every((p) => p.valor > 0), "apareceu perda de valor não-positivo");
  /* ⚠️ Conta EVENTOS, não faixas: desde o fluxo centrado cada perda vira duas
     metades. Comparar `perdas.length` com 1 mediria a geometria, não a regra. */
  const eventos = new Set(f.perdas.map((p) => p.de));
  assert.equal(eventos.size, 1, "só o passo 140→20 é perda");
  assert.deepEqual([...eventos], [1]);
});

checar("funil sem perda nenhuma (nada cai) não inventa faixa", () => {
  const f = calcularFluxo([50, 50, 50], OPC);
  assert.equal(f.perdas.length, 0);
  assert.ok(Math.abs(fluxoFinal(f) - OPC.faixa) < 0.01, "o fluxo deveria ocupar a faixa toda");
});

checar("tudo zero não produz NaN em coordenada nenhuma", () => {
  const f = calcularFluxo([0, 0], OPC);
  const d = caminhoFluxo(f.etapas, 10, OPC.faixa) + f.perdas.map((p) => caminhoPerda(p, 10, 600)).join(" ");
  assert.ok(!/NaN|Infinity/.test(d), d);
});

/* ── O caminho desenhado ───────────────────────────────────────────────────── */

checar("a faixa de perda nasce com espessura ZERO na guia de onde sai", () => {
  // Se ela nascesse já cheia, pareceria que a perda aconteceu ANTES da etapa.
  const f = calcularFluxo([1220, 35, 27], OPC);
  for (const p of f.perdas.filter((q) => q.de === 0)) {
    const d = caminhoPerda(p, 10, 600);
    const inicio = d.match(/^M([\d.]+),([\d.]+)/);
    assert.ok(inicio, d);
    assert.ok(Math.abs(+inicio[1] - p.x0) < 0.01, "não começa na guia de origem");
    assert.ok(
      Math.abs(+inicio[2] - (10 + p.ancora)) < 0.01,
      `a metade de ${p.lado} não nasce colada na borda do fluxo`,
    );
  }
});

/* ── O VETOR DE LEITURA, EM COORDENADA DE TELA ─────────────────────────────────

   🔴 ESTAS ASSERÇÕES SÃO ESCRITAS EM PIXEL DE TELA, NÃO EM `y` DE SVG, e a
   distinção não é preciosismo — foi exatamente aí que a versão anterior mentiu.

   Existiu aqui um teste chamado "a linha de colapso DESCE — nunca sobe". Ele
   passava, e afirmava `y` DECRESCENTE. Em SVG o eixo `y` aponta para BAIXO,
   então `y` decrescente é a linha SUBINDO na tela. Medido na página, ela ia de
   y=160 a y=17: subia. O teste verde carimbava como "desce" a única marca que
   subia, no gráfico cuja reclamação era "lê como crescimento".

   ⛔ A REGRA: asserção sobre direção VISUAL vai em coordenada de tela. Se o
   formato inverte um eixo, a asserção CONVERTE antes de comparar, e o nome do
   teste diz "na tela". Um verbo ambíguo ("desce") lê como tela e mede
   coordenada — e as duas são opostas.

   `naTela` é a conversão, e existe para que nenhuma asserção abaixo compare
   `y` cru: quanto maior o número, mais ALTO na tela. */

const naTela = (ySvg) => OPC.faixa - ySvg;
const bordaCima = (f, i) => (OPC.faixa - f.etapas[i].espessura) / 2;
const bordaBaixo = (f, i) => bordaCima(f, i) + f.etapas[i].espessura;

checar("NA TELA: a borda de cima do fluxo DESCE da esquerda para a direita", () => {
  const f = calcularFluxo([1220, 35, 27], OPC);
  const alturas = f.etapas.map((_, i) => naTela(bordaCima(f, i)));
  for (let i = 1; i < alturas.length; i++) {
    assert.ok(
      alturas[i] <= alturas[i - 1] + 0.01,
      `a borda de cima subiu entre a guia ${i - 1} e a ${i}: ${alturas.map((a) => a.toFixed(1))}`,
    );
  }
  assert.ok(alturas[0] - alturas[alturas.length - 1] > 10, "a borda de cima mal se moveu");
});

checar("NA TELA: a borda de baixo do fluxo SOBE da esquerda para a direita", () => {
  const f = calcularFluxo([1220, 35, 27], OPC);
  const alturas = f.etapas.map((_, i) => naTela(bordaBaixo(f, i)));
  for (let i = 1; i < alturas.length; i++) {
    assert.ok(
      alturas[i] >= alturas[i - 1] - 0.01,
      `a borda de baixo desceu entre a guia ${i - 1} e a ${i}: ${alturas.map((a) => a.toFixed(1))}`,
    );
  }
  assert.ok(alturas[alturas.length - 1] - alturas[0] > 10, "a borda de baixo mal se moveu");
});

checar("NA TELA: a figura CONVERGE — nenhuma borda escorrega para um lado só", () => {
  /* A propriedade que o centro compra, e a que o topo NÃO podia cumprir: as
     duas bordas caminham uma na direção da outra, em módulo igual. Ancorado no
     topo, a de cima ficava parada e só a de baixo subia — a assinatura de
     "crescimento" que o dono leu. */
  const f = calcularFluxo([1220, 35, 27], OPC);
  for (let i = 1; i < f.etapas.length; i++) {
    const desceu = naTela(bordaCima(f, i - 1)) - naTela(bordaCima(f, i));
    const subiu = naTela(bordaBaixo(f, i)) - naTela(bordaBaixo(f, i - 1));
    assert.ok(desceu >= -0.01 && subiu >= -0.01, `a guia ${i} não convergiu`);
    assert.ok(
      Math.abs(desceu - subiu) < 0.01,
      `convergência assimétrica na guia ${i}: cima ${desceu.toFixed(2)} vs baixo ${subiu.toFixed(2)}`,
    );
  }
});

checar("NA TELA: toda perda sai PELOS DOIS LADOS, com metade da espessura cada", () => {
  const f = calcularFluxo([1220, 35, 27], OPC);
  const eventos = [...new Set(f.perdas.map((p) => p.de))];
  for (const de of eventos) {
    const metades = f.perdas.filter((p) => p.de === de);
    assert.equal(metades.length, 2, `o evento ${de} não virou duas metades`);
    const lados = metades.map((m) => m.lado).sort();
    assert.deepEqual(lados, ["baixo", "cima"]);
    const [a, b] = metades.map((m) => m.base - m.topo);
    assert.ok(Math.abs(a - b) < 0.01, `as metades do evento ${de} têm espessuras diferentes: ${a} e ${b}`);
  }
});

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}\n`
    : `\n\x1b[32m${ok} asserções, todas passando\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
