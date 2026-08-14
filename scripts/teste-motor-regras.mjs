/**
 * O NÚCLEO DE DECISÃO DO MOTOR DE REGRAS — a única coisa desta base que AGE
 * SOZINHA, com dinheiro real.
 *
 * 🔴 ELE NÃO TINHA UMA ASSERÇÃO CONTRA A FUNÇÃO PURA
 *
 * `evaluateRule` e `runUserRules` são `async` e tocam o prisma. O que DECIDE —
 * `metricValue`, `conditionsMet`, `planejarAcao` — é puro, e era inalcançável
 * só por ser privado do módulo. Achado pela varredura de 14/08/2026.
 *
 * ⛔ O que este motor faz quando erra: **pausa campanha e altera orçamento**.
 * Não é número errado numa tela — é dinheiro. O `CLAUDE.md` registra que ele já
 * PAUSOU por acidente em produção (31/07).
 *
 * ## As duas propriedades que o `CLAUDE.md` diz serem o coração
 *
 * 1. **Indefinido não satisfaz comparação nenhuma.** O defeito que existiu era
 *    o espelho do que se temia: não era `Infinity > 50` pausando campanha nova
 *    — era `0` satisfazendo todo `<`. Uma regra *"AJUSTAR_ORCAMENTO quando
 *    CPA < 20"* **escalava o orçamento de campanha que não converteu nada**.
 *
 * 2. **Aumento sem teto é RECUSADO.** Fail-closed, a mesma regra da
 *    autenticação: ausência de configuração nunca vira permissão. Sem teto, uma
 *    regra "+20%" multiplica indefinidamente — 100 → 120 → 144 → 173…
 */

import assert from "node:assert/strict";

/* ⛔ `engine.ts` IMPORTA O PRISMA NO TOPO, e importar já lança sem
   `DATABASE_URL` — o mesmo bloqueio que o `escopoDeConfig` teve, e que lá foi
   resolvido com um MOVE (`lib/areas/escopoWhere.ts`).
 *
 * Aqui a saída é mais barata e **não toca em arquivo congelado**: uma URL
 * obviamente falsa satisfaz a construção do cliente, que é preguiçosa e não
 * conecta. Se algum caminho tentar conectar, ele falha ALTO — e falhar alto é o
 * que se quer, porque significaria que a função sob teste não era pura.
 *
 * ⚠️ A URL é `localhost` com base inexistente DE PROPÓSITO: o `guard-db` desta
 * base trata `localhost` como seguro (não sai da máquina), e um ref de projeto
 * real aqui seria a receita do incidente de 29/07. */
process.env.DATABASE_URL ??= "postgresql://ninguem:nada@localhost:1/base-que-nao-existe";

const { metricValue, conditionsMet, planejarAcao } = await import("@/lib/rules/engine");

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

/** Métricas de uma entidade. Os nomes são os do motor. */
const m = (o = {}) => ({ spend: 0, results: 0, revenue: 0, clicks: 0, impressions: 0, ...o });
const cond = (metrica, operador, valor) => ({ metrica, operador, valor });

console.log("\nO núcleo de decisão do motor de regras");

/* ═══ 1. `metricValue` — DENOMINADOR ZERO É `null`, NUNCA ZERO ═══════════ */

ok("gasto é contagem: 0 é medição, não ausência", metricValue(m({ spend: 0 }), "gasto") === 0);
ok("vendas idem", metricValue(m({ results: 0 }), "vendas") === 0);

/* 🔴 As três derivadas. `null` aqui é o que impede a regra de agir por falta de
   dado — e cada uma delas já foi a porta de um defeito. */
ok("CPA sem conversão é `null`, não 0", metricValue(m({ spend: 100, results: 0 }), "cpa") === null);
ok("ROAS sem gasto é `null`, não 0", metricValue(m({ revenue: 500, spend: 0 }), "roas") === null);
ok("CTR sem impressão é `null`, não 0", metricValue(m({ clicks: 5, impressions: 0 }), "ctr") === null);

ok("CPA com conversão calcula", metricValue(m({ spend: 100, results: 4 }), "cpa") === 25);
ok("ROAS com gasto calcula", metricValue(m({ revenue: 300, spend: 100 }), "roas") === 3);
ok("CTR sai em PORCENTAGEM, não fração", metricValue(m({ clicks: 5, impressions: 100 }), "ctr") === 5);

/* ═══ 2. `conditionsMet` — o `null` NÃO satisfaz NENHUM operador ═════════ */

for (const op of ["<", "<=", ">", ">=", "="]) {
  ok(
    `⛔ CPA indefinido NÃO satisfaz \`${op}\``,
    conditionsMet([cond("cpa", op, 20)], m({ spend: 100, results: 0 })) === false,
  );
}

