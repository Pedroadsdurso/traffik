/**
 * Preenche `Sale.platform` a partir do webhook que ainda existe.
 *
 * ## ⏳ ESTE BACKFILL TEM PRAZO DE VALIDADE
 *
 * A procedência só é recuperável **enquanto o webhook da venda existir**. Como
 * `Sale.webhookId` é `SetNull`, no instante em que o usuário exclui um gateway a
 * resposta some do banco — não há segunda fonte. Em 31/07/2026 as duas vendas da
 * Cakto já se perderam assim, antes desta coluna existir.
 *
 * **Rodar cedo salva mais história.** Cada gateway removido é uma parte do
 * histórico que nenhum backfill futuro recupera.
 *
 * ## O que ele escreve, e o que NÃO escreve
 *
 * `SET "platform" = ...` e nada mais. País, fonte do país, clique, método de
 * match, status e taxas ficam de fora — é a REGRA 2 do contrato de gateways
 * (reprocessar nunca degrada dado derivado já resolvido), e aqui ela é
 * estrutural: a instrução não menciona as outras colunas.
 *
 * Idempotente: o `WHERE` exige `platform IS NULL`, então a 2ª passada não mexe
 * em nada.
 *
 * ## Uso
 *
 *   npm run backfill:platform                       # SIMULA
 *   npm run backfill:platform -- --url '<conn>'     # simula contra outro banco
 *   ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \
 *     npm run backfill:platform -- --url '<conn>' --aplicar
 */
import "dotenv/config";

import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

const args = process.argv.slice(2);
const iUrl = args.indexOf("--url");
if (iUrl >= 0) {
  // Reescreve a env ANTES do guard: sem isto a trava avaliaria o banco do `.env`.
  process.env.DATABASE_URL = args[iUrl + 1];
  process.env.DIRECT_URL = args[iUrl + 1];
}
const aplicar = args.includes("--aplicar");
if (aplicar) exigirBancoDeDesenvolvimento({ script: "backfill-platform" });

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

const brl = (n) => "R$ " + Number(n).toFixed(2).replace(".", ",");
const dia = (d) => new Date(d).toISOString().slice(0, 16).replace("T", " ") + " UTC";

const { rows } = await cliente.query(
  `SELECT s.id, s.product, s.value, s.status, s.timestamp, s.platform,
          s."webhookId", s."apiCredentialId", w.platform AS "doWebhook"
     FROM "Sale" s LEFT JOIN "Webhook" w ON w.id = s."webhookId"
    ORDER BY s.timestamp DESC`,
);

// A venda que veio por chave de API não tem webhook e mesmo assim TEM
// procedência conhecida — é "API", que é o rótulo que o receptor já usa no log.
const alvo = (r) => r.doWebhook ?? (r.apiCredentialId ? "API" : null);

const ganham = rows.filter((r) => r.platform == null && alvo(r) != null);
const orfas = rows.filter((r) => r.platform == null && alvo(r) == null);
const jaTem = rows.filter((r) => r.platform != null);

const porGateway = new Map();
for (const r of ganham) porGateway.set(alvo(r), (porGateway.get(alvo(r)) ?? 0) + 1);

console.log(`\n\x1b[1mBackfill de Sale.platform\x1b[0m  (${aplicar ? "APLICANDO" : "SIMULAÇÃO"})\n`);
console.log(`  Vendas no banco ................. ${rows.length}`);
console.log(`  Já têm plataforma ............... ${jaTem.length}`);
console.log(`  \x1b[32mGanham plataforma ............... ${ganham.length}\x1b[0m`);
for (const [g, n] of [...porGateway].sort((a, b) => b[1] - a[1])) {
  console.log(`      ${String(g).padEnd(12)} ${n}`);
}
console.log(`  \x1b[33mFicam SEM plataforma ............ ${orfas.length}\x1b[0m`);

if (orfas.length > 0) {
  console.log(
    `\n\x1b[1m\x1b[33mAs órfãs — webhook já excluído, procedência irrecuperável:\x1b[0m`,
  );
  console.log(
    `  ${"data".padEnd(20)} ${"produto".padEnd(28)} ${"valor".padEnd(12)} status`,
  );
  for (const r of orfas) {
    console.log(
      `  ${dia(r.timestamp).padEnd(20)} ${String(r.product).slice(0, 27).padEnd(28)} ` +
        `${brl(r.value).padEnd(12)} ${r.status}`,
    );
    console.log(`    \x1b[2mid: ${r.id}\x1b[0m`);
  }
  console.log(
    `\n  \x1b[2mNenhum backfill futuro as recupera: a FK para o webhook já foi anulada.\x1b[0m`,
  );
}

if (!aplicar) {
  console.log(`\n\x1b[2mSimulação — nada foi escrito. Use --aplicar para gravar.\x1b[0m\n`);
  await cliente.end();
  process.exit(0);
}

// ⚠️ SÓ a coluna `platform`. Nenhum dado derivado é tocado.
const r1 = await cliente.query(
  `UPDATE "Sale" s SET "platform" = w.platform
     FROM "Webhook" w
    WHERE w.id = s."webhookId" AND s."platform" IS NULL`,
);
const r2 = await cliente.query(
  `UPDATE "Sale" SET "platform" = 'API'
    WHERE "platform" IS NULL AND "apiCredentialId" IS NOT NULL`,
);

console.log(`\n\x1b[32m✓ ${r1.rowCount} pelo webhook · ${r2.rowCount} pela chave de API\x1b[0m`);
console.log(`\x1b[33m  ${orfas.length} permanecem sem plataforma (irrecuperáveis).\x1b[0m\n`);

await cliente.end();
