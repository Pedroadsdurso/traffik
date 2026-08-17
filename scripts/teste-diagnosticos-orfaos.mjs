/**
 * `actions/diagnostics.ts` — A TRIAGEM, EXECUTADA. E a guarda do que sobrou.
 *
 * ## 🔴 DE ONDE ISTO VEIO
 *
 * A tela de **Integrações › Testes foi deletada** (911 linhas) e levou os
 * consumidores de 12 server actions. O módulo sobreviveu porque outras 2
 * seguem em uso — e é por isso que a varredura de órfãos **por arquivo** nunca
 * os veria: o arquivo tem consumidor.
 *
 * A triagem perguntou, uma a uma, *o que isto FAZIA* — não *quem usa*. As duas
 * perguntas têm o mesmo `grep` e levam a decisões opostas:
 *
 * | | resposta | o que se faz |
 * |---|---|---|
 * | 🔴 **remédio** | sustenta propriedade declarada em OUTRO módulo | **religa** — deletar viola a propriedade |
 * | ⚠️ **vigilância** | responde "isto ainda funciona?", e a falha é MUDA | religa onde o dado já é lido; senão **sai com registro** |
 * | ⚪ **apoio** | diagnostica sob demanda | **sai** — a ausência é sentida na hora |
 *
 * ## ✅ O QUE FOI EXECUTADO EM 17/08/2026
 *
 * | | |
 * |---|---|
 * | **2 religadas** | `removerPadraoDeTeste` (+ `listarPadroesDeTeste`) no ALERTA que anuncia o bloqueio · `getRotinasAgendadas` no RODAPÉ do Dashboard |
 * | **1 despromovida** | `getInstallChecklist` — nunca esteve órfã, tinha consumidor INTERNO. Órfão era o `export` |
 * | **8 podadas** | 6 de apoio + `resumoEspelhos` e `resumoEfeitos`, com o custo de cada uma escrito no arquivo |
 *
 * ⛔ **Nenhuma foi religada em tela nova.** As duas foram para superfícies que
 * já faziam aquela pergunta: o rodapé "Estado do sistema" já deduzia "as
 * rotinas estão rodando?" por um proxy (`lastRunAt` de regra), e o alerta é o
 * lugar do que pede decisão.
 *
 *   npm run test:diagnosticos-orfaos
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

const ARQUIVO = "src/lib/actions/diagnostics.ts";
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
/** Apaga comentário PRESERVANDO as quebras — senão o número reportado não é o do arquivo. */
const semCom = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");

const FONTE = ler(ARQUIVO);
const CODIGO = semCom(FONTE);

/**
 * O que DEVE existir, com o papel de cada uma. Exaustivo nos dois sentidos:
 * uma action nova sem classificação reprova, e uma classificada que sumir
 * também.
 */
const PAPEL = {
  listWebhookLogs: "vivo · `VisaoGeralScreen` e `WebhooksScreen`",
  getPendenciasDaArea: "vivo · `BannerPendencias`",
  listarPadroesDeTeste: "🔴 remédio · sem ela não há como saber QUAIS padrões bloqueiam",
  removerPadraoDeTeste: "🔴 remédio · único escritor de `User.testHostPatterns`",
  getRotinasAgendadas: "⚠️ vigilância religada · as CINCO rotinas, no rodapé do Dashboard",
};

/** Podadas em 17/08/2026 — não podem voltar sem consumidor. */
const PODADAS = [
  "resumoEspelhos", "resumoEfeitos", "analyzeTrackingUrl", "getPendenciasDasAreas",
  "listTestablePixels", "testarPayloadDeGateway", "listarGatewaysDoTestador", "carregarExemploDeGateway",
];

console.log("\n\x1b[1m`actions/diagnostics.ts` — a triagem, executada\x1b[0m");

