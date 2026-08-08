/**
 * O Gerenciador — as três coisas que só o resultado responde.
 *
 * | O quê | Por que um teste de função pura não bastaria |
 * |---|---|
 * | A regra de MEDIÇÃO na tabela | `podeAfirmar` isolada é trivial. O que já quebrou nesta base é o CAMINHO: a coluna que esquece de consultá-la imprime `R$ 0,00` e nada acusa |
 * | O `Insights` lendo `effectiveStatus` | ler `status` compila, passa no lint e **recomenda escalar a campanha que não entrega** |
 * | A reticência da paginação | um `…` a mais some no meio de seis botões |
 *
 * ## 🔬 O teste da medição é DIFERENCIAL, e a direção faz parte dele
 *
 * Ele renderiza o MESMO fixture nos dois estados e compara. Não sabe quais
 * números existem na tela — sabe o que a ausência de medição tem **permissão**
 * de fazer: só REMOVER (`<=`). Se alguém puser uma coluna nova que imprime zero
 * sem consultar a regra, a contagem sobe de um lado só e o teste cai, sem que
 * nenhum número tenha sido escrito na asserção.
 *
 * ⚠️ E toda desigualdade leva a guarda da linha de base junto (`> 0`), senão a
 * contagem vazia satisfaz o `<=` e o teste passa sem olhar nada.
 *
 * ⚠️ Roda com `tsx` (lê `.tsx`), não com `--experimental-strip-types`.
 *
 *   npm run test:gerenciador
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { calcularInsights, ROAS_DE_ATENCAO } from "@/lib/ads/insights";
import { podeAfirmar, precisaDeSelo } from "@/lib/ads/apresentacao";

const { TabelaAds } = await import("../src/components/tk/TabelaAds.tsx");
const { paginasVisiveis } = await import("../src/components/tk/Paginacao.tsx");

let ok = 0;
const falhas = [];
function checar(nome, fn) {
  try {
    fn();
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome}`);
  } catch (e) {
    falhas.push(nome);
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      ${e.message}`);
  }
}
const secao = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

/* ══════════════════════════════════════════════════════════════════════════ */
secao("A REGRA DE MEDIÇÃO — o mesmo fixture nos três estados");

/** Uma linha com gasto zero, vendas atribuídas e faturamento. */
const linhaBase = (medicao) => ({
  id: "c1",
  fbId: "120200",
  nome: "Campanha Cobaia",
  sub: "Vendas",
  status: "ACTIVE",
  effectiveStatus: "ACTIVE",
  medicao,
  spend: 0,
  impressions: 0,
  clicks: 0,
  /* 🔴 COM VENDAS, de propósito: é o que faz `div(spend, results)` devolver
     `0` em vez de `null`. Uma linha sem venda nenhuma esconderia o defeito —
     o CPA sairia "—" pelo denominador zero, e não pela regra de medição. */
  results: 5,
  revenue: 1000,
  ic: 3,
  cliquesAtribuidos: 7,
  vendasIniciadas: 6,
});

const desenhar = (medicao) =>
  renderToStaticMarkup(
    React.createElement(TabelaAds, {
      linhas: [linhaBase(medicao)],
      // "Tudo" — a regra vale para as 19, não só para as seis do padrão.
      colunas: [
        "veiculacao", "orcamento", "gasto", "vendas", "cpa", "faturamento", "lucro",
        "roas", "roiMidia", "ic", "cpi", "cliquesAtr", "vendasInic", "cpc", "ctr",
        "cpm", "impressoes", "cliques", "bid",
      ],
      selecionadas: new Set(),
      aoSelecionar: () => {},
      aoSelecionarTodas: () => {},
      aoAlternarStatus: () => {},
      aoSalvarOrcamento: async () => {},
      ordem: null,
      aoOrdenar: () => {},
      fixadas: new Set(),
      carregando: false,
      vazio: "vazio",
    }),
  );

const medida = desenhar("medida");
const nunca = desenhar("nunca-sincronizada");
const semVeiculacao = desenhar("sem-veiculacao");

const conta = (html, agulha) => html.split(agulha).length - 1;
/** Quantos travessões a tabela imprimiu. */
const tracos = (html) => conta(html, ">—<");

checar("a linha de base AFIRMA: medida imprime R$ 0,00 no gasto", () => {
  // Sem esta guarda, todas as desigualdades abaixo passariam com a tela vazia.
  assert.ok(conta(medida, "R$ 0,00") > 0, "o estado medido precisa imprimir algum R$ 0,00");
  assert.ok(tracos(medida) >= 0);
});

