/**
 * O checkout duplicado da mesma jornada — reproduzido e fechado.
 *
 * ## O que foi relatado em 05/08/2026
 *
 * ```
 *   Venda pendente · Direto · R$ 92,81 · 31s
 *   Checkout · Gateway · 31s
 *   Checkout · Pixel · sigmatools.shop/ · 2min
 *   Clique · Direto · 2min
 * ```
 *
 * Dois checkouts para a MESMA jornada: um do `px.js` (no clique no botão) e um do
 * webhook (quando o PIX foi gerado).
 *
 * ## A causa: `fbclid` era a chave, e ela não existe em tráfego direto
 *
 * A dedup existia em dois lugares e **os dois chaveavam em `fbclid`**:
 *
 * | Onde | Como era |
 * |---|---|
 * | `checkoutEvent.ts` | `if (fbclid) { ...procura o evento do navegador... }` |
 * | `metrics.ts` (funil) | chave `fbclid \|\| eventId \|\| row:id` |
 *
 * O clique relatado é **Direto** — não veio de anúncio, logo sem `fbclid`. No
 * primeiro, o bloco inteiro era pulado. No segundo, a chave caía no `eventId`,
 * que é `InitiateCheckout-<hash>` no navegador e `gw:<pedido>` no gateway —
 * **diferentes por construção**. Não era janela curta demais: era chave ausente.
 *
 * ## O que este teste prova
 *
 * Que duplicar deixou de ser possível **por estrutura**, nas DUAS ordens de
 * chegada, e sem depender de `fbclid`. E o controle: checkout de jornadas
 * diferentes continua contando separado — senão a "correção" seria fundir
 * visitantes, que é pior que duplicar.
 *
 * Escreve no banco de DESENVOLVIMENTO e limpa por id.
 *
 *   npm run test:checkout-jornada
 */
import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "teste-checkout-jornada" });

const { registrarCheckoutDoGateway } = await import("../src/lib/webhook/checkoutEvent.ts");
const { marcarCheckoutDaJornada } = await import("../src/lib/funil/checkoutDaJornada.ts");
const { computeDashboard } = await import("../src/lib/dashboard/metrics.ts");

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
const userId = id("jrn");
const wsId = id("jrn");

/** Clique SEM fbclid — é o tráfego direto do caso relatado. */
async function criarClique() {
  const cid = id("jrn-clk");
  await q(
    `INSERT INTO "Click"(id,"clickId","userId","utmSource",bot,"timestamp")
     VALUES($1,$2,$3,NULL,false,now())`,
    [cid, crypto.randomUUID(), userId],
  );
  return cid;
}

async function criarVendaPendente(clickId, valor) {
  const sid = id("jrn-sal");
  await q(
    `INSERT INTO "Sale"(id,"userId","externalId","pedidoId",value,currency,product,status,
                        "paymentMethod","clickId","timestamp","createdAt","updatedAt")
     VALUES($1,$2,$3,$4,$5,'BRL','Produto','PENDENTE','PIX',$6,now(),now(),now())`,
    [sid, userId, sid, `ped-${sid}`, valor, clickId],
  );
  return sid;
}

const checkoutDoClique = async (cid) =>
  (await q(`SELECT "checkoutAt","checkoutSource" FROM "Click" WHERE id=$1`, [cid])).rows[0];

const eventosDoUsuario = async () =>
  (await q(`SELECT count(*)::int AS n FROM "PixelEvent" WHERE "userId"=$1 AND event='InitiateCheckout'`, [userId]))
    .rows[0].n;

const painel = async () =>
  await computeDashboard(userId, {
    period: "hoje", account: "todas", product: "todos", source: "todas", workspaceId: wsId,
  });
const funil = async () => (await painel()).funnel;
/** Linhas de checkout no feed de Atividade Recente — o sintoma que o usuário VIU. */
const checkoutsNoFeed = async () => (await painel()).activity.filter((i) => i.type === "checkout");

