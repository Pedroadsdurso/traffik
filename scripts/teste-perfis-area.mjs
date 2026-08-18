/**
 * `perfisNoEscopo` — O RECORTE POR ÁREA DOS PERFIS DE ANÚNCIO.
 *
 * ## 🔴 A FORMA NÃO É A DO PIXEL, e a diferença cria um caso a mais
 *
 * `AdProfile` **não tem `workspaceId`**. O escopo entra nas CONTAS
 * (`adAccounts: { where }`), e o perfil some por consequência:
 * `.filter((p) => p.adAccounts.length > 0)`.
 *
 * > ## Daí o caso que o Pixel não tem: um perfil com contas em DUAS áreas aparece nas DUAS, com listas de contas DIFERENTES. Não é presença/ausência — é o mesmo item mudando de conteúdo.
 *
 * ⛔ **Por isso a asserção é sobre o CONJUNTO DE IDS das contas**, nunca sobre
 * `length` nem sobre a presença do perfil: um teste que só checa *"o perfil
 * está na lista"* passa sem tocar no caso.
 *
 * ## 🔬 O QUE FOI OBSERVADO ANTES DE ESCREVER — e contraria a dedução
 *
 * A ordem foi medir primeiro. Rodado contra o dev, com as quatro formas:
 *
 * ```
 * PRINCIPAL (catch-all)   P-órfão  -> [cO(órfã)]      forma 4: NÃO ENTRA
 * Área A (estrito)        P-só-A   -> [cA]
 *                         P-A-e-B  -> [c4a]           forma 4: ENTRA com [c4a]
 * Área B (estrito)        P-só-B   -> [cB]
 *                         P-A-e-B  -> [c4b]           forma 4: ENTRA com [c4b]
 * ```
 *
 * 🔴 **A Principal NÃO vê a forma 4.** O catch-all é
 * `OR [ workspaceId = principal , workspaceId = NULL ]` — e as contas da forma
 * 4 estão em A e em B, que não são nenhum dos dois. Nenhuma sobrevive ao
 * `where`, o perfil fica com zero contas, e o `.filter` o remove.
 *
 * ## ⛔ "Catch-all" NÃO É "vê tudo" — é "vê o que é MEU ou de NINGUÉM"
 *
 * Um perfil cujas contas estão todas em áreas secundárias é **invisível na
 * Principal**. É contraintuitivo o bastante para ter sido observado em vez de
 * deduzido, e é por isso que o resultado está escrito aqui.
 *
 * ⚠️ Este teste ESCREVE (o recorte é do Prisma, não de função pura) — por isso
 * mora no `test:banco`. Ele cria o próprio usuário e apaga tudo por id
 * coletado, como manda a regra do incidente de 29/07.
 *
 *   npm run test:perfis-area
 */

import "dotenv/config";
import assert from "node:assert/strict";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "teste-perfis-area" });

const { prisma } = await import("../src/lib/prisma.ts");
const { perfisNoEscopo } = await import("../src/lib/facebook/perfis.ts");
const { whereDaArea } = await import("../src/lib/areas/escopoWhere.ts");

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
const conjunto = (a) => [...a].sort().join("|");

const criados = { perfis: [], contas: [], areas: [], user: null };
const tag = "tperf-" + Date.now();

