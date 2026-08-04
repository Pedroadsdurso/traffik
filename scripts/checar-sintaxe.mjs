/**
 * `node --check` em TODO script `.mjs` de `scripts/`.
 *
 * ## Por que existe
 *
 * `tsc --noEmit` nao le `.mjs`, e o `eslint` do projeto tambem nao cobre esta
 * pasta. Entao um erro de sintaxe num script so aparecia quando alguem rodava o
 * comando — e a primeira vez que isso aconteceu foi com o comando ja entregue
 * para rodar em PRODUCAO.
 *
 * ## A armadilha que motivou isto
 *
 * Estes scripts guardam SQL dentro de template literal de JS. Uma crase no meio
 * de um comentario SQL (citando um nome de funcao, por exemplo) FECHA a string,
 * e o arquivo inteiro deixa de ser parseavel. O erro aponta para a linha da
 * consulta, nao para a crase — entao ele nao se denuncia sozinho.
 *
 * Aconteceu duas vezes no mesmo arquivo, a segunda dentro do comentario escrito
 * para avisar sobre a primeira. Disciplina nao resolveu; verificacao resolve.
 */
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const dir = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const arquivos = readdirSync(dir).filter((f) => f.endsWith(".mjs"));

let maus = 0;
for (const f of arquivos) {
  try {
    execFileSync(process.execPath, ["--check", `${dir}/${f}`], { stdio: "pipe" });
  } catch (e) {
    maus++;
    const saida = String(e.stderr ?? e.message).split("\n").slice(0, 3).join("\n");
    console.error(`\x1b[31m✗\x1b[0m ${f}\n${saida}`);
  }
}
console.log(
  maus === 0
    ? `\x1b[32m✓\x1b[0m ${arquivos.length} script(s) .mjs sem erro de sintaxe`
    : `\x1b[31m${maus} de ${arquivos.length} com erro\x1b[0m`,
);
process.exitCode = maus ? 1 : 0;
