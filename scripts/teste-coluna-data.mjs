/**
 * `dateColumnKey` / `keyToDateColumn` — A PONTE ENTRE UM DIA DE CALENDÁRIO E UM
 * INSTANTE, e ela decide em que dia o GASTO DE ANÚNCIO cai.
 *
 * `DailyAdMetric.date` é `@db.Date`: um dia de calendário, gravado como
 * meia-noite **UTC** (a Meta manda `"2026-07-25"` e o Prisma trunca a hora).
 * **Ele não é um instante** — e o módulo escreve isso:
 *
 * > a meia-noite UTC do dia 25 é anterior à meia-noite de Brasília do dia 25, e
 * > a linha cairia no bucket do dia 24. Métrica diária se compara por chave de
 * > dia, nunca por `getTime()`.
 *
 * ### 🔴 SETE CONSUMIDORES, E UM DELES AGE SOZINHO
 *
 * `dashboard/metrics.ts` (o painel), `ads/overview.ts` (o Gerenciador),
 * `ads/creatives.ts` — e **`rules/engine.ts`**, que pausa campanha e altera
 * orçamento com dinheiro real. Se a janela escorregar um dia, a regra decide
 * sobre o gasto errado.
 *
 * Zero asserções até 14/08/2026.
 *
 * ### 🔑 O QUE SE CONGELA
 *
 *   1. **par inverso**  `dateColumnKey(keyToDateColumn(k)) === k`
 *   2. **meia-noite UTC** — é a forma em que a coluna existe
 *   3. **independência do `TZ` do processo**, medida em processo filho
 *
 * ### ⚠️ E O DEFEITO É INVISÍVEL PARA METADE DO MUNDO
 *
 * Passar a coluna pelo fuso do usuário (`dayKeyInTz`) devolve o dia ANTERIOR a
 * oeste de Greenwich — e o dia CERTO a leste. Quem programasse em Tóquio nunca
 * veria. A §3 mede os dois lados.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const { dateColumnKey, keyToDateColumn, dayKeyInTz, addDaysToKey, daysBetweenKeys } =
  await import("@/lib/timezone");

/* ═══════════════════════════════════════════════════════════════════════
 * MODO FILHO — o mesmo arquivo, reinvocado com `TZ` forçado.
 * ⛔ Arquivo único de propósito: um `.mjs` auxiliar é mais uma coisa que pode
 * sair do agregado, e a família *teste que existe e nunca rodou* já mordeu
 * duas vezes nesta base.
 * ═════════════════════════════════════════════════════════════════════ */
