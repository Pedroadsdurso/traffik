/**
 * Venda ÓRFÃ DE CLIQUE: a cópia dos UTMs sustenta a atribuição?
 *
 * `Sale.clickId` é `onDelete: SetNull`. Apagar um clique não apaga a venda — mas
 * até esta sessão apagava a **campanha, o criativo e a fonte** dela, porque toda
 * a atribuição lia `sale.click.utmCampaign` e ninguém lia as colunas de cópia
 * que a ingestão já gravava desde a migration `20260731080000`.
 *
 * ## Por que um teste de BANCO, e não um teste puro
 *
 * `utmsDaVenda` já era testada isolada em `teste-utm-venda.mjs`, e passava — a
 * função nunca foi o problema. O que falhava era o **caminho**: um `select` sem
 * as colunas de cópia entrega `undefined`, a venda perde a campanha e
 * **nenhum `tsc`, `lint` ou `build` acusa**. É a armadilha do `pedidoId`, que
 * este projeto já pagou três vezes.
 *
 * Então o teste semeia o caso e lê o número **no fim da cadeia** —
 * `computeDashboard` e `computeAdsOverview` de verdade.
 *
 * ## A asserção precisa poder FALHAR pelo motivo que ela alega medir
 *
 * Uma venda órfã atribuída corretamente e uma venda órfã que caiu na Principal
 * por engano produziriam o mesmo `revenue` TOTAL. Por isso cada bloco carrega o
 * **controle**: a venda sem clique E sem cópia, que precisa continuar fora da
 * campanha. Sem ela, o teste passaria com a atribuição desligada.
 *
 * ## Escreve no banco de DESENVOLVIMENTO, e limpa por id
 *
 *   npm run test:utm-orfa
 */
// ⚠️ `dotenv` ANTES do guard: ele lê a `DATABASE_URL` no import para decidir se
// a escrita é permitida, e sem o `.env` carregado abortaria por falta de env var.
import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "teste-utm-orfa" });

const { computeDashboard } = await import("../src/lib/dashboard/metrics.ts");
const { computeAdsOverview } = await import("../src/lib/ads/overview.ts");

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();
const q = (sql, p = []) => cliente.query(sql, p);

let ok = 0;
const falhas = [];
async function checar(nome, fn) {
  try {
    await fn();
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome}`);
  } catch (e) {
    falhas.push(nome);
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      ${e.message}`);
  }
}

const id = (p) => `${p}-${crypto.randomUUID()}`;
const userId = id("orfa");
const contaId = id("orfa");
const campId = id("orfa");
const adsetId = id("orfa");
const adId = id("orfa");
const wsId = id("orfa");

/**
 * Ids da Meta, e eles são NUMÉRICOS de propósito.
 *
 * ⚠️ `splitPipe` **descarta id não numérico** — `"Camp|c-orfa-1"` devolve
 * `{name:"Camp", id:null}`. A primeira versão deste teste usava ids com letras,
 * então a atribuição caía no fallback por NOME e a asserção passava pelo caminho
 * secundário, sem nunca exercer o primário. Id numérico é o que a Meta manda de
 * verdade, e é o que os códigos do Bloco 11 produzem.
 */
const FB_CAMP = "120210000000001";
const FB_AD = "238001000000001";
/**
 * ⚠️ O NOME dentro do UTM é deliberadamente DIFERENTE do nome da campanha e do
 * anúncio no banco ("Camp Orfa" / "Anuncio Orfa"). Assim o fallback por nome não
 * tem como casar, e a atribuição só pode acontecer pelo **id** — que é o caminho
 * primário. Com os nomes iguais, a asserção passaria mesmo se o id fosse
 * ignorado, e não mediria o que diz medir.
 */
const UTM_CAMPAIGN = `Nome Que Nao Casa|${FB_CAMP}`;
const UTM_CONTENT = `Criativo Que Nao Casa|${FB_AD}`;

