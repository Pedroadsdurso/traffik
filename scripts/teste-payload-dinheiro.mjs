/**
 * A CONVERSÃO DE VALOR VINDO DO PAYLOAD, e a decisão de SOBRESCREVER a venda.
 *
 * 🔴 Achadas na triagem MANUAL das 99 puras sem teste (14/08/2026). As duas
 * famílias que estão aqui têm a mesma assinatura de risco: **erram calado, e o
 * erro vira dado gravado.**
 *
 *   `toNumber` · `toNumeroOuNulo`   💰 o VALOR da venda, vindo de string de gateway
 *   `mapPayment`                    💰 a forma de pagamento, que decide a taxa
 *   `paisEhMelhor` · `matchEhMelhor` 🔒 se um dado NOVO sobrescreve o gravado
 *
 * ⛔ `toNumber` é o mais caro dos três, e por um motivo aritmético: gateway
 * brasileiro manda `"1.234,56"` e gateway internacional manda `"1,234.56"`.
 * Trocar a regra do separador não produz erro — produz **faturamento mil vezes
 * maior ou menor**, com o número parecendo perfeitamente normal na tela.
 */

import assert from "node:assert/strict";
import { toNumber, toNumeroOuNulo, mapPayment } from "@/lib/gateways/campos";
import { paisEhMelhor, matchEhMelhor } from "@/lib/gateways/fontes";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};
const eq = (nome, a, b) => {
  assert.equal(a, b, nome + " — obtido " + JSON.stringify(a) + ", esperado " + JSON.stringify(b));
  console.log("  ✓ " + nome + " — " + JSON.stringify(a));
  n++;
};

/* ═══ 1 · `toNumber` — o separador decimal é o ÚLTIMO ════════════════════ */
console.log("\n1 · toNumber — o valor da venda");

eq("número passa direto", toNumber(1234.56), 1234.56);
eq("inteiro em string", toNumber("100"), 100);

/* 🔴 As duas convenções, e a regra que as separa: o ÚLTIMO separador é o
   decimal. Não é heurística de país — é uma propriedade do texto. */
eq("formato BR: 1.234,56", toNumber("1.234,56"), 1234.56);
eq("formato US: 1,234.56", toNumber("1,234.56"), 1234.56);
eq("BR sem milhar: 99,90", toNumber("99,90"), 99.9);
eq("US sem milhar: 99.90", toNumber("99.90"), 99.9);

/* ⛔ A INVARIANTE que congela relação, não valor: as duas convenções do MESMO
   número dão o MESMO resultado. É isso que a regra do último separador
   garante, e é isso que uma troca quebraria. */
for (const [br, us] of [["1.234,56", "1,234.56"], ["10.000,00", "10,000.00"], ["1.234.567,89", "1,234,567.89"]]) {
  ok("BR e US do mesmo número coincidem: " + br + " = " + us, toNumber(br) === toNumber(us), String(toNumber(br)));
}

eq("símbolo de moeda é descartado", toNumber("R$ 1.234,56"), 1234.56);
eq("espaços não atrapalham", toNumber("  250,00  "), 250);
eq("negativo preserva o sinal", toNumber("-50,00"), -50);
eq("lixo vira 0, não NaN", toNumber("abc"), 0);
eq("vazio vira 0", toNumber(""), 0);
eq("null vira 0", toNumber(null), 0);
eq("objeto vira 0", toNumber({}), 0);
ok("nunca devolve NaN", [1, "x", "", null, undefined, {}, [], "1,2.3"].every((v) => Number.isFinite(toNumber(v))));

/* ═══ 2 · `toNumeroOuNulo` — a distinção central do projeto ═════════════ */
console.log("\n2 · toNumeroOuNulo — ausência ≠ zero");

