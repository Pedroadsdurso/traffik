/**
 * Copia os UTMs do clique para a venda (`Sale.utm*` + `Sale.fbclid`).
 *
 * ## ⏳ A janela deste backfill NÃO está fechando — mas ela existe
 *
 * Diferente do `backfill:platform`, aqui nada apaga `Click` automaticamente: a
 * única via é "apagar dados" na exclusão de área, atrás de duas travas. Então dá
 * para rodar com calma. O que não dá é rodar DEPOIS de o clique sumir — aí não
 * há segunda fonte, exatamente como as vendas da Cakto que perderam o gateway.
 *
 * ## O que ele escreve, e o que NÃO escreve
 *
 * As seis colunas de procedência, e nada mais. **País, fonte do país, clique,
 * método de match, status, taxas e valor ficam de fora** — não por promessa em
 * comentário, mas porque o `SET` não os menciona. É a REGRA 2 do contrato de
 * gateways: reprocessar nunca degrada dado derivado já resolvido.
 *
 * Depois do `--aplicar` o script **compara `country`/`countrySource` linha a
 * linha** e falha se qualquer um tiver mudado. A restrição fica medida, não
 * prometida.
 *
 * ## Idempotente de verdade
 *
 * O `WHERE` exige que as seis colunas da venda estejam nulas **e** que o clique
 * tenha ao menos uma preenchida. Sem a segunda metade, toda venda de tráfego
 * direto seria reescrita com nulos a cada passada e a 2ª execução reportaria
 * linhas tocadas — o que faria a idempotência parecer quebrada.
 *
 * ## Uso
 *
 *   npm run backfill:utms                       # SIMULA
 *   npm run backfill:utms -- --url '<conn>'     # simula contra outro banco
 *   ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \
 *     npm run backfill:utms -- --url '<conn>' --aplicar
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
if (aplicar) exigirBancoDeDesenvolvimento({ script: "backfill-utms" });

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

const dim = (s) => `\x1b[2m${s}\x1b[0m`;

/** Venda ainda sem cópia. */
const SEM_COPIA = `s."utmSource" IS NULL AND s."utmMedium" IS NULL AND s."utmCampaign" IS NULL
                   AND s."utmContent" IS NULL AND s."utmTerm" IS NULL AND s."fbclid" IS NULL`;
/** Clique que tem o que copiar. Sem isto, tráfego direto nunca "termina". */
const CLIQUE_UTIL = `(c."utmSource" IS NOT NULL OR c."utmMedium" IS NOT NULL OR c."utmCampaign" IS NOT NULL
                      OR c."utmContent" IS NOT NULL OR c."utmTerm" IS NOT NULL OR c."fbclid" IS NOT NULL)`;

const { rows: alvo } = await cliente.query(
  `SELECT s.id, s."userId", u.email, c."utmCampaign", c."utmContent", c."utmSource"
     FROM "Sale" s
     JOIN "Click" c ON c.id = s."clickId"
     JOIN "User"  u ON u.id = s."userId"
    WHERE ${SEM_COPIA} AND ${CLIQUE_UTIL}
    ORDER BY s.timestamp DESC`,
);

