/**
 * Apaga vendas por id, com o `userId` sempre no `WHERE`.
 *
 * ## Por que existe
 *
 * Venda de teste ingerida em produção infla faturamento, ROAS, ticket, ARPU,
 * CPA e o globo. Corrigir exige apagar a linha — e apagar venda não tem
 * desfazer, num banco sem PITR.
 *
 * ## As proteções
 *
 * | Proteção | O que ela evita |
 * |---|---|
 * | Simula por padrão; `--aplicar` para escrever | rodar achando que era leitura |
 * | `exigirBancoDeDesenvolvimento()` | apagar no banco errado |
 * | `--email` obrigatório, e todo id tem de ser dele | apagar venda de outra conta |
 * | `--confirmar <N>` com a quantidade | id a mais ou a menos passar batido |
 * | `WHERE id = ANY($1) AND "userId" = $2` | `WHERE` largo demais |
 * | Contagem do usuário antes e depois | dano além do pedido |
 *
 * > ### 🔴 O `userId` no WHERE não é redundância
 * > O id de venda é único, então filtrar por usuário parece supérfluo. Não é: se
 * > um id estiver errado e pertencer a **outra conta**, o `WHERE` sem `userId`
 * > apaga a venda dela — em silêncio, com o script reportando sucesso. Esta é a
 * > lição do incidente de 29/07/2026 (`UPDATE ... WHERE "name" = 'Area A'`).
 * >
 * > O script vai além: ele **procura os ids sem o filtro de usuário** e recusa
 * > se algum pertencer a outra conta, em vez de apenas não apagar.
 *
 * ## Uso
 *
 *   npm run venda:apagar -- --url '<conn>' --email 'x@y.z' --id 'a,b'
 *   ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \
 *     npm run venda:apagar -- --url '<conn>' --email 'x@y.z' --id 'a,b' \
 *       --confirmar 2 --aplicar
 */
import "dotenv/config";

import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

const args = process.argv.slice(2);
const arg = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const url = arg("--url");
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}
const email = arg("--email");
const ids = (arg("--id") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const confirmado = arg("--confirmar");
const aplicar = args.includes("--aplicar");

const C = { r: "\x1b[31m", g: "\x1b[32m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
const brl = (n) =>
  "R$ " +
  Number(n ?? 0)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d)(?=,))/g, ".");
const morrer = (m) => {
  console.error(`\n${C.r}${C.b}⛔ ${m}${C.x}\n`);
  process.exit(1);
};

if (!email) morrer("Faltou --email: o dono das vendas. É ele que entra no WHERE.");
if (ids.length === 0) morrer("Faltou --id 'id1,id2'.");
if (aplicar) exigirBancoDeDesenvolvimento({ script: "apagar-venda" });

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

// ── 1. Dono ─────────────────────────────────────────────────────────────────
const { rows: us } = await cliente.query(`SELECT id, email FROM "User" WHERE email = $1`, [email]);
if (us.length !== 1) morrer(`Esperava 1 usuário com e-mail ${email}, achei ${us.length}.`);
const dono = us[0];

// ── 2. 🔴 Os ids pertencem MESMO a ele? Busca SEM o filtro de usuário. ───────
const { rows: todas } = await cliente.query(
  `SELECT s.id, s."userId", u.email AS dono FROM "Sale" s JOIN "User" u ON u.id = s."userId"
    WHERE s.id = ANY($1)`,
  [ids],
);
const deOutros = todas.filter((r) => r.userId !== dono.id);
if (deOutros.length > 0) {
  morrer(
    `RECUSADO: ${deOutros.length} id(s) pertencem a OUTRA conta.\n` +
      deOutros.map((r) => `   ${r.id} → ${r.dono}`).join("\n") +
      `\n   Nenhuma linha foi tocada.`,
  );
}
const faltando = ids.filter((i) => !todas.some((r) => r.id === i));
if (faltando.length > 0) {
  morrer(`RECUSADO: ${faltando.length} id(s) não existem: ${faltando.join(", ")}`);
}

// ── 3. Mostrar as linhas ────────────────────────────────────────────────────
const { rows: alvo } = await cliente.query(
  `SELECT id, product, value, status, "externalId", platform, fbc, timestamp
     FROM "Sale" WHERE id = ANY($1) AND "userId" = $2 ORDER BY timestamp`,
  [ids, dono.id],
);

