/**
 * OS QUATRO DE FUSO SEM ASSERÇÃO — `partsInTz` · `startOfDayInTz` ·
 * `addDaysToKey` · `daysBetweenKeys`.
 *
 * Achados pela varredura das puras sem teste: são os quatro exports de
 * `lib/timezone.ts` que **nenhum `teste-*.mjs` cita**. `zonedToUtc`, `dayStart`
 * e `dayEnd` já têm (`test:nucleo-critico`); `tzOffsetMs`, `hourInTz`,
 * `dayKeyInTz`, `weekdayDaChave`, `dayKeyRange` e `fusosDiscordam` também.
 *
 * A regra que os governa é a mais repetida desta base: **nenhuma agregação usa
 * o dia do PROCESSO**. Na Vercel o processo é `TZ=UTC`; nesta máquina é São
 * Paulo. Um defeito de fuso é mudo exatamente no ambiente em que se trabalha.
 *
 * ### 🔑 O QUE ESTA RODADA FAZ DE DIFERENTE — e é o ponto do arquivo
 *
 * O `07` registra que na rodada anterior o plantio "dia do processo" **divergiu
 * 0h**, porque esta máquina está em São Paulo, e que a divergência ficou como
 * **linha impressa, não asserção**.
 *
 * ⛔ Aqui ela vira asserção, e sem depender da máquina: os plantios rodam em
 * **processo filho com `TZ` forçado**. O `TZ` deixa de ser propriedade da
 * estação e passa a ser entrada do teste.
 *
 * ### 🔴 E A MEDIÇÃO ACHOU ALGO QUE NÃO ESTAVA ESCRITO
 *
 * Os dois plantios de "dia do processo" são mudos em ambientes **opostos**:
 *
 * | plantio | mudo em | quebra em |
 * |---|---|---|
 * | `setHours(0,0,0,0)` no lugar de `startOfDayInTz` | `TZ=America/Sao_Paulo` (o dev) | `TZ=UTC` (a Vercel) |
 * | `new Date(chave)` + `setDate` local | `TZ=UTC` (a Vercel) | `TZ=America/Sao_Paulo` (o dev) |
 *
 * ⚠️ Ou seja: *"rodei em dev e está certo"* e *"rodei em produção e está certo"*
 * são as duas metades de uma verificação, e **nenhuma sozinha vale**. Não existe
 * um ambiente seguro em que conferir fuso.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const {
  partsInTz,
  startOfDayInTz,
  addDaysToKey,
  daysBetweenKeys,
  dayKeyInTz,
  zonedToUtc,
  DEFAULT_TIMEZONE,
} = await import("@/lib/timezone");

/* ═══════════════════════════════════════════════════════════════════════
 * MODO FILHO — o mesmo arquivo, reinvocado com `TZ` forçado.
 *
 * ⛔ É o próprio arquivo em vez de um `.mjs` auxiliar de propósito: um segundo
 * arquivo é mais uma coisa que pode sair do agregado, e a família *"teste que
 * existe e nunca rodou"* já mordeu duas vezes nesta base.
 * ═════════════════════════════════════════════════════════════════════ */
