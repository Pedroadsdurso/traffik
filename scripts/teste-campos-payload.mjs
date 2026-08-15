/**
 * `isObj` · `pick` · `toStr` · `comoLista` — AS PEÇAS QUE TODO PARSER USA PARA
 * LER UM PAYLOAD.
 *
 * ### ⚠️ ELAS SÃO EXERCIDAS. O que faltava eram as BORDAS.
 *
 * O cabeçalho do módulo afirma: *"o comportamento destas funções é congelado
 * por `npm run test:gateways`, contra 167 payloads reais de produção"*. É
 * verdade — os quatro parsers as chamam, e `test:gateways` roda os 167 por
 * eles. **Não é cobertura ausente: é cobertura por AMOSTRA.**
 *
 * ⛔ E amostra de produção não carrega borda por construção: ela tem o que os
 * gateways mandaram, não o que eles podem mandar. `test:payload-dinheiro` já
 * fez essa distinção para `toNumber`/`toNumeroOuNulo`; estas quatro ficaram.
 *
 * ### 🔑 O QUE CADA UMA DECIDE, e nenhuma é trivial
 *
 * | | decide |
 * |---|---|
 * | `pick` | **qual chave vence** quando o gateway manda várias — e string VAZIA não vence |
 * | `isObj` | array **não** é objeto, e é isso que faz o `comoLista` funcionar |
 * | `comoLista` | objeto × array no `data` — a Cakto manda os dois |
 * | `toStr` | teto de 512 e vazio-vira-`null` |
 *
 * ⚠️ A do `pick` é a distinção central deste projeto: um campo presente e
 * VAZIO cai para a próxima chave, como se não existisse. É decisão, não
 * descuido — e sem asserção ela seria "corrigida" por quem achasse o `!== ""`
 * um resquício.
 */