console.log(`\n${C.b}${"═".repeat(70)}${C.x}`);
console.log(`${C.b}APAGAR ${alvo.length} venda(s) de ${dono.email}${C.x}`);
console.log(`${C.b}${"═".repeat(70)}${C.x}`);
for (const r of alvo) {
  console.log(
    `\n  ${brl(r.value).padEnd(13)} ${String(r.product).slice(0, 28).padEnd(29)} ` +
      `${r.status}  ${new Date(r.timestamp).toISOString().slice(0, 16).replace("T", " ")}`,
  );
  console.log(`    ${C.d}id ${r.id}${C.x}`);
  console.log(`    ${C.d}externalId ${r.externalId ?? "—"} · gateway ${r.platform ?? "—"} · fbc ${r.fbc ? "sim" : "não"}${C.x}`);
}

// ── 4. Estado da conta antes ────────────────────────────────────────────────
const medir = async () => {
  const { rows } = await cliente.query(
    `SELECT COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE status = 'APROVADA')::int AS aprovadas,
            COALESCE(SUM(value) FILTER (WHERE status = 'APROVADA'), 0) AS rev
       FROM "Sale" WHERE "userId" = $1`,
    [dono.id],
  );
  return rows[0];
};
const antes = await medir();
const impacto = alvo.filter((r) => r.status === "APROVADA").reduce((a, r) => a + Number(r.value), 0);

console.log(`\n  ${C.b}A conta hoje${C.x}`);
console.log(`    ${antes.n} venda(s), ${antes.aprovadas} aprovada(s), ${brl(antes.rev)} de faturamento`);
console.log(`\n  ${C.b}Depois de apagar${C.x}`);
console.log(
  `    ${antes.n - alvo.length} venda(s), ${antes.aprovadas - alvo.filter((r) => r.status === "APROVADA").length}` +
    ` aprovada(s), ${brl(Number(antes.rev) - impacto)}  ${C.y}(−${brl(impacto)})${C.x}`,
);

// Notificações ficam órfãs (Sale.saleId é SetNull), não somem.
const { rows: nt } = await cliente.query(
  `SELECT COUNT(*)::int AS n FROM "Notification" WHERE "saleId" = ANY($1)`,
  [ids],
);
if (nt[0].n > 0) {
  console.log(
    `\n  ${C.d}⚠️  ${nt[0].n} notificação(ões) apontam para estas vendas. Elas NÃO somem\n` +
      `      (\`Notification.saleId\` é SetNull) — ficam sem venda associada.${C.x}`,
  );
}

// ── 5. Simulação ou execução ────────────────────────────────────────────────
if (!aplicar) {
  console.log(
    `\n${C.y}${C.b}SIMULAÇÃO — nada foi apagado.${C.x}\n\n  Para apagar:\n` +
      `  ${C.d}npm run venda:apagar -- --url '<conn>' --email '${email}' \\\n` +
      `      --id '${ids.join(",")}' --confirmar ${alvo.length} --aplicar${C.x}\n`,
  );
  await cliente.end();
  process.exit(0);
}

if (Number(confirmado) !== alvo.length) {
  morrer(
    `Confirmação não bate: você passou --confirmar ${confirmado ?? "(nada)"} e são ` +
      `${alvo.length} venda(s).\n   Confira a lista acima antes de repetir.`,
  );
}

// 🔴 userId no WHERE, sempre — mesmo com o id sendo único.
console.log(`\n${C.y}Apagando…${C.x}`);
const res = await cliente.query(`DELETE FROM "Sale" WHERE id = ANY($1) AND "userId" = $2`, [ids, dono.id]);
if (res.rowCount !== alvo.length) {
  morrer(`Esperava apagar ${alvo.length}, apaguei ${res.rowCount}. Verifique o banco.`);
}

// ── 6. Verificação ──────────────────────────────────────────────────────────
const { rows: sobrou } = await cliente.query(`SELECT id FROM "Sale" WHERE id = ANY($1)`, [ids]);
const depois = await medir();

console.log(`\n${C.b}Verificação${C.x}`);
console.log(
  `  ${sobrou.length === 0 ? C.g + "✓" : C.r + "✗"} as ${alvo.length} venda(s) sumiram` +
    `${sobrou.length ? ` — SOBRARAM ${sobrou.length}` : ""}${C.x}`,
);
const esperado = antes.n - alvo.length;
console.log(
  `  ${depois.n === esperado ? C.g + "✓" : C.r + "✗"} a conta foi de ${antes.n} para ` +
    `${depois.n} venda(s) (esperado ${esperado})${C.x}`,
);
console.log(`  ${C.g}✓${C.x} faturamento: ${brl(antes.rev)} → ${brl(depois.rev)}`);

const ok = sobrou.length === 0 && depois.n === esperado;
console.log(
  ok
    ? `\n${C.g}${C.b}✓ Concluído. Nenhuma outra venda desta conta foi afetada.${C.x}\n`
    : `\n${C.r}${C.b}⚠️  Resultado inesperado. RESTAURE O BACKUP.${C.x}\n`,
);

await cliente.end();
process.exit(ok ? 0 : 1);