eq("ausente é `null`, não 0", toNumeroOuNulo(undefined), null);
eq("null é `null`", toNumeroOuNulo(null), null);
eq("string vazia é `null`", toNumeroOuNulo(""), null);
eq("⛔ o ZERO EXPLÍCITO é 0, não null", toNumeroOuNulo(0), 0);
eq("⛔ `\"0\"` também é 0", toNumeroOuNulo("0"), 0);
eq("valor normal passa", toNumeroOuNulo("1.234,56"), 1234.56);
eq("NaN vira null", toNumeroOuNulo(NaN), null);
eq("Infinity vira null", toNumeroOuNulo(Infinity), null);
ok(
  "⛔ a diferença entre os dois é EXATAMENTE a ausência",
  toNumber("") === 0 && toNumeroOuNulo("") === null,
  "`toNumber` colapsa, `toNumeroOuNulo` preserva — usar o errado apaga a distinção",
);

/* ═══ 3 · `mapPayment` — decide qual TAXA incide ════════════════════════ */
console.log("\n3 · mapPayment — a forma decide a taxa");

for (const [entrada, esperado] of [
  ["pix", "PIX"], ["PIX", "PIX"], ["Pix Automático", "PIX"],
  ["cartao", "CARTAO"], ["CREDIT_CARD", "CARTAO"], ["debit", "CARTAO"], ["Cartão de Crédito", "CARTAO"],
  ["boleto", "BOLETO"], ["BANK_SLIP", "BOLETO"], ["slip", "BOLETO"],
  ["cripto", "OUTRO"], ["", "OUTRO"],
]) {
  eq(`"${entrada}" → ${esperado}`, mapPayment(entrada), esperado);
}
eq("null vira OUTRO, não estoura", mapPayment(null), "OUTRO");
eq("número vira OUTRO", mapPayment(42), "OUTRO");
ok(
  "⛔ desconhecido cai em OUTRO — nunca num tipo com taxa",
  ["", null, undefined, "qualquer-coisa", 0].every((v) => mapPayment(v) === "OUTRO"),
  "adivinhar a forma aplicaria a taxa errada em silêncio",
);

/* ═══ 4 · `paisEhMelhor` / `matchEhMelhor` — sobrescrever o gravado ═════ */
console.log("\n4 · a decisão de SOBRESCREVER");

/* A propriedade, não os valores: uma fonte mais forte vence a mais fraca, e a
   ordem é total (nunca há empate ambíguo). */
ok("fonte desconhecida NÃO vence uma conhecida", paisEhMelhor("fonte-que-nao-existe", "ip") === false);
ok("uma fonte conhecida vence a desconhecida", paisEhMelhor("ip", "fonte-que-nao-existe") === true);
ok("null não vence conhecida", paisEhMelhor(null, "ip") === false);
ok("conhecida vence null", paisEhMelhor("ip", null) === true);
ok("⛔ a MESMA fonte vence (>=): reprocessar atualiza", paisEhMelhor("ip", "ip") === true);
ok("idem para match", matchEhMelhor("ip", "ip") === true);
ok("match desconhecido não vence conhecido", matchEhMelhor("nada", "fbclid") === false);
ok("`direct` (3) vence `fbclid` (2)", matchEhMelhor("direct", "fbclid") === true);
ok("`ip` (1) NÃO vence `direct` (3)", matchEhMelhor("ip", "direct") === false);
/* ⚠️ `payload` e `ip` valem 4 OS DOIS — empate DELIBERADO no mapa de força.
   A asserção existe para o empate não ser "consertado" sem alguém decidir qual
   ganha: hoje o último a chegar vence, e isso é escolha, não descuido. */
ok(
  "⚠️ `payload` e `ip` EMPATAM (4): cada um vence o outro",
  paisEhMelhor("payload", "ip") === true && paisEhMelhor("ip", "payload") === true,
  "o último a chegar prevalece — é decisão, não acidente",
);
ok("`campanha` (3) não vence `ip` (4)", paisEhMelhor("campanha", "ip") === false);
ok("`incerto` (0) não vence `idioma` (1)", paisEhMelhor("incerto", "idioma") === false);
ok("`payload_cru` (0) não vence `header` (1)", paisEhMelhor("payload_cru", "header") === false);