import assert from "node:assert/strict";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { isObj, pick, toStr, comoLista } = await import("@/lib/gateways/campos");

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · `isObj` — e o que ele RECUSA é o que importa
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · isObj");

  ok("objeto simples é objeto", isObj({}) === true && isObj({ a: 1 }) === true);

  const NAO = [null, undefined, [], [1, 2], "texto", 0, 42, true, false];
  const passam = NAO.filter(isObj);
  ok(
    "as " + NAO.length + " formas não-objeto são recusadas",
    passam.length === 0,
    passam.length ? "PASSARAM: " + JSON.stringify(passam) : "",
  );
  ok(
    "🔑 ARRAY não é objeto — é o que faz o `comoLista` funcionar",
    isObj([]) === false && isObj([{ a: 1 }]) === false,
    "`typeof [] === 'object'` em JS; sem o `!Array.isArray` a §4 inteira cairia",
  );
  ok("`null` não é objeto, apesar do `typeof`", isObj(null) === false);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · 🔑 `pick` — VAZIO NÃO VENCE, e essa é a decisão
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · pick — qual chave vence");

  ok("a primeira chave presente vence", pick({ a: 1, b: 2 }, ["a", "b"]) === 1);
  ok("…e a ordem da LISTA manda, não a do objeto", pick({ a: 1, b: 2 }, ["b", "a"]) === 2);
  ok("chave ausente cai para a próxima", pick({ b: 2 }, ["a", "b"]) === 2);
  ok("nenhuma presente devolve `undefined`", pick({ c: 3 }, ["a", "b"]) === undefined);
  ok("lista vazia devolve `undefined`", pick({ a: 1 }, []) === undefined);

  /* 🔑 As três formas de "presente mas sem valor" caem para a próxima. */
  for (const [rotulo, vazio] of [["`null`", null], ["`undefined`", undefined], ["string vazia", ""]]) {
    ok(
      "🔑 " + rotulo + " NÃO vence — cai para a próxima chave",
      pick({ a: vazio, b: "valor" }, ["a", "b"]) === "valor",
      "campo presente e sem conteúdo é tratado como ausente",
    );
  }
  ok(
    "…mas `0` e `false` VENCEM",
    pick({ a: 0, b: "x" }, ["a", "b"]) === 0 && pick({ a: false, b: "x" }, ["a", "b"]) === false,
    "🔴 zero é um valor medido; a distinção ausência × zero vale aqui também",
  );

  /* Caminhos aninhados. */
  ok("caminho `a.b.c` desce", pick({ a: { b: { c: 7 } } }, ["a.b.c"]) === 7);
  ok("caminho quebrado no meio cai para a próxima", pick({ a: 1, z: "ok" }, ["a.b.c", "z"]) === "ok");
  ok("caminho em `null` no meio não estoura", pick({ a: { b: null }, z: "ok" }, ["a.b.c", "z"]) === "ok");
  ok("caminho terminando em vazio cai também", pick({ a: { b: "" }, z: "ok" }, ["a.b", "z"]) === "ok");
  ok(
    "caminho que atravessa ARRAY não desce",
    pick({ a: [{ b: 1 }], z: "ok" }, ["a.b", "z"]) === "ok",
    "`isObj` recusa array, então o caminho para — não indexa por engano",
  );

  /* ── PLANTIO: o `!== ""` removido, como quem o lê como resquício. */
  {
    const semVazio = (obj, keys) => {
      for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
      return undefined;
    };
    ok(
      "PLANTIO: sem o `!== \"\"`, a chave VAZIA vence a preenchida",
      semVazio({ a: "", b: "valor" }, ["a", "b"]) === "" && pick({ a: "", b: "valor" }, ["a", "b"]) === "valor",
      "o parser leria string vazia onde há valor na chave seguinte",
    );
    /* PAR NEGATIVO: quando a primeira chave tem conteúdo, as duas concordam —
       e esse é o caso de quase todo payload real. */
    const comuns = [{ a: "x", b: "y" }, { b: "y" }, { a: 0, b: "y" }];
    ok(
      "PAR NEGATIVO: nos " + comuns.length + " casos com conteúdo as duas concordam",
      comuns.every((o) => semVazio(o, ["a", "b"]) === pick(o, ["a", "b"])),
      "por isso 167 payloads reais não denunciariam",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · `toStr` — o teto, e o vazio virando `null`
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · toStr");

  ok("string atravessa aparada", toStr("  abc  ") === "abc");
  ok("número vira texto", toStr(42) === "42" && toStr(0) === "0");
  ok("🔑 `0` NÃO vira null", toStr(0) === "0", "zero é valor; virar null o apagaria do payload");
  ok("`false` vira texto", toStr(false) === "false");
  ok("null e undefined viram null", toStr(null) === null && toStr(undefined) === null);
  ok(
    "vazio e só-espaço viram null",
    toStr("") === null && toStr("   ") === null,
    "string vazia no banco desenharia rótulo em branco na tela",
  );
  ok("o teto padrão é 512", toStr("x".repeat(600)).length === 512);
  ok("…e ele é parametrizável", toStr("x".repeat(600), 10).length === 10);
  ok("no limite exato não corta", toStr("x".repeat(512)).length === 512);
  ok(
    "o corte é por CARACTERE, e não quebra o resto",
    toStr("abcdef", 3) === "abc",
    "não há reticência aqui — quem trunca para a tela é o `mensagemCurta`",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · 🔴 `comoLista` — o defeito que ela impede é MUDO
 *
 * O cabeçalho dela diz: *"a Cakto manda objeto no disparo individual e array no
 * agrupado — e um parser que assuma objeto quebra no modo agrupado EM
 * SILÊNCIO, processando só o primeiro item ou nenhum"*.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · 🔴 comoLista");

  ok("objeto vira lista de um", comoLista({ a: 1 }).length === 1 && comoLista({ a: 1 })[0].a === 1);
  ok("array atravessa", comoLista([{ a: 1 }, { a: 2 }]).length === 2);
  ok(
    "🔑 os dois formatos produzem a MESMA forma",
    Array.isArray(comoLista({ a: 1 })) && Array.isArray(comoLista([{ a: 1 }])),
    "é isso que faz o parser não precisar saber qual modo o gateway usou",
  );

  const LIXO = [null, undefined, "texto", 42, true, ""];
  ok(
    "as " + LIXO.length + " formas de lixo dão lista VAZIA",
    LIXO.every((v) => comoLista(v).length === 0),
    "e não `[undefined]`, que o parser trataria como um item",
  );
  ok(
    "array MISTO descarta o que não é objeto",
    comoLista([{ a: 1 }, "texto", null, 42, { a: 2 }]).length === 2,
    "o item ruim some, os bons ficam — a família `entrada ruim preserva os válidos`",
  );
  ok("array vazio dá lista vazia", comoLista([]).length === 0);
  ok("array aninhado não é achatado", comoLista([[{ a: 1 }]]).length === 0, "um array dentro do array não é objeto");

  /* ── PLANTIO: o parser assumindo objeto, que é o defeito de origem. */
  {
    const soObjeto = (v) => (v && typeof v === "object" ? [v] : []);
    const agrupado = [{ a: 1 }, { a: 2 }, { a: 3 }];
    ok(
      "PLANTIO: assumindo objeto, o modo AGRUPADO vira 1 item",
      soObjeto(agrupado).length === 1 && comoLista(agrupado).length === 3,
      "duas vendas somem, e nada acusa",
    );
    ok(
      "PAR NEGATIVO: no modo INDIVIDUAL as duas versões concordam",
      soObjeto({ a: 1 }).length === comoLista({ a: 1 }).length,
      "é o modo comum — o defeito só aparece no disparo agrupado",
    );
  }
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   ⚠️ cobertura por BORDA — os 167 payloads de `test:gateways` continuam sendo a por amostra\n");