checar("nunca-sincronizada só REMOVE afirmação — nunca acrescenta", () => {
  // A direção: o estado sem medição tem permissão de tirar número, não de pôr.
  assert.ok(conta(nunca, "R$ 0,00") < conta(medida, "R$ 0,00"), "o R$ 0,00 do gasto tinha de sumir");
  assert.ok(tracos(nunca) > tracos(medida), "os travessões tinham de aumentar");
});

checar("sem-veiculacao esconde tanto quanto nunca-sincronizada", () => {
  assert.equal(conta(semVeiculacao, "R$ 0,00"), conta(nunca, "R$ 0,00"));
  assert.equal(tracos(semVeiculacao), tracos(nunca));
});

checar("o que a Trackhub mediu CONTINUA nos três estados", () => {
  /* Faturamento (R$ 1.000,00) e as contagens de 5/3/7/6 são nossas: elas não
     dependem de a Meta ter reportado nada. Se sumirem junto, a tabela deixou de
     mostrar o único dado que ela tem. */
  for (const [nome, html] of [["medida", medida], ["nunca", nunca], ["sem-veiculacao", semVeiculacao]]) {
    assert.ok(html.includes("R$ 1.000,00"), `faturamento sumiu em ${nome}`);
    assert.ok(html.includes(">5<"), `vendas sumiram em ${nome}`);
  }
});

checar("o CPA de R$ 0,00 (div(0, 5)) NÃO aparece sem medição", () => {
  /* O caso mais caro: `div` devolve 0 legitimamente (denominador 5), então a
     célula imprimiria "aquisição de graça" sem a regra de medição. */
  assert.equal(conta(nunca, "R$ 0,00"), 0, "nenhum R$ 0,00 pode sobrar sem medição");
});

checar("só nunca-sincronizada ganha o selo `não sincronizado`", () => {
  assert.ok(nunca.includes("não sincronizado"));
  assert.ok(!semVeiculacao.includes("não sincronizado"));
  assert.ok(!medida.includes("não sincronizado"));
  // E a fonte da verdade concorda com o que foi desenhado.
  assert.equal(precisaDeSelo("nunca-sincronizada"), true);
  assert.equal(precisaDeSelo("sem-veiculacao"), false);
});

checar("a Veiculação e o Orçamento NÃO somem sem medição", () => {
  /* Eles são configuração/fato sobre a entidade, não medição da janela.
     Apagá-los afirmaria que a campanha não tem estado nem teto. */
  assert.ok(nunca.includes("Veiculando"), "o selo de veiculação tem de sobreviver");
  assert.equal(podeAfirmar("nosso", "nunca-sincronizada"), true);
  assert.equal(podeAfirmar("meta", "nunca-sincronizada"), false);
  assert.equal(podeAfirmar("misto", "sem-veiculacao"), false);
  assert.equal(podeAfirmar("meta", "medida"), true);
});

/* ══════════════════════════════════════════════════════════════════════════ */
secao("INSIGHTS — decisão lê o EFETIVO, nunca o configurado");

const campanha = (p) => ({
  id: p.id, nome: p.nome, status: p.status ?? "ACTIVE",
  effectiveStatus: p.effectiveStatus ?? "ACTIVE", medicao: p.medicao ?? "medida",
  spend: p.spend, revenue: p.revenue, results: p.results,
});

/* O caso real do banco de dev: `Retargeting 7d` tem o melhor ROAS da tela e
   está configurada como ATIVA, mas a Meta não a entrega. */
const comParada = [
  campanha({ id: "a", nome: "Entrega Boa", spend: 1000, revenue: 3000, results: 30 }),
  campanha({ id: "b", nome: "Retargeting 7d", effectiveStatus: "CAMPAIGN_PAUSED", spend: 100, revenue: 1110, results: 10 }),
];

checar("a campanha ACTIVE que NÃO entrega não vira `melhor campanha`", () => {
  const c = calcularInsights(comParada).find((i) => i.chave === "melhor-roas");
  assert.ok(c, "o cartão precisa existir — senão a asserção abaixo não mede nada");
  assert.equal(c.campanha, "Entrega Boa");
});

checar("…e ela reaparece como o 5º cartão, condicional", () => {
  const c = calcularInsights(comParada).find((i) => i.chave === "parada-boa");
  assert.ok(c, "a melhor da tela está parada — o cartão tinha de aparecer");
  assert.equal(c.campanha, "Retargeting 7d");
});

