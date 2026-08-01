/**
 * Apaga `PixelEvent` gerados durante a CONSTRUÇÃO do site — deploy preview e
 * localhost — preservando os do domínio de produção.
 *
 * ## Por que existe
 *
 * Quem monta a página recarrega dezenas de vezes, e cada deploy preview do
 * Netlify/Vercel tem host próprio (`6a6d6a40…--site.netlify.app`). Esses
 * eventos entram no funil e na Atividade Recente como se fossem visitantes.
 *
 * ⚠️ **Isto NÃO é a solução do problema, é a limpeza do estrago.** A solução é
 * não disparar o snippet em deploy de preview (`process.env.CONTEXT ===
 * "production"` no Netlify). Filtrar depois é sempre tarde: o evento **já foi
 * enviado à CAPI da Meta** e já influenciou a otimização. Ver o CLAUDE.md.
 *
 * ## As proteções
 *
 * | | |
 * |---|---|
 * | **Simula por padrão** | sem `--aplicar` não escreve nada |
 * | `ALLOW_PROD_WRITES` | por extenso, no comando, a cada execução |
 * | **`userId` no `WHERE`** | sempre — `--email` é obrigatório |
 * | **Lista TODAS as URLs** | agrupadas, marcadas APAGAR/MANTER, antes de apagar |
 * | Só apaga `PixelEvent` | nenhuma venda, nenhum clique, nenhuma configuração |
 *
 * > ### ⛔ Ele mostra as URLs que vai MANTER também
 * > Conferir só a lista de exclusão responde "entrou alguma legítima?" e deixa
 * > passar a outra metade: "faltou alguma que eu queria fora?". Um host de
 * > teste que os padrões não cobrem (`127.0.0.1`, um preview da Vercel) só
 * > aparece se as duas listas forem impressas.
 *
 * ## Uso
 *
 *   npm run eventos:limpar -- --url '<conn>' --email voce@exemplo.com
 *
 *   ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \
 *     npm run eventos:limpar -- --url '<conn>' --email voce@exemplo.com --aplicar
 */
import "dotenv/config";

import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

const args = process.argv.slice(2);
const arg = (nome, padrao) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : padrao;
};

const iUrl = args.indexOf("--url");
if (iUrl >= 0) {
  // Reescreve a env ANTES do guard: sem isto a trava avaliaria o banco do `.env`.
  process.env.DATABASE_URL = args[iUrl + 1];
  process.env.DIRECT_URL = args[iUrl + 1];
}
const aplicar = args.includes("--aplicar");
if (aplicar) exigirBancoDeDesenvolvimento({ script: "limpar-eventos-teste" });

const email = arg("--email", null);
if (!email) {
  console.error(
    "\n🔴 Faltou --email.\n\n" +
      "   O `userId` é OBRIGATÓRIO no WHERE. Um DELETE por URL sem dono atravessa\n" +
      "   usuários: qualquer conta com um evento naquele host perderia a linha.\n\n" +
      "   npm run eventos:limpar -- --url '<conn>' --email voce@exemplo.com\n",
  );
  process.exit(1);
}

/**
 * Os padrões de "evento de construção".
 *
 * ⚠️ `%--%.netlify.app%` exige o `--` ANTES de `.netlify.app`, que é a forma do
 * host de deploy preview (`<hash>--<site>.netlify.app`). O domínio de produção
 * (`https://site.netlify.app/`) **não casa** — é exatamente essa a distinção, e
 * é por isso que a lista de MANTER é impressa: para você conferir que ela
 * funcionou, em vez de acreditar.
 */
const PADROES = [
  { rotulo: "deploy preview (Netlify)", sql: `url LIKE '%--%.netlify.app%'` },
  { rotulo: "localhost", sql: `url LIKE 'http://localhost%'` },
];
const ONDE = PADROES.map((p) => p.sql).join(" OR ");

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

