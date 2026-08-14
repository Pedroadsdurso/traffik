/**
 * O RATEIO DE DESPESA RECORRENTE — a conta que MUDOU O LUCRO EM PRODUÇÃO.
 *
 * 🔴 ELA NÃO TINHA UMA ASSERÇÃO SEQUER CONTRA A FUNÇÃO PURA
 *
 * Achado pela varredura de 14/08/2026: `ratearDespesa`, `fatorDeRateio` e
 * `contarUnicasAtivas` **não são nomeados em nenhum teste**. O caminho é
 * exercido de lado (o `test:financeiro` chama `calcularFinanceiro`, que chama
 * o rateio), mas o CONTRATO da conta nunca foi congelado.
 *
 * ⛔ E ela não é uma conta qualquer. Em 06/08/2026 a correção do rateio
 * **mudou o Lucro de todo mundo**: uma despesa mensal de R$ 500 era descontada
 * inteira tanto em "Hoje" quanto em "Últimos 30 dias", e uma anual de R$ 6.000
 * também. O Dashboard do dia mostrava prejuízo que não existia. Houve mensagem
 * escrita para os testadores.
 *
 * ## O que estas asserções congelam — RELAÇÃO, não valor
 *
 * O `CLAUDE.md` é explícito sobre o modo de falha que se quer impedir:
 *
 *   > ⛔ **Nada de divisor fixo de 30.** A soma dia a dia é o que faz
 *   > 30/07–01/08 pegar o divisor de julho e o de agosto, e fevereiro valer
 *   > ÷28 ou ÷29. Um divisor médio erraria nos dois meses ao mesmo tempo.
 *
 * Então o que se afirma aqui é a PROPRIEDADE (um mês inteiro vale exatamente 1;
 * fevereiro difere de janeiro; a janela que cruza meses soma frações
 * diferentes), não um número que alguém copiou da tela.
 */

import assert from "node:assert/strict";
import { fatorDeRateio, ratearDespesa, contarUnicasAtivas } from "@/lib/despesas/rateio";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};
const perto = (nome, a, b, tol = 1e-9) => {
  assert.ok(Math.abs(a - b) < tol, nome + " — obtido " + a + ", esperado " + b);
  console.log("  ✓ " + nome + " — " + a);
  n++;
};

console.log("\nRateio de despesa recorrente");

/* ---- 1. DIARIA: multiplica pelos dias ---------------------------------- */
perto("DIARIA em 1 dia = 1", fatorDeRateio("DIARIA", "2026-08-14", "2026-08-14"), 1);
perto("DIARIA em 7 dias = 7", fatorDeRateio("DIARIA", "2026-08-08", "2026-08-14"), 7);
perto("DIARIA em agosto inteiro = 31", fatorDeRateio("DIARIA", "2026-08-01", "2026-08-31"), 31);

/* ---- 2. SEMANAL: dias / 7 ---------------------------------------------- */
perto("SEMANAL em 7 dias = 1", fatorDeRateio("SEMANAL", "2026-08-08", "2026-08-14"), 1);
perto("SEMANAL em 1 dia = 1/7", fatorDeRateio("SEMANAL", "2026-08-14", "2026-08-14"), 1 / 7);

/* ---- 3. MENSAL: a INVARIANTE — mês inteiro vale exatamente 1 ------------
   ⛔ É esta que mata o divisor fixo de 30: com ÷30, agosto (31 dias) daria
   1,0333 e fevereiro daria 0,9333. Nenhum dos dois é 1. */
perto("MENSAL em agosto inteiro (31 dias) = 1", fatorDeRateio("MENSAL", "2026-08-01", "2026-08-31"), 1);
perto("MENSAL em fevereiro inteiro (28 dias) = 1", fatorDeRateio("MENSAL", "2026-02-01", "2026-02-28"), 1);
perto("MENSAL em abril inteiro (30 dias) = 1", fatorDeRateio("MENSAL", "2026-04-01", "2026-04-30"), 1);
ok(
  "⛔ um dia de fevereiro vale MAIS que um dia de agosto (1/28 > 1/31)",
  fatorDeRateio("MENSAL", "2026-02-10", "2026-02-10") > fatorDeRateio("MENSAL", "2026-08-10", "2026-08-10"),
  (1 / 28).toFixed(5) + " > " + (1 / 31).toFixed(5),
);

/* ---- 3b. A JANELA QUE CRUZA MESES soma frações DIFERENTES ---------------
   O caso literal do `CLAUDE.md`: 30/07–01/08 pega o divisor de julho E o de
   agosto. Com divisor fixo os três dias valeriam 3/30; aqui não. */
{
  const f = fatorDeRateio("MENSAL", "2026-07-30", "2026-08-01");
  perto("30/07–01/08 = 2/31 (julho) + 1/31 (agosto)", f, 2 / 31 + 1 / 31);
  ok("⛔ e NÃO é 3/30 (divisor fixo)", Math.abs(f - 3 / 30) > 1e-6, "3/30 = " + (3 / 30).toFixed(6) + ", real = " + f.toFixed(6));
}
{
  /* Fevereiro→março: aqui os divisores REALMENTE diferem (28 e 31). */
  const f = fatorDeRateio("MENSAL", "2026-02-27", "2026-03-02");
  perto("27/02–02/03 = 2/28 + 2/31", f, 2 / 28 + 2 / 31);
  ok("⛔ e NÃO é 4/30", Math.abs(f - 4 / 30) > 1e-6);
}

