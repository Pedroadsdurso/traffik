/**
 * Por que o MESMO evento virou DUAS linhas em `PixelEvent`?
 *
 * ## O que ele responde
 *
 * O índice único é `("userId", "event", "eventId") WHERE "eventId" IS NOT NULL`.
 * Se duas linhas do mesmo evento coexistem, **elas têm `eventId` diferentes** —
 * a constraint fez o trabalho dela. A pergunta real é *por que os ids saíram
 * diferentes*, e a resposta está nos ingredientes do id:
 *
 * ```js
 * eid(nome) = nome + "-" + hash([CONFIG, nome, location.href, fbclid, Math.floor(Date.now()/10000)])
 * ```
 *
 * Três desses cinco podem divergir entre dois POSTs do mesmo carregamento:
 *
 * | Diverge | Causa | Conserto |
 * |---|---|---|
 * | `url` | o `location.href` mudou entre as chamadas (Next normaliza query, acrescenta param, assenta o router) | âncora estável: `location.pathname` |
 * | `fbclid` | o cookie ainda não tinha sido lido na 1ª chamada | mesma coisa: tirar da chave, ou esperar a leitura |
 * | **nenhum dos dois** | 🔴 **balde fixo de 10s** — duas chamadas a 1 ms de distância caem em baldes diferentes se cruzarem a fronteira | ver abaixo |
 *
 * Por isso ele imprime as linhas LADO A LADO com os três ingredientes visíveis:
 * a coluna que diferir nomeia a causa, sem adivinhação.
 *
 * **Somente leitura.** Nenhum `UPDATE`, nenhum `DELETE`. Pode rodar em produção.
 *
 * ⚠️ Recortado por `userId` — um total do banco inteiro não corresponde ao
 * dashboard de ninguém (ver a regra do `origem-venda.mjs`).
 *
 * ## Uso
 *
 *   npm run pixel:duplicados -- --url '<conn>'
 *   npm run pixel:duplicados -- --url '<conn>' --evento PageView --minutos 120
 */
import "dotenv/config";

import pg from "pg";

const args = process.argv.slice(2);
const arg = (nome, padrao) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : padrao;
};
const url = arg("--url", process.env.DIRECT_URL || process.env.DATABASE_URL);
const eventoFiltro = arg("--evento", null);
const minutos = Number(arg("--minutos", 180));
const limite = Number(arg("--n", 40));

if (!url) {
  console.error("Faltou a connection string. Use --url '<conn>' ou defina DATABASE_URL.");
  process.exit(1);
}

