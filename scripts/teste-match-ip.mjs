/**
 * O match de venda por IP sobrevive à purga progressiva?
 *
 * ## Por que este teste existe
 *
 * O `matchClick` casa venda com clique por **igualdade de IP**. Se a purga
 * anonimizar um lado e o outro continuar em claro, esse caminho de atribuição
 * **morre em silêncio** — sem erro, sem log. O usuário só notaria semanas
 * depois, vendo vendas atribuídas caindo.
 *
 * ## ⚠️ O caso 2 é o que dá valor ao conjunto
 *
 * Sem ele, um `where` quebrado que casasse com **qualquer** clique passaria nos
 * outros três. "Casa quando deve" só significa alguma coisa junto de "não casa
 * quando não deve".
 *
 * ## Escreve no banco de DESENVOLVIMENTO, e limpa por id
 *
 * Passa pelo `guard-db.mjs`. Cada linha criada tem o id coletado na criação e é
 * removida no fim — nunca por `LIKE` ou por nome.
 *
 *   npm run test:match
 */
import "dotenv/config";
import pg from "pg";
import { anonimizarIp, candidatosDeIp, podeIrParaCapi } from "@/lib/geo/anonimizarIp";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "teste-match-ip" });

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${a}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${a}\n      esperado: ${b}`);
  }
}

/**
 * Reproduz o `where` do `matchClick` em SQL.
 *
 * ⚠️ **Duplicação deliberada**, como na `geo:sonda`: se este teste importasse o
 * `matchClick`, um bug lá passaria por "tudo certo" aqui. O que ele prova é que
 * a REGRA (casar por `in` dos candidatos, dentro da janela, sem robô) funciona
 * contra o banco de verdade.
 */
async function casar(userId, ip) {
  const { rows } = await cliente.query(
    `SELECT "id" FROM "Click"
      WHERE "userId" = $1 AND "ip" = ANY($2::text[]) AND "bot" = false
        AND "timestamp" >= now() - interval '12 hours'
      ORDER BY "timestamp" DESC LIMIT 1`,
    [userId, candidatosDeIp(ip)],
  );
  return rows[0]?.id ?? null;
}

const criados = [];
async function criarClique(userId, ip, { bot = false, horasAtras = 0 } = {}) {
  const id = "mtest" + Math.random().toString(36).slice(2, 12);
  await cliente.query(
    `INSERT INTO "Click" (id, "clickId", "userId", "ip", "bot", "timestamp")
     VALUES ($1, $2, $3, $4, $5, now() - ($6 || ' hours')::interval)`,
    [id, "mtest-" + id, userId, ip, bot, String(horasAtras)],
  );
  criados.push(id);
  return id;
}

async function main() {
  await cliente.connect();
  const { rows: us } = await cliente.query(`SELECT id FROM "User" ORDER BY "createdAt" LIMIT 1`);
  if (!us.length) throw new Error("Banco de dev sem usuário. Rode `npm run seed:dev`.");
  const userId = us[0].id;

  const IP = "187.45.192.1";
  const OUTRO = "201.6.0.1";

  console.log("\n\x1b[1m1. Casa por IP em claro\x1b[0m");
  const c1 = await criarClique(userId, IP);
  eq("venda com o MESMO IP casa com o clique certo", await casar(userId, IP), c1);

  console.log("\n\x1b[1m2. ⚠️ NÃO casa com IP diferente\x1b[0m");
  // Sem esta asserção, um `where` que casasse com tudo passaria nas outras.
  eq("IP diferente não casa com nada", await casar(userId, OUTRO), null);

  console.log("\n\x1b[1m3. 🔴 Clique JÁ PURGADO (IP em hash) continua casando\x1b[0m");
  const ipAnon = anonimizarIp(IP);
  const c3 = await criarClique(userId, ipAnon);
  await cliente.query(`DELETE FROM "Click" WHERE id = $1`, [c1]); // isola: só o purgado sobra
  criados.splice(criados.indexOf(c1), 1);
  eq("venda com IP em claro casa com o clique anonimizado", await casar(userId, ipAnon), c3);
  eq("e casa passando o IP EM CLARO (é o que o gateway manda)", await casar(userId, IP), c3);
  eq("IP diferente segue sem casar, mesmo com o purgado presente", await casar(userId, OUTRO), null);

  console.log("\n\x1b[1m4. A CAPI daquela venda OMITE o client_ip_address\x1b[0m");
  const { rows: r4 } = await cliente.query(`SELECT "ip" FROM "Click" WHERE id = $1`, [c3]);
  eq("o valor gravado não passa na guarda da CAPI", podeIrParaCapi(r4[0].ip), false);
  eq("um IP em claro passaria", podeIrParaCapi(IP), true);

  console.log("\n\x1b[1m5. Bordas\x1b[0m");
  const cBot = await criarClique(userId, OUTRO, { bot: true });
  eq("clique de robô não casa (robô não compra)", await casar(userId, OUTRO), null);
  await cliente.query(`DELETE FROM "Click" WHERE id = $1`, [cBot]);
  criados.splice(criados.indexOf(cBot), 1);

  const cVelho = await criarClique(userId, OUTRO, { horasAtras: 20 });
  eq("clique fora da janela de 12h não casa", await casar(userId, OUTRO), null);
  await cliente.query(`DELETE FROM "Click" WHERE id = $1`, [cVelho]);
  criados.splice(criados.indexOf(cVelho), 1);

  eq("IP nulo não produz candidatos", candidatosDeIp(null), []);
  eq("IP em claro gera 2 candidatos", candidatosDeIp(IP).length, 2);
  eq("IP já anonimizado gera 1 (não re-hasheia)", candidatosDeIp(ipAnon), [ipAnon]);
}

main()
  .catch((e) => {
    falhas++;
    console.error("\n✗ Erro:", e.message);
  })
  .finally(async () => {
    // Limpeza por ID coletado na criação — nunca por LIKE ou por nome.
    if (criados.length) {
      const r = await cliente.query(`DELETE FROM "Click" WHERE id = ANY($1::text[])`, [criados]);
      console.log(`\n\x1b[2mlimpeza: ${r.rowCount} clique(s) de teste removidos por id\x1b[0m`);
    }
    await cliente.end();
    console.log(
      falhas === 0
        ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
        : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
    );
    process.exit(falhas === 0 ? 0 : 1);
  });
