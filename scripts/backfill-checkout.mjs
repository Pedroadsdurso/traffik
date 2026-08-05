/**
 * Cria o `InitiateCheckout` das vendas que chegaram ao pagamento e ficaram sem ele.
 *
 * ## Por que existe
 *
 * `registrarCheckoutDoGateway` só cria o evento quando o parser diz
 * `gerouCheckout`. Duas correções recentes mudaram quem responde isso:
 *
 *  1. **Lista fechada de eventos** (05/08/2026): cada parser tinha um `Set` de
 *     eventos que significam "chegou ao pagamento", e evento fora dele devolvia
 *     `false` **sem fallback**. A venda entrava com o status certo e o IC não
 *     era criado — o funil perdia uma etapa inteira, sem erro em lugar nenhum.
 *  2. O `gerouCheckout` passou a derivar do status quando o evento é
 *     desconhecido (`chegouAoCheckout`).
 *
 * As vendas ingeridas ANTES disso continuam sem o evento. Este script relê o
 * `rawPayload` com o parser ATUAL e cria o que faltou.
 *
 * ## ⛔ Ele NÃO adivinha pelo status
 *
 * Quem decide é o EVENTO, relido pelo parser — a mesma regra do
 * `checkoutEvent.ts`. Inferir "PENDENTE ⇒ chegou ao checkout" foi justamente a
 * suposição que quebrou quando ABANDONADA se separou de PENDENTE, e reintroduzi-la
 * aqui criaria eventos que o código em produção não criaria.
 *
 * ## 🕐 O instante é o da VENDA
 *
 * `PixelEvent.timestamp` tem `@default(now())`. Sem passar o instante da venda,
 * **todo checkout recuperado cairia no funil de hoje** — o dia da execução
 * inflado e o passado tão vazio quanto estava. O número continuaria plausível,
 * só distribuído errado. Este script grava `timestamp = Sale.timestamp`, igual
 * ao caminho ao vivo.
 *
 * ## Uso
 *
 *   npm run backfill:checkout                       # SIMULA
 *   npm run backfill:checkout -- --url '<conn>'     # simula contra outro banco
 *   ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \
 *     npm run backfill:checkout -- --url '<conn>' --aplicar
 */
import "dotenv/config";

import pg from "pg";

import { REGISTRO } from "@/lib/gateways/registro";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

const args = process.argv.slice(2);
const iUrl = args.indexOf("--url");
if (iUrl >= 0) {
  // Reescreve a env ANTES do guard: sem isto a trava avaliaria o banco do `.env`.
  process.env.DATABASE_URL = args[iUrl + 1];
  process.env.DIRECT_URL = args[iUrl + 1];
}
const aplicar = args.includes("--aplicar");
if (aplicar) exigirBancoDeDesenvolvimento({ script: "backfill-checkout" });

const iEmail = args.indexOf("--email");
const email = iEmail >= 0 ? args[iEmail + 1] : null;

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

const dia = (d) => new Date(d).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const brl = (n) => "R$ " + Number(n).toFixed(2).replace(".", ",");

/**
 * ⚠️ Recortado por `userId` — e o relatório NÃO imprime total do banco.
 * Um número somado sobre dois donos não corresponde ao dashboard de ninguém, e
 * já produziu uma "distorção de 40,9%" que não era de conta nenhuma.
 */
const { rows: usuarios } = await cliente.query(
  email ? `SELECT id, email FROM "User" WHERE email = $1` : `SELECT id, email FROM "User" ORDER BY email`,
  email ? [email] : [],
);
if (usuarios.length === 0) {
  console.log("Nenhum usuário encontrado.");
  process.exit(1);
}

let totalCriar = 0;
const paraCriar = [];

