/**
 * Estrutura de cada conta: campanha → conjuntos → anúncios, com gasto.
 *
 * ## Por que existe
 *
 * "Esta campanha pode gastar?" não se responde pelo status. A Meta só entrega
 * **através de conjuntos**: campanha sem conjunto ativo não gasta nem se for
 * ativada — e é exatamente essa propriedade que torna uma campanha segura como
 * cobaia de teste de escrita na Graph API.
 *
 * Foi a pergunta que a `ads:sonda` deixou em aberto: ela conta objetos por
 * CONTA (8 campanhas / 8 conjuntos / 8 anúncios) e isso não diz **de quem** são
 * os conjuntos. Aqui a contagem é por campanha.
 *
 * ⚠️ SÓ LEITURA — apenas `SELECT`. Nenhuma chamada à Graph API.
 *
 * ## Uso
 *
 *   npm run conta:estrutura -- --url "<conn>"
 *   npm run conta:estrutura -- --url "<conn>" --dias 30
 */
import "dotenv/config";
import pg from "pg";

const args = process.argv.slice(2);
const iUrl = args.indexOf("--url");
const url = iUrl >= 0 ? args[iUrl + 1] : process.env.DIRECT_URL || process.env.DATABASE_URL;
const iDias = args.indexOf("--dias");
const dias = iDias >= 0 ? Number(args[iDias + 1]) : 7;
if (!url) {
  console.error("✗ Sem DATABASE_URL/DIRECT_URL e sem --url.");
  process.exit(1);
}
const ref = (url.match(/postgres\.([a-z0-9]+)[:@]/) ?? [])[1] ?? "desconhecido";
const c = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });
const C = { v: "\x1b[32m", r: "\x1b[31m", a: "\x1b[33m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };

const brl = (n) => `R$ ${Number(n ?? 0).toFixed(2).replace(".", ",")}`;

async function main() {
  await c.connect();
  console.log(`\n${C.b}Estrutura das contas${C.x} — projeto ${C.b}${ref}${C.x} · gasto dos últimos ${dias} dias  ${C.d}(só leitura)${C.x}`);

  const { rows } = await c.query(
    `SELECT ac."name" AS conta,
            cp.id, cp."name", cp.status::text AS status, cp."effectiveStatus" AS efetivo,
            cp."dailyBudget",
            (SELECT count(*)::int FROM "AdSet" s WHERE s."campaignId" = cp.id) AS conjuntos,
            (SELECT count(*)::int FROM "AdSet" s
              WHERE s."campaignId" = cp.id AND s.status = 'ACTIVE') AS "conjuntosAtivos",
            (SELECT count(*)::int FROM "Ad" a WHERE a."campaignId" = cp.id) AS anuncios,
            (SELECT count(*)::int FROM "Ad" a
              WHERE a."campaignId" = cp.id AND a.status = 'ACTIVE') AS "anunciosAtivos",
            COALESCE((SELECT sum(m.spend) FROM "DailyAdMetric" m
                        JOIN "Ad" a ON a.id = m."adId"
                       WHERE a."campaignId" = cp.id
                         AND m.date >= (now() - ($1 || ' days')::interval)::date), 0) AS gasto
       FROM "Campaign" cp
       JOIN "AdAccount" ac ON ac.id = cp."adAccountId"
      ORDER BY ac."name", cp.status, cp."name"`,
    [String(dias)],
  );

  if (!rows.length) {
    console.log(`\n   ${C.a}Nenhuma campanha sincronizada.${C.x}\n`);
    return;
  }

  let contaAtual = null;
  const podeGastar = [];
  for (const r of rows) {
    if (r.conta !== contaAtual) {
      contaAtual = r.conta;
      console.log(`\n${C.b}${contaAtual}${C.x}`);
    }
    // 🔴 A propriedade que importa: entrega exige CONJUNTO ATIVO com ANÚNCIO
    // ATIVO. Campanha sem isso não gasta nem se for ligada.
    const armada = r.status === "ACTIVE" && r.conjuntosAtivos > 0 && r.anunciosAtivos > 0;
    const crua = r.conjuntos === 0;
    if (armada) podeGastar.push(`${r.conta} · ${r.name}`);

    const marca = armada ? `${C.r}● PODE GASTAR${C.x}` : crua ? `${C.v}○ crua (sem conjunto)${C.x}` : `${C.d}○ ${r.status.toLowerCase()}${C.x}`;
    console.log(`  ${marca}  ${r.name}`);
    console.log(
      `     ${C.d}status ${r.status} · veiculação ${r.efetivo ?? "—"} · ` +
        `${r.conjuntos} conjunto(s) (${r.conjuntosAtivos} ativo) · ` +
        `${r.anuncios} anúncio(s) (${r.anunciosAtivos} ativo) · ` +
        `orçamento ${r.dailyBudget == null ? "na campanha: —" : brl(r.dailyBudget)} · ` +
        `gasto ${brl(r.gasto)}${C.x}`,
    );
  }

  console.log(`\n${C.b}Veredito${C.x}`);
  if (!podeGastar.length) {
    console.log(`   ${C.v}✓ Nenhuma campanha está armada para entregar.${C.x}`);
  } else {
    console.log(`   ${C.r}⚠ ${podeGastar.length} campanha(s) ATIVA(S) com conjunto e anúncio ativos:${C.x}`);
    for (const n of podeGastar) console.log(`     ${n}`);
    console.log(`   ${C.d}Estas gastam dinheiro real. Não use nenhuma delas como cobaia de teste.${C.x}`);
  }
  console.log(
    `\n   ${C.d}"Crua" = sem nenhum conjunto. A Meta só entrega através de conjuntos,` +
      `\n   então campanha crua não gasta nem se for ativada — é o que a torna segura.${C.x}\n`,
  );
}

main()
  .catch((e) => {
    console.error("\n✗ Falhou:", e.message);
    process.exitCode = 1;
  })
  .finally(() => c.end());
