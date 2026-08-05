/**
 * "A Meta nao reporta gasto, ou os insights chegam e nao acham o anuncio?"
 *
 * ## Por que um script novo
 *
 * `metricasOrfas` e um contador de RUNTIME no `SyncSummary` — ele nao e
 * persistido, entao o `diag:testadores`, que le o banco, nao tem como mostra-lo.
 * As duas hipoteses produzem exatamente o mesmo estado gravado (`nenhuma linha
 * de DailyAdMetric`) e pedem consertos opostos:
 *
 * | | Hipotese | Conserto |
 * |---|---|---|
 * | (a) | a Meta nao reporta insight nenhum | **nada** — a conta nao gastou |
 * | (b) | os insights chegam e o `ad_id` nao existe no nosso banco | 🔴 bug nosso |
 *
 * A unica forma de separar as duas e PERGUNTAR A META e comparar com o que
 * temos. E o mesmo padrao da `geo:sonda` e da `ads:sonda`.
 *
 * ⚠️ **SO LEITURA**: `GET` na Graph API e `SELECT` no banco. Nenhuma escrita.
 *
 * ⚠️ Custo: **1 chamada por conta**. Nao rode em laco.
 *
 * ## Uso
 *
 *   npm run ads:orfas -- --url "<conn>" --email alguem@exemplo.com
 *   npm run ads:orfas -- --url "<conn>" --email alguem@exemplo.com --dias 30
 */
import "dotenv/config";
import pg from "pg";

const args = process.argv.slice(2);
const arg = (n, p = null) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : p;
};

const url = arg("--url") ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const email = arg("--email");
const dias = Number(arg("--dias", "30"));
if (!url || !email) {
  console.error("✗ Uso: npm run ads:orfas -- --url \"<conn>\" --email <email>");
  process.exit(1);
}

const ref = (url.match(/postgres\.([a-z0-9]+)[:@]/) ?? [])[1] ?? "desconhecido";
const c = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });
const C = { v: "\x1b[32m", r: "\x1b[31m", a: "\x1b[33m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };
const GRAPH = "https://graph.facebook.com/v21.0";

const diaChave = (d) => d.toISOString().slice(0, 10);

async function graphAll(path, params, token) {
  const out = [];
  let u = `${GRAPH}${path}?` + new URLSearchParams({ ...params, limit: "200", access_token: token });
  let paginas = 0;
  while (u) {
    const res = await fetch(u, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    if (json.data) out.push(...json.data);
    u = json.paging?.next ?? null;
    // ⚠️ Teto de paginas: uma conta grande com `time_increment: 1` pode paginar
    // muito, e este script e de diagnostico — nao pode virar o proprio problema.
    if (++paginas >= 25) break;
  }
  return { linhas: out, paginas };
}

async function main() {
  await c.connect();
  console.log(
    `\n${C.b}Insights órfãos?${C.x} — projeto ${C.b}${ref}${C.x} · ${dias} dias  ${C.d}(só leitura)${C.x}\n`,
  );

  const { rows: contas } = await c.query(
    `SELECT a.id, a.name, a."fbAccountId", a."trackingEnabled", p."accessToken"
       FROM "AdAccount" a
       JOIN "User" u ON u.id = a."userId"
       LEFT JOIN "AdProfile" p ON p.id = a."adProfileId"
      WHERE u.email = $1
      ORDER BY a.name`,
    [email],
  );
  if (contas.length === 0) {
    console.log(`${C.r}Nenhuma conta para ${email}.${C.x}\n`);
    return;
  }

  const ate = new Date();
  const desde = new Date(ate.getTime() - dias * 86400_000);

  for (const conta of contas) {
    console.log(`${C.b}${conta.name}${C.x}  ${C.d}act_${conta.fbAccountId}${C.x}`);
    if (!conta.accessToken) {
      console.log(`  ${C.a}sem perfil vinculado — o sync nem tenta.${C.x}\n`);
      continue;
    }

    // O MESMO mapa que `syncAccountMetrics` monta.
    const { rows: ads } = await c.query(
      `SELECT "fbAdId" FROM "Ad" WHERE "adAccountId" = $1`,
      [conta.id],
    );
    const locais = new Set(ads.map((a) => a.fbAdId));

    let r;
    const t0 = Date.now();
    try {
      r = await graphAll(
        `/act_${conta.fbAccountId}/insights`,
        {
          level: "ad",
          fields: "ad_id,spend,impressions",
          time_increment: "1",
          time_range: JSON.stringify({ since: diaChave(desde), until: diaChave(ate) }),
          action_report_time: "impression",
        },
        conta.accessToken,
      );
    } catch (e) {
      console.log(`  ${C.r}✗ a Graph recusou: ${e.message}${C.x}\n`);
      continue;
    }
    const ms = Date.now() - t0;

    const casam = r.linhas.filter((l) => l.ad_id && locais.has(l.ad_id));
    const orfas = r.linhas.filter((l) => l.ad_id && !locais.has(l.ad_id));
    const gasto = r.linhas.reduce((s, l) => s + Number(l.spend ?? 0), 0);

    console.log(
      `  ${ads.length} anúncio(s) no nosso banco · ${r.linhas.length} linha(s) de insight` +
        ` · ${r.paginas} página(s) · ${ms} ms · gasto total R$ ${gasto.toFixed(2)}`,
    );

    // ── O VEREDITO ──────────────────────────────────────────────────────────
    if (r.linhas.length === 0) {
      console.log(
        `  ${C.v}(a) A Meta não reportou insight nenhum em ${dias} dias.${C.x}` +
          ` ${C.d}Não é bug: esta conta não teve entrega no período.${C.x}\n`,
      );
      continue;
    }
    if (orfas.length === 0) {
      console.log(`  ${C.v}✓ Todas as ${casam.length} linhas casam com anúncio local.${C.x}`);
      console.log(
        `  ${C.a}Se não há métrica gravada mesmo assim, o problema é DEPOIS do match` +
          ` — na escrita ou no tempo.${C.x}\n`,
      );
      continue;
    }

    console.log(
      `  ${C.r}(b) 🔴 ${orfas.length} de ${r.linhas.length} linha(s) ÓRFÃS` +
        ` — o \`ad_id\` do insight não existe no nosso banco.${C.x}`,
    );
    const exemplos = [...new Set(orfas.map((l) => l.ad_id))].slice(0, 3);
    console.log(`  ${C.d}ad_id órfãos: ${exemplos.join(", ")}${C.x}`);
    console.log(`  ${C.d}ad_id que temos: ${[...locais].slice(0, 3).join(", ") || "(nenhum)"}${C.x}`);
    // ⚠️ A comparacao de FORMATO e o que separa "anuncio excluido na Meta" de
    // "estamos guardando o id errado". Se os nossos ids tem outra cara, o bug
    // e na gravacao, nao na Meta.
    const gastoOrfao = orfas.reduce((s, l) => s + Number(l.spend ?? 0), 0);
    console.log(
      `  ${C.r}R$ ${gastoOrfao.toFixed(2)} de gasto está sendo descartado em silêncio.${C.x}\n`,
    );
  }

  console.log(`${C.d}Nada foi escrito. Nenhuma alteração na Meta.${C.x}\n`);
}

main()
  .catch((e) => {
    console.error(`${C.r}✗ ${e.message}${C.x}`);
    process.exitCode = 1;
  })
  .finally(() => c.end());
