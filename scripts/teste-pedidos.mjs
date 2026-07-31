/**
 * # Conversão ≠ item vendido
 *
 * Prova que um checkout com order bump conta como **UMA conversão** e **duas
 * linhas de faturamento** — e mede o estrago que a contagem por linha causava
 * no CPA e na taxa de conversão do funil.
 *
 * ## Por que roda o `computeDashboard` de verdade
 *
 * Testar `contarPedidos` sozinho provaria que a função soma certo. Não provaria
 * que ela **é chamada** nos lugares que alimentam os cards — que é exatamente o
 * modo de falha catalogado no PROCEDIMENTO (cinco casos, todos passando no
 * `tsc`, no `lint` e no `build` com a coisa desligada).
 *
 * Escreve no banco de DEV (o `guard-db` garante) e apaga por id no fim.
 *
 * Uso: npm run test:pedidos
 */
import "dotenv/config";

import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "teste-pedidos" });

const { contarPedidos, umPorPedido, chaveDoPedido } = await import("../src/lib/pedidos.ts");
const { computeDashboard } = await import("../src/lib/dashboard/metrics.ts");

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();
const q = (sql, p = []) => cliente.query(sql, p);

let ok = 0;
const falhas = [];
async function checar(nome, fn) {
  try {
    await fn();
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome}`);
  } catch (e) {
    falhas.push(nome);
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      ${e.message}`);
  }
}

// ───────────────────── 1. A função pura ─────────────────────

console.log("\nFunção pura\n");

await checar("checkout com order bump = 1 conversão, 2 linhas", () => {
  const carrinho = [
    { id: "a", pedidoId: "chk-1" },
    { id: "b", pedidoId: "chk-1" },
  ];
  assert.equal(carrinho.length, 2);
  assert.equal(contarPedidos(carrinho), 1);
  assert.equal(umPorPedido(carrinho).length, 1);
});

await checar("venda ANTIGA (pedidoId nulo) é o próprio pedido", () => {
  // ⚠️ Sem este fallback, toda venda anterior à migration cairia no mesmo balde
  // `null` e o CPA histórico explodiria.
  const antigas = [{ id: "x", pedidoId: null }, { id: "y", pedidoId: null }, { id: "z" }];
  assert.equal(contarPedidos(antigas), 3);
  assert.equal(chaveDoPedido({ id: "x", pedidoId: null }), "x");
});

await checar("misturar antigo e novo não colapsa nada", () => {
  const mix = [{ id: "a", pedidoId: "p1" }, { id: "b", pedidoId: "p1" }, { id: "c", pedidoId: null }];
  assert.equal(contarPedidos(mix), 2);
});

// ───────────────────── 2. Ponta a ponta no dashboard ─────────────────────

const userId = "ped-" + crypto.randomUUID();
const contaId = "ped-" + crypto.randomUUID();
const campId = "ped-" + crypto.randomUUID();
const adsetId = "ped-" + crypto.randomUUID();
const adId = "ped-" + crypto.randomUUID();
const wsId = "ped-" + crypto.randomUUID();

await q(`INSERT INTO "User"(id,email,name,"passwordHash",timezone,"updatedAt") VALUES($1,$2,'Ped','x','America/Sao_Paulo',now())`,
  [userId, `ped-${userId}@t.local`]);
await q(`INSERT INTO "Workspace"(id,"userId",name,"isDefault","updatedAt") VALUES($1,$2,'Principal',true,now())`, [wsId, userId]);
await q(`INSERT INTO "AdAccount"(id,"userId","fbAccountId",name,"trackingEnabled","updatedAt") VALUES($1,$2,'act_1','Conta',true,now())`,
  [contaId, userId]);
await q(`INSERT INTO "Campaign"(id,"adAccountId","fbCampaignId",name,status,"updatedAt") VALUES($1,$2,'c1','Camp','ACTIVE',now())`, [campId, contaId]);
await q(`INSERT INTO "AdSet"(id,"adAccountId","campaignId","fbAdSetId",name,status,"updatedAt") VALUES($1,$2,$3,'s1','Set','ACTIVE',now())`,
  [adsetId, contaId, campId]);
await q(`INSERT INTO "Ad"(id,"adAccountId","campaignId","adSetId","fbAdId",name,status,"updatedAt") VALUES($1,$2,$3,$4,'a1','Anuncio','ACTIVE',now())`,
  [adId, contaId, campId, adsetId]);

// Gasto de R$ 300 HOJE, para o CPA ter denominador.
//
// ⚠️ `CURRENT_DATE` seria o dia do BANCO (UTC), não o do usuário. Depois das
// 21h em Brasília o UTC já virou, e o gasto cairia no dia seguinte — o teste
// falhou exatamente assim, às 00h01 UTC. É a mesma classe de bug que o
// `lib/timezone.ts` existe para eliminar: nenhuma agregação usa o dia do
// processo, e nenhum teste deveria semear com ele.
await q(`INSERT INTO "DailyAdMetric"(id,"adId",date,spend,impressions,clicks,"updatedAt")
         VALUES($1,$2,(now() AT TIME ZONE 'America/Sao_Paulo')::date,300,1000,50,now())`,
  ["ped-" + crypto.randomUUID(), adId]);

/**
 * DOIS compradores, TRÊS linhas de venda:
 *   - Ana comprou o principal (90) + order bump (27) — MESMO checkout
 *   - Bruno comprou só o principal (100)
 * Faturamento = 217. Conversões = 2. Itens = 3.
 */
