/**
 * Auditoria das regras de automação — "o que elas fariam, e o que já fizeram".
 *
 * ## Por que existe
 *
 * O botão "Rodar agora" e o cron do GitHub Actions disparam **todas** as regras
 * ATIVAS do usuário, não só a que você acabou de criar. Antes de qualquer
 * ensaio, é preciso saber o que já está armado — e uma regra de ATIVAR com
 * escopo "todas as contas" é a que mexe em dinheiro real sem ninguém olhando.
 *
 * Responde duas perguntas, nesta ordem:
 *
 *   1. Estado ATUAL de cada regra: ligada?, escopo, condição, ação, e quantas
 *      entidades ela alcançaria hoje.
 *   2. Histórico: ela já rodou? já AGIU? em quê, exatamente?
 *
 * ⚠️ **SÓ LEITURA** — apenas `SELECT`. Nenhuma escrita no banco, nenhuma
 * chamada à Graph API. Pode rodar em produção sem trava.
 *
 * ## Uso
 *
 *   npm run regras:auditar                      # banco do .env
 *   npm run regras:auditar -- --url "<conn>"    # produção
 */
import "dotenv/config";
import pg from "pg";

const args = process.argv.slice(2);
const iUrl = args.indexOf("--url");
const url = iUrl >= 0 ? args[iUrl + 1] : process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("✗ Sem DATABASE_URL/DIRECT_URL e sem --url.");
  process.exit(1);
}
const ref = (url.match(/postgres\.([a-z0-9]+)[:@]/) ?? [])[1] ?? "desconhecido";
const c = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });

const C = { v: "\x1b[32m", r: "\x1b[31m", a: "\x1b[33m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };

const NIVEL = { CAMPAIGN: "campanha", ADSET: "conjunto", AD: "anúncio" };
const TABELA = { CAMPAIGN: "Campaign", ADSET: "AdSet", AD: "Ad" };
const METRICA = { cpa: "CPA", roas: "ROAS", ctr: "CTR", gasto: "Gasto", vendas: "Vendas" };

/** A ação em português, com os parâmetros — é o que ela FARIA. */
function descreverAcao(acao, params) {
  const p = params ?? {};
  if (acao === "PAUSAR") return "PAUSAR (desligar no Facebook)";
  if (acao === "ATIVAR") return "ATIVAR (ligar no Facebook)";
  if (p.tipo === "valor") return `DEFINIR orçamento em R$ ${p.valor}`;
  if (p.tipo === "pct_gasto") return `DEFINIR orçamento em ${p.valor}% do gasto do período`;
  return `AJUSTAR orçamento em ${p.valor > 0 ? "+" : ""}${p.valor}% sobre o atual`;
}

function descreverCondicoes(conds) {
  if (!Array.isArray(conds) || !conds.length) {
    return `${C.a}nenhuma condição — o motor NÃO dispara (lista vazia nunca bate)${C.x}`;
  }
  return conds.map((x) => `${METRICA[x.metrica] ?? x.metrica} ${x.operador} ${x.valor}`).join(" E ");
}

async function main() {
  await c.connect();
  console.log(`\n${C.b}Auditoria de regras de automação${C.x} — projeto ${C.b}${ref}${C.x}  ${C.d}(só leitura)${C.x}`);

  const { rows: regras } = await c.query(`
    SELECT r.*, u.email, w."name" AS area
      FROM "AutomationRule" r
      JOIN "User" u ON u.id = r."userId"
      LEFT JOIN "Workspace" w ON w.id = r."workspaceId"
     ORDER BY r."createdAt"`);

  if (!regras.length) {
    console.log(`\n   ${C.v}Nenhuma regra cadastrada. Nada pode disparar.${C.x}\n`);
    return;
  }

  const ligadas = regras.filter((r) => r.active).length;
  console.log(
    `\n${regras.length} regra(s) · ${ligadas ? C.a : C.v}${ligadas} LIGADA(S)${C.x} · ${regras.length - ligadas} desligada(s)`,
  );

  let agiuAlguma = 0;

  for (const r of regras) {
    const on = r.active;
    console.log(`\n${C.b}${"─".repeat(72)}${C.x}`);
    console.log(`${C.b}${r.name}${C.x}  ${on ? `${C.a}● LIGADA${C.x}` : `${C.d}○ desligada${C.x}`}   ${C.d}${r.email}${C.x}`);
    console.log(`  ação ............ ${C.b}${descreverAcao(r.action, r.actionParams)}${C.x}`);
    console.log(`  condição ........ ${descreverCondicoes(r.conditions)}`);
    console.log(`  nível ........... ${NIVEL[r.level] ?? r.level}`);
    console.log(`  período do cálc.. ${r.calcPeriod}`);
    console.log(`  frequência ...... a cada ${r.frequencyMin} min · limite ${r.dailyRunLimit}/dia`);
    console.log(
      `  janela .......... ${r.windowStartHour == null || r.windowEndHour == null ? "qualquer hora" : `${r.windowStartHour}h–${r.windowEndHour}h`}`,
    );
    console.log(`  área ............ ${r.workspaceId ? r.area : `${C.a}GLOBAL (todas as áreas)${C.x}`}`);
    if (r.action === "AJUSTAR_ORCAMENTO") {
      console.log(
        `  teto ............ ${r.maxBudget == null ? `${C.r}SEM TETO — o motor RECUSA aumentar${C.x}` : `R$ ${Number(r.maxBudget).toFixed(2)}`}`,
      );
    }

    // ── Escopo: quais contas, e quantas entidades hoje ────────────────────
    let contas;
    if (r.adAccountIds?.length) {
      const { rows } = await c.query(`SELECT id, "name" FROM "AdAccount" WHERE id = ANY($1)`, [r.adAccountIds]);
      contas = rows;
      console.log(`  contas .......... ${rows.map((x) => x.name).join(", ") || "(ids que não existem mais)"}`);
    } else {
      const { rows } = await c.query(`SELECT id, "name" FROM "AdAccount" WHERE "userId" = $1`, [r.userId]);
      contas = rows;
      console.log(`  contas .......... ${C.a}TODAS (${rows.length}) — ${rows.map((x) => x.name).join(", ")}${C.x}`);
    }
    console.log(`  produtos ........ ${r.targetProducts?.length ? r.targetProducts.join(", ") : "todos"}`);

    // Quantas entidades entrariam no escopo HOJE. Mesmo filtro do motor
    // (`semApagados`) — arquivadas e excluídas ficam de fora desde cc8fdec.
    if (contas.length) {
      const t = TABELA[r.level];
      const ids = contas.map((x) => x.id);
      const filtroNome = r.nameFilter ? ` AND "name" ILIKE '%' || $2 || '%'` : "";
      const p = r.nameFilter ? [ids, r.nameFilter] : [ids];
      const { rows: alcance } = await c.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'ACTIVE')::int AS ativas,
                count(*) FILTER (WHERE status IN ('ARCHIVED','DELETED'))::int AS apagadas
           FROM "${t}" WHERE "adAccountId" = ANY($1)${filtroNome}`,
        p,
      );
      const a = alcance[0];
      const noEscopo = a.total - a.apagadas;
      console.log(
        `  alcance hoje .... ${C.b}${noEscopo}${C.x} ${NIVEL[r.level]}(s) no escopo · ${a.ativas} ativa(s) · ${C.d}${a.apagadas} arquivada(s)/excluída(s) FORA do escopo${C.x}`,
      );
      // O que ela mexeria de fato, se a condição batesse em tudo.
      if (r.action === "ATIVAR") {
        console.log(`  ${C.a}se disparasse hoje: ligaria até ${noEscopo - a.ativas} ${NIVEL[r.level]}(s) que estão parados.${C.x}`);
      } else if (r.action === "PAUSAR") {
        console.log(`  ${C.d}se disparasse hoje: desligaria até ${a.ativas} ${NIVEL[r.level]}(s) ativo(s).${C.x}`);
      }
    }

    // ── Histórico ─────────────────────────────────────────────────────────
    const { rows: logs } = await c.query(
      `SELECT "ranAt", status, message, affected, details
         FROM "AutomationRuleLog" WHERE "ruleId" = $1 ORDER BY "ranAt" DESC`,
      [r.id],
    );
    console.log(`  última execução . ${r.lastRunAt ? new Date(r.lastRunAt).toISOString() : `${C.v}NUNCA${C.x}`}`);

    if (!logs.length) {
      console.log(`  histórico ....... ${C.v}vazio — esta regra NUNCA foi executada.${C.x}`);
      continue;
    }

    const comAcao = logs.filter((l) => l.affected > 0);
    console.log(`  histórico ....... ${logs.length} execução(ões) · ${comAcao.length ? `${C.r}${comAcao.length} COM AÇÃO${C.x}` : `${C.v}nenhuma agiu${C.x}`}`);

    for (const l of logs.slice(0, 10)) {
      const cor = l.affected > 0 ? C.r : l.status === "ERRO" ? C.a : C.d;
      console.log(`    ${cor}${new Date(l.ranAt).toISOString()}  ${l.status}  afetadas=${l.affected}${C.x}  ${C.d}${l.message ?? ""}${C.x}`);
      // `aplicado` é o que ela FEZ, entidade por entidade — é isto que você leva
      // para conferir no Gerenciador do Facebook.
      for (const ap of l.details?.aplicado ?? []) {
        const marca = ap.ok && !ap.error ? `${C.r}✓ EXECUTOU${C.x}` : `${C.d}· ${ap.error ?? "falhou"}${C.x}`;
        console.log(`        ${marca}  ${ap.action} → ${ap.name}`);
      }
    }
    if (logs.length > 10) console.log(`    ${C.d}… mais ${logs.length - 10} execução(ões) antigas${C.x}`);
    if (comAcao.length) agiuAlguma += comAcao.length;
  }

  // ── Veredito ────────────────────────────────────────────────────────────
  console.log(`\n${C.b}${"─".repeat(72)}${C.x}`);
  console.log(`${C.b}Veredito${C.x}`);
  if (agiuAlguma === 0) {
    console.log(`   ${C.v}✓ NENHUMA regra jamais executou ação no Facebook.${C.x}`);
    console.log(`   ${C.d}Nada a conferir no Gerenciador de Anúncios.${C.x}`);
  } else {
    console.log(`   ${C.r}⚠ ${agiuAlguma} execução(ões) COM AÇÃO no Facebook.${C.x}`);
    console.log(`   ${C.d}As linhas "✓ EXECUTOU" acima dizem o que foi feito e em qual entidade.${C.x}`);
  }
  if (ligadas) {
    console.log(`\n   ${C.a}⚠ ${ligadas} regra(s) LIGADA(S): "Rodar agora" e o cron disparam TODAS elas.${C.x}`);
    console.log(`   ${C.d}Desligue as que não fizerem parte do ensaio antes de clicar.${C.x}`);
  } else {
    console.log(`\n   ${C.v}✓ Nenhuma regra ligada — o cron não tem o que executar.${C.x}`);
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error("\n✗ Falhou:", e.message);
    process.exitCode = 1;
  })
  .finally(() => c.end());