checar("o 5º cartão SOME quando a parada não é a melhor", () => {
  const semDestaque = [
    campanha({ id: "a", nome: "Entrega Boa", spend: 1000, revenue: 5000, results: 30 }),
    campanha({ id: "b", nome: "Fraca e parada", effectiveStatus: "PAUSED", spend: 100, revenue: 110, results: 1 }),
  ];
  assert.equal(calcularInsights(semDestaque).some((i) => i.chave === "parada-boa"), false);
  // Guarda da linha de base: o mesmo fixture produz os outros cartões.
  assert.ok(calcularInsights(semDestaque).length >= 3);
});

checar("campanha sem medição não ganha o ranking de menor CPA", () => {
  const comFantasma = [
    campanha({ id: "a", nome: "Real", spend: 1000, revenue: 3000, results: 10 }),
    /* Nunca sincronizou: `spend` é 0 porque não existe linha, não porque foi
       barata. Sem o filtro ela venceria TODOS os rankings de custo de uma vez. */
    campanha({ id: "b", nome: "Fantasma", medicao: "nunca-sincronizada", spend: 0, revenue: 900, results: 9 }),
  ];
  const c = calcularInsights(comFantasma).find((i) => i.chave === "menor-cpa");
  assert.ok(c);
  assert.equal(c.campanha, "Real");
});

checar("o cartão de atenção conta pelo limiar, e FICA quando dá zero", () => {
  const abaixo = calcularInsights([
    campanha({ id: "a", nome: "Ruim", spend: 1000, revenue: 1200, results: 4 }),
    campanha({ id: "b", nome: "Boa", spend: 1000, revenue: 4000, results: 20 }),
  ]).find((i) => i.chave === "atencao");
  assert.ok(abaixo);
  assert.equal(abaixo.tom, "warning");
  assert.ok(abaixo.detalhe.includes("1 campanha"), abaixo.detalhe);

  const nenhuma = calcularInsights([
    campanha({ id: "b", nome: "Boa", spend: 1000, revenue: 4000, results: 20 }),
  ]).find((i) => i.chave === "atencao");
  assert.ok(nenhuma, "o cartão precisa ficar mesmo com zero — senão o painel encolhe no dia bom");
  assert.equal(nenhuma.tom, "neutral");
});

checar("sem campanha elegível, o painel devolve lista VAZIA", () => {
  /* E não cartões com "—". A tela desenha o estado vazio, que diz por quê. */
  const so = [campanha({ id: "x", nome: "Parada", effectiveStatus: "PAUSED", spend: 0, revenue: 0, results: 0 })];
  assert.deepEqual(calcularInsights(so), []);
});

checar("o limiar de atenção é 1,5x e está exportado", () => {
  // Ele aparece no TEXTO do cartão; um número mágico na frase divergiria da conta.
  assert.equal(ROAS_DE_ATENCAO, 1.5);
  const c = calcularInsights([campanha({ id: "a", nome: "Ruim", spend: 1000, revenue: 1200, results: 4 })])
    .find((i) => i.chave === "atencao");
  assert.ok(c.detalhe.includes("1,50x"), c.detalhe);
});

/* ══════════════════════════════════════════════════════════════════════════ */
secao("PAGINAÇÃO — a reticência");

checar("até 7 páginas, todas aparecem", () => {
  assert.deepEqual(paginasVisiveis(1, 7), [1, 2, 3, 4, 5, 6, 7]);
});

checar("no meio de uma lista longa, DUAS reticências", () => {
  assert.deepEqual(paginasVisiveis(5, 10), [1, null, 4, 5, 6, null, 10]);
});

checar("no começo, só uma — e nunca duas seguidas", () => {
  const p = paginasVisiveis(2, 10);
  assert.deepEqual(p, [1, 2, 3, null, 10]);
  assert.ok(!p.some((x, i) => x === null && p[i + 1] === null));
});

checar("a página atual está SEMPRE na lista", () => {
  for (let total = 1; total <= 40; total++) {
    for (let atual = 1; atual <= total; atual++) {
      assert.ok(paginasVisiveis(atual, total).includes(atual), `${atual} de ${total}`);
    }
  }
});

/* ══════════════════════════════════════════════════════════════════════════ */
console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}`
    : `\n\x1b[32m${ok} asserções, todas passaram\x1b[0m`,
);
process.exit(falhas.length ? 1 : 0);
