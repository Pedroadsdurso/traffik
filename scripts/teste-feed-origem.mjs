/**
 * A COLUNA `ORIGEM` DO FEED TEM UM SIGNIFICADO SÓ — a fonte de TRÁFEGO.
 *
 * ## 🔴 O DEFEITO, e ele era de LEITURA
 *
 * `buildActivity` monta uma lista de tipos diferentes (venda, clique, checkout,
 * pageview, lead…) numa tabela só. Até 17/08/2026, a coluna `source` trazia:
 *
 * | linha | o que a coluna dizia |
 * |---|---|
 * | venda · clique | ✅ a **fonte de tráfego** — `nomeDaFonte(utmSource)` |
 * | checkout · evento de pixel | 🔴 o **instrumento** — `"Gateway"` ou `"Pixel"` |
 *
 * > ## Duas semânticas na mesma coluna fazem o leitor comparar "Facebook" com "Pixel" — que não são respostas para a mesma pergunta.
 *
 * ⚠️ **E o motivo do instrumento ali era BOM**, escrito no código: *"a fonte diz
 * QUEM detectou — é o que permite ver, no próprio feed, se o detector do script
 * está vivo ou se só o gateway está reportando."* Isso é a **cobertura do
 * snippet de checkout**, que o `CLAUDE.md` registra como dívida real.
 *
 * ✅ **Por isso o conserto não foi apagar.** Quem detectou continua dito, por
 * extenso, no campo ao lado (`campaign`): *"Checkout no gateway"* × *"Clique no
 * botão de compra"*. A informação mudou de coluna, não de existência — e a §3
 * abaixo é o que impede que ela suma numa próxima edição.
 *
 *   npm run test:feed-origem
 */

import assert from "node:assert/strict";
import { readFileSync, globSync } from "node:fs";

let n = 0;
const falhas = [];
const ok = (nome, cond, extra) => {
  try {
    assert.ok(cond, nome + (extra ? " — " + extra : ""));
    console.log("  \x1b[32m✓\x1b[0m " + nome + (extra ? " — " + extra : ""));
    n++;
  } catch (e) {
    falhas.push(nome);
    console.log("  \x1b[31m✗\x1b[0m " + nome + "\n      " + e.message);
  }
};
const secao = (t) => console.log("\n\x1b[1m" + t + "\x1b[0m");

const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
/** Apaga comentário PRESERVANDO quebras — senão a guarda mede PROSA. */
const semCom = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");

const M = ler("src/lib/dashboard/metrics.ts");
const CODIGO = semCom(M);

console.log("\n\x1b[1mA coluna ORIGEM do feed — um significado só\x1b[0m");

