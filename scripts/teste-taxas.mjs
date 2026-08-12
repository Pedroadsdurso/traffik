/**
 * A TELA DE TAXAS EDITA A CONTA QUE O DASHBOARD INTEIRO MOSTRA.
 *
 * O que se cadastra ali alimenta o **Lucro** e o **break-even**, e o break-even
 * é a linha de referência do gráfico Receita × Gasto. Um número errado aqui não
 * aparece aqui — aparece lá, com cara de resultado.
 *
 * ## As quatro coisas que este arquivo prova
 *
 * | # | O que | O valor que o caso ERRADO produziria |
 * |---|---|---|
 * | 1 | a frase de INCIDÊNCIA distingue as grandezas | "2,50" e "3,5" como número solto, e ninguém sabe sobre o que incidem |
 * | 2 | 🔴 `Expense.workspaceId` não é anulável pelo formulário | despesa de UMA operação descontada do lucro de TODAS |
 * | 3 | o padrão do seletor É o padrão que o código já usava | seletor mudando o resultado de quem não mexe nele |
 * | 4 | o aviso de `UNICA` aparece porque EXISTE linha assim | aviso preso a um seletor que nem oferece a opção |
 *
 * ⚠️ CRLF: toda leitura de arquivo normaliza a quebra, e toda âncora leva LINHA
 * DE BASE. São 402 arquivos versionados em CRLF nesta base, e uma âncora que não
 * casa devolve "não achei" com a mesma cara de "está tudo certo".
 *
 * Puro: sem banco, sem rede. ⚠️ Roda com `tsx` (lê `.tsx`).
 *
 *   npm run test:taxas
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { incidencia, foraDoCalculo, FREQUENCIAS, FREQUENCIA_PADRAO, AVISO_UNICA, GRUPOS } =
  await import("../src/lib/taxas/apresentacao.ts");
/* ⛔ Importa a SEÇÃO, não a tela: `TaxasScreen` puxa server actions que
   carregam o prisma, e importar o prisma lança sem `DATABASE_URL`. A composição
   das duas seções é conferida por guarda de texto, logo abaixo. */
const { SecaoTaxas } = await import("../src/components/dashboard/views/taxas/SecaoTaxas.tsx");

let ok = 0;
const falhas = [];
function checar(nome, fn) {
  try {
    fn();
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome}`);
  } catch (e) {
    falhas.push(nome);
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      ${e.message}`);
  }
}

