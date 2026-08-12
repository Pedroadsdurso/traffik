/**
 * A TELA DE NOTIFICAÇÕES — onze interruptores da mesma tabela, e a conferência
 * de escrita como ASSERÇÃO.
 *
 * ⛔ "PARECE SIMPLES" FOI O QUE PRODUZIU A REGRESSÃO DO `calc` EM TAXAS. Onze
 * booleanos de uma tabela só é a definição de tela simples — e é exatamente a
 * forma em que esquecer um campo não produz erro nenhum: o interruptor some, a
 * leitura continua certa, e ninguém nota.
 *
 * A guarda principal cruza a lista da TELA com o `NotificationSettingsDTO` da
 * própria AÇÃO, e exige que os dois conjuntos sejam **iguais** — nem campo a
 * mais, nem a menos. Ela lê os dois lados do código; não há cópia à mão para
 * envelhecer.
 *
 * Puro: sem banco, sem rede. ⚠️ Roda com `tsx` (lê `.ts`).
 *
 *   npm run test:notificacoes
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  CAMPOS_ESCRITOS, QUANDO_AVISAR, O_QUE_MOSTRAR, HORARIOS, PADROES_DE_RESUMO, nenhumHorarioLigado,
} = await import("../src/lib/notificacoes/apresentacao.ts");

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
const ACOES = fonte("../src/lib/actions/notifications.ts");
const TELA = fonte("../src/components/dashboard/views/notificacoes/NotificacoesScreen.tsx");
const SCHEMA = fonte("../prisma/schema.prisma");

/* ── 1. A CONFERÊNCIA DE ESCRITA ─────────────────────────────────────────── */

console.log();
console.log("1 — a tela escreve TODOS os campos, e só eles");

