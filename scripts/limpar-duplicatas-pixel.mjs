/**
 * Remove `PixelEvent` duplicados por `(userId, event, eventId)`.
 *
 * ## Por que existe
 *
 * A migration `20260731040000_pixel_event_dedup` cria um índice único que o
 * `eventId` determinístico tornou possível. Ela FALHOU em produção com `23505`:
 * o código novo subiu antes da migration, e nessa janela dois POSTs com o mesmo
 * id viraram duas linhas — exatamente o que o índice existe para impedir.
 *
 * ⚠️ A lição não é "o usuário inverteu a ordem". É que **migration que cria
 * constraint tem de fazer o dado satisfazê-la**, senão ela é dependente de
 * ordem — e ordem se inverte. Ver a seção no CLAUDE.md.
 *
 * ## Qual linha fica
 *
 * A **mais antiga** de cada grupo. Ela é a que tem o timestamp real do evento;
 * as seguintes são reenvios da mesma ação, dentro da janela de 10s do `eid()`.
 * Empate de timestamp desempata pelo `id`, para o resultado ser determinístico.
 *
 * ## Uso
 *
 *   npm run pixel:duplicatas                       # SIMULA
 *   npm run pixel:duplicatas -- --url '<conn>'     # simula contra outro banco
 *   ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \
 *     npm run pixel:duplicatas -- --url '<conn>' --aplicar
 */
import "dotenv/config";

import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

const args = process.argv.slice(2);
const iUrl = args.indexOf("--url");
if (iUrl >= 0) {
  process.env.DATABASE_URL = args[iUrl + 1];
  process.env.DIRECT_URL = args[iUrl + 1];
}
const aplicar = args.includes("--aplicar");
if (aplicar) exigirBancoDeDesenvolvimento({ script: "limpar-duplicatas-pixel" });

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

const C = { r: "\x1b[31m", g: "\x1b[32m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };

/** Grupos com mais de uma linha. `eventId` NULO não conta: nulos não colidem. */
const SQL_GRUPOS = `
  SELECT "userId", "event", "eventId", COUNT(*)::int AS n,
         MIN("timestamp") AS primeiro, MAX("timestamp") AS ultimo
    FROM "PixelEvent"
   WHERE "eventId" IS NOT NULL
   GROUP BY "userId", "event", "eventId"
  HAVING COUNT(*) > 1
   ORDER BY COUNT(*) DESC, MIN("timestamp")`;

const { rows: grupos } = await cliente.query(SQL_GRUPOS);
const aRemover = grupos.reduce((a, g) => a + (g.n - 1), 0);
const { rows: tot } = await cliente.query(`SELECT COUNT(*)::int AS n FROM "PixelEvent"`);

console.log(`\n${C.b}Duplicatas de PixelEvent${C.x}   (${aplicar ? "APLICANDO" : "SIMULAÇÃO"})\n`);
console.log(`  Eventos no banco ................ ${tot[0].n}`);
console.log(`  ${C.y}Grupos duplicados ............... ${grupos.length}${C.x}`);
console.log(`  ${C.r}Linhas que seriam removidas ..... ${aRemover}${C.x}`);
console.log(`  ${C.g}Ficam ........................... ${tot[0].n - aRemover}${C.x}`);

if (grupos.length > 0) {
  console.log(`\n  ${C.b}Os grupos (mantém a mais antiga de cada)${C.x}`);
  for (const g of grupos.slice(0, 25)) {
    console.log(`    ${String(g.n).padStart(3)}× ${String(g.event).padEnd(18)} ${g.eventId}`);
    console.log(
      `        ${C.d}${new Date(g.primeiro).toISOString().slice(0, 19).replace("T", " ")}` +
        ` → ${new Date(g.ultimo).toISOString().slice(0, 19).replace("T", " ")}${C.x}`,
    );
  }
  if (grupos.length > 25) console.log(`    ${C.d}… e mais ${grupos.length - 25} grupo(s)${C.x}`);
}

if (!aplicar) {
  console.log(`\n${C.d}Simulação — nada foi removido. Use --aplicar para limpar.${C.x}\n`);
  await cliente.end();
  process.exit(0);
}

if (aRemover === 0) {
  console.log(`\n${C.g}Nada a fazer — o índice único já pode ser criado.${C.x}\n`);
  await cliente.end();
  process.exit(0);
}

// Mantém a MAIS ANTIGA; desempate por id para o resultado ser determinístico.
const res = await cliente.query(`
  DELETE FROM "PixelEvent" a
   USING "PixelEvent" b
   WHERE a."eventId" IS NOT NULL
     AND a."userId"  = b."userId"
     AND a."event"   = b."event"
     AND a."eventId" = b."eventId"
     AND (a."timestamp" > b."timestamp"
          OR (a."timestamp" = b."timestamp" AND a.id > b.id))`);

const { rows: sobrou } = await cliente.query(SQL_GRUPOS);
const { rows: fim } = await cliente.query(`SELECT COUNT(*)::int AS n FROM "PixelEvent"`);
const ok = sobrou.length === 0 && res.rowCount === aRemover;

console.log(`\n${C.b}Verificação${C.x}`);
console.log(
  `  ${res.rowCount === aRemover ? C.g + "✓" : C.r + "✗"} removidas ${res.rowCount}` +
    ` (previstas ${aRemover})${C.x}`,
);
console.log(
  `  ${sobrou.length === 0 ? C.g + "✓" : C.r + "✗"} grupos duplicados restantes: ${sobrou.length}${C.x}`,
);
console.log(`  ${C.g}✓${C.x} total: ${tot[0].n} → ${fim[0].n}`);
console.log(
  ok
    ? `\n${C.g}${C.b}✓ Limpo. O índice único já pode ser criado.${C.x}\n`
    : `\n${C.r}${C.b}⚠️  Resultado inesperado. RESTAURE O BACKUP.${C.x}\n`,
);

await cliente.end();
process.exit(ok ? 0 : 1);
