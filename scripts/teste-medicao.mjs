/**
 * OS TRÊS ESTADOS DE MEDIÇÃO — ponta a ponta, contra o banco de DEV.
 *
 * 🕳️ A distinção central deste projeto, aplicada à LINHA da tabela: `spend: 0`
 * não distingue "a Meta reportou zero" de "não existe linha nenhuma", e as duas
 * pedem reações diferentes de quem está olhando.
 *
 *   nunca-sincronizada  a conta nunca conversou com a Meta   → confere a integração
 *   sem-veiculacao      sincroniza, não rodou NESTA janela   → não há o que fazer
 *   medida              há linha na janela; `spend: 0` é VERDADE
 *
 * ## Por que PONTA A PONTA, e não a função pura
 *
 * `medicaoDe` é local e trivial de acertar. O que já falhou cinco vezes
 * nesta base é o CAMINHO — de onde o dado vem, se a consulta o pede, se ele
 * sobrevive até o consumidor. A armadilha do `pedidoId` é o modelo: função
 * correta, `select` incompleto, número plausível e errado, tudo verde.
 *
 * Então a pergunta aqui é: **semeado o estado no banco, o valor sai em
 * `computeAdsOverview`?**
 *
 * ## O que torna as asserções capazes de falhar
 *
 * ⛔ Uma asserção precisa poder falhar pelo motivo que ela alega medir. As três
 * abaixo saem do MESMO fixture e do MESMO período: se `medicao` fosse constante
 * — o modo de falha mais provável de um enum novo —, as três não poderiam
 * concordar entre si, porque exigem valores DIFERENTES.
 *
 * ⛔ E há a asserção de CONTROLE, que é a que pega o colapso: o mesmo anúncio,
 * olhado numa janela que contém a métrica e noutra que não contém, tem de mudar
 * de `medida` para `sem-veiculacao`. Sem ela, um `medicao` derivado de
 * `effectiveStatus` sozinho passaria em tudo acima — e estaria errado, porque
 * ignoraria a janela.
 *
 *   npm run test:medicao
 */
import "dotenv/config";
import pg from "pg";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";
import { computeAdsOverview } from "@/lib/ads/overview";

