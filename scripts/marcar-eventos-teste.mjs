/**
 * Classifica o AMBIENTE dos `PixelEvent` já gravados, a partir da `url`.
 *
 * ## Marca — não apaga
 *
 * Substitui o `eventos:limpar` que eu tinha escrito antes. Apagar resolvia o
 * funil e tornava um erro de detecção **irreversível e invisível**. Marcar
 * resolve o funil do mesmo jeito e deixa o dado lá: a tela diz quantos ficaram
 * de fora, e desfazer é um `UPDATE`.
 *
 * ## ⛔ Usa a MESMA função da ingestão, nunca um LIKE paralelo
 *
 * `ambienteDaUrl()` é a única fonte. A primeira versão deste script tinha o
 * padrão escrito em SQL (`url LIKE '%--%.netlify.app%'`) — duas implementações
 * da mesma pergunta, que divergem no primeiro formato novo. Aqui ele lê as
 * URLs, classifica em JS e escreve o resultado.
 *
 * ## Uso
 *
 *   npm run eventos:marcar -- --url '<conn>' --email voce@exemplo.com
 *
 *   ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \
 *     npm run eventos:marcar -- --url '<conn>' --email voce@exemplo.com --aplicar
 *
 * Para DESFAZER uma classificação errada:
 *   npm run eventos:marcar -- --url '<conn>' --email voce@exemplo.com --limpar --aplicar
 */
import "dotenv/config";

import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";
import { ambienteDaUrl, familiasDePreview, lerPadroes, ROTULO_AMBIENTE } from "../src/lib/pixel/ambiente.ts";

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

const iUrl = args.indexOf("--url");
if (iUrl >= 0) {
  // Reescreve a env ANTES do guard: sem isto a trava avaliaria o banco do `.env`.
  process.env.DATABASE_URL = args[iUrl + 1];
  process.env.DIRECT_URL = args[iUrl + 1];
}
const aplicar = args.includes("--aplicar");
const limpar = args.includes("--limpar");
if (aplicar) exigirBancoDeDesenvolvimento({ script: "marcar-eventos-teste" });

const email = arg("--email", null);
if (!email) {
  console.error(
    "\n🔴 Faltou --email. O `userId` é OBRIGATÓRIO no WHERE — um UPDATE por URL\n" +
      "   sem dono atravessa usuários.\n\n" +
      "   npm run eventos:marcar -- --url '<conn>' --email voce@exemplo.com\n",
  );
  process.exit(1);
}

const c = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const amb = (s) => `\x1b[33m${s}\x1b[0m`;
const ref = /postgres\.([a-z0-9]+)/.exec(String(process.env.DATABASE_URL ?? ""))?.[1] ?? "(local)";

console.log(`\n${bold(limpar ? "DESFAZER classificação de ambiente" : "Classificar ambiente dos PixelEvent")}  (${aplicar ? amb("APLICANDO") : "SIMULAÇÃO"})`);
console.log(`Banco: ${ref}   ·   conta: ${email}\n`);

const { rows: donos } = await c.query(`SELECT id FROM "User" WHERE email = $1`, [email]);
if (donos.length === 0) { console.error(`🔴 Nenhum usuário com o e-mail ${email}.\n`); await c.end(); process.exit(1); }
const userId = donos[0].id;

if (limpar) {
  const { rows: [n] } = await c.query(
    `SELECT count(*)::int AS n FROM "PixelEvent" WHERE "userId"=$1 AND ambiente IS NOT NULL`, [userId]);
  console.log(`  ${n.n} evento(s) voltariam a contar no funil.`);
  if (!aplicar) { console.log(dim("\nSimulação — nada foi escrito. Use --aplicar.\n")); await c.end(); process.exit(0); }
  const r = await c.query(`UPDATE "PixelEvent" SET ambiente = NULL WHERE "userId"=$1 AND ambiente IS NOT NULL`, [userId]);
  console.log(verde(`\n  ${r.rowCount} desmarcado(s).\n`));
  await c.end(); process.exit(0);
}

// ── Classifica em JS, com a MESMA função da ingestão ─────────────────────────
const { rows } = await c.query(
  `SELECT id, url, event FROM "PixelEvent" WHERE "userId" = $1 AND ambiente IS NULL`, [userId]);

