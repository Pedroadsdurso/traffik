/**
 * `combinaStatus` / `estaArquivado` — O FILTRO DA LISTAGEM DO GERENCIADOR.
 *
 * Ele decide o que o usuário VÊ nas três tabelas (campanhas, conjuntos,
 * anúncios) e alimenta o contador de `Arquivadas`. Seis pontos de chamada, todos
 * na `GerenciadorScreen`.
 *
 * ### 🔴 O DEFEITO QUE ELE JÁ TEVE ESTÁ ESCRITO NO PRÓPRIO ARQUIVO
 *
 * O comentário da linha do `pausado` diz, literal:
 *
 *   > Antes era `status !== "ACTIVE"`, que varria arquivados junto com pausados.
 *
 * ⚠️ **Comentário que afirma um efeito é uma afirmação TESTÁVEL** — e esta não
 * tinha teste nenhum. É o plantio A.
 *
 * ### 🔑 O QUE SE CONGELA SÃO AS RELAÇÕES ENTRE OS QUATRO FILTROS
 *
 * Nenhuma asserção aqui decora "ACTIVE casa com ativo" — isso é o valor, e o
 * valor é o que qualquer reescrita preserva por acidente. O que os dois defeitos
 * conhecidos quebram é a ESTRUTURA:
 *
 *   1. **complementaridade**  `arquivado` é exatamente o complemento de `todos`
 *   2. **contenção**          `ativo` ⊂ `todos` e `pausado` ⊂ `todos`
 *   3. **disjunção**          `ativo`, `pausado` e `arquivado` não se cruzam
 *   4. **NÃO é partição**     há status que não caem em nenhum dos três
 *
 * A 4 é contraintuitiva de propósito: ela existe para que "consertar" a lacuna
 * (fazer `pausado` = "tudo que não é ativo") seja uma reprovação, e não uma
 * arrumação. Foi exatamente esse "conserto" que produziu o defeito de origem.
 *
 * ### ⛔ E ELE LÊ `status`, NÃO `effectiveStatus` — DE PROPÓSITO
 *
 * Está registrado no `CLAUDE.md` como ACHADO ADIADO: o filtro `Ativas` lista o
 * que o usuário CONFIGUROU, incluindo o que a Meta não está entregando. É o que
 * o Gerenciador da Meta faz, e é anterior a `4e6aa9e` — medido, registrado, não
 * consertado.
 *
 * ⛔ **A asserção da §4 congela essa escolha**, porque o `CLAUDE.md` avisa que
 * quem "unificar" os dois reintroduz o defeito no Insights — que RECOMENDA em
 * vez de listar, e por isso paga em dinheiro.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { combinaStatus, estaArquivado } = await import("@/lib/ads/status");

/**
 * O universo de `status` CONFIGURADO que a Meta devolve, mais os efetivos que
 * já apareceram nesta base (`veiculacao.ts`) — porque nada impede uma linha de
 * chegar com um deles, e o filtro tem de ter resposta para todos.
 */
const UNIVERSO = [
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
  "DELETED",
  "IN_PROCESS",
  "WITH_ISSUES",
  "CAMPAIGN_PAUSED",
  "ADSET_PAUSED",
  "PENDING_REVIEW",
  "DISAPPROVED",
  "",
];

