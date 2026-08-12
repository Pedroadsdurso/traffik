/**
 * Dá aos webhooks do dev o que faltava: **contadores reais, chave e um segundo
 * gateway**.
 *
 * > ### 🌗 O SEED PRODUZIA ESTADO INCOMPLETO — a família, não um esquecimento
 * >
 * > Medido em 11/08/2026, contra o banco de dev:
 * >
 * > | | |
 * > |---|---|
 * > | `Webhook.eventCount` | **0 nos dois** — com 43 e 14 `Sale` apontando para eles |
 * > | `Webhook.lastEventAt` | **NULO nos dois** |
 * > | `Webhook.secret` | **NULO nos dois** — e a Kirvano é `exigir: true` |
 * > | gateways distintos | **1** (só Kirvano) |
 * >
 * > Quem escreve `eventCount`/`lastEventAt` em produção é `gateways/receber.ts`
 * > (`aoConcluir`), e o seed insere `Sale` direto — então o contador nunca subia.
 * > A tela mostrava `0 vendas recebidas` sobre o webhook que mais recebeu.
 *
 * ## ⛔ E o estado era INVÁLIDO, não só incompleto
 *
 * Webhook da Kirvano **sem chave** é uma configuração que não pode receber nada:
 * `autenticar()` devolve 401 em toda venda. Os **25 `WebhookLog` REJEITADO** do
 * dev são exatamente isso. Ou seja: o único banco em que dá para olhar tinha
 * 100% dos webhooks num estado de erro, e **nenhum** no estado normal.
 *
 * ## Os estados que este script torna visíveis
 *
 * | Estado | Onde |
 * |---|---|
 * | **`recebendo`** | webhook `[0]` — ganha chave e a data da última venda real |
 * | **`recusando`** | webhook `[1]` — segue sem chave, DE PROPÓSITO |
 * | **`mudo`** | o webhook da Cakto — última venda além do corte de inatividade |
 * | **`esperando`** | nenhum aqui; é o estado de quem acabou de conectar |
 *
 * E o da Cakto cobre duas coisas que **nunca foram vistas na tela**: a segunda
 * forma de URL (`/api/webhook/sale/<token>`, contra o `?id=` legado da Kirvano)
 * e a exibição da chave que **nós** geramos (`geradoPorNos`).
 *
 * ## Uso
 *
 *   npm run dev:webhook          # aplica no banco de dev que o .env aponta
 *
 * É **idempotente**: os contadores são DERIVADOS das vendas a cada execução, e o
 * webhook da Cakto é procurado antes de ser criado.
 *
 * ⚠️ Ele não inventa número: `eventCount` e `lastEventAt` saem de um `SELECT`
 * sobre as `Sale` que já apontam para cada webhook. Um valor cravado aqui faria
 * a tela e a lista de vendas discordarem — duas telas contando histórias
 * diferentes sobre o mesmo webhook.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

const MARCA = "[DEV]";
const id = () => "d" + randomUUID().replace(/-/g, "").slice(0, 24);

/** Além disto, `estadoDoWebhook` chama de `mudo`. Ver `lib/webhooks/estado.ts`. */
const DIAS_PARA_MUDO = 45;

/**
 * O que cada webhook do seed ganha, por POSIÇÃO na ordem de criação.
 *
 * ⚠️ Por posição, e não por nome: o nome carrega o nome da oferta e mudaria
 * junto com ele.
 */
const PLANO = [
  /* [0] — o estado NORMAL, que não existia no dev. */
  { chave: "tok-seguranca-kirvano-dev-1" },
  /* [1] — 🔴 SEGUE SEM CHAVE, de propósito. É o estado `recusando`, e ele é o
     que a tela antiga escondia atrás de um selo verde de "Ativado". Dar chave
     aos dois apagaria da vista o defeito mais caro desta tela. */
  { chave: null },
];

