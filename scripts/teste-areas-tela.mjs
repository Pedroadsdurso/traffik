/**
 * A TELA DE ÁREAS — a conferência de ESCRITA, e a confirmação que diz o que a
 * exclusão PROMOVE.
 *
 * ## 1. A conferência de escrita, automatizada
 *
 * A família *"a tela nova apresenta estado que ela mesma não consegue criar"*
 * custou dois campos na tela de Taxas, e **nenhuma ferramenta desta base a
 * pega**: o teste do cinza compara estrutura, o `04` confere o que é EXIBIDO, e
 * `tsc`/lint/build não perguntam se existe caminho de escrita.
 *
 * Aqui ela vira asserção: os campos que `updateWorkspace` PERSISTE são lidos do
 * próprio arquivo da ação, e cada um tem de ter origem no formulário. Se alguém
 * acrescentar um campo no servidor e esquecer da tela — ou remover um controle
 * da tela e deixar o campo no servidor —, a suíte diz qual.
 *
 * ⛔ Ela lê a LISTA do servidor em vez de uma cópia à mão. Uma lista escrita
 * aqui envelheceria no primeiro campo novo, e envelheceria em silêncio — que é
 * exatamente a família que este teste existe para fechar.
 *
 * ## 2. A confirmação da exclusão
 *
 * `AutomationRule.workspaceId` e `Expense.workspaceId` NULOS significam GLOBAL,
 * e `onDelete: SetNull` ali é **promoção de escopo**, não estado neutro. A
 * frase segue a OPÇÃO SELECIONADA: com os padrões (`excluir`) não há promoção, e
 * alarmar ali seria alarme que grita sem motivo.
 *
 * Puro: sem banco, sem rede. ⚠️ Roda com `tsx` (lê `.tsx`).
 *
 *   npm run test:areas-tela
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { consequenciasDaExclusao, ampliaEscopo } = await import("../src/lib/areas/consequencia.ts");
const { resumoDoRecorte, CAMPOS_DE_RECORTE, CORES_DE_AREA } = await import("../src/lib/areas/apresentacao.ts");
/* ⛔ As duas gavetas importam os DTOs por `import type`, que é apagado na
   compilação — por isso elas renderizam sem `DATABASE_URL`. A `AreasScreen`
   importa as ações de verdade e fica só nas guardas de texto. */
const { GavetaExcluir } = await import("../src/components/dashboard/views/areas/GavetaExcluir.tsx");

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
const ACOES = fonte("../src/lib/actions/workspaces.ts");
const EDITOR = fonte("../src/components/dashboard/views/areas/GavetaArea.tsx");
const TELA = fonte("../src/components/dashboard/views/areas/AreasScreen.tsx");

/* ── 1. A CONFERÊNCIA DE ESCRITA ─────────────────────────────────────────── */

console.log();
console.log("1 — a tela CRIA tudo que o servidor persiste");

/**
 * Os campos que `updateWorkspace` grava, lidos do CÓDIGO da ação.
 * O padrão é `...(input.X !== undefined ? { X: ... } : {})`.
 */
