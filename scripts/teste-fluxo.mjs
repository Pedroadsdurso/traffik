/**
 * O FUNIL COMO FITA — geometria e números das pílulas.
 *
 * Referência: `docs/design/referencias/16-funil-referencia.png`.
 *
 * ## O que mudou, e por que a asserção antiga saiu
 *
 * Este arquivo verificava CONSERVAÇÃO DE MASSA — "fluxo que continua + todas as
 * perdas = a faixa". Era a asserção certa enquanto a perda era uma faixa cinza
 * desenhada colada no fluxo. **A perda deixou de ser desenhada**: ela é número
 * na pílula, e não há massa para conservar.
 *
 * O que sobra para verificar é de outra natureza:
 *
 *  - a ARITMÉTICA das pílulas (fração do máximo, perda e percentual);
 *  - o VETOR DE LEITURA, em coordenada de tela;
 *  - o piso, que agora responde pela legibilidade da fita inteira.
 *
 * ## `teste-fita.mjs` foi DELETADO e absorvido aqui
 *
 * Ele verificava o contrato ANTIGO — espessura fiel sem piso, guias nas margens,
 * "NAO e raiz quadrada" — e esses três deixaram de ser verdade por DECISÃO, não
 * por bug. Um teste que afirma o contrato revogado não se conserta: ele
 * contradiz a decisão, e mantê-lo verde exigiria desfazê-la.
 *
 * ⚠️ E ele não estava no `npm test`: só em `npm run test:fita`, que ninguém
 * roda. Passou nove asserções quebradas sem a suíte acusar. **Script de teste
 * fora do agregado é teste que não existe** — se criar um, agende no mesmo
 * commit, que é a mesma regra da rota de cron.
 *
 * Puro: sem banco, sem DOM.
 *
 *   npm run test:fluxo
 */
import assert from "node:assert/strict";

const { calcularFluxo, caminhoDaFita, PISO_ESPESSURA } = await import("../src/lib/funil/fita.ts");

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

console.log("\n\x1b[1mFunil — a fita, e a perda como número\x1b[0m\n");

/* ── A aritmética das pílulas ──────────────────────────────────────────────────
   Os valores vêm da REFERÊNCIA, e é de propósito: se a nossa conta divergir da
   dela, a figura deixa de ser a mesma figura. Foram conferidos à mão no print
   antes de virarem asserção. */

const REFERENCIA = [444, 861, 165, 64, 12];

checar("a pílula da etapa é a fração do MAIOR, não a conversão da anterior", () => {
  const f = calcularFluxo(REFERENCIA, OPC);
  const vistos = f.etapas.map((e) => (e.fracao * 100).toFixed(1));
  assert.deepEqual(vistos, ["51.6", "100.0", "19.2", "7.4", "1.4"]);
});

checar("as duas leituras DIVERGEM quando uma etapa cresce — e é por isso que importa", () => {
  /* Se `fracao` fosse a conversão da anterior, a primeira daria `null` e a
     segunda passaria de 100%. A asserção só mede alguma coisa porque as duas
     contas são de fato diferentes: com um funil que só cai, elas coincidiriam e
     ela passaria por coincidência. */
  const f = calcularFluxo(REFERENCIA, OPC);
  assert.equal(f.etapas[0].taxa, null, "a primeira não tem de onde cair");
  assert.ok(f.etapas[1].taxa > 1, "a segunda CRESCE: a conversão passa de 100%");
  assert.equal((f.etapas[0].fracao * 100).toFixed(1), "51.6", "mas a fração do máximo é 51,6%");
});

checar("a pílula de perda traz o absoluto e o percentual DA ORIGEM", () => {
  const f = calcularFluxo(REFERENCIA, OPC);
  const vistos = f.perdas.map((p) => `${p.de}:−${p.valor}·${(p.pct * 100).toFixed(1)}`);
  assert.deepEqual(vistos, ["1:−696·80.8", "2:−101·61.2", "3:−52·81.3"]);
});

