/**
 * `despesaVale` × `whereDespesasDaArea` — DUAS IMPLEMENTAÇÕES DA MESMA
 * PERGUNTA, e elas DISCORDAM.
 *
 * A pergunta que as duas respondem é uma só: *"esta despesa entra no cálculo
 * desta área?"*. Uma responde em memória, a outra vira `where` do Prisma. E o
 * comentário que vive entre elas, no mesmo arquivo, afirma:
 *
 *   > `where` do Prisma **equivalente** ao `despesaVale`, para filtrar na consulta.
 *
 * ⛔ **Elas não são equivalentes.** Medido em 14/08/2026:
 *
 *   despesaVale({ workspaceId: null }, "area-A")  ->  false   (a nula NÃO entra)
 *   whereDespesasDaArea("area-A")                 ->  OR [ null, "area-A" ]
 *                                                     (a nula ENTRA)
 *
 * ### 🔎 A PROCEDÊNCIA — as duas estão certas para o dia em que nasceram
 *
 * | | commit | data | semântica |
 * |---|---|---|---|
 * | `despesaVale` | `8b9b162` | **30/07/2026** | NULO não vale — "cada área com as suas próprias taxas" |
 * | `whereDespesasDaArea` | `3be5d39` | **04/08/2026** | NULO vale para todas — e o commit se chama *"DESPESA QUE NAO ERA DESCONTADA"* |
 *
 * Ou seja: a de 04/08 foi escrita **para consertar** o comportamento estrito, que
 * estava descartando TODA despesa cadastrada do cálculo de lucro (o `CLAUDE.md`
 * registra: cinco descontos cadastrados, painel mostrando `− R$ 0,00`). A de
 * 30/07 ficou para trás com a semântica antiga — e o comentário da nova passou a
 * chamá-la de equivalente.
 *
 * ### ⛔ POR QUE ISTO NÃO É CONSERTADO AQUI
 *
 * Os dois commits são anteriores a `4e6aa9e`: **código congelado**. A regra do
 * `CLAUDE.md` é MEDE · REGISTRA · AVISA — e a linha do `Expense.workspaceId` é
 * uma das duas vermelhas da tabela de NULOS: ali nulo **amplia escopo**, então
 * mexer no lado errado muda número de lucro em produção sem ninguém decidir.
 *
 * ### 🔑 O QUE SEGURA O DEFEITO HOJE É O `despesaVale` NÃO TER CONSUMIDOR
 *
 * A divergência é inofensiva **enquanto ninguém chamar a versão estrita**.
 * Medido: zero consumidores de produção. Por isso a contagem é ASSERÇÃO e não
 * nota de rodapé — no dia em que alguém ligar o `despesaVale` numa tela, a
 * divergência deixa de ser histórica e vira dois números de lucro diferentes na
 * mesma conta. O teste força a decisão nesse dia, em vez de descobri-la depois.
 *
 * ⚠️ E a contagem de consumidores **apaga os comentários antes de medir**: o
 * vizinho cita `despesaVale` pelo nome, na prosa, justamente para explicá-lo. É
 * a família *guarda por texto medindo PROSA*, que esta base já pagou seis vezes.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { despesaVale, whereDespesasDaArea } = await import("@/lib/areas/precedencia");

const AREA = "area-A";
const OUTRA = "area-B";

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — o `where` tem a FORMA que o avaliador abaixo sabe ler
 *
 * ⛔ Sem isto, uma mudança de forma (`AND`, `in`, `not`) faria o avaliador
 * devolver um booleano plausível sobre um objeto que ele não entende — que é
 * exatamente *a medição não acertou o alvo*. Aqui ele passa a RECUSAR.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n0 · linha de base — a forma do `where`");

  const w = whereDespesasDaArea(AREA);
  ok("o `where` é um OR", Array.isArray(w.OR), JSON.stringify(w));
  ok("o OR tem exatamente 2 ramos", w.OR.length === 2);
  ok(
    "todo ramo é `{ workspaceId: <valor> }` e nada mais",
    w.OR.every((r) => Object.keys(r).length === 1 && "workspaceId" in r),
  );
  ok("o `where` NÃO tem outra chave além de OR", Object.keys(w).length === 1);
}

/** Avalia o `where` contra uma linha. Só sabe ler a forma afirmada na §0. */
const whereAceita = (areaId, despesa) =>
  whereDespesasDaArea(areaId).OR.some((r) => r.workspaceId === despesa.workspaceId);

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · A DIVERGÊNCIA — e ela está confinada a EXATAMENTE UMA entrada
 *
 * Esta é a relação congelada, e não o valor de nenhuma das duas: para toda
 * despesa com dono, as duas CONCORDAM; para a despesa sem dono, elas discordam.
 *
 * ⛔ É o confinamento que importa. Se um dia elas passarem a discordar noutra
 * entrada, o defeito deixou de ser o histórico conhecido e virou outro.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · a divergência, confinada a uma entrada só");

  const universo = [
    { workspaceId: AREA },
    { workspaceId: OUTRA },
    { workspaceId: "area-C" },
    { workspaceId: "" },
    { workspaceId: null },
  ];

  const discordam = universo.filter((d) => despesaVale(d, AREA) !== whereAceita(AREA, d));

  ok(
    "discordam em EXATAMENTE 1 das " + universo.length + " entradas",
    discordam.length === 1,
    JSON.stringify(discordam),
  );
  ok("e a entrada da discordância é `workspaceId: null`", discordam[0].workspaceId === null);

  /* As duas metades nomeadas, para o relatório dizer QUAL lado faz o quê. */
  ok("estrito: a despesa SEM DONO não vale para a área", despesaVale({ workspaceId: null }, AREA) === false);
  ok("catch-all: a despesa SEM DONO entra na consulta", whereAceita(AREA, { workspaceId: null }) === true);

  /* E o par negativo do confinamento: com dono, os dois concordam sempre —
     inclusive quando a resposta é NÃO. É por isso que a divergência nunca
     apareceu: o caso comum é uma despesa com dono. */
  const comDono = universo.filter((d) => d.workspaceId !== null);
  ok(
    "com dono, os dois concordam nas " + comDono.length + " entradas",
    comDono.every((d) => despesaVale(d, AREA) === whereAceita(AREA, d)),
  );
  ok("e concordam também quando a resposta é NÃO", despesaVale({ workspaceId: OUTRA }, AREA) === false && whereAceita(AREA, { workspaceId: OUTRA }) === false);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · PLANTIO — os dois "consertos" que alguém faria ao ler o comentário
 *
 * O comentário diz que são equivalentes. Quem o ler vai querer torná-las
 * equivalentes — e há dois jeitos, com custos opostos. As asserções da §1
 * derrubam os dois, cada uma por um motivo diferente.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · plantio — os dois lados do 'conserto'");

  /* ── A: alinhar o `despesaVale` ao `where` (nulo passa a valer).
     É o lado BARATO de errar — mas é mudança de comportamento em código
     congelado, e é a semântica que o dono REVERTEU em 30/07. */
  {
    const frouxo = (d, areaId) => d.workspaceId === areaId || d.workspaceId === null;
    const aindaDiscordam = [{ workspaceId: AREA }, { workspaceId: OUTRA }, { workspaceId: null }].filter(
      (d) => frouxo(d, AREA) !== whereAceita(AREA, d),
    );
    ok("PLANTIO A (nulo vale): a asserção da divergência DERRUBA", aindaDiscordam.length === 0);
  }

  /* ── B: alinhar o `where` ao `despesaVale` (nulo deixa de entrar).
     É o lado CARO, e é literalmente o defeito de 04/08: taxa de gateway e
     imposto nascem GLOBAIS, então o filtro estrito descarta todo desconto e o
     lucro sai maior que a realidade, com número plausível. */
  {
    const whereEstrito = () => ({ workspaceId: AREA });
    const aceitaEstrito = (d) => whereEstrito().workspaceId === d.workspaceId;
    ok(
      "PLANTIO B (where estrito): a despesa GLOBAL some do cálculo",
      aceitaEstrito({ workspaceId: null }) === false,
    );
    ok(
      "PLANTIO B: e a asserção do catch-all DERRUBA",
      aceitaEstrito({ workspaceId: null }) !== whereAceita(AREA, { workspaceId: null }),
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · O QUE SEGURA A DIVERGÊNCIA: zero consumidores de produção
 *
 * ⚠️ A medição APAGA COMENTÁRIO antes de contar. O `whereDespesasDaArea` cita
 * `despesaVale` na própria prosa ("`where` do Prisma equivalente ao
 * `despesaVale`"), e um `grep` cru contaria essa linha como uso.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · consumidores de produção do `despesaVale`");

  const { globSync } = await import("node:fs");
  const arquivos = globSync("src/**/*.{ts,tsx}").filter((f) => !f.includes("generated"));

  ok("linha de base: há fontes para varrer", arquivos.length > 50, arquivos.length + " arquivos");

  const semComentario = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");

  const usos = [];
  for (const f of arquivos) {
    const fonte = semComentario(readFileSync(f, "utf8").replace(/\r\n/g, "\n"));
    fonte.split("\n").forEach((linha, i) => {
      if (/\bdespesaVale\b/.test(linha)) usos.push(`${f}:${i + 1}  ${linha.trim()}`);
    });
  }

  /* A declaração dele é um "uso" no arquivo dele mesmo — ela não conta. */
  const forasteiros = usos.filter((u) => !/precedencia\.ts:\d+\s+export function despesaVale/.test(u));

  /* Linha de base do apagador: sem ele, a prosa do vizinho apareceria. */
  const cruas = readFileSync("src/lib/areas/precedencia.ts", "utf8").split(/\r?\n/)
    .filter((l) => /\bdespesaVale\b/.test(l)).length;
  ok(
    "o apagador de comentário MUDA a contagem (senão ele não faz nada)",
    cruas > 1,
    cruas + " linhas cruas citam o nome, e só 1 é código",
  );

  ok(
    "`despesaVale` tem ZERO consumidores de produção",
    forasteiros.length === 0,
    forasteiros.length ? "\n      " + forasteiros.join("\n      ") : "e é isso que torna a divergência histórica em vez de ativa",
  );
}

console.log(
  "\n\x1b[33m  ⚠️  ACHADO REGISTRADO, NÃO CORRIGIDO: `despesaVale` (30/07) e" +
    "\n      `whereDespesasDaArea` (04/08) discordam em `workspaceId: null`," +
    "\n      e o comentário entre as duas as declara equivalentes." +
    "\n      Os dois commits são anteriores a `4e6aa9e` — congelados.\x1b[0m",
);
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