if (process.env.__COLUNA_FILHO) {
  const CHAVE = "2026-08-14";
  const col = keyToDateColumn(CHAVE);

  /* PLANTIO — `new Date(d.toDateString())`, que o comentário do `metrics.ts`
     nomeia: ele REINTERPRETA a data no fuso do PROCESSO. */
  const plantioColuna = (k) => new Date(new Date(k).toDateString());

  /* ⚠️ DUAS ARMADILHAS AQUI, e as duas custaram uma execução cada.
     · `write` seguido de `process.exit(0)` aborta a escrita pendente no
       Windows: o processo morre com `3221226505` (STACK_BUFFER_OVERRUN) e o
       pai recebe o JSON **e** uma exceção junto;
     · `write` com CALLBACK não interrompe nada — o resto do arquivo continua
       rodando de imediato, e a suíte inteira do filho vai para o `stdout` por
       cima do JSON.
     A forma que serve é `await` na escrita e só então o `exit`. */
  await new Promise((r) =>
    process.stdout.write(
        JSON.stringify({
        tz: process.env.TZ,
        offsetDoProcesso: -new Date().getTimezoneOffset() / 60,
        colunaISO: col.toISOString(),
        voltaReal: dateColumnKey(col),
        plantioISO: plantioColuna(CHAVE).toISOString(),
        /* As duas derivações canônicas, para o pai comparar entre os filhos. */
        canonico: [
          keyToDateColumn("2026-01-01").toISOString(),
          keyToDateColumn("2024-02-29").toISOString(),
          dateColumnKey(new Date("2026-12-31T00:00:00.000Z")),
          dateColumnKey(new Date("2026-12-31T23:59:59.999Z")),
        ].join("|"),
      }),
      r,
    ),
  );
  process.exit(0);
}

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
      env: { ...process.env, TZ: tz, __COLUNA_FILHO: "1" },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — a coluna é meia-noite UTC, que é como ela existe
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n0 · a forma da coluna");

  const col = keyToDateColumn("2026-08-14");
  ok("é meia-noite exata", col.getUTCHours() === 0 && col.getUTCMinutes() === 0 && col.getUTCSeconds() === 0);
  ok("e em UTC", col.toISOString() === "2026-08-14T00:00:00.000Z", col.toISOString());
  ok("a chave volta idêntica", dateColumnKey(col) === "2026-08-14");
  ok("e a chave sai bem formada", /^\d{4}-\d{2}-\d{2}$/.test(dateColumnKey(col)));
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · O PAR INVERSO — sob fuzz, com linha de base dos dois lados
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · o par inverso");

  let semente = 7;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  let quebrouIda = null;
  let quebrouVolta = null;
  let naoEhMeiaNoite = null;
  let anos = new Set();
  let bissextos = 0;

  for (let i = 0; i < 400; i++) {
    const k = addDaysToKey("2024-01-01", Math.floor(rnd() * 1200));
    const col = keyToDateColumn(k);

    if (dateColumnKey(col) !== k) quebrouIda ??= `${k} -> ${col.toISOString()} -> ${dateColumnKey(col)}`;
    if (col.getUTCHours() !== 0 || col.getUTCMilliseconds() !== 0) naoEhMeiaNoite ??= k;
    /* E a volta pela outra ponta: um instante qualquer do dia UTC devolve a
       mesma chave, porque `dateColumnKey` só lê os componentes de data. */
    const meioDoDia = new Date(col.getTime() + Math.floor(rnd() * 864e5));
    if (dateColumnKey(meioDoDia) !== k) quebrouVolta ??= `${k} + ${meioDoDia.toISOString()}`;

    anos.add(k.slice(0, 4));
    if (k.endsWith("-02-29")) bissextos++;
  }

  ok("linha de base: o fuzz cobriu " + anos.size + " anos", anos.size >= 3, [...anos].join(", "));

  /* ⚠️ 29 de fevereiro NÃO é linha de base do fuzz, e a primeira versão deste
     arquivo tentou fazê-lo ser: com 400 amostras em 1.200 dias, ele saiu 0
     vezes com a semente 7. Um dia único em 1.200 não é caso para amostragem —
     é caso NOMEADO, e a regra desta base já diz que aleatório não substitui o
     caso nomeado. Ele está logo abaixo, como asserção própria. */
  ok(
    "29 de fevereiro tem coluna própria, e ela volta",
    dateColumnKey(keyToDateColumn("2024-02-29")) === "2024-02-29",
    "bissextos vistos no fuzz: " + bissextos + " — por isso ele é caso nomeado",
  );
  ok(
    "…e o dia seguinte é 1º de março",
    dateColumnKey(new Date(keyToDateColumn("2024-02-29").getTime() + 864e5)) === "2024-03-01",
  );

  ok("fuzz 400 (semente 7): chave → coluna → chave devolve a mesma", quebrouIda === null, quebrouIda ?? "");
  ok("toda coluna é meia-noite UTC", naoEhMeiaNoite === null, naoEhMeiaNoite ?? "");
  ok(
    "qualquer instante DO MESMO DIA UTC devolve a mesma chave",
    quebrouVolta === null,
    quebrouVolta ?? "a coluna é um dia, não um instante",
  );

  /* Os extremos do dia UTC, nomeados. */
  ok("00:00:00.000Z é o dia", dateColumnKey(new Date("2026-12-31T00:00:00.000Z")) === "2026-12-31");
  ok("23:59:59.999Z ainda é o MESMO dia", dateColumnKey(new Date("2026-12-31T23:59:59.999Z")) === "2026-12-31");
  ok("e 00:00:00.000Z do seguinte já é outro", dateColumnKey(new Date("2027-01-01T00:00:00.000Z")) === "2027-01-01");

  /* Coerência com a aritmética de chave: um dia de coluna a mais é um dia de
     calendário a mais. Sem isso, `dayKeyRange` e o `where` discordariam. */
  const a = keyToDateColumn("2026-02-28");
  const b = keyToDateColumn(addDaysToKey("2026-02-28", 1));
  ok(
    "um dia de calendário = 864e5 ms na coluna",
    b.getTime() - a.getTime() === 864e5,
    "e 2026 não é bissexto, então o seguinte é 01/03",
  );
  ok("…inclusive atravessando fevereiro", dateColumnKey(b) === "2026-03-01");
  ok(
    "a distância em chave bate com a distância em coluna",
    daysBetweenKeys("2026-01-01", "2027-01-01") ===
      (keyToDateColumn("2027-01-01").getTime() - keyToDateColumn("2026-01-01").getTime()) / 864e5,
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · O `TZ` DO PROCESSO NÃO ENTRA — medido em processo filho
 *
 * ⛔ A linha de base prova que o `TZ` forçado CHEGA. Sem ela, um `TZ` ignorado
 * faria os dois filhos serem o mesmo processo e a comparação passaria por não
 * ter o que divergir.
 * ═════════════════════════════════════════════════════════════════════ */
const emUtc = comTz("UTC");
const emSp = comTz("America/Sao_Paulo");
const emTokyo = comTz("Asia/Tokyo");
{
  console.log("\n2 · o TZ do processo não entra");

  ok("linha de base: UTC tem offset 0", emUtc.offsetDoProcesso === 0);
  ok("linha de base: São Paulo tem −3", emSp.offsetDoProcesso === -3);
  ok("linha de base: Tóquio tem +9", emTokyo.offsetDoProcesso === 9);

  ok(
    "as derivações saem IDÊNTICAS nos três fusos",
    emUtc.canonico === emSp.canonico && emSp.canonico === emTokyo.canonico,
    emUtc.canonico,
  );
  ok(
    "e a ida e volta também",
    emUtc.voltaReal === "2026-08-14" && emSp.voltaReal === "2026-08-14" && emTokyo.voltaReal === "2026-08-14",
  );

  /* ── PLANTIO: `new Date(k).toDateString()` — o que o comentário do
     `metrics.ts` nomeia como a versão que a janela tinha antes. */
  ok(
    "PLANTIO: `toDateString()` é MUDO em `TZ=UTC` — a Vercel não denuncia",
    emUtc.plantioISO === emUtc.colunaISO,
    emUtc.colunaISO,
  );
  ok(
    "PLANTIO: e erra em `TZ=America/Sao_Paulo`",
    emSp.plantioISO !== emSp.colunaISO,
    "real " + emSp.colunaISO + " × plantio " + emSp.plantioISO,
  );
  ok(
    "PLANTIO: erra também em Tóquio, para o outro lado",
    emTokyo.plantioISO !== emTokyo.colunaISO,
    "real " + emTokyo.colunaISO + " × plantio " + emTokyo.plantioISO,
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · 🔴 O DEFEITO NOMEADO — passar a coluna pelo FUSO DO USUÁRIO
 *
 * É o erro que os dois consumidores documentam, e o mais fácil de cometer:
 * `dayKeyInTz` é a função certa para VENDA (que tem instante) e a errada para
 * a coluna (que é um dia de calendário).
 *
 * ⚠️ **E ele é invisível para metade do mundo.** A oeste de Greenwich a chave
 * cai um dia para trás; a leste, ela acerta. Este é o par negativo, e ele é
 * geográfico em vez de temporal.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · 🔴 o defeito: a coluna passada pelo fuso do usuário");

  const CHAVE = "2026-08-14";
  const col = keyToDateColumn(CHAVE);

  ok("o certo devolve o dia da coluna", dateColumnKey(col) === CHAVE);

  /* A oeste: erra. */
  const OESTE = ["America/Sao_Paulo", "America/New_York", "America/Los_Angeles"];
  const erram = OESTE.filter((tz) => dayKeyInTz(col, tz) !== CHAVE);
  ok(
    "🔴 a OESTE de Greenwich, `dayKeyInTz` devolve o dia ANTERIOR",
    erram.length === OESTE.length,
    OESTE.map((tz) => tz.split("/")[1] + ": " + dayKeyInTz(col, tz)).join(" · "),
  );
  ok(
    "e o erro é de exatamente UM dia",
    OESTE.every((tz) => daysBetweenKeys(dayKeyInTz(col, tz), CHAVE) === 1),
    "todo gasto de anúncio cairia no bucket do dia anterior",
  );

  /* ── PAR NEGATIVO GEOGRÁFICO: a leste, a função errada ACERTA. */
  const LESTE = ["Asia/Tokyo", "Europe/Berlin", "Australia/Sydney"];
  const acertam = LESTE.filter((tz) => dayKeyInTz(col, tz) === CHAVE);
  ok(
    "PAR NEGATIVO: a LESTE, a função errada devolve o dia CERTO",
    acertam.length === LESTE.length,
    "quem programasse em Tóquio nunca veria o defeito",
  );
  ok(
    "…e em UTC também acerta",
    dayKeyInTz(col, "UTC") === CHAVE,
    "que é o fuso do processo na Vercel — o defeito não aparece nem lá",
  );

  /* 🔴 A consequência medida: um dia inteiro de gasto sai do período. */
  {
    const dias = ["2026-08-12", "2026-08-13", "2026-08-14"];
    const colunas = dias.map(keyToDateColumn);
    const certo = colunas.map((c) => dateColumnKey(c));
    const errado = colunas.map((c) => dayKeyInTz(c, "America/Sao_Paulo"));
    ok(
      "linha de base: as 3 colunas existem e são distintas",
      new Set(certo).size === 3,
      certo.join(", "),
    );
    ok(
      "🔴 com a função errada, a janela inteira desliza um dia",
      errado.every((k, i) => daysBetweenKeys(k, certo[i]) === 1),
      errado.join(", ") + "  ← o gasto do dia 14 seria somado no 13",
    );
  }
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: 3 fusos forçados em processo filho · 7 consumidores da coluna\n");
