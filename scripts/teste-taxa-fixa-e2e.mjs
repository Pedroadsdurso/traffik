/**
 * PONTA A PONTA contra o banco de DEV: taxa fixa por pedido, gasto na série
 * horária e o instante do InitiateCheckout.
 *
 * ## Por que ponta a ponta, e não só o teste puro
 *
 * `npm run test:financeiro` prova que `calcularFinanceiro` está certa. Ele não
 * prova que ela é CHAMADA com os dados certos — e é exatamente aí que este
 * projeto já se enganou três vezes na mesma etapa, sempre com número plausível:
 *
 * | Armadilha | O que produzia |
 * |---|---|
 * | `pedidoId` fora do `select` | `chaveDoPedido` cai no `id` e tudo volta a ser por ITEM |
 * | `umPorPedido` num laço que soma | contagem certa, faturamento do bump descartado |
 * | `Set` de pedidos global | a 2ª atribuição da mesma venda é descartada |
 *
 * Nenhuma delas é acusada por `tsc`, `lint` ou `build`. Só ler o número no fim
 * da cadeia acusa.
 *
 * Escreve no banco de DEV (passa pelo `guard-db`) e apaga tudo por id no fim.
 */
import "dotenv/config";
import pg from "pg";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";
import { computeDashboard } from "@/lib/dashboard/metrics";
import { registrarCheckoutDoGateway } from "@/lib/webhook/checkoutEvent";

exigirBancoDeDesenvolvimento();

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a === b) { ok++; console.log(`  \x1b[32mok\x1b[0m  ${nome} — ${a}`); }
  else { falhas++; console.log(`  \x1b[31mFALHA\x1b[0m  ${nome}\n        obtido:   ${a}\n        esperado: ${b}`); }
}

const c = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});

/** Tudo o que este teste criou, para apagar no fim — por ID, nunca por nome. */
const lixo = { Sale: [], Expense: [], PixelEvent: [], User: [], Workspace: [] };