const ref = /postgres\.([a-z0-9]+)/.exec(String(process.env.DATABASE_URL ?? ""))?.[1] ?? "(local)";
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const verm = (s) => `\x1b[31m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;

console.log(`\n${bold("Limpeza de PixelEvent de construção")}  (${aplicar ? verm("APLICANDO") : "SIMULAÇÃO"})`);
console.log(`Banco: ${ref}   ·   conta: ${email}\n`);

const { rows: donos } = await cliente.query(`SELECT id FROM "User" WHERE email = $1`, [email]);
if (donos.length === 0) {
  console.error(`🔴 Nenhum usuário com o e-mail ${email} neste banco.\n`);
  await cliente.end();
  process.exit(1);
}
const userId = donos[0].id;

// ── Todas as URLs deste usuário, marcadas ────────────────────────────────────
// Imprime as DUAS listas: o que sai e o que fica. Conferir só a de exclusão
// deixaria passar "faltou alguma que eu queria fora?".
const { rows: urls } = await cliente.query(
  `SELECT COALESCE(url, '(sem url)') AS url,
          count(*)::int AS n,
          count(*) FILTER (WHERE event = 'InitiateCheckout')::int AS ic,
          min(timestamp) AS primeiro,
          max(timestamp) AS ultimo,
          bool_or(${ONDE}) AS apagar
     FROM "PixelEvent"
    WHERE "userId" = $1
    GROUP BY 1
    ORDER BY apagar DESC, n DESC`,
  [userId],
);

if (urls.length === 0) {
  console.log("Nenhum PixelEvent nesta conta.\n");
  await cliente.end();
  process.exit(0);
}

const paraApagar = urls.filter((u) => u.apagar);
const paraManter = urls.filter((u) => !u.apagar);
const dia = (d) => new Date(d).toISOString().slice(0, 10);

console.log(verm(bold(`  APAGAR — ${paraApagar.length} URL(s)`)));
if (paraApagar.length === 0) console.log(dim("    (nenhuma)"));
for (const u of paraApagar) {
  console.log(`    ${String(u.n).padStart(5)} ev  ${dim(`(${u.ic} IC)`)}  ${dia(u.primeiro)}→${dia(u.ultimo)}  ${u.url}`);
}

console.log(`\n${verde(bold(`  MANTER — ${paraManter.length} URL(s)`))}`);
if (paraManter.length === 0) console.log(dim("    (nenhuma)"));
for (const u of paraManter) {
  console.log(`    ${String(u.n).padStart(5)} ev  ${dim(`(${u.ic} IC)`)}  ${dia(u.primeiro)}→${dia(u.ultimo)}  ${u.url}`);
}

// ── O impacto no funil, que é a pergunta real ────────────────────────────────
//
// ⚠️ O funil NÃO conta linhas de InitiateCheckout: conta VISITANTES DISTINTOS
// (`fbclid → eventId → id`). Contar linhas superestimaria a queda. Reproduz
// aqui a mesma deduplicação de `dashboard/metrics.ts`.
const distintos = async (extra) => {
  const { rows } = await cliente.query(
    `SELECT count(DISTINCT COALESCE(fbclid, "eventId", id))::int AS n
       FROM "PixelEvent"
      WHERE "userId" = $1 AND event = 'InitiateCheckout' ${extra}`,
    [userId],
  );
  return rows[0].n;
};

const { rows: totais } = await cliente.query(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE ${ONDE})::int AS some
     FROM "PixelEvent" WHERE "userId" = $1`,
  [userId],
);
const icAntes = await distintos("");
const icDepois = await distintos(`AND NOT (${ONDE})`);

const { rows: porEvento } = await cliente.query(
  `SELECT event,
          count(*)::int AS total,
          count(*) FILTER (WHERE NOT (${ONDE}))::int AS sobra
     FROM "PixelEvent" WHERE "userId" = $1
    GROUP BY 1 ORDER BY 2 DESC`,
  [userId],
);

console.log(`\n${bold("  Impacto")}\n`);
console.log(`    ${"evento".padEnd(20)} ${"hoje".padStart(7)} ${"apaga".padStart(7)} ${"sobra".padStart(7)}`);
for (const e of porEvento) {
  console.log(
    `    ${e.event.padEnd(20)} ${String(e.total).padStart(7)} ${String(e.total - e.sobra).padStart(7)} ${String(e.sobra).padStart(7)}`,
  );
}
console.log(
  `    ${bold("TOTAL".padEnd(20))} ${String(totais[0].total).padStart(7)} ${String(totais[0].some).padStart(7)} ${String(totais[0].total - totais[0].some).padStart(7)}`,
);

console.log(
  `\n    Funil — etapa "Initiate Checkout" (visitantes distintos, não linhas):\n` +
    `      antes ${bold(String(icAntes))}   →   depois ${bold(String(icDepois))}` +
    (icAntes === icDepois ? dim("   (o funil não muda)") : verm(`   (−${icAntes - icDepois})`)),
);

if (!aplicar) {
  console.log(
    `\n${dim("Simulação — nada foi escrito.")}\n\n` +
      `  Confira as duas listas acima. Se estiverem certas:\n\n` +
      `    ${bold("npm run backup -- --url '<conn>'")}   ${dim("← obrigatório: o Free não tem PITR")}\n\n` +
      `    ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \\\n` +
      `      npm run eventos:limpar -- --url '<conn>' --email ${email} --aplicar\n`,
  );
  await cliente.end();
  process.exit(0);
}

// ── Apaga ────────────────────────────────────────────────────────────────────
// `userId` no WHERE, sempre. Só `PixelEvent` — nenhuma venda, nenhum clique.
const { rowCount } = await cliente.query(
  `DELETE FROM "PixelEvent" WHERE "userId" = $1 AND (${ONDE})`,
  [userId],
);

const { rows: depois } = await cliente.query(
  `SELECT count(*)::int AS n FROM "PixelEvent" WHERE "userId" = $1`,
  [userId],
);
const icFinal = await distintos("");

console.log(`\n  ${verm(bold(`${rowCount} evento(s) apagado(s).`))}`);
console.log(`  Sobraram ${bold(String(depois[0].n))} · funil IC = ${bold(String(icFinal))}`);
console.log(
  icFinal === icDepois
    ? verde("  ✓ o funil bateu com o previsto na simulação.\n")
    : verm(`  🔴 previsto ${icDepois}, obtido ${icFinal} — investigue antes de seguir.\n`),
);

await cliente.end();
