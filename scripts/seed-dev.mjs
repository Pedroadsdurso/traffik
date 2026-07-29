/**
 * Popula um banco de DESENVOLVIMENTO com dados sintéticos.
 *
 * ⛔ **Nunca copia dado real.** Nada aqui lê da produção: todos os nomes,
 * e-mails, produtos e valores são inventados no próprio arquivo. Copiar um dump
 * da produção para o dev resolveria o "dados realistas" e criaria dois
 * problemas piores — dado pessoal de comprador espalhado por máquina de
 * desenvolvimento, e tokens de API válidos fora do lugar.
 *
 * Uso:
 *   DATABASE_URL=<banco de dev> node scripts/seed-dev.mjs
 *   DATABASE_URL=<banco de dev> node scripts/seed-dev.mjs --limpar
 *
 * Tudo o que ele cria leva o prefixo `[DEV]` no nome e o domínio `@exemplo.dev`
 * nos e-mails, então `--limpar` remove exatamente o que ele criou e nada mais.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";
import bcrypt from "bcryptjs";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "seed-dev" });

const MARCA = "[DEV]";
const EMAIL = "dev@exemplo.dev";
const SENHA = "dev123456";

const cliente = new pg.Client({
  connectionString: (process.env.DATABASE_URL ?? "").split("?")[0],
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});
const id = () => "d" + randomUUID().replace(/-/g, "").slice(0, 24);
const q = (sql, params = []) => cliente.query(sql, params);

async function limpar() {
  // Apagar o usuário derruba tudo por cascade — é o jeito de não deixar sobra.
  const { rowCount } = await q(`DELETE FROM "User" WHERE "email" = $1`, [EMAIL]);
  console.log(rowCount ? `Usuário de desenvolvimento removido (cascade).` : "Nada para limpar.");
}

async function main() {
  await cliente.connect();
  await limpar();
  if (process.argv.includes("--limpar")) return;

  const userId = id();
  await q(
    `INSERT INTO "User" ("id","email","name","passwordHash","timezone","updatedAt")
     VALUES ($1,$2,$3,$4,'America/Sao_Paulo',now())`,
    [userId, EMAIL, `${MARCA} Operador`, await bcrypt.hash(SENHA, 10)],
  );

  const perfil = id();
  await q(
    `INSERT INTO "AdProfile" ("id","userId","name","fbUserId","accessToken","connectedAt","updatedAt")
     VALUES ($1,$2,$3,$4,'token-falso',now(),now())`,
    [perfil, userId, `${MARCA} Perfil Meta`, `fb-dev-${randomUUID().slice(0, 8)}`],
  );

  const ofertas = [
    { suf: "A", conta: "Oferta Emagrecimento", produto: "Protocolo 21 Dias", ticket: 197, vendas: 6, gasto: 420 },
    { suf: "B", conta: "Oferta Renda Extra", produto: "Mentoria Alta Renda", ticket: 997, vendas: 2, gasto: 380 },
  ];

  for (const o of ofertas) {
    const conta = id(), camp = id(), conj = id(), anuncio = id(), hook = id(), pixel = id();
    const campNome = `${MARCA} ${o.conta} — Campanha`, campFb = `camp-dev-${o.suf}`;

    await q(`INSERT INTO "AdAccount" ("id","userId","adProfileId","fbAccountId","name","updatedAt") VALUES ($1,$2,$3,$4,$5,now())`,
      [conta, userId, perfil, `act_dev_${o.suf}`, `${MARCA} ${o.conta}`]);
    await q(`INSERT INTO "Campaign" ("id","adAccountId","fbCampaignId","name","updatedAt") VALUES ($1,$2,$3,$4,now())`,
      [camp, conta, campFb, campNome]);
    await q(`INSERT INTO "AdSet" ("id","adAccountId","campaignId","fbAdSetId","name","updatedAt") VALUES ($1,$2,$3,$4,$5,now())`,
      [conj, conta, camp, `set-dev-${o.suf}`, `${MARCA} Conjunto ${o.suf}`]);
    await q(`INSERT INTO "Ad" ("id","adAccountId","adSetId","campaignId","fbAdId","name","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())`,
      [anuncio, conta, conj, camp, `ad-dev-${o.suf}`, `${MARCA} Criativo ${o.suf}`]);
    // A data é a de HOJE no fuso do usuário, não `CURRENT_DATE` (que é UTC no
    // servidor): `DailyAdMetric.date` é dia de calendário e um dia adiantado
    // some da janela do dashboard. Ver a seção de fuso horário no CLAUDE.md.
    await q(
      `INSERT INTO "DailyAdMetric" ("id","adId","date","spend","impressions","clicks","updatedAt")
       VALUES ($1,$2,(now() AT TIME ZONE 'America/Sao_Paulo')::date,$3,$4,$5,now())`,
      [id(), anuncio, o.gasto, 24000, 610],
    );

    await q(`INSERT INTO "Webhook" ("id","userId","name","platform","token","updatedAt") VALUES ($1,$2,$3,'KIRVANO',$4,now())`,
      [hook, userId, `${MARCA} Kirvano — ${o.conta}`, randomUUID()]);
    await q(`INSERT INTO "PixelConfig" ("id","userId","name","updatedAt") VALUES ($1,$2,$3,now())`,
      [pixel, userId, `${MARCA} Pixel — ${o.conta}`]);

    for (let n = 0; n < o.vendas; n++) {
      const clique = id(), fbclid = `dev-${o.suf}-${n}`;
      const quando = new Date(Date.now() - (n + 1) * 90 * 60 * 1000);
      await q(`INSERT INTO "Click" ("id","clickId","userId","fbclid","utmSource","utmCampaign","timestamp") VALUES ($1,$1,$2,$3,'facebook',$4,$5)`,
        [clique, userId, fbclid, `${campNome}|${campFb}`, quando]);
      await q(
        `INSERT INTO "Sale" ("id","userId","clickId","webhookId","externalId","product","value","status","paymentMethod","buyerEmail","country","timestamp","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PIX',$9,'BR',$10,now())`,
        [id(), userId, clique, hook, `dev-${o.suf}-${n}`, `${MARCA} ${o.produto}`, o.ticket,
         n % 4 === 3 ? "PENDENTE" : "APROVADA", `comprador${n}@exemplo.dev`, quando],
      );
      await q(
        `INSERT INTO "PixelEvent" ("id","userId","event","eventId","url","fbclid","pixelConfigId","timestamp")
         VALUES ($1,$2,'InitiateCheckout',$3,'https://exemplo.dev/checkout',$4,$5,$6)`,
        [id(), userId, `ic-dev-${o.suf}-${n}`, fbclid, pixel, quando],
      );
    }
  }

  console.log(
    `\n✓ Banco de desenvolvimento populado.\n` +
      `  Login: ${EMAIL} / ${SENHA}\n` +
      `  2 contas de anúncio, 2 webhooks, 2 pixels, 8 vendas, 8 eventos de pixel.\n` +
      `  A área Principal é criada sozinha no primeiro carregamento do painel.\n`,
  );
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => cliente.end());