exigirBancoDeDesenvolvimento({ script: "teste-medicao" });

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  if (obtido === esperado) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${JSON.stringify(obtido)}`);
  } else {
    falhas++;
    console.log(
      `  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`,
    );
  }
}

const c = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});

/* Estado original, devolvido no fim POR ID COLETADO na leitura — nunca por
   nome nem por `LIKE`. É a regra 4 dos testes que escrevem. */
const backup = [];
const metricasCriadas = [];

async function guardarCampanha(id) {
  const { rows } = await c.query(
    `SELECT "effectiveStatus", "status"::text FROM "Campaign" WHERE id = $1`, [id],
  );
  backup.push({ id, ...rows[0] });
}

async function main() {
  await c.connect();

  const { rows: user } = await c.query(`SELECT id FROM "User" WHERE email = 'dev@exemplo.dev'`);
  if (!user.length) throw new Error("Rode `npm run seed:dev` antes.");
  const userId = user[0].id;

  /* Três campanhas com anúncio, para os três estados. `ORDER BY name` é estável
     — sem ordem fixa o teste escolheria campanhas diferentes a cada execução e
     falharia por acaso. */
  const { rows: camps } = await c.query(
    `SELECT c.id, c.name, (SELECT ad.id FROM "Ad" ad WHERE ad."campaignId" = c.id LIMIT 1) "adId"
     FROM "Campaign" c JOIN "AdAccount" a ON a.id = c."adAccountId"
     WHERE a."userId" = $1 AND EXISTS (SELECT 1 FROM "Ad" ad WHERE ad."campaignId" = c.id)
     ORDER BY c.name LIMIT 3`,
    [userId],
  );
  if (camps.length < 3) throw new Error("Rode `npm run dev:campanhas` antes — preciso de 3 campanhas com anúncio.");

  const [medida, semVeiculacao, nuncaSync] = camps;
  for (const r of camps) await guardarCampanha(r.id);

  const hoje = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;
  const limpar = async (adId) => {
    await c.query(`DELETE FROM "DailyAdMetric" WHERE "adId" = $1 AND date >= ${hoje} - 40`, [adId]);
  };
  const semear = async (adId, diasAtras, spend) => {
    const id = `medicao${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await c.query(
      `INSERT INTO "DailyAdMetric" ("id","adId","date","spend","impressions","clicks","updatedAt")
       VALUES ($1,$2,${hoje} - $3::int,$4,100,10,now())`,
      [id, adId, diasAtras, spend],
    );
    metricasCriadas.push(id);
  };

  /* ── O fixture ────────────────────────────────────────────────────────────
     Os três saem do MESMO período e do MESMO banco. A única coisa que difere é
     o estado semeado — que é o que a asserção alega medir. */
  await limpar(medida.adId);
  await limpar(semVeiculacao.adId);
  await limpar(nuncaSync.adId);

  // 1. MEDIDA — linha HOJE, com gasto ZERO. É o caso que prova que `medida` não
  //    é derivado de `spend > 0`: se fosse, este cairia em "sem veiculação".
  await c.query(`UPDATE "Campaign" SET "effectiveStatus" = 'ACTIVE' WHERE id = $1`, [medida.id]);
  await semear(medida.adId, 0, 0);

  // 2. SEM VEICULAÇÃO — tem métrica 10 dias atrás; nada na janela de hoje.
  await c.query(`UPDATE "Campaign" SET "effectiveStatus" = 'PAUSED' WHERE id = $1`, [semVeiculacao.id]);
  await semear(semVeiculacao.adId, 10, 12.5);

  /* 3. NUNCA SINCRONIZADA — sem `effectiveStatus` e sem métrica nenhuma.
     ⛔ Nos TRÊS níveis. Cada linha responde sobre SI: zerar só a campanha
     deixaria o conjunto e o anúncio com o `effectiveStatus` deles próprios, e
     eles sairiam `sem-veiculacao` — que é a resposta CERTA para o estado que o
     fixture teria montado, e não o estado que este bloco quer montar. */
  await c.query(`UPDATE "Campaign" SET "effectiveStatus" = NULL WHERE id = $1`, [nuncaSync.id]);
  await c.query(`UPDATE "AdSet" SET "effectiveStatus" = NULL WHERE "campaignId" = $1`, [nuncaSync.id]);
  await c.query(`UPDATE "Ad" SET "effectiveStatus" = NULL WHERE "campaignId" = $1`, [nuncaSync.id]);

  const hojeSo = { period: "hoje", account: "todas", status: "todos", search: "", workspaceId: null };
  const overview = await computeAdsOverview(userId, hojeSo);
  const acha = (o, id) => o.campaigns.find((x) => x.id === id);

  console.log(`\n\x1b[1mOs três estados chegam em computeAdsOverview\x1b[0m`);
  eq("linha na janela com gasto ZERO → `medida`", acha(overview, medida.id)?.medicao, "medida");
  eq("métrica só fora da janela → `sem-veiculacao`", acha(overview, semVeiculacao.id)?.medicao, "sem-veiculacao");
  eq("sem sync e sem métrica → `nunca-sincronizada`", acha(overview, nuncaSync.id)?.medicao, "nunca-sincronizada");

  console.log(`\n\x1b[1mO ZERO de 'medida' é o zero VERDADEIRO, não ausência\x1b[0m`);
  eq("e o gasto dela é 0, não indefinido", acha(overview, medida.id)?.spend, 0);
  /* ⛔ A afirmação que separa esta linha das outras duas: as três têm
     `spend: 0`, e só uma delas tem direito de exibi-lo. Se `medicao` fosse
     constante, esta asserção e as três acima não poderiam ser todas verdes. */
  eq("as outras duas também somam 0 — é por isso que o número não basta",
    acha(overview, semVeiculacao.id)?.spend + acha(overview, nuncaSync.id)?.spend, 0);

  /* ── ASSERÇÃO DE CONTROLE: a janela precisa MUDAR a resposta ──────────────
     A mesma campanha, olhada num período que contém a métrica antiga, tem de
     virar `medida`. Sem isto, um `medicao` que ignorasse a janela e olhasse só
     o `effectiveStatus` passaria em tudo acima. */
  const trintaDias = await computeAdsOverview(userId, { ...hojeSo, period: "30d" });
  console.log(`\n\x1b[1mA JANELA muda a resposta — a asserção de controle\x1b[0m`);
  eq(
    "a mesma campanha vira `medida` num período que contém a métrica",
    acha(trintaDias, semVeiculacao.id)?.medicao,
    "medida",
  );
  eq(
    "e a que nunca sincronizou NÃO muda com o período",
    acha(trintaDias, nuncaSync.id)?.medicao,
    "nunca-sincronizada",
  );

  /* Os três níveis: o conjunto e o anúncio herdam a medição da campanha deles.
     Sem esta asserção, `medicao` poderia existir só em `CampaignRow` e as
     outras duas abas mostrariam `R$ 0,00` de novo. */
  console.log(`\n\x1b[1mE chega nos três níveis, não só na campanha\x1b[0m`);
  eq("conjunto herda", overview.adSets.find((x) => x.campaignId === nuncaSync.id)?.medicao, "nunca-sincronizada");
  eq("anúncio herda", overview.ads.find((x) => x.campaignId === nuncaSync.id)?.medicao, "nunca-sincronizada");
}

async function restaurar() {
  for (const id of metricasCriadas) {
    await c.query(`DELETE FROM "DailyAdMetric" WHERE id = $1`, [id]).catch(() => {});
  }
  for (const b of backup) {
    await c.query(`UPDATE "AdSet" SET "effectiveStatus" =  WHERE "campaignId" = `,
      [b.id, b.effectiveStatus]).catch(() => {});
    await c.query(`UPDATE "Ad" SET "effectiveStatus" =  WHERE "campaignId" = `,
      [b.id, b.effectiveStatus]).catch(() => {});
    await c
      .query(`UPDATE "Campaign" SET "effectiveStatus" = $2, "status" = $3::"EntityStatus" WHERE id = $1`,
        [b.id, b.effectiveStatus, b.status])
      .catch(() => {});
  }
}

main()
  .then(async () => {
    await restaurar();
    await c.end();
    console.log(
      falhas === 0
        ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
        : `\n\x1b[1m\x1b[31m${falhas} falharam de ${ok + falhas}.\x1b[0m\n`,
    );
    process.exit(falhas === 0 ? 0 : 1);
  })
  .catch(async (e) => {
    console.error(e);
    await restaurar().catch(() => {});
    await c.end().catch(() => {});
    process.exit(1);
  });