const vendas = [
  ["chk-ana", "principal", 90, "ana@t.local"],
  ["chk-ana", "orderbump", 27, "ana@t.local"],
  ["chk-bruno", "principal", 100, "bruno@t.local"],
];
for (const [pedido, tipo, valor, email] of vendas) {
  await q(
    `INSERT INTO "Sale"(id,"userId","externalId","pedidoId","itemTipo",value,product,status,"paymentMethod","buyerEmail","approvedAt","updatedAt")
     VALUES($1,$2,$3,$4,$5,$6,$7,'APROVADA','PIX',$8,now(),now())`,
    ["ped-" + crypto.randomUUID(), userId, `${pedido}-${tipo}`, pedido, tipo, valor, `Produto ${tipo}`, email],
  );
}

console.log("\nDashboard real (3 linhas de venda, 2 compradores, gasto R$ 300)\n");

const d = await computeDashboard(userId, { period: "hoje", account: "todas", product: "todos", source: "todas" });
const k = d.kpis;

await checar("faturamento soma as LINHAS: 90 + 27 + 100 = 217", () => {
  assert.equal(k.revenue, 217);
});

await checar("vendas conta CONVERSÕES: 2, não 3", () => {
  assert.equal(k.sales, 2, `veio ${k.sales}`);
});

await checar("CPA = 300 ÷ 2 = 150 (contando itens daria 100)", () => {
  assert.equal(k.cpa, 150, `veio ${k.cpa}`);
});

await checar("ticket médio = 217 ÷ 2 = 108,50 (é o valor do CARRINHO)", () => {
  assert.equal(Math.round(k.ticket * 100) / 100, 108.5, `veio ${k.ticket}`);
});

await checar("funil: 2 vendas iniciadas e 2 aprovadas, não 3", () => {
  assert.equal(d.funnel.iniciadas, 2, `iniciadas=${d.funnel.iniciadas}`);
  assert.equal(d.funnel.vendas, 2, `vendas=${d.funnel.vendas}`);
});

await checar("taxa de aprovação conta o Pix uma vez por compra", () => {
  const pix = d.approval.find((a) => /pix/i.test(a.name));
  assert.ok(pix, "método Pix não apareceu");
  assert.equal(pix.geradas, 2, `geradas=${pix.geradas}`);
});

await checar("'Vendas por produto' continua contando ITENS — é onde o item é o assunto", () => {
  const bump = d.products.find((p) => p.name === "Produto orderbump");
  assert.ok(bump, "o order bump sumiu do ranking de produtos");
  assert.equal(bump.sales, 1);
  assert.equal(bump.total, 27);
});

await checar("por dia: 2 conversões, R$ 217 (contagem e soma são contas diferentes)", () => {
  const hoje = d.byDay.at(-1);
  assert.equal(hoje.sales, 2, `sales=${hoje.sales}`);
  assert.equal(hoje.revenue, 217, `revenue=${hoje.revenue}`);
});

// ───────────────────── 3. Antes × depois ─────────────────────

const linhas = 3;
const conversoes = k.sales;
const tabela = [
  ["", "contando ITENS (antes)", "contando PEDIDOS (agora)"],
  ["Vendas", linhas, conversoes],
  ["CPA", `R$ ${(300 / linhas).toFixed(2)}`, `R$ ${(300 / conversoes).toFixed(2)}`],
  ["Ticket médio", `R$ ${(217 / linhas).toFixed(2)}`, `R$ ${(217 / conversoes).toFixed(2)}`],
  ["Funil: aprovadas", linhas, conversoes],
  ["Faturamento", "R$ 217,00", "R$ 217,00"],
];
console.log("\nANTES × DEPOIS — 1 checkout com order bump + 1 checkout simples\n");
for (const [a, b, c] of tabela) {
  console.log("  " + String(a).padEnd(20) + String(b).padStart(22) + String(c).padStart(26));
}
const erro = (1 - 300 / linhas / (300 / conversoes)) * 100;
console.log(`
  O CPA APARECIA ${erro.toFixed(0)}% mais barato do que a realidade — e o número parecia plausível.`);

// ───────────────────── Limpeza ─────────────────────

await q(`DELETE FROM "Notification" WHERE "userId"=$1`, [userId]);
await q(`DELETE FROM "Sale" WHERE "userId"=$1`, [userId]);
await q(`DELETE FROM "DailyAdMetric" WHERE "adId"=$1`, [adId]);
await q(`DELETE FROM "Ad" WHERE id=$1`, [adId]);
await q(`DELETE FROM "AdSet" WHERE id=$1`, [adsetId]);
await q(`DELETE FROM "Campaign" WHERE id=$1`, [campId]);
await q(`DELETE FROM "AdAccount" WHERE id=$1`, [contaId]);
await q(`DELETE FROM "DashboardLayout" WHERE "userId"=$1`, [userId]);
await q(`DELETE FROM "Workspace" WHERE "userId"=$1`, [userId]);
await q(`UPDATE "User" SET "lastWorkspaceId"=NULL WHERE id=$1`, [userId]);
await q(`DELETE FROM "User" WHERE id=$1`, [userId]);
const { rows: sobrou } = await q(`SELECT count(*)::int n FROM "Sale" WHERE "userId"=$1`, [userId]);
console.log(`\n  limpeza: ${sobrou[0].n} venda(s) restante(s) do teste`);

await cliente.end();

const total = ok + falhas.length;
if (falhas.length) {
  console.error(`\n\x1b[31m✗ ${falhas.length} de ${total} falharam\x1b[0m\n`);
  process.exit(1);
}
console.log(`\n\x1b[32m✓ ${total} asserções, 0 falhas\x1b[0m\n`);
