/**
 * Dá ESTADO às campanhas do banco de desenvolvimento — status, veiculação,
 * objetivo e orçamento — e cria as que faltam para a tabela do Gerenciador ser
 * avaliável.
 *
 * ## Por que ele existe
 *
 * Medido em 07/08/2026, antes de desenhar o Gerenciador:
 *
 *   Campaign.status          →  UNKNOWN  nas 2   (o default do schema)
 *   Campaign.effectiveStatus →  NULL     nas 2
 *   objective, dailyBudget   →  NULL     nas 2
 *
 * O `seed-dev.mjs` insere `Campaign`/`AdSet`/`Ad` sem nenhum desses campos. O
 * `sync.ts` escreve todos eles (`fields: "…,status,effective_status,objective,
 * daily_budget,…"`), então **em produção eles existem e no dev não** — o dev
 * não é uma versão menor da produção, é uma versão sem a coluna que a tela
 * inteira usa.
 *
 * Consequência: donut de status 100% cinza, todas as abas vazias menos
 * `Todas`, coluna de veiculação inteira "não informado", e duas linhas para
 * julgar uma tabela de vinte colunas.
 *
 * 🌱 É a família "o gerador produz exatamente o estado que impede de ver o que
 * se ia verificar" — a mesma do `n % 2` que fazia o BOLETO nunca casar.
 *
 * ## O que ele NÃO faz
 *
 * ⛔ Não apaga nada, e não roda `seed:dev:limpar` — isso mata a sessão de quem
 * está com o painel aberto. As 2 campanhas existentes são atualizadas no lugar;
 * as novas são acrescentadas com `fbCampaignId` fixo, então rodar duas vezes
 * não duplica.
 *
 * ## As regras de escrita que ele obedece
 *
 * 1. `exigirBancoDeDesenvolvimento()` na primeira linha — lista de PERMISSÃO.
 * 2. Todo `UPDATE`/`INSERT` é escopado pelo `userId` do dono do dev, nunca por
 *    nome. `WHERE name = '…'` atravessa usuários — foi o incidente de 29/07.
 * 3. **Idempotente, sem `random()`.** A distribuição sai da posição na lista.
 *    Com aleatório, cada execução muda os números da tela e ninguém sabe se ela
 *    mudou por causa do código ou do script.
 * 4. **Ele IMPRIME o que gerou.** Foi a saída de um script assim que denunciou
 *    o BOLETO a 100%; sem a tabela no fim, o estado errado passa por "a tela
 *    ficou bonita".
 *
 * Uso:
 *   node scripts/campanhas-dev.mjs
 */
import "dotenv/config";
import pg from "pg";
import { randomUUID } from "node:crypto";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "campanhas-dev" });

const EMAIL = "dev@exemplo.dev";
const MARCA = "[DEV]";

