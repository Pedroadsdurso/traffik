/**
 * Asserções puras de `lib/financeiro.ts` — a conta única de líquido e lucro.
 *
 * Sem banco, sem rede. O que se prova aqui:
 *  - a cadeia de desconto na ordem certa e com a base certa;
 *  - taxa de gateway incidindo só sobre a forma de pagamento dela;
 *  - desconto não cadastrado valendo ZERO **e sendo denunciado** em `faltando`;
 *  - ROI `null` (não `0`) quando não houve custo;
 *  - a regra de cor: negativo vermelho, ROI positivo verde, lucro positivo neutro.
 */
import { calcularFinanceiro, corFinanceira } from "@/lib/financeiro";

let ok = 0;
let falhas = 0;

function eq(nome, obtido, esperado) {
  const a = typeof obtido === "number" ? Math.round(obtido * 100) / 100 : obtido;
  const b = typeof esperado === "number" ? Math.round(esperado * 100) / 100 : esperado;
  if (JSON.stringify(a) === JSON.stringify(b)) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${JSON.stringify(a)}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${JSON.stringify(a)}\n      esperado: ${JSON.stringify(b)}`);
  }
}

const pct = (type, amount, paymentMethod = null) => ({ type, calc: "PERCENTUAL", amount, paymentMethod });
const fixo = (type, amount) => ({ type, calc: "FIXO", amount, paymentMethod: null });

// ── 1. A cadeia completa ────────────────────────────────────────────────────
console.log("\n\x1b[1mCadeia completa de desconto\x1b[0m");
{
  // R$ 1.000 aprovados, todos por Pix. Gateway 5% (Pix), coprodução 20%,
  // imposto 6%, custo de produto 10%. Anúncios 200, despesa fixa 50.
  const f = calcularFinanceiro({
    bruto: 1000,
    brutoPorPagamento: new Map([["PIX", 1000]]),
    gastoAnuncios: 200,
    despesas: [
      pct("TAXA_GATEWAY", 5, "PIX"),
      pct("COPRODUCAO", 20),
      pct("IMPOSTO", 6),
      pct("CUSTO_PRODUTO", 10),
      fixo("DESPESA_RECORRENTE", 50),
    ],
  });
  eq("gateway 5% de 1000", f.gateway, 50);
  eq("coprodução 20%", f.coproducao, 200);
  eq("imposto 6%", f.impostos, 60);
  eq("custo de produto 10%", f.custoProduto, 100);
  eq("total de descontos", f.totalDescontos, 410);
  eq("LÍQUIDO = 1000 − 410", f.liquido, 590);
  eq("despesa recorrente NÃO entra no líquido", f.despesas, 50);
  eq("LUCRO = 590 − 200 − 50", f.lucro, 340);
  eq("custo total = 410 + 200 + 50", f.custoTotal, 660);
  eq("margem = 340/1000", f.margem, 34);
  eq("ROI = 340/660", f.roi, 0.52);
  eq("nada faltando", f.faltando, []);
}

// ── 2. Base da taxa de gateway é a FORMA DE PAGAMENTO ───────────────────────
console.log("\n\x1b[1mTaxa de gateway por forma de pagamento\x1b[0m");
{
  // 1000 no total: 400 Pix + 600 cartão. Pix 1%, cartão 5%.
  const f = calcularFinanceiro({
    bruto: 1000,
    brutoPorPagamento: new Map([
      ["PIX", 400],
      ["CARTAO", 600],
    ]),
    gastoAnuncios: 0,
    despesas: [pct("TAXA_GATEWAY", 1, "PIX"), pct("TAXA_GATEWAY", 5, "CARTAO")],
  });
  // 1% de 400 = 4; 5% de 600 = 30. Se a base fosse o TOTAL daria 10 + 50 = 60.
  eq("cada taxa incide só sobre a sua forma (4 + 30)", f.gateway, 34);
}
{
  const f = calcularFinanceiro({
    bruto: 1000,
    brutoPorPagamento: new Map([["PIX", 1000]]),
    gastoAnuncios: 0,
    despesas: [pct("TAXA_GATEWAY", 3, null)],
  });
  eq("paymentMethod nulo = incide sobre TUDO", f.gateway, 30);
}

// ── 3. Desconto não cadastrado: zero, MAS denunciado ───────────────────────
console.log("\n\x1b[1mDesconto não cadastrado\x1b[0m");
{
  const f = calcularFinanceiro({
    bruto: 1000,
    brutoPorPagamento: new Map([["PIX", 1000]]),
    gastoAnuncios: 0,
    despesas: [pct("IMPOSTO", 6)],
  });
  eq("só imposto cadastrado -> os outros valem zero", [f.gateway, f.coproducao, f.custoProduto], [0, 0, 0]);
  eq("líquido = 1000 − 60 (parece MAIOR do que é)", f.liquido, 940);
  eq("`faltando` denuncia os três ausentes", f.faltando, ["taxa do gateway", "coprodução", "custo de produto"]);
}
{
  const f = calcularFinanceiro({ bruto: 500, brutoPorPagamento: new Map(), gastoAnuncios: 0, despesas: [] });
  eq("sem NADA cadastrado, líquido = bruto", f.liquido, 500);
  eq("e os quatro descontos são denunciados", f.faltando.length, 4);
}

// ── 4. Prejuízo e ROI indefinido ───────────────────────────────────────────
console.log("\n\x1b[1mPrejuízo e ROI indefinido\x1b[0m");
{
  const f = calcularFinanceiro({
    bruto: 100,
    brutoPorPagamento: new Map([["PIX", 100]]),
    gastoAnuncios: 300,
    despesas: [],
  });
  eq("lucro negativo", f.lucro, -200);
  eq("margem negativa", f.margem, -200);
  eq("ROI = −200/300", f.roi, -0.67);
}
{
  const f = calcularFinanceiro({ bruto: 0, brutoPorPagamento: new Map(), gastoAnuncios: 500, despesas: [] });
  eq("sem faturamento, ROI é o piso −1,00x (matemático, não clamp)", f.roi, -1);
}
{
  // ⚠️ Faturou sem gastar nada: ROI é INDEFINIDO, não zero. "0,00x" se leria
  // como empate para quem só teve lucro.
  const f = calcularFinanceiro({ bruto: 800, brutoPorPagamento: new Map([["PIX", 800]]), gastoAnuncios: 0, despesas: [] });
  eq("custo zero -> ROI null (a tela mostra '—')", f.roi, null);
  eq("mas o lucro existe", f.lucro, 800);
}
{
  const f = calcularFinanceiro({ bruto: 0, brutoPorPagamento: new Map(), gastoAnuncios: 0, despesas: [] });
  eq("tudo zero não divide por zero na margem", f.margem, 0);
}
{
  // 🔴 O caso que o usuário reportou: painel zerado mostrando −1,00x em vermelho.
  // Uma despesa fixa sozinha produzia lucro −20 / custo 20 = −1,00x, e a tela
  // gritava prejuizo num periodo em que nada aconteceu.
  const f = calcularFinanceiro({
    bruto: 0,
    brutoPorPagamento: new Map(),
    gastoAnuncios: 0,
    despesas: [fixo("DESPESA_RECORRENTE", 20)],
  });
  eq("sem venda E sem anuncio -> ROI null, mesmo com despesa fixa", f.roi, null);
  eq("a despesa continua no lucro (ela existe)", f.lucro, -20);
}
eq("zero e NEUTRO, nao verde", corFinanceira(0, "roi"), "var(--color-text)");

// ── 5. Valor FIXO em vez de percentual ─────────────────────────────────────
console.log("\n\x1b[1mDesconto de valor fixo\x1b[0m");
{
  const f = calcularFinanceiro({
    bruto: 1000,
    brutoPorPagamento: new Map([["PIX", 1000]]),
    gastoAnuncios: 0,
    despesas: [fixo("CUSTO_PRODUTO", 47)],
  });
  eq("custo fixo entra pelo valor, não por percentual", f.custoProduto, 47);
}

// ── 6. A regra de cor ──────────────────────────────────────────────────────
console.log("\n\x1b[1mCores\x1b[0m");
const VERM = "var(--color-danger, #f87171)";
const VERDE = "var(--color-success, #4ade80)";
const NORMAL = "var(--color-text)";
eq("lucro negativo -> vermelho", corFinanceira(-23, "lucro"), VERM);
eq("lucro positivo -> cor NORMAL (não verde, e sem '+')", corFinanceira(340, "lucro"), NORMAL);
eq("lucro zero -> normal", corFinanceira(0, "lucro"), NORMAL);
eq("ROI negativo -> vermelho", corFinanceira(-0.87, "roi"), VERM);
eq("ROI positivo -> VERDE", corFinanceira(1.87, "roi"), VERDE);
eq("ROI null -> normal (a tela mostra '—')", corFinanceira(null, "roi"), NORMAL);

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
