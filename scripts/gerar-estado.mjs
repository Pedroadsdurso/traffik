/**
 * Gera o bloco de ESTADO DAS TELAS no `CLAUDE.md` a partir do `04`.
 *
 * ## O que ele resolve, e o que ele NÃO resolve
 *
 * ✅ **Mata a divergência entre CLAUDE.md e o `04`.** Essa classe mordeu cinco
 * vezes até 07/08/2026 — a última foi o cabeçalho do `Card.tsx` proibindo a
 * sombra que a linha 98 dele aplicava. Com o bloco derivado, os dois documentos
 * não podem mais discordar: existe uma fonte só.
 *
 * ⛔ **NÃO verifica se o `04` concorda com o CÓDIGO, e isso é decisão, não
 * omissão.** "O modo de edição existe" não é `grep`-ável: exigiria saber o que
 * um componente faz, e o script viraria mais uma coisa para envelhecer — o
 * próprio defeito que ele existe para matar. A conferência doc × código continua
 * sendo manual, feita ao fechar cada tela.
 *
 * Em uma linha: **ele garante consistência entre documentos, não verdade.**
 *
 * ## Por que ele FALHA ALTO
 *
 * Script que gera em silêncio no lugar errado é pior que não ter script: o
 * conteúdo some, ninguém percebe, e o arquivo fica com um buraco. Se os
 * marcadores não existirem — ou existirem em número errado, ou fora de ordem —
 * ele sai com código 1 e não escreve nada.
 *
 *   npm run docs:estado          (roda junto de `npm test`)
 *   npm run docs:estado -- --conferir   (não escreve; falha se estiver desatualizado)
 */
import fs from "node:fs";

const ORIGEM = "docs/design/04-CONFERENCIA-COM-AS-REFERENCIAS.md";
const DESTINO = "CLAUDE.md";
const ABRE = "<!-- ESTADO:INICIO -->";
const FECHA = "<!-- ESTADO:FIM -->";

const conferir = process.argv.includes("--conferir");

function morrer(msg) {
  console.error(`\x1b[31m✗ gerar-estado:\x1b[0m ${msg}`);
  process.exit(1);
}

/* ── 1. Lê as seções de tela do `04` ─────────────────────────────────────────
   Cada `## TÍTULO` é uma tela. O estado sai da CONTAGEM dos marcadores dentro
   dela — não de uma frase escrita, que é justamente o que envelhece. */
const origem = fs.readFileSync(ORIGEM, "utf8");
const linhas = origem.split(/\r?\n/);

/**
 * Seções que não são tela — não entram na tabela.
 *
 * ⚠️ O teste roda sobre o título SEM os emoji da frente. A primeira versão
 * ancorava em `^` e deixou passar `## 🔁 OS TRÊS 🔧 REVISÍVEIS` como se fosse uma
 * tela, porque o emoji vem antes da palavra. Título decorado é a NORMA neste
 * repositório — normalizar aqui não é defensividade, é o caso comum.
 */
const NAO_E_TELA = /^(O QUE ESTÁ NAS REFERÊNCIAS|COMO USAR|OS 🔧|OS TRÊS)/u;
/** Tira emoji e espaço do começo do título. */
const semEnfeite = (t) => t.replace(/^[^\p{L}]+/u, "");

const telas = [];
let atual = null;
for (const l of linhas) {
  const cab = l.match(/^## (.+)$/);
  if (cab) {
    const nome = cab[1].replace(/[—–].*$/, "").trim();
    const limpo = semEnfeite(nome);
    atual = NAO_E_TELA.test(semEnfeite(cab[1])) ? null : { nome: limpo, ok: 0, falta: 0, dec: 0 };
    if (atual) telas.push(atual);
    continue;
  }
  if (!atual) continue;
  // Só conta em LINHA DE TABELA: a prosa do documento também usa ✅ e ❌.
  if (!l.trimStart().startsWith("|")) continue;

  /* ⛔ UM MARCADOR POR LINHA — o PRIMEIRO, e não todos.
     Cada linha da tabela tem UM status; os outros marcadores que aparecem nela
     estão dentro da justificativa ("esta linha dizia ❌ até 07/08"). Contando
     todos, um item resolvido com a história escrita ao lado voltava a somar no
     ❌ — e o número passava a crescer justamente quando a dívida diminuía.
     Pego na primeira geração depois de resolver os dois ❌ residuais. */
  const m = l.match(/✅|❌|🔧/u);
  if (!m) continue;
  if (m[0] === "✅") atual.ok++;
  else if (m[0] === "❌") atual.falta++;
  else atual.dec++;
}

if (telas.length === 0) morrer(`nenhuma seção de tela encontrada em ${ORIGEM}. O formato mudou?`);

/* ── 2. Monta o bloco ────────────────────────────────────────────────────── */
const hoje = new Date().toISOString().slice(0, 10).split("-").reverse().join("/");
const corpo = [
  `> ⛔ **GERADO A PARTIR DO \`04\` — NÃO EDITE À MÃO.** Rode \`npm run docs:estado\`.`,
  `> Ele garante que este arquivo e o \`04\` não discordem. **Não** garante que o`,
  `> \`04\` concorde com o código — isso continua sendo conferência manual.`,
  `> Última geração: ${hoje}.`,
  "",
  "| Tela | ✅ feito | ❌ falta | 🔧 diverge por decisão |",
  "|---|---|---|---|",
  ...telas.map((t) => `| ${t.nome} | ${t.ok} | ${t.falta || "—"} | ${t.dec || "—"} |`),
].join("\n");

/* ── 3. Substitui entre os marcadores, ou morre ──────────────────────────── */
const destino = fs.readFileSync(DESTINO, "utf8");
const i = destino.indexOf(ABRE);
const f = destino.indexOf(FECHA);

if (i === -1) morrer(`marcador ${ABRE} não existe em ${DESTINO}. Não vou adivinhar onde escrever.`);
if (f === -1) morrer(`marcador ${FECHA} não existe em ${DESTINO}.`);
if (f < i) morrer(`os marcadores estão fora de ordem em ${DESTINO} (${FECHA} antes de ${ABRE}).`);
if (destino.indexOf(ABRE, i + 1) !== -1) morrer(`${ABRE} aparece mais de uma vez em ${DESTINO}.`);
if (destino.indexOf(FECHA, f + 1) !== -1) morrer(`${FECHA} aparece mais de uma vez em ${DESTINO}.`);

const novo = destino.slice(0, i + ABRE.length) + "\n" + corpo + "\n" + destino.slice(f);

if (conferir) {
  if (novo !== destino) {
    morrer("o bloco de ESTADO está desatualizado. Rode `npm run docs:estado`.");
  }
  console.log("\x1b[32m✓\x1b[0m bloco de ESTADO em dia.");
  process.exit(0);
}

if (novo === destino) {
  console.log("\x1b[32m✓\x1b[0m bloco de ESTADO já estava em dia.");
} else {
  fs.writeFileSync(DESTINO, novo);
  console.log(`\x1b[32m✓\x1b[0m bloco de ESTADO regenerado — ${telas.length} telas.`);
}
