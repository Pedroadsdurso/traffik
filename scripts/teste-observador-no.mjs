/**
 * O NÓ OBSERVADO VIVE EM ESTADO, NUNCA EM `useRef` — guarda estática.
 *
 * 🔴 A REGRA JÁ EXISTIA E ESTAVA SENDO VIOLADA POR 5 DOS 6 CONSUMIDORES
 *
 * `dashboard/ui/useTamanho.ts` documenta no próprio cabeçalho:
 *
 *   > ⛔ `ref` é CALLBACK, e o nó vive em ESTADO. Não troque por `useRef`.
 *   > A primeira versão usava `useRef` + `useEffect(…, [])`. Parecia certo e
 *   > estava errado.
 *
 * Em 14/08/2026 a varredura achou **5 de 6** componentes com `ResizeObserver`
 * fazendo exatamente o que aquele cabeçalho proíbe. A regra estava escrita e
 * dependia de alguém lembrar — que é a definição de regra que vira ferramenta.
 *
 * ### Por que o modo de falha é MUDO
 *
 * `useRef` não entra nas deps do effect. Se o nó ainda não existe quando o
 * effect roda — ou se ele TROCA DE IDENTIDADE depois —, o observer fica preso
 * num nó morto (ou nunca liga). Não há erro, não há exceção: a medição
 * simplesmente nunca chega, e o componente fica no valor inicial para sempre.
 * É o TERCEIRO ESTADO do `FitaFunil`, e ele custou uma sessão para ser achado.
 *
 * ⛔ O caso mais caro achado na varredura foi o `GlobeView`: `box` é montado em
 * DOIS caminhos de render (o atalho de `lado === 0` e o normal). Quando `lado`
 * deixa de ser 0 o nó troca, e com deps `[altura]` o observer continuava preso
 * ao nó REMOVIDO — o globo parava de responder a resize, em silêncio.
 *
 * ### O que esta guarda mede, e o que ela NÃO mede
 *
 * ✅ que nenhum arquivo com `new ResizeObserver` capture o nó observado por
 *    `<algo>.current`.
 * ⛔ **não** mede se as deps estão completas, nem se o observer é reapontado —
 *    isso é leitura. Ela fecha a porta pela qual os 5 entraram, não todas.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = "src";

function arquivos(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...arquivos(p));
    else if (/\.tsx?$/.test(nome)) saida.push(p);
  }
  return saida;
}

/** Apaga comentários — a prosa cita os símbolos JUSTAMENTE para explicá-los. */
const semComentarios = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

const todos = arquivos(RAIZ).filter((p) => !p.includes("generated"));
const comObserver = todos
  .map((p) => ({ p, fonte: semComentarios(readFileSync(p, "utf8").replace(/\r\n/g, "\n")) }))
  .filter((f) => f.fonte.includes("new ResizeObserver"));

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

console.log("\nO nó observado vive em ESTADO");

/* ⛔ LINHA DE BASE. Sem ela, um `glob` quebrado devolve zero arquivos e a
   varredura passa afirmando que não há violação — a coleção vazia satisfazendo
   tudo. O número vai na saída: é o DENOMINADOR. */
ok(
  "linha de base: há arquivos com ResizeObserver para examinar",
  comObserver.length >= 6,
  comObserver.length + " arquivos examinados de " + todos.length + " .ts/.tsx",
);

/* A violação: dentro do bloco que cria o observer, o nó vem de `X.current`. */
const violam = [];
for (const { p, fonte } of comObserver) {
  const linhas = fonte.split("\n");
  const i = linhas.findIndex((l) => l.includes("new ResizeObserver"));
  /* Janela do effect: 25 linhas acima da criação do observer. */
  const janela = linhas.slice(Math.max(0, i - 25), i + 3).join("\n");
  const m = janela.match(/const\s+(\w+)\s*=\s*(\w+)\.current\s*;/);
  if (m) violam.push({ arquivo: p, no: m[1], ref: m[2] });
}

ok(
  "nenhum nó observado vem de `.current`",
  violam.length === 0,
  violam.length
    ? "VIOLAM: " + JSON.stringify(violam)
    : "0 de " + comObserver.length + " examinados",
);

/* ---------------------------------------------------------------------------
 * PROVA PELO LADO NEGATIVO — a guarda só conta se derrubar com o defeito.
 *
 * PLANTIO: o shape exato que os 5 tinham antes de 14/08 — `useRef` + o nó lido
 * de `.current` dentro do effect que cria o observer.
 * ------------------------------------------------------------------------ */
{
  const plantado = `
  const refX = React.useRef(null);
  React.useEffect(() => {
    const el = refX.current;
    if (!el) return;
    const medir = () => {};
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
`;
  const linhas = semComentarios(plantado).split("\n");
  const i = linhas.findIndex((l) => l.includes("new ResizeObserver"));
  const janela = linhas.slice(Math.max(0, i - 25), i + 3).join("\n");
  const m = janela.match(/const\s+(\w+)\s*=\s*(\w+)\.current\s*;/);
  ok("PLANTIO: o shape antigo É detectado", !!m, m ? m[2] + ".current -> " + m[1] : "não detectou");

  /* E o shape CERTO não é acusado — senão a guarda reprovaria o conserto. */
  const certo = plantado
    .replace("const refX = React.useRef(null);", "const [el, setEl] = React.useState(null);")
    .replace("    const el = refX.current;\n", "")
    .replace("}, []);", "}, [el]);");
  const lc = semComentarios(certo).split("\n");
  const ic = lc.findIndex((l) => l.includes("new ResizeObserver"));
  const jc = lc.slice(Math.max(0, ic - 25), ic + 3).join("\n");
  ok("PLANTIO: o shape CERTO não é acusado", !/const\s+\w+\s*=\s*\w+\.current\s*;/.test(jc));
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: " + comObserver.length + " arquivos com ResizeObserver\n");
