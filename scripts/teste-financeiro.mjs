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
/** Recorrente com frequência explícita — a que o rateio respeita. */
const rec = (amount, recurrence = "MENSAL") => ({ type: "DESPESA_RECORRENTE", calc: "FIXO", amount, paymentMethod: null, recurrence });

/**
 * ⛔ A JANELA É OBRIGATÓRIA, e aqui ela é um MÊS INTEIRO de propósito.
 *
 * Agosto de 2026 tem 31 dias, e a soma de 1/31 trinta e uma vezes é exatamente
 * 1 — então uma despesa MENSAL vale o valor CHEIO nesta janela. Isso mantém
 * verdadeiras todas as asserções que já existiam, e é o que faz este arquivo
 * distinguir as duas coisas que o rateio pode quebrar:
 *
 *   - asserção que muda AQUI  →  a fórmula está errada (mês inteiro tem de dar
 *                                o valor cheio);
 *   - asserção que muda numa JANELA CURTA  →  é o rateio funcionando.
 *
 * Sem essa escolha, toda asserção mudaria de número ao mesmo tempo e não
 * haveria como separar correção de erro.
 */
const MES = { startKey: "2026-08-01", endKey: "2026-08-31" };

// ── 1. A cadeia completa ────────────────────────────────────────────────────
console.log("\n\x1b[1mCadeia completa de desconto\x1b[0m");
{
  // R$ 1.000 aprovados, todos por Pix. Gateway 5% (Pix), coprodução 20%,
  // imposto 6%, custo de produto 10%. Anúncios 200, despesa fixa 50.
  const f = calcularFinanceiro({ janela: MES,
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
  const f = calcularFinanceiro({ janela: MES,
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
  const f = calcularFinanceiro({ janela: MES,
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
  const f = calcularFinanceiro({ janela: MES,
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
  const f = calcularFinanceiro({ janela: MES, bruto: 500, brutoPorPagamento: new Map(), gastoAnuncios: 0, despesas: [] });
  eq("sem NADA cadastrado, líquido = bruto", f.liquido, 500);
  eq("e os quatro descontos são denunciados", f.faltando.length, 4);
}

// ── 4. Prejuízo e ROI indefinido ───────────────────────────────────────────
console.log("\n\x1b[1mPrejuízo e ROI indefinido\x1b[0m");
{
  const f = calcularFinanceiro({ janela: MES,
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
  const f = calcularFinanceiro({ janela: MES, bruto: 0, brutoPorPagamento: new Map(), gastoAnuncios: 500, despesas: [] });
  eq("sem faturamento, ROI é o piso −1,00x (matemático, não clamp)", f.roi, -1);
}
{
  // ⚠️ Faturou sem gastar nada: ROI é INDEFINIDO, não zero. "0,00x" se leria
  // como empate para quem só teve lucro.
  const f = calcularFinanceiro({ janela: MES, bruto: 800, brutoPorPagamento: new Map([["PIX", 800]]), gastoAnuncios: 0, despesas: [] });
  eq("custo zero -> ROI null (a tela mostra '—')", f.roi, null);
  eq("mas o lucro existe", f.lucro, 800);
}
{
  const f = calcularFinanceiro({ janela: MES, bruto: 0, brutoPorPagamento: new Map(), gastoAnuncios: 0, despesas: [] });
  /* ⚠️ Esta assercao ESPERAVA 0, e o 0 era o defeito. Ela provava que nao havia
     divisao por zero — e nao havia mesmo —, mas travava no lugar a resposta
     errada para a pergunta seguinte: "0%" de margem afirma que se vendeu e nada
     sobrou. Sem faturamento nao ha margem a medir. Teste que codifica o
     comportamento antigo defende o bug de quem for consertar. */
  eq("sem faturamento -> margem null (a tela mostra '—'), nunca 0%", f.margem, null);
}
{
  // 🔴 O caso que o usuário reportou: painel zerado mostrando −1,00x em vermelho.
  // Uma despesa fixa sozinha produzia lucro −20 / custo 20 = −1,00x, e a tela
  // gritava prejuizo num periodo em que nada aconteceu.
  const f = calcularFinanceiro({ janela: MES,
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
  const f = calcularFinanceiro({ janela: MES,
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

// ⚠️ O ROAS tem OUTRO ponto de equilíbrio: 1x. "0,80x" é um número positivo
// e é PREJUÍZO — cada R$ 1 de anúncio devolveu 80 centavos.
eq("ROAS 0,80x -> VERMELHO (abaixo de 1 é prejuízo)", corFinanceira(0.8, "roas"), VERM);
eq("ROAS 0,00x -> vermelho (gastou e não faturou)", corFinanceira(0, "roas"), VERM);
eq("ROAS 1,00x -> normal (empate exato)", corFinanceira(1, "roas"), NORMAL);
eq("ROAS 2,35x -> VERDE", corFinanceira(2.35, "roas"), VERDE);
eq("ROAS null (sem gasto) -> normal, não vermelho", corFinanceira(null, "roas"), NORMAL);
// O mesmo 0,80 no ROI é LUCRO de 80% — a prova de que os cortes são distintos.
eq("o MESMO 0,80 no ROI é verde", corFinanceira(0.8, "roi"), VERDE);


// ── 6. Taxa REAL do gateway × taxa cadastrada (etapa 4) ─────────────────────
//
// Período MISTO é o caso NORMAL, não a exceção: basta ter dois gateways, ou um
// que só informe a taxa em parte dos eventos (a Kirvano manda em 36 de 46).
// O que não pode acontecer é o Faturamento Líquido somar medida com estimativa
// sem dizer qual é qual.
console.log("\n\x1b[1mTaxa reportada pelo gateway\x1b[0m");
{
  const PIX = "PIX";
  const taxa5 = pct("TAXA_GATEWAY", 5);
  const base = (vendas, despesas = [taxa5]) =>
    calcularFinanceiro({ janela: MES,
      bruto: vendas.reduce((a, v) => a + v.valor, 0),
      brutoPorPagamento: new Map([[PIX, vendas.reduce((a, v) => a + v.valor, 0)]]),
      gastoAnuncios: 0,
      despesas,
      vendas,
    });

  const real = base([{ valor: 100, formaPagamento: PIX, taxaGateway: 7.5, coproducao: null , chavePedido: "p1" }]);
  eq("gateway informou → a taxa cadastrada é ignorada naquela venda", real.gateway, 7.5);
  eq("  e a procedência fica registrada", real.fontes.gateway.real, 7.5);

  // ⚠️ Se a base da taxa cadastrada não encolhesse, daria 7,50 + 10,00 = 17,50 —
  // descontando DUAS VEZES da venda que já informou a própria taxa.
  const misto = base([
    { valor: 100, formaPagamento: PIX, taxaGateway: 7.5, coproducao: null , chavePedido: "p2" },
    { valor: 100, formaPagamento: PIX, taxaGateway: null, coproducao: null , chavePedido: "p3" },
  ]);
  eq("MISTO: 7,50 real + 5,00 cadastrada, sem dupla contagem", misto.gateway, 12.5);
  eq("  vendas com valor real", misto.fontes.gateway.vendasComValorReal, 1);
  eq("  vendas pela taxa cadastrada", misto.fontes.gateway.vendasSemValorReal, 1);

  // A REGRA 1 do contrato de gateways, no lugar onde ela custa dinheiro.
  eq("gateway informou ZERO → desconta nada",
    base([{ valor: 100, formaPagamento: PIX, taxaGateway: 0, coproducao: null , chavePedido: "p4" }]).gateway, 0);
  eq("gateway NÃO informou → cai nos 5% cadastrados",
    base([{ valor: 100, formaPagamento: PIX, taxaGateway: null, coproducao: null , chavePedido: "p5" }]).gateway, 5);

  // Cobrar cadastro de um número que já é medido treinaria o usuário a ignorar
  // o aviso — que é o oposto do que ele existe para fazer.
  const tudoReal = base([{ valor: 100, formaPagamento: PIX, taxaGateway: 7.5, coproducao: 10 , chavePedido: "p6" }], []);
  eq("todas informaram → para de cobrar cadastro de taxa", tudoReal.faltando.includes("taxa do gateway"), false);
  eq("  e de coprodução", tudoReal.faltando.includes("coprodução"), false);
  eq("  mas imposto continua faltando (ninguém informou)", tudoReal.faltando.includes("imposto"), true);

  const metade = base([
    { valor: 100, formaPagamento: PIX, taxaGateway: 7.5, coproducao: null , chavePedido: "p7" },
    { valor: 100, formaPagamento: PIX, taxaGateway: null, coproducao: null , chavePedido: "p8" },
  ], []);
  eq("mistura AINDA cobra cadastro — metade depende dele", metade.faltando.includes("taxa do gateway"), true);

  // Chamador antigo (sem a lista de vendas) não pode mudar de comportamento.
  const semLista = calcularFinanceiro({ janela: MES,
    bruto: 100, brutoPorPagamento: new Map([[PIX, 100]]), gastoAnuncios: 0, despesas: [taxa5],
  });
  eq("sem lista de vendas, comportamento é o de ANTES", semLista.gateway, 5);
}

// ── 1.3: "Todas as formas" incide sobre TUDO, nao so sobre OUTRO ──────────
{
  console.log("\n\x1b[1mTaxa por forma de pagamento (1.3)\x1b[0m\n");
  const porPagamento = new Map([["PIX", 100], ["CARTAO", 100], ["OUTRO", 100]]);
  const base = { bruto: 300, brutoPorPagamento: porPagamento, gastoAnuncios: 0 };

  // Taxa GLOBAL (paymentMethod null) -> 10% de 300 = 30
  const global = calcularFinanceiro({ janela: MES,
    ...base,
    despesas: [{ type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount: 10, paymentMethod: null }],
  });
  eq("taxa global incide sobre o faturamento inteiro", (global.gateway), 30);

  // A MESMA taxa marcada como OUTRO -> so 10% dos 100 de OUTRO = 10
  const soOutro = calcularFinanceiro({ janela: MES,
    ...base,
    despesas: [{ type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount: 10, paymentMethod: "OUTRO" }],
  });
  eq("a MESMA taxa como OUTRO pega so um terco (era o bug)", (soOutro.gateway), 10);

  // Pix 10% + cartao 30% nao se misturam
  const misto = calcularFinanceiro({ janela: MES,
    ...base,
    despesas: [
      { type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount: 10, paymentMethod: "PIX" },
      { type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount: 30, paymentMethod: "CARTAO" },
    ],
  });
  eq("Pix 10% + cartao 30% = 10 + 30, cada um sobre a propria base", (misto.gateway), 40);

  // Global + especifica somam (o usuario pode ter as duas)
  const ambas = calcularFinanceiro({ janela: MES,
    ...base,
    despesas: [
      { type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount: 10, paymentMethod: null },
      { type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount: 30, paymentMethod: "CARTAO" },
    ],
  });
  eq("global + especifica somam", (ambas.gateway), 60);
}


/**
 * ─────────── Os TRÊS MODOS de cobrança (05/08/2026) ───────────
 *
 * 🔴 `FIXO` incidia UMA VEZ no período inteiro (`return e.amount`, sem
 * multiplicar). Uma taxa de "R$ 2,50 por venda" com 40 vendas descontava
 * R$ 2,50 — o Faturamento Líquido saía R$ 97,50 MAIOR que a realidade, com o
 * número continuando plausível.
 */
console.log("");
console.log("Tres modos: % por venda / R$ por venda / R$ por mes");
{
  const PIX = "PIX";
  const venda = (v, pedido, taxa = null) => ({
    valor: v, formaPagamento: PIX, taxaGateway: taxa, coproducao: null, chavePedido: pedido,
  });
  const rodar = (vendas, despesas) =>
    calcularFinanceiro({ janela: MES,
      bruto: vendas.reduce((a, v) => a + v.valor, 0),
      brutoPorPagamento: new Map([[PIX, vendas.reduce((a, v) => a + v.valor, 0)]]),
      gastoAnuncios: 0,
      despesas,
      vendas,
    });

  const tresVendas = [venda(100, "p1"), venda(100, "p2"), venda(100, "p3")];

  // Modo 1 — % por venda (o que já existia).
  eq("% por venda: 5% de 300",
    rodar(tresVendas, [{ type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount: 5, paymentMethod: null }]).gateway, 15);

  // Modo 2 — R$ por venda. É o que estava quebrado.
  eq("R$ por venda: 2,50 x 3 PEDIDOS",
    rodar(tresVendas, [{ type: "TAXA_GATEWAY", calc: "FIXO", amount: 2.5, paymentMethod: null }]).gateway, 7.5);

  // ⛔ A asserção que dá sentido à anterior: order bump NÃO cobra duas vezes.
  // Um checkout com bump é 2 linhas e 1 conversão.
  const comBump = [venda(90, "pedido-A"), venda(27, "pedido-A"), venda(100, "pedido-B")];
  eq("order bump: 2 linhas, 1 pedido -> 2 cobrancas, nao 3",
    rodar(comBump, [{ type: "TAXA_GATEWAY", calc: "FIXO", amount: 2.5, paymentMethod: null }]).gateway, 5);
  eq("  e o faturamento continua somando as LINHAS",
    rodar(comBump, []).bruto, 217);

  // Modo 3 — R$ por mês. Não incide sobre venda nenhuma.
  const mensal = rodar(tresVendas, [
    { type: "DESPESA_RECORRENTE", calc: "FIXO", amount: 97, paymentMethod: null },
  ]);
  eq("R$ por mes: cobrado uma vez, nao por venda", mensal.despesas, 97);
  eq("  e nao entra nos descontos sobre faturamento", mensal.totalDescontos, 0);
  eq("  mas entra no lucro", mensal.lucro, 300 - 97);

  // A taxa fixa por FORMA DE PAGAMENTO conta só os pedidos daquela forma.
  const misturado = [
    { ...venda(100, "p1"), formaPagamento: "PIX" },
    { ...venda(100, "p2"), formaPagamento: "CARTAO" },
    { ...venda(100, "p3"), formaPagamento: "CARTAO" },
  ];
  eq("R$ fixo do cartao nao cobra as vendas por Pix",
    calcularFinanceiro({ janela: MES,
      bruto: 300,
      brutoPorPagamento: new Map([["PIX", 100], ["CARTAO", 200]]),
      gastoAnuncios: 0,
      despesas: [{ type: "TAXA_GATEWAY", calc: "FIXO", amount: 1, paymentMethod: "CARTAO" }],
      vendas: misturado,
    }).gateway, 2);

  // E a base encolhe também no modo fixo: quem já informou a taxa não paga a cadastrada.
  const parcial = [venda(100, "p1", 7.5), venda(100, "p2"), venda(100, "p3")];
  eq("R$ por venda so cobra os pedidos SEM taxa informada",
    rodar(parcial, [{ type: "TAXA_GATEWAY", calc: "FIXO", amount: 2, paymentMethod: null }]).gateway,
    7.5 + 4);

  // Imposto e custo de produto também aceitam valor por venda.
  eq("imposto R$ por venda: 1,00 x 3",
    rodar(tresVendas, [{ type: "IMPOSTO", calc: "FIXO", amount: 1, paymentMethod: null }]).impostos, 3);
  eq("custo de produto R$ por venda: 10 x 3",
    rodar(tresVendas, [{ type: "CUSTO_PRODUTO", calc: "FIXO", amount: 10, paymentMethod: null }]).custoProduto, 30);

  // ⚠️ Chamador LEGADO (sem lista de vendas) mantém o comportamento anterior:
  // fixo incide uma vez. Ele não tem como saber quantas compras houve, e
  // chutar zero apagaria a despesa em silêncio.
  eq("sem lista de vendas, o fixo incide UMA vez (comportamento antigo)",
    calcularFinanceiro({ janela: MES,
      bruto: 300, brutoPorPagamento: new Map([[PIX, 300]]), gastoAnuncios: 0,
      despesas: [{ type: "TAXA_GATEWAY", calc: "FIXO", amount: 2.5, paymentMethod: null }],
    }).gateway, 2.5);
}


// ── RATEIO DA DESPESA RECORRENTE ────────────────────────────────────────────
//
// 🔴 ESTE BLOCO EXISTE PORQUE AS 70 ASSERÇÕES ANTERIORES NÃO PODIAM FALHAR PELO
// RATEIO. Todas usam janela de mês inteiro, onde MENSAL vale 1,0 — então elas
// provam que a correção NÃO QUEBROU NADA, e não provam que ela FUNCIONA. São
// coisas diferentes, e só a segunda defende o conserto do próximo commit.
console.log("\n\x1b[1mRateio da despesa recorrente\x1b[0m");
{
  const so = (despesas, janela) =>
    calcularFinanceiro({ janela, bruto: 1000, brutoPorPagamento: new Map(), gastoAnuncios: 0, despesas }).despesas;

  // O CONTROLE: mês inteiro cobra o valor cheio. Sem ele, "rateou" seria
  // indistinguível de "sumiu com a despesa".
  eq("MENSAL em mês inteiro = valor cheio", so([rec(500)], MES), 500);

  // 3 dias de agosto (31 dias): 3/31 de 500 = 48,39
  eq("MENSAL em 3 dias = 3/31 do valor", so([rec(500)], { startKey: "2026-08-01", endKey: "2026-08-03" }), 500 * 3 / 31);

  /* JANELA QUE CRUZA MÊS — o caso que obrigou a somar dia a dia. 30/07, 31/07
     e 01/08: dois dias de julho (31 dias) e um de agosto (31 dias). Com um
     divisor médio de 30 fixo o número sairia diferente, e erraria mais quanto
     mais curta a janela. */
  eq(
    "MENSAL cruzando o mês soma dia a dia, com o divisor de CADA mês",
    so([rec(500)], { startKey: "2026-07-30", endKey: "2026-08-01" }),
    500 * (2 / 31 + 1 / 31),
  );

  /* FEVEREIRO prova que o divisor é do mês, não uma constante: 3 dias de
     fevereiro valem MAIS que 3 dias de agosto, porque o mês é mais curto. */
  const fev = so([rec(500)], { startKey: "2026-02-01", endKey: "2026-02-03" });
  const ago = so([rec(500)], { startKey: "2026-08-01", endKey: "2026-08-03" });
  eq("3 dias de fevereiro custam MAIS que 3 de agosto", fev > ago, true);
  eq("  …e é exatamente 3/28 (2026 não é bissexto)", fev, 500 * 3 / 28);

  /* 🔴 ANUAL — o caso mais dramático, e o que mais doía: R$ 6.000 entravam
     INTEIROS num Dashboard filtrado em "Hoje". */
  eq("ANUAL num dia = 1/365, não o valor cheio", so([rec(6000, "ANUAL")], { startKey: "2026-08-06", endKey: "2026-08-06" }), 6000 / 365);
  eq("ANUAL em ano bissexto usa 366", so([rec(6000, "ANUAL")], { startKey: "2028-08-06", endKey: "2028-08-06" }), 6000 / 366);

  // DIARIA MULTIPLICA pelos dias — antes aparecia uma vez só.
  eq("DIARIA em 5 dias = 5x o valor", so([rec(50, "DIARIA")], { startKey: "2026-08-01", endKey: "2026-08-05" }), 250);

  eq("SEMANAL em 14 dias = 2x o valor", so([rec(100, "SEMANAL")], { startKey: "2026-08-01", endKey: "2026-08-14" }), 200);

  /* ⛔ UNICA fica FORA do cálculo: o schema não guarda quando ela ocorreu, e
     contá-la em toda janela (o que se fazia) é pior que omiti-la. */
  eq("UNICA não entra no cálculo", so([rec(999, "UNICA")], MES), 0);
  eq("  …e não contamina as outras", so([rec(999, "UNICA"), rec(500)], MES), 500);

  /* A frequência AUSENTE cai em MENSAL — o padrão do schema. É o caminho de
     todo chamador antigo, e precisa continuar previsível. */
  eq("sem `recurrence`, vale MENSAL", so([fixo("DESPESA_RECORRENTE", 500)], MES), 500);

  /* 🔴 A ASSERÇÃO QUE PROVA O BUG ANTIGO. Antes, TODAS estas devolviam o valor
     cheio — era o mesmo número para janela de 1 dia e de um mês, para mensal e
     para anual. Se alguém reintroduzir `+= e.amount`, esta linha cai. */
  const umDia = { startKey: "2026-08-06", endKey: "2026-08-06" };
  eq("um dia NÃO cobra a mensalidade inteira", so([rec(500)], umDia) < 500, true);
  eq("  …nem a anual", so([rec(6000, "ANUAL")], umDia) < 6000, true);
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);

