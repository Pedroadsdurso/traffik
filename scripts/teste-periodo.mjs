/**
 * Asserções puras de `lib/periodo.ts` — a fonte única das janelas de período.
 *
 * ⚠️ Força **`TZ=UTC`** antes de tudo, de propósito: é o fuso do processo na
 * Vercel, e foi exatamente ele que produziu o bug de dia/hora documentado no
 * CLAUDE.md. Se a janela passar a depender do fuso do PROCESSO em vez do fuso do
 * usuário, este teste falha aqui e não em produção.
 *
 * O `TZ` é definido no próprio script (e não no `package.json`) para o comando
 * funcionar igual no Windows e no Linux — `TZ=UTC cmd` é sintaxe de shell POSIX.
 *
 * Sem banco, sem rede.
 */
process.env.TZ = "UTC";
import {
  diasDaJanela,
  ehPeriodoValido,
  janelaAnterior,
  janelaDoPeriodo,
} from "@/lib/periodo";
import { dayKeyInTz, todayKey } from "@/lib/timezone";

let ok = 0;
let falhas = 0;

function eq(nome, obtido, esperado) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${a}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${a}\n      esperado: ${b}`);
  }
}

function verdade(nome, cond, detalhe = "") {
  if (cond) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome}${detalhe ? " — " + detalhe : ""}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}${detalhe ? " — " + detalhe : ""}`);
  }
}

const BR = "America/Sao_Paulo";

console.log(`\n\x1b[1mTZ do processo: ${process.env.TZ ?? "(padrão da máquina)"}\x1b[0m`);

// ── 1. Janelas de um dia ────────────────────────────────────────────────────
console.log("\n\x1b[1mJanelas de um dia\x1b[0m");
const hojeBR = todayKey(BR);
eq("hoje", janelaDoPeriodo("hoje", BR), { startKey: hojeBR, endKey: hojeBR });
verdade(
  "ontem é exatamente o dia anterior",
  diasDaJanela(janelaDoPeriodo("ontem", BR)) === 1 &&
    janelaDoPeriodo("ontem", BR).endKey < hojeBR,
  janelaDoPeriodo("ontem", BR).startKey,
);

// ── 2. Últimos N dias incluem HOJE ──────────────────────────────────────────
console.log("\n\x1b[1mÚltimos N dias\x1b[0m");
for (const [p, n] of [
  ["7d", 7],
  ["30d", 30],
]) {
  const j = janelaDoPeriodo(p, BR);
  eq(`${p} termina hoje`, j.endKey, hojeBR);
  verdade(`${p} tem ${n} dias de calendário`, diasDaJanela(j) === n, `${diasDaJanela(j)}`);
}

// ── 3. Meses — a aritmética que não pode usar `new Date(a, m, d)` ───────────
console.log("\n\x1b[1mMeses\x1b[0m");
const mesAtual = janelaDoPeriodo("mesAtual", BR);
verdade("mesAtual começa no dia 01", mesAtual.startKey.endsWith("-01"), mesAtual.startKey);
eq("mesAtual termina hoje", mesAtual.endKey, hojeBR);
verdade(
  "mesAtual está no mês de hoje",
  mesAtual.startKey.slice(0, 7) === hojeBR.slice(0, 7),
  mesAtual.startKey.slice(0, 7),
);

const mesPassado = janelaDoPeriodo("mesPassado", BR);
verdade("mesPassado começa no dia 01", mesPassado.startKey.endsWith("-01"), mesPassado.startKey);
verdade(
  "mesPassado é um mês inteiro (28 a 31 dias)",
  diasDaJanela(mesPassado) >= 28 && diasDaJanela(mesPassado) <= 31,
  `${diasDaJanela(mesPassado)} dias`,
);
verdade(
  "mesPassado termina ANTES do mês atual começar",
  mesPassado.endKey < mesAtual.startKey,
  `${mesPassado.endKey} < ${mesAtual.startKey}`,
);
verdade(
  "início e fim de mesPassado estão no MESMO mês",
  mesPassado.startKey.slice(0, 7) === mesPassado.endKey.slice(0, 7),
  mesPassado.startKey.slice(0, 7),
);

