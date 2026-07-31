/**
 * A venda guarda a própria procedência?
 *
 * ## As três coisas que este teste prova, e por que cada uma
 *
 * | # | O quê | O modo de falha que ele pega |
 * |---|---|---|
 * | 1 | `utmsDaVenda` respeita a precedência | inverter a ordem faria a cópia (fria) vencer o clique (fonte) |
 * | 2 | **`matchClick` DEVOLVE os UTMs** | a armadilha do `pedidoId`: campo fora do `select` chega `undefined`, a venda nasce sem campanha e **nenhum `tsc`/`lint`/`build` acusa** |
 * | 3 | O `UPDATE` do backfill acha as linhas certas | consulta de manutenção que nunca rodou contra linha de verdade é o 4º caso do PROCEDIMENTO |
 *
 * O caso 2 é o que justifica um teste de banco em vez de um teste puro. A função
 * pura estaria certa nos dois mundos; o que quebra é o CAMINHO.
 *
 * ## Escreve no banco de DESENVOLVIMENTO, e limpa por id
 *
 * Passa pelo `guard-db.mjs`. Todo id é coletado na criação e removido no fim —
 * nunca por `LIKE`, nunca por nome.
 *
 *   npm run test:utm-venda
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";

import { utmsDaVenda } from "@/lib/vendas/utmsDaVenda";
import { matchClick } from "@/lib/webhook/matchClick";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "teste-utm-venda" });

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  // ⚠️ Comparação por JSON, não por `===`: quase toda asserção aqui devolve
  // objeto, e `===` compararia identidade de referência — o bug que produziu 29
  // falsos negativos no `teste-analise-regra`, imprimindo dois valores iguais.
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${a}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${a}\n      esperado: ${b}`);
  }
}

const UTMS_CLIQUE = {
  utmSource: "facebook",
  utmMedium: "cpc",
  utmCampaign: "Campanha do Clique|120210",
  utmContent: "Criativo A|238001",
  utmTerm: null,
  fbclid: "FBCLID_DO_CLIQUE",
};

// ───────────────────────── 1. Precedência (puro) ─────────────────────────

console.log("\n\x1b[1m1. Precedência de leitura — a cadeia Sale → Click vence a cópia\x1b[0m\n");

const copia = { ...UTMS_CLIQUE, utmCampaign: "Campanha da Copia|999", utmContent: "Criativo B|888" };

eq(
  "clique presente vence a cópia",
  utmsDaVenda({ ...copia, click: UTMS_CLIQUE }).utms.utmCampaign,
  "Campanha do Clique|120210",
);
eq("e a fonte diz de onde veio", utmsDaVenda({ ...copia, click: UTMS_CLIQUE }).fonte, "clique");
eq(
  "NUNCA mescla: o criativo também vem do clique",
  utmsDaVenda({ ...copia, click: UTMS_CLIQUE }).utms.utmContent,
  "Criativo A|238001",
);
eq("clique apagado cai na cópia", utmsDaVenda({ ...copia, click: null }).fonte, "copia");
eq(
  "e a cópia responde a campanha",
  utmsDaVenda({ ...copia, click: null }).utms.utmCampaign,
  "Campanha da Copia|999",
);
eq(
  "clique de tráfego direto não cala a cópia",
  utmsDaVenda({ ...copia, click: { utmCampaign: null, fbclid: null } }).fonte,
  "copia",
);
eq("sem clique e sem cópia → nenhuma", utmsDaVenda({ click: null }).fonte, "nenhuma");
eq("e devolve tudo nulo, nunca undefined", utmsDaVenda({ click: null }).utms, {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  fbclid: null,
});

// ───────────────────────── Banco de desenvolvimento ─────────────────────────

await cliente.connect();

const criados = { user: null, clicks: [], sales: [] };

async function limpar() {
  if (criados.sales.length) {
    await cliente.query(`DELETE FROM "Sale" WHERE id = ANY($1::text[])`, [criados.sales]);
  }
  if (criados.clicks.length) {
    await cliente.query(`DELETE FROM "Click" WHERE id = ANY($1::text[])`, [criados.clicks]);
  }
  if (criados.user) await cliente.query(`DELETE FROM "User" WHERE id = $1`, [criados.user]);
}

try {
  const userId = `tst_utm_${randomUUID().slice(0, 8)}`;
  await cliente.query(
    `INSERT INTO "User" (id, email, name, "passwordHash", "createdAt", "updatedAt")
     VALUES ($1, $2, 'Teste UTM', 'x', now(), now())`,
    [userId, `${userId}@teste.local`],
  );
  criados.user = userId;

  /** Cria um clique e devolve `{ id, publico }`. */
  async function criarClique({ utms = UTMS_CLIQUE, ip = null, pais = "BR", bot = false } = {}) {
    const id = `clk_${randomUUID().slice(0, 12)}`;
    const publico = randomUUID();
    await cliente.query(
      `INSERT INTO "Click" (id, "clickId", "userId", "utmSource", "utmMedium", "utmCampaign",
                            "utmContent", "utmTerm", "fbclid", ip, country, "countrySource", bot, "timestamp")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ip',$12, now())`,
      [id, publico, userId, utms.utmSource, utms.utmMedium, utms.utmCampaign,
       utms.utmContent, utms.utmTerm, utms.fbclid, ip, pais, bot],
    );
    criados.clicks.push(id);
    return { id, publico };
  }

  async function criarVenda({ clickId = null, utms = null, pais = "BR", fonte = "payload" } = {}) {
    const id = `sal_${randomUUID().slice(0, 12)}`;
    await cliente.query(
      `INSERT INTO "Sale" (id, "userId", "clickId", value, currency, product, status,
                           "paymentMethod", country, "countrySource",
                           "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm", "fbclid",
                           "timestamp", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,100,'BRL','Produto de teste','APROVADA','PIX',$4,$5,
               $6,$7,$8,$9,$10,$11, now(), now(), now())`,
      [id, userId, clickId, pais, fonte,
       utms?.utmSource ?? null, utms?.utmMedium ?? null, utms?.utmCampaign ?? null,
       utms?.utmContent ?? null, utms?.utmTerm ?? null, utms?.fbclid ?? null],
    );
    criados.sales.push(id);
    return id;
  }

  // ───────── 2. matchClick devolve os UTMs (a armadilha do `select`) ─────────

  console.log("\n\x1b[1m2. matchClick traz os UTMs — o campo fora do select falha em silêncio\x1b[0m\n");

  const direto = await criarClique();
  const porIp = await criarClique({ ip: "203.0.113.77" });

  const m1 = await matchClick(userId, direto.publico, null, null);
  eq("match por click_id: método", m1.method, "direct");
  eq("match por click_id: UTMs", m1.utms, UTMS_CLIQUE);

  const m2 = await matchClick(userId, null, null, `fb.1.1700000000000.${UTMS_CLIQUE.fbclid}`);
  eq("match por fbc→fbclid: método", m2.method, "fbclid");
  eq("match por fbc→fbclid: traz a campanha", m2.utms?.utmCampaign, UTMS_CLIQUE.utmCampaign);

  const m3 = await matchClick(userId, null, "203.0.113.77", null);
  eq("match por IP: casa o clique certo", m3.clickId, porIp.id);
  eq("match por IP: traz o criativo", m3.utms?.utmContent, UTMS_CLIQUE.utmContent);

  // Sem isto, um `select` que devolvesse UTMs de qualquer clique passaria acima.
  const m4 = await matchClick(userId, null, "198.51.100.9", null);
  eq("sem match: método", m4.method, "none");
  eq("sem match: utms nulo, nunca objeto vazio", m4.utms, null);

  // ───────── 3. O UPDATE do backfill, contra linhas de verdade ─────────

  console.log("\n\x1b[1m3. O UPDATE do backfill — a consulta rodando contra linha real\x1b[0m\n");

  const cliqueDireto = await criarClique({
    utms: { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, fbclid: null },
  });

  const vGanha = await criarVenda({ clickId: direto.id });
  const vSemClique = await criarVenda({ clickId: null });
  const vJaTem = await criarVenda({
    clickId: porIp.id,
    utms: { ...UTMS_CLIQUE, utmCampaign: "Ja Estava Aqui|1" },
  });
  const vTrafegoDireto = await criarVenda({ clickId: cliqueDireto.id });

  // As MESMAS cláusulas do `backfill-utms.mjs`, duplicadas de propósito: se este
  // teste importasse o script, um bug no `where` passaria por "tudo certo".
  const SEM_COPIA = `s."utmSource" IS NULL AND s."utmMedium" IS NULL AND s."utmCampaign" IS NULL
                     AND s."utmContent" IS NULL AND s."utmTerm" IS NULL AND s."fbclid" IS NULL`;
  const CLIQUE_UTIL = `(c."utmSource" IS NOT NULL OR c."utmMedium" IS NOT NULL OR c."utmCampaign" IS NOT NULL
                        OR c."utmContent" IS NOT NULL OR c."utmTerm" IS NOT NULL OR c."fbclid" IS NOT NULL)`;

  const paisAntes = new Map(
    (await cliente.query(`SELECT id, country, "countrySource" FROM "Sale" WHERE "userId" = $1`, [userId]))
      .rows.map((r) => [r.id, `${r.country}/${r.countrySource}`]),
  );

  // ⚠️ `userId` no WHERE, sempre — nunca varre a tabela inteira.
  const backfill = () =>
    cliente.query(
      `UPDATE "Sale" s SET
           "utmSource"   = c."utmSource",
           "utmMedium"   = c."utmMedium",
           "utmCampaign" = c."utmCampaign",
           "utmContent"  = c."utmContent",
           "utmTerm"     = c."utmTerm",
           "fbclid"      = c."fbclid"
         FROM "Click" c
        WHERE c.id = s."clickId" AND s."userId" = $1 AND ${SEM_COPIA} AND ${CLIQUE_UTIL}`,
      [userId],
    );

  const r1 = await backfill();
  eq("toca só a venda que tinha o que copiar", r1.rowCount, 1);

  const lido = async (id) =>
    (await cliente.query(`SELECT "utmCampaign", "utmContent", "fbclid" FROM "Sale" WHERE id = $1`, [id])).rows[0];

  eq("venda com clique ganhou a campanha", (await lido(vGanha)).utmCampaign, UTMS_CLIQUE.utmCampaign);
  eq("e o criativo", (await lido(vGanha)).utmContent, UTMS_CLIQUE.utmContent);
  eq("e o fbclid do NOSSO script", (await lido(vGanha)).fbclid, UTMS_CLIQUE.fbclid);
  eq("venda sem clique continua sem campanha", (await lido(vSemClique)).utmCampaign, null);
  eq("venda que já tinha cópia não foi tocada", (await lido(vJaTem)).utmCampaign, "Ja Estava Aqui|1");
  eq("clique de tráfego direto não é selecionado", (await lido(vTrafegoDireto)).utmCampaign, null);

  // A restrição que o usuário pediu: MEDIDA, não prometida.
  const paisDepois = (
    await cliente.query(`SELECT id, country, "countrySource" FROM "Sale" WHERE "userId" = $1`, [userId])
  ).rows;
  const mudaram = paisDepois.filter((r) => paisAntes.get(r.id) !== `${r.country}/${r.countrySource}`);
  eq("country/countrySource intactos em todas as vendas", mudaram.length, 0);

  const r2 = await backfill();
  eq("2ª passada não toca em nada (idempotente)", r2.rowCount, 0);
} finally {
  await limpar();
  await cliente.end();
}

console.log(`\n\x1b[1m${ok} asserções, ${falhas} falha(s)\x1b[0m\n`);
process.exit(falhas === 0 ? 0 : 1);
