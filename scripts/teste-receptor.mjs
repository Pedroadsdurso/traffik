/**
 * Prova PONTA A PONTA de que o receptor universal está **sendo exercido** —
 * não apenas compilando.
 *
 * O CLAUDE.md registra três casos, na mesma sessão, de coisa "entregue" que
 * estava inerte: a base de países que ninguém consultava, o resumo do funil que
 * era invisível, a rota de cron que nunca foi agendada. `tsc`, `lint` e `build`
 * passam com tudo isso desligado.
 *
 * Aqui as requisições são HTTP de verdade, contra o dev server, com payloads
 * REAIS tirados do backup de produção. Escreve no banco de DEV (o `guard-db`
 * garante) e apaga tudo por id no fim.
 *
 * Uso: node --experimental-strip-types --import ./scripts/alias-loader.mjs \
 *        scripts/teste-receptor.mjs
 */
import "dotenv/config";

import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";
import { escolherBackupDeProducao, lerBackup } from "./lib/backup.mjs";

exigirBancoDeDesenvolvimento({ script: "teste-receptor" });

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SEGREDO = "segredo-de-teste-" + crypto.randomUUID().slice(0, 8);

// Mesma conexão dos outros scripts: sem a querystring (o `sslmode` do Prisma
// não é o do `pg`) e sem verificar a cadeia, que no Supabase é auto-assinada.
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
    falhas.push({ nome, erro: e.message });
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      ${e.message}`);
  }
}

// ── Payload real de produção ────────────────────────────────────────────────
const linhas = lerBackup(escolherBackupDeProducao());
const payloadReal = linhas
  .filter((x) => x.t === "WebhookLog")
  .map((x) => x.r)
  .find((l) => l.gateway === "KIRVANO" && l.payloadRaw?.event === "PIX_GENERATED" && l.payloadRaw?.fiscal)?.payloadRaw;
assert.ok(payloadReal, "nenhum payload real de PIX_GENERATED no backup");

// ── Cenário: um usuário e um webhook Kirvano, criados agora ─────────────────
const userId = "tst-" + crypto.randomUUID();
const webhookId = "tst-" + crypto.randomUUID();
const token = crypto.randomUUID();
const criados = { sales: [], logs: [] };

await q(`INSERT INTO "User" ("id","email","name","passwordHash","updatedAt") VALUES ($1,$2,'Teste Receptor','x',now())`, [
  userId,
  `receptor-${userId}@teste.local`,
]);
await q(
  `INSERT INTO "Webhook" ("id","userId","name","platform","token","secret","active","updatedAt")
   VALUES ($1,$2,'Kirvano teste','KIRVANO',$3,$4,true,now())`,
  [webhookId, userId, token, SEGREDO],
);

const enviar = (url, corpo, headers = {}) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });

console.log(`\nReceptor universal — ${BASE}\n`);

// Um sale_id próprio para não colidir com nada e para limpar por id depois.
const saleId = "TESTE-" + crypto.randomUUID().slice(0, 8);
const payload = { ...payloadReal, sale_id: saleId };

// ─────────────────────────── 1. Caminho feliz ───────────────────────────

await checar("URL legada da Kirvano aceita o payload real e grava a venda", async () => {
  const t0 = Date.now();
  const r = await enviar(`${BASE}/api/webhook/kirvano?id=${token}`, payload, { "security-token": SEGREDO });
  const ms = Date.now() - t0;
  const corpo = await r.json();
  assert.equal(r.status, 200, `status ${r.status}: ${JSON.stringify(corpo)}`);
  assert.ok(corpo.sale_id, "resposta sem sale_id");
  criados.sales.push(corpo.sale_id);

  const { rows } = await q(`SELECT "value","status","product","country","countrySource" FROM "Sale" WHERE id=$1`, [
    corpo.sale_id,
  ]);
  assert.equal(rows.length, 1, "venda não foi gravada");
  assert.equal(rows[0].status, "PENDENTE", "PIX_GENERATED deveria virar PENDENTE");
  // ⚠️ A Kirvano manda o valor como TEXTO formatado — `"R$ 49,78"`, com cifrão e
  // vírgula decimal. Comparar com o valor cru falharia aqui; o que precisa bater
  // é o número que o parser extraiu.
  assert.equal(Number(rows[0].value), 49.78, `total_price cru era ${JSON.stringify(payloadReal.total_price)}`);

  // ⏱️ A Cakto considera falha de entrega acima de 5 s.
  console.log(`      ↳ respondeu em ${ms} ms (orçamento da Cakto: 5.000 ms)`);
  assert.ok(ms < 5000, `respondeu em ${ms} ms, acima do orçamento de 5 s`);
});

await checar("o payload foi gravado no WebhookLog como PROCESSADO", async () => {
  const { rows } = await q(
    `SELECT id,status,gateway,"saleId" FROM "WebhookLog" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
    [userId],
  );
  assert.equal(rows.length, 1);
  criados.logs.push(rows[0].id);
  assert.equal(rows[0].status, "PROCESSADO");
  assert.equal(rows[0].gateway, "KIRVANO");
  assert.ok(rows[0].saleId, "log sem saleId");
});