const cliente = new pg.Client({
  connectionString: (process.env.DATABASE_URL ?? "").split("?")[0],
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

const id = () => randomUUID().replace(/-/g, "").slice(0, 25);

/* ── O ESTADO DE CADA CAMPANHA ───────────────────────────────────────────────
 *
 * ⚠️ Doze linhas, e cada COLUNA de variação tem um período coprimo com 12 —
 * senão duas decisões diferentes caem sempre juntas e a correlação é muda. Foi
 * exatamente isso que fez o BOLETO nunca ficar pendente (`n % 2` numa lista de
 * 6). Aqui a variação é escrita à mão, item a item, justamente para não
 * depender de aritmética de índice.
 *
 * O que cada linha precisa exercer na tela está na última coluna.
 */
const CAMPANHAS = [
  // status    efetivo               objetivo             diária  vitalícia  o que exerce
  ["ACTIVE",   "ACTIVE",             "OUTCOME_SALES",       80,   null,  "linha saudável, CBO"],
  ["ACTIVE",   "ACTIVE",             "OUTCOME_SALES",      120,   null,  "a de maior gasto — 'melhor campanha' do Insights"],
  ["ACTIVE",   "CAMPAIGN_PAUSED",    "OUTCOME_LEADS",       50,   null,  "🔴 DIVERGENTE: ligada e não entrega"],
  ["ACTIVE",   "PENDING_REVIEW",     "OUTCOME_TRAFFIC",     40,   null,  "divergente por revisão da Meta"],
  ["ACTIVE",   "PENDING_BILLING_INFO", "OUTCOME_SALES",     60,   null,  "divergente por pagamento — tom de erro"],
  ["PAUSED",   "PAUSED",             "OUTCOME_SALES",       70,   null,  "pausada normal, sem alarme"],
  ["PAUSED",   "PAUSED",             "OUTCOME_ENGAGEMENT",  null, 1500,  "pausada com orçamento VITALÍCIO"],
  ["PAUSED",   null,                 "OUTCOME_LEADS",       45,   null,  "pausada com efetivo NULO (sync antigo)"],
  ["ARCHIVED", "ARCHIVED",           "OUTCOME_TRAFFIC",     null, null,  "arquivada — aba própria, sem orçamento"],
  ["ARCHIVED", "ARCHIVED",           "OUTCOME_SALES",       null,  900,  "arquivada que já gastou"],
  ["ACTIVE",   "ACTIVE",             "OUTCOME_AWARENESS",   null, null,  "🔴 ABO: sem orçamento na campanha"],
  ["UNKNOWN",  null,                 null,                  null, null,  "🔴 NUNCA SINCRONIZADA — o selo 'não sincronizado'"],
];

/* Nomes que não são todos do mesmo tamanho: coluna de nome com doze strings
   parecidas não mostra o truncamento, que é metade do problema de uma tabela
   larga. */
const NOMES = [
  "Black Friday 24 — Conversão",
  "Escala Principal",
  "Retargeting 7d",
  "Topo de Funil — Vídeo",
  "Lookalike 1% Compradores",
  "Teste Criativo Setembro",
  "Remarketing Carrinho Abandonado — Público Amplo Brasil",
  "Engajamento Página",
  "Campanha Antiga 2023",
  "Lançamento Q2",
  "ABO Interesses",
  "Rascunho Importado",
];

async function main() {
  await cliente.connect();

  const { rows: us } = await cliente.query(`SELECT id FROM "User" WHERE email = $1`, [EMAIL]);
  if (us.length === 0) {
    console.error(`\n  Usuário ${EMAIL} não existe. Rode \`npm run seed:dev\` antes.\n`);
    process.exit(1);
  }
  const userId = us[0].id;

  /* Contas do dono do dev — o escopo de tudo abaixo. Sem isto, um `WHERE` por
     nome atingiria campanha de outro usuário com o mesmo nome. */
  const { rows: contas } = await cliente.query(
    `SELECT id, name FROM "AdAccount" WHERE "userId" = $1 ORDER BY name`,
    [userId],
  );
  if (contas.length === 0) {
    console.error(`\n  Nenhuma conta de anúncio no dev. Rode \`npm run seed:dev\` antes.\n`);
    process.exit(1);
  }

  /* As que já existem, na ordem de criação, para receberem as primeiras linhas
     da tabela acima. `ORDER BY "createdAt", id` é estável — sem ele a atribuição
     mudaria entre execuções e o script deixaria de ser idempotente. */
  const { rows: existentes } = await cliente.query(
    `SELECT c.id FROM "Campaign" c JOIN "AdAccount" a ON a.id = c."adAccountId"
     WHERE a."userId" = $1 ORDER BY c."createdAt", c.id`,
    [userId],
  );

  /* A chave dos ids sintéticos. Uma função, e não a string espalhada: a
     primeira versão deste script usou `camp-dev-gerenciador-N` e a troca para
     numérico teve de acontecer em DOIS lugares que já haviam divergido. */
  const chaveFb = (i) => `12000000000${String(i).padStart(4, "0")}`;

  /* Migração da chave antiga → numérica. Sem isto a execução seguinte não
     encontraria as linhas pela chave nova e criaria uma segunda cópia de cada
     campanha. Escopado por `userId`, e por id coletado — nunca por LIKE. */
  for (let i = 0; i < CAMPANHAS.length; i++) {
    const antiga = `camp-dev-gerenciador-${i}`;
    await cliente.query(
      `UPDATE "Campaign" SET "fbCampaignId" = $3
       WHERE "fbCampaignId" = $2
         AND "adAccountId" IN (SELECT id FROM "AdAccount" WHERE "userId" = $1)`,
      [userId, antiga, chaveFb(i)],
    );
    /* O `xcod` dos cliques carrega a chave ANTIGA no sufixo. Trocar só a
       campanha orfanaria a receita que este script semeou — o defeito que a
       troca de chave existe para evitar, cometido pela própria troca. */
    for (const tabela of ["Click", "Sale"]) {
      await cliente.query(
        `UPDATE "${tabela}" SET "utmCampaign" = replace("utmCampaign", '|' || $2, '|' || $3)
         WHERE "userId" = $1 AND "utmCampaign" LIKE '%|' || $2`,
        [userId, antiga, chaveFb(i)],
      );
    }
  }

  const resultado = [];
  const todasAsCampanhas = [];

  for (let i = 0; i < CAMPANHAS.length; i++) {
    const [status, efetivo, objetivo, diaria, vitalicia, exerce] = CAMPANHAS[i];
    const nome = `${MARCA} ${NOMES[i]}`;
    const conta = contas[i % contas.length];

    let campanhaId = existentes[i]?.id;

    if (campanhaId) {
      await cliente.query(
        `UPDATE "Campaign" SET "name" = $2, "status" = $3::"EntityStatus", "effectiveStatus" = $4,
           "objective" = $5, "dailyBudget" = $6, "lifetimeBudget" = $7, "updatedAt" = now()
         WHERE id = $1
           AND "adAccountId" IN (SELECT id FROM "AdAccount" WHERE "userId" = $8)`,
        [campanhaId, nome, status, efetivo, objetivo, diaria, vitalicia, userId],
      );
    } else {
      /* 🔴 `fbCampaignId` NUMÉRICO, e isso não é cosmética.
       *
       * `splitPipe` (`lib/utm/parse.ts:72`) descarta id NÃO NUMÉRICO — a Meta
       * usa inteiros longos, e um `camp-dev-A` é indistinguível de placeholder
       * não substituído. Consequência: com id de mentira, o dev inteiro
       * atribuía venda→campanha **por NOME**, que é a dívida técnica nº 3 (a
       * ambígua). O caminho por ID — o que roda em produção e o que o Bloco 11
       * existe para tornar confiável — nunca era exercido aqui.
       *
       * Derivado do índice, então a segunda execução encontra a linha em vez de
       * criar outra. */
      const fb = chaveFb(i);
      const { rows: ja } = await cliente.query(
        `SELECT c.id FROM "Campaign" c JOIN "AdAccount" a ON a.id = c."adAccountId"
         WHERE a."userId" = $1 AND c."fbCampaignId" = $2`,
        [userId, fb],
      );
      campanhaId = ja[0]?.id ?? id();
      if (ja.length === 0) {
        await cliente.query(
          `INSERT INTO "Campaign" ("id","adAccountId","fbCampaignId","name","status","effectiveStatus",
             "objective","dailyBudget","lifetimeBudget","updatedAt")
           VALUES ($1,$2,$3,$4,$5::"EntityStatus",$6,$7,$8,$9,now())`,
          [campanhaId, conta.id, fb, nome, status, efetivo, objetivo, diaria, vitalicia],
        );
      } else {
        await cliente.query(
          `UPDATE "Campaign" SET "name" = $2, "status" = $3::"EntityStatus", "effectiveStatus" = $4,
             "objective" = $5, "dailyBudget" = $6, "lifetimeBudget" = $7, "updatedAt" = now()
           WHERE id = $1`,
          [campanhaId, nome, status, efetivo, objetivo, diaria, vitalicia],
        );
      }

      /* Conjunto e anúncio: sem `Ad` não há `DailyAdMetric`, e sem métrica a
         campanha não tem gasto nenhum — que é o caso que a tela precisa
         DISTINGUIR de "gastou zero", não o único caso que ela mostra. */
      const conjunto = `set-dev-gerenciador-${i}`, anuncio = `ad-dev-gerenciador-${i}`;
      const { rows: jaConj } = await cliente.query(
        `SELECT id FROM "AdSet" WHERE "campaignId" = $1 AND "fbAdSetId" = $2`, [campanhaId, conjunto],
      );
      let conjuntoId = jaConj[0]?.id;
      if (!conjuntoId) {
        conjuntoId = id();
        await cliente.query(
          `INSERT INTO "AdSet" ("id","adAccountId","campaignId","fbAdSetId","name","status","effectiveStatus","dailyBudget","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6::"EntityStatus",$7,$8,now())`,
          [conjuntoId, conta.id, campanhaId, conjunto, `${nome} — Conjunto`, status, efetivo, diaria ? null : 30],
        );
      }
      const { rows: jaAd } = await cliente.query(
        `SELECT id FROM "Ad" WHERE "adSetId" = $1 AND "fbAdId" = $2`, [conjuntoId, anuncio],
      );
      let anuncioId = jaAd[0]?.id;
      if (!anuncioId) {
        anuncioId = id();
        await cliente.query(
          `INSERT INTO "Ad" ("id","adAccountId","adSetId","campaignId","fbAdId","name","status","effectiveStatus","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7::"EntityStatus",$8,now())`,
          [anuncioId, conta.id, conjuntoId, campanhaId, anuncio, `${nome} — Criativo`, status, efetivo],
        );
      }

    }

    /* ⛔ A MÉTRICA É SEMEADA A CADA EXECUÇÃO, não só na criação.
       A primeira versão só semeava no ramo de INSERT, então qualquer coisa que
       apagasse uma linha (foi o `teste-medicao`, que deletava e não devolvia)
       deixava a campanha sem métrica para sempre — e o script "idempotente" não
       consertava. Seed que só cria não repara o estado; seed que reconcilia,
       sim.

       🔴 A LINHA 12 (`UNKNOWN`) FICA SEM MÉTRICA DE PROPÓSITO.
       Ela é a única que exerce "nunca sincronizou" — e é ela que prova que a
       célula mostra `—` em vez de `R$ 0,00`. Semear métrica nela apagaria o
       caso que o script existe para criar. */
    const { rows: adsDaCamp } = await cliente.query(
      `SELECT id FROM "Ad" WHERE "campaignId" = $1 ORDER BY id LIMIT 1`, [campanhaId],
    );
    const anuncioAlvo = adsDaCamp[0]?.id;
    if (status !== "UNKNOWN" && anuncioAlvo) {
      /* Gasto derivado do índice, não sorteado. Os multiplicadores são
         desiguais para que ROAS, CPA e CPC não saiam todos parecidos — uma
         tabela em que toda linha tem o mesmo número não mostra a ordenação
         nem a barra de proporção. */
      const gasto = 35 + i * 23;
      const impressoes = 4000 + i * 1700;
      const cliques = 90 + i * 37;
      const { rows: jaM } = await cliente.query(
        `SELECT id FROM "DailyAdMetric" WHERE "adId" = $1
           AND date = (now() AT TIME ZONE 'America/Sao_Paulo')::date`, [anuncioAlvo],
      );
      if (jaM.length === 0) {
        /* A data é HOJE no fuso do usuário, não `CURRENT_DATE` (que é UTC no
           servidor). Um dia adiantado some da janela do dashboard — é a
           armadilha que já pegou o `teste-pedidos`. */
        await cliente.query(
          `INSERT INTO "DailyAdMetric" ("id","adId","date","spend","impressions","clicks","updatedAt")
           VALUES ($1,$2,(now() AT TIME ZONE 'America/Sao_Paulo')::date,$3,$4,$5,now())`,
          [id(), anuncioAlvo, gasto, impressoes, cliques],
        );
      }
    }

    todasAsCampanhas.push({ fbCampaignId: existentes[i] ? (await cliente.query('SELECT "fbCampaignId" FROM "Campaign" WHERE id = $1', [campanhaId])).rows[0].fbCampaignId : chaveFb(i), indice: i });
    resultado.push({ nome: NOMES[i], status, veiculacao: efetivo ?? "(nulo)", objetivo: objetivo ?? "(nulo)", exerce });
  }

  /* ── RECEITA ATRIBUÍDA ────────────────────────────────────────────────────
   *
   * Sem isto, só as 2 campanhas originais têm receita (as vendas do
   * `seed-dev` apontam para elas pelo `fbCampaignId`, que este script não
   * mexe). Dez linhas com ROAS `0,00x` e uma com `—` provam a distinção
   * "não medido ≠ zero", mas deixam o painel `Insights` sem o que ranquear:
   * "melhor campanha", "maior volume" e "menor custo por conversão" com dois
   * candidatos não é ranking, é lista.
   *
   * ⚠️ As campanhas 2, 3, 8 e 10 são escolhidas de propósito, não em sequência:
   * uma DIVERGENTE (ligada e não entrega), uma em revisão, uma ARQUIVADA e a
   * ABO. Assim o Insights precisa lidar com campanha que fatura e não veicula —
   * que é o caso em que uma recomendação automática erra feio.
   *
   * ⛔ As campanhas 4 (`PENDING_BILLING_INFO`) e 11 (`UNKNOWN`) ficam sem
   * receita de propósito: a primeira é a "atenção necessária" do Insights, e a
   * segunda é a única que prova o `—`. */
  const RECEITA = [
    [2, 6, 149.9], [3, 3, 97.0], [8, 9, 249.9], [10, 4, 197.0],
  ];

  for (const [indice, quantas, ticket] of RECEITA) {
    const fb = chaveFb(indice);
    const { rows: cs } = await cliente.query(
      `SELECT c.id, c.name FROM "Campaign" c JOIN "AdAccount" a ON a.id = c."adAccountId"
       WHERE a."userId" = $1 AND c."fbCampaignId" = $2`, [userId, fb],
    );
    if (cs.length === 0) continue;

    const { rows: hooks } = await cliente.query(
      `SELECT id FROM "Webhook" WHERE "userId" = $1 ORDER BY "createdAt" LIMIT 1`, [userId],
    );

    for (let n = 0; n < quantas; n++) {
      /* `externalId` derivado do par (campanha, n) — é ele que torna a segunda
         execução um no-op em vez de duplicar faturamento. */
      const externo = `dev-ger-${indice}-${n}`;
      const { rows: ja } = await cliente.query(
        `SELECT id FROM "Sale" WHERE "userId" = $1 AND "externalId" = $2`, [userId, externo],
      );
      if (ja.length > 0) continue;

      /* O clique carrega o `xcod` no formato que o parser real espera
         (`nome|fbCampaignId`) — atribuição pelo ID, que é a que sobrevive a
         renomear campanha. Casar por nome é a dívida técnica nº 3. */
      const clique = id();
      await cliente.query(
        `INSERT INTO "Click" ("id","clickId","userId","utmSource","utmCampaign","timestamp")
         VALUES ($1,$1,$2,$3,$4,now() - ($5 || ' hours')::interval)`,
        [clique, userId, "facebook", `${cs[0].name}|${fb}`, String(n + 1)],
      );
      await cliente.query(
        `INSERT INTO "Sale" ("id","userId","clickId","webhookId","externalId","product","value","status",
           "paymentMethod","buyerEmail","country","utmSource","utmCampaign","timestamp","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,'APROVADA','PIX',$8,'BR',$9,$10,now() - ($11 || ' hours')::interval,now())`,
        [id(), userId, clique, hooks[0]?.id ?? null, externo, `${MARCA} Produto ${indice}`, ticket,
         `comprador${indice}${n}@exemplo.dev`, "facebook", `${cs[0].name}|${fb}`, String(n + 1)],
      );
    }
  }

  /* ── 🕳️ CHECKOUT NAS JORNADAS NOVAS — os DOIS ramos, de propósito ─────────
   *
   * 🔴 Sem isto o seed reproduz o defeito que ele existe para evitar. As
   * jornadas criadas acima têm `Click` e `Sale` e **nenhum checkout**, então na
   * janela de hoje o funil sai:
   *
   *     Cliques 1.962 → Sessões 22 → ICs 0 → Vendas Inic. 22 → Vendas Apr. 22
   *
   * A fita fechava em nada nos ICs e reabria — gravata-borboleta —, e o meio do
   * funil ficava impossível de avaliar. Mesma família do `n % 2` que fazia o
   * BOLETO nunca casar: o gerador produzindo exatamente o estado que impede de
   * ver o que se ia verificar.
   *
   * ⛔ E NÃO BASTA carimbar `checkoutSource`: sem `checkoutAt` não há linha para
   * carimbar. O que falta é JORNADA COM CHECKOUT, que é o que este bloco cria.
   *
   * ### Por que UMA conta medida e outra NÃO
   *
   * `Click.checkoutAt` tem dois escritores — o pixel do navegador e o webhook
   * do gateway — e a tela trata os dois casos de forma diferente:
   *
   * | conta | checkout | o que exercita |
   * |---|---|---|
   * | a 1ª | `navegador` em ~2/3 | origem MISTA: a composição `N ICs · M do navegador` |
   * | a 2ª | só `gateway` | o `AVISO_SEM_PIXEL`: etapa derivada, pílula suprimida |
   *
   * Com uma só, metade da tela nunca aparece — e ramo nunca visitado em
   * desenvolvimento é indistinguível de ramo correto.
   *
   * ⚠️ A distribuição sai da POSIÇÃO (`n % 3`), não de `random()`: com aleatório
   * os números da tela mudam a cada execução e ninguém sabe se ela mudou por
   * causa do código ou do seed. */
  const { rows: comClique } = await cliente.query(
    `SELECT cl.id, cl."utmCampaign", row_number() OVER (ORDER BY cl.timestamp, cl.id) AS n
     FROM "Click" cl WHERE cl."userId" = $1 ORDER BY cl.timestamp, cl.id`,
    [userId],
  );

  /* A conta de cada clique sai da campanha no `xcod`. Índice PAR = 1ª conta
     (mista), ÍMPAR = 2ª (só gateway). Usar a conta, e não o índice do clique,
     é o que faz o corte ser por CONTA — que é o que a tela compara. */
  const contaDoFb = new Map(todasAsCampanhas.map((c) => [c.fbCampaignId, c.indice]));

  let checkoutsNavegador = 0;
  let checkoutsGateway = 0;
  for (const cl of comClique) {
    const fb = (cl.utmCampaign ?? "").split("|").pop();
    const indice = contaDoFb.get(fb);
    if (indice === undefined) continue;
    const contaMista = indice % 2 === 0;
    /* ⚠️ Nem todo clique vira checkout — senão `Sessões === ICs` e o trecho
       desenha 100%, que é a laje que impede avaliar o meio do funil. */
    if (Number(cl.n) % 3 === 0) continue;
    const fonte = contaMista && Number(cl.n) % 3 === 1 ? "navegador" : "gateway";
    await cliente.query(
      `UPDATE "Click" SET "checkoutAt" = timestamp + interval '4 minutes', "checkoutSource" = $2
       WHERE id = $1 AND "userId" = $3`,
      [cl.id, fonte, userId],
    );
    if (fonte === "navegador") checkoutsNavegador++;
    else checkoutsGateway++;
  }

  /* ── AS DUAS ORIGINAIS: O `utmCampaign` DOS CLIQUES SEGUE O NOME NOVO ─────
   *
   * 🔴 Renomear campanha ZEROU a receita das duas que já existiam, e o motivo
   * merece ficar escrito porque não é óbvio:
   *
   * `splitPipe` descarta id não numérico, e o `seed-dev` grava
   * `fbCampaignId = 'camp-dev-A'`. Logo `camp.id` sai `null` e a atribuição cai
   * no ramo do NOME (`resultsByName`, `overview.ts:422`) — que passou a não
   * casar mais com o nome novo. As duas campanhas apareceram com
   * `R$ 0,00` de faturamento e ROAS `0,00x`, ao lado de um gasto real.
   *
   * ⚠️ Isso NÃO é bug do produto: com id numérico de verdade — que é o que a
   * Meta manda — a atribuição vai por id e sobrevive a renomear. É o seed que
   * era irreal, e é por isso que as campanhas novas acima nascem com id
   * numérico.
   *
   * Aqui só realinhamos o nome dentro do `xcod` dos cliques que já existem.
   * ⛔ Escopado por `userId`: um `WHERE` por `utmCampaign` atravessaria
   * usuários, que é exatamente o incidente de 29/07. */
  const { rows: todas } = await cliente.query(
    `SELECT c.name, c."fbCampaignId" FROM "Campaign" c JOIN "AdAccount" a ON a.id = c."adAccountId"
     WHERE a."userId" = $1`,
    [userId],
  );
  for (const { name, fbCampaignId } of todas) {
    for (const tabela of ["Click", "Sale"]) {
      await cliente.query(
        `UPDATE "${tabela}" SET "utmCampaign" = $2
         WHERE "userId" = $1 AND "utmCampaign" LIKE '%|' || $3
           AND "utmCampaign" IS DISTINCT FROM $2`,
        [userId, `${name}|${fbCampaignId}`, fbCampaignId],
      );
    }
  }

  /* ── A SAÍDA QUE ALGUÉM LÊ ────────────────────────────────────────────────
     Não é enfeite: o BOLETO a 100% foi descoberto por uma tabela como esta, e
     não pelo código. Se uma coluna sair uniforme aqui, o bloco que depende dela
     vai sair uniforme na tela. */
  console.log(`\n  \x1b[1mCampanhas do dev\x1b[0m — o que cada uma exerce na tela\n`);
  console.table(resultado);

  const { rows: conferencia } = await cliente.query(
    `SELECT c.status::text, COUNT(*)::int AS campanhas,
            COUNT(*) FILTER (WHERE c."effectiveStatus" IS NULL)::int AS sem_veiculacao,
            COUNT(*) FILTER (WHERE c."objective" IS NULL)::int AS sem_objetivo
     FROM "Campaign" c JOIN "AdAccount" a ON a.id = c."adAccountId"
     WHERE a."userId" = $1 GROUP BY 1 ORDER BY 2 DESC`,
    [userId],
  );
  console.log(`  \x1b[1mConferência no banco\x1b[0m\n`);
  console.table(conferencia);

  const { rows: semMetrica } = await cliente.query(
    `SELECT COUNT(*)::int AS n FROM "Campaign" c JOIN "AdAccount" a ON a.id = c."adAccountId"
     WHERE a."userId" = $1 AND NOT EXISTS (
       SELECT 1 FROM "Ad" ad JOIN "DailyAdMetric" d ON d."adId" = ad.id WHERE ad."campaignId" = c.id)`,
    [userId],
  );
  console.log(`  Campanhas SEM nenhuma métrica (as que precisam mostrar "—"): \x1b[1m${semMetrica[0].n}\x1b[0m\n`);

  await cliente.end();
}

main().catch(async (e) => {
  console.error(e);
  await cliente.end().catch(() => {});
  process.exit(1);
});