/* ═══ 1 · TODA linha de `buildActivity` deriva `source` da FONTE ══════════ */
secao("1 · Todo `source:` de `buildActivity` vem de `nomeDaFonte`, nunca do instrumento");
{
  const i = CODIGO.indexOf("function buildActivity");
  ok("1 · linha de base: `buildActivity` foi encontrada", i > 0, "índice " + i);
  const fim = CODIGO.indexOf("\nfunction ", i + 1);
  const corpo = CODIGO.slice(i, fim === -1 ? undefined : fim);
  ok("1 · linha de base: o corpo foi recortado", corpo.length > 800 && corpo.includes("items.push"), corpo.length + " chars");

  /* ⛔ O denominador vai na saída: uma guarda de "0 ocorrências" tem de provar
     primeiro que houve o que examinar. */
  const fontes = [...corpo.matchAll(/^\s*source:.*$/gm)].map((m) => m[0].trim());
  ok(
    "1 · linha de base: há linhas `source:` para examinar",
    fontes.length >= 4,
    fontes.length + " linhas",
  );

  /* 🔑 A ASSERÇÃO CENTRAL. `"Gateway"`/`"Pixel"` são o INSTRUMENTO; se um deles
     voltar para uma linha `source:`, a coluna reganha dois significados. */
  const comInstrumento = fontes.filter((l) => /"Gateway"|"Pixel"/.test(l));
  ok(
    "1 · 🔑 NENHUM `source:` traz o instrumento (`\"Gateway\"` / `\"Pixel\"`)",
    comInstrumento.length === 0,
    comInstrumento.join(" | ") || `${fontes.length} de ${fontes.length} trazem a fonte`,
  );
  ok(
    "1 · …e todos derivam de `nomeDaFonte` ou caem em `\"Direto\"`",
    fontes.every((l) => /nomeDaFonte\(/.test(l) || /"Direto"/.test(l)),
    fontes.map((l) => l.slice(0, 46)).join(" | "),
  );
}

/* ═══ 2 · A FONTE DO EVENTO DE PIXEL VEM DA RELAÇÃO, não do array ═════════

   ⛔ Resolver o `clickId` pelo `w.clicks` já carregado passaria em qualquer
   teste de unidade e erraria em produção: o clique pode estar FORA da janela
   (evento de hoje, clique de três dias atrás), e a linha diria "Direto" para
   tráfego atribuído — errado justamente no caso que a coluna existe para
   mostrar.                                                                  */
secao("2 · A fonte do evento de pixel vem da RELAÇÃO — o clique pode estar fora da janela");
{
  const i = CODIGO.indexOf("prisma.pixelEvent.findMany");
  ok("2 · linha de base: a consulta de eventos foi encontrada", i > 0, "índice " + i);
  const sel = CODIGO.slice(i, CODIGO.indexOf("orderBy", i));
  ok("2 · linha de base: o `select` foi recortado", /select:\s*\{/.test(sel) && sel.includes("clickId"), sel.length + " chars");
  ok(
    "2 · 🔑 o `select` traz `click.utmSource`",
    /click:\s*\{\s*select:\s*\{\s*utmSource:\s*true/.test(sel),
    "fora do `select` a fonte chega `undefined` e TODA linha vira `Direto`",
  );
  ok(
    "2 · …e o feed lê da relação, não de um `find` no array",
    /e\.click\?\.utmSource/.test(CODIGO) && !/w\.clicks\.find\(/.test(CODIGO),
    "resolver pelo array devolveria `Direto` para clique fora da janela",
  );
}

/* ═══ 3 · ⛔ O QUE DETECTOU NÃO SE PERDEU — mudou de coluna ═══════════════

   Esta seção é a que separa "mover" de "apagar". O instrumento saiu da coluna
   ORIGEM porque ali ele competia com outra pergunta — não porque deixou de
   importar. Ele responde à COBERTURA DO SNIPPET DE CHECKOUT, que o `CLAUDE.md`
   registra como dívida aberta: `navegador / (navegador + gateway)`.          */
secao("3 · ⛔ Quem DETECTOU continua legível — no campo ao lado, por extenso");
{
  ok(
    "3 · o checkout do GATEWAY continua nomeado",
    /"Checkout no gateway"/.test(CODIGO),
    "é o lado `gateway` da cobertura do snippet",
  );
  ok(
    "3 · …e o do NAVEGADOR também",
    /"Clique no botão de compra"/.test(CODIGO),
    "é o lado `navegador` — e a razão entre os dois é a cobertura",
  );
  /* ⛔ E os dois têm de sair do MESMO campo, senão a comparação some: um em
     `campaign` e outro em `source` seria a divergência de volta, disfarçada.

     ⚠️ ESTA GUARDA JÁ MEDIU PROSA — na primeira versão ela varria `M` (o
     arquivo cru) e casou no COMENTÁRIO que este mesmo commit escreveu, que
     cita as duas frases para explicar por que elas ficam juntas. É a sétima
     ocorrência da família nesta base, e a regra dela foi escrita nesta mesma
     sessão. Hoje varre `CODIGO`, com o comentário apagado. */
  const linhas = CODIGO.split("\n");
  const doGateway = linhas.findIndex((l) => l.includes('"Checkout no gateway"'));
  const doNavegador = linhas.findIndex((l) => l.includes('"Clique no botão de compra"'));
  ok(
    "3 · 🔑 e os DOIS saem do mesmo campo (`campaign`), na mesma expressão",
    doGateway > 0 && doGateway === doNavegador && /campaign:/.test(linhas[doGateway]),
    `linha ${doGateway + 1}: ${linhas[doGateway]?.trim().slice(0, 70)}`,
  );
}

/* ═══ 4 · O DTO E A TELA acompanham ══════════════════════════════════════ */
secao("4 · O tipo do feed e a tela continuam de pé");
{
  const consumidores = globSync("src/**/*.{ts,tsx}")
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => !f.includes("generated/"))
    .filter((f) => /\bsource\b/.test(semCom(ler(f))) && /ItemFeed|activity/.test(semCom(ler(f))));
  ok(
    "4 · linha de base: a cadeia do feed tem consumidor",
    consumidores.length >= 1,
    consumidores.map((f) => f.split("/").pop()).join(" · "),
  );
  ok(
    "4 · o feed da tela ainda mostra `source` quando não há campanha",
    /f\.campaign \|\| f\.source/.test(semCom(ler("src/components/tk/FeedVendas.tsx"))),
    "sem isto a fonte corrigida não chegaria à tela em linha nenhuma",
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
if (falhas.length) {
  console.log("\n\x1b[31m" + falhas.length + " falha(s):\x1b[0m\n  - " + falhas.join("\n  - "));
  process.exit(1);
}
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: todas as linhas `source:` de `buildActivity`, + a relação e o campo que guarda o instrumento\n");