// ⚠️ O caso que a aritmética de `Date` erra: janeiro tem de voltar para
// dezembro do ANO anterior. Testado por um fuso cujo "hoje" é 1º de janeiro.
console.log("\n\x1b[1mViradas de ano e de mês\x1b[0m");
{
  // Kiritimati (UTC+14) entra no ano novo antes de todo mundo: em 31/12 às 12h
  // UTC lá já é 1º de janeiro de 2027.
  const tz = "Pacific/Kiritimati";
  const agora = new Date("2026-12-31T12:00:00Z");
  verdade("hoje já virou o ano no fuso +14", dayKeyInTz(agora, tz) === "2027-01-01", dayKeyInTz(agora, tz));
  eq("mesAtual em 1º de janeiro", janelaDoPeriodo("mesAtual", tz, undefined, agora), {
    startKey: "2027-01-01",
    endKey: "2027-01-01",
  });
  eq("mesPassado em janeiro volta para DEZEMBRO do ano anterior", janelaDoPeriodo("mesPassado", tz, undefined, agora), {
    startKey: "2026-12-01",
    endKey: "2026-12-31",
  });
}
{
  // Fevereiro de 2028 é bissexto: 29 dias.
  const mp = janelaDoPeriodo("mesPassado", BR, undefined, new Date("2028-03-15T15:00:00Z"));
  eq("mesPassado em março/2028 = fevereiro bissexto", mp, {
    startKey: "2028-02-01",
    endKey: "2028-02-29",
  });
  verdade("29 dias", diasDaJanela(mp) === 29, `${diasDaJanela(mp)}`);
}

// ── 4. O fuso do USUÁRIO manda, não o do processo ───────────────────────────
console.log("\n\x1b[1mFuso do usuário vs. fuso do processo\x1b[0m");
{
  // 02:00 UTC = 23:00 do dia ANTERIOR em Brasília. É a prova de que quem manda é
  // o fuso do USUÁRIO: o mesmo instante dá dias diferentes em fusos diferentes.
  const agora = new Date("2026-07-15T02:00:00Z");
  eq("às 02h UTC, 'hoje' em Brasília ainda é dia 14", janelaDoPeriodo("hoje", BR, undefined, agora), {
    startKey: "2026-07-14",
    endKey: "2026-07-14",
  });
  eq("no MESMO instante, 'hoje' em UTC é dia 15", janelaDoPeriodo("hoje", "UTC", undefined, agora), {
    startKey: "2026-07-15",
    endKey: "2026-07-15",
  });
  eq("mesAtual em Brasília ainda não inclui o dia 15", janelaDoPeriodo("mesAtual", BR, undefined, agora), {
    startKey: "2026-07-01",
    endKey: "2026-07-14",
  });
  eq("30d ancorado no dia do USUÁRIO", janelaDoPeriodo("30d", BR, undefined, agora), {
    startKey: "2026-06-15",
    endKey: "2026-07-14",
  });
}

// ── 5. `custom` e entradas quebradas ───────────────────────────────────────
console.log("\n\x1b[1mPersonalizado e entradas inválidas\x1b[0m");
eq("custom normal", janelaDoPeriodo("custom", BR, { from: "2026-07-01", to: "2026-07-10" }), {
  startKey: "2026-07-01",
  endKey: "2026-07-10",
});
eq("custom de UM dia (to ausente) não vira janela vazia", janelaDoPeriodo("custom", BR, { from: "2026-07-05" }), {
  startKey: "2026-07-05",
  endKey: "2026-07-05",
});
eq("custom invertido é ordenado", janelaDoPeriodo("custom", BR, { from: "2026-07-10", to: "2026-07-01" }), {
  startKey: "2026-07-01",
  endKey: "2026-07-10",
});
verdade(
  "custom sem `from` cai em 7 dias em vez de estourar",
  diasDaJanela(janelaDoPeriodo("custom", BR, {})) === 7,
);
verdade(
  "período desconhecido cai em 7 dias (querystring adulterada)",
  diasDaJanela(janelaDoPeriodo("xyz", BR)) === 7,
);
verdade("ehPeriodoValido aceita os 7 nomes", ["hoje", "ontem", "7d", "30d", "mesAtual", "mesPassado", "custom"].every(ehPeriodoValido));
verdade("ehPeriodoValido recusa forjado", !ehPeriodoValido("mesRetrasado") && !ehPeriodoValido(null));

// ── 6. Janela anterior (base dos deltas) ───────────────────────────────────
console.log("\n\x1b[1mJanela anterior\x1b[0m");
{
  const j = { startKey: "2026-07-08", endKey: "2026-07-14" };
  eq("7 dias -> os 7 dias imediatamente antes", janelaAnterior(j), {
    startKey: "2026-07-01",
    endKey: "2026-07-07",
  });
  verdade("mesmo tamanho da janela original", diasDaJanela(janelaAnterior(j)) === diasDaJanela(j));
  verdade("não encosta na janela atual", janelaAnterior(j).endKey < j.startKey);
}
eq("um dia -> o dia anterior", janelaAnterior({ startKey: "2026-03-01", endKey: "2026-03-01" }), {
  startKey: "2026-02-28",
  endKey: "2026-02-28",
});

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
