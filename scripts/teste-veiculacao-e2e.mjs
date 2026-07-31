/**
 * Verificação PONTA A PONTA da coluna Veiculação, contra o banco de DEV.
 *
 * ⚠️ O teste puro (`npm run test:veiculacao`) prova que a TRADUÇÃO está certa.
 * Ele não prova que o valor **chega** — e é exatamente aí que este projeto já
 * se enganou cinco vezes: coisa pronta, testada, compilando e **inerte**. O
 * caso mais parecido é o `pedidoId` fora do `select`, que fazia toda contagem
 * voltar ao comportamento antigo em silêncio, com número plausível.
 *
 * Então aqui a pergunta é outra: gravado no banco, o valor sai em
 * `computeAdsOverview` — nos TRÊS níveis?
 *
 * Escreve no banco de DEV (passa pelo `guard-db`) e restaura o estado anterior
 * no fim, por id coletado na leitura.
 */
import "dotenv/config";
import pg from "pg";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";
import { computeAdsOverview } from "@/lib/ads/overview";
import { veiculacao } from "@/lib/ads/veiculacao";

exigirBancoDeDesenvolvimento();

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  if (obtido === esperado) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${JSON.stringify(obtido)}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`);
  }
}

const c = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});

/** Estado original, para devolver tudo como estava. */
const backup = [];
async function guardar(tabela, id) {
  const { rows } = await c.query(`SELECT "status", "effectiveStatus" FROM "${tabela}" WHERE id = $1`, [id]);
  backup.push({ tabela, id, ...rows[0] });
}
async function pintar(tabela, id, status, efetivo) {
  await c.query(`UPDATE "${tabela}" SET "status" = $2::"EntityStatus", "effectiveStatus" = $3 WHERE id = $1`,
    [id, status, efetivo]);
}

async function main() {
  await c.connect();

  const { rows: user } = await c.query(`SELECT id FROM "User" WHERE email = 'dev@exemplo.dev'`);
  if (!user.length) throw new Error("Rode `npm run seed:dev` antes.");
  const userId = user[0].id;

  const { rows: camps } = await c.query(`SELECT id, name FROM "Campaign" ORDER BY name LIMIT 2`);
  const { rows: sets } = await c.query(`SELECT id FROM "AdSet" ORDER BY id LIMIT 1`);
  const { rows: ads } = await c.query(`SELECT id FROM "Ad" ORDER BY id LIMIT 1`);
  if (camps.length < 2 || !sets.length || !ads.length) throw new Error("Dados de dev insuficientes.");

  for (const r of camps) await guardar("Campaign", r.id);
  await guardar("AdSet", sets[0].id);
  await guardar("Ad", ads[0].id);

  // Campanha 0: ligada e ENTREGANDO. Campanha 1: ligada e PARADA.
  await pintar("Campaign", camps[0].id, "ACTIVE", "ACTIVE");
  await pintar("Campaign", camps[1].id, "ACTIVE", "WITH_ISSUES");
  // Conjunto ligado, campanha acima pausada — só o effective_status conta isso.
  await pintar("AdSet", sets[0].id, "ACTIVE", "CAMPAIGN_PAUSED");
  // Anúncio reprovado pela Meta.
  await pintar("Ad", ads[0].id, "ACTIVE", "DISAPPROVED");

  const overview = await computeAdsOverview(userId, {
    period: "30d", account: "todas", status: "todos", search: "", workspaceId: null,
  });

  console.log("\n\x1b[1mO valor CHEGA em computeAdsOverview (os 3 níveis)\x1b[0m");
  const c0 = overview.campaigns.find((x) => x.id === camps[0].id);
  const c1 = overview.campaigns.find((x) => x.id === camps[1].id);
  const s0 = overview.adSets.find((x) => x.id === sets[0].id);
  const a0 = overview.ads.find((x) => x.id === ads[0].id);
  eq("campanha entregando", c0?.effectiveStatus, "ACTIVE");
  eq("campanha com problema", c1?.effectiveStatus, "WITH_ISSUES");
  eq("conjunto com campanha pausada", s0?.effectiveStatus, "CAMPAIGN_PAUSED");
  eq("anúncio reprovado", a0?.effectiveStatus, "DISAPPROVED");

  console.log("\n\x1b[1mE vira o selo certo na tela\x1b[0m");
  eq("entregando não alarma", veiculacao(c0.status, c0.effectiveStatus).divergente, false);
  eq("com problema alarma", veiculacao(c1.status, c1.effectiveStatus).divergente, true);
  eq("  …dizendo o quê", veiculacao(c1.status, c1.effectiveStatus).rotulo, "Com problema");
  eq("conjunto diz 'Campanha pausada'", veiculacao(s0.status, s0.effectiveStatus).rotulo, "Campanha pausada");
  eq("anúncio diz 'Reprovado'", veiculacao(a0.status, a0.effectiveStatus).rotulo, "Reprovado");

  console.log("\n\x1b[1m🔴 A REGRESSÃO que este teste existe para pegar\x1b[0m");
  {
    // Tirar `effectiveStatus` do `select` de `overview.ts` não quebra tipo
    // nenhum em runtime: o campo simplesmente vem `undefined`, a coluna some da
    // tela, e tudo continua "funcionando". `tsc`, `lint` e `build` passam.
    const semCampo = overview.campaigns.some((x) => x.effectiveStatus === undefined);
    eq("nenhuma linha voltou com o campo AUSENTE", semCampo, false);
  }

  console.log("\n\x1b[1mNulo continua sendo 'não informado'\x1b[0m");
  await pintar("Campaign", camps[1].id, "ACTIVE", null);
  const ov2 = await computeAdsOverview(userId, {
    period: "30d", account: "todas", status: "todos", search: "", workspaceId: null,
  });
  const c1b = ov2.campaigns.find((x) => x.id === camps[1].id);
  eq("campo nulo chega como null (não como string)", c1b?.effectiveStatus, null);
  eq("e NÃO vira alarme", veiculacao(c1b.status, c1b.effectiveStatus).divergente, false);
  eq("aparece como traço", veiculacao(c1b.status, c1b.effectiveStatus).rotulo, "—");
}

main()
  .catch((e) => {
    falhas++;
    console.error("\n✗ Falhou:", e.message);
  })
  .finally(async () => {
    // Restaura por ID coletado na leitura — nunca por nome, nunca por LIKE.
    for (const b of backup) {
      await c.query(`UPDATE "${b.tabela}" SET "status" = $2::"EntityStatus", "effectiveStatus" = $3 WHERE id = $1`,
        [b.id, b.status, b.effectiveStatus]);
    }
    console.log(`\n  \x1b[2m${backup.length} linha(s) restauradas ao estado original.\x1b[0m`);
    await c.end();
    console.log(
      falhas === 0
        ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
        : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
    );
    process.exit(falhas === 0 ? 0 : 1);
  });
