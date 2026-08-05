/**
 * Auditoria de métricas: as contagens usam a MESMA unidade, e indefinido não é zero.
 *
 * ## O que a auditoria encontrou
 *
 * | # | Achado | Por que passava despercebido |
 * |---|---|---|
 * | 1 | `chargebackRate` dividia **itens por pedidos** | razão com unidades diferentes; o número continua entre 0 e 100 |
 * | 2 | `pendentes`/`reembolsadas`/`chargebacks` contavam itens | `salesCount` na MESMA função já contava pedidos |
 * | 3 | `cpa`/`ticket`/`roas`/`ctr`/`arpu` devolviam `0` | "CPA R$ 0,00" se lê como aquisição de graça |
 *
 * O achado 3 é a correção que o ROI já tinha recebido e os irmãos dele não —
 * enquanto o Gerenciador (`lib/ads/metrics.ts`) sempre devolveu `null` no mesmo
 * caso. Duas telas respondiam diferente à mesma pergunta.
 *
 * ## ⛔ Cada asserção precisa poder FALHAR pelo motivo que ela alega medir
 *
 * O cenário tem **order bump de propósito**: com uma linha por pedido, contar
 * itens e contar pedidos dá o MESMO número, e o teste passaria com o código
 * antigo sem provar nada. Duas linhas num pedido é o que separa os dois.
 *
 * ## Escreve no banco de DESENVOLVIMENTO, e limpa por id
 *
 *   npm run test:auditoria-metricas
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";

import { computeDashboard } from "@/lib/dashboard/metrics";
import { prisma } from "@/lib/prisma";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "teste-auditoria-metricas" });

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log(`  ✓ ${nome} — ${a}`);
  } else {
    falhas++;
    console.log(`  ✗ ${nome}\n      obtido:   ${a}\n      esperado: ${b}`);
  }
}
function diferente(nome, obtido, naoPodeSer) {
  if (JSON.stringify(obtido) !== JSON.stringify(naoPodeSer)) {
    ok++;
    console.log(`  ✓ ${nome}`);
  } else {
    falhas++;
    console.log(`  ✗ ${nome} — obtido ${JSON.stringify(obtido)}, que é exatamente o valor que NÃO pode aparecer`);
  }
}

const users = [];
const FILTROS = { period: "hoje", account: "todas", product: "todos", source: "todas" };

async function novoUsuario() {
  const { rows } = await cliente.query(
    `INSERT INTO "User" (id, email, name, "passwordHash", timezone, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'auditoria', 'x', 'America/Sao_Paulo', now(), now()) RETURNING id`,
    [`auditoria-${randomUUID().slice(0, 8)}@teste.dev`],
  );
  users.push(rows[0].id);
  return rows[0].id;
}

/** Uma LINHA de venda. `pedido` igual em duas linhas = um checkout com bump. */
async function venda(userId, { status, valor, pedido }) {
  await cliente.query(
    `INSERT INTO "Sale" (id, "externalId", "pedidoId", value, currency, product, status,
                         "paymentMethod", "userId", timestamp, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'BRL', 'Produto', $4::"SaleStatus", 'PIX', $5,
             (now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '10 hours', now(), now())`,
    [`aud-${randomUUID().slice(0, 12)}`, pedido, valor, status, userId],
  );
}