checar("etapa que CRESCE não gera pílula de perda", () => {
  // Na referência, Cliques (444) → Vis. Página (861) não tem pílula nenhuma.
  const f = calcularFluxo(REFERENCIA, OPC);
  assert.ok(!f.perdas.some((p) => p.de === 0), "o passo que cresce virou perda");
  assert.equal(f.perdas.length, 3, "são três transições de queda em cinco etapas");
});

checar("o funil do dono (1220 → 35 → 25) bate com o que o dono escreveu", () => {
  const f = calcularFluxo([1220, 35, 25], OPC);
  const primeira = f.perdas.find((p) => p.de === 0);
  assert.equal(primeira.valor, 1185);
  assert.equal((primeira.pct * 100).toFixed(1), "97.1"); // "−1.185 · 97,1%"
});

checar("fração ZERO e fração INDEFINIDA não são a mesma coisa", () => {
  /* 🔴 A distinção central do projeto, e esta asserção nasceu de eu errá-la:
     escrevi `[0, 0, 5]` esperando `null` e recebi `0`. O `0` estava CERTO —
     existe um máximo (5), e `0/5` é uma medição de verdade. Indefinido é só
     quando não há denominador nenhum, ou seja quando o funil inteiro é zero.

     Se as duas colapsassem, um funil sem tráfego mostraria "0,0%" — que se lê
     como "ninguém converteu" onde a verdade é "não houve o que medir". */
  const comMaximo = calcularFluxo([0, 0, 5], OPC);
  assert.equal(comMaximo.etapas[0].fracao, 0, "há máximo: 0/5 é medição, e vale 0");

  const semNada = calcularFluxo([0, 0], OPC);
  assert.equal(semNada.etapas[0].fracao, null, "sem máximo, a fração é INDEFINIDA");
});

checar("perda cuja ORIGEM é zero não vira percentual", () => {
  // Não existe "0 de 0 se perderam". Se houver perda ali, o pct é indefinido.
  const f = calcularFluxo([5, 0, 0], OPC);
  for (const p of f.perdas) {
    const origem = f.etapas[p.de].valor;
    if (origem === 0) assert.equal(p.pct, null, "dividiu por uma origem zerada");
  }
});

/* ── O piso ────────────────────────────────────────────────────────────────── */

checar("etapa não-vazia nunca fica abaixo do piso, por menor que seja", () => {
  const f = calcularFluxo([100000, 1], OPC);
  assert.equal(f.etapas[1].espessura, PISO_ESPESSURA);
  assert.ok(PISO_ESPESSURA >= 10, "o piso caiu abaixo de 10px — a fita volta a virar fio");
});

checar("etapa VAZIA tem espessura zero — o piso não inventa presença", () => {
  /* A distinção central do projeto, na camada do desenho: 1 é pouco, 0 é nada.
     Um piso que pintasse o zero afirmaria uma etapa que não aconteceu. */
  const f = calcularFluxo([100, 0, 5], OPC);
  assert.equal(f.etapas[1].espessura, 0);
  assert.equal(f.etapas[2].espessura, PISO_ESPESSURA);
});

checar("a espessura preserva a ORDEM dos valores", () => {
  // O piso comprime, mas nunca inverte: maior valor, espessura maior ou igual.
  const f = calcularFluxo([1220, 900, 35, 30, 25], OPC);
  for (let i = 1; i < f.etapas.length; i++) {
    assert.ok(
      f.etapas[i].espessura <= f.etapas[i - 1].espessura + 0.01,
      `a etapa ${i} ficou mais grossa que a anterior`,
    );
  }
});

/* ── As guias ficam ENTRE as etapas ────────────────────────────────────────── */

checar("as guias caem ENTRE as etapas, nunca sobre elas", () => {
  /* Conferido na referência: guias em ≈270/530/790/1048, centros em
     ≈140/400/660/920/1180. A pílula de perda mora na guia porque perda é o que
     acontece ENTRE duas etapas — sobre a etapa, ela seria atribuída a uma. */
  const f = calcularFluxo(REFERENCIA, OPC);
  assert.equal(f.guias.length, f.etapas.length - 1);
  for (let i = 0; i < f.guias.length; i++) {
    assert.ok(
      f.guias[i] > f.etapas[i].x && f.guias[i] < f.etapas[i + 1].x,
      `a guia ${i} (${f.guias[i]}) não está entre ${f.etapas[i].x} e ${f.etapas[i + 1].x}`,
    );
  }
});

