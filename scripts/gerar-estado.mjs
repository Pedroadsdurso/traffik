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
    atual = NAO_E_TELA.test(semEnfeite(cab[1])) ? null : { nome: limpo, ok: 0, falta: 0, dec: 0, tabelas: 0, dentroDeItens: false };
    if (atual) telas.push(atual);
    continue;
  }
  if (!atual) continue;

  /* ⛔ SÓ CONTA DENTRO DE UMA TABELA DE ITEM — `| Elemento | Status |`.
     Não basta "é linha de tabela": uma seção pode ter tabela EXPLICATIVA junto
     da de inventário, e um ✅ ilustrativo lá dentro virava "um item feito" no
     CLAUDE.md. Aconteceu em 07/08, ao escrever os 🔧 do Gerenciador: uma tabela
     de duas linhas comparando "hoje × na tela nova" somou um ✅ que não existia
     como item.

     O cabeçalho é o discriminador porque ele JÁ ERA a convenção das 13 tabelas
     de inventário — não foi preciso inventar marcador. Exigir marcador novo
     teria o defeito de sempre: vale só para quem lembrar de pôr, e a tabela sem
     ele volta a contar errado em silêncio.

     ⚠️ Uma linha que não começa com `|` FECHA a tabela. É o que impede a prosa
     entre duas tabelas de continuar somando na primeira. */
  const ehLinhaDeTabela = l.trimStart().startsWith("|");
  if (!ehLinhaDeTabela) { atual.dentroDeItens = false; continue; }
  /* ⚠️ Ancorado só na PRIMEIRA coluna. O cabeçalho não é uniforme no `04` — há
     `| Elemento | Status |` e `| Elemento | |` (a segunda coluna vazia), e a
     primeira versão desta guarda exigia as duas palavras: o DASHBOARD despencou
     de 29 ✅ para 6 em silêncio, porque a tabela maior dele usa a forma curta.
     Nenhuma tabela EXPLICATIVA do documento começa com `Elemento` — elas abrem
     com `Estado`, `Gatilho`, `hoje`, `Item`. */
  if (/^\|\s*Elemento\s*\|/.test(l.trimStart())) {
    atual.dentroDeItens = true;
    atual.tabelas++;
    continue;
  }
  if (!atual.dentroDeItens) continue;

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

/* ⛔ TELA SEM TABELA DE ITEM É ERRO, NÃO "zero itens".
   O modo de falha desta contagem é SILENCIOSO: um cabeçalho renomeado faz a
   seção reportar 0/0/0, que se lê como "tela sem inventário" em vez de "o
   script parou de achar a tabela". Foi assim que o DASHBOARD despencou de 29 ✅
   para 6 quando a regra do cabeçalho nasceu apertada demais — e o número errado
   já tinha sido escrito no CLAUDE.md antes de alguém olhar.

   Uma tela do `04` sempre tem pelo menos uma tabela de item. Zero significa que
   o formato mudou, e aí o certo é parar.

   ⚠️ **O LIMITE:** ela só pega a seção que perde TODAS as tabelas. Uma seção com
   duas tabelas que perde UMA continua com `tabelas >= 1`, passa aqui, e a
   contagem cai em silêncio — que é exatamente o caso do DASHBOARD (ele tem
   duas). Cobrir isso exigiria saber quantas tabelas cada seção deve ter, ou
   seja, uma lista à mão — e lista à mão fica atrás do código, sempre. */
const semTabela = telas.filter((t) => t.tabelas === 0);
if (semTabela.length > 0) {
  morrer(
    `seção sem nenhuma tabela de item (cabeçalho \`| Elemento | …\`): ` +
      `${semTabela.map((t) => t.nome).join(", ")}. ` +
      `Ou o cabeçalho mudou, ou a seção não é tela — em nenhum dos dois casos eu devo contar 0.`,
  );
}

/* ── 2. Monta o bloco ────────────────────────────────────────────────────── */
/* 🕐 O DIA É O DE SÃO PAULO, NÃO O DO PROCESSO.
 *
 * `toISOString()` devolve UTC. Às 21:13 em Brasília já é o dia seguinte lá, e o
 * carimbo mudava sozinho — `--conferir` passava a acusar "desatualizado" e o
 * `npm test` ficava vermelho sem ninguém ter tocado em nada. Aconteceu em
 * 07/08/2026, às 21:13.
 *
 * É a regra do projeto ("nenhuma agregação usa o dia do PROCESSO") na janela
 * exata que ela documenta — e vale para gerador de documentação igual: um teste
 * que só quebra depois das 21h é pior que um que quebra sempre, porque passa no
 * horário em que se costuma rodar. */
const hoje = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
const corpo = [
  `> ⛔ **GERADO A PARTIR DO \`04\` — NÃO EDITE À MÃO.** Rode \`npm run docs:estado\`.`,
  `> Ele garante que este arquivo e o \`04\` não discordem. **Não** garante que o`,
  `> \`04\` concorde com o código — isso continua sendo conferência manual.`,
  `> Última geração: ${hoje}.`,
  "",
  "| Tela | ✅ feito | ❌ falta | 🔧 diverge por decisão |",
  "|---|---|---|---|",
  ...telas.map((t) => `| ${t.nome} | ${t.ok} | ${t.falta || "—"} | ${t.dec || "—"} |`),
];

/* ── 3. Substitui entre os marcadores, ou morre ──────────────────────────── */
const destino = fs.readFileSync(DESTINO, "utf8");

/* 🩹 O BLOCO SEGUE O FIM DE LINHA DO ARQUIVO, e isso não é preciosismo.
   O `corpo` era montado com `\n` e escrito dentro de um `CLAUDE.md` que neste
   repositório está em CRLF. Resultado: `--conferir` acusava "desatualizado"
   toda vez, o `npm test` falhava por isso, e regenerar deixava o working tree
   sujo com um diff que o `git diff` mostra VAZIO — porque a única mudança era o
   fim de linha. Defeito que consome uma investigação inteira e não aparece em
   lugar nenhum. */
const EOL = destino.includes("\r\n") ? "\r\n" : "\n";
const corpoTexto = corpo.join(EOL);

const i = destino.indexOf(ABRE);
const f = destino.indexOf(FECHA);

if (i === -1) morrer(`marcador ${ABRE} não existe em ${DESTINO}. Não vou adivinhar onde escrever.`);
if (f === -1) morrer(`marcador ${FECHA} não existe em ${DESTINO}.`);
if (f < i) morrer(`os marcadores estão fora de ordem em ${DESTINO} (${FECHA} antes de ${ABRE}).`);
if (destino.indexOf(ABRE, i + 1) !== -1) morrer(`${ABRE} aparece mais de uma vez em ${DESTINO}.`);
if (destino.indexOf(FECHA, f + 1) !== -1) morrer(`${FECHA} aparece mais de uma vez em ${DESTINO}.`);

const novo = destino.slice(0, i + ABRE.length) + EOL + corpoTexto + EOL + destino.slice(f);

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