const { rows: [resumo] } = await cliente.query(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE s."clickId" IS NULL)::int AS "semClique",
          count(*) FILTER (WHERE NOT (${SEM_COPIA}))::int  AS "jaTem",
          count(*) FILTER (WHERE s.country IS NOT NULL)::int AS "comPais"
     FROM "Sale" s`,
);

// ⚠️ Recorte por DONO. Um relatório que separa na exibição e soma no cálculo
// vira falsa garantia — foi assim que "40,9% do faturamento" misturou a conta de
// teste com a do dono e quase justificou apagar venda.
const porDono = new Map();
for (const r of alvo) porDono.set(r.email, (porDono.get(r.email) ?? 0) + 1);

console.log(`\n\x1b[1mBackfill de Sale.utm* + Sale.fbclid\x1b[0m  (${aplicar ? "APLICANDO" : "SIMULAÇÃO"})\n`);
console.log(`  Vendas no banco ................. ${resumo.total}`);
console.log(`  Já têm a cópia .................. ${resumo.jaTem}`);
console.log(`  Sem clique casado ............... ${resumo.semClique}  ${dim("(nada a copiar — nunca houve)")}`);
console.log(`  \x1b[32mGanham os UTMs .................. ${alvo.length}\x1b[0m`);
for (const [email, n] of [...porDono].sort((a, b) => b[1] - a[1])) {
  console.log(`      ${String(email).padEnd(30)} ${n}`);
}

const comCampanha = alvo.filter((r) => r.utmCampaign).length;
const comCriativo = alvo.filter((r) => r.utmContent).length;
console.log(
  `\n  Dessas: ${comCampanha} recuperam a CAMPANHA, ${comCriativo} recuperam o CRIATIVO.`,
);

console.log(`\n  ${dim(`Vendas com país resolvido hoje: ${resumo.comPais} — este número não pode mudar.`)}`);

if (!aplicar) {
  console.log(`\n\x1b[2mSimulação — nada foi escrito. Use --aplicar para gravar.\x1b[0m\n`);
  await cliente.end();
  process.exit(0);
}

// Retrato de país ANTES: a verificação é medida, não prometida.
const antes = new Map(
  (await cliente.query(`SELECT id, country, "countrySource" FROM "Sale"`)).rows.map((r) => [
    r.id,
    `${r.country ?? "∅"}/${r.countrySource ?? "∅"}`,
  ]),
);

// ⚠️ SÓ as seis colunas de procedência. Nenhum dado derivado é mencionado.
const r1 = await cliente.query(
  `UPDATE "Sale" s SET
       "utmSource"   = c."utmSource",
       "utmMedium"   = c."utmMedium",
       "utmCampaign" = c."utmCampaign",
       "utmContent"  = c."utmContent",
       "utmTerm"     = c."utmTerm",
       "fbclid"      = c."fbclid"
     FROM "Click" c
    WHERE c.id = s."clickId" AND ${SEM_COPIA} AND ${CLIQUE_UTIL}`,
);

const depois = (await cliente.query(`SELECT id, country, "countrySource" FROM "Sale"`)).rows;
const mudaram = depois.filter((r) => antes.get(r.id) !== `${r.country ?? "∅"}/${r.countrySource ?? "∅"}`);

console.log(`\n\x1b[32m✓ ${r1.rowCount} vendas receberam os UTMs do clique\x1b[0m`);

if (mudaram.length > 0) {
  console.log(`\n\x1b[31m✗ FALHA: ${mudaram.length} vendas mudaram de país. Isto não deveria ser possível.\x1b[0m`);
  for (const r of mudaram.slice(0, 10)) {
    console.log(`    ${r.id}  ${antes.get(r.id)} → ${r.country ?? "∅"}/${r.countrySource ?? "∅"}`);
  }
  await cliente.end();
  process.exit(1);
}
console.log(`\x1b[32m✓ country/countrySource idênticos em ${depois.length} vendas\x1b[0m`);

// 2ª passada: tem de tocar zero linhas.
const r2 = await cliente.query(
  `UPDATE "Sale" s SET "utmCampaign" = c."utmCampaign"
     FROM "Click" c
    WHERE c.id = s."clickId" AND ${SEM_COPIA} AND ${CLIQUE_UTIL}`,
);
console.log(
  r2.rowCount === 0
    ? `\x1b[32m✓ idempotente: a 2ª passada não tocou em nada\x1b[0m\n`
    : `\x1b[31m✗ a 2ª passada tocou em ${r2.rowCount} linhas — o WHERE não está fechando\x1b[0m\n`,
);

await cliente.end();
process.exit(r2.rowCount === 0 ? 0 : 1);