if (process.env.__FUSO_FILHO) {
  const INSTANTE = new Date("2026-08-14T02:00:00.000Z"); // 23h de 13/08 em SP

  /* PLANTIO 1 — "meia-noite é `setHours(0,0,0,0)`". O dia do PROCESSO. */
  const plantioInicioDoDia = (d) => {
    const x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    return x;
  };

  /* PLANTIO 2 — "é só somar dia num `Date`". `new Date(chave)` é UTC, e
     `setDate`/`getDate` são LOCAIS: os dois lados escorregam pelo offset. */
  const plantioSomaDias = (chave, n) => {
    const d = new Date(chave);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  process.stdout.write(
    JSON.stringify({
      tz: process.env.TZ,
      offsetDoProcesso: -new Date().getTimezoneOffset() / 60,

      inicioReal: startOfDayInTz(INSTANTE, DEFAULT_TIMEZONE).toISOString(),
      inicioPlantio: plantioInicioDoDia(INSTANTE).toISOString(),
      diaReal: dayKeyInTz(startOfDayInTz(INSTANTE, DEFAULT_TIMEZONE), DEFAULT_TIMEZONE),
      diaPlantio: dayKeyInTz(plantioInicioDoDia(INSTANTE), DEFAULT_TIMEZONE),

      somaReal: addDaysToKey("2026-08-14", 1),
      somaPlantio: plantioSomaDias("2026-08-14", 1),
      viradaReal: addDaysToKey("2026-08-31", 1),
      viradaPlantio: plantioSomaDias("2026-08-31", 1),

      /* As funções de verdade não podem depender do `TZ` do processo — este é
         o valor que o pai compara entre os dois filhos. */
      canonico: [
        startOfDayInTz(INSTANTE, DEFAULT_TIMEZONE).toISOString(),
        addDaysToKey("2026-02-28", 1),
        addDaysToKey("2024-02-28", 1),
        String(daysBetweenKeys("2026-01-01", "2027-01-01")),
        JSON.stringify(partsInTz(INSTANTE, DEFAULT_TIMEZONE)),
        JSON.stringify(partsInTz(INSTANTE, "UTC")),
      ].join("|"),
    }),
  );
  /* ⛔ SEM `process.exit()`. No Windows, sair com stdout em PIPE e escrita
     pendente aborta o processo com `3221226505` (STACK_BUFFER_OVERRUN): o pai
     recebe o JSON **e** uma excecao junto. E o defeito e INTERMITENTE — passou
     isolado e derrubou o `npm test` completo.

     O `else` resolve por estrutura: o filho escreve e o modulo acaba sozinho,
     drenando o stdout. Protecao por ESTRUTURA, nao por timing.
     ⚠️ `write` com callback tambem nao serve — ele nao interrompe nada, e o
     resto do arquivo roda por cima do JSON. */
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
        env: { ...process.env, TZ: tz, __FUSO_FILHO: "1" },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );

  /* ═══════════════════════════════════════════════════════════════════════
   * 0 · LINHA DE BASE — o `TZ` forçado CHEGA no filho
   *
   * ⛔ Sem isto, um `TZ` ignorado faria os dois filhos serem o mesmo processo e
   * TODA comparação abaixo passaria por não ter o que divergir. É a asserção que
   * prova que o instrumento mediu o alvo.
   * ═════════════════════════════════════════════════════════════════════ */
  const emUtc = comTz("UTC");
  const emSp = comTz("America/Sao_Paulo");
  {
    console.log("\n0 · linha de base — o TZ forçado chega no filho");

    ok("o filho em UTC tem offset 0", emUtc.offsetDoProcesso === 0, "offset " + emUtc.offsetDoProcesso);
    ok("o filho em São Paulo tem offset −3", emSp.offsetDoProcesso === -3, "offset " + emSp.offsetDoProcesso);
    ok("os dois processos são de fato DIFERENTES", emUtc.offsetDoProcesso !== emSp.offsetDoProcesso);
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 1 · A PROPRIEDADE CENTRAL — as funções de verdade IGNORAM o `TZ` do processo
   *
   * Esta é a relação, e ela não conhece nenhum valor: seja qual for o `TZ` em que
   * o processo nasceu, as seis derivações têm de sair idênticas.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    console.log("\n1 · as funções não dependem do TZ do processo");

    ok(
      "as 6 derivações saem IDÊNTICAS em UTC e em São Paulo",
      emUtc.canonico === emSp.canonico,
      "\n      UTC: " + emUtc.canonico + "\n      SP : " + emSp.canonico,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 2 · PLANTIO 1 — `setHours(0,0,0,0)` no lugar de `startOfDayInTz`
   *
   * É o conserto mais plausível que existe: *"meia-noite é `setHours(0,0,0,0)`"*.
   * Ele é MUDO em desenvolvimento e erra um DIA INTEIRO na Vercel.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    console.log("\n2 · plantio 1 — o dia do PROCESSO no início do dia");

    ok(
      "PLANTIO 1 é MUDO em `TZ=America/Sao_Paulo` — o dev não denuncia",
      emSp.inicioPlantio === emSp.inicioReal,
      emSp.inicioReal,
    );
    ok(
      "PLANTIO 1 erra em `TZ=UTC` — que é a Vercel",
      emUtc.inicioPlantio !== emUtc.inicioReal,
      "real " + emUtc.inicioReal + " × plantio " + emUtc.inicioPlantio,
    );
    /* ⚠️ A primeira versão desta asserção afirmava "o erro é de um DIA INTEIRO" e
       comparava as duas chaves de dia. Ela REPROVOU: lidas no fuso do usuário, as
       duas fronteiras caem no mesmo 13/08. O erro não é o rótulo do bucket — é
       ONDE a fronteira dele foi posta, e é isso que se mede. */
    {
      const deslocamento = Math.abs(
        new Date(emUtc.inicioPlantio).getTime() - new Date(emUtc.inicioReal).getTime(),
      );
      ok(
        "a fronteira do bucket se desloca " + deslocamento / 3.6e6 + "h",
        deslocamento >= 12 * 3.6e6,
        "todo evento nessa janela é atribuído ao dia errado",
      );
    }

    /* ── PAR NEGATIVO, e é o que dá o tamanho do risco: o instante escolhido é
       23h em São Paulo. Para um instante do MEIO do dia as duas versões
       concordam em qualquer TZ — só as últimas horas do dia divergem, que é a
       janela exata que o `CLAUDE.md` descreve ("um teste que falha só depois das
       21h é pior que um que falha sempre"). */
    const meioDoDia = new Date("2026-08-14T15:00:00.000Z");
    const plantioAqui = (d) => { const x = new Date(d.getTime()); x.setHours(0, 0, 0, 0); return x; };
    ok(
      "PAR NEGATIVO: no MEIO do dia as duas versões concordam nesta máquina",
      plantioAqui(meioDoDia).getTime() === startOfDayInTz(meioDoDia, DEFAULT_TIMEZONE).getTime(),
      "a divergência mora só nas horas que atravessam a fronteira do dia",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 3 · PLANTIO 2 — e ele é mudo no ambiente CONTRÁRIO
   *
   * 🔴 É o achado desta rodada. `new Date("2026-08-14")` é meia-noite **UTC**, e
   * `getDate`/`setDate` são **locais**. Em `TZ=UTC` os dois lados coincidem e o
   * plantio acerta; em qualquer offset negativo ele erra um dia — sempre.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    console.log("\n3 · plantio 2 — soma de dias por `Date` local");

    ok(
      "PLANTIO 2 é MUDO em `TZ=UTC` — a Vercel não denuncia",
      emUtc.somaPlantio === emUtc.somaReal && emUtc.viradaPlantio === emUtc.viradaReal,
      emUtc.somaReal + " · " + emUtc.viradaReal,
    );
    ok(
      "PLANTIO 2 erra em `TZ=America/Sao_Paulo` — que é esta máquina",
      emSp.somaPlantio !== emSp.somaReal,
      "real " + emSp.somaReal + " × plantio " + emSp.somaPlantio,
    );
    ok(
      "e erra também na virada de mês",
      emSp.viradaPlantio !== emSp.viradaReal,
      "real " + emSp.viradaReal + " × plantio " + emSp.viradaPlantio,
    );

    console.log(
      "\n   \x1b[33m⚠️  Os dois plantios são mudos em ambientes OPOSTOS." +
        "\n      'rodei em dev e está certo' e 'rodei em produção e está certo' são" +
        "\n      metades de uma verificação. Nenhuma sozinha vale.\x1b[0m",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 4 · `addDaysToKey` ↔ `daysBetweenKeys` — o par INVERSO
   *
   * Nenhuma asserção conhece uma data de chegada: o que se congela é que uma
   * desfaz a outra. Um teste que congelasse valores passaria com as duas erradas
   * pelo mesmo fator, que é o estado em que esta base já esteve.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    console.log("\n4 · o par inverso");

    ok("somar zero não move", addDaysToKey("2026-08-14", 0) === "2026-08-14");
    ok("a distância de uma chave a ela mesma é 0", daysBetweenKeys("2026-08-14", "2026-08-14") === 0);
    ok("a distância é ORIENTADA (b − a)", daysBetweenKeys("2026-08-15", "2026-08-14") === -1);

    /* Fuzz de 300, semente FIXA. */
    let semente = 7;
    const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const BASES = ["2026-08-14", "2026-02-28", "2024-02-28", "2025-12-31", "2026-01-01", "2019-11-03", "2026-03-01"];

    let quebrouIda = null;
    let quebrouVolta = null;
    let atravessaramMes = 0;
    let atravessaramAno = 0;

    for (let i = 0; i < 300; i++) {
      const base = BASES[Math.floor(rnd() * BASES.length)];
      const n = Math.floor(rnd() * 1400) - 700;
      const chegada = addDaysToKey(base, n);

      if (daysBetweenKeys(base, chegada) !== n) quebrouIda ??= `${base} +${n} -> ${chegada}`;
      if (addDaysToKey(chegada, -n) !== base) quebrouVolta ??= `${base} +${n} -> ${chegada}`;
      if (chegada.slice(0, 7) !== base.slice(0, 7)) atravessaramMes++;
      if (chegada.slice(0, 4) !== base.slice(0, 4)) atravessaramAno++;

      /* A chave produzida é sempre bem formada — um `NaN` no meio viraria
         "NaN-NaN-NaN" e o `<=` do `dayKeyRange` compararia string com lixo. */
      if (!/^\d{4}-\d{2}-\d{2}$/.test(chegada)) quebrouIda ??= "chave malformada: " + chegada;
    }

    /* ⛔ LINHA DE BASE do fuzz: sem ela, um gerador que só produzisse `n = 0`
       satisfaria as duas inversas sem exercer virada de mês nenhuma. */
    ok("linha de base: o fuzz atravessou mês", atravessaramMes > 100, atravessaramMes + " de 300");
    ok("linha de base: e atravessou ano", atravessaramAno > 50, atravessaramAno + " de 300");

    ok("fuzz 300 (semente 7): `daysBetweenKeys` desfaz `addDaysToKey`", quebrouIda === null, quebrouIda ?? "");
    ok("fuzz 300: somar −n volta à chave original", quebrouVolta === null, quebrouVolta ?? "");

    /* Os casos de calendário que ninguém escreve à mão, nomeados. */
    ok("29 de fevereiro existe em ano bissexto", addDaysToKey("2024-02-28", 1) === "2024-02-29");
    ok("e NÃO existe fora dele", addDaysToKey("2026-02-28", 1) === "2026-03-01");
    ok("a virada de ano funciona", addDaysToKey("2025-12-31", 1) === "2026-01-01");
    ok("ano bissexto tem 366 dias", daysBetweenKeys("2024-01-01", "2025-01-01") === 366);
    ok("ano comum tem 365", daysBetweenKeys("2026-01-01", "2027-01-01") === 365);
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 5 · `startOfDayInTz` — ele NUNCA atravessa a fronteira do dia
   *
   * É a propriedade que importa, e ela não conhece nenhum instante: a meia-noite
   * do dia em que `d` caiu tem de pertencer ao MESMO dia que `d`, no mesmo fuso.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    console.log("\n5 · startOfDayInTz");

    const FUSOS = ["UTC", "America/Sao_Paulo", "Asia/Tokyo", "Pacific/Auckland", "America/Los_Angeles"];

    let semente = 7;
    const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

    let mudouDeDia = null;
    let naoIdempotente = null;
    let naoEhMeiaNoite = null;
    const diasVistos = new Set();

    for (let i = 0; i < 300; i++) {
      const d = new Date(Date.UTC(2024, 0, 1) + Math.floor(rnd() * 1100) * 864e5 + Math.floor(rnd() * 864e5));
      const tz = FUSOS[Math.floor(rnd() * FUSOS.length)];

      const inicio = startOfDayInTz(d, tz);
      diasVistos.add(dayKeyInTz(d, tz));

      if (dayKeyInTz(inicio, tz) !== dayKeyInTz(d, tz)) mudouDeDia ??= `${d.toISOString()} @ ${tz}`;
      if (startOfDayInTz(inicio, tz).getTime() !== inicio.getTime()) naoIdempotente ??= `${d.toISOString()} @ ${tz}`;

      const p = partsInTz(inicio, tz);
      if (p.hour !== 0 || p.minute !== 0 || p.second !== 0) naoEhMeiaNoite ??= `${d.toISOString()} @ ${tz} -> ${p.hour}:${p.minute}:${p.second}`;

      /* Nunca vai para o FUTURO de `d`: o início do dia é anterior ou igual. */
      if (inicio.getTime() > d.getTime()) mudouDeDia ??= "início no futuro: " + d.toISOString();
    }

    ok("linha de base: o fuzz cobriu " + diasVistos.size + " dias distintos", diasVistos.size > 100);
    ok("fuzz 300 × 5 fusos: nunca muda de dia", mudouDeDia === null, mudouDeDia ?? "");
    ok("é idempotente", naoIdempotente === null, naoIdempotente ?? "");
    ok("e cai em 00:00:00 no fuso pedido", naoEhMeiaNoite === null, naoEhMeiaNoite ?? "");
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 6 · `partsInTz` — o RELÓGIO DE PAREDE, e a armadilha do `24`
   *
   * ⚠️ O `hourCycle: "h23"` do formatador não é preferência de estilo: com
   * `hour12: false` o `Intl` devolve **`24`** à meia-noite em várias plataformas.
   * Um `24` atravessando `hourInTz` viraria uma 25ª coluna no heatmap, e o
   * comentário que registra isso não tinha asserção.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    console.log("\n6 · partsInTz");

    const INSTANTE = new Date("2026-08-14T02:00:00.000Z");

    const utc = partsInTz(INSTANTE, "UTC");
    const sp = partsInTz(INSTANTE, "America/Sao_Paulo");

    ok("em UTC o relógio marca 02h de 14/08", utc.hour === 2 && utc.day === 14 && utc.month === 8);
    ok("em São Paulo o MESMO instante é 23h de 13/08", sp.hour === 23 && sp.day === 13, JSON.stringify(sp));
    ok("ou seja: o dia do calendário DIFERE entre os dois fusos", utc.day !== sp.day);

    /* ── A armadilha do 24: meia-noite exata, nos cinco fusos. */
    const FUSOS = ["UTC", "America/Sao_Paulo", "Asia/Tokyo", "Pacific/Auckland", "America/Los_Angeles"];
    const vinteQuatro = FUSOS.filter((tz) => partsInTz(startOfDayInTz(INSTANTE, tz), tz).hour === 24);
    ok(
      "meia-noite é hora 0 nos " + FUSOS.length + " fusos, nunca 24",
      vinteQuatro.length === 0,
      vinteQuatro.join(", ") || "o `hourCycle: h23` do formatador está fazendo efeito",
    );
    /* ⛔ E AQUI A ASSERÇÃO DE VALOR NÃO DISTINGUE — medido, não suposto.
       Plantei `hour12: false` no lugar do `hourCycle: "h23"` e rodei: **a
       asserção acima continuou passando**. Nesta versão do Node/ICU o `hour12:
       false` também devolve `0` à meia-noite. O `24` é comportamento de OUTRAS
       plataformas, e o comentário do módulo o registra como tal.

       Então quem protege é a guarda ESTRUTURAL: a asserção de valor passa nos
       dois estados desta máquina, e uma asserção que não pode falhar pelo motivo
       que alega medir não mede nada. A de texto pode — e foi ela que reprovou no
       plantio. */
    ok(
      "GUARDA ESTRUTURAL: o `hourCycle: h23` está declarado no módulo",
      /hourCycle:\s*"h23"/.test(
        (await import("node:fs")).readFileSync("src/lib/timezone.ts", "utf8"),
      ),
      "é ELA que segura — a asserção de valor acima não distingue nesta ICU",
    );

    /* ── IDA E VOLTA: decompor e recompor devolve o mesmo instante. É a relação
       que liga `partsInTz` ao `zonedToUtc`, e ela vale em qualquer fuso. */
    {
      let semente = 7;
      const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      let quebrou = null;
      let n2 = 0;
      for (let i = 0; i < 200; i++) {
        const tz = FUSOS[Math.floor(rnd() * FUSOS.length)];
        /* Segundos inteiros: `partsInTz` não carrega ms, e exigir ms aqui mediria
           a precisão do formatador em vez da ida e volta. */
        const d = new Date(Math.floor((Date.UTC(2024, 0, 1) + Math.floor(rnd() * 1100) * 864e5 + Math.floor(rnd() * 864e5)) / 1000) * 1000);
        const p = partsInTz(d, tz);
        const volta = zonedToUtc(p.year, p.month, p.day, p.hour, p.minute, p.second, 0, tz);
        n2++;
        if (volta.getTime() !== d.getTime()) quebrou ??= `${d.toISOString()} @ ${tz} -> ${volta.toISOString()}`;
      }
      ok("linha de base: a ida e volta foi exercida " + n2 + " vezes", n2 === 200);
      ok(
        "fuzz 200 × 5 fusos: decompor e recompor devolve o mesmo instante",
        quebrou === null,
        quebrou ?? "",
      );
    }
  }

  console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");

}