checar("a pílula de perda se ancora na guia da SUA transição", () => {
  const f = calcularFluxo(REFERENCIA, OPC);
  for (const p of f.perdas) assert.equal(p.x, f.guias[p.de], `a perda ${p.de} saiu da guia`);
});

/* ── O VETOR DE LEITURA, EM COORDENADA DE TELA ─────────────────────────────────

   🔴 ESTAS ASSERÇÕES SÃO ESCRITAS EM PIXEL DE TELA, NÃO EM `y` DE SVG, e a
   distinção não é preciosismo — foi exatamente aí que uma versão anterior
   mentiu.

   Existiu aqui um teste chamado "a linha de colapso DESCE — nunca sobe". Ele
   passava, e afirmava `y` DECRESCENTE. Em SVG o eixo `y` aponta para BAIXO,
   então `y` decrescente é a linha SUBINDO na tela. Medido na página, ela ia de
   y=160 a y=17: subia. O teste verde carimbava como "desce" a única marca que
   subia, no gráfico cuja reclamação era "lê como crescimento".

   ⛔ A REGRA: asserção sobre direção VISUAL vai em coordenada de tela. Se o
   formato inverte um eixo, a asserção CONVERTE antes de comparar, e o nome do
   teste diz "na tela". Um verbo ambíguo ("desce") lê como tela e mede
   coordenada — e as duas são opostas. */

const CENTRO = 100;
const naTela = (ySvg) => -ySvg; // maior número = mais ALTO na tela
const bordaCima = (f, i) => naTela(CENTRO - f.etapas[i].espessura / 2);
const bordaBaixo = (f, i) => naTela(CENTRO + f.etapas[i].espessura / 2);

checar("NA TELA: num funil que cai, a borda de cima DESCE", () => {
  const f = calcularFluxo([1220, 35, 25], OPC);
  const alturas = f.etapas.map((_, i) => bordaCima(f, i));
  for (let i = 1; i < alturas.length; i++) {
    assert.ok(alturas[i] <= alturas[i - 1] + 0.01, `a borda de cima subiu na etapa ${i}: ${alturas}`);
  }
});

checar("NA TELA: num funil que cai, a borda de baixo SOBE", () => {
  const f = calcularFluxo([1220, 35, 25], OPC);
  const alturas = f.etapas.map((_, i) => bordaBaixo(f, i));
  for (let i = 1; i < alturas.length; i++) {
    assert.ok(alturas[i] >= alturas[i - 1] - 0.01, `a borda de baixo desceu na etapa ${i}: ${alturas}`);
  }
});

checar("NA TELA: a figura CONVERGE — as duas bordas caminham uma para a outra", () => {
  /* A propriedade que a fita CENTRADA compra, e a que a ancorada no topo não
     podia cumprir: lá a borda de cima ficava parada e só a de baixo subia — a
     assinatura de "crescimento" que o dono leu na tela. */
  const f = calcularFluxo([1220, 35, 25], OPC);
  for (let i = 1; i < f.etapas.length; i++) {
    const desceu = bordaCima(f, i - 1) - bordaCima(f, i);
    const subiu = bordaBaixo(f, i) - bordaBaixo(f, i - 1);
    assert.ok(desceu >= -0.01 && subiu >= -0.01, `a etapa ${i} não convergiu`);
    assert.ok(
      Math.abs(desceu - subiu) < 0.01,
      `convergência assimétrica na etapa ${i}: cima ${desceu.toFixed(2)} vs baixo ${subiu.toFixed(2)}`,
    );
  }
});