const cliente = new pg.Client({
  connectionString: String(url).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

const ref = /postgres\.([a-z0-9]+)/.exec(String(url))?.[1] ?? "(local)";
console.log(`\nBanco: ${ref}   ·   janela: últimos ${minutos} min\n`);

// ── 1. O índice único existe mesmo? ─────────────────────────────────────────
// Se ele não existir, a investigação para aqui: a causa é a migration, não o
// gerador de id. A `20260731040000` já falhou uma vez em produção (23505) e
// precisou de `migrate resolve --rolled-back` — vale conferir antes de teorizar.
const { rows: idx } = await cliente.query(
  `SELECT indexdef FROM pg_indexes
    WHERE tablename = 'PixelEvent' AND indexname = 'PixelEvent_userId_event_eventId_key'`,
);
if (idx.length === 0) {
  console.log("🔴 O ÍNDICE ÚNICO NÃO EXISTE NESTE BANCO.");
  console.log("   Nenhuma teoria sobre o gerador de id se aplica — nada estaria deduplicando.");
  console.log("   Rode `npx prisma migrate deploy` e confira a 20260731040000_pixel_event_dedup.\n");
} else {
  console.log("✓ Índice único presente:");
  console.log(`  ${idx[0].indexdef}\n`);
}

// ── 2. Grupos com mais de uma linha para a mesma AÇÃO ───────────────────────
// A "mesma ação" é (usuário, pixel, evento, url, fbclid) dentro da janela. Se
// um grupo tem 2+ linhas, o `eventId` divergiu — e as colunas dizem em quê.
const { rows: grupos } = await cliente.query(
  `SELECT "userId", "pixelConfigId", event, url, fbclid,
          count(*) AS n,
          array_agg("eventId" ORDER BY timestamp) AS ids,
          array_agg(timestamp ORDER BY timestamp) AS quando
     FROM "PixelEvent"
    WHERE timestamp > now() - ($1 || ' minutes')::interval
      AND ($2::text IS NULL OR event = $2)
      AND "eventId" IS NOT NULL
    GROUP BY 1,2,3,4,5
   HAVING count(*) > 1
    ORDER BY max(timestamp) DESC
    LIMIT $3`,
  [String(minutos), eventoFiltro, limite],
);

if (grupos.length === 0) {
  console.log("Nenhum grupo duplicado nesta janela (mesmo usuário + pixel + evento + url + fbclid).");
  console.log("Se você viu duas linhas, elas diferem em `url` ou `fbclid` — veja a lista abaixo.\n");
} else {
  console.log(`🔴 ${grupos.length} grupo(s) com a MESMA ação e ids diferentes:\n`);
  for (const g of grupos) {
    console.log(`  ${g.event}  ·  ${g.n} linhas  ·  pixel ${String(g.pixelConfigId).slice(0, 8)}…`);
    console.log(`    url    : ${g.url ?? "(nulo)"}`);
    console.log(`    fbclid : ${g.fbclid ?? "(nulo)"}`);
    for (let i = 0; i < g.ids.length; i++) {
      const t = new Date(g.quando[i]);
      const balde = Math.floor(t.getTime() / 10000);
      console.log(`    #${i + 1} ${g.ids[i]}   ${t.toISOString()}   balde10s=${balde}`);
    }
    // url e fbclid são iguais por construção (estão no GROUP BY). Então só
    // sobra o balde — e o veredito é direto.
    const baldes = new Set(g.quando.map((t) => Math.floor(new Date(t).getTime() / 10000)));
    console.log(
      baldes.size > 1
        ? "    → CAUSA 3: os POSTs cruzaram a fronteira do balde de 10s. Bug nosso.\n"
        : "    → mesmo balde e mesmos ingredientes, e ainda assim ids diferentes:\n" +
            "      investigue o CONFIG (dois pixels na página?) — é o 5º ingrediente.\n",
    );
  }
}

// ── 3. As últimas linhas, com os ingredientes lado a lado ───────────────────
// É a visão que responde "qual dos três divergiu?" quando o agrupamento acima
// não junta as linhas — justamente porque `url` ou `fbclid` são diferentes.
const { rows } = await cliente.query(
  `SELECT p."userId", u.email, p.event, p."eventId", p.url, p.fbclid,
          p.espelho, p.detectores, p.timestamp
     FROM "PixelEvent" p
     JOIN "User" u ON u.id = p."userId"
    WHERE p.timestamp > now() - ($1 || ' minutes')::interval
      AND ($2::text IS NULL OR p.event = $2)
    ORDER BY p.timestamp DESC
    LIMIT $3`,
  [String(minutos), eventoFiltro, limite],
);

if (rows.length === 0) {
  console.log("Nenhum PixelEvent nesta janela. Aumente --minutos.\n");
  await cliente.end();
  process.exit(0);
}

console.log(`\n── Últimos ${rows.length} eventos (mais recente primeiro) ──\n`);

// Agrupa por dono para o relatório não somar contas diferentes.
const porDono = new Map();
for (const r of rows) {
  if (!porDono.has(r.email)) porDono.set(r.email, []);
  porDono.get(r.email).push(r);
}

for (const [email, linhas] of porDono) {
  console.log(`\n  ${email}\n`);
  let anterior = null;
  for (const r of linhas) {
    const t = new Date(r.timestamp);
    console.log(`  ${t.toISOString()}  ${r.event}`);
    console.log(`     eventId : ${r.eventId ?? "(nulo)"}`);
    console.log(`     url     : ${r.url ?? "(nulo)"}`);
    console.log(`     fbclid  : ${r.fbclid ?? "(nulo)"}`);
    console.log(`     espelho : ${r.espelho ?? "(não informado)"}   detectores: ${r.detectores ?? "(não informado)"}`);

    // O diff com a linha anterior do MESMO evento é o que nomeia a causa.
    if (anterior && anterior.event === r.event) {
      const dif = [];
      if (anterior.url !== r.url) dif.push("url");
      if (anterior.fbclid !== r.fbclid) dif.push("fbclid");
      const b1 = Math.floor(new Date(anterior.timestamp).getTime() / 10000);
      const b2 = Math.floor(t.getTime() / 10000);
      if (b1 !== b2) dif.push("balde de 10s");
      const ms = Math.abs(new Date(anterior.timestamp) - t);
      // ⚠️ Só avisa quando as duas linhas podem ser o MESMO carregamento. Duas
      // visitas legítimas a 90 min de distância também têm ids diferentes — e
      // um aviso que dispara em toda linha normal é o que treina a ignorar
      // todos os avisos, inclusive o único que importa aqui.
      const MESMA_VISITA_MS = 30_000;
      if (anterior.eventId !== r.eventId && ms <= MESMA_VISITA_MS) {
        console.log(
          `     ⚠ id DIFERENTE da linha anterior (${ms} ms antes — pode ser o mesmo carregamento). Divergiu: ${
            dif.length ? dif.join(" + ") : "NADA VISÍVEL — suspeite do CONFIG (dois pixels?)"
          }`,
        );
      }
    }
    console.log("");
    anterior = r;
  }
}

console.log(
  "\nLeitura: `url` diferente → o location.href mudou entre os POSTs (causa 1).\n" +
    "         `fbclid` diferente → o cookie não estava lido na 1ª chamada (causa 2).\n" +
    "         só o `balde de 10s` → 🔴 bug nosso, o balde é fixo e não deslizante (causa 3).\n",
);

await cliente.end();
