/**
 * `despesaVale` × `whereDespesasDaArea` — DUAS IMPLEMENTAÇÕES DA MESMA
 * PERGUNTA, e elas DISCORDAVAM.
 *
 * A pergunta que as duas respondem é uma só: *"esta despesa entra no cálculo
 * desta área?"*. Uma responde em memória, a outra vira `where` do Prisma. E o
 * comentário que vive entre elas, no mesmo arquivo, afirma:
 *
 *   > `where` do Prisma **equivalente** ao `despesaVale`, para filtrar na consulta.
 *
 * ⛔ **Elas não eram equivalentes.** Medido em 14/08/2026:
 *
 *   despesaVale({ workspaceId: null }, "area-A")  ->  false   (a nula NÃO entrava)
 *   whereDespesasDaArea("area-A")                 ->  OR [ null, "area-A" ]
 *                                                     (a nula ENTRA)
 *
 * ### 🔎 A PROCEDÊNCIA — as duas estavam certas no dia em que nasceram
 *
 * | | commit | data | semântica |
 * |---|---|---|---|
 * | `despesaVale` | `8b9b162` | **30/07/2026** | NULO não vale — "cada área com as suas próprias taxas" |
 * | `whereDespesasDaArea` | `3be5d39` | **04/08/2026** | NULO vale para todas — e o commit se chama *"DESPESA QUE NAO ERA DESCONTADA"* |
 *
 * A de 04/08 foi escrita **para consertar** o comportamento estrito, que estava
 * descartando TODA despesa cadastrada do cálculo de lucro (o `CLAUDE.md`
 * registra: cinco descontos cadastrados, painel mostrando `− R$ 0,00`). A de
 * 30/07 ficou para trás com a semântica revogada — e o comentário da nova
 * passou a chamá-la de equivalente.
 *
 * ### ✅ CORRIGIDO EM 14/08/2026 — a FUNÇÃO, não o comentário
 *
 * O dono pediu "corrija o comentário ou a função". A função é a correção mais
 * forte: consertar só a prosa deixaria de pé um helper que devolve a resposta
 * revogada para qualquer chamador futuro. Hoje `despesaVale` inclui o nulo, e o
 * `whereDespesasDaArea` volta a ser honestamente equivalente a ela.
 *
 * ⚠️ **Nenhum comportamento mudou**, e é verificável: `despesaVale` tinha ZERO
 * chamadores de produção no momento do alinhamento. A §3 continua medindo e
 * IMPRIMINDO essa contagem.
 *
 * ### ⛔ O QUE ESTE ARQUIVO CONGELA AGORA É O ACORDO, e ele é mais forte
 *
 * A versão anterior congelava a divergência, para que ninguém a unificasse sem
 * decidir o lado. O lado foi decidido, e o que fica é a exigência de que as
 * duas concordem em TODAS as entradas — com linha de base dos dois desfechos,
 * senão duas funções que devolvessem sempre `true` concordariam com nota
 * máxima.
 *
 * ⚠️ E a contagem de consumidores **apaga os comentários antes de medir**: os
 * dois arquivos citam `despesaVale` pelo nome, na prosa, justamente para
 * explicá-lo. É a família *guarda por texto medindo PROSA*, que esta base já
 * pagou nove vezes.
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
 * 1 · O ACORDO — as duas concordam em TODAS as entradas
 *
 * ⛔ Esta seção congelava a DIVERGÊNCIA até 14/08/2026: ela afirmava que as
 * duas discordavam em exatamente uma entrada (`workspaceId: null`), e existia
 * para que ninguém as unificasse sem decidir para que lado.
 *
 * ✅ O lado foi decidido — o `despesaVale` passou a incluir o nulo, que é a
 * semântica que o `where` já usava e que de fato roda. Agora se congela o
 * ACORDO, e ele é mais forte que a divergência era: qualquer mudança em
 * qualquer um dos dois lados que os separe reprova aqui, em vez de produzir
 * dois números de lucro na mesma conta.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · o acordo entre a função e o `where`");

  const universo = [
    { workspaceId: AREA },
    { workspaceId: OUTRA },
    { workspaceId: "area-C" },
    { workspaceId: "" },
    { workspaceId: null },
  ];

  const discordam = universo.filter((d) => despesaVale(d, AREA) !== whereAceita(AREA, d));
  ok(
    "concordam nas " + universo.length + " entradas",
    discordam.length === 0,
    discordam.length ? "DISCORDAM em: " + JSON.stringify(discordam) : "",
  );

  /* ⛔ LINHA DE BASE DO ACORDO, e sem ela a §1 não mede nada: duas funções que
     devolvessem `true` para tudo — ou `false` para tudo — concordariam com nota
     máxima. O universo precisa produzir os DOIS desfechos. */
  const aceitas = universo.filter((d) => despesaVale(d, AREA));
  ok(
    "linha de base: o universo produz aceitas E recusadas",
    aceitas.length > 0 && aceitas.length < universo.length,
    aceitas.length + " de " + universo.length + " aceitas",
  );

  /* As duas metades nomeadas, para o relatório dizer o que cada uma faz. */
  ok("a despesa DA ÁREA entra", despesaVale({ workspaceId: AREA }, AREA) === true);
  ok("a despesa de OUTRA área não entra", despesaVale({ workspaceId: OUTRA }, AREA) === false);
  ok(
    "🔴 a despesa SEM DONO entra — nulo é GLOBAL, não 'sem área'",
    despesaVale({ workspaceId: null }, AREA) === true,
    "é uma das duas linhas vermelhas da tabela de nulos do CLAUDE.md",
  );
  ok("e ela entra para QUALQUER área", despesaVale({ workspaceId: null }, OUTRA) === true);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · PLANTIO — os dois "consertos" que separam as duas de novo
 *
 * Eles são simétricos, e os custos são opostos. Antes de 14/08 um deles era o
 * estado real do repositório.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · plantio — os dois jeitos de separá-las");

  /* ── A: o `despesaVale` volta a ser estrito.
     Era o estado até 14/08, e é o "conserto" de quem lê a decisão de 30/07
     ("cada área com as suas próprias taxas") sem ver a correção de 04/08. */
  {
    const estrito = (d, areaId) => d.workspaceId === areaId;
    const discordam = [{ workspaceId: AREA }, { workspaceId: OUTRA }, { workspaceId: null }].filter(
      (d) => estrito(d, AREA) !== whereAceita(AREA, d),
    );
    ok(
      "PLANTIO A (função estrita): a asserção do acordo DERRUBA",
      discordam.length > 0,
      JSON.stringify(discordam),
    );
    /* ⚠️ PAR NEGATIVO: com dono, o estrito e o catch-all concordam. A separação
       mora só no nulo — e é por isso que ela sobreviveu duas semanas. */
    const comDono = [{ workspaceId: AREA }, { workspaceId: OUTRA }, { workspaceId: "area-C" }];
    ok(
      "PAR NEGATIVO: com dono, o estrito concorda com o `where` nas " + comDono.length,
      comDono.every((d) => estrito(d, AREA) === whereAceita(AREA, d)),
      "o caso comum é uma despesa com dono — por isso ninguém viu",
    );
  }

  /* ── B: o `where` vira estrito.
     É o lado CARO, e é literalmente o defeito de 04/08: taxa de gateway e
     imposto nascem GLOBAIS, então o filtro estrito descarta todo desconto e o
     lucro sai maior que a realidade, com número plausível. */
  {
    const aceitaEstrito = (d) => d.workspaceId === AREA;
    ok(
      "PLANTIO B (where estrito): a despesa GLOBAL some do cálculo",
      aceitaEstrito({ workspaceId: null }) === false,
      "foi assim que o painel mostrou `Taxas de gateway − R$ 0,00`",
    );
    ok(
      "PLANTIO B: e a asserção do acordo DERRUBA",
      aceitaEstrito({ workspaceId: null }) !== despesaVale({ workspaceId: null }, AREA),
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

  /* ⚠️ ESTA ASSERÇÃO MUDOU DE PAPEL EM 14/08/2026.
     Ela era `forasteiros.length === 0`, e existia porque a AUSÊNCIA de
     consumidor era o que tornava a divergência inofensiva. Com as duas
     alinhadas, um consumidor deixou de ser perigo — e mantê-la assim faria a
     suíte reprovar no dia em que alguém usasse a função corretamente.

     ⛔ O que protege agora é a §1 (o acordo). Aqui fica a MEDIÇÃO, impressa:
     ela responde "nenhum comportamento mudou no alinhamento?" para quem for
     auditar este commit depois. */
  console.log(
    "   consumidores de produção: " +
      forasteiros.length +
      (forasteiros.length
        ? "\n     " + forasteiros.join("\n     ")
        : "  (era 0 quando as duas foram alinhadas)"),
  );
  ok(
    "a contagem de consumidores é MENSURÁVEL",
    Number.isInteger(forasteiros.length),
    forasteiros.length + " hoje — o que protege é o acordo da §1, não este número",
  );
}

console.log(
  "\n\x1b[32m  ✅ CORRIGIDO EM 14/08/2026: `despesaVale` (30/07) devolvia `false`" +
    "\n      para `workspaceId: null` enquanto o `whereDespesasDaArea` (04/08) o" +
    "\n      INCLUI — com o comentário entre as duas as declarando equivalentes." +
    "\n      A função foi alinhada ao `where`, que é o que de fato roda." +
    "\n" +
    "\n      O que segurava era ela não ter consumidor — um acidente. Agora o que" +
    "\n      segura é o ACORDO, sob asserção.\x1b[0m",
);
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
