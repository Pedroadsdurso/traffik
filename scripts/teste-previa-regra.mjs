/**
 * Verificação PONTA A PONTA da prévia de regra, contra o banco de DEV.
 *
 * A prévia é uma **promessa do que o motor vai fazer**. Então o que precisa ser
 * provado não é "a função roda", é:
 *
 *   1. ela usa o MESMO escopo do motor (arquivadas fora — o `semApagados` de
 *      cc8fdec). Uma prévia que contasse arquivadas prometeria ação onde o
 *      motor não age;
 *   2. ela reproduz o caso do acidente: condição sempre-verdadeira aparece como
 *      "N de N", que é o sinal que teria evitado o disparo;
 *   3. **ela NÃO age.** Nada muda no banco depois de rodar.
 *
 * Escreve no banco de DEV (passa pelo `guard-db`) e restaura por id no fim.
 */
import "dotenv/config";
import pg from "pg";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";
import { previewRule } from "@/lib/rules/engine";

exigirBancoDeDesenvolvimento();

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${JSON.stringify(obtido)}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`);
  }
}

const c = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});

const backup = [];

/** RuleRow mínima — a prévia não precisa da regra existir no banco. */
function regra(userId, condicoes, extra = {}) {
  return {
    id: "preview", userId, targetProduct: null, adAccountIds: [], workspaceId: null,
    level: "CAMPAIGN", nameFilter: null, action: "PAUSAR", actionParams: null,
    conditions: condicoes, calcPeriod: "hoje", frequencyMin: 30, dailyRunLimit: 10,
    maxBudget: null, windowStartHour: null, windowEndHour: null,
    ...extra,
  };
}

/** Condição sempre verdadeira — isola o que se quer medir: a AÇÃO. */
const SEMPRE = [{ metrica: "gasto", operador: ">=", valor: 0 }];

async function main() {
  await c.connect();
  const { rows: user } = await c.query(`SELECT id FROM "User" WHERE email = 'dev@exemplo.dev'`);
  if (!user.length) throw new Error("Rode `npm run seed:dev` antes.");
  const userId = user[0].id;

  const { rows: camps } = await c.query(`SELECT id, name, status FROM "Campaign" ORDER BY name`);
  if (camps.length < 2) throw new Error("Dados de dev insuficientes.");
  for (const r of camps) backup.push({ id: r.id, status: r.status });

  await c.query(`UPDATE "Campaign" SET status = 'ACTIVE'::"EntityStatus" WHERE id = ANY($1)`,
    [camps.map((x) => x.id)]);

  console.log("\n\x1b[1mEscopo — o MESMO do motor\x1b[0m");
  {
    // `gasto >= 0` é sempre verdadeira: bate em tudo que estiver no escopo.
    const p = await previewRule(regra(userId, [{ metrica: "gasto", operador: ">=", valor: 0 }]));
    eq("vê as 2 campanhas", p.total, camps.length);
    eq("e todas batem", p.bateram, camps.length);
    eq("devolve o nível", p.nivel, "CAMPAIGN");
    eq("lista os nomes, não só o número", p.entidades.length, camps.length);
    eq("cada entidade traz o valor real da métrica", typeof p.entidades[0].valores.gasto, "number");
  }

  console.log("\n\x1b[1m🔴 ARQUIVADA fica FORA — como no motor (cc8fdec)\x1b[0m");
  {
    await c.query(`UPDATE "Campaign" SET status = 'ARCHIVED'::"EntityStatus" WHERE id = $1`, [camps[0].id]);
    const p = await previewRule(regra(userId, [{ metrica: "gasto", operador: ">=", valor: 0 }]));
    eq("o escopo encolheu", p.total, camps.length - 1);
    eq("e a arquivada não está na lista", p.entidades.some((e) => e.nome === camps[0].name), false);
    await c.query(`UPDATE "Campaign" SET status = 'ACTIVE'::"EntityStatus" WHERE id = $1`, [camps[0].id]);
  }

  console.log("\n\x1b[1m🔴 O CASO DO ACIDENTE: `<= 999999` × `>= 999999`\x1b[0m");
  {
    // As duas condições são visualmente idênticas. A prévia é o único lugar do
    // produto onde elas passam a ser distinguíveis ANTES de salvar.
    const pegaTudo = await previewRule(regra(userId, [{ metrica: "gasto", operador: "<=", valor: 999999 }]));
    const pegaNada = await previewRule(regra(userId, [{ metrica: "gasto", operador: ">=", valor: 999999 }]));
    eq("`<= 999999` bate em TODAS", pegaTudo.bateram, pegaTudo.total);
    eq("`>= 999999` não bate em nenhuma", pegaNada.bateram, 0);
    eq("as duas veem o mesmo escopo", pegaTudo.total === pegaNada.total, true);
    // Sem entidade que bateu, mostra o que foi AVALIADO — senão a tela fica
    // muda justamente quando o usuário precisa entender por que não bateu.
    eq("quando nada bate, ainda lista o avaliado", pegaNada.entidades.length > 0, true);
    eq("e marca todas como não-bateu", pegaNada.entidades.every((e) => !e.bateu), true);
  }

  console.log("\n\x1b[1m⛔ NÃO AGE — nada muda no banco\x1b[0m");
  {
    const antes = await c.query(`SELECT id, status::text AS status, "dailyBudget" FROM "Campaign" ORDER BY id`);
    await previewRule(regra(userId, [{ metrica: "gasto", operador: ">=", valor: 0 }]));
    const depois = await c.query(`SELECT id, status::text AS status, "dailyBudget" FROM "Campaign" ORDER BY id`);
    eq("status e orçamento intactos", JSON.stringify(depois.rows), JSON.stringify(antes.rows));
    const { rows: logs } = await c.query(`SELECT count(*)::int AS n FROM "AutomationRuleLog"`);
    eq("nenhum log de execução foi gravado", logs[0].n, 0);
  }

  console.log("\n\x1b[1m🔴 BATER ≠ SER ALTERADA — o que a AÇÃO alcança\x1b[0m");
  {
    // As duas estão ACTIVE e SEM orçamento no nível da campanha — que é o caso
    // real do usuário: 13 campanhas, todas ABO.
    const pausar = await previewRule(regra(userId, SEMPRE, { action: "PAUSAR" }));
    eq("PAUSAR: bate em todas", pausar.bateram, camps.length);
    eq("  …e alteraria todas (estão ativas)", pausar.agiria, camps.length);

    const orcamento = await previewRule(regra(userId, SEMPRE, {
      action: "AJUSTAR_ORCAMENTO", actionParams: { tipo: "percentual", valor: 50 }, maxBudget: 25,
    }));
    eq("ORÇAMENTO: bate no mesmo tanto", orcamento.bateram, camps.length);
    eq("  …mas alteraria NENHUMA (todas ABO)", orcamento.agiria, 0);
    eq("  …e diz por quê", orcamento.entidades[0].motivo, "sem orçamento diário (CBO?)");
    eq("  …marcando como não acionável", orcamento.entidades.every((e) => !e.acionavel), true);

    await c.query(`UPDATE "Campaign" SET status = 'PAUSED'::"EntityStatus" WHERE id = $1`, [camps[0].id]);
    const p2 = await previewRule(regra(userId, SEMPRE, { action: "PAUSAR" }));
    eq("PAUSAR pula a que já está pausada", p2.agiria, camps.length - 1);
    eq("  …com o mesmo motivo do log", p2.entidades.find((e) => e.nome === camps[0].name).motivo, "já pausada");
    const a2 = await previewRule(regra(userId, SEMPRE, { action: "ATIVAR" }));
    eq("ATIVAR alcança só a pausada", a2.agiria, 1);
    await c.query(`UPDATE "Campaign" SET status = 'ACTIVE'::"EntityStatus" WHERE id = $1`, [camps[0].id]);
  }

  console.log("\n\x1b[1m🔴 Aumento SEM TETO é recusado — e a prévia mostra ANTES de salvar\x1b[0m");
  {
    await c.query(`UPDATE "Campaign" SET "dailyBudget" = 20 WHERE id = $1`, [camps[0].id]);
    const alvoDe = (p) => p.entidades.find((e) => e.nome === camps[0].name);

    const semTeto = await previewRule(regra(userId, SEMPRE, {
      action: "AJUSTAR_ORCAMENTO", actionParams: { tipo: "percentual", valor: 50 }, maxBudget: null,
    }));
    eq("a CBO não é acionável sem teto", alvoDe(semTeto).acionavel, false);
    eq("  …com o motivo exato do motor", alvoDe(semTeto).motivo,
      "recusado: aumento sem teto de orçamento configurado");

    const comTeto = await previewRule(regra(userId, SEMPRE, {
      action: "AJUSTAR_ORCAMENTO", actionParams: { tipo: "percentual", valor: 50 }, maxBudget: 25,
    }));
    eq("com teto, a CBO passa a ser acionável", comTeto.agiria, 1);

    const noTeto = await previewRule(regra(userId, SEMPRE, {
      action: "AJUSTAR_ORCAMENTO", actionParams: { tipo: "percentual", valor: 50 }, maxBudget: 20,
    }));
    eq("orçamento JÁ no teto não é acionável", noTeto.agiria, 0);
    eq("  …dizendo que já está no teto", alvoDe(noTeto).motivo, "já no teto (R$ 20.00)");
    await c.query(`UPDATE "Campaign" SET "dailyBudget" = NULL WHERE id = $1`, [camps[0].id]);
  }

  console.log("\n\x1b[1mCondições em E\x1b[0m");
  {
    const p = await previewRule(regra(userId, [
      { metrica: "gasto", operador: ">=", valor: 0 },
      { metrica: "vendas", operador: ">", valor: 999999 },
    ]));
    eq("uma falsa derruba o E", p.bateram, 0);
    eq("o avaliado traz as DUAS métricas", Object.keys(p.entidades[0].valores).sort(), ["gasto", "vendas"]);
  }
}

main()
  .catch((e) => {
    falhas++;
    console.error("\n✗ Falhou:", e.message);
  })
  .finally(async () => {
    for (const b of backup) {
      await c.query(`UPDATE "Campaign" SET status = $2::"EntityStatus" WHERE id = $1`, [b.id, b.status]);
    }
    console.log(`\n  \x1b[2m${backup.length} campanha(s) restauradas ao estado original.\x1b[0m`);
    await c.end();
    console.log(
      falhas === 0
        ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
        : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
    );
    process.exit(falhas === 0 ? 0 : 1);
  });
