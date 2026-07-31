/**
 * Recupera a taxa do gateway e as comissões das vendas JÁ GRAVADAS, relendo o
 * `Sale.rawPayload` com o parser atual.
 *
 * ## Por que existe
 *
 * A etapa 4 passou a guardar `Sale.taxaGateway` e `Sale.coproducao`, mas só para
 * vendas novas. As antigas continuam usando a taxa MÉDIA cadastrada à mão,
 * embora o payload delas já trouxesse o valor exato — a Kirvano manda `fee` e o
 * bloco `fiscal` em boa parte dos eventos.
 *
 * ## ⛔ É O PRIMEIRO TESTE REAL DA RESTRIÇÃO DE REPROCESSAMENTO
 *
 * A regra da arquitetura: **reprocessar nunca degrada dado derivado já
 * resolvido.** `country` e `countrySource` são derivados COM PROCEDÊNCIA, e o
 * `ingestSale` os recalcula a cada ingestão — sendo que a 2ª fonte dele é o IP
 * de dentro do payload.
 *
 * Este script **não escreve país nenhum**. Ele grava exclusivamente
 * `taxaGateway` e `coproducao`, e a simulação prova a invariante contando
 * `country`/`countrySource` antes e depois.
 *
 * A simulação também mostra **o que ACONTECERIA** se o reprocessamento
 * recalculasse o país com um payload já degradado (o IP removido pela Fase A da
 * purga). É a razão de a regra existir, medida em vendas reais em vez de
 * prometida.
 *
 * ## Uso
 *
 *   npm run backfill:taxas                       # SIMULA
 *   npm run backfill:taxas -- --url '<conn>'     # simula contra outro banco
 *   ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \
 *     npm run backfill:taxas -- --url '<conn>' --aplicar
 */
import "dotenv/config";

import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";
import { REGISTRO } from "../src/lib/gateways/registro.ts";
import { calcularFinanceiro } from "../src/lib/financeiro.ts";

const args = process.argv.slice(2);
const iUrl = args.indexOf("--url");
if (iUrl >= 0) {
  // Reescreve a env ANTES do guard: sem isto a trava avaliaria o banco do `.env`.
  process.env.DATABASE_URL = args[iUrl + 1];
  process.env.DIRECT_URL = args[iUrl + 1];
}
const aplicar = args.includes("--aplicar");
if (aplicar) exigirBancoDeDesenvolvimento({ script: "backfill-taxas" });

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

const brl = (n) => "R$ " + n.toFixed(2).replace(".", ",");

const { rows } = await cliente.query(
  `SELECT s.id, s.value, s.status, s."paymentMethod", s."rawPayload",
          s."taxaGateway", s."coproducao", s.country, s."countrySource",
          w.platform
     FROM "Sale" s LEFT JOIN "Webhook" w ON w.id = s."webhookId"
    WHERE s."rawPayload" IS NOT NULL`,
);

/** Comissões que são CUSTO — a do produtor é o que sobra, não despesa. */
const custoDeComissoes = (v) =>
  v.comissoes == null
    ? null
    : v.comissoes.filter((c) => !/produtor|producer/i.test(c.tipo)).reduce((a, c) => a + c.valor, 0);

const mudancas = [];
const jaTinham = [];
const semDado = [];

for (const r of rows) {
  const def = REGISTRO[r.platform ?? "CUSTOM"] ?? REGISTRO.CUSTOM;
  let v;
  try {
    v = def.parse(r.rawPayload).vendas[0];
  } catch {
    continue;
  }
  if (!v) continue;

  const coprod = custoDeComissoes(v);
  if (v.taxaGateway == null && coprod == null) {
    semDado.push(r);
    continue;
  }
  // ⚠️ Não sobrescreve o que já foi gravado na ingestão. Venda nova já entrou
  // com o valor certo, e reescrevê-la só ampliaria a superfície da operação.
  if (r.taxaGateway != null || r.coproducao != null) {
    jaTinham.push(r);
    continue;
  }
  mudancas.push({ id: r.id, taxa: v.taxaGateway, coprod, valor: Number(r.value), status: r.status });
}