/* ⛔ `>=` e não `>` é DECISÃO: reprocessar o mesmo webhook precisa atualizar o
   dado, senão uma correção do gateway nunca chega. A asserção existe para essa
   escolha não ser "consertada" para `>` por parecer mais seguro. */

/* ═══════════════════════════════════════════════════════════════════════
 * 5 · PLANTIOS — os três são consertos plausíveis, não erros artificiais
 * ═════════════════════════════════════════════════════════════════════ */
console.log("\n5 · plantios");

/* ── A: "o separador decimal é a VÍRGULA, somos brasileiros" ──────────────
   O conserto mais natural do mundo, e o que multiplica por 1000. */
{
  const sempreBR = (v) => {
    if (typeof v === "number") return v;
    const s = String(v).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
    const x = parseFloat(s);
    return Number.isFinite(x) ? x : 0;
  };
  const us = "1,234.56";
  ok("PLANTIO A: 'sempre BR' lê " + us + " como " + sempreBR(us), sempreBR(us) !== toNumber(us), sempreBR(us) + " ≠ " + toNumber(us));
  ok(
    "PLANTIO A: o erro é de ORDEM DE GRANDEZA, não de centavos",
    Math.abs(sempreBR(us) / toNumber(us)) > 50 || Math.abs(toNumber(us) / sempreBR(us)) > 50,
    "razão " + (sempreBR(us) / toNumber(us)).toFixed(2) + "×",
  );
  let caiu = false;
  try {
    assert.equal(sempreBR("1,234.56"), 1234.56);
  } catch {
    caiu = true;
  }
  ok("PLANTIO A: a asserção do formato US DERRUBA", caiu);
}

/* ── B: `toNumeroOuNulo` colapsando o zero ───────────────────────────────
   O "conserto" de quem vê `null` chegar na conta: *"trato tudo por toNumber"*.
   É o mesmo colapso do motor de regras, noutra camada. */
{
  const colapsado = (v) => toNumber(v);
  ok("PLANTIO B: com o colapso, ausente e ZERO viram o mesmo 0", colapsado("") === colapsado("0"));
  ok("PLANTIO B: e o certo os separa", toNumeroOuNulo("") === null && toNumeroOuNulo("0") === 0);
  /* ⛔ PAR NEGATIVO — o colapso só erra numa direção: ele nunca inventa valor,
     ele APAGA a ausência. Um valor presente atravessa igual nos dois, e é por
     isso que o defeito não aparece em nenhum caso "normal". */
  ok(
    "PLANTIO B (par negativo): com valor PRESENTE os dois concordam",
    colapsado("99,90") === toNumeroOuNulo("99,90"),
    "← o defeito é invisível em todo caso com valor",
  );
}

/* ── C: `>` no lugar de `>=` ─────────────────────────────────────────────
   Parece mais seguro ("só sobrescreve se for ESTRITAMENTE melhor") e quebra o
   reprocessamento: uma correção do gateway, vinda da mesma fonte, é ignorada. */
{
  const estrito = (nova, atual) => {
    /* Os pesos REAIS de `FORCA_PAIS`, para o plantio diferir do certo APENAS no
       operador — senão ele mediria duas coisas de uma vez. */
    const F = { payload: 4, ip: 4, campanha: 3, carrier: 2, clique: 2, idioma: 1, locale: 1, header: 1 };
    return (F[nova ?? ""] ?? 0) > (F[atual ?? ""] ?? 0);
  };
  ok("PLANTIO C: com `>`, a mesma fonte NÃO atualiza", estrito("ip", "ip") === false);
  ok("PLANTIO C: e o certo atualiza", paisEhMelhor("ip", "ip") === true);
  let caiu = false;
  try {
    assert.equal(estrito("ip", "ip"), true);
  } catch {
    caiu = true;
  }
  ok("PLANTIO C: a asserção do reprocessamento DERRUBA", caiu);
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: 4 módulos, 7 funções puras cobertas\n");