/* 🔴 O CASO QUE GASTAVA DINHEIRO, literal do `CLAUDE.md`. */
ok(
  "⛔ `AJUSTAR quando CPA < 20` NÃO dispara sem conversão nenhuma",
  conditionsMet([cond("cpa", "<", 20)], m({ spend: 500, results: 0 })) === false,
);
ok(
  "⛔ `PAUSAR quando ROAS < 1` NÃO dispara em campanha que não gastou",
  conditionsMet([cond("roas", "<", 1)], m({ spend: 0, revenue: 0 })) === false,
);
/* ⛔ LINHA DE BASE do par: sem ela, as duas acima passariam num motor que nunca
   dispara — e um motor que nunca age passa em toda asserção de "não age". */
ok(
  "linha de base: COM dado, a mesma regra DISPARA",
  conditionsMet([cond("cpa", "<", 20)], m({ spend: 100, results: 10 })) === true,
  "CPA = 10 < 20",
);
ok(
  "linha de base: `ROAS < 1` dispara com gasto e pouca receita",
  conditionsMet([cond("roas", "<", 1)], m({ spend: 100, revenue: 50 })) === true,
);

/* Condições em E: uma indefinida derruba a regra inteira. */
ok(
  "⛔ uma condição indefinida derruba o conjunto (estão em E)",
  conditionsMet([cond("gasto", ">", 10), cond("cpa", "<", 20)], m({ spend: 100, results: 0 })) === false,
);
ok("lista VAZIA de condições não dispara", conditionsMet([], m({ spend: 100 })) === false);
ok("operador desconhecido não dispara", conditionsMet([{ metrica: "gasto", operador: "≈", valor: 1 }], m({ spend: 1 })) === false);

/* Fronteiras dos operadores — estritas contra inclusivas. */
ok("`>` é estrito: 10 > 10 é falso", conditionsMet([cond("gasto", ">", 10)], m({ spend: 10 })) === false);
ok("`>=` inclui: 10 >= 10 é verdadeiro", conditionsMet([cond("gasto", ">=", 10)], m({ spend: 10 })) === true);
ok("`=` tolera ponto flutuante", conditionsMet([cond("cpa", "=", 25)], m({ spend: 100.0000000001, results: 4 })) === true);

/* ═══ 3. `planejarAcao` — o TETO, e o fail-closed ═══════════════════════ */

const regra = (o = {}) => ({ action: "AJUSTAR_ORCAMENTO", actionParams: { tipo: "percentual", valor: 20 }, maxBudget: null, ...o });
const alvo = (o = {}) => ({ token: "tok", status: "ACTIVE", dailyBudget: 100, metrics: m(), ...o });

ok("sem token não age", planejarAcao(regra(), alvo({ token: null })).agir === false);

/* 🔴 FAIL-CLOSED: aumento sem teto é RECUSADO. */
{
  const p = planejarAcao(regra({ maxBudget: null }), alvo());
  ok("⛔ aumento SEM TETO é recusado", p.agir === false, p.motivo);
  ok("…e é marcado como NÃO ok (aparece no log)", p.ok === false);
}
{
  const p = planejarAcao(regra({ maxBudget: 200 }), alvo());
  ok("com teto, o aumento de +20% acontece", p.agir === true, JSON.stringify(p.novoOrcamento ?? ""));
}
{
  /* Trava NO teto em vez de recusar — subir até o limite é o que se pediu. */
  const p = planejarAcao(regra({ actionParams: { tipo: "percentual", valor: 500 }, maxBudget: 150 }), alvo());
  ok("+500% com teto 150 TRAVA em 150, não recusa", p.agir === true && p.novoOrcamento === 150, JSON.stringify(p.novoOrcamento));
}
{
  const p = planejarAcao(regra({ maxBudget: 100 }), alvo({ dailyBudget: 100 }));
  ok("já no teto: não age, e é `ok` (não é erro)", p.agir === false && p.ok === true, p.motivo);
}
{
  /* REDUZIR não precisa de teto — o teto existe contra gasto, não contra economia. */
  const p = planejarAcao(regra({ actionParams: { tipo: "percentual", valor: -30 }, maxBudget: null }), alvo());
  ok("REDUÇÃO sem teto é permitida (o teto é contra gastar)", p.agir === true, JSON.stringify(p.novoOrcamento));
}
{
  /* `pct_gasto` num dia sem gasto dá 0 — e 0 seria recusado pela Meta. */
  const p = planejarAcao(regra({ actionParams: { tipo: "pct_gasto", valor: 80 }, maxBudget: 500 }), alvo({ metrics: m({ spend: 0 }) }));
  ok("⛔ `pct_gasto` sem gasto no período NÃO vira orçamento 0", p.agir === false, p.motivo);
}
ok("sem orçamento diário (CBO) não age", planejarAcao(regra({ maxBudget: 500 }), alvo({ dailyBudget: null })).agir === false);

