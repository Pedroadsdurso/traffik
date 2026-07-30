/**
 * Sonda: a segmentação geográfica está mesmo chegando?
 *
 * ## Por que esta sonda existe
 *
 * A base local de IP→país ficou **pronta, testada e commitada durante uma
 * sessão inteira sem ser consultada por ninguém** — o globo continuava vazio e
 * só descobrimos por acaso. O desempate do passo 6 corre exatamente o mesmo
 * risco: se `AdSet.geoCountries` vier vazio, ele fica **inerte em silêncio**, e
 * a tela não muda de jeito nenhum para denunciar.
 *
 * E o passo 7 (hash do IP) é **irreversível**. Se o desempate não estiver
 * funcionando de verdade, a chance de corrigir com o IP legível acaba ali.
 *
 * ## Por que ela chama a GRAPH API, e não só lê o banco
 *
 * Ler o banco responde *"está vazio?"*. Só a resposta crua da Meta responde a
 * pergunta que importa: **vazio porque a campanha é mundial, ou vazio porque o
 * campo não veio?** As duas produzem exatamente a mesma linha no banco.
 *
 * ⚠️ É SÓ LEITURA: `GET` na Graph API e `SELECT` no banco. Nada é escrito, nem
 * na Meta nem aqui.
 *
 * ## Uso
 *
 *   npm run geo:sonda                      # usa a DATABASE_URL do .env
 *   npm run geo:sonda -- --url "<conn>"    # produção
 *   npm run geo:sonda -- --url "<conn>" --cru   # despeja o JSON completo
 *
 * Custo na Graph API: **1 chamada por conta de anúncio rastreada.**
 */
import "dotenv/config";
import pg from "pg";
import { GRAPH_URL } from "@/lib/facebook/graph";
import { decryptSecret } from "@/lib/crypto/secrets";

/** Mesmos status que o `sync.ts` sincroniza, para os números baterem. */
const STATUS_SINCRONIZADOS = JSON.stringify([
  "ACTIVE", "PAUSED", "ARCHIVED", "ADSET_PAUSED", "CAMPAIGN_PAUSED", "DISAPPROVED",
  "PENDING_REVIEW", "PREAPPROVED", "PENDING_BILLING_INFO", "IN_PROCESS", "WITH_ISSUES",
]);

const args = process.argv.slice(2);
const mostrarCru = args.includes("--cru");
const iUrl = args.indexOf("--url");
const url = iUrl >= 0 ? args[iUrl + 1] : process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("✗ Sem DATABASE_URL/DIRECT_URL e sem --url.");
  process.exit(1);
}
const ref = (url.match(/postgres\.([a-z0-9]+)[:@]/) ?? [])[1] ?? "desconhecido";
const cliente = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });

const C = { v: "\x1b[32m", r: "\x1b[31m", a: "\x1b[33m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };

/** Mesma extração do `sync.ts` — se divergir, a sonda mente. */
function paisesDaSegmentacao(geo) {
  if (!geo) return [];
  const out = new Set();
  for (const c of geo.countries ?? []) if (c) out.add(String(c).toUpperCase());
  for (const chave of ["regions", "cities", "geo_markets", "zips", "places"]) {
    for (const item of geo[chave] ?? []) if (item?.country) out.add(String(item.country).toUpperCase());
  }
  return [...out];
}

async function main() {
  await cliente.connect();
  console.log(`\n${C.b}Sonda de segmentação geográfica${C.x} — projeto ${C.b}${ref}${C.x}`);

  // ── 1. O que está NO BANCO ──────────────────────────────────────────────
  const { rows: banco } = await cliente.query(`
    SELECT count(*)::int AS total,
           -- Alias ENTRE ASPAS: sem elas o Postgres rebaixa para minusculas e a
           -- propriedade sai indefinida no JS, produzindo NaN na tela.
           -- (Sem crases neste comentario: ele vive dentro de um template
           -- literal, e uma crase aqui fecharia a string.)
           count(*) FILTER (WHERE cardinality("geoCountries") > 0)::int AS "comGeo",
           COALESCE(avg(cardinality("geoCountries")) FILTER (WHERE cardinality("geoCountries") > 0), 0)::float AS "media"
      FROM "AdSet"`);
  const b = banco[0];
  console.log(`\n${C.b}1. No banco (o que o sync gravou)${C.x}`);
  if (b.total === 0) {
    console.log(`   ${C.a}Nenhum conjunto sincronizado ainda.${C.x} Rode o sync antes desta sonda.`);
  } else {
    const pct = ((b.comGeo / b.total) * 100).toFixed(1);
    const cor = b.comGeo === 0 ? C.r : b.comGeo < b.total ? C.a : C.v;
    console.log(`   ${b.total} conjuntos · ${cor}${b.comGeo} com segmentação (${pct}%)${C.x} · ${b.total - b.comGeo} vazios`);
    console.log(`   Média de países por conjunto preenchido: ${C.b}${b.media.toFixed(1)}${C.x}`);
    const { rows: top } = await cliente.query(`
      SELECT unnest("geoCountries") AS p, count(*)::int AS n FROM "AdSet"
       WHERE cardinality("geoCountries") > 0 GROUP BY 1 ORDER BY 2 DESC LIMIT 8`);
    if (top.length) console.log(`   Países: ${top.map((t) => `${t.p} (${t.n})`).join(" · ")}`);
  }

  // ── 2. O que a GRAPH API devolve AGORA ──────────────────────────────────
  const { rows: contas } = await cliente.query(`
    SELECT a."fbAccountId", a."name", p."accessToken"
      FROM "AdAccount" a JOIN "AdProfile" p ON p."id" = a."adProfileId"
     WHERE a."trackingEnabled" = true AND p."accessToken" IS NOT NULL`);

  console.log(`\n${C.b}2. Na Graph API (a fonte)${C.x}`);
  if (!contas.length) {
    console.log(`   ${C.a}Nenhuma conta rastreada com token. Nada a consultar.${C.x}`);
    return fim();
  }

  const stats = { conjuntos: 0, semTargeting: 0, semGeo: 0, comCountries: 0, comCidades: 0, comRegioes: 0, comGrupos: 0, vazioReal: 0 };
  const gruposVistos = new Set();
  let exemplo = null;
  let exemploCidade = null;

  for (const conta of contas) {
    let token;
    try {
      token = decryptSecret(conta.accessToken);
    } catch {
      token = conta.accessToken; // token legado em texto puro
    }
    // ⚠️ O PREFIXO `act_` É OBRIGATÓRIO. `AdAccount.fbAccountId` guarda só o
    // número; `/1234/adsets` devolve "(#100) Tried accessing nonexisting field
    // (adsets)", que soa como problema de permissão e não é. O `sync.ts` monta
    // `/act_${fbAccountId}` — esta sonda errou isso na primeira versão e passou
    // um diagnóstico falso de "a Graph não responde".
    //
    // Mesmo `effective_status` do sync: sem ele a sonda contaria conjuntos que o
    // sync nunca grava, e os números não bateriam com o banco de propósito
    // nenhum.
    const params = new URLSearchParams({
      fields: "id,name,targeting{geo_locations}",
      effective_status: STATUS_SINCRONIZADOS,
      limit: "100",
      access_token: token,
    });
    // Tolerante ao prefixo já presente: a PRODUÇÃO guarda `fbAccountId` sem
    // `act_` (por isso o `sync.ts` o acrescenta e funciona), mas o seed de
    // desenvolvimento guarda COM. Sem esta normalização a sonda montava
    // `act_act_dev_A` e falhava só no dev — ou seja, quebrava exatamente onde eu
    // a testo antes de mandar para produção.
    const contaId = `act_${String(conta.fbAccountId).replace(/^act_/, "")}`;
    const u = `${GRAPH_URL}/${contaId}/adsets?${params}`;
    const r = await fetch(u);
    const j = await r.json();
    if (!r.ok || j.error) {
      console.log(`   ${C.r}✗ ${conta.name}: ${j.error?.message ?? r.status}${C.x}`);
      // A URL (sem o token) é o que permite diagnosticar sem adivinhar.
      console.log(`     ${C.d}${u.replace(/access_token=[^&]*/, "access_token=***")}${C.x}`);
      continue;
    }
    const lista = j.data ?? [];
    console.log(`   ${C.v}✓${C.x} ${conta.name} — ${lista.length} conjuntos`);

    for (const cj of lista) {
      stats.conjuntos++;
      const geo = cj.targeting?.geo_locations;
      if (!cj.targeting) { stats.semTargeting++; continue; }
      if (!geo) { stats.semGeo++; continue; }
      if (geo.countries?.length) stats.comCountries++;
      if (geo.cities?.length) { stats.comCidades++; if (!exemploCidade) exemploCidade = cj; }
      if (geo.regions?.length) stats.comRegioes++;
      if (geo.country_groups?.length) { stats.comGrupos++; for (const g of geo.country_groups) gruposVistos.add(g); }
      if (paisesDaSegmentacao(geo).length === 0) stats.vazioReal++;
      if (!exemplo) exemplo = cj;
    }
  }

  console.log(`\n${C.b}3. Diagnóstico${C.x}`);
  const linha = (rot, n, nota = "") => console.log(`   ${String(n).padStart(5)}  ${rot}${nota ? `  ${C.d}${nota}${C.x}` : ""}`);
  linha("conjuntos consultados", stats.conjuntos);
  linha("sem o objeto `targeting`", stats.semTargeting, "o campo NÃO veio — investigar permissão/versão");
  linha("com `targeting` mas sem `geo_locations`", stats.semGeo, "campanha sem restrição geográfica");
  linha("com `countries`", stats.comCountries, "caminho simples");
  linha("com `cities`", stats.comCidades, "país sai de cities[].country");
  linha("com `regions`", stats.comRegioes, "país sai de regions[].country");
  linha("com `country_groups`", stats.comGrupos, gruposVistos.size ? `NÃO expandidos: ${[...gruposVistos].join(", ")}` : "");
  linha("que extraem ZERO países", stats.vazioReal, "só country_groups, ou geo vazio");

  console.log(`\n${C.b}4. Veredito${C.x}`);
  if (stats.conjuntos === 0) {
    console.log(`   ${C.a}Nada consultado.${C.x}`);
  } else if (stats.semTargeting === stats.conjuntos) {
    console.log(`   ${C.r}O CAMPO NÃO ESTÁ VINDO.${C.x} Nenhum conjunto trouxe \`targeting\`.`);
    console.log(`   O desempate está INERTE. NÃO avance para o passo 7.`);
  } else if (stats.comCountries + stats.comCidades + stats.comRegioes === 0) {
    console.log(`   ${C.a}O campo vem, mas nenhuma campanha tem restrição de país.${C.x}`);
    console.log(`   O desempate não vai disparar — e isso está CERTO: campanha mundial não desempata.`);
  } else {
    const ok = stats.comCountries + stats.comCidades + stats.comRegioes;
    console.log(`   ${C.v}Funcionando: ${ok} conjunto(s) com país extraível.${C.x}`);
    if (b.comGeo === 0) {
      console.log(`   ${C.r}⚠ Mas o BANCO está vazio — o sync ainda não rodou com o código novo.${C.x}`);
      console.log(`   Rode uma sincronização completa e repita esta sonda.`);
    }
  }

  if (exemplo) {
    console.log(`\n${C.b}5. Exemplo REAL da resposta da Graph API${C.x}`);
    console.log(`   conjunto: ${exemplo.name}`);
    console.log(JSON.stringify(exemplo.targeting, null, 2).split("\n").map((l) => "   " + l).join("\n"));
    console.log(`   ${C.d}→ países extraídos: ${JSON.stringify(paisesDaSegmentacao(exemplo.targeting?.geo_locations))}${C.x}`);
  }
  if (exemploCidade && exemploCidade !== exemplo) {
    console.log(`\n   ${C.b}Exemplo com segmentação por CIDADE${C.x} (confirma cities[].country):`);
    console.log(JSON.stringify(exemploCidade.targeting?.geo_locations?.cities?.slice(0, 2), null, 2).split("\n").map((l) => "   " + l).join("\n"));
    console.log(`   ${C.d}→ países extraídos: ${JSON.stringify(paisesDaSegmentacao(exemploCidade.targeting?.geo_locations))}${C.x}`);
  }
  if (mostrarCru && exemplo) {
    console.log(`\n${C.b}6. JSON cru completo do exemplo${C.x}`);
    console.log(JSON.stringify(exemplo, null, 2));
  }
  fim();
}

function fim() {
  console.log("");
}

main()
  .catch((e) => {
    console.error("\n✗ Falhou:", e.message);
    process.exitCode = 1;
  })
  .finally(() => cliente.end());