export async function completarWebhooks(q, userId) {
  const { rows: webhooks } = await q(
    `SELECT id, name FROM "Webhook" WHERE "userId" = $1 AND name LIKE $2 AND platform = 'KIRVANO' ORDER BY "createdAt"`,
    [userId, `${MARCA}%`],
  );
  const feito = [];

  for (let i = 0; i < webhooks.length; i++) {
    const plano = PLANO[i % PLANO.length];
    const w = webhooks[i];

    /* ⛔ DERIVADO das vendas, nunca cravado. É o mesmo número que a lista de
       vendas mostra — se divergissem, duas telas contariam histórias
       diferentes sobre o mesmo webhook e ninguém saberia qual acreditar. */
    const { rows: agg } = await q(
      `SELECT COUNT(*)::int AS n, MAX(timestamp) AS ultimo FROM "Sale" WHERE "webhookId" = $1`,
      [w.id],
    );
    const { n, ultimo } = agg[0];

    await q(`UPDATE "Webhook" SET "eventCount" = $2, "lastEventAt" = $3, secret = $4 WHERE id = $1`, [
      w.id,
      n,
      ultimo,
      plano.chave,
    ]);

    feito.push({
      webhook: w.name,
      gateway: "Kirvano",
      vendas: n,
      "última venda": ultimo ? new Date(ultimo).toISOString().slice(0, 10) : "—",
      chave: plano.chave ? "configurada" : "🔴 FALTANDO (de propósito)",
    });
  }

  /* ── A Cakto: o segundo gateway, e as duas coisas que ele exercita ──────── */
  const { rows: existe } = await q(
    `SELECT id FROM "Webhook" WHERE "userId" = $1 AND platform = 'CAKTO' AND name LIKE $2`,
    [userId, `${MARCA}%`],
  );

  const mudo = new Date(Date.now() - DIAS_PARA_MUDO * 86_400_000);
  const nomeCakto = `${MARCA} Cakto — Oferta Encerrada`;

  if (existe[0]) {
    await q(`UPDATE "Webhook" SET "lastEventAt" = $2, "eventCount" = 7 WHERE id = $1`, [existe[0].id, mudo]);
  } else {
    await q(
      `INSERT INTO "Webhook" ("id","userId","name","platform","token","secret","eventCount","lastEventAt","updatedAt")
       VALUES ($1,$2,$3,'CAKTO',$4,$5,7,$6,now())`,
      [id(), userId, nomeCakto, randomUUID(), "chave-que-nos-geramos-dev", mudo],
    );
  }

  feito.push({
    webhook: nomeCakto,
    gateway: "Cakto",
    vendas: 7,
    "última venda": mudo.toISOString().slice(0, 10),
    chave: "gerada por nós",
  });

  return feito;
}

/**
 * ⛔ IMPRIME O QUE GEROU, e alguém LÊ.
 *
 * Foi a saída de um script assim que denunciou o BOLETO com 100% de aprovação.
 * Um gerador silencioso produz o estado que ninguém confere.
 */
export function imprimir(feito) {
  if (!feito.length) {
    console.log("\n⚠️  Nenhum Webhook [DEV] encontrado — nada a completar.\n");
    return;
  }
  console.table(feito);
  console.log(
    "\nO que abrir para conferir, na tela de Webhooks:\n" +
      "  • o primeiro webhook sai de `0 vendas recebidas` e vira `recebendo`\n" +
      "  • o segundo SEGUE em `recusando vendas` — é o defeito que a tela agora mostra\n" +
      "  • a Cakto aparece `sem vendas há N dias` (`mudo`), com a URL `/api/webhook/sale/…`\n" +
      "    — a outra forma de endereço, que o `?id=` da Kirvano não exercita\n" +
      "  • e a Cakto é a única que mostra a CHAVE, porque ela é gerada por nós\n",
  );
}

// ── Execução avulsa ─────────────────────────────────────────────────────────
/* ⚠️ `pathToFileURL`, e não interpolação à mão: no Windows o Node usa
   `file:///C:/...` — três barras — e a comparação montada à mão dava falso. O
   script saía sem imprimir nada e com código 0, indistinguível de "rodou e não
   havia o que fazer". */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  exigirBancoDeDesenvolvimento({ script: "webhook-dev" });

  const cliente = new pg.Client({
    connectionString: (process.env.DATABASE_URL ?? "").split("?")[0],
    ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await cliente.connect();
  const q = (sql, params = []) => cliente.query(sql, params);

  const { rows } = await q(`SELECT id FROM "User" WHERE email = $1`, ["dev@exemplo.dev"]);
  if (!rows[0]) {
    console.log("\n⚠️  Usuário dev@exemplo.dev não existe. Rode `npm run seed:dev` antes.\n");
    await cliente.end();
    process.exit(1);
  }

  imprimir(await completarWebhooks(q, rows[0].id));
  await cliente.end();
}
