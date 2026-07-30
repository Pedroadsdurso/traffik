/**
 * Leitura dos backups locais, com a escolha do arquivo feita EXPLÍCITA.
 *
 * ## Por que existe
 *
 * `teste-atribuicao-areas.mjs` escolhia o backup com `.sort().pop()` sobre os
 * nomes. No dia em que apareceu um backup de DESENVOLVIMENTO, o ref `drdf…`
 * passou a ordenar depois de `dgao…` e o teste rodou contra 8 registros
 * sintéticos, reportando "0 de 8 vendas perdidas" — falso verde no teste que
 * existe justamente para detectar aquele bug.
 *
 * A regra que ficou: **teste que escolhe o próprio dado precisa dizer qual
 * escolheu, e abortar quando não achar o certo.** Este módulo extrai a correção
 * que já estava no teste de áreas, para o próximo script não repetir o erro.
 *
 * Quem sabe o que é banco de dev continua sendo o `guard-db.mjs` — fonte única.
 * O projeto vem do cabeçalho `__meta` do próprio arquivo, não do nome, porque
 * renomear um backup não pode mudar contra o que o teste roda.
 */
import fs from "node:fs";
import path from "node:path";

import { ehBancoDeDesenvolvimento } from "../guard-db.mjs";

const PASTA = path.join(import.meta.dirname, "..", "..", "backups");

/** Data do nome do arquivo: `traffik-<ref>-<AAAA-MM-DD-HH-MM-SS>.jsonl`. */
function dataDoNome(nome) {
  return /(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/.exec(nome)?.[1] ?? "";
}

/** Cabeçalho `__meta` (primeira linha), sem carregar o arquivo inteiro. */
function meta(nome) {
  try {
    return JSON.parse(fs.readFileSync(path.join(PASTA, nome), "utf8").split("\n", 1)[0] ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Backup de PRODUÇÃO mais recente. **Aborta** se só houver backup de dev —
 * rodar contra dado sintético e reportar sucesso é pior que não rodar.
 */
export function escolherBackupDeProducao() {
  if (!fs.existsSync(PASTA)) {
    throw new Error(`Pasta backups/ não existe.\nGere um com: npm run backup -- --url '<conn de produção>'`);
  }

  const escolhido = fs
    .readdirSync(PASTA)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ f, projeto: meta(f).projeto }))
    .filter(({ projeto }) => projeto && !ehBancoDeDesenvolvimento(`postgres.${projeto}@x`))
    .sort((a, b) => dataDoNome(a.f).localeCompare(dataDoNome(b.f)))
    .at(-1);

  if (!escolhido) {
    throw new Error(
      "Nenhum backup de PRODUÇÃO em backups/ (só de desenvolvimento, ou nenhum).\n" +
        "Gere um com: npm run backup -- --url '<connection string de produção>'",
    );
  }
  return path.join(PASTA, escolhido.f);
}

/** Linhas de dados do backup (a primeira, `__meta`, é descartada). */
export function lerBackup(arquivo) {
  return fs
    .readFileSync(arquivo, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((o) => !o.__meta);
}
