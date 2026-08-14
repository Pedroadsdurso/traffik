/**
 * O CATÁLOGO E A TABELA F0b NÃO PODEM DIVERGIR — e hoje nada garante isso.
 *
 * 🔴 SÃO DUAS FONTES PARA O MESMO NÚMERO
 *
 * O `hMin`/`hPadrao` de cada bloco vive em `catalogo.ts`. A medição que os
 * produziu vive na tabela da §11 do `07`. Medido em 14/08/2026: os 16 batem —
 * **por disciplina, não por ferramenta**. Quem editar um e esquecer o outro
 * produz a família que este projeto já pagou nove vezes: documentação que
 * afirma um valor que o código não tem mais.
 *
 * ⛔ E aqui a divergência é PIOR que cosmética. A tabela da §11 é a evidência de
 * onde o `h` veio — é ela que a próxima pessoa vai ler para decidir se o `h` de
 * um bloco é confiável. Uma tabela que não corresponde ao catálogo faz essa
 * decisão em cima de um número que não está em lugar nenhum.
 *
 * ### O que este teste NÃO faz
 *
 * ⚠️ Ele **não** valida que a medição da §11 está certa — ela foi feita numa
 * sessão de navegador e ninguém a reproduziu. Ele valida que as DUAS CÓPIAS do
 * resultado concordam. A procedência da medição é outro assunto, e está aberta
 * no `## Estado` do `07`: há indício forte de que ela mediu o estado VAZIO.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const md = readFileSync("docs/design/07-GRADE-E-BLOCOS.md", "utf8").replace(/\r\n/g, "\n");
const ts = readFileSync("src/components/dashboard/catalogo.ts", "utf8").replace(/\r\n/g, "\n");

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

console.log("\nO catálogo e a tabela F0b");

/* ---- A tabela da §11: | `id` | span | linhas | cel | h@1280 | h@2260 | cel | **h** | ---- */
const linhasF0b = [...md.matchAll(/^\|\s*`([a-z0-9-]+)`\s*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*\*\*(\d+)\*\*\s*\|/gm)];
const f0b = new Map(linhasF0b.map((m) => [m[1], Number(m[2])]));

/* ⛔ LINHA DE BASE. Sem ela, uma âncora quebrada devolve zero linhas e o teste
   passa afirmando que as duas fontes concordam — a coleção vazia satisfazendo
   tudo. É a armadilha que este arquivo existe para não repetir. */
ok("linha de base: a tabela F0b foi lida do `07`", f0b.size >= 16, f0b.size + " blocos na tabela");

/* ---- O catálogo ---- */
const idx = [...ts.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((m) => ({ id: m[1], at: m.index }));
const catalogo = new Map();
for (let i = 0; i < idx.length; i++) {
  const corpo = ts.slice(idx[i].at, i + 1 < idx.length ? idx[i + 1].at : ts.length);
  const hMin = corpo.match(/hMin:\s*(\d+)/);
  const hPad = corpo.match(/hPadrao:\s*(\d+)/);
  if (hMin) catalogo.set(idx[i].id, { hMin: Number(hMin[1]), hPadrao: hPad ? Number(hPad[1]) : null });
}
ok("linha de base: o catálogo foi lido", catalogo.size >= 16, catalogo.size + " blocos com hMin");

/* ---- 1. Cobertura: todo bloco da tabela existe no catálogo, e vice-versa ---- */
const soNaTabela = [...f0b.keys()].filter((id) => !catalogo.has(id));
const soNoCatalogo = [...catalogo.keys()].filter((id) => !f0b.has(id));
ok("todo bloco da F0b existe no catálogo", soNaTabela.length === 0, soNaTabela.length ? JSON.stringify(soNaTabela) : "0 órfãos");
ok("todo bloco do catálogo existe na F0b", soNoCatalogo.length === 0, soNoCatalogo.length ? JSON.stringify(soNoCatalogo) : "0 órfãos");

/* ---- 2. O NÚMERO: `h migrado` da tabela === `hMin` do catálogo ---- */
const divergem = [];
for (const [id, h] of f0b) {
  const c = catalogo.get(id);
  if (c && c.hMin !== h) divergem.push({ bloco: id, f0b: h, catalogo: c.hMin });
}
ok(
  "o `h migrado` da F0b é o `hMin` do catálogo em TODOS",
  divergem.length === 0,
  divergem.length ? "DIVERGEM: " + JSON.stringify(divergem) : "0 de " + f0b.size + " divergem",
);

/* ---- 3. `hMin === hPadrao`, que é decisão registrada no catálogo ---- */
const desiguais = [...catalogo.entries()].filter(([, c]) => c.hPadrao !== null && c.hMin !== c.hPadrao);
ok(
  "`hMin` e `hPadrao` seguem iguais (decisão registrada no catálogo)",
  desiguais.length === 0,
  desiguais.length ? JSON.stringify(desiguais) : "0 de " + catalogo.size,
);

/* ---------------------------------------------------------------------------
 * 4. PROVA PELO LADO NEGATIVO
 *
 * PLANTIO: mexer no `h` de UM bloco só num dos lados — que é literalmente a
 * regressão que este arquivo existe para pegar.
 * ------------------------------------------------------------------------ */
{
  const alvo = "produtos";
  ok("linha de base do plantio: o alvo existe nos dois lados", f0b.has(alvo) && catalogo.has(alvo));

  const f0bAdulterada = new Map(f0b);
  f0bAdulterada.set(alvo, f0b.get(alvo) + 1);

  const achados = [];
  for (const [id, h] of f0bAdulterada) {
    const c = catalogo.get(id);
    if (c && c.hMin !== h) achados.push(id);
  }
  ok("PLANTIO: mexer no h de um lado só É detectado", achados.length === 1 && achados[0] === alvo, JSON.stringify(achados));
}

/* ---------------------------------------------------------------------------
 * 5. O AGRUPAMENTO — publicado, não asserido, e é de propósito
 *
 * ⚠️ Isto NÃO é uma asserção: é a evidência da suspeita de procedência do `h`,
 * impressa a cada execução para não depender de ninguém lembrar de recalcular.
 * Blocos de conteúdo completamente diferente medindo a MESMA altura ao pixel é
 * assinatura de PISO, não de conteúdo.
 * ------------------------------------------------------------------------ */
{
  const px = [...md.matchAll(/^\|\s*`([a-z0-9-]+)`\s*\|[^|]*\|[^|]*\|[^|]*\|\s*\*?\*?(\d+)\*?\*?\s*\|\s*\*?\*?(\d+)\*?\*?\s*\|/gm)]
    .map((m) => ({ id: m[1], a1280: Number(m[2]), a2260: Number(m[3]) }));
  const porMax = {};
  for (const b of px) (porMax[Math.max(b.a1280, b.a2260)] ||= []).push(b.id);
  const clusters = Object.entries(porMax).filter(([, ids]) => ids.length > 1);
  const emCluster = clusters.flatMap(([, ids]) => ids);
  console.log("\n  ── altura medida IDÊNTICA entre blocos (assinatura de piso) ──");
  for (const [v, ids] of clusters.sort((a, b) => b[0] - a[0])) {
    console.log("     " + String(v).padStart(4) + "px × " + ids.length + "  " + ids.join(", "));
  }
  console.log("     em cluster: " + emCluster.length + " de " + px.length + " painéis\n");
}

console.log("\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
