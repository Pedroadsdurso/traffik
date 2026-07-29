/**
 * Responde, no terminal: **em qual banco o `.env` está apontando agora?**
 *
 * `npm run db:onde`
 *
 * Complementa a faixa amarela do painel. A faixa cobre quem está olhando a
 * ferramenta; isto cobre quem está prestes a rodar um script — que é justamente
 * o momento em que o erro custa caro.
 *
 * Só LÊ. Nunca conecta no banco e nunca imprime a senha.
 */
import "dotenv/config";

import { ehBancoDeDesenvolvimento, refDoBanco } from "./guard-db.mjs";

const url = process.env.DATABASE_URL ?? "";
const direct = process.env.DIRECT_URL ?? "";

if (!url) {
  console.error("\n✗ DATABASE_URL não está definida no .env.\n");
  process.exit(1);
}

const ref = refDoBanco(url);
const refDirect = refDoBanco(direct);
const dev = ehBancoDeDesenvolvimento(url);
const regiao = url.match(/aws-[0-9]-([a-z0-9-]+)\.pooler/)?.[1] ?? "?";
const porta = url.match(/:(\d{4})\/postgres/)?.[1] ?? "?";

const faixa = dev
  ? "\x1b[42m\x1b[30m  DESENVOLVIMENTO  \x1b[0m"
  : "\x1b[41m\x1b[97m  ⚠  NÃO É DESENVOLVIMENTO — TRATE COMO PRODUÇÃO  \x1b[0m";

console.log(`\n${faixa}\n`);
console.log(`  ref .......... ${ref ?? "(sem ref — Postgres local ou URL fora do padrão)"}`);
console.log(`  região ....... ${regiao}`);
console.log(`  porta app .... ${porta} ${porta === "6543" ? "(transaction pooler ✓)" : "⚠ esperado 6543 para o app"}`);
console.log(`  DIRECT_URL ... ${refDirect ?? "(não definida)"}${
  refDirect && ref && refDirect !== ref ? "  ⚠ REF DIFERENTE do DATABASE_URL!" : ""
}`);

// Dois parâmetros que já custaram depuração aqui — ver CLAUDE.md.
const avisos = [];
if (url.includes("pgbouncer=true")) {
  avisos.push("`pgbouncer=true` na DATABASE_URL: o Prisma 7 com adapter `pg` não usa esse parâmetro.\n     Troque por `?sslmode=require&uselibpqcompat=true`.");
}
if (ref && !url.includes("sslmode=")) {
  avisos.push("DATABASE_URL sem `sslmode=require`.");
}
if (avisos.length) {
  console.log("\n  Avisos:");
  for (const a of avisos) console.log(`   • ${a}`);
}

console.log(
  dev
    ? "\n  Escrita de script LIBERADA (ref cadastrado em guard-db.mjs).\n"
    : "\n  Escrita de script BLOQUEADA pelo guard-db.mjs.\n",
);
