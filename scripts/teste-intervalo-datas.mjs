/**
 * `dateRange.ts` — O SELETOR DE PERÍODO, e ele decide TODO número da tela.
 *
 * Sete exports, **zero asserções** até 14/08/2026. `test:periodo` cobre
 * `lib/periodo.ts`, que é outro módulo — conferido na lista de import daquele
 * arquivo, não pelo nome.
 *
 * ### 🔴 O CABEÇALHO DELE JÁ NOMEIA O DEFEITO, COM O NÚMERO MEDIDO
 *
 * > `toISO` é o ponto clássico de erro: `Date.toISOString()` converte para UTC
 * > e, no Brasil (UTC-3), **a partir das 21h local já devolve o dia seguinte**.
 * > Quem usasse `toISOString()` teria o filtro "Hoje" apontando para amanhã
 * > toda noite. Verificado: 21:00 de 24/07 → `toISOString()` dá `2026-07-25`.
 *
 * Afirmação de efeito com valor medido, e sem asserção nenhuma. A §2 a
 * transforma em teste, **em processo filho com `TZ` forçado** — porque o
 * defeito depende do fuso e medir na máquina de quem roda mediria a máquina.
 *
 * ### 🔑 O QUE SE CONGELA
 *
 *   1. `toISO` ↔ `fromISO` são inversas, e nenhuma passa por UTC
 *   2. os atalhos são COERENTES entre si — "Mês passado" encosta em "Este mês"
 *   3. `gradeDoMes` monta um mês inteiro, e só ele
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const { hojeNoFuso, toISO, fromISO, somaDias, formatarIntervalo, atalhosDePeriodo, gradeDoMes } =
  await import("@/lib/dateRange");

/* ═══ MODO FILHO — `TZ` forçado. Sem `process.exit`: ver o `teste-coluna-data`. */
if (process.env.__DATA_FILHO) {
  /* 21h local do dia 24 — o instante exato que o cabeçalho do módulo cita. */
  const NOITE = new Date(2026, 6, 24, 21, 0, 0);
  const plantioToISO = (d) => d.toISOString().slice(0, 10);

  process.stdout.write(
    JSON.stringify({
      offset: -new Date().getTimezoneOffset() / 60,
      real: toISO(NOITE),
      plantio: plantioToISO(NOITE),
      /* `atalhosDePeriodo` com o mesmo instante: "Hoje" tem de ser o dia 24. */
      hoje: atalhosDePeriodo(NOITE).find((a) => a.label === "Hoje").range(),
      /* A grade não pode depender do fuso: ela é montada de ano+mês. */
      grade: gradeDoMes(2026, 1).map((d) => (d ? toISO(d) : null)).join(","),
    }),
  );
} else {

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const EU = fileURLToPath(import.meta.url);
const comTz = (tz) =>
  JSON.parse(
    execFileSync(process.execPath, [...process.execArgv, EU], {
      env: { ...process.env, TZ: tz, __DATA_FILHO: "1" },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · `toISO` ↔ `fromISO` — o par inverso
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · o par inverso");

  let semente = 7;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  let quebrou = null;
  let anos = new Set();
  for (let i = 0; i < 400; i++) {
    const y = 2024 + Math.floor(rnd() * 4);
    const m = Math.floor(rnd() * 12);
    const dias = new Date(y, m + 1, 0).getDate();
    const d = 1 + Math.floor(rnd() * dias);
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    anos.add(y);
    if (toISO(fromISO(iso)) !== iso) quebrou ??= iso + " -> " + toISO(fromISO(iso));
  }
  ok("linha de base: o fuzz cobriu " + anos.size + " anos", anos.size >= 3);
  ok("fuzz 400 (semente 7): `toISO(fromISO(s)) === s`", quebrou === null, quebrou ?? "");

  ok("o mês e o dia vêm com dois dígitos", toISO(new Date(2026, 0, 5)) === "2026-01-05");
  ok("29 de fevereiro sobrevive", toISO(fromISO("2024-02-29")) === "2024-02-29");
  ok("e a virada de ano também", toISO(fromISO("2025-12-31")) === "2025-12-31");

  /* `somaDias` não pode MUTAR a entrada: o `hoje` dos atalhos é compartilhado
     entre as seis linhas, e uma mutação faria a segunda depender da primeira. */
  {
    const base = new Date(2026, 6, 24);
    const antes = base.getTime();
    somaDias(base, -6);
    ok("`somaDias` não muta a entrada", base.getTime() === antes, "os atalhos compartilham o mesmo `hoje`");
    ok("e atravessa o mês", toISO(somaDias(fromISO("2026-08-31"), 1)) === "2026-09-01");
    ok("…e o ano, para trás", toISO(somaDias(fromISO("2026-01-01"), -1)) === "2025-12-31");
  }

  ok("um dia só é formatado sozinho", formatarIntervalo({ from: "2026-07-24", to: "2026-07-24" }) === "24/07");
  ok("e um intervalo com travessão", formatarIntervalo({ from: "2026-07-01", to: "2026-07-24" }) === "01/07 – 24/07");
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · 🔴 O DEFEITO QUE O CABEÇALHO NOMEIA — medido com `TZ` forçado
 * ═════════════════════════════════════════════════════════════════════ */
const emSp = comTz("America/Sao_Paulo");
const emUtc = comTz("UTC");
const emTokyo = comTz("Asia/Tokyo");
{
  console.log("\n2 · 🔴 `toISOString()` às 21h");

  ok("linha de base: os três filhos têm offsets diferentes", new Set([emSp.offset, emUtc.offset, emTokyo.offset]).size === 3, `${emSp.offset} · ${emUtc.offset} · ${emTokyo.offset}`);

  ok(
    "`toISO` devolve o dia 24 nos TRÊS fusos",
    emSp.real === "2026-07-24" && emUtc.real === "2026-07-24" && emTokyo.real === "2026-07-24",
    "ele lê componentes locais de um `Date` local — não há instante a converter",
  );
  ok(
    "🔴 PLANTIO: `toISOString()` devolve o dia 25 em São Paulo",
    emSp.plantio === "2026-07-25" && emSp.plantio !== emSp.real,
    "é o número que o cabeçalho do módulo cita, agora sob asserção",
  );
  ok(
    "PAR NEGATIVO: em UTC o plantio ACERTA",
    emUtc.plantio === emUtc.real,
    "a Vercel roda em UTC — o defeito não apareceria em produção",
  );
  /* ⚠️ Eu asseri que Tóquio erraria "para o outro lado" e ELA REPROVOU: às 21h
     com offset +9, o instante em UTC é meio-dia do MESMO dia. O plantio só
     erra a OESTE, e só em hora tardia — a mesma assimetria geográfica do
     `dateColumnKey`, com a hora entrando como segunda dimensão. Supor a
     simetria era supor, não medir. */
  ok(
    "…e em Tóquio ele também ACERTA às 21h",
    emTokyo.plantio === emTokyo.real,
    "com +9, 21h local é meio-dia UTC — o erro exige offset NEGATIVO e hora tardia",
  );
  ok(
    "o atalho `Hoje` aponta para o dia 24 nos três",
    [emSp, emUtc, emTokyo].every((f) => f.hoje.from === "2026-07-24" && f.hoje.to === "2026-07-24"),
    "com o plantio, o filtro `Hoje` apontaria para amanhã toda noite",
  );
  ok(
    "e a grade do mês é IDÊNTICA nos três fusos",
    emSp.grade === emUtc.grade && emUtc.grade === emTokyo.grade,
    "ela é montada de ano+mês, sem instante",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · OS ATALHOS SÃO COERENTES ENTRE SI
 *
 * ⛔ Nenhuma asserção conhece uma data: o que se congela são as relações que
 * têm de valer para QUALQUER `hoje` — e o fuzz varre 400 dias, incluindo o
 * dia 1º, o 31 e 29 de fevereiro.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · os atalhos");

  const rotulos = atalhosDePeriodo(new Date(2026, 6, 24)).map((a) => a.label);
  ok("há " + rotulos.length + " atalhos", rotulos.length >= 6, rotulos.join(" · "));

  let semente = 7;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  let invertido = null;
  let hojeErrado = null;
  let seteErrado = null;
  let naoEncosta = null;
  let primeiros = 0;
  let fevereiros = 0;

  for (let i = 0; i < 400; i++) {
    const hoje = new Date(2024, 0, 1 + Math.floor(rnd() * 1200));
    const por = Object.fromEntries(atalhosDePeriodo(hoje).map((a) => [a.label, a.range()]));

    for (const [rot, r] of Object.entries(por)) {
      if (r.from > r.to) invertido ??= `${rot} em ${toISO(hoje)}: ${r.from} > ${r.to}`;
    }
    if (por["Hoje"].from !== toISO(hoje) || por["Hoje"].to !== toISO(hoje)) hojeErrado ??= toISO(hoje);
    if (por["Últimos 7 dias"].from !== toISO(somaDias(hoje, -6))) seteErrado ??= toISO(hoje);

    /* 🔑 A RELAÇÃO: "Mês passado" termina no dia anterior ao início de "Este
       mês". As duas janelas encostam e não se sobrepõem — se uma delas
       escorregasse, um dia sumiria ou seria contado duas vezes. */
    if (toISO(somaDias(fromISO(por["Mês passado"].to), 1)) !== por["Este mês"].from) {
      naoEncosta ??= `${toISO(hoje)}: ${por["Mês passado"].to} + 1 ≠ ${por["Este mês"].from}`;
    }

    if (hoje.getDate() === 1) primeiros++;
    if (hoje.getMonth() === 1) fevereiros++;
  }

  ok("linha de base: o fuzz caiu no dia 1º " + primeiros + " vezes", primeiros > 5);
  ok("linha de base: e em fevereiro " + fevereiros + " vezes", fevereiros > 20);

  ok("nenhum atalho sai invertido (`from > to`)", invertido === null, invertido ?? "");
  ok("`Hoje` é sempre um dia só, e é hoje", hojeErrado === null, hojeErrado ?? "");
  ok("`Últimos 7 dias` inclui hoje e mais 6", seteErrado === null, seteErrado ?? "");
  ok(
    "🔑 `Mês passado` ENCOSTA em `Este mês`, sem vão nem sobreposição",
    naoEncosta === null,
    naoEncosta ?? "vale nos 400 `hoje`, inclusive no dia 1º",
  );

  /* Os casos nomeados que o fuzz não garante visitar. */
  const em1 = Object.fromEntries(atalhosDePeriodo(new Date(2026, 2, 1)).map((a) => [a.label, a.range()]));
  ok("no dia 1º, `Este mês` é um dia só", em1["Este mês"].from === em1["Este mês"].to);
  ok("…e `Ontem` cai no mês anterior", em1["Ontem"].from === "2026-02-28", em1["Ontem"].from);
  const emMarco = Object.fromEntries(atalhosDePeriodo(new Date(2024, 2, 15)).map((a) => [a.label, a.range()]));
  ok(
    "`Mês passado` em março de ANO BISSEXTO termina em 29",
    emMarco["Mês passado"].to === "2024-02-29",
    emMarco["Mês passado"].to,
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · `gradeDoMes` — um mês inteiro, e só ele
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · a grade do mês");

  let quebrou = null;
  let mesErrado = null;
  let ordemErrada = null;
  let meses = 0;
  let comprimentos = new Set();

  for (let ano = 2024; ano <= 2027; ano++) {
    for (let mes = 0; mes < 12; mes++) {
      meses++;
      const g = gradeDoMes(ano, mes);
      const dias = g.filter(Boolean);
      const nulos = g.length - dias.length;
      const noMes = new Date(ano, mes + 1, 0).getDate();

      if (dias.length !== noMes) quebrou ??= `${ano}-${mes + 1}: ${dias.length} ≠ ${noMes}`;
      if (nulos !== new Date(ano, mes, 1).getDay()) quebrou ??= `${ano}-${mes + 1}: nulos ${nulos}`;
      if (dias.some((d) => d.getMonth() !== mes || d.getFullYear() !== ano)) mesErrado ??= `${ano}-${mes + 1}`;
      if (dias.some((d, i) => i > 0 && d.getDate() !== dias[i - 1].getDate() + 1)) ordemErrada ??= `${ano}-${mes + 1}`;
      if (g.slice(nulos).some((c) => c === null)) quebrou ??= `${ano}-${mes + 1}: nulo no meio`;
      comprimentos.add(g.length);
    }
  }

  ok("linha de base: " + meses + " meses examinados", meses === 48);
  ok(
    "linha de base: os meses têm comprimentos DIFERENTES",
    comprimentos.size > 1,
    [...comprimentos].sort((a, b) => a - b).join(", ") + " células",
  );
  ok("cada grade tem os dias do mês e os nulos do 1º", quebrou === null, quebrou ?? "");
  ok("nenhuma célula é de outro mês", mesErrado === null, mesErrado ?? "");
  ok("e os dias vêm em sequência", ordemErrada === null, ordemErrada ?? "");

  ok("fevereiro de 2024 tem 29 dias", gradeDoMes(2024, 1).filter(Boolean).length === 29);
  ok("e o de 2026 tem 28", gradeDoMes(2026, 1).filter(Boolean).length === 28);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 5 · `hojeNoFuso` — o "hoje" do CALENDÁRIO é o do usuário, não o do navegador
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n5 · hojeNoFuso");

  ok("devolve meia-noite LOCAL", hojeNoFuso().getHours() === 0 && hojeNoFuso().getMinutes() === 0);
  ok("e `toISO` dele é uma data válida", /^\d{4}-\d{2}-\d{2}$/.test(toISO(hojeNoFuso())));

  /* A relação que importa: fusos com offsets muito distantes podem estar em
     DIAS diferentes, e a função tem de respeitar isso — é a razão de ela
     existir (o usuário em Lisboa filtrando conta de Brasília). */
  const chaves = new Set(["Pacific/Kiritimati", "Pacific/Midway", "UTC"].map((tz) => toISO(hojeNoFuso(tz))));
  ok(
    "fusos nos extremos podem estar em dias diferentes",
    chaves.size >= 2,
    [...chaves].join(" · ") + " — se fosse 1, a função ignoraria o `tz`",
  );
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: 400 `hoje` no fuzz · 48 meses na grade · 3 fusos forçados\n");
}
