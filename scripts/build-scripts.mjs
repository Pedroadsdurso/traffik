/**
 * Minifica os runtimes instaláveis (`src/scripts/*.src.js`) para `public/`.
 *
 *   node scripts/build-scripts.mjs          # gera os arquivos
 *   node scripts/build-scripts.mjs --check  # falha se o commitado estiver defasado
 *
 * Roda no `npm run build`, e a saída é COMMITADA — assim `npm run dev` serve os
 * arquivos sem passo extra, e um deploy nunca sobe sem eles. Mesma escolha do
 * `gen-world-paths.mjs`.
 *
 * `public/pixel.js` é o alias legado do runtime de UTMs: quem instalou o script
 * antigo (com `data-account`) continua funcionando, sem manter duas cópias da
 * lógica — o runtime aceita os dois formatos de configuração.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minify } from "terser";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

/** Cada fonte e para onde vai. O mesmo bundle pode sair em mais de um caminho. */
const ALVOS = [
  { fonte: "src/scripts/traffik-utm.src.js", saidas: ["public/t.js", "public/pixel.js"] },
  { fonte: "src/scripts/traffik-pixel.src.js", saidas: ["public/px.js"] },
];

const OPCOES = {
  ecma: 5,
  compress: { passes: 3, unsafe: true },
  mangle: { toplevel: true },
  // Preserva só o banner `/*! ... */`, que identifica o arquivo em produção.
  format: { comments: /^!/ },
};

function kb(n) {
  return (n / 1024).toFixed(2) + " KB";
}

let defasado = false;

for (const alvo of ALVOS) {
  const origem = path.join(raiz, alvo.fonte);
  const codigo = readFileSync(origem, "utf8");

  const res = await minify(codigo, OPCOES);
  if (!res.code) throw new Error(`terser não devolveu código para ${alvo.fonte}`);
  // Banner de uma linha: o comentário longo da fonte não precisa ir para produção.
  const saida = `/*! Traffik ${path.basename(alvo.saidas[0])} */\n${res.code}\n`;

  const bruto = Buffer.byteLength(codigo, "utf8");
  const min = Buffer.byteLength(saida, "utf8");
  const gz = gzipSync(Buffer.from(saida, "utf8")).length;

  for (const rel of alvo.saidas) {
    const destino = path.join(raiz, rel);
    const atual = existsSync(destino) ? readFileSync(destino, "utf8") : null;
    if (atual === saida) continue;
    if (check) {
      console.error(`[scripts] ${rel} está defasado — rode: node scripts/build-scripts.mjs`);
      defasado = true;
      continue;
    }
    writeFileSync(destino, saida, "utf8");
  }

  console.log(`${alvo.saidas.join(" + ").padEnd(30)} ${kb(bruto)} → ${kb(min)} min (${kb(gz)} gzip)`);
}

if (defasado) process.exit(1);
