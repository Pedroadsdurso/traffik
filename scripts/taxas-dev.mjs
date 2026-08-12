/**
 * O DEV NÃO CONSEGUIA MOSTRAR O CONFLITO QUE ESTA TELA EXISTE PARA RESOLVER.
 *
 * ## ⚠️ CORREÇÃO DE UMA MEDIÇÃO MINHA — leia antes do resto
 *
 * A primeira versão deste cabeçalho afirmava **"0 linhas em `Expense`"**. É
 * FALSO, e eu o escrevi INFERINDO de uma tela que abriu vazia em vez de
 * consultar o banco — exatamente o erro que este projeto documenta como
 * "inferir estado em vez de medir". Corrigido no mesmo dia, ao ver na tela
 * despesas que este script não havia criado.
 *
 * O estado REAL do dev, medido em 12/08/2026 com `SELECT`:
 *
 * | | |
 * |---|---|
 * | total | **5** despesas |
 * | tipo | **todas** `DESPESA_RECORRENTE` |
 * | `workspaceId` | **NULO em todas as 5** — vindas do backfill, que mantém nulo de propósito |
 * | frequências | DIARIA · SEMANAL · MENSAL · ANUAL · UNICA, uma de cada |
 *
 * Ou seja: as frequências já estavam bem cobertas (foi a sessão do rateio, em
 * 06/08, que as plantou). O que **não existia** era qualquer linha nos outros
 * quatro grupos — zero taxa de gateway, zero imposto, zero coprodução, zero
 * custo de produto.
 *
 * ## 🔴 E é justamente isso que deixava o entregável invisível
 *
 * A frase de INCIDÊNCIA existe para separar duas grandezas que a tela antiga
 * mostrava como número solto: **uma taxa FIXA restrita a uma forma de pagamento**
 * e **uma PERCENTUAL global**. As duas são taxa de gateway — e o dev não tinha
 * NENHUMA taxa de gateway. O conflito que motivou a tela não tinha representante
 * no único banco em que dá para olhar.
 *
 * É a família **"o gerador entrega o estado que impede de ver o que se ia
 * verificar"** — e a forma dela que engana mais, porque o estado existente
 * parecia rico: cinco linhas, cinco frequências, tudo plausível.
 *
 * ## O que este script planta, e por que cada linha
 *
 * | Linha | Existe para exercer |
 * |---|---|
 * | gateway **FIXO no Pix** | `R$ 2,50 por venda no Pix` — valor + unidade + forma |
 * | gateway **PERCENTUAL global** | `3,5% sobre toda venda` — o contraste com a de cima |
 * | imposto | o grupo percentual simples |
 * | coprodução | o grupo que quase sempre fica vazio em conta real |
 * | despesa **MENSAL** | `R$ 490,00 por mês` — o período declarado |
 * | despesa **ANUAL** | a frequência que a tela antiga **não deixava cadastrar** |
 * | despesa **UNICA** | 🔴 o único jeito de ver o aviso de fora do cálculo |
 *
 * ⚠️ A `UNICA` é plantada aqui **de propósito, e o seletor da tela não a
 * oferece**. Não é contradição: ela representa as linhas que já existem no banco
 * de quem usa o produto, e são justamente as que ninguém sabe que não contam.
 *
 * ⛔ TODAS nascem com o `workspaceId` da área Principal, nunca NULO.
 * `Expense.workspaceId` NULO significa **vale para TODAS as áreas** — semear
 * nulo aqui produziria, no dev, exatamente o estado que a tela existe para
 * evitar, e ninguém desconfiaria porque o número continua plausível.
 *
 * ## Uso
 *
 *   npm run dev:taxas
 *
 * É **idempotente**: cada linha é procurada pelo par (tipo, nome) antes de ser
 * criada, e o script IMPRIME o que encontrou e o que criou.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

/**
 * As sete linhas. `amount` em unidade do `calc`: percentual (0–100) quando
 * PERCENTUAL, valor absoluto quando FIXO.
 */
