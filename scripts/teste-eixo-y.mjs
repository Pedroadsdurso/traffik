/**
 * `intervalosDoEixoY` — QUANTOS TICKS, E QUANDO O EIXO NÃO EXISTE.
 *
 * Fonte única do eixo Y para `LineChart` e `SerieTemporal` desde o C3
 * (`36bccdc`, 13/08/2026). Dois consumidores de produção, zero asserções.
 *
 * ### 🔑 A PROPRIEDADE CENTRAL NÃO É UM NÚMERO DE TICKS — É QUE **1 NÃO EXISTE**
 *
 * O cabeçalho do módulo explica por quê, e é uma decisão de leitura, não de
 * economia:
 *
 *   > com um tick só não existe ESCALA — uma linha horizontal sozinha não
 *   > declara intervalo, e o gráfico passa a mostrar forma sem grandeza, que é
 *   > pior que não mostrar nada.
 *
 * Então a saída é **`0` (sem eixo) ou `>= 2`**, nunca `1`. É a distinção
 * central deste projeto na camada de geometria: ou há escala, ou se declara que
 * não há — o que não pode existir é a meia-escala que parece escala.
 *
 * ### ⛔ E OS LIMIARES SÃO DERIVADOS, NÃO LITERAIS
 *
 * `CH_MINIMO_EIXO === ALTURA_ROTULO * 2`, e o `07` registra que um literal ali
 * já custou caro: a §4 dizia **160**, e com esse valor os blocos
 * `vendas-por-dia` e `vendas-por-hora` ficavam **sem eixo no tamanho padrão do
 * catálogo** — ou seja, o limiar "conservador" reintroduzia o C3, que é o
 * defeito que o módulo existe para consertar. É o plantio B.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const {
  intervalosDoEixoY,
  escalaArredondada,
  CH_MINIMO_EIXO,
  ALTURA_ROTULO,
  ALTURA_POR_TICK,
} = await import("@/lib/grafico/eixo");

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — os dois desfechos são alcançáveis
 *
 * ⛔ Sem isto, uma implementação que devolvesse sempre `0` satisfaria "nunca
 * devolve 1" com nota máxima.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n0 · linha de base — os dois desfechos existem");

  ok("há caso SEM eixo", intervalosDoEixoY(10, 10) === 0);
  ok("há caso COM eixo", intervalosDoEixoY(300, 300) >= 2, "intervalos: " + intervalosDoEixoY(300, 300));
  ok(
    "e o limiar é DERIVADO, não um literal",
    CH_MINIMO_EIXO === ALTURA_ROTULO * 2,
    CH_MINIMO_EIXO + " = " + ALTURA_ROTULO + " × 2",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · O `1` NÃO EXISTE — sob fuzz, e é a propriedade central
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · a meia-escala não existe");

  let semente = 7;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  let deuUm = null;
  let naoInteiro = null;
  let negativo = null;
  let zeros = 0;
  let comEixo = 0;

  /* ⚠️ A distribuição é ENVIESADA para o pequeno de propósito. Com `ch`
     uniforme em 0–500, só ~6% das amostras caem abaixo do limiar de 32 — e a
     primeira versão deste fuzz reprovou na própria linha de base, com 27 de
     600. Baixar a barra teria escondido o defeito do GERADOR: é ele que não
     visitava o ramo, e a regra desta base é perguntar quais ramos o gerador
     nunca faz o código percorrer. */
  for (let i = 0; i < 600; i++) {
    const ch = rnd() < 0.4 ? rnd() * 60 : rnd() * 500;
    const plot = rnd() < 0.4 ? rnd() * 60 : rnd() * 500;
    const obr = rnd() < 0.5;
    const v = intervalosDoEixoY(ch, plot, obr);

    if (v === 1) deuUm ??= `ch ${ch.toFixed(1)} plot ${plot.toFixed(1)} obr ${obr}`;
    if (!Number.isInteger(v)) naoInteiro ??= `ch ${ch.toFixed(1)} -> ${v}`;
    if (v < 0) negativo ??= String(v);
    if (v === 0) zeros++;
    else comEixo++;
  }

  /* ⛔ LINHA DE BASE dos DOIS lados do fuzz. */
  ok("linha de base: o fuzz produziu casos SEM eixo", zeros > 30, zeros + " de 600");
  ok("linha de base: e casos COM eixo", comEixo > 300, comEixo + " de 600");

  ok("fuzz 600 (semente 7): NUNCA devolve 1", deuUm === null, deuUm ?? "");
  ok("o resultado é sempre inteiro", naoInteiro === null, naoInteiro ?? "");
  ok("e nunca negativo", negativo === null, negativo ?? "");

  /* ── PLANTIO A: tirar o `Math.max(2, …)` — "o floor já dá o número certo".
     Ele produz os DOIS estados proibidos: o `1` (meia-escala) e o `0` acima do
     limiar (o eixo some onde deveria existir). */
  {
    const plantio = (ch, altPlot, obr = false) => {
      if (ch < CH_MINIMO_EIXO) return obr ? 2 : 0;
      return Math.floor(altPlot / ALTURA_POR_TICK);
    };

    const proibidos = [];
    let s2 = 7;
    const r2 = () => ((s2 = (s2 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 600; i++) {
      const ch = r2() * 500;
      const plot = r2() * 500;
      const v = plantio(ch, plot);
      if (v === 1) proibidos.push("1 (meia-escala) em plot " + plot.toFixed(0));
      if (v === 0 && ch >= CH_MINIMO_EIXO) proibidos.push("0 acima do limiar, plot " + plot.toFixed(0));
    }
    ok(
      "PLANTIO A: produz os dois estados proibidos",
      proibidos.length > 0,
      proibidos.length + " ocorrências · ex.: " + proibidos[0],
    );
    ok("PLANTIO A: a asserção do `nunca 1` DERRUBA", proibidos.some((p) => p.startsWith("1 ")));

    /* ── PAR NEGATIVO: em plotagem larga — que é o caso comum e o que alguém
       olharia na tela — as duas versões CONCORDAM. O defeito mora só nos slots
       apertados, que é onde ninguém confere. */
    const largas = [200, 300, 400, 500];
    ok(
      "PAR NEGATIVO: em plotagem larga as duas versões concordam",
      largas.every((p) => plantio(400, p) === intervalosDoEixoY(400, p)),
      "por isso o defeito não apareceria numa conferência de tela",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · O LIMIAR — e o PLANTIO B é o `160` que o `07` apagou
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · o limiar de altura");

  ok("abaixo do limiar, sem eixo", intervalosDoEixoY(CH_MINIMO_EIXO - 1, 200) === 0);
  ok("exatamente no limiar, COM eixo", intervalosDoEixoY(CH_MINIMO_EIXO, 200) >= 2, "a fronteira é `<`, não `<=`");

  /**
   * O tamanho PADRÃO do catálogo, medido em 13/08/2026 e registrado no `07`:
   * card de 272px (3 células) com plotagem de **132px**. É o caso comum, e é
   * exatamente onde o `160` escondia o eixo.
   */
  const PLOT_PADRAO = 132;
  ok(
    "no tamanho PADRÃO do catálogo o eixo EXISTE",
    intervalosDoEixoY(PLOT_PADRAO, PLOT_PADRAO) >= 2,
    "plotagem de " + PLOT_PADRAO + "px -> " + intervalosDoEixoY(PLOT_PADRAO, PLOT_PADRAO) + " intervalos",
  );

  /* ── PLANTIO B: o limiar de 160 que a §4 do `07` afirmava. */
  {
    const plantio = (ch, altPlot, obr = false) => {
      if (ch < 160) return obr ? 2 : 0;
      return Math.max(2, Math.floor(altPlot / ALTURA_POR_TICK));
    };
    ok(
      "PLANTIO B (limiar 160): o eixo SOME no tamanho padrão",
      plantio(PLOT_PADRAO, PLOT_PADRAO) === 0,
      "que é o C3 de volta — 'lê como erro de renderização'",
    );
    ok("PLANTIO B: a asserção do tamanho padrão DERRUBA", plantio(PLOT_PADRAO, PLOT_PADRAO) !== intervalosDoEixoY(PLOT_PADRAO, PLOT_PADRAO));

    /* ⚠️ E o par negativo mostra por que o `160` parecia razoável: em cards
       grandes ele acerta. Um limiar errado não erra em todo lugar — erra no
       tamanho em que os blocos VIVEM. */
    ok(
      "PAR NEGATIVO: em card grande o limiar 160 acerta",
      plantio(400, 400) === intervalosDoEixoY(400, 400),
      "um limiar errado erra no tamanho comum, não em todos",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · MONOTONIA — mais espaço nunca dá MENOS eixo
 *
 * É a relação que uma asserção de valor não alcança: qualquer reescrita da
 * fórmula tem de preservá-la, e ela não conhece nenhum número.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · monotonia");

  let quebrouPlot = null;
  let quebrouCh = null;
  let variou = 0;

  for (let plot = 0; plot <= 600; plot += 7) {
    const a = intervalosDoEixoY(400, plot);
    const b = intervalosDoEixoY(400, plot + 7);
    if (b < a) quebrouPlot ??= `plot ${plot} -> ${a}, ${plot + 7} -> ${b}`;
    if (b !== a) variou++;
  }
  for (let ch = 0; ch <= 600; ch += 7) {
    const a = intervalosDoEixoY(ch, 300);
    const b = intervalosDoEixoY(ch + 7, 300);
    if (b < a) quebrouCh ??= `ch ${ch} -> ${a}, ${ch + 7} -> ${b}`;
  }

  ok("linha de base: o valor VARIOU ao longo da varredura", variou > 5, variou + " transições");
  ok("mais plotagem nunca dá menos intervalos", quebrouPlot === null, quebrouPlot ?? "");
  ok("mais altura de contêiner nunca dá menos", quebrouCh === null, quebrouCh ?? "");

  /* `obrigatorio` só pode ACRESCENTAR — a direção faz parte da asserção. */
  let quebrouObr = null;
  for (let ch = 0; ch <= 400; ch += 3) {
    for (const plot of [0, 20, 60, 132, 300]) {
      if (intervalosDoEixoY(ch, plot, true) < intervalosDoEixoY(ch, plot, false)) {
        quebrouObr ??= `ch ${ch} plot ${plot}`;
      }
    }
  }
  ok("`obrigatorio` nunca REDUZ o eixo", quebrouObr === null, quebrouObr ?? "");
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · COM VALOR NEGATIVO O EIXO NUNCA SOME
 *
 * O módulo escreve o motivo: numa série só positiva o leitor sabe onde é o
 * zero — é o chão do desenho. Com negativo o chão não é o zero, e sem eixo
 * **não há como saber quanto de uma barra está abaixo dele**. A linha tracejada
 * mostra ONDE; só o eixo mostra QUANTO.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · a obrigatoriedade vence o limiar");

  ok("altura mínima + negativo = eixo mesmo assim", intervalosDoEixoY(1, 1, true) === 2);
  ok("altura mínima sem negativo = sem eixo", intervalosDoEixoY(1, 1, false) === 0);
  ok("altura zero + negativo ainda desenha", intervalosDoEixoY(0, 0, true) === 2);

  let semEixo = null;
  for (let ch = 0; ch <= 400; ch += 3) {
    for (const plot of [0, 1, 20, 60, 132, 300]) {
      if (intervalosDoEixoY(ch, plot, true) < 2) semEixo ??= `ch ${ch} plot ${plot}`;
    }
  }
  ok("com `obrigatorio`, NUNCA fica sem eixo", semEixo === null, semEixo ?? "");

  /* ── PLANTIO C: ignorar o `obrigatorio` (parece parâmetro decorativo). */
  {
    const plantio = (ch, altPlot) => (ch < CH_MINIMO_EIXO ? 0 : Math.max(2, Math.floor(altPlot / ALTURA_POR_TICK)));
    ok(
      "PLANTIO C: o gráfico com negativo perde o eixo em slot apertado",
      plantio(20, 20) === 0 && intervalosDoEixoY(20, 20, true) === 2,
      "a barra abaixo do zero fica sem grandeza",
    );
    ok(
      "PAR NEGATIVO: sem negativo as duas versões concordam sempre",
      [0, 20, 60, 132, 300].every((p) => plantio(p, p) === intervalosDoEixoY(p, p, false)),
      "o parâmetro só age no caso que ele existe para proteger",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 5 · `escalaArredondada` — a régua CONTÉM os dados
 *
 * Vizinha no módulo e também sem asserção. A propriedade é de contenção: se a
 * régua não contiver o dado, uma barra sai pela borda do desenho.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n5 · escalaArredondada");

  let semente = 7;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  let naoContem = null;
  let zeroFora = null;
  let comNegativo = 0;

  for (let i = 0; i < 400; i++) {
    const a = (rnd() - 0.35) * 50000;
    const b = (rnd() - 0.35) * 50000;
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const e = escalaArredondada(min, max);

    if (e.max < max || e.min > min) naoContem ??= `[${min.toFixed(0)}, ${max.toFixed(0)}] -> [${e.min}, ${e.max}]`;
    if (e.min > 0 || e.max < 0) zeroFora ??= `[${min.toFixed(0)}, ${max.toFixed(0)}] -> [${e.min}, ${e.max}]`;
    if (min < 0) comNegativo++;
  }

  ok("linha de base: o fuzz produziu séries com negativo", comNegativo > 80, comNegativo + " de 400");
  ok("fuzz 400: a régua CONTÉM os dados", naoContem === null, naoContem ?? "");

  /* ⛔ E O ZERO **NÃO** É GARANTIDO PELA FUNÇÃO — medido, com contraexemplo.
     Eu escrevi "o zero está sempre na régua" como asserção e ela REPROVOU:
     numa série toda negativa a régua zoom-a nela e o zero fica fora.

     Quem garante o zero é o CHAMADOR: `SerieTemporal` passa
     `Math.min(...valores, 0)` e `Math.max(...valores, 0)`, prendendo os dois
     lados. É proteção acidental — a propriedade não está no módulo, está numa
     circunstância escrita no consumidor, e some no dia em que aparecer um
     terceiro que chame com os valores crus.

     Por isso a asserção mudou de lado: congela o contraexemplo (para a
     limitação ficar visível) e a guarda do chamador (para ela não se perder). */
  ok(
    "a função NÃO garante o zero — série toda negativa zoom-a nela",
    (() => { const e = escalaArredondada(-7832, -7018); return e.min > 0 || e.max < 0; })(),
    JSON.stringify(escalaArredondada(-7832, -7018)) + " — o zero fica fora da régua",
  );
  ok(
    "GUARDA DO CHAMADOR: `SerieTemporal` prende os dois lados no zero",
    (() => {
      const s = readFileSync("src/components/tk/SerieTemporal.tsx", "utf8").replace(/\r\n/g, "\n");
      return /Math\.min\(\.\.\.valores, 0\)/.test(s) && /Math\.max\(\.\.\.valores, 0\)/.test(s);
    })(),
    "sem esses dois `, 0)` a linha de zero tracejada sai da área plotada",
  );
  ok(
    "e com os dois presos o zero entra sempre",
    (() => {
      const v = [-7832, -7018];
      const e = escalaArredondada(Math.min(...v, 0), Math.max(...v, 0));
      return e.min <= 0 && e.max >= 0;
    })(),
  );
  ok("série só positiva ancora o piso em 0", escalaArredondada(120, 900).min === 0);
  ok("série com negativo abre o piso", escalaArredondada(-120, 900).min < 0, JSON.stringify(escalaArredondada(-120, 900)));

  /* ── PLANTIO D: `Math.round` no teto — "arredondar para o mais próximo".
     Ele quebra a contenção pela metade das vezes, e o sintoma é uma barra
     saindo pelo topo do desenho. */
  {
    const plantio = (min, max) => {
      const bruto = Math.max(Math.abs(min), Math.abs(max), 1);
      const passo = Math.pow(10, Math.floor(Math.log10(bruto))) / 2;
      return { min: min < 0 ? Math.floor(min / passo) * passo : 0, max: Math.round(max / passo) * passo };
    };
    let estourou = 0;
    let s2 = 7;
    const r2 = () => ((s2 = (s2 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 400; i++) {
      const max = r2() * 50000;
      if (plantio(0, max).max < max) estourou++;
    }
    ok("PLANTIO D (round no teto): a régua deixa de conter", estourou > 50, estourou + " de 400 estouram");
    ok("PLANTIO D: a asserção da contenção DERRUBA", estourou > 0);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 6 · O CONTRATO COM OS DOIS CONSUMIDORES
 *
 * `0` significa "não desenhe eixo", e os dois consumidores têm de RAMIFICAR
 * nisso. No `LineChart` a guarda é literalmente contra `NaN`: sem ela,
 * `(max * i) / nY` com `nY = 0` põe uma linha de grade em coordenada inválida
 * — o SVG desenha nada e o `tsc` não vê.
 *
 * ⚠️ E a assimetria entre os dois é DELIBERADA: o `LineChart` não passa
 * `obrigatorio` porque a escala dele é ancorada em zero (`(max * i) / nY`, sem
 * `min`) — ele desenha volume, que não é negativo. Congelada aqui para não ser
 * "unificada" nos dois sentidos.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n6 · o contrato com os consumidores");

  const semCom = (s) =>
    s.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");

  const line = semCom(readFileSync("src/components/tk/LineChart.tsx", "utf8"));
  const serie = semCom(readFileSync("src/components/tk/SerieTemporal.tsx", "utf8"));

  ok("linha de base: `LineChart` chama a função no CÓDIGO", /intervalosDoEixoY\(/.test(line));
  ok("linha de base: `SerieTemporal` também", /intervalosDoEixoY\(/.test(serie));

  ok(
    "`LineChart` ramifica em `nY > 0` antes de dividir",
    /nY > 0 \?/.test(line),
    "sem isso, `(max * i) / nY` sai NaN e a grade some sem erro",
  );
  ok(
    "`SerieTemporal` ramifica em `nY > 0` para a gaveta do eixo",
    /nY > 0 \?/.test(serie),
    "a largura reservada segue a existência do eixo",
  );

  /* A assimetria do `obrigatorio`, e o motivo dela em cada lado. */
  ok(
    "`SerieTemporal` PASSA `obrigatorio` (ele tem negativo)",
    /intervalosDoEixoY\([^)]*,[^)]*,[^)]*\)/.test(serie),
    "terceiro argumento presente",
  );
  ok(
    "`LineChart` NÃO passa — a escala dele é ancorada em zero",
    !/intervalosDoEixoY\([^)]*,[^)]*,[^)]*\)/.test(line) && /\(max \* i\) \/ nY/.test(line),
    "ele desenha volume; sem `min`, não existe barra abaixo do zero para medir",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 7 · ✅ O EIXO INTEIRO VIROU FONTE ÚNICA — o C3 tinha unificado METADE
 *
 * `SerieTemporal:66-68` dizia, literal (commit `36bccdc`, o próprio C3):
 *
 *   > `escalaArredondada` é a MESMA função do `LineChart` (`lib/grafico/eixo.ts`)
 *   > — os dois gráficos arredondam igual **por construção**, não "parecido".
 *
 * ⛔ **Era falso.** O `LineChart` importava só `intervalosDoEixoY` e
 * reimplementava o arredondamento em linha: `maxBruto`, `passo` e `Math.ceil`
 * escritos ali dentro. Duas fontes da mesma conta, com a documentação jurando
 * o contrário.
 *
 * ⚠️ **E era a PIOR forma dessa família, não a melhor:** as duas concordavam.
 * Medido com fuzz de 400 tetos, zero divergências. Uma divergência apareceria
 * na tela; **a concordância não aparece em lugar nenhum**, e é ela que faz a
 * segunda fonte sobreviver até o commit que mexer num lado só.
 *
 * ✅ Unificado em 14/08/2026: o `LineChart` importa `escalaArredondada` e a
 * chama com `min = 0`. O comentário do `SerieTemporal` passou a ser verdade.
 *
 * ### ⛔ E O QUE SE CONGELA NÃO É "OS DOIS DÃO O MESMO TETO"
 *
 * Essa asserção passaria com as duas contas duplicadas de novo — foi
 * exatamente o estado anterior. O que se congela é a AUSÊNCIA da segunda
 * fonte: o `LineChart` não pode conter a aritmética.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n7 · ✅ o eixo inteiro é fonte única");

  const semCom = (s) =>
    s.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");

  const lineBruto = readFileSync("src/components/tk/LineChart.tsx", "utf8").replace(/\r\n/g, "\n");
  const serieBruto = readFileSync("src/components/tk/SerieTemporal.tsx", "utf8").replace(/\r\n/g, "\n");
  const line = semCom(lineBruto);
  const serie = semCom(serieBruto);

  /* ⚠️ Apagar comentário é obrigatório aqui: o `LineChart` agora DOCUMENTA, em
     prosa, a aritmética que ele deixou de ter (`maxBruto`, `passo`,
     `Math.ceil`). Uma guarda sobre o texto cru acusaria a explicação como se
     fosse o código — é a família *guarda por texto medindo PROSA*, e ela já
     mordeu duas vezes nesta sessão. */
  ok(
    "linha de base: sobrou CÓDIGO no `LineChart` depois de apagar comentário",
    /const maxBruto = Math\.max/.test(line),
    "senão as negações abaixo passariam sobre um arquivo em branco",
  );
  /* ⚠️ Esta linha de base supunha que a prosa repetia a aritmética exata
     (`Math.pow(10, Math.floor…`) e REPROVOU: o comentário do `LineChart` cita
     os nomes (`maxBruto`, `passo`, `Math.ceil`) sem transcrever a fórmula.
     Medir o que se supõe do texto alheio é a mesma família de sempre — a
     substituta mede o que ela alega: o apagador removeu volume. */
  ok(
    "linha de base: o apagador removeu comentário de verdade",
    lineBruto.length - line.replace(/ /g, "").length > 3000,
    lineBruto.length + " bytes crus × " + line.replace(/ /g, "").length + " de código",
  );

  /* ── 7a: a segunda fonte não existe mais. */
  ok(
    "7a · ⛔ o `LineChart` NÃO reimplementa o arredondamento",
    !/Math\.pow\(10, Math\.floor\(Math\.log10/.test(line) && !/Math\.ceil\(maxBruto \/ passo\)/.test(line),
    "estas três linhas eram a segunda fonte",
  );
  ok(
    "7a · …ele IMPORTA `escalaArredondada`",
    /import \{[^}]*escalaArredondada[^}]*\} from "@\/lib\/grafico\/eixo"/.test(line),
  );
  ok(
    "7a · …e a CHAMA — import não chamado dá aparência de cobertura",
    /escalaArredondada\(0, maxBruto\)\.max/.test(line),
    "`min = 0` porque este gráfico desenha volume, ancorado no zero",
  );
  ok(
    "7a · o `SerieTemporal` também a importa",
    /import \{[^}]*escalaArredondada[^}]*\} from "@\/lib\/grafico\/eixo"/.test(serie),
  );
  ok(
    "7a · ✅ e o comentário dele virou VERDADE",
    /`escalaArredondada` é a MESMA função do `LineChart`/.test(serieBruto) &&
      /escalaArredondada\(/.test(line),
    "ele afirmava isso desde 13/08 sobre um arquivo que não a importava",
  );

  /* ── 7b: a assimetria do `obrigatorio` continua DELIBERADA.
     Unificar o arredondamento não unifica isto, e não deve: o `LineChart`
     ancora a escala no zero e não tem barra abaixo dele para medir. */
  ok(
    "7b · `SerieTemporal` PASSA `obrigatorio`",
    /intervalosDoEixoY\([^)]*,[^)]*,[^)]*\)/.test(serie),
  );
  ok(
    "7b · `LineChart` NÃO passa — a escala dele é ancorada em zero",
    !/intervalosDoEixoY\([^)]*,[^)]*,[^)]*\)/.test(line) && /\(max \* i\) \/ nY/.test(line),
    "sem `min`, não existe barra abaixo do zero para medir",
  );

  /* ── 7c: e o comportamento não mudou. A unificação é provável, não presumida:
     a fórmula que o `LineChart` tinha, aplicada aos mesmos valores, dá o mesmo
     teto que `escalaArredondada(0, bruto)`. Isto é o que autoriza chamar a
     mudança de MOVE. */
  {
    const antiga = (valores, breakEven) => {
      const maxBruto = Math.max(...valores, breakEven ?? 0, 1);
      const passo = Math.pow(10, Math.floor(Math.log10(maxBruto))) / 2;
      return Math.ceil(maxBruto / passo) * passo;
    };

    let semente = 7;
    const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    let divergiu = null;
    let comparados = 0;

    for (let i = 0; i < 400; i++) {
      const valores = Array.from({ length: 1 + Math.floor(rnd() * 8) }, () => rnd() * 50000);
      const be = rnd() < 0.5 ? rnd() * 50000 : null;
      const bruto = Math.max(...valores, be ?? 0, 1);
      comparados++;
      if (escalaArredondada(0, bruto).max !== antiga(valores, be)) {
        divergiu ??= `bruto ${bruto.toFixed(2)}: módulo ${escalaArredondada(0, bruto).max} × antiga ${antiga(valores, be)}`;
      }
    }

    ok("linha de base: " + comparados + " tetos comparados", comparados === 400);
    ok(
      "7c · a unificação é um MOVE: mesmo teto da fórmula que saiu (fuzz 400, semente 7)",
      divergiu === null,
      divergiu ?? "nenhum valor do gráfico muda com a troca",
    );
  }
}

console.log(
  "\n\x1b[32m  ✅ O EIXO VIROU FONTE ÚNICA em 14/08/2026. O C3 (`36bccdc`, 13/08)" +
    "\n      extraiu `intervalosDoEixoY` e deixou `escalaArredondada` reimplementada" +
    "\n      no `LineChart` — com o comentário do `SerieTemporal` afirmando o" +
    "\n      contrário desde então." +
    "\n" +
    "\x1b[33m      ⚠️  A §7 congela a AUSÊNCIA da segunda fonte, não a igualdade dos" +
    "\n      tetos: os dois já concordavam quando eram duas contas, e foi essa" +
    "\n      concordância que deixou a duplicação sobreviver.\x1b[0m",
);

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