checar("a asserção de convergência PODE FALHAR — um funil que cresce a derruba", () => {
  /* Guarda que nunca disparou não é guarda. Com valores crescentes a borda de
     cima SOBE, que é o caso errado que as três asserções acima alegam pegar. */
  const f = calcularFluxo([25, 35, 1220], OPC);
  let subiu = false;
  for (let i = 1; i < f.etapas.length; i++) if (bordaCima(f, i) > bordaCima(f, i - 1) + 0.01) subiu = true;
  assert.ok(subiu, "num funil crescente a borda de cima deveria subir — a asserção está morta");
});

/* ── O caminho desenhado ───────────────────────────────────────────────────── */

checar("a fita chega às DUAS bordas do desenho, sem começar no ar", () => {
  const f = calcularFluxo([1220, 35, 25], OPC);
  const d = caminhoDaFita(f.etapas, CENTRO, { x0: 0, x1: 600 });
  assert.ok(d.startsWith("M0.00,"), `não começa na borda esquerda: ${d.slice(0, 40)}`);
  assert.ok(d.includes("600.00,"), "não alcança a borda direita");
});

checar("sem extremos a fita começa no CENTRO da primeira etapa", () => {
  const f = calcularFluxo([1220, 35, 25], OPC);
  const d = caminhoDaFita(f.etapas, CENTRO);
  assert.ok(d.startsWith(`M${f.etapas[0].x.toFixed(2)},`), d.slice(0, 40));
});

checar("a fita é SIMÉTRICA em torno do centro", () => {
  const f = calcularFluxo([1220, 35, 25], OPC);
  for (const e of f.etapas) {
    const cima = CENTRO - e.espessura / 2;
    const baixo = CENTRO + e.espessura / 2;
    assert.ok(Math.abs((CENTRO - cima) - (baixo - CENTRO)) < 0.01, "a fita saiu do eixo");
  }
});

checar("o caminho abre com M, fecha com Z e usa CÚBICAS entre as etapas", () => {
  /* Absorvido do `teste-fita.mjs`, deletado em 07/08/2026 (ver o cabeçalho).
     Segmento reto entre etapas mataria a leitura de fluxo — vira gráfico de
     área. São 2 cúbicas por vão, ida e volta, mais as dos extremos. */
  const f = calcularFluxo([1220, 35, 25], OPC);
  const d = caminhoDaFita(f.etapas, CENTRO);
  assert.ok(d.startsWith("M"), "não abre com M");
  assert.ok(d.trimEnd().endsWith("Z"), "não fecha com Z");
  /* ⚠️ Existe UM `L`, e ele é legítimo: a tampa vertical da ponta direita, onde
     a borda de cima encontra a de baixo. Um segundo `L` seria vão desenhado
     reto — aí sim a fita viraria gráfico de área. */
  const retos = d.match(/L[\d.]+,[\d.]+/g) ?? [];
  assert.equal(retos.length, 1, `esperava só a tampa; vieram ${retos.length} retas: ${retos}`);
  const xTampa = +retos[0].slice(1).split(",")[0];
  assert.equal(xTampa, f.etapas[f.etapas.length - 1].x, "a tampa não está na última etapa");
  assert.equal((d.match(/C/g) ?? []).length, 4, "2 vãos × ida e volta = 4 cúbicas");
});

checar("os controles da cúbica ficam no MEIO do vão", () => {
  /* Controle a 1/3 dá tangente inclinada na guia, e a fita chega torta na
     etapa — o estreitamento parece começar antes de onde começa. */
  const f = calcularFluxo([1220, 35], OPC);
  const d = caminhoDaFita(f.etapas, CENTRO);
  const meio = ((f.etapas[0].x + f.etapas[1].x) / 2).toFixed(2);
  assert.ok(d.includes(`C${meio},`), `os controles não estão em x=${meio}: ${d}`);
});

checar("tudo zero não produz NaN em coordenada nenhuma", () => {
  const f = calcularFluxo([0, 0], OPC);
  assert.ok(!/NaN|Infinity/.test(caminhoDaFita(f.etapas, CENTRO, { x0: 0, x1: 600 })));
});

checar("sem etapa nenhuma o caminho é vazio, não um 'M' solto", () => {
  assert.equal(caminhoDaFita([], CENTRO), "");
});

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}\n`
    : `\n\x1b[32m${ok} asserções, todas passando\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