async function main() {
  await c.connect();

  // ── Usuário descartável, só deste teste ──────────────────────────────────
  const { rows: u } = await c.query(
    `INSERT INTO "User" (id, email, name, "passwordHash", timezone, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'Teste taxa fixa', 'x', 'America/Sao_Paulo', now(), now())
     RETURNING id`,
    [`taxa-fixa-${Date.now()}@teste.local`],
  );
  const userId = u[0].id;
  lixo.User.push(userId);

  const { rows: w } = await c.query(
    `INSERT INTO "Workspace" (id, "userId", name, color, "isDefault", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'Principal', '#7c3aed', true, now(), now())
     RETURNING id`,
    [userId],
  );
  lixo.Workspace.push(w[0].id);

  /**
   * ⚠️ Semeia com o dia no fuso do USUÁRIO, não `CURRENT_DATE`.
   *
   * `CURRENT_DATE` é o dia do BANCO (UTC). Rodando às 00h01 UTC = 21h01 em
   * Brasília, a venda cairia no dia seguinte e o teste falharia só à noite —
   * pior que falhar sempre. É a mesma janela descrita em "Fuso horário — causa
   * raiz", e já pegou o `teste-pedidos` uma vez.
   */
  const hojeLocal = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;

  async function venda({ externalId, pedidoId, valor, taxa = null, quando = null }) {
    const { rows } = await c.query(
      `INSERT INTO "Sale" (id, "userId", "externalId", "pedidoId", "itemTipo", product, value,
                           status, "paymentMethod", timestamp, "taxaGateway", "rawPayload", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'principal', 'Produto', $4,
               'APROVADA', 'PIX', COALESCE($6::timestamp, ${hojeLocal} + interval '13 hours'), $5, '{}'::jsonb,
               now(), now())
       RETURNING id`,
      [userId, externalId, pedidoId, valor, taxa, quando],
    );
    lixo.Sale.push(rows[0].id);
    return rows[0].id;
  }

  // ── UM checkout com order bump (2 linhas, 1 pedido) + uma venda simples ──
  //
  // É a forma exata do caso real: 90 + 27 = 117 de faturamento, 2 conversões.
  await venda({ externalId: "e1", pedidoId: "pedido-A", valor: 90 });
  await venda({ externalId: "e2", pedidoId: "pedido-A", valor: 27 });
  await venda({ externalId: "e3", pedidoId: "pedido-B", valor: 100 });

  const { rows: desp } = await c.query(
    `INSERT INTO "Expense" (id, "userId", name, type, calc, amount, recurrence, active, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'Taxa fixa', 'TAXA_GATEWAY', 'FIXO', 2.5, 'UNICA', true, now(), now())
     RETURNING id`,
    [userId],
  );
  lixo.Expense.push(desp[0].id);

  const filtros = { period: "hoje", account: "todas", product: "todos", source: "todas" };

  console.log("\n1) TAXA FIXA — por PEDIDO, nao por linha");
  {
    const d = await computeDashboard(userId, filtros);
    eq("faturamento soma as LINHAS", d.kpis.revenue, 217);
    eq("vendas contam os PEDIDOS", d.kpis.sales, 2);
    // 🔴 A asserção central. Por linha daria 7,50; por pedido dá 5,00.
    eq("taxa fixa de 2,50 x 2 pedidos", d.financeiro.gateway, 5);
    eq("  e o liquido desconta exatamente isso", d.financeiro.liquido, 212);
  }

  console.log("\n2) A MESMA taxa como PERCENTUAL nao muda de unidade");
  {
    await c.query(`UPDATE "Expense" SET calc = 'PERCENTUAL', amount = 5 WHERE id = $1`, [desp[0].id]);
    const d = await computeDashboard(userId, filtros);
    eq("5% de 217", d.financeiro.gateway, 10.85);
    await c.query(`UPDATE "Expense" SET calc = 'FIXO', amount = 2.5 WHERE id = $1`, [desp[0].id]);
  }

  console.log("\n3) Pedido que JA informou a taxa nao paga a cadastrada");
  {
    // A venda simples passa a trazer a taxa real do gateway.
    await c.query(`UPDATE "Sale" SET "taxaGateway" = 3.10 WHERE "userId" = $1 AND "externalId" = 'e3'`, [userId]);
    const d = await computeDashboard(userId, filtros);
    // pedido-B informou (3,10); pedido-A não informou (2,50 cadastrada).
    eq("real + cadastrada, sem cobrar duas vezes", d.financeiro.gateway, 5.6);
    eq("  1 pedido com valor real", d.financeiro.fontes.gateway.vendasComValorReal, 1);
    eq("  1 pedido pela cadastrada", d.financeiro.fontes.gateway.vendasSemValorReal, 1);
    await c.query(`UPDATE "Sale" SET "taxaGateway" = NULL WHERE "userId" = $1 AND "externalId" = 'e3'`, [userId]);
  }

  console.log("\n4) GASTO na serie: existe por DIA, nao por HORA");
  {
    const porHora = await computeDashboard(userId, filtros);
    eq("periodo de um dia -> granularidade horaria", porHora.chart.granularity, "hour");
    eq("a serie de gasto NAO existe", porHora.chart.gastoNaSerie, false);
    eq("  e vem vazia, nao zerada", porHora.chart.spend.length, 0);
    // ⚠️ O que dá sentido à anterior: sem denominador, as métricas derivadas
    // saem VAZIAS. Um array de zeros do mesmo tamanho passaria pelo
    // `serie.length > 1` do card e desenharia um ROAS reto no chão.
    eq("  sparkline de ROAS vazio", porHora.chart.sparklines.roas.length, 0);
    eq("  sparkline de CPA vazio", porHora.chart.sparklines.cpa.length, 0);
    eq("  mas o de faturamento continua", porHora.chart.sparklines.faturamento.length > 0, true);

    const porDia = await computeDashboard(userId, { ...filtros, period: "7d" });
    eq("periodo de varios dias -> granularidade diaria", porDia.chart.granularity, "day");
    eq("a serie de gasto existe", porDia.chart.gastoNaSerie, true);
    eq("  com um ponto por dia", porDia.chart.spend.length, porDia.chart.labels.length);
    eq("  e o ROAS volta a ter serie", porDia.chart.sparklines.roas.length > 0, true);
  }

  console.log("\n5) InitiateCheckout do gateway fica no instante da VENDA");
  {
    // Uma venda de 12 dias atrás, como as que o backfill vai encontrar.
    const antiga = await venda({
      externalId: "e-antiga", pedidoId: "pedido-antigo", valor: 50,
      quando: new Date(Date.now() - 12 * 864e5).toISOString(),
    });
    const r = await registrarCheckoutDoGateway(antiga, true);
    eq("evento criado", r, "criado");

    const { rows } = await c.query(
      `SELECT pe.timestamp AS ev, s.timestamp AS venda
         FROM "PixelEvent" pe JOIN "Sale" s ON s.id = $2
        WHERE pe."userId" = $1 AND pe."eventId" = 'gw:pedido-antigo'`,
      [userId, antiga],
    );
    eq("uma linha", rows.length, 1);
    // 🔴 A asserção do backfill inteiro. Com o `@default(now())` isto daria a
    // data de HOJE — todo checkout recuperado empilhado no dia da execução,
    // inflando o funil de hoje e deixando o passado tão vazio quanto estava.
    eq("o instante e o da VENDA, nao o de agora",
      new Date(rows[0].ev).getTime(), new Date(rows[0].venda).getTime());
    const diasAtras = Math.round((Date.now() - new Date(rows[0].ev).getTime()) / 864e5);
    eq("  ou seja, ~12 dias atras", diasAtras, 12);

    // E o dedup por pedido continua valendo: reentrega não cria linha nova.
    eq("reentrega do mesmo pedido", await registrarCheckoutDoGateway(antiga, true), "duplicado");

    // ⚠️ A prova de que o evento NÃO caiu no funil de hoje.
    const hoje = await computeDashboard(userId, filtros);
    eq("o checkout antigo fica FORA do funil de hoje", hoje.funnel.checkouts, 0);
  }
}

async function limpar() {
  // Sempre por ID coletado na criação — nunca por LIKE nem por nome.
  await c.query(`DELETE FROM "PixelEvent" WHERE "userId" = ANY($1::text[])`, [lixo.User]);
  await c.query(`DELETE FROM "Sale"       WHERE id = ANY($1::text[])`, [lixo.Sale]);
  await c.query(`DELETE FROM "Expense"    WHERE id = ANY($1::text[])`, [lixo.Expense]);
  await c.query(`DELETE FROM "Workspace"  WHERE id = ANY($1::text[])`, [lixo.Workspace]);
  await c.query(`DELETE FROM "User"       WHERE id = ANY($1::text[])`, [lixo.User]);
}

try {
  await main();
} catch (e) {
  falhas++;
  console.error("\n\x1b[31mERRO\x1b[0m", e);
} finally {
  await limpar().catch((e) => console.error("falha ao limpar:", e));
  await c.end();
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