/* ═══ 1 · O DENOMINADOR ═══════════════════════════════════════════════════ */
secao("1 · O denominador — quantas actions existem, e quantas foram examinadas");
const ACTIONS = [...CODIGO.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
{
  ok("1 · linha de base: o arquivo foi lido e é `\"use server\"`", FONTE.startsWith('"use server"') && FONTE.length > 3000, FONTE.length + " chars");
  ok("1 · …e as actions foram encontradas", ACTIONS.length >= 4, ACTIONS.length + " actions exportadas");

  const naoClassificadas = ACTIONS.filter((a) => !(a in PAPEL));
  ok(
    "1 · ⛔ TODA action tem papel declarado",
    naoClassificadas.length === 0,
    naoClassificadas.length ? "classifique: " + naoClassificadas.join(", ") : ACTIONS.length + " de " + ACTIONS.length,
  );
  const sumidas = Object.keys(PAPEL).filter((a) => !ACTIONS.includes(a));
  ok(
    "1 · ⛔ …e toda action classificada EXISTE — deletar uma reprova nomeando",
    sumidas.length === 0,
    sumidas.length ? "sumiram: " + sumidas.join(", ") : "nenhuma sumiu",
  );

  /* ⛔ A PODA NÃO SE DESFAZ EM SILÊNCIO. Se uma delas voltar, ela volta sem
     consumidor — que é exatamente o estado do qual saíram. */
  const ressuscitadas = PODADAS.filter((a) => CODIGO.includes(`function ${a}`));
  ok(
    "1 · ⛔ as 8 podadas não voltaram",
    ressuscitadas.length === 0,
    ressuscitadas.length ? "voltaram: " + ressuscitadas.join(", ") : PODADAS.length + " continuam fora",
  );
}

/* ═══ 2 · TODA ACTION QUE FICOU TEM CONSUMIDOR DE PRODUÇÃO ════════════════

   ⛔ A varredura é só em `src/`, e o motivo é um erro que ela cometeu na
   primeira versão: contou **este arquivo** como consumidor e reportou "12
   religadas". É *a medição não acertou o alvo* — o instrumento funcionou, a
   saída foi plausível, e ele estava apontado para a categoria errada.
   **Citação em teste não é consumo.**                                       */
secao("2 · Toda action que ficou tem consumidor de PRODUÇÃO — medido, não transcrito");
{
  const FONTES = globSync("src/**/*.{ts,tsx}")
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => !f.includes("generated/") && f !== ARQUIVO);
  const TEXTO = new Map(FONTES.map((f) => [f, semCom(ler(f))]));
  const consumidores = (sim) =>
    [...TEXTO].filter(([, s]) => new RegExp("\\b" + sim + "\\b").test(s)).map(([f]) => f.split("/").pop());

  ok("2 · linha de base: há produção para varrer", FONTES.length > 200, FONTES.length + " arquivos em `src/`");

  const orfas = [];
  for (const [nome, papel] of Object.entries(PAPEL)) {
    const c = consumidores(nome);
    if (c.length === 0) orfas.push(nome);
    ok(`2 · \`${nome}\``, c.length > 0, c.join(" · ") || "⛔ SEM CONSUMIDOR — " + papel);
  }
  /* 🔑 A AFIRMAÇÃO CENTRAL DESTE ARQUIVO, e ela é o oposto da de 15/08: lá o
     denominador era "12 órfãs de 14"; aqui é ZERO. */
  ok(
    "2 · 🔑 ZERO órfãs — o aglomerado que a tela de Testes deixou foi desfeito",
    orfas.length === 0,
    orfas.length ? "órfãs: " + orfas.join(", ") : `${ACTIONS.length} de ${ACTIONS.length} com consumidor`,
  );
}

