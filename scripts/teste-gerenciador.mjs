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
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { calcularInsights, ROAS_DE_ATENCAO } from "@/lib/ads/insights";
import { podeAfirmar, precisaDeSelo } from "@/lib/ads/apresentacao";

const { TabelaAds } = await import("../src/components/tk/TabelaAds.tsx");
const { paginasVisiveis } = await import("../src/components/tk/Paginacao.tsx");
const { BarraSelecao } = await import("../src/components/tk/BarraSelecao.tsx");

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

/* ══════════════════════════════════════════════════════════════════════════
   A BARRA DE SELEÇÃO NÃO PODE MOVER A TABELA

   🐛 O caso, medido na tela em 08/08/2026: a barra ficava no fluxo, acima da
   tabela. Ao aparecer com a primeira marcação ela empurrava tudo abaixo dela
   36px — uma altura de linha exata —, e quem marcava a linha 1 e mirava o
   checkbox da linha 2 acertava a linha 1 de novo.

   ## ⚠️ O LIMITE DESTA GUARDA, escrito nela porque ela não mede pixel

   A propriedade que o dono pediu é geométrica: *"com a barra visível, o topo da
   primeira linha está na mesma coordenada de quando ela está oculta"*. Medir
   isso exige um motor de LAYOUT, e não há um aqui — `renderToStaticMarkup`
   devolve markup, e o jsdom não calcula posição.

   ⛔ E a versão "óbvia" seria pior que ausente: simular as duas alturas em JS e
   compará-las é reescrever o componente já consertado sem o defeito, com os
   dois lados iguais **por construção**. É a armadilha do `test:blocos-vazios`,
   e a saída aqui é a mesma — atacar a CAUSA em vez do sintoma.

   A causa tem duas metades, e as duas são verificáveis sem layout:

     1. a barra é irmã DEPOIS da tabela, não antes dela;
     2. a camada que a segura é `position: absolute`, que por definição do CSS
        não desloca irmão nenhum.

   Juntas elas implicam a coordenada. Se alguém devolver a barra ao fluxo — que
   é o único jeito de o bug voltar —, uma das duas cai. */
const TELA = fs.readFileSync("src/components/dashboard/views/gerenciador/GerenciadorScreen.tsx", "utf8");

checar("a barra vem DEPOIS da tabela, nunca no fluxo acima dela", () => {
  const barra = TELA.indexOf("<BarraSelecao");
  const tabela = TELA.indexOf("<TabelaAds");
  assert.ok(barra !== -1, "não achei <BarraSelecao na tela — o casamento de string envelheceu");
  assert.ok(tabela !== -1, "não achei <TabelaAds na tela — o casamento de string envelheceu");
  /* A linha de base afirma: os dois existem e são comparáveis. Sem ela, um
     `-1 > -1` passaria com o arquivo renomeado. */
  assert.ok(barra > tabela, "a BarraSelecao voltou para o fluxo ACIMA da tabela — ela empurra as linhas");
});

checar("a camada da barra é `absolute`, que é o que não desloca irmão", () => {
  const camada = TELA.indexOf("data-camada-selecao");
  assert.ok(camada !== -1, "a camada da barra sumiu");
  /* Só o trecho da camada até a barra — para não casar com um `absolute`
     qualquer de outro canto do arquivo. */
  const trecho = TELA.slice(camada, TELA.indexOf("<BarraSelecao"));
  assert.match(trecho, /position:\s*"absolute"/, "a camada saiu do `absolute` e voltou a ocupar altura");
  assert.match(trecho, /inset:\s*0/);
});

checar("a camada NÃO recebe ponteiro — senão come o clique do checkbox", () => {
  const camada = TELA.indexOf("data-camada-selecao");
  const trecho = TELA.slice(camada, TELA.indexOf("<BarraSelecao"));
  /* Ela cobre a tabela inteira. Sem isto, a própria camada bloquearia os
     checkboxes que a alimentam — e a segunda marcação ficaria impossível, que
     é um jeito novo de reproduzir o mesmo sintoma. */
  assert.match(trecho, /pointerEvents:\s*"none"/);
  assert.match(trecho, /pointerEvents:\s*"auto"/, "a barra dentro da camada precisa voltar a receber clique");
});

checar("flutuante troca o TINTE translúcido por fundo opaco e sombra", () => {
  /* Fora do fluxo, o `bg-tint-primary` deixaria as linhas da tabela aparecerem
     por baixo do texto das ações. É a mesma família do traço da pílula do
     funil: o elemento existe no DOM e não se lê na tela. */
  const props = {
    nivel: "campaign",
    selecionados: [{ id: "1", nome: "[DEV] Escala Principal" }],
    ocupado: false,
    resultado: null,
    aoExecutar: async () => {},
    aoLimpar: () => {},
    aoFixar: () => {},
    aoCopiarId: () => {},
    aoAbrirNoFacebook: () => {},
  };
  const noFluxo = renderToStaticMarkup(React.createElement(BarraSelecao, props));
  const flutuando = renderToStaticMarkup(React.createElement(BarraSelecao, { ...props, flutuante: true }));

  // A linha de base AFIRMA, senão os dois `ok` abaixo passariam com markup vazio.
  assert.ok(noFluxo.includes("bg-tint-primary"), "o modo em fluxo perdeu o tinte — a linha de base não mede mais nada");
  assert.ok(!flutuando.includes("bg-tint-primary"), "flutuante manteve o tinte translúcido");
  assert.match(flutuando, /box-shadow/);
  assert.match(flutuando, /--tk-surface-hover/);
});

checar("os tokens que a barra flutuante usa EXISTEM no globals.css", () => {
  /* ⚠️ Eu inventei `--tk-surface-raised` e `--tk-shadow-pop` ao escrever isto.
     Os dois compilam, passam no lint e caem no fallback — cor errada, sombra
     nenhuma, e nada acusa. Token é casamento de string com o CSS. */
  const css = fs.readFileSync("src/app/globals.css", "utf8");
  for (const t of ["--tk-surface-hover", "--tk-border", "--tk-shadow-overlay"]) {
    assert.ok(css.includes(`${t}:`), `${t} não está declarado no globals.css`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════ */
console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}`
    : `\n\x1b[32m${ok} asserções, todas passaram\x1b[0m`,
);
process.exit(falhas.length ? 1 : 0);