/* ---- 4. ANUAL: ano inteiro vale 1, e bissexto difere -------------------- */
perto("ANUAL em 2026 inteiro = 1", fatorDeRateio("ANUAL", "2026-01-01", "2026-12-31"), 1);
perto("ANUAL em 2024 (bissexto) inteiro = 1", fatorDeRateio("ANUAL", "2024-01-01", "2024-12-31"), 1);
ok(
  "um dia de ano BISSEXTO vale menos (1/366 < 1/365)",
  fatorDeRateio("ANUAL", "2024-03-10", "2024-03-10") < fatorDeRateio("ANUAL", "2026-03-10", "2026-03-10"),
);

/* ---- 5. UNICA: FORA do cálculo, e é decisão registrada ------------------
   ⚠️ "Despesa única sem data é recurso quebrado, não limitação de dashboard"
   — a migration `ocorreEm` está aprovada e não feita. Até lá, 0. */
perto("UNICA não entra no rateio", fatorDeRateio("UNICA", "2026-08-01", "2026-08-31"), 0);
ok("UNICA dá 0 em qualquer janela", [1, 7, 30, 365].every((d) => {
  const fim = new Date(Date.UTC(2026, 0, 1 + d - 1)).toISOString().slice(0, 10);
  return fatorDeRateio("UNICA", "2026-01-01", fim) === 0;
}));

/* ---- 6. Janela vazia / invertida ---------------------------------------- */
perto("janela invertida dá 0 (não negativo)", fatorDeRateio("DIARIA", "2026-08-14", "2026-08-01"), 0);

/* ---- 7. `ratearDespesa` é `amount × fator` ------------------------------ */
{
  const j = { startKey: "2026-08-01", endKey: "2026-08-31" };
  perto("mensal de 500 num mês inteiro = 500", ratearDespesa(500, "MENSAL", j), 500);
  perto("anual de 6000 em agosto = 6000 × 31/365", ratearDespesa(6000, "ANUAL", j), 6000 * (31 / 365));
  perto("diária de 50 em agosto = 1550", ratearDespesa(50, "DIARIA", j), 1550);
  perto("única de 300 = 0", ratearDespesa(300, "UNICA", j), 0);

  /* 🔴 O CASO DO CLAUDE.md: "Hoje" (1 dia). Antes da correção, a mensal de 500
     era descontada INTEIRA aqui — era isso que fabricava prejuízo. */
  const hoje = { startKey: "2026-08-14", endKey: "2026-08-14" };
  const mensalHoje = ratearDespesa(500, "MENSAL", hoje);
  ok(
    "⛔ mensal de 500 em UM dia NÃO é 500 (era o defeito de produção)",
    mensalHoje < 20,
    "hoje vale " + mensalHoje.toFixed(2) + ", não 500,00",
  );
  perto("…e é exatamente 500/31", mensalHoje, 500 / 31);
}

/* ---- 8. `contarUnicasAtivas` — o que alimenta o aviso da tela ----------- */
{
  const base = [
    { type: "DESPESA_RECORRENTE", recurrence: "UNICA" },
    { type: "DESPESA_RECORRENTE", recurrence: "UNICA", active: false },
    { type: "DESPESA_RECORRENTE", recurrence: "MENSAL" },
    { type: "TAXA_GATEWAY", recurrence: "UNICA" },
  ];
  ok("conta só UNICA + RECORRENTE + ativa", contarUnicasAtivas(base) === 1, String(contarUnicasAtivas(base)));
  ok("`active: undefined` conta como ATIVA", contarUnicasAtivas([{ type: "DESPESA_RECORRENTE", recurrence: "UNICA" }]) === 1);
  ok("lista vazia dá 0", contarUnicasAtivas([]) === 0);
  /* ⛔ LINHA DE BASE do par: sem isto, um `=== 0` passaria com a fixture vazia. */
  ok("linha de base: a fixture tinha o que examinar", base.length === 4);
}

/* ---------------------------------------------------------------------------
 * 9. PROVA PELO LADO NEGATIVO
 *
 * PLANTIO: o DIVISOR FIXO DE 30 — o defeito que o `CLAUDE.md` proíbe por nome,
 * e que a soma dia a dia existe para impedir.
 * ------------------------------------------------------------------------ */
{
  const comDivisorFixo = (recorrencia, dias) => (recorrencia === "MENSAL" ? dias / 30 : 0);

  /* Agosto: 31 dias. O certo é 1; o divisor fixo dá 31/30. */
  const certo = fatorDeRateio("MENSAL", "2026-08-01", "2026-08-31");
  const ruim = comDivisorFixo("MENSAL", 31);
  ok("PLANTIO: o divisor fixo dá " + ruim.toFixed(4) + " em agosto, não 1", Math.abs(ruim - 1) > 1e-6);
  ok("PLANTIO: e o certo dá 1", Math.abs(certo - 1) < 1e-9);

  let caiu = false;
  try {
    assert.ok(Math.abs(ruim - 1) < 1e-9, "mês inteiro tem de valer 1");
  } catch {
    caiu = true;
  }
  ok("PLANTIO: a asserção do mês inteiro DERRUBA com divisor fixo", caiu);

  /* E fevereiro: o divisor fixo erra para o outro lado. */
  const fevRuim = comDivisorFixo("MENSAL", 28);
  ok("PLANTIO: em fevereiro o divisor fixo erra ao contrário (" + fevRuim.toFixed(4) + ")", fevRuim < 1);
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