const persistidos = [...ACOES.matchAll(/\.\.\.\(input\.(\w+) !== undefined \?/g)].map((m) => m[1]);

checar("linha de base: a ação persiste campos para conferir", () => {
  assert.ok(
    persistidos.length >= 8,
    `só ${persistidos.length} campos achados em updateWorkspace — a âncora quebrou: ${persistidos}`,
  );
});

checar("🔴 CADA campo persistido tem origem no formulário", () => {
  /* O corpo do `aoSalvar({...})` da gaveta é a fronteira: o que não estiver ali
     não tem como chegar ao servidor, por mais que o servidor saiba gravá-lo. */
  const i = EDITOR.indexOf("await aoSalvar({");
  assert.ok(i > 0, "linha de base: o formulário não chama `aoSalvar`");
  const envio = EDITOR.slice(i, EDITOR.indexOf("});", i));

  const semOrigem = persistidos.filter((c) => !new RegExp(`\\b${c}\\b`).test(envio));
  assert.deepEqual(
    semOrigem,
    [],
    "campo que o servidor grava e a tela não envia — é a regressão de Taxas se repetindo:\n      " +
      `persistidos: ${persistidos.join(", ")}`,
  );
});

checar("e `moverContas` também — ele não é persistido, é AUTORIZAÇÃO", () => {
  /* Ele não aparece no `data:` do update porque não é coluna: é a lista de
     contas que o usuário autorizou a SAIR de outra área. Sem ele, criar a
     primeira área secundária esbarra no bloqueio e o fluxo vira um beco. */
  assert.ok(/liberarContas\(userId, input\.moverContas/.test(ACOES), "linha de base: `moverContas` mudou de forma");
  assert.ok(/moverContas/.test(EDITOR), "o formulário não envia `moverContas`");
});

checar("`pixelConfigIds` FICA, mesmo sem consumidor conhecido", () => {
  /* ⛔ Decisão do dono, 12/08/2026. Remover o controle de um campo que persiste
     é a regressão que a tela de Taxas acabou de cometer, e "zero leitores hoje"
     não é "ninguém depende". O `04` o marca NÃO VERIFICADO, que é diferente
     de ✅. */
  assert.ok(persistidos.includes("pixelConfigIds"), "linha de base: o servidor parou de gravá-lo");
  assert.ok(/pixelConfigIds/.test(EDITOR), "o controle sumiu da tela — ver a decisão de 12/08");
});

/* ── 2. A CONSEQUÊNCIA DA EXCLUSÃO ───────────────────────────────────────── */

console.log();
console.log("2 — a confirmação diz o que a exclusão PROMOVE");

const regra = (extra) => ({ id: "r", nome: "Pausa CPA alto", ativa: true, execucoes: 4, semContaEspecifica: true, ...extra });
const previa = (extra) => ({
  nome: "Operação Black",
  contas: [{ id: "c", nome: "Conta 1", identificador: "act_1" }],
  webhooks: [],
  pixels: [],
  regras: [regra({}), regra({ id: "r2", ativa: false })],
  despesas: [{ id: "d", nome: "Ferramentas" }],
  dados: { vendas: 12, faturamento: 900, cliques: 40, eventos: 8 },
  ...extra,
});

const PADRAO = { contas: "mover", webhooks: "mover", pixels: "mover", regras: "excluir", despesas: "excluir", apagarDados: false };

checar("com os PADRÕES não há promoção — e alarme sem motivo envenena o sinal", () => {
  assert.equal(ampliaEscopo(previa(), PADRAO), false);
  const c = consequenciasDaExclusao(previa(), PADRAO);
  assert.equal(c.filter((x) => x.tom === "promocao").length, 0, JSON.stringify(c));
});

checar("🔴 escolher `mover` nas REGRAS produz a frase, com a contagem real", () => {
  const c = consequenciasDaExclusao(previa(), { ...PADRAO, regras: "mover" });
  const p = c.filter((x) => x.tom === "promocao");
  assert.ok(p.length >= 1, "nenhuma promoção declarada");
  const texto = p.map((x) => x.texto).join(" | ");
  /* A contagem é REAL: 2 regras, e 2 delas sem conta específica. Um número
     genérico não faz ninguém parar. */
  assert.ok(/2 regras passam/.test(texto), texto);
  assert.ok(/TODAS as campanhas/.test(texto), texto);
  /* E a que está ATIVA volta a agir sozinha — é a única consequência do diálogo
     que continua acontecendo depois que a tela fecha. */
  assert.ok(/1 dessas regras está ATIVA/.test(texto), texto);
  assert.ok(/dinheiro real/.test(texto), texto);
});

checar("escolher `mover` nas DESPESAS produz a frase do lucro", () => {
  const c = consequenciasDaExclusao(previa(), { ...PADRAO, despesas: "mover" });
  const texto = c.filter((x) => x.tom === "promocao").map((x) => x.texto).join(" | ");
  assert.ok(/1 despesa passa/.test(texto), texto);
  assert.ok(/TODAS as áreas/.test(texto), texto);
});

checar("o texto segue a ESCOLHA — não é fixo", () => {
  /* Teste diferencial: o mesmo fixture nos dois estados, e a direção faz parte
     da asserção. Trocar para `mover` só pode ACRESCENTAR promoção. */
  const base = consequenciasDaExclusao(previa(), PADRAO);
  const movido = consequenciasDaExclusao(previa(), { ...PADRAO, regras: "mover", despesas: "mover" });
  const promo = (l) => l.filter((x) => x.tom === "promocao").length;
  assert.equal(promo(base), 0);
  assert.ok(promo(movido) > promo(base), `${promo(base)} → ${promo(movido)}`);
});

checar("apagar a conta declara a perda do HISTÓRICO, não só da conta", () => {
  const c = consequenciasDaExclusao(previa(), { ...PADRAO, contas: "remover" });
  const texto = c.filter((x) => x.tom === "perda").map((x) => x.texto).join(" | ");
  /* O cascade derruba `DailyAdMetric` — ou seja, a base de ROAS/ROI/CPA de
     TODOS os períodos. Dizer só "a conta é apagada" esconde o caro. */
  assert.ok(/histórico de gasto/.test(texto), texto);
  assert.ok(/ROAS/.test(texto), texto);
});

checar("grupo VAZIO não gera consequência nenhuma", () => {
  const vazia = previa({ regras: [], despesas: [], contas: [] });
  const c = consequenciasDaExclusao(vazia, { ...PADRAO, regras: "mover", despesas: "mover" });
  assert.deepEqual(c, [], JSON.stringify(c));
});

/* ── 3. O DIÁLOGO ────────────────────────────────────────────────────────────
   ⛔ ELE NÃO PODE SER RENDERIZADO AQUI, e o motivo é bom: `tk/Gaveta` porta
   para o `<body>` com `createPortal`, e sem DOM ela devolve vazio. É a mesma
   "proteção por ESTRUTURA" que o `Popover` tem — o nó não existe no HTML do
   servidor —, e foi ela que impediu o `elapsed()` de quebrar a hidratação.

   ⚠️ Descoberto ao escrever este arquivo: as quatro primeiras asserções desta
   seção mediam `markup de 0 caracteres`. **A linha de base foi o que
   denunciou** — sem ela, `!/para confirmar/.test("")` passaria, e o teste
   afirmaria que o diálogo NÃO tem confirmação por digitação quando na verdade
   ele não tinha sido desenhado.

   O limite fica escrito: o que segue são guardas de TEXTO, e elas não
   respondem "como ficou". Quem responde é a passada visual. */

console.log();
console.log("3 — o diálogo, por guarda de texto (ver o limite acima)");

const DIALOGO = fonte("../src/components/dashboard/views/areas/GavetaExcluir.tsx");

checar("linha de base: o diálogo existe e usa a `tk/Gaveta`", () => {
  assert.ok(DIALOGO.length > 2000, `arquivo com ${DIALOGO.length} caracteres`);
  assert.ok(/from "@\/components\/tk\/Gaveta"/.test(DIALOGO), "não usa a Gaveta do sistema novo");
  /* ⛔ E NÃO o `ui/Drawer` legado, que porta para fora da ponte `.tk-tema` e
     sai com o anel de foco roxo. */
  assert.ok(!/ui\/Drawer|ui\/Modal/.test(DIALOGO), "voltou a usar a camada legada");
});

checar("ele exige DIGITAR o nome, e o servidor confere de novo", () => {
  assert.ok(/para confirmar/.test(DIALOGO), "sem confirmação por digitação");
  assert.ok(/nomeDigitado/.test(DIALOGO), "o nome digitado não é enviado ao servidor");
  /* ⚠️ A conferência mora em `areas/exclusao.ts`, não em `actions/workspaces.ts`
     — a ação só reexporta. A primeira versão desta guarda procurou no arquivo
     errado e reprovou por isso, não por defeito: guarda que aponta para o lugar
     errado reporta um problema que não existe. */
  const EXCLUSAO = fonte("../src/lib/areas/exclusao.ts");
  assert.ok(/nome-nao-confere/.test(EXCLUSAO), "linha de base: o servidor parou de conferir o nome");
});

checar("o botão só existe com a prévia CARREGADA e o nome conferindo", () => {
  /* Um diálogo destrutivo que abre vazio e depois preenche é um diálogo em que
     se clica antes de ler. */
  assert.ok(/disabled=\{!previa \|\| !nomeConfere\}/.test(DIALOGO), "o botão não espera a prévia");
  assert.ok(/Contando o que pertence/.test(DIALOGO), "não avisa que está contando");
});

checar("grupo sem itens não desenha seletor de destino", () => {
  /* Escolha sobre zero itens é controle que não controla nada, e faz o diálogo
     parecer mais perigoso do que é. */
  assert.ok(/\.filter\(\(g\) => g\.n > 0\)/.test(DIALOGO), "os grupos vazios não são filtrados");
});

checar("a prévia é buscada ANTES de abrir, não depois", () => {
  const i = TELA.indexOf("async function abrirExclusao");
  assert.ok(i > 0, "linha de base: a abertura da exclusão sumiu");
  const corpo = TELA.slice(i, i + 500);
  assert.ok(/preverExclusaoDaArea\(area\.id\)/.test(corpo), "a prévia não é buscada na abertura");
});

/* ── 4. A LINGUAGEM DA LISTA ─────────────────────────────────────────────── */

console.log();
console.log("4 — o resumo do recorte diz o EFEITO");

checar("recorte vazio se lê como `todas as contas`, não como zero", () => {
  /* `0 contas` é verdade e não informa — e sugere o OPOSTO do que significa:
     recorte vazio quer dizer "sem filtro". */
  assert.equal(resumoDoRecorte({ accountIds: [], products: [], sources: [], webhookIds: [] }), "todas as contas");
});

checar("com recorte, o resumo conta cada dimensão", () => {
  const s = resumoDoRecorte({ accountIds: ["a", "b"], products: ["x"], sources: [], webhookIds: ["w"] });
  assert.ok(/2 contas/.test(s), s);
  assert.ok(/1 webhook\b/.test(s), s);
  assert.ok(/1 produto\b/.test(s), s);
  assert.ok(!/fonte/.test(s), `fonte vazia não devia aparecer: ${s}`);
});

checar("`products` e `sources` são os dois campos de recorte livre", () => {
  assert.deepEqual(CAMPOS_DE_RECORTE.map((c) => c.chave), ["products", "sources"]);
  /* Cada apoio diz o EFEITO no painel, não o que o campo é. */
  for (const c of CAMPOS_DE_RECORTE) {
    assert.ok(/entra|aparece|conta/i.test(c.apoio), `${c.chave}: ${c.apoio}`);
  }
});

checar("a paleta tem cor suficiente para distinguir áreas", () => {
  assert.ok(CORES_DE_AREA.length >= 6, `só ${CORES_DE_AREA.length} cores`);
  assert.equal(new Set(CORES_DE_AREA).size, CORES_DE_AREA.length, "cor repetida na paleta");
});

/* ── 5. O QUE A TELA NÃO PODE OFERECER ───────────────────────────────────── */

console.log();
console.log("5 — o que o servidor recusa, a tela não oferece");

checar("a Principal não tem botão de excluir", () => {
  /* Oferecer para negar depois é pior que não oferecer — o servidor devolve
     `motivo: "principal"`. */
  const i = TELA.indexOf("!area.isDefault");
  assert.ok(i > 0, "linha de base: a tela não distingue a Principal");
  const trecho = TELA.slice(i, i + 400);
  assert.ok(/Excluir \$\{area\.name\}/.test(trecho), `o ✕ não está sob a guarda: ${trecho.slice(0, 200)}`);
});

checar("a Principal não oferece arquivar", () => {
  assert.ok(/!area\?\.isDefault/.test(EDITOR), "o interruptor de arquivar não está sob a guarda");
  assert.ok(/principal-nao-arquiva/.test(ACOES), "linha de base: o servidor mudou o motivo");
});

/* ── rodapé ──────────────────────────────────────────────────────────────── */

console.log();
console.log(`${falhas.length === 0 ? "\x1b[32m✓" : "\x1b[31m✗"} ${ok} asserções\x1b[0m`);
if (falhas.length) {
  console.log(`\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(" · ")}`);
  process.exit(1);
}