const fonte = (p) => readFileSync(new URL(p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const ACOES = fonte("../src/lib/actions/expenses.ts");
const HOOK = fonte("../src/components/dashboard/useTraffikState.ts");
const TELA = fonte("../src/components/dashboard/views/taxas/TaxasScreen.tsx");
const SECAO = fonte("../src/components/dashboard/views/taxas/SecaoTaxas.tsx");
const RATEIO = fonte("../src/lib/despesas/rateio.ts");

/* ── 1. A LINGUAGEM — sobre O QUE cada linha incide ───────────────────────── */

console.log("\n1 — a frase de incidência distingue as grandezas");

/**
 * Normaliza o espaço NÃO-QUEBRÁVEL.
 *
 * ⚠️ `toLocaleString("pt-BR", { style: "currency" })` emite U+00A0 entre "R\$" e o
 * número — e a diferença é INVISÍVEL na saída do assert: as duas strings
 * aparecem idênticas no diff, e a falha parece um bug do teste. Achado aqui em
 * 12/08/2026, com três asserções vermelhas e nada aparente para corrigir.
 *
 * ⛔ Normalizar é o certo, e não trocar o esperado por " ": o que se afirma é
 * a FRASE, e o tipo de espaço é detalhe do formatador. Codificar o NBSP na
 * asserção a prenderia à implementação do Intl.
 */
const n = (t) => t.replace(/ /g, " ");

const gw = (extra) => ({ type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount: 3.5, paymentMethod: null, recurrence: "MENSAL", ...extra });

checar("FIXO restrito a uma forma diz o valor, a unidade E a forma", () => {
  assert.equal(n(incidencia(gw({ calc: "FIXO", amount: 2.5, paymentMethod: "PIX" }))), "R$ 2,50 por venda no Pix");
  assert.equal(n(incidencia(gw({ calc: "FIXO", amount: 1, paymentMethod: "BOLETO" }))), "R$ 1,00 por venda no boleto");
});

checar("PERCENTUAL sem forma AFIRMA a abrangência — não deixa deduzir", () => {
  /* "3,5%" sozinho obrigaria o leitor a concluir a ausência de restrição, e
     ausência não se lê. A frase diz `sobre toda venda`. */
  assert.equal(n(incidencia(gw({}))), "3,5% sobre toda venda");
});

checar("as DUAS formas do conflito saem diferentes uma da outra", () => {
  const fixaNoPix = incidencia(gw({ calc: "FIXO", amount: 2.5, paymentMethod: "PIX" }));
  const percentualGlobal = incidencia(gw({}));
  assert.notEqual(fixaNoPix, percentualGlobal);
  /* E a diferença é de CONTEÚDO, não de número: uma nomeia a forma de pagamento
     e a outra nomeia a abrangência. */
  assert.ok(fixaNoPix.includes("no Pix"), fixaNoPix);
  assert.ok(percentualGlobal.includes("toda venda"), percentualGlobal);
});

checar("despesa fixa diz o PERÍODO, e cada frequência tem o seu", () => {
  const d = (recurrence) => ({ type: "DESPESA_RECORRENTE", calc: "FIXO", amount: 500, paymentMethod: null, recurrence });
  assert.equal(n(incidencia(d("MENSAL"))), "R$ 500,00 por mês");
  assert.equal(n(incidencia(d("ANUAL"))), "R$ 500,00 por ano");
  assert.equal(n(incidencia(d("DIARIA"))), "R$ 500,00 por dia");
  assert.equal(n(incidencia(d("SEMANAL"))), "R$ 500,00 por semana");
});

checar("`UNICA` NOMEIA a ausência de período em vez de terminar no número", () => {
  const s = incidencia({ type: "DESPESA_RECORRENTE", calc: "FIXO", amount: 300, paymentMethod: null, recurrence: "UNICA" });
  /* Terminar em "R$ 300,00" seria indistinguível de uma linha bem formada. */
  assert.equal(n(s), "R$ 300,00 — sem período");
});

/* ── 2. 🔴 A LINHA VERMELHA — workspaceId NULO amplia escopo ──────────────── */

console.log("\n2 — o formulário não pode anular `Expense.workspaceId`");

checar("linha de base: as três funções existem para examinar", () => {
  assert.ok(ACOES.includes("export async function createExpense"), "createExpense sumiu");
  assert.ok(ACOES.includes("export async function updateExpense"), "updateExpense sumiu");
  assert.ok(HOOK.includes("criarDespesa: async"), "o criador da tela nova sumiu do hook");
});

checar("CRIAR grava a área — o `workspaceId` sai do escopo, não de um default", () => {
  const i = ACOES.indexOf("export async function createExpense");
  const corpo = ACOES.slice(i, ACOES.indexOf("export async function updateExpense"));
  assert.ok(
    corpo.includes("workspaceId: escopo.areaId || null"),
    "createExpense não grava mais `escopo.areaId` — despesa nova nasceria valendo para TODAS as áreas",
  );
});

checar("a TELA passa a área ativa, e não chama `createExpense` por fora", () => {
  /* Chamar a ação direto da tela pularia o `s.workspaceAtiva` do hook. */
  assert.ok(!SECAO.includes("createExpense("), "a tela chama createExpense direto, pulando a área ativa");
  assert.ok(SECAO.includes("v.criarDespesa("), "linha de base: a tela não usa o criador do hook");

  const i = HOOK.indexOf("criarDespesa: async");
  assert.ok(i > 0, "linha de base: `criarDespesa` não está no hook");
  const corpo = HOOK.slice(i, i + 1200);
  assert.ok(
    /workspaceId:\s*s\.workspaceAtiva/.test(corpo),
    "`criarDespesa` não carrega a área ativa — a despesa nasceria valendo para TODAS",
  );
});

checar("EDITAR não pode zerar o campo — é estrutural, não disciplina", () => {
  /* O patch de `updateExpense` é um `Pick` de três campos. `workspaceId` não
     está entre eles, e `ExpenseDTO` sequer o declara — então não existe valor
     do tipo certo que carregue a anulação. */
  const i = ACOES.indexOf("export async function updateExpense");
  assert.ok(i > 0, "linha de base: updateExpense sumiu");
  const assinatura = ACOES.slice(i, ACOES.indexOf("{", ACOES.indexOf(")", i)));
  /* 🔴 A PRIMEIRA VERSÃO DESTA GUARDA PASSOU COM A PORTA ABERTA, e o modo de
     falha é o de sempre nesta base: ela procurava o `Pick<...>` e o `Pick`
     continua lá quando alguém ANEXA `& { workspaceId?: ... }` depois dele.
     Achado ao provar pelo lado negativo, em 12/08/2026.

     Hoje ela afirma duas coisas: que o Pick é o de três campos, E que o tipo do
     patch não menciona `workspaceId` de forma nenhuma. A segunda é a que
     realmente fecha a porta — a primeira sozinha mede a presença do certo, não
     a ausência do errado. */
  assert.ok(
    /Pick<ExpenseDTO,\s*"amount"\s*\|\s*"name"\s*\|\s*"active">/.test(assinatura),
    `o patch deixou de ser o Pick de três campos: ${assinatura.slice(0, 160)}`,
  );
  assert.ok(
    !/workspaceId/.test(assinatura),
    `a assinatura de updateExpense passou a aceitar workspaceId: ${assinatura.slice(0, 200)}`,
  );

  const dto = ACOES.slice(ACOES.indexOf("export interface ExpenseDTO"), ACOES.indexOf("async function requireUserId"));
  assert.ok(dto.length > 50, "linha de base: o DTO não foi encontrado");
  assert.ok(
    !dto.includes("workspaceId"),
    "`ExpenseDTO` passou a declarar `workspaceId` — e aí um patch consegue carregá-lo",
  );
});

checar("e o hook não abre uma segunda porta para editar", () => {
  const i = HOOK.indexOf("editarDespesa: async");
  assert.ok(i > 0, "linha de base: `editarDespesa` não está no hook");
  const corpo = HOOK.slice(i, i + 700);
  assert.ok(!corpo.includes("workspaceId"), "`editarDespesa` menciona workspaceId");
});

/* ── 3. O PADRÃO DO SELETOR É O QUE O CÓDIGO JÁ FAZIA ─────────────────────── */

console.log("\n3 — o seletor torna visível uma escolha que já era tomada");

checar("`UNICA` NÃO está entre as opções oferecidas", () => {
  const valores = FREQUENCIAS.map((f) => f.valor);
  assert.ok(valores.length === 4, `esperava 4 frequências, veio ${valores.length}`);
  assert.ok(!valores.includes("UNICA"), "o seletor voltou a oferecer `UNICA` — ver a nota em FREQUENCIAS");
});

checar("o padrão do seletor É o fallback de `createExpense`", () => {
  /* 🔑 A pergunta nova do CLAUDE.md: *que valor deveria ser IGUAL a este, e é?*
     Se alguém mudar o fallback da ação, o padrão da tela diverge em silêncio —
     e o sintoma seria uma despesa nascendo com frequência diferente da que o
     seletor mostra. */
  const m = ACOES.match(/recurrence:\s*input\.recurrence\s*\?\?\s*"([A-Z]+)"/);
  assert.ok(m, "linha de base: o fallback de recurrence sumiu de createExpense");
  assert.equal(
    FREQUENCIA_PADRAO,
    m[1],
    `o seletor abre em ${FREQUENCIA_PADRAO} e a ação cai em ${m[1]} — quem não tocar no seletor teria a frequência trocada`,
  );
});

checar("o padrão é uma das opções oferecidas", () => {
  assert.ok(FREQUENCIAS.some((f) => f.valor === FREQUENCIA_PADRAO), FREQUENCIA_PADRAO);
});

checar("`foraDoCalculo` concorda com quem CONTA as excluídas", () => {
  /* `rateio.ts` decide o que fica fora do cálculo; esta tela decide o que
     mostra como fora. Duas respostas para a mesma pergunta divergem sempre. */
  assert.ok(
    RATEIO.includes('recurrence === "UNICA"'),
    "linha de base: `rateio.ts` não decide mais por UNICA — reveja `foraDoCalculo`",
  );
  assert.equal(foraDoCalculo({ type: "DESPESA_RECORRENTE", recurrence: "UNICA" }), true);
  assert.equal(foraDoCalculo({ type: "DESPESA_RECORRENTE", recurrence: "MENSAL" }), false);
  /* E só despesa recorrente pode ficar de fora: uma taxa de gateway `UNICA` não
     existe, mas se existisse ela não é o caso que o aviso descreve. */
  assert.equal(foraDoCalculo({ type: "TAXA_GATEWAY", recurrence: "UNICA" }), false);
});

/* ── 4. O AVISO — diferencial, e a DIREÇÃO faz parte da asserção ──────────── */

console.log("\n4 — o aviso aparece porque EXISTE linha `UNICA`");

const despesa = (extra) => ({
  id: Math.random().toString(36).slice(2),
  name: "Ferramenta",
  type: "DESPESA_RECORRENTE",
  calc: "FIXO",
  amount: 500,
  paymentMethod: null,
  recurrence: "MENSAL",
  active: true,
  ...extra,
});

const vFalso = (despesas) => ({
  despesasCruas: despesas,
  timezone: "America/Sao_Paulo",
  criarDespesa: async () => {},
  removerDespesa: async () => {},
  editarDespesa: async () => {},
});

const desenhar = (despesas) => renderToStaticMarkup(React.createElement(SecaoTaxas, { v: vFalso(despesas) }));

const SEM_UNICA = desenhar([despesa({})]);
const COM_UNICA = desenhar([despesa({}), despesa({ name: "Curso", recurrence: "UNICA", amount: 300 })]);

checar("linha de base: a tela desenhou os cinco grupos nos dois estados", () => {
  for (const [nome, html] of [["sem única", SEM_UNICA], ["com única", COM_UNICA]]) {
    assert.ok(html.length > 1500, `${nome}: markup de ${html.length} caracteres`);
    for (const g of GRUPOS) {
      assert.ok(html.includes(g.titulo), `${nome}: faltou o grupo "${g.titulo}"`);
    }
  }
});

checar("sem linha `UNICA`, o aviso NÃO aparece", () => {
  assert.ok(!SEM_UNICA.includes("não entram no cálculo"), "aviso desenhado sem haver despesa única");
});

checar("com linha `UNICA`, o aviso aparece — e diz o QUE e o PORQUÊ", () => {
  assert.ok(COM_UNICA.includes("não entram no cálculo"), "o aviso sumiu");
  /* As duas metades da exigência do dono: a consequência e a causa. Um aviso só
     com a consequência deixa o usuário sem saber se é regra, limitação ou erro
     dele — e sem isso ele não consegue decidir se cadastra assim mesmo. */
  assert.ok(/lucro/.test(AVISO_UNICA) && /break-even/.test(AVISO_UNICA), "o aviso não diz o que acontece");
  assert.ok(/porque/.test(AVISO_UNICA), "o aviso não diz por quê");
  assert.ok(/data em que elas ocorreram/.test(AVISO_UNICA), "o aviso não nomeia a causa real");
});

checar("o estado `UNICA` só ACRESCENTA — a direção faz parte da asserção", () => {
  /* `>=` e não `===`: a linha a mais já faz o markup crescer por si. O que se
     afirma é que o estado não REMOVE nada — se um dia ele esconder um grupo,
     esta asserção cai. */
  const contar = (h, s) => h.split(s).length - 1;
  for (const g of GRUPOS) {
    assert.ok(
      contar(COM_UNICA, g.titulo) >= contar(SEM_UNICA, g.titulo),
      `o estado com única fez sumir "${g.titulo}"`,
    );
  }
  assert.ok(contar(SEM_UNICA, "não entram no cálculo") === 0);
  assert.ok(contar(COM_UNICA, "não entram no cálculo") >= 1);
});

checar("a lista mostra a INCIDÊNCIA de cada linha, não só o valor", () => {
  assert.ok(COM_UNICA.includes("por mês"), "a linha mensal não declarou o período");
  assert.ok(COM_UNICA.includes("sem período"), "a linha única não declarou a ausência de período");
});

checar("a seção de taxas se nomeia", () => {
  assert.ok(SEM_UNICA.includes("Taxas e despesas"), "a seção perdeu o título");
});

checar("e a TELA compõe as DUAS seções — a hierarquia que o dono pediu", () => {
  /* Guarda de texto porque a tela não é renderizável aqui (prisma). Ancorada na
     SINTAXE da composição, não na palavra solta: a prosa do cabeçalho cita as
     duas seções para explicá-las, e casaria com qualquer busca por nome. */
  const i = TELA.indexOf('titulo="Configuração da conta"');
  assert.ok(i > 0, "linha de base: a seção de configuração não é montada na tela");
  assert.ok(TELA.includes("<SecaoTaxas v={v} />"), "a tela deixou de compor a seção de taxas");
});

/* ── rodapé ──────────────────────────────────────────────────────────────── */

console.log(`\n${falhas.length === 0 ? "\x1b[32m✓" : "\x1b[31m✗"} ${ok} asserções\x1b[0m`);
if (falhas.length) {
  console.log(`\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(" · ")}`);
  process.exit(1);
}