const LINHAS = [
  { name: "Hotmart — Pix", type: "TAXA_GATEWAY", calc: "FIXO", amount: 2.5, paymentMethod: "PIX", recurrence: "MENSAL" },
  { name: "Hotmart", type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount: 3.5, paymentMethod: null, recurrence: "MENSAL" },
  { name: "Simples Nacional", type: "IMPOSTO", calc: "PERCENTUAL", amount: 6, paymentMethod: null, recurrence: "MENSAL" },
  { name: "Coprodutor", type: "COPRODUCAO", calc: "PERCENTUAL", amount: 20, paymentMethod: null, recurrence: "MENSAL" },
  { name: "Plataforma de entrega", type: "CUSTO_PRODUTO", calc: "PERCENTUAL", amount: 4, paymentMethod: null, recurrence: "MENSAL" },
  { name: "Ferramentas", type: "DESPESA_RECORRENTE", calc: "FIXO", amount: 490, paymentMethod: null, recurrence: "MENSAL" },
  { name: "Domínio e certificado", type: "DESPESA_RECORRENTE", calc: "FIXO", amount: 380, paymentMethod: null, recurrence: "ANUAL" },
  /* 🔴 A linha que torna o aviso visível. Ver a nota do cabeçalho. */
  { name: "Curso de tráfego", type: "DESPESA_RECORRENTE", calc: "FIXO", amount: 1200, paymentMethod: null, recurrence: "UNICA" },
];

export async function semearTaxas(c) {
  const { rows: usuarios } = await c.query(
    `SELECT id FROM "User" WHERE email = 'dev@exemplo.dev' LIMIT 1`,
  );
  if (usuarios.length === 0) {
    console.log("  ⚠️  usuário dev@exemplo.dev não existe — rode `npm run seed:dev` antes.");
    return { criadas: 0, existentes: 0 };
  }
  const userId = usuarios[0].id;

  /* A área PRINCIPAL. ⛔ Nunca NULO: nulo em `Expense.workspaceId` significa
     "vale para TODAS as áreas", e semear assim plantaria no dev o defeito que a
     tela existe para tornar visível. */
  const { rows: areas } = await c.query(
    `SELECT id FROM "Workspace" WHERE "userId" = $1 AND "isDefault" = true LIMIT 1`,
    [userId],
  );
  const workspaceId = areas[0]?.id ?? null;
  if (!workspaceId) {
    console.log("  ⚠️  o usuário não tem área Principal — abortando para não gravar NULO.");
    return { criadas: 0, existentes: 0 };
  }

  let criadas = 0;
  let existentes = 0;
  const tabela = [];

  for (const l of LINHAS) {
    /* Idempotência pelo par (tipo, nome), que é o que identifica a linha para
       quem olha a tela. Procurar antes de criar é o que permite rodar duas
       vezes sem duplicar — e rodar duas vezes é como se prova o restauro. */
    const { rows: ja } = await c.query(
      `SELECT id FROM "Expense" WHERE "userId" = $1 AND type = $2::"ExpenseType" AND name = $3 LIMIT 1`,
      [userId, l.type, l.name],
    );

    if (ja.length > 0) {
      existentes++;
      tabela.push([l.name, l.type, "já existia"]);
      continue;
    }

    await c.query(
      `INSERT INTO "Expense" (id, name, type, calc, amount, "paymentMethod", recurrence, active, "createdAt", "updatedAt", "userId", "workspaceId")
       VALUES ($1, $2, $3::"ExpenseType", $4::"ExpenseCalc", $5, $6::"PaymentMethod", $7::"ExpenseRecurrence", true, now(), now(), $8, $9)`,
      [randomUUID(), l.name, l.type, l.calc, l.amount, l.paymentMethod, l.recurrence, userId, workspaceId],
    );
    criadas++;
    tabela.push([l.name, l.type, "criada"]);
  }

  /* ⚠️ O SCRIPT IMPRIME O QUE GEROU, e alguém LÊ. Foi a saída de um script assim
     que denunciou o BOLETO com 100% de aprovação em 07/08 — sem a tabela, o
     estado gerado vira "a tela está bonita" e ninguém confere. */
  console.log("\n  linha                      tipo                   estado");
  console.log("  " + "─".repeat(62));
  for (const [nome, tipo, estado] of tabela) {
    console.log(`  ${nome.padEnd(26)} ${tipo.padEnd(22)} ${estado}`);
  }
  console.log(`\n  ${criadas} criada(s) · ${existentes} já existia(m) · área ${workspaceId.slice(0, 8)}…`);

  return { criadas, existentes };
}

/* ⚠️ `pathToFileURL`, e não interpolação à mão: no Windows o Node usa
   `file:///C:/...` com TRÊS barras, e a comparação montada à mão dá falso — o
   script sai sem imprimir nada e com código 0, que é indistinguível de "rodou e
   não havia o que fazer". Aconteceu no `pixel-dev` em 11/08. */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  exigirBancoDeDesenvolvimento({ script: "taxas-dev" });
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await semearTaxas(c);
  } finally {
    await c.end();
  }
}