/* ═══ 3 · 🔴 O REMÉDIO, e a propriedade que ele sustenta ══════════════════ */
secao("3 · 🔴 O remédio — bloqueio irreversível precisa de porta de saída");
{
  const AMB = ler("src/lib/pixel/ambiente.ts");
  ok("3 · linha de base: `ambiente.ts` foi lido", AMB.length > 3000, AMB.length + " chars");
  ok(
    "3 · ele DECLARA que bloquear é irreversível — é isto que exige o remédio",
    /irrevers[ií]vel/i.test(AMB) && /n[aã]o pode ser/i.test(AMB),
    "a regra amplia o alcance do bloqueio; sem remoção, ela não tem volta",
  );

  /* ⛔ O ÚNICO ESCRITOR — é o que separa "órfã" de "insubstituível". */
  const ESCRITORES = globSync("src/**/*.{ts,tsx}")
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => !f.includes("generated/"))
    .filter((f) => /data:\s*\{[^}]*testHostPatterns/s.test(semCom(ler(f))));
  ok(
    "3 · 🔑 `removerPadraoDeTeste` é o ÚNICO escritor de `User.testHostPatterns`",
    ESCRITORES.length === 1 && ESCRITORES[0] === ARQUIVO,
    ESCRITORES.join(" · ") || "⛔ nenhum escritor — a remoção sumiu",
  );

  /* ── A PORTA, medida ponta a ponta ───────────────────────────────────────
     Três elos, e cada um sozinho passa sem que a porta exista:
     a tela busca · a tela liga a remoção · o construtor produz o alerta.     */
  const TELA = ler("src/components/dashboard/dadosDosBlocos.tsx");
  ok(
    "3 · a TELA busca os padrões",
    /listarPadroesDeTeste\(\)/.test(semCom(TELA)),
    "sem isto o alerta nunca tem o que anunciar",
  );
  ok(
    "3 · …e liga a remoção ao construtor",
    /aoRemoverPadrao:\s*removerPadrao/.test(semCom(TELA)) && /removerPadraoDeTeste\(/.test(semCom(TELA)),
    "sem isto o alerta anuncia o bloqueio e não oferece saída",
  );
  ok(
    "3 · ⛔ e a lista vem do SERVIDOR depois de remover, não de um `filter` local",
    /setPadroes\(await m\.removerPadraoDeTeste\(/.test(semCom(TELA)),
    "filtrar local seria a segunda fonte: a tela mostraria removido o que o banco ainda bloqueia",
  );
}

/* ═══ 4 · ⚠️ O REGISTRO DAS PODADAS — e a linha vermelha ══════════════════

   "Sai com registro" só vale se o registro for ACHÁVEL por quem for mexer no
   assunto — não só por quem ler o `git log`. Ele mora no próprio arquivo.      */
secao("4 · ⚠️ O registro das podadas vive no arquivo, e nomeia o que se perdeu");
{
  ok(
    "4 · o arquivo REGISTRA o que saiu e o custo de cada saída",
    /O QUE SAIU EM 17\/08\/2026/.test(FONTE) && /resumoEfeitos/.test(FONTE),
    "sem isto, a poda vira `git log` — e ninguém lê `git log` de um arquivo que nunca abriu",
  );

  /* 🔴 A LINHA VERMELHA: três colunas ficaram só com ESCRITOR. É a imagem
     espelhada do `Sale.apiCredentialId` (6 leitores, 0 escritores). */
  const LEITORES = globSync("src/**/*.{ts,tsx}")
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => !f.includes("generated/"))
    .filter((f) => /capiStatus|checkoutStatus|notifStatus/.test(semCom(ler(f))));
  ok(
    "4 · 🔴 MEDIDO: as 3 colunas de efeito ficaram SÓ com escritor",
    LEITORES.length === 1 && LEITORES[0].endsWith("webhook/marcarEfeito.ts"),
    LEITORES.join(" · ") + " — só escreve. Dívida REGISTRADA, não escondida",
  );
  ok(
    "4 · …e o arquivo diz isso, com o `grep` que a acha",
    /SÓ COM ESCRITOR|SO COM ESCRITOR/.test(FONTE) && /grep -rn "capiStatus/.test(FONTE),
    "registro sem o comando que o reencontra é narrativa",
  );

  /* ⚠️ E o par que prova que a poda não foi cega: o `resumoEspelhos` saiu
     porque a pergunta dele JÁ É respondida — não porque ninguém a fazia. */
  const PIXEL = semCom(ler("src/components/dashboard/views/pixel/PixelScreen.tsx"));
  ok(
    "4 · ⚪ o `resumoEspelhos` saiu porque a `PixelScreen` já lê o espelho",
    /estadoDoEspelho\(/.test(PIXEL),
    "era a segunda fonte da mesma pergunta — por isso a saída dele não custou nada",
  );
}

/* ═══ 5 · A DESPROMOÇÃO — "órfão" e "super-exportado" têm consertos opostos ═ */
secao("5 · `getInstallChecklist` — despromovida, não deletada");
{
  ok(
    "5 · ela NÃO é mais `export`",
    !/^export async function getInstallChecklist/m.test(CODIGO) && /^async function getInstallChecklist/m.test(CODIGO),
    "em `\"use server\"` todo export é ENDPOINT — um a menos sem consumidor",
  );
  ok(
    "5 · …e continua sendo CHAMADA por `getPendenciasDaArea`",
    /await getInstallChecklist\(/.test(CODIGO),
    "ela nunca esteve órfã: órfão era o export",
  );
  ok(
    "5 · …cujo resultado chega ao `BannerPendencias`",
    /getPendenciasDaArea/.test(semCom(ler("src/components/dashboard/ui/BannerPendencias.tsx"))),
    "a cadeia inteira, do banner à consulta",
  );
}

/* ═══ 6 · TODA ACTION EXIGE SESSÃO — `"use server"` é ENDPOINT ════════════ */
secao("6 · Toda action exige sessão");
{
  const semGuarda = ACTIONS.filter((a) => {
    const i = CODIGO.indexOf(`export async function ${a}`);
    const j = CODIGO.indexOf("\nexport ", i + 1);
    const corpo = CODIGO.slice(i, j === -1 ? undefined : j);
    return !/requireUserId\(\)/.test(corpo);
  });
  ok(
    "6 · 🔑 toda action exige sessão — órfã ou não, `\"use server\"` é ENDPOINT",
    semGuarda.length === 0,
    semGuarda.length ? "SEM guarda: " + semGuarda.join(", ") : ACTIONS.length + " de " + ACTIONS.length,
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
if (falhas.length) {
  console.log("\n\x1b[31m" + falhas.length + " falha(s):\x1b[0m\n  - " + falhas.join("\n  - "));
  process.exit(1);
}
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log(`   denominador: ${ACTIONS.length} actions, 0 órfãs · 8 podadas com registro · 1 despromovida\n`);