const porUrl = new Map();
const porId = new Map();
for (const r of rows) {
  const { ambiente } = ambienteDaUrl(r.url);
  if (!ambiente) continue;
  porId.set(r.id, ambiente);
  const k = r.url ?? "(sem url)";
  if (!porUrl.has(k)) porUrl.set(k, { n: 0, ambiente, ic: 0 });
  const g = porUrl.get(k);
  g.n++;
  if (r.event === "InitiateCheckout") g.ic++;
}

/**
 * ## Segunda passada: previews que só se revelam EM CONJUNTO
 *
 * ⛔ **Seção SEPARADA de propósito.** A primeira lista sai de formatos
 * reservados pela plataforma — é contrato. Esta sai de um padrão observado nos
 * SEUS dados, e é a única parte deste script que pode errar de verdade.
 * Misturar as duas faria a confiança da primeira emprestar credibilidade à
 * segunda.
 *
 * `--sem-repeticao` pula esta parte inteira.
 */
const semRepeticao = args.includes("--sem-repeticao");
const hostDe = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return null; } };
const porRepeticao = new Map(); // id → host
const familias = semRepeticao
  ? []
  : familiasDePreview(rows.filter((r) => !porId.has(r.id)).map((r) => hostDe(r.url)).filter(Boolean));
const hostsSuspeitos = new Set(familias.flatMap((f) => f.hosts));
if (hostsSuspeitos.size) {
  for (const r of rows) {
    if (porId.has(r.id)) continue;
    const h = hostDe(r.url);
    if (h && hostsSuspeitos.has(h)) porRepeticao.set(r.id, h);
  }
}

console.log(`  ${bold("A MARCAR")} — ${porUrl.size} URL(s), ${porId.size} evento(s)\n`);
if (porUrl.size === 0) console.log(dim("    (nenhuma)"));
for (const [url, g] of [...porUrl].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`    ${String(g.n).padStart(5)} ev ${dim(`(${g.ic} IC)`)}  ${amb(ROTULO_AMBIENTE[g.ambiente].padEnd(24))} ${url}`);
}

if (familias.length) {
  console.log(`\n  ${amb(bold("SUGERIDO POR REPETIÇÃO — confira uma a uma"))}\n`);
  console.log(dim("    Não é formato reservado: é um padrão observado NOS SEUS DADOS."));
  console.log(dim("    N hosts com mesmo prefixo e mesmo escopo, diferindo só num segmento"));
  console.log(dim("    com cara de hash. Nenhum site de produção tem vários domínios assim."));
  console.log(dim("    Use --sem-repeticao para ignorar esta seção inteira.\n"));
  for (const f of familias) {
    console.log(`    padrão: ${amb(f.padrao)}   ${dim(`(${f.hosts.length} hosts)`)}`);
    for (const h of f.hosts) {
      const n = [...porRepeticao.values()].filter((x) => x === h).length;
      console.log(`      ${String(n).padStart(4)} ev  ${h}`);
    }
  }
}

// As que FICAM — a outra metade da conferência: "faltou alguma?".
const ficam = new Map();
for (const r of rows) {
  if (porId.has(r.id) || porRepeticao.has(r.id)) continue;
  const k = r.url ?? "(sem url — evento do servidor)";
  ficam.set(k, (ficam.get(k) ?? 0) + 1);
}
console.log(`\n  ${bold("CONTINUAM NO FUNIL")} — ${ficam.size} URL(s)\n`);
if (ficam.size === 0) console.log(dim("    (nenhuma)"));
for (const [url, n] of [...ficam].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log(`    ${String(n).padStart(5)} ev  ${verde(url)}`);
}

// ⚠️ O funil conta VISITANTES DISTINTOS, não linhas. Contar linhas
// superestimaria a queda — mesma deduplicação de `dashboard/metrics.ts`.
const ic = async (extra) => {
  const { rows: [r] } = await c.query(
    `SELECT count(DISTINCT COALESCE(fbclid, "eventId", id))::int AS n FROM "PixelEvent"
      WHERE "userId"=$1 AND event='InitiateCheckout' ${extra}`, [userId]);
  return r.n;
};
const idsMarcar = [...porId.keys(), ...porRepeticao.keys()];
const antes = await ic("");
const depois = idsMarcar.length ? await ic(`AND NOT (id = ANY('{${idsMarcar.join(",")}}'::text[]))`) : antes;