for (const u of usuarios) {
  const { rows } = await cliente.query(
    `SELECT s.id, s."externalId", s."pedidoId", s.product, s.value, s.status,
            s.timestamp, s."rawPayload", s.platform,
            w.platform AS "doWebhook", c.fbclid
       FROM "Sale" s
       LEFT JOIN "Webhook" w ON w.id = s."webhookId"
       LEFT JOIN "Click"   c ON c.id = s."clickId"
      WHERE s."userId" = $1 AND s."rawPayload" IS NOT NULL
      ORDER BY s.timestamp ASC`,
    [u.id],
  );
  if (rows.length === 0) continue;

  const stats = { total: rows.length, semParser: 0, naoChegou: 0, jaTem: 0, criar: 0 };

  for (const r of rows) {
    // A plataforma vem da coluna (backfill:platform) ou do webhook que ainda existe.
    const plataforma = r.platform ?? r.doWebhook;
    const def = plataforma ? REGISTRO[plataforma] : null;
    if (!def) { stats.semParser++; continue; }

    let gerou = false;
    try {
      const { vendas } = def.parse(r.rawPayload);
      // Casa pelo externalId: um payload agrupado traz várias vendas, e só a
      // linha correspondente responde por esta.
      const minha = vendas.find((v) => v.externalId === r.externalId) ?? vendas[0];
      gerou = Boolean(minha?.gerouCheckout);
    } catch {
      stats.semParser++;
      continue;
    }
    if (!gerou) { stats.naoChegou++; continue; }

    // A chave é o PEDIDO: com order bump, N linhas são UM checkout.
    const chave = r.pedidoId ?? r.externalId;
    if (!chave) { stats.naoChegou++; continue; }
    const eventId = `gw:${chave}`;

    const { rows: existe } = await cliente.query(
      `SELECT 1 FROM "PixelEvent" WHERE "userId" = $1 AND event = 'InitiateCheckout' AND "eventId" = $2 LIMIT 1`,
      [u.id, eventId],
    );
    if (existe.length) { stats.jaTem++; continue; }

    // Camada 2 do dedup ao vivo: o visitante pode ter disparado pelo clique.
    // A janela tem as DUAS pontas — ver a nota em `checkoutEvent.ts`.
    if (r.fbclid) {
      const { rows: pelaVisita } = await cliente.query(
        `SELECT 1 FROM "PixelEvent"
          WHERE "userId" = $1 AND event = 'InitiateCheckout' AND fbclid = $2
            AND timestamp BETWEEN $3::timestamp - interval '6 hours'
                              AND $3::timestamp + interval '6 hours'
          LIMIT 1`,
        [u.id, r.fbclid, r.timestamp],
      );
      if (pelaVisita.length) { stats.jaTem++; continue; }
    }

    // ⚠️ Dois itens do MESMO pedido produzem a mesma chave. Sem esta guarda o
    // segundo item viraria um INSERT irmão na mesma execução — o índice único
    // barraria, mas depois de o relatório já ter contado dois.
    if (paraCriar.some((p) => p.eventId === eventId && p.userId === u.id)) { stats.jaTem++; continue; }

    stats.criar++;
    paraCriar.push({
      userId: u.id, eventId, fbclid: r.fbclid ?? null, timestamp: r.timestamp,
      _desc: `${dia(r.timestamp)}  ${String(r.product).slice(0, 28).padEnd(28)} ${brl(r.value).padStart(11)}  ${r.status}`,
    });
  }

  totalCriar += stats.criar;
  console.log(`\n── ${u.email}`);
  console.log(`   ${stats.total} venda(s) com payload guardado`);
  console.log(`   ${stats.jaTem} já têm o checkout · ${stats.naoChegou} não chegaram ao pagamento · ${stats.semParser} sem parser`);
  console.log(`   ${stats.criar} a criar`);
  for (const p of paraCriar.filter((p) => p.userId === u.id).slice(0, 15)) console.log(`     + ${p._desc}`);
  if (stats.criar > 15) console.log(`     … e mais ${stats.criar - 15}`);
}

console.log(`\n${"─".repeat(60)}`);
console.log(`Total a criar: ${totalCriar}`);

if (!aplicar) {
  console.log("\nSIMULAÇÃO — nada foi escrito. Use --aplicar para gravar.");
  await cliente.end();
  process.exit(0);
}

if (totalCriar === 0) {
  console.log("Nada a fazer.");
  await cliente.end();
  process.exit(0);
}

let criados = 0;
for (const p of paraCriar) {
  // `ON CONFLICT DO NOTHING` cobre o índice único de dedup: se uma ingestão ao
  // vivo criar o mesmo evento entre a leitura e a escrita, quem decide é o banco.
  const { rowCount } = await cliente.query(
    `INSERT INTO "PixelEvent" (id, "userId", event, "eventId", url, fbclid, timestamp)
     VALUES (gen_random_uuid()::text, $1, 'InitiateCheckout', $2, 'gateway:webhook', $3, $4)
     ON CONFLICT DO NOTHING`,
    [p.userId, p.eventId, p.fbclid, p.timestamp],
  );
  criados += rowCount;
}
console.log(`\n✓ ${criados} evento(s) criado(s).`);

/**
 * Conferência pós-escrita: o instante gravado é o da VENDA, não o de agora.
 *
 * É a asserção que prova o ponto inteiro do script — sem ela, "criei N eventos"
 * seria verdade com todos eles empilhados no dia de hoje, que é exatamente a
 * falha que o `@default(now())` produziria em silêncio.
 *
 * ⚠️ Compara com o `Sale.timestamp` de volta do banco, não com o que o script
 * tem em memória: o que interessa é o que FICOU gravado.
 */
const ids = paraCriar.map((p) => p.eventId);
const { rows: conferencia } = await cliente.query(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE pe.timestamp = s.timestamp)::int AS batendo
     FROM "PixelEvent" pe
     JOIN "Sale" s ON COALESCE(s."pedidoId", s."externalId") = replace(pe."eventId", 'gw:', '')
                  AND s."userId" = pe."userId"
    WHERE pe."eventId" = ANY($1::text[])`,
  [ids],
);
const { total, batendo } = conferencia[0];
console.log(`Conferência: ${batendo} de ${total} com o instante da venda.`);
if (total > 0 && batendo !== total) {
  console.log("🔴 Algum evento NÃO ficou com o instante da venda — investigue antes de confiar no funil.");
  await cliente.end();
  process.exit(1);
}

await cliente.end();