// ───────────────── Impacto no Faturamento Líquido e no Lucro ─────────────────

const aprovadas = rows.filter((r) => r.status === "APROVADA");
const bruto = aprovadas.reduce((a, r) => a + Number(r.value), 0);
const porPagamento = new Map();
for (const r of aprovadas) porPagamento.set(r.paymentMethod, (porPagamento.get(r.paymentMethod) ?? 0) + Number(r.value));

const { rows: despesasRows } = await cliente.query(
  `SELECT type, calc, amount, "paymentMethod" FROM "Expense" WHERE active IS NOT FALSE`,
);
const despesas = despesasRows.map((e) => ({ ...e, amount: Number(e.amount) }));

const porId = new Map(mudancas.map((m) => [m.id, m]));
const vendasAntes = aprovadas.map((r) => ({
  valor: Number(r.value),
  formaPagamento: r.paymentMethod,
  taxaGateway: r.taxaGateway == null ? null : Number(r.taxaGateway),
  coproducao: r.coproducao == null ? null : Number(r.coproducao),
}));
const vendasDepois = aprovadas.map((r) => {
  const m = porId.get(r.id);
  return {
    valor: Number(r.value),
    formaPagamento: r.paymentMethod,
    taxaGateway: m?.taxa ?? (r.taxaGateway == null ? null : Number(r.taxaGateway)),
    coproducao: m?.coprod ?? (r.coproducao == null ? null : Number(r.coproducao)),
  };
});

const opts = { bruto, brutoPorPagamento: porPagamento, gastoAnuncios: 0, despesas };
const antes = calcularFinanceiro({ ...opts, vendas: vendasAntes });
const depois = calcularFinanceiro({ ...opts, vendas: vendasDepois });

// ───────────────── A INVARIANTE: país intocado ─────────────────

const paisAntes = rows.filter((r) => r.country).length;
const fonteAntes = rows.filter((r) => r.countrySource).length;
const assinaturaAntes = rows.map((r) => `${r.id}|${r.country ?? ""}|${r.countrySource ?? ""}`).join("\n");

/**
 * O que aconteceria se o reprocessamento recalculasse o país com o payload já
 * DEGRADADO — o estado que a Fase A da purga vai criar ao remover o IP.
 *
 * Não é hipótese: é a mesma leitura do parser, com a chave de IP removida.
 */
let degradariam = 0;
for (const r of rows) {
  if (!r.country) continue;
  const def = REGISTRO[r.platform ?? "CUSTOM"] ?? REGISTRO.CUSTOM;
  const semIp = JSON.parse(JSON.stringify(r.rawPayload));
  for (const k of ["ip", "buyer_ip", "ip_address"]) delete semIp[k];
  if (semIp.customer) delete semIp.customer.ip;
  let v;
  try {
    v = def.parse(semIp).vendas[0];
  } catch {
    continue;
  }
  // Com o IP fora, sobra o `country` do payload — que na Kirvano não vem.
  const aindaResolve = (v?.pais ?? "").trim() !== "";
  if (!aindaResolve) degradariam++;
}

// ───────────────────────────── Relatório ─────────────────────────────

console.log(`\n${rows.length} vendas com payload guardado.\n`);
console.log("TAXAS RECUPERÁVEIS");
console.log(`  ganham taxa/comissão real .... ${String(mudancas.length).padStart(3)}`);
console.log(`  já tinham (venda nova) ....... ${String(jaTinham.length).padStart(3)}`);
console.log(`  payload não traz o dado ...... ${String(semDado.length).padStart(3)}`);