try {
  console.log("\n\x1b[1m`perfisNoEscopo` — o recorte por área é INDIRETO\x1b[0m");

  const user = await prisma.user.create({ data: { email: tag + "@teste.dev", name: "t", passwordHash: "x" } });
  criados.user = user.id;

  const area = async (nome, isDefault) => {
    const w = await prisma.workspace.create({ data: { userId: user.id, name: nome, isDefault } });
    criados.areas.push(w.id);
    return w;
  };
  const perfil = async (nome) => {
    const p = await prisma.adProfile.create({
      data: { userId: user.id, fbUserId: tag + nome, name: nome, accessToken: "x" },
    });
    criados.perfis.push(p.id);
    return p;
  };
  const conta = async (p, nome, wsId) => {
    const c = await prisma.adAccount.create({
      data: { userId: user.id, adProfileId: p.id, fbAccountId: tag + "-" + nome, name: nome, workspaceId: wsId },
    });
    criados.contas.push(c.id);
    return c;
  };

  /* ── AS QUATRO FORMAS. Três não bastam: sem a 4ª, "trocar de área muda a
        lista" passa sem tocar no caso em que o perfil FICA e muda de conteúdo. */
  const principal = await area("Principal", true);
  const A = await area("Area A", false);
  const B = await area("Area B", false);

  const pA = await perfil("P-so-A");
  const cA = await conta(pA, "cA", A.id);
  const pB = await perfil("P-so-B");
  const cB = await conta(pB, "cB", B.id);
  const pO = await perfil("P-orfao");
  const cO = await conta(pO, "cO", null);
  const p4 = await perfil("P-A-e-B");
  const c4a = await conta(p4, "c4a", A.id);
  const c4b = await conta(p4, "c4b", B.id);

  const emA = await perfisNoEscopo(user.id, whereDaArea(A.id, false));
  const emB = await perfisNoEscopo(user.id, whereDaArea(B.id, false));
  const emP = await perfisNoEscopo(user.id, whereDaArea(principal.id, true));
  const contasDe = (lista, id) => lista.find((p) => p.id === id)?.accounts.map((a) => a.id) ?? null;
  const rot = (ids) =>
    "[" +
    (ids ?? []).map((i) => ({ [cA.id]: "cA", [cB.id]: "cB", [cO.id]: "cO", [c4a.id]: "c4a", [c4b.id]: "c4b" })[i] ?? i).join(", ") +
    "]";

  /* ═══ 1 · LINHA DE BASE ═════════════════════════════════════════════════ */
  secao("1 · Linha de base: as quatro formas foram criadas");
  ok(
    "1 · há 4 perfis e 5 contas",
    criados.perfis.length === 4 && criados.contas.length === 5,
    criados.perfis.length + " perfis · " + criados.contas.length + " contas",
  );
  ok("1 · as três áreas existem, e uma é a Principal", criados.areas.length === 3 && principal.isDefault === true);
  ok(
    "1 · a forma 4 tem contas nas DUAS áreas",
    c4a.workspaceId === A.id && c4b.workspaceId === B.id,
    "é ela que distingue este recorte do recorte do Pixel",
  );

  /* ═══ 2 · O CASO 4 — asserção sobre o CONJUNTO DE IDS ═════════════════════

     ⛔ Nem `length`, nem "o perfil está na lista": as duas passam com um `where`
     fixo em A. O que mede é QUAIS contas vieram.                             */
  secao("2 · A forma 4 aparece nas DUAS áreas, com conjuntos de ids DIFERENTES");
  ok(
    "2 · em A, a forma 4 traz EXATAMENTE as contas de A",
    conjunto(contasDe(emA, p4.id) ?? []) === conjunto([c4a.id]),
    rot(contasDe(emA, p4.id)),
  );
  ok(
    "2 · em B, a forma 4 traz EXATAMENTE as contas de B",
    conjunto(contasDe(emB, p4.id) ?? []) === conjunto([c4b.id]),
    rot(contasDe(emB, p4.id)),
  );

  /* 🔑 DISJUNTAS E NÃO VAZIAS — o par que prova que o conteúdo MUDOU, e não
     que uma das duas simplesmente não trouxe nada. */
  {
    const a = contasDe(emA, p4.id) ?? [];
    const b = contasDe(emB, p4.id) ?? [];
    ok("2 · 🔑 nenhuma das duas listas é vazia", a.length > 0 && b.length > 0, "A:" + a.length + " · B:" + b.length);
    ok(
      "2 · 🔑 …e elas são DISJUNTAS — o mesmo perfil, conteúdo diferente",
      a.every((x) => !b.includes(x)) && b.every((x) => !a.includes(x)),
      "é isto que um teste de presença não mede",
    );
  }

  /* ═══ 3 · 🔴 A PRINCIPAL NÃO VÊ A FORMA 4 — observado, não deduzido ═════ */
  secao("3 · 🔴 O catch-all da Principal não é 'vê tudo' — é 'meu ou de ninguém'");
  ok(
    "3 · a Principal NÃO traz a forma 4",
    !emP.some((p) => p.id === p4.id),
    "contas em áreas secundárias são invisíveis para a Principal",
  );
  ok(
    "3 · …e também não traz `P-só-A` nem `P-só-B`",
    !emP.some((p) => p.id === pA.id || p.id === pB.id),
    "mesmo motivo: nenhuma conta deles é da Principal nem órfã",
  );
  /* ⛔ LINHA DE BASE do "não traz": sem ela, os dois acima passariam com a
     Principal devolvendo lista VAZIA por qualquer motivo. */
  ok(
    "3 · ⛔ linha de base: a Principal TRAZ o órfão — ela não está vazia",
    conjunto(contasDe(emP, pO.id) ?? []) === conjunto([cO.id]),
    "é o catch-all funcionando; sem isto o 'não traz' acima não mede nada",
  );

  /* ═══ 4 · A PROVA PELO LADO NEGATIVO, DENTRO do próprio teste ═══════════

     ⛔ Regra de aceitação do dono: se a asserção não quebrar ao trocar o
     `where` por um fixo em A, ela não mede nada. Aqui isso é EXERCIDO, não
     prometido.                                                               */
  secao("4 · Invertendo o escopo de propósito — a asserção precisa cair");
  {
    const comWhereDeA = await perfisNoEscopo(user.id, whereDaArea(A.id, false));
    const daChamadaDeA = conjunto(contasDe(comWhereDeA, p4.id) ?? []);
    ok(
      "4 · 🔑 pedindo A e comparando com o esperado de B, a igualdade FALHA",
      daChamadaDeA !== conjunto([c4b.id]),
      "se passasse, a §2 estaria medindo presença, não conteúdo",
    );
    ok(
      "4 · …e a MESMA chamada, comparada com o alvo certo, passa",
      daChamadaDeA === conjunto([c4a.id]),
      "o par: não é que a comparação sempre falhe",
    );
  }

  /* ═══ 5 · AS FORMAS 1–3 continuam se comportando ═══════════════════════ */
  secao("5 · As três formas originais");
  ok("5 · `P-só-A` só aparece em A", !!contasDe(emA, pA.id) && !contasDe(emB, pA.id));
  ok("5 · `P-só-B` só aparece em B", !!contasDe(emB, pB.id) && !contasDe(emA, pB.id));
  ok(
    "5 · `P-órfão` não aparece nas secundárias",
    !contasDe(emA, pO.id) && !contasDe(emB, pO.id),
    "o órfão é da Principal, pelo catch-all",
  );
} finally {
  /* ⛔ APAGA POR ID COLETADO NA CRIAÇÃO — nunca por `LIKE` nem por nome. */
  await prisma.adAccount.deleteMany({ where: { id: { in: criados.contas } } });
  await prisma.adProfile.deleteMany({ where: { id: { in: criados.perfis } } });
  await prisma.workspace.deleteMany({ where: { id: { in: criados.areas } } });
  if (criados.user) await prisma.user.deleteMany({ where: { id: criados.user } });
  await prisma.$disconnect();
}

if (falhas.length) {
  console.log("\n\x1b[31m" + falhas.length + " falha(s):\x1b[0m\n  - " + falhas.join("\n  - "));
  process.exit(1);
}
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: 4 formas de perfil × 3 escopos, comparadas por CONJUNTO DE IDS\n");