await checar("o contador do webhook subiu exatamente 1 (não 1 por venda)", async () => {
  const { rows } = await q(`SELECT "eventCount","lastEventAt" FROM "Webhook" WHERE id=$1`, [webhookId]);
  assert.equal(rows[0].eventCount, 1);
  assert.ok(rows[0].lastEventAt, "lastEventAt não foi marcado");
});

// ─────────────────────── 2. Autenticação falha FECHADA ───────────────────────

await checar("token de segurança errado → 401", async () => {
  const r = await enviar(`${BASE}/api/webhook/kirvano?id=${token}`, payload, { "security-token": "errado" });
  assert.equal(r.status, 401);
});

await checar("prefixo parcial do segredo → 401 (comparação em tempo constante)", async () => {
  const r = await enviar(`${BASE}/api/webhook/kirvano?id=${token}`, payload, {
    "security-token": SEGREDO.slice(0, -1),
  });
  assert.equal(r.status, 401);
});

await checar("sem nenhum token → 401", async () => {
  const r = await enviar(`${BASE}/api/webhook/kirvano?id=${token}`, payload);
  assert.equal(r.status, 401);
});

await checar(
  "🔒 a rota /api/webhook/sale/{token} exige o MESMO segredo (o bypass continua fechado)",
  async () => {
    // As duas rotas aceitam o mesmo `Webhook.token`. Antes de 29/07/2026 bastava
    // trocar o caminho para pular a validação. Este é o caso que garante que
    // unificar no receptor não reabriu a porta.
    const semSegredo = await enviar(`${BASE}/api/webhook/sale/${token}`, payload);
    assert.equal(semSegredo.status, 401, "rota universal aceitou sem segredo");

    const comSegredo = await enviar(`${BASE}/api/webhook/sale/${token}`, payload, { "security-token": SEGREDO });
    assert.equal(comSegredo.status, 200, "rota universal recusou o segredo correto");
    criados.sales.push((await comSegredo.json()).sale_id);
  },
);

// ────────────────────────── 3. Entradas degeneradas ──────────────────────────