async function main() {
  await cliente.connect();

  // ══════════════════════════════════════════════════════════════════
  console.log("\n1. Contagem por PEDIDO, não por item — inclusive nos status\n");
  // ══════════════════════════════════════════════════════════════════
  {
    const u = await novoUsuario();
    // 1 checkout PENDENTE com order bump (2 linhas, 1 pedido)
    await venda(u, { status: "PENDENTE", valor: 90, pedido: "p1" });
    await venda(u, { status: "PENDENTE", valor: 27, pedido: "p1" });
    // 1 checkout APROVADO simples
    await venda(u, { status: "APROVADA", valor: 100, pedido: "p2" });
    // 1 CHARGEBACK com order bump (2 linhas, 1 pedido)
    await venda(u, { status: "CHARGEBACK", valor: 50, pedido: "p3" });
    await venda(u, { status: "CHARGEBACK", valor: 10, pedido: "p3" });
    // 1 REEMBOLSADA com order bump (2 linhas, 1 pedido)
    await venda(u, { status: "REEMBOLSADA", valor: 30, pedido: "p4" });
    await venda(u, { status: "REEMBOLSADA", valor: 5, pedido: "p4" });

    const d = await computeDashboard(u, FILTROS);
    const k = d.kpis;

    eq("pendentes conta o CHECKOUT, não os itens", k.pendentes, 1);
    diferente("pendentes NÃO voltou a contar itens", k.pendentes, 2);
    // O valor continua somando as LINHAS: o dinheiro do bump é real.
    eq("mas o VALOR pendente soma as duas linhas", k.pendentesValor, 117);

    eq("reembolsadas conta pedidos", k.reembolsadas, 1);
    diferente("reembolsadas NÃO conta itens", k.reembolsadas, 2);

    /**
     * 🔴 O achado principal: eram 2 chargebacks (itens) sobre 4 pedidos = 50%.
     * O certo é 1 pedido sobre 4 = 25%. A razão misturava unidades, e o
     * resultado continuava entre 0 e 100 — plausível e o dobro da realidade.
     */
    eq("chargebackRate é pedidos ÷ pedidos", k.chargebackRate, 25);
    diferente("NÃO é a taxa inflada por itens ÷ pedidos", k.chargebackRate, 50);
  }

  // ══════════════════════════════════════════════════════════════════
  console.log("\n2. Indefinido é `null`, nunca zero\n");
  // ══════════════════════════════════════════════════════════════════
  {
    // Usuário sem venda e sem gasto: nada é calculável.
    const u = await novoUsuario();
    const k = (await computeDashboard(u, FILTROS)).kpis;

    eq("sem venda, o ticket é indefinido", k.ticket, null);
    eq("sem venda, o CPA é indefinido", k.cpa, null);
    eq("sem gasto, o ROAS é indefinido", k.roas, null);
    eq("sem impressão, o CTR é indefinido", k.ctr, null);
    eq("sem comprador, o ARPU é indefinido", k.arpu, null);
    eq("sem custo, o ROI é indefinido", k.roi, null);

    /**
     * O contraste que dá valor ao bloco: zero é o que a tela imprimia, e é uma
     * afirmação FALSA — "CPA R$ 0,00" se lê como aquisição de graça, "0,00x"
     * como empate.
     */
    diferente("CPA não é zero", k.cpa, 0);
    diferente("ticket não é zero", k.ticket, 0);
    diferente("ROAS não é zero", k.roas, 0);
  }
  {
    // Com venda de verdade, os mesmos campos voltam a ser número — senão o
    // teste acima passaria com uma função que devolve `null` sempre.
    const u = await novoUsuario();
    await venda(u, { status: "APROVADA", valor: 90, pedido: "q1" });
    await venda(u, { status: "APROVADA", valor: 30, pedido: "q1" });
    await venda(u, { status: "APROVADA", valor: 60, pedido: "q2" });
    const k = (await computeDashboard(u, FILTROS)).kpis;

    eq("faturamento soma as LINHAS", k.revenue, 180);
    eq("vendas conta os PEDIDOS", k.sales, 2);
    // 180 ÷ 2 pedidos = 90. Por item seriam 180 ÷ 3 = 60.
    eq("ticket médio é o valor do CARRINHO", k.ticket, 90);
    diferente("ticket NÃO é faturamento ÷ itens", k.ticket, 60);
    // Sem gasto o ROAS segue indefinido, mesmo havendo faturamento.
    eq("com faturamento e sem gasto, ROAS continua indefinido", k.roas, null);
  }

  console.log(`\n${ok} asserções, ${falhas} falha(s).\n`);
}

main()
  .catch((e) => {
    console.error(e);
    falhas++;
  })
  .finally(async () => {
    for (const id of users) {
      await cliente.query(`DELETE FROM "User" WHERE id = $1`, [id]).catch(() => {});
    }
    await cliente.end().catch(() => {});
    await prisma.$disconnect().catch(() => {});
    process.exit(falhas > 0 ? 1 : 0);
  });
