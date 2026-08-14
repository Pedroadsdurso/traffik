/**
 * QUATRO FUNÇÕES PURAS DE ALTA CONSEQUÊNCIA — sem asserção até 14/08/2026.
 *
 * Achadas pela varredura das 112 puras sem teste. Estão juntas porque cada uma
 * é pequena e as quatro pertencem à mesma categoria: **erram em silêncio, e o
 * erro só aparece longe da causa.**
 *
 *   `secretsMatch`          🔒 comparação em tempo constante
 *   `zonedToUtc` · `dayStart` · `dayEnd`   🕐 "nenhuma agregação usa o dia do PROCESSO"
 *   `agruparPorPedido`      🧾 a armadilha do `pedidoId`, paga QUATRO vezes
 *   `getImpostoAnunciosPct` 💰 entra no break-even
 */

import assert from "node:assert/strict";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · `secretsMatch` — comparação em TEMPO CONSTANTE
 *
 * ⛔ `===` em string vaza, pelo tempo de resposta, quantos caracteres iniciais
 * bateram. Estes segredos viajam em TODA requisição de gateway e no cron que
 * pausa campanha — o `CLAUDE.md` diz, literal: "não vale economizar isso".
 * ═════════════════════════════════════════════════════════════════════ */
{
  const { secretsMatch } = await import("@/lib/crypto/secrets");
  console.log("\n1 · secretsMatch — tempo constante");

  ok("iguais casam", secretsMatch("segredo-abc", "segredo-abc") === true);
  ok("diferentes não casam", secretsMatch("segredo-abc", "segredo-xyz") === false);
  ok("PREFIXO não casa", secretsMatch("segredo-ab", "segredo-abc") === false);
  ok("sufixo extra não casa", secretsMatch("segredo-abcd", "segredo-abc") === false);
  ok("vazio contra vazio casa", secretsMatch("", "") === true);
  ok("vazio contra não-vazio não casa", secretsMatch("", "x") === false);
  ok("diferença só no ÚLTIMO caractere não casa", secretsMatch("aaaaaaaaab", "aaaaaaaaac") === false);
  ok("diferença só no PRIMEIRO não casa", secretsMatch("baaaaaaaaa", "caaaaaaaaa") === false);

  /* Comprimentos diferentes: o curto-circuito aqui é INEVITÁVEL (`timingSafeEqual`
     exige buffers do mesmo tamanho) e vaza só o COMPRIMENTO, não o conteúdo. */
  ok("comprimentos diferentes não casam", secretsMatch("abc", "abcd") === false);

  /* Unicode: bytes, não code points — dois emojis diferentes têm o mesmo
     comprimento em `.length` e bytes diferentes. */
  ok("unicode compara por BYTES", secretsMatch("café", "cafe") === false);

  /* ── PLANTIO: a comparação CURTO-CIRCUITADA, que é o "conserto" de quem acha
     `timingSafeEqual` verboso demais. Ela devolve o MESMO booleano em todos os
     casos — por isso o defeito é invisível para qualquer asserção de valor. */
  {
    const curtoCircuito = (a, b) => {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; // ← sai cedo
      return true;
    };
    const casos = [["abc", "abc"], ["abc", "abd"], ["", ""], ["a", "ab"], ["café", "cafe"]];
    const iguais = casos.every(([a, b]) => curtoCircuito(a, b) === secretsMatch(a, b));
    ok(
      "🔴 PLANTIO: o curto-circuito devolve o MESMO booleano em todos os casos",
      iguais,
      casos.length + " casos idênticos — nenhuma asserção de VALOR o pegaria",
    );

    /* ⛔ E é por isso que a asserção que vale é ESTRUTURAL: o que se congela é o
       USO de `timingSafeEqual`, não o resultado. Medir tempo num teste seria
       instável e mediria a máquina, não o código. */
    const fonte = (await import("node:fs")).readFileSync("src/lib/crypto/secrets.ts", "utf8");
    const i = fonte.indexOf("export function secretsMatch");
    ok("linha de base: a função existe na fonte", i > 0);
    const corpo = fonte.slice(i, i + 400);
    ok(
      "⛔ `secretsMatch` USA `timingSafeEqual` — a única asserção que pega o plantio",
      corpo.includes("timingSafeEqual"),
      "comparar por valor não distinguiria as duas implementações",
    );
    ok(
      "⛔ e NÃO usa `===` entre os segredos",
      !/\ba\s*===\s*b\b/.test(corpo),
      "um `a === b` aqui vazaria o prefixo pelo tempo",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · O NÚCLEO DE FUSO — `zonedToUtc`, `dayStart`, `dayEnd`
 *
 * ⛔ A regra do projeto: **nenhuma agregação usa o dia do PROCESSO**. Na Vercel
 * o `TZ` é UTC, e às 21h em Brasília já é o dia seguinte lá — a janela em que um
 * teste desta base falhava sozinho.
 * ═════════════════════════════════════════════════════════════════════ */
{
  const { zonedToUtc, dayStart, dayEnd } = await import("@/lib/timezone");
  const SP = "America/Sao_Paulo";
  console.log("\n2 · fuso — o dia é do USUÁRIO, não do processo");

  /* São Paulo é UTC−3: meia-noite local é 03:00 UTC do mesmo dia. */
  ok(
    "meia-noite em São Paulo é 03:00 UTC",
    zonedToUtc(2026, 8, 14, 0, 0, 0, 0, SP).toISOString() === "2026-08-14T03:00:00.000Z",
    zonedToUtc(2026, 8, 14, 0, 0, 0, 0, SP).toISOString(),
  );
  ok(
    "21h em São Paulo é 00:00 UTC do dia SEGUINTE",
    zonedToUtc(2026, 8, 14, 21, 0, 0, 0, SP).toISOString() === "2026-08-15T00:00:00.000Z",
    "← esta é a janela que fazia teste falhar sozinho às 21h",
  );
  ok("em UTC a conversão é identidade", zonedToUtc(2026, 8, 14, 0, 0, 0, 0, "UTC").toISOString() === "2026-08-14T00:00:00.000Z");

  /* `dayStart`/`dayEnd` recortam o DIA LOCAL. */
  {
    const ini = dayStart("2026-08-14", SP);
    const fim = dayEnd("2026-08-14", SP);
    ok("dayStart é a meia-noite local", ini.toISOString() === "2026-08-14T03:00:00.000Z", ini.toISOString());
    ok("dayEnd é o fim do dia local", fim.getTime() > ini.getTime(), fim.toISOString());

    /* 🔴 A INVARIANTE que congela a relação, não o valor: o dia local dura
       exatamente 24h (fora troca de horário de verão, que o Brasil não tem
       desde 2019). */
    const horas = (fim.getTime() - ini.getTime()) / 3_600_000;
    ok("o dia local dura ~24h", horas > 23.99 && horas <= 24, horas.toFixed(4) + "h");

    /* E o fim de um dia encosta no começo do seguinte, sem buraco nem sobra. */
    const proximo = dayStart("2026-08-15", SP);
    const folga = proximo.getTime() - fim.getTime();
    ok("o fim de um dia encosta no começo do próximo", folga >= 0 && folga <= 1000, folga + "ms de folga");
  }

  /* ── PLANTIO: usar o dia do PROCESSO. É o "conserto" de quem acha a conversão
     de fuso complicada — `new Date("2026-08-14")` parece a mesma coisa. */
  {
    const doProcesso = (key) => new Date(key + "T00:00:00"); // ← interpreta no TZ do processo
    const certo = dayStart("2026-08-14", SP);
    const ruim = doProcesso("2026-08-14");
    /* Em TZ=UTC os dois divergem em 3h — e essa é exatamente a fatia de vendas
       que muda de dia. Se o processo já estiver em SP, eles coincidem: por isso
       o defeito é MUDO na máquina do desenvolvedor e aparece só na Vercel. */
    const difH = Math.abs(ruim.getTime() - certo.getTime()) / 3_600_000;
    console.log(
      "     · o TZ desta máquina faz o plantio divergir " + difH + "h" +
        (difH === 0 ? "  ⚠️ processo em SP — é ASSIM que o defeito fica mudo em dev" : ""),
    );

    /* ⛔ A asserção acima NÃO PODE depender do fuso da máquina — ela passaria
       por coincidência aqui e falharia no CI, ou o contrário. O que se afirma é
       a propriedade INDEPENDENTE: `dayStart` tem de RESPEITAR o parâmetro `tz`.
       Uma implementação que ignorasse o `tz` (o plantio real) daria o MESMO
       instante para os dois fusos. */
    const emUTC = dayStart("2026-08-14", "UTC");
    const emSP = dayStart("2026-08-14", SP);
    const dif = (emSP.getTime() - emUTC.getTime()) / 3_600_000;
    ok(
      "⛔ PLANTIO: `dayStart` RESPEITA o `tz` — UTC e SP dão instantes diferentes",
      dif === 3,
      "SP começa " + dif + "h depois de UTC — se ignorasse o `tz`, seria 0",
    );
    ok("PLANTIO: e o valor não depende do TZ do processo", emSP.toISOString() === "2026-08-14T03:00:00.000Z");
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · `agruparPorPedido` — a armadilha do `pedidoId`, paga QUATRO vezes
 *
 * ⛔ O `CLAUDE.md`: *"`pedidoId` fora do `select` → `chaveDoPedido` cai no `id`
 * e TODA contagem volta a ser por item, em silêncio"*. Order bump vira duas
 * vendas; o faturamento por pedido some.
 * ═════════════════════════════════════════════════════════════════════ */
{
  const { agruparPorPedido } = await import("@/lib/pedidos");
  console.log("\n3 · agruparPorPedido — pedido, não item");

  const v = (id, pedidoId, valor) => ({ id, pedidoId, amount: valor });

  {
    /* Um pedido com order bump: duas linhas, UM pedido. */
    const g = agruparPorPedido([v("i1", "P-1", 100), v("i2", "P-1", 30), v("i3", "P-2", 50)]);
    ok("duas linhas do mesmo pedido viram UM grupo", g.length === 2, g.map((x) => x.length).join("+"));
    ok("o grupo do order bump tem as duas linhas", g[0].length === 2);
    ok("nenhuma linha se perde", g.flat().length === 3);
  }
  {
    /* 🔴 Sem `pedidoId`, cada linha é o próprio pedido — e isso é CORRETO como
       comportamento, mas é o estado que o `select` incompleto produz. */
    const g = agruparPorPedido([v("i1", null, 100), v("i2", null, 30)]);
    ok("sem `pedidoId`, cada linha é um pedido", g.length === 2, "← é o estado que o `select` incompleto fabrica");
  }
  ok("lista vazia devolve nenhum grupo", agruparPorPedido([]).length === 0);

  /* ── PLANTIO: agrupar pelo `id` da linha — literalmente o efeito de esquecer
     `pedidoId` no `select`. */
  {
    const porId = (vendas) => {
      const m = new Map();
      for (const x of vendas) (m.get(x.id) ?? m.set(x.id, []).get(x.id)).push(x);
      return [...m.values()];
    };
    const linhas = [v("i1", "P-1", 100), v("i2", "P-1", 30)];
    const certo = agruparPorPedido(linhas);
    const ruim = porId(linhas);
    ok("PLANTIO: agrupar pelo `id` dá 2 pedidos onde há 1", ruim.length === 2 && certo.length === 1, ruim.length + " vs " + certo.length);
    let caiu = false;
    try {
      assert.equal(ruim.length, 1);
    } catch {
      caiu = true;
    }
    ok("PLANTIO: a asserção do order bump DERRUBA", caiu);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · `getImpostoAnunciosPct` — ⛔ SAI DA LISTA, e o motivo é uma CORREÇÃO
 *     DA MINHA PRÓPRIA TRIAGEM.
 *
 * Ele foi classificado como "pura de alta consequência". **Não é pura:** a
 * assinatura real é
 *
 *     export async function getImpostoAnunciosPct(userId: string): Promise<number>
 *
 * — `async`, recebe `userId`, e lê do banco. Cobri-lo exigiria o banco de dev,
 * e cai na regra nº 1 do incidente de 29/07: verificação vira LEITURA, não
 * escrita em tabela de negócio.
 *
 * ⚠️ Registrado aqui em vez de apagado em silêncio: a triagem que o pôs nesta
 * lista é a mesma que pôs `evaluateRule` no balde "outros". Um instrumento de
 * triagem também erra o alvo, e o número dele não vale mais que a conferência.
 * ═════════════════════════════════════════════════════════════════════ */
console.log("\n4 · getImpostoAnunciosPct — ⛔ FORA: é `async` e lê do banco, não é pura");

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
