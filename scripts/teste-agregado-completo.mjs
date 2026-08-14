/**
 * TODO ARQUIVO DE TESTE É INVOCADO POR UM AGREGADO — guarda estática.
 *
 * 🔴 A REGRA JÁ EXISTIA, E DEPENDIA DE ALGUÉM LEMBRAR
 *
 * O `CLAUDE.md` registra, desde 07/08/2026:
 *
 *   > **Todo arquivo de teste novo entra no agregado no MESMO commit em que
 *   > nasce. Se não entrou, não foi escrito.**
 *
 * Ela nasceu do `teste-fita.mjs`: existia, tinha `npm run test:fita`, e **não
 * estava no `npm test`**. Ao mudar o contrato da fita ele passou a ter 9
 * asserções quebradas — e a suíte seguiu verde, porque ninguém o invocava.
 *
 * ⛔ Em 14/08/2026 a varredura achou **outro**: `teste-ambiente.mjs`, com script
 * npm próprio e nenhum agregado o chamando. Ele estava SAUDÁVEL (58 asserções
 * passando) — e é justamente isso que torna a família traiçoeira: órfão podre e
 * órfão são indistinguíveis sem executar. O `teste-fita` era o podre; este não
 * era. Não havia como saber qual sem rodar os dois.
 *
 * ## Por que é pior que um teste ausente
 *
 * | | o que o leitor conclui |
 * |---|---|
 * | teste **ausente** | nada — a lacuna é visível |
 * | teste **órfão** | 🔴 *"isto está coberto"* — o arquivo existe, tem nome, tem asserções |
 *
 * ⚠️ E o custo é assimétrico no tempo: o órfão saudável de hoje é o órfão podre
 * de amanhã, no primeiro commit que mudar o contrato que ele mede.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const scripts = pkg.scripts;

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

console.log("\nTodo teste é invocado por um agregado");

const arquivos = readdirSync("scripts").filter((f) => /^teste-.*\.mjs$/.test(f));

/* ⛔ LINHA DE BASE. Sem ela, um `readdir` que devolvesse vazio faria toda
   asserção abaixo passar sobre a coleção vazia — a forma exata do teste que não
   examina nada e imprime verde. */
ok("linha de base: há arquivos de teste no disco", arquivos.length >= 50, arquivos.length + " arquivos");

/* Um agregado é um script npm que encadeia OUTROS `npm run`. */
const agregados = Object.entries(scripts).filter(([, c]) => /npm run .*&&.*npm run/.test(c));
ok("linha de base: há agregados", agregados.length >= 1, agregados.map(([x]) => x).join(", "));

const invocados = new Set();
for (const [, cmd] of agregados) for (const m of cmd.matchAll(/npm run ([\w:-]+)/g)) invocados.add(m[1]);
ok("linha de base: os agregados invocam scripts", invocados.size >= 40, invocados.size + " scripts invocados");

/* Mapa arquivo -> scripts npm que o executam */
const alvo = {};
for (const [nome, cmd] of Object.entries(scripts)) {
  const m = cmd.match(/scripts\/(teste-[\w-]+\.mjs)/);
  if (m) (alvo[m[1]] ||= []).push(nome);
}

/* ---- 1. Todo arquivo tem ao menos um script npm ---- */
const semScript = arquivos.filter((f) => !alvo[f]);
ok(
  "todo teste tem um script npm apontando para ele",
  semScript.length === 0,
  semScript.length ? "SEM SCRIPT: " + JSON.stringify(semScript) : "0 de " + arquivos.length,
);

/* ---- 2. E esse script é invocado por um agregado ---- */
const orfaos = arquivos
  .filter((f) => alvo[f])
  .filter((f) => !alvo[f].some((s) => invocados.has(s)))
  .map((f) => ({ arquivo: f, scripts: alvo[f] }));

ok(
  "todo teste é invocado por um agregado",
  orfaos.length === 0,
  orfaos.length ? "ÓRFÃOS: " + JSON.stringify(orfaos) : "0 de " + arquivos.length + " órfãos",
);

/* ---------------------------------------------------------------------------
 * 3. PROVA PELO LADO NEGATIVO
 *
 * PLANTIO: um arquivo com script npm proprio que nenhum agregado chama — que e
 * exatamente o estado em que `teste-fita.mjs` e `teste-ambiente.mjs` estiveram.
 * ------------------------------------------------------------------------ */
{
  const fakeScripts = { ...scripts, "test:orfao-plantado": "node scripts/teste-orfao-plantado.mjs" };
  const fakeArquivos = [...arquivos, "teste-orfao-plantado.mjs"];

  const fakeAlvo = {};
  for (const [nome, cmd] of Object.entries(fakeScripts)) {
    const m = cmd.match(/scripts\/(teste-[\w-]+\.mjs)/);
    if (m) (fakeAlvo[m[1]] ||= []).push(nome);
  }
  const fakeOrfaos = fakeArquivos
    .filter((f) => fakeAlvo[f])
    .filter((f) => !fakeAlvo[f].some((s) => invocados.has(s)));

  ok(
    "PLANTIO: um teste fora do agregado É detectado",
    fakeOrfaos.length === 1 && fakeOrfaos[0] === "teste-orfao-plantado.mjs",
    JSON.stringify(fakeOrfaos),
  );
}

/* ---------------------------------------------------------------------------
 * ⚠️ O LIMITE, escrito para ninguém ler verde demais
 *
 * Isto prova que o arquivo é INVOCADO. Não prova que ele mede alguma coisa: um
 * teste no agregado com zero asserções passa por aqui. Para essa metade, o que
 * vale é a regra de sempre — a asserção precisa DERRUBAR quando se planta o
 * defeito, e cada arquivo carrega o próprio plantio.
 * ------------------------------------------------------------------------ */

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: " + arquivos.length + " arquivos de teste, " + invocados.size + " scripts em agregado\n");