try {
  await q(
    `INSERT INTO "User"(id,email,name,"passwordHash",timezone,"updatedAt")
     VALUES($1,$2,'Orfa','x','America/Sao_Paulo',now())`,
    [userId, `${userId}@t.local`],
  );
  await q(`INSERT INTO "Workspace"(id,"userId",name,"isDefault","updatedAt") VALUES($1,$2,'Principal',true,now())`,
    [wsId, userId]);
  await q(`INSERT INTO "AdAccount"(id,"userId","fbAccountId",name,"trackingEnabled","updatedAt")
           VALUES($1,$2,'act_orfa','Conta Orfa',true,now())`, [contaId, userId]);
  await q(`INSERT INTO "Campaign"(id,"adAccountId","fbCampaignId",name,status,"updatedAt")
           VALUES($1,$2,$3,'Camp Orfa','ACTIVE',now())`, [campId, contaId, FB_CAMP]);
  await q(`INSERT INTO "AdSet"(id,"adAccountId","campaignId","fbAdSetId",name,status,"updatedAt")
           VALUES($1,$2,$3,'s-orfa','Set Orfa','ACTIVE',now())`, [adsetId, contaId, campId]);
  await q(`INSERT INTO "Ad"(id,"adAccountId","campaignId","adSetId","fbAdId",name,status,"updatedAt")
           VALUES($1,$2,$3,$4,$5,'Anuncio Orfa','ACTIVE',now())`, [adId, contaId, campId, adsetId, FB_AD]);

  // Gasto de R$ 200 HOJE, para ROAS e CPA terem denominador.
  //
  // ⚠️ `(now() AT TIME ZONE 'America/Sao_Paulo')::date`, nunca `CURRENT_DATE`:
  // este último é o dia do BANCO (UTC), e depois das 21h em Brasília o gasto
  // cairia no dia seguinte. Um teste que só quebra à noite é pior que um que
  // quebra sempre.
  await q(`INSERT INTO "DailyAdMetric"(id,"adId",date,spend,impressions,clicks,"updatedAt")
           VALUES($1,$2,(now() AT TIME ZONE 'America/Sao_Paulo')::date,200,1000,50,now())`, [id("orfa"), adId]);

  /** Clique com os UTMs da campanha semeada. */
  async function criarClique() {
    const clkId = id("orfa-clk");
    await q(
      `INSERT INTO "Click"(id,"clickId","userId","utmSource","utmMedium","utmCampaign","utmContent",
                           bot,"timestamp")
       VALUES($1,$2,$3,'facebook','cpc',$4,$5,false,now())`,
      [clkId, crypto.randomUUID(), userId, UTM_CAMPAIGN, UTM_CONTENT],
    );
    return clkId;
  }

  /**
   * Venda como a ingestão a grava: o `clickId` E a cópia dos UTMs.
   * `comCopia: false` simula uma venda que nunca casou clique nenhum.
   */
  async function criarVenda({ clickId, valor, comCopia = true }) {
    const saleId = id("orfa-sal");
    await q(
      `INSERT INTO "Sale"(id,"userId","externalId","clickId","matchMethod",value,currency,product,
                          status,"paymentMethod","utmSource","utmMedium","utmCampaign","utmContent",
                          "approvedAt","timestamp","updatedAt")
       VALUES($1,$2,$3,$4,$5,$6,'BRL','Produto Orfa','APROVADA','PIX',$7,$8,$9,$10,now(),now(),now())`,
      [saleId, userId, saleId, clickId, clickId ? "direct" : "none", valor,
       comCopia ? "facebook" : null, comCopia ? "cpc" : null,
       comCopia ? UTM_CAMPAIGN : null, comCopia ? UTM_CONTENT : null],
    );
    return saleId;
  }

  const cliqueVivo = await criarClique();
  const cliqueApagado = await criarClique();

  // R$ 100 — o caminho normal: clique vivo, cópia presente. A fonte manda.
  await criarVenda({ clickId: cliqueVivo, valor: 100 });
  // R$ 400 — vai ficar órfã. Só a cópia vai sobrar.
  const vOrfa = await criarVenda({ clickId: cliqueApagado, valor: 400 });
  // R$ 7 — CONTROLE: nunca teve clique nem cópia. Tem de ficar FORA da campanha.
  await criarVenda({ clickId: null, valor: 7, comCopia: false });

  // ─────────────── O SetNull, exercido de verdade ───────────────

  console.log("\n\x1b[1m1. Apagar o clique órfã a venda — e a cópia sobrevive\x1b[0m\n");

  await q(`DELETE FROM "Click" WHERE id = $1`, [cliqueApagado]);

  const depois = (await q(`SELECT "clickId","utmCampaign","utmContent" FROM "Sale" WHERE id=$1`, [vOrfa])).rows[0];

  await checar("apagar o clique zerou o clickId da venda (SetNull, não Cascade)", () => {
    assert.equal(depois.clickId, null, `veio ${JSON.stringify(depois.clickId)}`);
  });
  await checar("a venda continua no banco — nenhum faturamento se perdeu", () => {
    assert.ok(depois, "a venda desapareceu: a FK está como Cascade");
  });
  await checar("e a CÓPIA da campanha sobreviveu ao clique", () => {
    assert.equal(depois.utmCampaign, UTM_CAMPAIGN, `veio ${JSON.stringify(depois.utmCampaign)}`);
  });

  // ─────────────── Gerenciador: ROAS e CPA por campanha ───────────────

  console.log("\n\x1b[1m2. Gerenciador de Anúncios — a campanha ainda vê a venda órfã\x1b[0m\n");

  const ads = await computeAdsOverview(userId, {
    period: "hoje", account: "todas", status: "todos", search: "", workspaceId: wsId,
  });

  const linha = ads.campaigns.find((c) => c.fbId === FB_CAMP);

  // ⛔ Prove que HOUVE o que examinar. `revenue === 500` sobre uma lista vazia
  // seria `undefined`, mas uma asserção de contagem cairia no falso verde que
  // este projeto documenta.
  await checar("a campanha semeada aparece no Gerenciador", () => {
    assert.ok(linha, `nenhuma campanha com fbId=${FB_CAMP}; veio ${ads.campaigns.length} linha(s)`);
  });

  await checar("faturamento da campanha = 100 (clique vivo) + 400 (órfã) = 500", () => {
    assert.equal(linha.revenue, 500, `veio ${linha.revenue} — sem a cópia daria 100`);
  });

  await checar("CONTROLE: a venda de R$ 7 sem clique e sem cópia NÃO entrou", () => {
    assert.notEqual(linha.revenue, 507, "a venda sem atribuição nenhuma vazou para a campanha");
  });

  await checar("2 conversões na campanha, não 1", () => {
    assert.equal(linha.results, 2, `veio ${linha.results}`);
  });

  await checar("ROAS = 500 ÷ 200 = 2,5x (sem a cópia seria 0,5x)", () => {
    assert.equal(Math.round((linha.revenue / linha.spend) * 100) / 100, 2.5);
  });

  // ⚠️ No nível de ANÚNCIO só `vendasIniciadas` é atribuído — `results` e
  // `revenue` são `0` literais em `adRows`, por uma limitação anterior a esta
  // sessão (não há como ratear faturamento por anúncio com honestidade). Então a
  // asserção aqui é sobre a contagem, que é o que aquele nível de fato mostra.
  const anuncio = ads.ads.find((a) => a.fbId === FB_AD);
  await checar("o anúncio recupera as 2 conversões iniciadas pelo utm_content", () => {
    assert.ok(anuncio, "o anúncio semeado não apareceu");
    assert.equal(anuncio.vendasIniciadas, 2, `veio ${anuncio.vendasIniciadas} — sem a cópia daria 1`);
  });

  // ─────────────── Dashboard: fonte e origem ───────────────

  console.log("\n\x1b[1m3. Dashboard — a fonte e a origem da venda órfã\x1b[0m\n");

  const d = await computeDashboard(userId, {
    period: "hoje", account: "todas", product: "todos", source: "todas", workspaceId: wsId,
  });

  await checar("faturamento total = 100 + 400 + 7 = 507 (nada se perdeu)", () => {
    assert.equal(d.kpis.revenue, 507, `veio ${d.kpis.revenue}`);
  });

  const meta = d.sources.find((s) => s.name === "Meta Ads");
  await checar("'Meta Ads' soma as duas vendas com fonte: 500", () => {
    assert.ok(meta, `fontes vieram: ${JSON.stringify(d.sources)}`);
    assert.equal(meta.total, 500, `veio ${meta.total} — sem a cópia daria 100`);
  });

  await checar("CONTROLE: a venda sem cópia fica em 'Direto / Orgânico', não em Meta Ads", () => {
    // O rótulo vem de `lib/fontes.ts` — fonte nula é "Direto / Orgânico".
    const direto = d.sources.find((s) => s.name === "Direto / Orgânico");
    assert.ok(direto, `nenhuma fonte direta; veio ${JSON.stringify(d.sources)}`);
    assert.equal(direto.total, 7, `veio ${direto.total}`);
  });

  // A origem é o bloco em que a cópia muda a LEITURA, não só o número: sem ela a
  // venda órfã cairia em `semOrigem` — a única das três que pede ação — e a tela
  // mandaria investigar o rastreamento de uma venda que rastreou certo.
  await checar("origem: 500 em 'campanha' (a órfã não virou 'sem origem')", () => {
    assert.equal(d.origemDaReceita.campanha, 500, `veio ${d.origemDaReceita.campanha}`);
  });

  await checar("CONTROLE: só a venda que nunca teve clique está em 'sem origem'", () => {
    assert.equal(d.origemDaReceita.semOrigem, 7, `veio ${d.origemDaReceita.semOrigem}`);
  });
} finally {
  // Limpeza por id coletado na criação — nunca por LIKE, nunca por nome.
  await q(`DELETE FROM "Sale" WHERE "userId"=$1`, [userId]);
  await q(`DELETE FROM "Click" WHERE "userId"=$1`, [userId]);
  await q(`DELETE FROM "DailyAdMetric" WHERE "adId"=$1`, [adId]);
  await q(`DELETE FROM "Ad" WHERE id=$1`, [adId]);
  await q(`DELETE FROM "AdSet" WHERE id=$1`, [adsetId]);
  await q(`DELETE FROM "Campaign" WHERE id=$1`, [campId]);
  await q(`DELETE FROM "AdAccount" WHERE id=$1`, [contaId]);
  await q(`UPDATE "User" SET "lastWorkspaceId"=NULL WHERE id=$1`, [userId]);
  await q(`DELETE FROM "Workspace" WHERE "userId"=$1`, [userId]);
  await q(`DELETE FROM "User" WHERE id=$1`, [userId]);
  await cliente.end();
}

console.log(`\n\x1b[1m${ok} asserções, ${falhas.length} falha(s)\x1b[0m\n`);
if (falhas.length) console.log("Falharam:\n  - " + falhas.join("\n  - ") + "\n");
process.exit(falhas.length === 0 ? 0 : 1);