try {
  await q(`INSERT INTO "User"(id,email,name,"passwordHash",timezone,"updatedAt")
           VALUES($1,$2,'Jornada','x','America/Sao_Paulo',now())`, [userId, `${userId}@t.local`]);
  await q(`INSERT INTO "Workspace"(id,"userId",name,"isDefault","updatedAt")
           VALUES($1,$2,'Principal',true,now())`, [wsId, userId]);

  // ─────── 1. O caso relatado: navegador primeiro, gateway depois ───────

  console.log("\n\x1b[1m1. Navegador → gateway (a ordem do caso relatado)\x1b[0m\n");

  const c1 = await criarClique();
  await marcarCheckoutDaJornada(c1, new Date(), "navegador");

  await checar("o clique do navegador marcou a jornada", async () => {
    const r = await checkoutDoClique(c1);
    assert.ok(r.checkoutAt, "checkoutAt vazio");
    assert.equal(r.checkoutSource, "navegador");
  });

  const s1 = await criarVendaPendente(c1, 92.81);
  const v1 = await registrarCheckoutDoGateway(s1, true);

  await checar("o gateway reconhece a duplicata — SEM depender de fbclid", async () => {
    assert.equal(v1, "duplicado", `veredicto ${v1}`);
  });

  await checar("e NÃO criou PixelEvent nenhum", async () => {
    assert.equal(await eventosDoUsuario(), 0, "o gateway criou evento apesar da jornada marcada");
  });

  await checar("o funil conta 1 checkout, não 2 (era o bug)", async () => {
    const f = await funil();
    assert.equal(f.checkouts, 1, `veio ${f.checkouts}`);
  });

  await checar("a fonte continua 'navegador' — o gateway não sobrescreveu", async () => {
    assert.equal((await checkoutDoClique(c1)).checkoutSource, "navegador");
  });

  await checar("o FEED mostra UMA linha de checkout, não duas", async () => {
    // O sintoma relatado era visual: duas linhas "Checkout" na Atividade
    // Recente, uma "Gateway" e uma "Pixel". Consertar só a contagem do funil
    // resolveria o número e deixaria o sintoma na tela.
    const linhas = await checkoutsNoFeed();
    assert.equal(linhas.length, 1, `veio ${linhas.length}: ${JSON.stringify(linhas.map((l) => l.source))}`);
    assert.equal(linhas[0].source, "Pixel", "a linha deveria creditar quem detectou primeiro");
  });

  // ─────── 2. A ordem INVERSA precisa convergir para o mesmo lugar ───────

  console.log("\n\x1b[1m2. Gateway → navegador (ordem inversa: tem de convergir)\x1b[0m\n");

  const c2 = await criarClique();
  const s2 = await criarVendaPendente(c2, 50);
  const v2 = await registrarCheckoutDoGateway(s2, true);

  await checar("sem ninguém antes, o gateway marca a jornada", async () => {
    assert.equal(v2, "criado", `veredicto ${v2}`);
    assert.equal((await checkoutDoClique(c2)).checkoutSource, "gateway");
  });

  // O navegador chega depois, com um instante ANTERIOR (o clique no botão de
  // compra aconteceu antes de o gateway gerar o PIX).
  const antes = new Date(Date.now() - 5 * 60 * 1000);
  await marcarCheckoutDaJornada(c2, antes, "navegador");

  await checar("vence o instante MAIS ANTIGO — a etapa não anda para a frente", async () => {
    const r = await checkoutDoClique(c2);
    assert.equal(r.checkoutSource, "navegador", "a fonte não acompanhou o instante");
    /**
     * ⚠️ A comparação é feita PELO POSTGRES, não em JS.
     *
     * `checkoutAt` é `TIMESTAMP(3)` **sem** fuso, guardando UTC — e o driver `pg`
     * devolve isso como um `Date` interpretado no fuso LOCAL. Comparar com um
     * `Date` do Node erra por 3h em Brasília, e a primeira versão desta asserção
     * falhou exatamente assim: o valor no banco estava certo e o teste dizia que
     * não. Asserção que falha por um motivo alheio ao que ela mede é pior que
     * asserção nenhuma.
     *
     * A propriedade que importa é uma RELAÇÃO, e o banco sabe compará-la:
     * o checkout ficou ANTES da venda que o gateway registrou.
     */
    const { rows } = await q(
      `SELECT c."checkoutAt" < s."timestamp" AS antes_da_venda,
              EXTRACT(EPOCH FROM (s."timestamp" - c."checkoutAt"))::int AS segundos
         FROM "Click" c JOIN "Sale" s ON s."clickId" = c.id
        WHERE c.id = $1`,
      [c2],
    );
    assert.equal(rows[0].antes_da_venda, true, "o checkout não é anterior à venda");
    assert.ok(rows[0].segundos >= 280, `só ${rows[0].segundos}s de diferença — o instante do clique não venceu`);
  });

  await checar("continua UM checkout nesta jornada", async () => {
    const f = await funil();
    assert.equal(f.checkouts, 2, `2 jornadas com checkout, veio ${f.checkouts}`);
  });

  // ─────── 3. CONTROLE: jornadas diferentes NÃO podem fundir ───────

  console.log("\n\x1b[1m3. CONTROLE — a correção não pode fundir visitantes\x1b[0m\n");

  const c3 = await criarClique();
  await marcarCheckoutDaJornada(c3, new Date(), "navegador");

  await checar("terceira jornada com checkout → o funil vai a 3", async () => {
    // Sem este controle, um teste em que tudo colapsa para 1 passaria igual —
    // e fundir visitantes é pior que duplicar.
    const f = await funil();
    assert.equal(f.checkouts, 3, `veio ${f.checkouts}`);
  });

  await checar("marcar a MESMA jornada de novo não soma", async () => {
    await marcarCheckoutDaJornada(c3, new Date(), "navegador");
    const f = await funil();
    assert.equal(f.checkouts, 3, `veio ${f.checkouts}`);
  });

  // ─────── 4. Venda SEM jornada casada precisa continuar contando ───────

  console.log("\n\x1b[1m4. Venda sem jornada: o checkout não pode desaparecer\x1b[0m\n");

  const s4 = await criarVendaPendente(null, 30);
  const v4 = await registrarCheckoutDoGateway(s4, true);

  await checar("sem clique casado, cai no PixelEvent (gw:<pedido>)", async () => {
    assert.equal(v4, "criado", `veredicto ${v4}`);
    assert.equal(await eventosDoUsuario(), 1);
  });

  await checar("e ENTRA no funil — 3 jornadas + 1 sem jornada = 4", async () => {
    // As duas populações são disjuntas e somadas de propósito: sem isto, o
    // checkout de quem não é rastreável desapareceria do relatório.
    const f = await funil();
    assert.equal(f.checkouts, 4, `veio ${f.checkouts}`);
  });

  await checar("a reentrega do gateway não vira checkout novo", async () => {
    const v = await registrarCheckoutDoGateway(s4, true);
    assert.equal(v, "duplicado", `veredicto ${v}`);
    assert.equal((await funil()).checkouts, 4);
  });
} finally {
  await q(`DELETE FROM "PixelEvent" WHERE "userId"=$1`, [userId]);
  await q(`DELETE FROM "Sale" WHERE "userId"=$1`, [userId]);
  await q(`DELETE FROM "Click" WHERE "userId"=$1`, [userId]);
  await q(`UPDATE "User" SET "lastWorkspaceId"=NULL WHERE id=$1`, [userId]);
  await q(`DELETE FROM "Workspace" WHERE "userId"=$1`, [userId]);
  await q(`DELETE FROM "User" WHERE id=$1`, [userId]);
  await cliente.end();
}

console.log(`\n\x1b[1m${ok} asserções, ${falhas.length} falha(s)\x1b[0m\n`);
if (falhas.length) console.log("Falharam:\n  - " + falhas.join("\n  - ") + "\n");
process.exit(falhas.length === 0 ? 0 : 1);
