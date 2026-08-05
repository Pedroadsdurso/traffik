/**
 * Para QUAL banco o `prisma migrate deploy` vai, se você rodar agora?
 *
 * ## Por que este script existe
 *
 * Em 05/08/2026 o dashboard de produção ficou vazio porque a migration
 * `20260805200000_checkout_na_jornada` **não estava aplicada lá** — e o comando
 * havia sido rodado, com saída tranquilizadora.
 *
 * `prisma.config.ts` resolve **`DIRECT_URL ?? DATABASE_URL`**, e o `.env` local
 * aponta para DESENVOLVIMENTO por desenho. Então `npx prisma migrate deploy` da
 * máquina aplica **no dev** e imprime *"No pending migrations to apply"*, porque
 * lá já estava aplicada. Nada na saída diz em qual banco ele mexeu.
 *
 * É a MESMA armadilha que o `npm run backup` já teve — `DIRECT_URL` do `.env`
 * vencendo quem exportou só `DATABASE_URL` — agora numa operação de ESCRITA de
 * schema, onde o preço é produção fora do ar.
 *
 *   npm run migrate:alvo
 *
 * Somente leitura: não conecta em banco nenhum, só resolve a mesma expressão que
 * o Prisma vai resolver.
 */
import "dotenv/config";
import { ehBancoDeDesenvolvimento as ehDesenvolvimento, refDoBanco as refDe } from "./guard-db.mjs";

const A = "\x1b[0m";
const neg = (t) => `\x1b[1m${t}${A}`;
const vermelho = (t) => `\x1b[41m\x1b[30m${t}${A}`;
const verde = (t) => `\x1b[42m\x1b[30m${t}${A}`;
const amarelo = (t) => `\x1b[43m\x1b[30m${t}${A}`;
const cinza = (t) => `\x1b[2m${t}${A}`;

// ⚠️ A MESMA expressão do `prisma.config.ts`. Se ela mudar lá, muda aqui — duas
// resoluções da mesma pergunta divergiriam, e é justamente a divergência que
// este script existe para impedir.
const direto = process.env.DIRECT_URL;
const app = process.env.DATABASE_URL;
const alvo = direto ?? app;

console.log(`\n${neg("Para onde o `prisma migrate deploy` vai AGORA")}\n`);

if (!alvo) {
  console.log(vermelho("  SEM ALVO  ") + " nem DIRECT_URL nem DATABASE_URL definidas.\n");
  process.exit(1);
}

const ref = refDe(alvo);
const dev = ehDesenvolvimento(alvo);

console.log(`  alvo ......... ${neg(ref ?? "desconhecido")}`);
console.log(`  resolvido de . ${direto ? "DIRECT_URL" : "DATABASE_URL"}` +
            (direto && app ? cinza("   (DIRECT_URL vence DATABASE_URL)") : ""));
console.log(`  DIRECT_URL ... ${direto ? (refDe(direto) ?? "desconhecido") : cinza("(não definida)")}`);
console.log(`  DATABASE_URL . ${app ? (refDe(app) ?? "desconhecido") : cinza("(não definida)")}`);
console.log();

if (dev) {
  console.log(verde("  DESENVOLVIMENTO  ") + " a migration será aplicada no banco de dev.\n");
  console.log("  Para aplicar em PRODUÇÃO, sobrescreva " + neg("DIRECT_URL") + " (não DATABASE_URL):\n");
  console.log(cinza("    $env:DIRECT_URL = \"<connection string de produção, porta 5432>\""));
  console.log(cinza("    npx prisma migrate deploy\n"));
  console.log("  A saída PRECISA dizer " + neg("Applying migration <nome>") + ".");
  console.log("  Se disser \"No pending migrations\", você continua no dev.\n");
} else {
  console.log(vermelho("  NÃO É O BANCO DE DEV  ") + ` ref ${ref ?? "desconhecido"}\n`);
  console.log("  Se este é o banco de PRODUÇÃO, confirme antes:\n");
  console.log("   • fez backup?  " + cinza("npm run backup -- --url '<conn>'"));
  console.log("   • a migration é ADITIVA (coluna nullable / com default)?");
  console.log("   • a ordem é migration PRIMEIRO, push depois.\n");
}

// ⚠️ Divergência entre as duas variáveis é o cenário exato do incidente: quem
// exporta só `DATABASE_URL` acha que mudou o alvo e não mudou.
if (direto && app && refDe(direto) !== refDe(app)) {
  console.log(amarelo("  ATENÇÃO  ") + " DIRECT_URL e DATABASE_URL apontam para bancos DIFERENTES.");
  console.log(`  O migrate usa ${neg(refDe(direto) ?? "?")} (DIRECT_URL). O app usa ${refDe(app) ?? "?"}.\n`);
}