/** Os campos do DTO, lidos do CÓDIGO da ação. */
const doDTO = (() => {
  const i = ACOES.indexOf("export interface NotificationSettingsDTO");
  const corpo = ACOES.slice(i, ACOES.indexOf("}", i));
  return [...corpo.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
})();

checar("linha de base: o DTO tem campos para conferir", () => {
  assert.ok(doDTO.length >= 10, `só ${doDTO.length} campos achados: ${doDTO} — a âncora quebrou`);
});

checar("🔴 os dois conjuntos são IGUAIS — nem a mais, nem a menos", () => {
  const naTela = [...CAMPOS_ESCRITOS].sort();
  const naAcao = [...doDTO].sort();

  const faltando = naAcao.filter((c) => !naTela.includes(c));
  const sobrando = naTela.filter((c) => !naAcao.includes(c));

  assert.deepEqual(
    faltando,
    [],
    "campo que o servidor aceita e a tela NÃO escreve — é a regressão de Taxas se repetindo",
  );
  assert.deepEqual(
    sobrando,
    [],
    "campo que a tela escreve e o servidor NÃO aceita — o patch seria descartado em silêncio",
  );
});

checar("nenhum campo aparece em DOIS grupos", () => {
  /* Um interruptor duplicado significa dois controles para o mesmo estado, e
     eles ficariam fora de sincronia até o próximo carregamento. */
  assert.equal(new Set(CAMPOS_ESCRITOS).size, CAMPOS_ESCRITOS.length, CAMPOS_ESCRITOS.join(", "));
});

checar("todo campo passa pelo caminho ÚNICO de escrita", () => {
  /* Um `updateNotificationSettings` chamado direto da tela pularia a
     atualização do estado do hook, e a tela mostraria o valor antigo. */
  assert.ok(!/updateNotificationSettings/.test(TELA), "a tela chama a ação direto, pulando o hook");
  /* ⚠️ Conta as duas FORMAS: a tela passa `v.salvarNotificacao` por REFERÊNCIA
     para os grupos de interruptor, e a chama diretamente no seletor de padrão.
     A primeira versão desta guarda contava só `salvarNotificacao(` e reprovou
     com 1 de 4 — âncora errada, não defeito. */
  const usos = (TELA.match(/v\.salvarNotificacao/g) ?? []).length;
  assert.ok(usos >= 3, `só ${usos} usos de \`v.salvarNotificacao\` — o caminho único sumiu`);
});

/* ── 2. O ESTADO QUE TORNA UM CONTROLE SEM EFEITO ────────────────────────── */

console.log();
console.log("2 — a tela declara quando um controle não vai ter efeito");

const cheio = { report08: true, report12: false, report18: false, report23: false };
const vazio = { report08: false, report12: false, report18: false, report23: false };

checar("`nenhumHorarioLigado` distingue os dois estados", () => {
  assert.equal(nenhumHorarioLigado(vazio), true);
  assert.equal(nenhumHorarioLigado(cheio), false);
});

checar("e a tela USA isso — não é função órfã", () => {
  /* Uma função de diagnóstico sem consumidor é a proteção morta que este
     projeto já pagou. O `grep` é fora do próprio arquivo dela. */
  assert.ok(/nenhumHorarioLigado/.test(TELA), "a tela não consome a função");
  assert.ok(/nenhum resumo vai ser enviado/.test(TELA), "o aviso não está escrito");
});

checar("⛔ o interruptor sem efeito NÃO é desabilitado — ele avisa", () => {
  /* Desabilitar impediria de configurar antes de ligar o aviso. O que muda é a
     tela DIZER que não terá efeito agora. */
  assert.ok(/nada disto vai aparecer/.test(TELA), "o grupo sem efeito não declara o motivo");
  assert.ok(!/desabilitado=\{inerte\}/.test(TELA), "o grupo foi desabilitado em vez de avisado");
});

/* ── 3. A LINGUAGEM ──────────────────────────────────────────────────────── */

console.log();
console.log("3 — cada rótulo diz o EFEITO");

checar("`venda pendente` avisa que o dinheiro pode não entrar", () => {
  const p = QUANDO_AVISAR.find((i) => i.campo === "notifyPendingSale");
  assert.ok(p, "o interruptor sumiu");
  assert.ok(/ainda pode não entrar/.test(p.apoio ?? ""), p.apoio);
  /* E que ligar os dois avisa duas vezes pela mesma venda — o usuário descobre
     isso pelo celular se a tela não disser. */
  assert.ok(/duas vezes/.test(p.apoio ?? ""), p.apoio);
});

checar("os quatro horários nomeiam a COLUNA, não derivam da hora", () => {
  /* `report${h}` funcionaria hoje e quebraria em silêncio no dia em que alguém
     acrescentasse um horário com outro formato. */
  assert.deepEqual(HORARIOS.map((h) => h.campo), ["report08", "report12", "report18", "report23"]);
  for (const h of HORARIOS) {
    assert.ok(new RegExp(`${h.campo}\\s+Boolean`).test(SCHEMA), `${h.campo} não existe no schema`);
  }
});

checar("os três padrões de resumo são os do enum, e cada um explica", () => {
  const i = SCHEMA.indexOf("enum ReportPattern");
  assert.ok(i > 0, "linha de base: o enum sumiu do schema");
  const corpo = SCHEMA.slice(i, SCHEMA.indexOf("}", i));
  for (const p of PADROES_DE_RESUMO) {
    assert.ok(corpo.includes(p.valor), `${p.valor} não está no enum`);
    assert.ok(p.apoio.length > 20, `${p.valor} sem explicação: "${p.apoio}"`);
  }
});

checar("o fuso é declarado — e é o da CONTA, não o do aparelho", () => {
  /* Mesma regra que decide o que é "hoje" no painel inteiro. Sem dizer, quem
     viaja acha que o resumo atrasou. */
  assert.ok(/fuso da conta, não o do aparelho/.test(TELA), "a tela não declara o fuso");
});

checar("`showDashboardName` é o único que nasce desligado, e a tela sabe por quê", () => {
  assert.ok(/showDashboardName\s+Boolean\s+@default\(false\)/.test(SCHEMA), "o padrão do schema mudou");
  const d = O_QUE_MOSTRAR.find((i) => i.campo === "showDashboardName");
  assert.ok(/mais de uma operação/.test(d?.apoio ?? ""), d?.apoio);
});

/* ── rodapé ──────────────────────────────────────────────────────────────── */

console.log();
console.log(`${falhas.length === 0 ? "\x1b[32m✓" : "\x1b[31m✗"} ${ok} asserções\x1b[0m`);
if (falhas.length) {
  console.log(`\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(" · ")}`);
  process.exit(1);
}