await checar("JSON quebrado → 400, e o corpo cru é preservado no log", async () => {
  const r = await enviar(`${BASE}/api/webhook/kirvano?id=${token}`, "{isso nao e json", {
    "security-token": SEGREDO,
  });
  assert.equal(r.status, 400);
  const { rows } = await q(
    `SELECT id,"payloadRaw",status FROM "WebhookLog" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
    [userId],
  );
  criados.logs.push(rows[0].id);
  assert.equal(rows[0].status, "REJEITADO");
  assert.ok(JSON.stringify(rows[0].payloadRaw).includes("isso nao e json"), "corpo cru perdido");
});

await checar("token desconhecido → 404", async () => {
  const r = await enviar(`${BASE}/api/webhook/kirvano?id=${crypto.randomUUID()}`, payload);
  assert.equal(r.status, 404);
});

await checar("webhook desativado → 403", async () => {
  await q(`UPDATE "Webhook" SET active=false WHERE id=$1 AND "userId"=$2`, [webhookId, userId]);
  const r = await enviar(`${BASE}/api/webhook/kirvano?id=${token}`, payload, { "security-token": SEGREDO });
  assert.equal(r.status, 403);
  await q(`UPDATE "Webhook" SET active=true WHERE id=$1 AND "userId"=$2`, [webhookId, userId]);
});

// ──────────────────── 4. Idempotência (a Cakto reentrega) ────────────────────

await checar("reentrega do MESMO evento não cria segunda venda", async () => {
  const antes = await q(`SELECT count(*)::int n FROM "Sale" WHERE "userId"=$1`, [userId]);
  for (let i = 0; i < 3; i++) {
    const r = await enviar(`${BASE}/api/webhook/kirvano?id=${token}`, payload, { "security-token": SEGREDO });
    assert.equal(r.status, 200);
  }
  const depois = await q(`SELECT count(*)::int n FROM "Sale" WHERE "userId"=$1`, [userId]);
  assert.equal(depois.rows[0].n, antes.rows[0].n, "reentrega duplicou a venda");
});

await checar("gerada → paga transiciona a MESMA linha, sem retroceder", async () => {
  const aprovada = { ...payload, event: "SALE_APPROVED", status: "APPROVED" };
  let r = await enviar(`${BASE}/api/webhook/kirvano?id=${token}`, aprovada, { "security-token": SEGREDO });
  assert.equal(r.status, 200);
  let { rows } = await q(`SELECT id,status FROM "Sale" WHERE "userId"=$1 AND "externalId"=$2`, [userId, saleId]);
  assert.equal(rows.length, 1, "virou duas linhas");
  assert.equal(rows[0].status, "APROVADA");

  // A reentrega do evento ANTIGO não pode rebaixar de APROVADA para PENDENTE —
  // era exatamente a perda de dados corrigida pelo upsert monotônico.
  r = await enviar(`${BASE}/api/webhook/kirvano?id=${token}`, payload, { "security-token": SEGREDO });
  assert.equal(r.status, 200);
  ({ rows } = await q(`SELECT status FROM "Sale" WHERE "userId"=$1 AND "externalId"=$2`, [userId, saleId]));
  assert.equal(rows[0].status, "APROVADA", "evento antigo rebaixou o status");
});

// ─────────────────── 5. Chave de API pelo mesmo receptor ───────────────────

await checar("ingestão por chave de API também passa pelo receptor", async () => {
  const semChave = await enviar(`${BASE}/api/webhook/ingest`, { value: 10, product: "X" });
  assert.equal(semChave.status, 401);

  const invalida = await enviar(
    `${BASE}/api/webhook/ingest`,
    { value: 10, product: "X" },
    { authorization: "Bearer trk_live_inexistente" },
  );
  assert.equal(invalida.status, 401);
});

// ─────────────────────────────── Limpeza ───────────────────────────────

const { rows: paraApagar } = await q(`SELECT id FROM "Sale" WHERE "userId"=$1`, [userId]);
await q(`DELETE FROM "WebhookLog" WHERE "userId"=$1`, [userId]);
await q(`DELETE FROM "Notification" WHERE "userId"=$1`, [userId]);
await q(`DELETE FROM "PixelEvent" WHERE "userId"=$1`, [userId]);
await q(`DELETE FROM "Sale" WHERE "userId"=$1`, [userId]);
await q(`DELETE FROM "Webhook" WHERE "userId"=$1`, [userId]);
await q(`DELETE FROM "User" WHERE id=$1`, [userId]);

const { rows: sobrou } = await q(`SELECT count(*)::int n FROM "Sale" WHERE "userId"=$1`, [userId]);
console.log(`\nLimpeza: ${paraApagar.length} vendas e o usuário de teste removidos (restaram ${sobrou[0].n}).`);

await cliente.end();

const total = ok + falhas.length;
if (falhas.length) {
  console.error(`\n\x1b[31m✗ ${falhas.length} de ${total} falharam\x1b[0m\n`);
  process.exit(1);
}
console.log(`\n\x1b[32m✓ ${total} asserções, 0 falhas\x1b[0m\n`);