if (mudancas.length) {
  const somaTaxa = mudancas.reduce((a, m) => a + (m.taxa ?? 0), 0);
  const somaCoprod = mudancas.reduce((a, m) => a + (m.coprod ?? 0), 0);
  console.log(`\n  taxa do gateway recuperada ... ${brl(somaTaxa)}`);
  console.log(`  coprodução recuperada ........ ${brl(somaCoprod)}`);
}

console.log(`\nIMPACTO (vendas aprovadas do banco inteiro, sem gasto de anúncio)`);
const linha = (rot, a, d) =>
  console.log(`  ${rot.padEnd(24)} ${brl(a).padStart(12)}  →  ${brl(d).padStart(12)}   ${a === d ? "" : `(${d > a ? "+" : ""}${(d - a).toFixed(2)})`}`);
linha("Faturamento bruto", antes.bruto, depois.bruto);
linha("Taxa do gateway", antes.gateway, depois.gateway);
linha("Coprodução", antes.coproducao, depois.coproducao);
linha("FATURAMENTO LÍQUIDO", antes.liquido, depois.liquido);
linha("LUCRO", antes.lucro, depois.lucro);
console.log(
  `\n  procedência: ${depois.fontes.gateway.vendasComValorReal} venda(s) com taxa real, ` +
    `${depois.fontes.gateway.vendasSemValorReal} pela taxa cadastrada` +
    (depois.fontes.gateway.vendasComValorReal && depois.fontes.gateway.vendasSemValorReal
      ? "  ← período MISTO, o rótulo do card vai dizer isso"
      : ""),
);

console.log(`\n🔒 RESTRIÇÃO DE REPROCESSAMENTO`);
console.log(`  country preenchido ........... ${paisAntes} (este script não escreve país)`);
console.log(`  countrySource preenchido ..... ${fonteAntes}`);
console.log(
  `  se o país fosse RECALCULADO com o payload já purgado (Fase A):\n` +
    `    ${degradariam} venda(s) PERDERIAM o país — é exatamente o que a regra impede.`,
);

// ───────────────────────────── Escrita ─────────────────────────────

if (!aplicar) {
  console.log(`\n\x1b[33mSIMULAÇÃO — nada foi escrito.\x1b[0m Para aplicar, acrescente --aplicar.\n`);
} else if (mudancas.length) {
  for (const m of mudancas) {
    // ⚠️ O `SET` toca SÓ as duas colunas de taxa. País, fonte, clique, método de
    // match e status ficam de fora — a restrição é estrutural, não uma promessa.
    // O `AND "taxaGateway" IS NULL` fecha a corrida com um webhook que chegue no
    // meio: se a venda já ganhou taxa, o UPDATE não encontra a linha.
    await cliente.query(
      `UPDATE "Sale" SET "taxaGateway" = $1, "coproducao" = $2
        WHERE id = $3 AND "taxaGateway" IS NULL AND "coproducao" IS NULL`,
      [m.taxa, m.coprod, m.id],
    );
  }

  const { rows: depoisRows } = await cliente.query(
    `SELECT id, country, "countrySource" FROM "Sale" WHERE "rawPayload" IS NOT NULL`,
  );
  const mapa = new Map(depoisRows.map((r) => [r.id, r]));
  const assinaturaDepois = rows
    .map((r) => `${r.id}|${mapa.get(r.id)?.country ?? ""}|${mapa.get(r.id)?.countrySource ?? ""}`)
    .join("\n");

  console.log(`\n\x1b[32m✓ ${mudancas.length} vendas com taxa real.\x1b[0m`);
  if (assinaturaAntes === assinaturaDepois) {
    console.log(`\x1b[32m✓ país e procedência IDÊNTICOS linha a linha — restrição respeitada.\x1b[0m\n`);
  } else {
    console.error(`\n\x1b[41m\x1b[30m  FALHA  \x1b[0m O país mudou. Restaure o backup.\n`);
    process.exitCode = 1;
  }
}

await cliente.end();