const FILTROS = ["todos", "ativo", "pausado", "arquivado"];
const casam = (filtro) => UNIVERSO.filter((s) => combinaStatus(s, filtro));

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — cada filtro casa alguma coisa, e nenhum casa tudo
 *
 * ⛔ Sem isto, um `combinaStatus` que devolvesse sempre `false` satisfaria
 * contenção e disjunção com nota máxima: o conjunto vazio é subconjunto de
 * tudo e disjunto de tudo. É `=== 0` passando com a coleção vazia, na forma
 * de teoria dos conjuntos.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n0 · linha de base — há o que filtrar");

  ok("o universo tem " + UNIVERSO.length + " status", UNIVERSO.length >= 10);
  for (const f of FILTROS) {
    const c = casam(f);
    ok("`" + f + "` casa entre 1 e " + (UNIVERSO.length - 1), c.length > 0 && c.length < UNIVERSO.length, c.join(", ") || "(nenhum)");
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · COMPLEMENTARIDADE — `arquivado` é o complemento exato de `todos`
 *
 * É a razão de o filtro existir: "todos os status" **não** inclui arquivados,
 * de propósito, porque no Gerenciador da Meta "excluir" na prática ARQUIVA — e
 * sem essa separação a listagem enche de campanha que o usuário já apagou.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · complementaridade");

  const violam = UNIVERSO.filter((s) => combinaStatus(s, "arquivado") === combinaStatus(s, "todos"));
  ok("`arquivado` e `todos` se complementam nos " + UNIVERSO.length, violam.length === 0, violam.join(", "));

  ok("`todos` NÃO inclui arquivada", combinaStatus("ARCHIVED", "todos") === false);
  ok("`todos` NÃO inclui excluída", combinaStatus("DELETED", "todos") === false);
  ok("`todos` inclui pausada", combinaStatus("PAUSED", "todos") === true);
  ok("`todos` inclui status desconhecido", combinaStatus("IN_PROCESS", "todos") === true);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · CONTENÇÃO E DISJUNÇÃO — e a §2b é o plantio que as duas derrubam
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · contenção e disjunção");

  const foraDeTodos = UNIVERSO.filter(
    (s) => (combinaStatus(s, "ativo") || combinaStatus(s, "pausado")) && !combinaStatus(s, "todos"),
  );
  ok("`ativo` ⊂ `todos` e `pausado` ⊂ `todos`", foraDeTodos.length === 0, foraDeTodos.join(", "));

  const cruzam = UNIVERSO.filter(
    (s) => ["ativo", "pausado", "arquivado"].filter((f) => combinaStatus(s, f)).length > 1,
  );
  ok("os três filtros específicos NÃO se cruzam", cruzam.length === 0, cruzam.join(", "));

  /* ── A 4ª propriedade: NÃO é partição. Existe status que não cai em nenhum
     dos três, e isso é correto — `IN_PROCESS` não foi configurado como ativo
     nem como pausado. Ela está aqui para que fechar a lacuna reprove. */
  const orfaos = UNIVERSO.filter((s) => !["ativo", "pausado", "arquivado"].some((f) => combinaStatus(s, f)));
  ok(
    "há status FORA dos três — os filtros não são uma partição",
    orfaos.length > 0,
    orfaos.join(", ") + " (aparecem só em `todos`)",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2b · PLANTIO A — `pausado` como "tudo que não é ativo"
 *
 * É o defeito de origem, e é o conserto que alguém faria ao ver `IN_PROCESS`
 * não aparecer em filtro nenhum. Ele quebra DUAS das quatro propriedades.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2b · plantio A — o defeito de origem");

  const plantio = (status, filtro) => {
    if (filtro === "arquivado") return estaArquivado(status);
    if (filtro === "ativo") return status === "ACTIVE";
    if (filtro === "pausado") return status !== "ACTIVE"; // ← o defeito
    return !estaArquivado(status);
  };

  const foraDeTodos = UNIVERSO.filter(
    (s) => plantio(s, "pausado") && !plantio(s, "todos"),
  );
  ok(
    "PLANTIO A: a contenção DERRUBA — arquivadas aparecem em `Pausadas`",
    foraDeTodos.length > 0,
    foraDeTodos.join(", "),
  );

  const cruzam = UNIVERSO.filter((s) => plantio(s, "pausado") && plantio(s, "arquivado"));
  ok("PLANTIO A: a disjunção DERRUBA", cruzam.length > 0, cruzam.join(", "));

  /* ── PAR NEGATIVO, e é ele que explica por que o defeito sobreviveu:
     sobre ACTIVE e PAUSED — os dois únicos status que alguém testaria à mão —
     as duas versões CONCORDAM. A divergência mora só nos arquivados. */
  const comuns = ["ACTIVE", "PAUSED"];
  ok(
    "PAR NEGATIVO: em ACTIVE e PAUSED as duas versões concordam nos 4 filtros",
    comuns.every((s) => FILTROS.every((f) => plantio(s, f) === combinaStatus(s, f))),
    "por isso ele passou despercebido",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · `estaArquivado` — DUAS palavras, e a segunda é a que o usuário usou
 *
 * `DELETED` não é um estado exótico: é o que a Meta grava quando o usuário
 * clica em "excluir" no Gerenciador dela. Esquecê-lo é fazer a campanha que a
 * pessoa apagou voltar para a listagem.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · estaArquivado");

  ok("ARCHIVED é arquivado", estaArquivado("ARCHIVED") === true);
  ok("DELETED é arquivado", estaArquivado("DELETED") === true);
  ok("ACTIVE não é", estaArquivado("ACTIVE") === false);
  ok("PAUSED não é", estaArquivado("PAUSED") === false);
  ok("vazio não é", estaArquivado("") === false);
  ok("minúscula NÃO casa — o status vem em caixa alta da Meta", estaArquivado("archived") === false);

  /* ── PLANTIO B: só `ARCHIVED`. */
  {
    const soArchived = (s) => s === "ARCHIVED";
    ok(
      "PLANTIO B: a campanha EXCLUÍDA deixa de ser arquivada",
      soArchived("DELETED") === false && estaArquivado("DELETED") === true,
      "ela volta para a listagem de `todos`",
    );

    const divergem = UNIVERSO.filter((s) => soArchived(s) !== estaArquivado(s));
    ok(
      "PAR NEGATIVO: as duas versões divergem em EXATAMENTE 1 status",
      divergem.length === 1 && divergem[0] === "DELETED",
      divergem.join(", ") + " — em ARCHIVED elas concordam, que é o caso que alguém testaria",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · GUARDAS ESTRUTURAIS — o que asserção de valor não alcança
 *
 * ⚠️ As duas miram SINTAXE, não palavra solta, e apagam comentário antes de
 * medir: o cabeçalho do módulo tem 20 linhas de prosa que citam os nomes.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · guardas estruturais");

  const bruto = readFileSync("src/lib/ads/status.ts", "utf8").replace(/\r\n/g, "\n");
  const fonte = bruto
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");

  ok("linha de base: o apagador deixou código", /export function combinaStatus/.test(fonte));
  ok(
    "linha de base: e ele APAGOU prosa (senão não faz nada)",
    bruto.length > fonte.replace(/ /g, "").length + 500,
    bruto.length + " bytes crus",
  );

  /* ── 4a: todo valor de `FiltroStatus` tem um ramo.
     ⛔ `combinaStatus` recebe `filtro: string`, não `FiltroStatus` — então o
     compilador NÃO cobra isto. Um quinto valor no tipo, sem ramo, cairia no
     `return` final e listaria TUDO em silêncio, com cara de filtro funcionando.
     A lista é LIDA do tipo, nunca copiada: uma cópia aqui envelheceria no
     primeiro nome que mudasse, e o teste passaria a medir a própria cópia. */
  {
    const m = fonte.match(/export type FiltroStatus =([^;]+);/);
    ok("linha de base: o tipo `FiltroStatus` foi lido do arquivo", !!m);
    const doTipo = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    ok("o tipo declara " + doTipo.length + " filtros", doTipo.length >= 4, doTipo.join(" | "));

    /* O último ramo é o `return` sem `if` — é o default, e por desenho ele é o
       `todos`. Os outros três precisam de `if (filtro === "x")` explícito. */
    const comRamo = doTipo.filter((f) => new RegExp('filtro === "' + f + '"').test(fonte));
    const semRamo = doTipo.filter((f) => !comRamo.includes(f) && f !== "todos");
    ok(
      "todo filtro do tipo tem ramo próprio (menos `todos`, que é o default)",
      semRamo.length === 0,
      semRamo.length ? "SEM RAMO: " + semRamo.join(", ") : comRamo.join(", ") + " + todos(default)",
    );

    /* E o default é frouxo de propósito: filtro desconhecido lista tudo que não
       é arquivado. Congelado para a queda ser uma decisão, não uma surpresa. */
    ok(
      "filtro DESCONHECIDO cai no comportamento de `todos`",
      UNIVERSO.every((s) => combinaStatus(s, "rascunho") === combinaStatus(s, "todos")),
      "é o que aconteceria com um valor novo do tipo sem ramo",
    );
  }

  /* ── 4b: o módulo lê `status`, e NÃO `effectiveStatus`.
     ⛔ Está registrado como ACHADO ADIADO no `CLAUDE.md`. A escolha é
     deliberada e a asserção existe para que "unificar os dois" seja uma
     reprovação com motivo escrito — o Insights escolheu o EFETIVO de propósito,
     e lá o produto RECOMENDA em vez de listar. */
  ok(
    "o filtro da LISTAGEM não menciona `effectiveStatus`",
    !/effectiveStatus/.test(fonte),
    "escolha registrada: a listagem mostra o CONFIGURADO, como o Gerenciador da Meta",
  );
}

console.log(
  "\n\x1b[33m  ⚠️  REGISTRADO, NÃO CONSERTADO: o filtro lê `status` (configurado)," +
    "\n      então `Ativas` lista campanha que a Meta não está entregando." +
    "\n      É ACHADO ADIADO do CLAUDE.md, anterior a `4e6aa9e`.\x1b[0m",
);
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