console.log(`\n  ${bold("Funil")} — Initiate Checkout (visitantes distintos): ${bold(String(antes))} → ${bold(String(depois))}` +
  (antes === depois ? dim("   (não muda)") : amb(`   (−${antes - depois})`)));

if (!aplicar) {
  console.log(
    `\n${dim("Simulação — nada foi escrito.")}\n\n` +
      `  Confira as DUAS listas. Se estiverem certas:\n\n` +
      `    ${bold("npm run backup -- --url '<conn>'")}\n\n` +
      `    ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \\\n` +
      `      npm run eventos:marcar -- --url '<conn>' --email ${email} --aplicar\n\n` +
      `  ${dim("Errou? `--limpar --aplicar` desfaz tudo — nada foi apagado.")}\n`,
  );
  await c.end(); process.exit(0);
}

let tocados = 0;
// A repetição sempre grava `preview` — é o que ela detecta.
const ambienteDe = (id) => porId.get(id) ?? "preview";
for (const ambiente of [...new Set(idsMarcar.map(ambienteDe))]) {
  const ids = idsMarcar.filter((id) => ambienteDe(id) === ambiente);
  if (!ids.length) continue;
  const r = await c.query(`UPDATE "PixelEvent" SET ambiente=$2 WHERE "userId"=$1 AND id = ANY($3)`, [userId, ambiente, ids]);
  tocados += r.rowCount;
}
// ⚠️ `AND ambiente IS NULL` — a MESMA condição que `dashboard/metrics.ts` usa.
// Sem ela a conferência lia as linhas recém-marcadas (que continuam no banco,
// porque não apagamos nada) e acusava divergência com o previsto. O erro era do
// verificador, não da marcação — e foi ele mesmo que o denunciou.
const icFinal = await ic("AND ambiente IS NULL");
console.log(`\n  ${amb(bold(`${tocados} evento(s) marcado(s).`))}  Funil IC = ${bold(String(icFinal))}`);
console.log(icFinal === depois ? verde("  ✓ bateu com o previsto na simulação.\n")
  : `  🔴 previsto ${depois}, obtido ${icFinal} — investigue.\n`);
console.log(dim("  Nada foi apagado. `--limpar --aplicar` desfaz.\n"));

/**
 * 🔴 Aprovar a família guarda o PADRÃO, que passa a valer NA INGESTÃO.
 *
 * É o que fecha a assimetria: a Netlify já era preventiva (formato reservado),
 * a Vercel só era pega DEPOIS — então o preview novo já tinha ido para a CAPI
 * antes de qualquer coisa marcá-lo.
 *
 * ⚠️ Bloquear é IRREVERSÍVEL (o evento não vai para a Meta e não volta), então
 * o script diz em letras o que acabou de criar e ONDE se remove. A reversão
 * mora na tela, não aqui — regra de bloqueio que só saísse por SQL seria
 * irreversível na prática.
 */
if (familias.length) {
  const atual = (await c.query(`SELECT "testHostPatterns" AS p FROM "User" WHERE id=$1`, [userId])).rows[0]?.p;
  const atuais = lerPadroes(atual);
  const novos = familias.map((f) => f.padrao).filter((p) => !atuais.some((a) => a.padrao === p));
  if (novos.length) {
    const lista = [...atuais, ...novos.map((padrao) => ({ padrao, criadoEm: new Date().toISOString() }))];
    await c.query(`UPDATE "User" SET "testHostPatterns" = $2::jsonb WHERE id = $1`, [userId, JSON.stringify(lista)]);
    console.log(amb(bold(`  ${novos.length} padrão(ões) guardado(s) — passam a valer NA INGESTÃO:`)));
    for (const p of novos) console.log(`    ${p}`);
    console.log(dim("\n  Host NOVO que case com isto não conta no funil e NÃO vai para o Facebook."));
    console.log(dim("  O segmento variável ainda precisa parecer hash — aprovar não é cheque em branco."));
    console.log(dim('  Para desfazer: Integrações › Testes › "Endereços que não contam como visita".\n'));
  }
}

await c.end();
