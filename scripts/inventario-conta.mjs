/**
 * O que está pendurado numa conta — para decidir com evidência antes de apagar.
 *
 * ## Por que existe
 *
 * Apagar um `User` **cascateia**: o schema tem 15 relações `onDelete: Cascade`
 * saindo dele. Uma linha de `DELETE` leva vendas, cliques, eventos de pixel,
 * webhooks, pixels, contas de anúncio, campanhas, métricas diárias, regras,
 * despesas, áreas e credenciais. Não há desfazer, e o Supabase Free não tem PITR.
 *
 * Esta é a leitura que precede essa decisão. **Somente leitura** — nenhum
 * `UPDATE`, nenhum `DELETE`.
 *
 *   npm run conta:inventario -- --email 'teste@traffik.io'
 *   npm run conta:inventario -- --url '<conn>' --email 'teste@traffik.io'
 *   npm run conta:inventario -- --url '<conn>'          # todas as contas
 *
 * ## ⚠️ O que ele destaca, e por quê
 *
 * `contas_ads > 0` é o único item **irrecuperável de verdade**: `DailyAdMetric`
 * pende de `Ad` → `AdAccount` com `Cascade`, então apagar a conta destrói todo o
 * histórico de gasto — o número que alimenta ROAS, ROI e CPA de todos os
 * períodos. É o mesmo motivo pelo qual a exclusão de ÁREA nunca apaga a linha
 * de conta de anúncio, só desvincula.
 */
import "dotenv/config";

import pg from "pg";

const args = process.argv.slice(2);
const iUrl = args.indexOf("--url");
if (iUrl >= 0) {
  process.env.DATABASE_URL = args[iUrl + 1];
  process.env.DIRECT_URL = args[iUrl + 1];
}
const iEmail = args.indexOf("--email");
const email = iEmail >= 0 ? args[iEmail + 1] : null;

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

const C = { r: "\x1b[31m", g: "\x1b[32m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
const brl = (n) =>
  "R$ " +
  Number(n ?? 0)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d)(?=,))/g, ".");

const { rows: usuarios } = await cliente.query(
  email
    ? `SELECT id, email, name, "createdAt", "lastWorkspaceId" FROM "User" WHERE email = $1`
    : `SELECT id, email, name, "createdAt", "lastWorkspaceId" FROM "User" ORDER BY "createdAt"`,
  email ? [email] : [],
);

if (usuarios.length === 0) {
  console.log(`\n${C.y}Nenhum usuário encontrado${email ? ` com e-mail ${email}` : ""}.${C.x}\n`);
  await cliente.end();
  process.exit(0);
}

/** Tabelas que somem por Cascade ao apagar o usuário. */
const TABELAS = [
  ["Sale", "vendas"],
  ["Click", "cliques"],
  ["PixelEvent", "eventos de pixel"],
  ["Webhook", "webhooks"],
  ["PixelConfig", "pixels"],
  ["AdProfile", "perfis do Facebook"],
  ["AdAccount", "contas de anúncio"],
  ["AutomationRule", "regras"],
  ["Expense", "taxas e custos"],
  ["Workspace", "áreas de trabalho"],
  ["ApiCredential", "chaves de API"],
  ["Notification", "notificações"],
  ["WebhookLog", "logs de webhook"],
  ["DashboardLayout", "layouts salvos"],
];

for (const u of usuarios) {
  console.log(`\n${C.b}${"═".repeat(72)}${C.x}`);
  console.log(`${C.b}${u.email}${C.x}   ${C.d}${u.id}${C.x}`);
  console.log(
    `${C.d}nome: ${u.name ?? "—"} · criado em ${new Date(u.createdAt).toISOString().slice(0, 10)}${C.x}`,
  );
  console.log(`${C.b}${"═".repeat(72)}${C.x}\n`);

  const contagens = {};
  for (const [tabela, rotulo] of TABELAS) {
    const { rows } = await cliente.query(
      `SELECT COUNT(*)::int AS n FROM "${tabela}" WHERE "userId" = $1`,
      [u.id],
    );
    contagens[tabela] = rows[0].n;
    const cor = rows[0].n === 0 ? C.d : C.x;
    console.log(`  ${cor}${String(rows[0].n).padStart(6)}  ${rotulo}${C.x}`);
  }

  // Gasto de anúncio — o único dado verdadeiramente insubstituível.
  const { rows: gasto } = await cliente.query(
    `SELECT COALESCE(SUM(m.spend), 0) AS total, COUNT(*)::int AS linhas
       FROM "DailyAdMetric" m
       JOIN "Ad" a ON a.id = m."adId"
       JOIN "AdAccount" c ON c.id = a."adAccountId"
      WHERE c."userId" = $1`,
    [u.id],
  );
  const { rows: fat } = await cliente.query(
    `SELECT COALESCE(SUM(value), 0) AS total, COUNT(*)::int AS n
       FROM "Sale" WHERE "userId" = $1 AND status = 'APROVADA'`,
    [u.id],
  );

  console.log(`\n  ${C.b}Dado de negócio${C.x}`);
  console.log(`    Faturamento aprovado (histórico) .. ${brl(fat[0].total)} em ${fat[0].n} venda(s)`);
  console.log(
    `    Gasto de anúncio registrado ....... ${brl(gasto[0].total)} em ${gasto[0].linhas} linha(s)`,
  );

  // ── Veredito ──
  const perigo = contagens.AdAccount > 0 || Number(gasto[0].total) > 0;
  console.log(`\n  ${C.b}Se este usuário for apagado${C.x}`);
  if (perigo) {
    console.log(
      `    ${C.r}${C.b}⛔ NÃO APAGUE SEM PENSAR.${C.x} ${C.r}Há conta de anúncio e/ou gasto` +
        ` registrado.\n       O Cascade destrói o histórico de gasto — o número que alimenta` +
        `\n       ROAS, ROI e CPA de TODOS os períodos. Não há como reconstruir.${C.x}`,
    );
  } else if (Number(fat[0].total) > 0) {
    console.log(
      `    ${C.y}⚠️  Há ${brl(fat[0].total)} de faturamento aprovado.${C.x}\n` +
        `       Confirme que é dado de teste antes de apagar.`,
    );
  } else {
    console.log(
      `    ${C.g}✓ Sem conta de anúncio, sem gasto e sem faturamento aprovado.${C.x}\n` +
        `       Não há dado de negócio a perder.`,
    );
  }
  console.log(`    ${C.d}Some tudo que está listado acima, por Cascade.${C.x}`);
}

console.log(
  `\n${C.d}Somente leitura — nada foi alterado. Faça backup antes de qualquer DELETE:\n` +
    `  npm run backup -- --url '<conn>'${C.x}\n`,
);

await cliente.end();