/* PAUSAR / ATIVAR: não chamam a Graph API à toa. */
ok("PAUSAR em campanha já pausada não age", planejarAcao(regra({ action: "PAUSAR" }), alvo({ status: "PAUSED" })).agir === false);
ok("PAUSAR em campanha ativa AGE", planejarAcao(regra({ action: "PAUSAR" }), alvo({ status: "ACTIVE" })).agir === true);
ok("ATIVAR em campanha já ativa não age", planejarAcao(regra({ action: "ATIVAR" }), alvo({ status: "ACTIVE" })).agir === false);

/* ═══════════════════════════════════════════════════════════════════════
 * 4. PROVA PELO LADO NEGATIVO — dois plantios, e os dois são CONSERTOS
 *    PLAUSÍVEIS, não erros artificiais.
 * ═════════════════════════════════════════════════════════════════════ */

/* ── PLANTIO A: o `null` colapsado em 0 ────────────────────────────────────
 * É o "conserto" que alguém faz ao ver a regra não disparar: *"o CPA está
 * vindo null, vou tratar como zero"*. Foi literalmente o estado anterior desta
 * base. */
{
  const conditionsMetComZero = (conds, mm) =>
    conds.length > 0 &&
    conds.every((c) => {
      const bruto = metricValue(mm, c.metrica);
      const actual = bruto === null ? 0 : bruto; // ← o plantio
      switch (c.operador) {
        case ">": return actual > c.valor;
        case "<": return actual < c.valor;
        case ">=": return actual >= c.valor;
        case "<=": return actual <= c.valor;
        case "=": return Math.abs(actual - c.valor) < 1e-9;
        default: return false;
      }
    });

  const semConversao = m({ spend: 500, results: 0 });
  ok(
    "PLANTIO A: com `null → 0`, `CPA < 20` DISPARA sem conversão nenhuma",
    conditionsMetComZero([cond("cpa", "<", 20)], semConversao) === true,
  );
  ok("PLANTIO A: e o certo NÃO dispara", conditionsMet([cond("cpa", "<", 20)], semConversao) === false);
  ok(
    "PLANTIO A: `>` erraria para o lado SEGURO — por isso o defeito era mudo",
    conditionsMetComZero([cond("cpa", ">", 50)], semConversao) === false,
  );

  let caiu = false;
  try {
    assert.equal(conditionsMetComZero([cond("cpa", "<", 20)], semConversao), false);
  } catch {
    caiu = true;
  }
  ok("PLANTIO A: a asserção do `CPA < 20` DERRUBA com o colapso", caiu);
}

/* ── PLANTIO B: o operador INVERTIDO ──────────────────────────────────────
 * O erro de digitação mais barato de cometer e mais caro de ter: trocar `>`
 * por `<` numa regra de pausa. */
{
  const invertido = (conds, mm) =>
    conds.every((c) => {
      const a = metricValue(mm, c.metrica);
      if (a === null) return false;
      return c.operador === ">" ? a < c.valor : c.operador === "<" ? a > c.valor : false; // ← o plantio
    });

  const boa = m({ spend: 100, revenue: 400 }); // ROAS 4 — campanha SAUDÁVEL
  ok(
    "PLANTIO B: com `<` invertido, `PAUSAR se ROAS < 1` pausaria a campanha BOA",
    invertido([cond("roas", "<", 1)], boa) === true,
  );
  ok("PLANTIO B: e o certo não a toca", conditionsMet([cond("roas", "<", 1)], boa) === false);

  let caiu = false;
  try {
    assert.equal(invertido([cond("roas", "<", 1)], boa), false);
  } catch {
    caiu = true;
  }
  ok("PLANTIO B: a asserção derruba com o operador invertido", caiu);
}

/* ── PLANTIO C: o teto aplicado sem o fail-closed ─────────────────────────
 * O "conserto" de quem acha a recusa chata: *"se não tem teto, deixa
 * aumentar"*. É o oposto exato da regra registrada. */
{
  const semFailClosed = (r, e) => {
    const novo = e.dailyBudget * (1 + (r.actionParams.valor ?? 0) / 100);
    const teto = r.maxBudget == null ? Infinity : Number(r.maxBudget); // ← o plantio
    return { agir: true, novoOrcamento: Math.min(novo, teto) };
  };
  const p = semFailClosed(regra({ maxBudget: null }), alvo());
  ok("PLANTIO C: sem fail-closed, o aumento acontece sem teto", p.agir === true && p.novoOrcamento === 120);

  /* E o efeito composto, que é o que a fatura mostra. */
  let orc = 100;
  for (let i = 0; i < 5; i++) orc = semFailClosed(regra({ maxBudget: null }), alvo({ dailyBudget: orc })).novoOrcamento;
  ok("PLANTIO C: em 5 execuções o orçamento vai a " + orc.toFixed(2), orc > 240, "100 → " + orc.toFixed(2));

  let caiu = false;
  try {
    assert.equal(planejarAcao(regra({ maxBudget: null }), alvo()).agir, true);
  } catch {
    caiu = true;
  }
  ok("PLANTIO C: o motor REAL recusa — a asserção do fail-closed derruba o plantio", caiu);
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
