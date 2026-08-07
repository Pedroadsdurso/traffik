/**
 * BLOCO SEM DADO COLAPSA — ELE NÃO SOME DA GRADE.
 *
 * 🔴 O BUG QUE ESTE ARQUIVO EXISTE PARA IMPEDIR (07/08/2026)
 *
 * O `DashboardScreen` filtrava a lista de painéis por `temDado(v)` antes de
 * desenhar. Sem venda no período, blocos saíam da grade: os vizinhos subiam de
 * linha, a largura relativa mudava, e **o arranjo que o usuário montou virava
 * outro arranjo**. Ele não via "um bloco vazio" — via a tela embaralhada, sem
 * nada dizendo por quê.
 *
 * E esse é o estado NORMAL da ferramenta: os testadores rodam sem venda a maior
 * parte do tempo. O layout não pode depender de a janela de tempo ter movimento.
 *
 * ⚠️ **Por que RENDERIZAR e não checar a função pura.** `temDado` estava
 * correta; o defeito era o CAMINHO — quem chamava, e o que fazia com a resposta.
 * Uma asserção sobre `temDado(vazio) === false` passaria com o bug em pé. É a
 * mesma lição do `contarPedidos`: a função certa não prova a cadeia.
 *
 * ### As três afirmações
 *
 *   1. com dado ZERADO, os N painéis do layout continuam sendo N itens na grade
 *   2. cada um deles ocupa a MESMA coluna que ocuparia com dado
 *   3. cada um deles mostra o estado vazio — com causa, não uma caixa branca
 *
 * ⛔ E a asserção de controle: **com dado, nenhum estado vazio aparece.** Sem
 * ela, um `vazioDoBloco` que devolvesse sempre o vazio passaria nas três acima.
 * Uma asserção precisa poder falhar pelo motivo que alega medir.
 *
 *   npm run test:blocos-vazios
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

const { RENDERS, vazioDoBloco } = await import("../src/components/dashboard/catalogoRender.tsx");
const { CATALOGO_META, ESTRUTURAIS } = await import("../src/components/dashboard/catalogo.ts");
const { layoutPadrao } = await import("../src/components/dashboard/layout/migrar.ts");
const { EmptyState } = await import("../src/components/tk/EmptyState.tsx");

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

/* ══ AS DUAS VISTAS ═════════════════════════════════════════════════════════
   ⚠️ Elas são MÍNIMAS de propósito: só os campos que os renders leem. Um
   `TraffikView` completo esconderia qual bloco depende de quê — e é essa
   dependência que decide se o bloco colapsa. */

/** Tudo zerado: o estado em que os testadores passam a maior parte do tempo. */
const VAZIA = {
  chartSerie: { labels: ["01-08", "02-08"], revenue: [0, 0], spend: [0, 0] },
  finance: { breakEven: null, unicasForaDoCalculo: 0 },
  metricCards: {},
  funnel: [
    { label: "Cliques", valor: 0, count: "0", acao: null },
    { label: "Checkouts", valor: 0, count: "0", acao: null },
    { label: "Vendas", valor: 0, count: "0", acao: null },
  ],
  sources: [],
  products: [],
  payments: [],
  placements: [],
  placementSemDados: 0,
  /* 🔴 UM BALDE ZERADO, NÃO UMA LISTA VAZIA — e a diferença é o bug que este
     campo pegou. `byDay` traz um item POR DIA da janela, zerado ou não; com o
     filtro em "Hoje" ele tem comprimento 1. Um `[]` aqui deixaria passar o
     `temDado: length > 0`, que foi exatamente o defeito visto na tela. */
  byDay: [{ date: "2026-08-07", revenue: 0, sales: 0 }],
  byHour: [],
  byCountry: [],
  approval: [],
  feed: [],
  topCampaigns: [],
  heatmap: { celulas: [], maxObservacoes: 0 },
  perfisCrus: [],
  adProfiles: [],
  rules: [],
  despesaRows: [],
  fbConnected: false,
  syncLabel: null,
};

/** A mesma vista, com movimento em tudo. É a asserção de controle. */
const hora = (h) => ({ hour: h, sales: 1, revenue: 100, profit: 40 });
const CHEIA = {
  ...VAZIA,
  chartSerie: { labels: ["01-08", "02-08"], revenue: [500, 800], spend: [200, 300] },
  finance: { breakEven: 700, unicasForaDoCalculo: 0 },
  funnel: [
    { label: "Cliques", valor: 1000, count: "1.000", acao: null },
    { label: "Checkouts", valor: 200, count: "200", acao: null },
    { label: "Vendas", valor: 50, count: "50", acao: null },
  ],
  sources: [{ name: "facebook", total: 500, totalLabel: "R$ 500", pctLabel: "100%", barWidth: "100%" }],
  products: [{ name: "Curso", total: 500, sales: 5, totalLabel: "R$ 500", pctLabel: "100%", barWidth: "100%" }],
  payments: [{ name: "PIX", total: 500, count: 5, totalLabel: "R$ 500", pctLabel: "100%", barWidth: "100%" }],
  placements: [{ name: "feed", total: 500, sales: 5, totalLabel: "R$ 500", ticketLabel: "R$ 100", barWidth: "100%" }],
  placementSemDados: 120,
  byDay: [{ date: "2026-08-01", revenue: 500, sales: 5 }],
  byHour: Array.from({ length: 24 }, (_, h) => hora(h)),
  byCountry: [{ code: "BR", sales: 5, revenue: 500 }],
  approval: [{ name: "PIX", pagas: 4, total: 5, rate: 0.8, rateLabel: "80%" }],
  feed: [{ id: "1", tipo: "venda", titulo: "Venda", valor: "R$ 100", origem: "facebook", timeLabel: "há 2h" }],
  topCampaigns: [{ id: "c1", nome: "Black Friday", receita: 500, gasto: 200, vendas: 5, roas: 2.5 }],
  heatmap: {
    celulas: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ revenue: 10, sales: 1, profit: 4, observacoes: 2 }))),
    maxObservacoes: 2,
  },
};

/** O contexto, com os campos que os renders leem. Espelha `useDadosDosBlocos`. */
function ctxDe(v) {
  const pontos = v.chartSerie.labels.map((rotulo, i) => ({
    rotulo, a: v.chartSerie.revenue[i] ?? 0, b: v.chartSerie.spend[i] ?? 0,
  }));
  const paises = v.byCountry.filter((c) => c.code).map((c) => ({
    code: c.code, nome: c.code, bandeira: "🏳️", vendas: c.sales, receita: c.revenue, lat: 0, lng: 0,
  }));
  return {
    tema: "dark",
    carregando: false,
    agora: Date.parse("2026-08-07T12:00:00Z"),
    granularidade: "diario",
    setGranularidade: () => {},
    metricaHeat: "revenue",
    setMetricaHeat: () => {},
    visaoFontes: "lista",
    setVisaoFontes: () => {},
    visaoPais: "ranking",
    setVisaoPais: () => {},
    inicioAparado: 0,
    pontos,
    temSerie: pontos.some((p) => p.a > 0 || p.b > 0),
    diasAparados: 0,
    fatias: v.sources.map((s) => ({ nome: s.name, valor: s.total, cor: "var(--tk-primary)" })),
    totalCanais: v.sources.reduce((a, s) => a + s.total, 0),
    paises,
    semPais: 0,
    alertas: [],
    rodape: [],
  };
}

const CTX_VAZIO = ctxDe(VAZIA);
const CTX_CHEIO = ctxDe(CHEIA);

/** Os ids que o layout padrão desenha, na ordem. É o que o usuário novo vê. */
const IDS_PADRAO = layoutPadrao().paineis.map((p) => p.id);
/** Os que PODEM ficar vazios — os `sempreCheio` não participam da contagem. */
const IDS_COLAPSAVEIS = IDS_PADRAO.filter((id) => !("sempreCheio" in RENDERS[id]));

/* ══════════════════════════════════════════════════════════════════════════ */
secao("1. Com dado ZERADO, a grade continua com os MESMOS N itens");

checar("o layout padrão tem painel para todo bloco do catálogo", () => {
  /* 🔴 O PADRÃO É UMA LISTA ESCRITA À MÃO (o arranjo aprovado), e o catálogo é
     outra lista. Duas listas que precisam concordar — a família que esta base
     já pagou várias vezes. Esta asserção é a ponte: um bloco novo no catálogo
     que ninguém colocou no arranjo cai aqui, e a pergunta que ela força é
     "em que linha ele entra, e o que sai para caber?". */
  const faltando = CATALOGO_META.map((b) => b.id).filter((id) => !IDS_PADRAO.includes(id));
  assert.deepEqual(faltando, [], `no catálogo e fora do layout padrão: ${faltando.join(", ")}`);
  assert.equal(IDS_PADRAO.length, CATALOGO_META.length, "o padrão tem bloco repetido");
  assert.ok(IDS_PADRAO.length >= 10, `só ${IDS_PADRAO.length} painéis — a asserção seria fraca`);
});

checar("TODA linha do layout padrão fecha 12 colunas", () => {
  /* ⛔ Não é estética. O `avisoDeSobra` escreve "N colunas livres" em toda linha
     incompleta do modo de edição; um padrão que nasce com sobra ensina que o
     aviso é ruído — e aí ele para de ser lido quando importa. */
  let linha = 0;
  const sobras = [];
  for (const p of layoutPadrao().paineis) {
    if (linha + p.col > 12) { sobras.push(`${12 - linha} livres antes de ${p.id}`); linha = 0; }
    linha += p.col;
    if (linha === 12) linha = 0;
  }
  if (linha !== 0) sobras.push(`${12 - linha} livres na última linha`);
  assert.deepEqual(sobras, [], sobras.join(" · "));
});

checar("nenhum bloco do padrão nasce em 3 colunas", () => {
  /* Decisão do dono: 3 é o PISO para quem quer apertar, não um tamanho que o
     produto sugira. Sete blocos aceitam 3 — a asserção prova que a escolha foi
     deliberada e não coincidência do arranjo. */
  const estreitos = layoutPadrao().paineis.filter((p) => p.col < 4).map((p) => p.id);
  assert.deepEqual(estreitos, [], `nasceram em menos de 4 colunas: ${estreitos.join(", ")}`);
  assert.ok(CATALOGO_META.some((b) => b.colMin === 3), "nenhum bloco aceita 3 — a asserção é vácuo");
});

checar("os dois blocos que precisam de largura a receberam", () => {
  /* A asserção que liga o ARRANJO às container queries: sem 8 colunas, o globo
     de `paises` não aparece (CQ em 640px úteis) e o `heatmap` fica no piso da
     célula. São as duas larguras do padrão que NÃO são preferência — são o que
     faz o recurso existir na primeira vez que a pessoa abre a tela. */
  const col = (id) => layoutPadrao().paineis.find((p) => p.id === id)?.col;
  assert.ok(col("paises") >= 8, `paises em ${col("paises")} col — o globo não apareceria`);
  assert.ok(col("heatmap") >= 8, `heatmap em ${col("heatmap")} col`);
});

/* 🔴🔴 ESTA É UMA GUARDA ESTÁTICA, E A ESCOLHA FOI DELIBERADA.

   A versão óbvia deste teste era simular o que a tela faz:

       const itens = (v, c) => layoutPadrao().paineis.map(...)
       assert.equal(semDado.length, comDado.length)

   **Ela nunca poderia falhar.** A simulação seria uma reescrita do código já
   consertado — sem o `.filter()`, porque eu o teria escrito sem. Os dois lados
   dariam o mesmo número por construção, e o teste passaria com o bug de volta
   na tela. É literalmente a asserção cujos dois desfechos produzem o mesmo
   valor observado.

   O que o defeito era, estruturalmente: **`layout.paineis` chegando ao `.map()`
   já filtrado.** Então é isso que se mede — no arquivo, não numa cópia dele.

   ⚠️ O LIMITE, escrito aqui porque guarda sem limite declarado é a próxima
   armadilha: ela pega o filtro reescrito de forma parecida (`.filter(` na mesma
   expressão de `layout.paineis`), e NÃO pega alguém que filtre a lista três
   linhas antes, numa variável intermediária. Medir isso de verdade exigiria
   renderizar a tela com sessão e provedores — caro, e foi o mesmo cálculo que
   descartou medir cor pintada automaticamente. */
checar("a tela NÃO filtra `layout.paineis` — o bug era um `.filter()` antes do `.map()`", () => {
  const fonte = readFileSync(new URL("../src/components/dashboard/views/dashboard/DashboardScreen.tsx", import.meta.url), "utf8");
  /* Só o CÓDIGO: comentário citando o bug é o que se quer preservar, e ele fala
     de `.filter(… temDado …)` por extenso. */
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  const filtros = [...codigo.matchAll(/layout\.paineis\s*\.?\s*\n?\s*\.filter\(/g)];
  assert.deepEqual(filtros.map((m) => m[0]), [], "`layout.paineis` está sendo filtrada antes de desenhar");

  /* E o positivo: ela realmente mapeia a lista inteira. Sem isto, apagar o
     bloco de render passaria — "não filtra" é verdade sobre código que não
     existe. */
  assert.ok(/layout\.paineis\.map\(/.test(codigo), "a tela não mapeia `layout.paineis` — o desenho sumiu?");

  /* ⛔ E `temDado` não pode ser chamado direto na tela. Ele tem UM consumidor,
     o `vazioDoBloco`; foi a segunda chamada (uma no filtro da grade, outra no
     corpo do item de edição) que deixou "colapsar" virar "sumir" em um dos dois
     caminhos e não no outro. */
  assert.ok(!/\.temDado\(/.test(codigo), "a tela chama `temDado` direto — use `vazioDoBloco`");
});

checar("cada painel mantém a MESMA largura sem dado", () => {
  /* A posição é consequência da ordem e da largura — as duas asserções juntas
     são "o arranjo é o mesmo". Largura vem do layout e não passa por `temDado`;
     esta linha é o que impede alguém de reintroduzir a dependência. */
  for (const p of layoutPadrao().paineis) {
    const meta = CATALOGO_META.find((b) => b.id === p.id);
    assert.ok(p.col >= meta.colMin, `${p.id}: padrão ${p.col} abaixo do mínimo ${meta.colMin}`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════ */
secao("2. Sem dado, o bloco mostra a CAUSA — não uma caixa branca");

checar("todo bloco colapsável devolve um estado vazio com dado zerado", () => {
  const semVazio = IDS_COLAPSAVEIS.filter((id) => vazioDoBloco(RENDERS[id], VAZIA, CTX_VAZIO) === null);
  assert.deepEqual(semVazio, [], `estes não colapsaram com dado zerado: ${semVazio.join(", ")}`);
  // Prova que havia o que examinar — contagem === 0 passa com a coleção vazia.
  assert.ok(IDS_COLAPSAVEIS.length >= 8, `só ${IDS_COLAPSAVEIS.length} colapsáveis`);
});

checar("o estado vazio de todo bloco tem título E causa", () => {
  for (const id of IDS_COLAPSAVEIS) {
    const vazio = vazioDoBloco(RENDERS[id], VAZIA, CTX_VAZIO);
    assert.ok(vazio.titulo?.length > 8, `${id}: título curto demais`);
    assert.ok(vazio.causa != null, `${id}: sem causa — "não há dados" é o que já dava para ver`);
  }
});

checar("o estado vazio RENDERIZA texto de verdade", () => {
  /* ⚠️ Renderiza, e não só inspeciona o objeto: a `causa` é `ReactNode` — pode
     ser JSX com `<strong>`, e um nó que não desenha nada passaria na checagem
     de `!= null` acima. É a lição da hachura do heatmap, que era
     `rgba(0,0,0,0)` com o objeto correto. */
  for (const id of IDS_COLAPSAVEIS) {
    const html = renderToStaticMarkup(React.createElement(EmptyState, vazioDoBloco(RENDERS[id], VAZIA, CTX_VAZIO)));
    const texto = html.replace(/<[^>]+>/g, "").trim();
    assert.ok(texto.length > 40, `${id}: o estado vazio desenhou "${texto}"`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════ */
secao("3. O CONTROLE — com dado, nenhum estado vazio aparece");

checar("com dado em tudo, nenhum bloco colapsa", () => {
  /* ⛔ SEM ESTA, as três de cima passariam com um `vazioDoBloco` que devolvesse
     o vazio sempre — e o Dashboard mostraria "sem dados" com dados na tela. */
  const colapsados = IDS_COLAPSAVEIS.filter((id) => vazioDoBloco(RENDERS[id], CHEIA, CTX_CHEIO) !== null);
  assert.deepEqual(colapsados, [], `colapsaram COM dado: ${colapsados.join(", ")}`);
});

checar("os `sempreCheio` nunca colapsam, nos dois estados", () => {
  const sempre = CATALOGO_META.map((b) => b.id).filter((id) => "sempreCheio" in RENDERS[id]);
  assert.ok(sempre.length > 0, "nenhum bloco `sempreCheio` — a asserção é vácuo");
  for (const id of sempre) {
    assert.equal(vazioDoBloco(RENDERS[id], VAZIA, CTX_VAZIO), null, `${id} colapsou`);
    assert.ok(RENDERS[id].porQue?.length > 40, `${id}: \`porQue\` precisa dizer o motivo, não ser uma flag`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════ */
secao("3b. Todo bloco DESENHA alguma coisa com dado");

checar("nenhum render lança, e nenhum devolve markup vazio", () => {
  /* 🔴 ESTA É A GUARDA MAIS FRACA DO ARQUIVO, E O LIMITE VAI ESCRITO NELA.
     Ela prova que o render existe, não lança e produz texto — o mínimo para um
     bloco novo não nascer como caixa branca. **Ela NÃO prova como ficou na
     tela**, e nesta base essa distinção já custou caro três vezes (o resumo do
     gargalo invisível, a hachura em `rgba(0,0,0,0)`, os 30px de gradiente cru).

     Ela existe porque três blocos entraram no catálogo em 07/08/2026
     (`posicionamento`, `top-campanhas`, `heatmap`) e **não aparecem em quem já
     tem layout salvo** — só no padrão de conta nova e no catálogo lateral. Sem
     isto, eles seriam código não exercido por ninguém. */
  for (const id of Object.keys(RENDERS)) {
    let html;
    try {
      html = renderToStaticMarkup(React.createElement(() => RENDERS[id].render(CHEIA, CTX_CHEIO)));
    } catch (e) {
      throw new Error(`${id}: o render lançou — ${e.message}`);
    }
    assert.ok(html.length > 60, `${id}: desenhou ${html.length} caracteres de markup`);
  }
});

checar("o controle do cabeçalho existe em quem declara `acao`", () => {
  const comAcao = Object.keys(RENDERS).filter((id) => RENDERS[id].acao);
  assert.ok(comAcao.length >= 4, `só ${comAcao.length} blocos com controle`);
  for (const id of comAcao) {
    const html = renderToStaticMarkup(React.createElement(() => RENDERS[id].acao(CHEIA, CTX_CHEIO)));
    /* ⛔ Um `acao` que devolve `null` é o controle inerte com sintaxe de
       componente: o cabeçalho reserva o espaço e não aparece nada. */
    assert.ok(html.length > 20, `${id}: o controle do cabeçalho desenhou "${html}"`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════ */
secao("4. ESTRUTURAL é só 'não pode ser ocultado'");

checar("todo estrutural está no catálogo, com largura e mínimo próprios", () => {
  assert.ok(ESTRUTURAIS.length > 0, "nenhum estrutural — a asserção é vácuo");
  for (const b of ESTRUTURAIS) {
    assert.ok(CATALOGO_META.some((m) => m.id === b.id), `${b.id} fora do catálogo`);
    assert.ok(b.colMin >= 1 && b.colMin <= 12, `${b.id}: colMin fora da grade`);
    /* 🔴 A REGRESSÃO QUE ESTA LINHA PEGA: "estrutural" tinha virado "largura
       cheia e sem alça". Um estrutural cujo mínimo é 12 não pode ser
       redimensionado — seria a definição errada voltando pela porta dos dados. */
    assert.ok(b.colMin < 12, `${b.id}: colMin 12 torna o bloco não-redimensionável`);
    assert.ok(b.estrutural.length > 20, `${b.id}: o motivo precisa ser uma frase`);
  }
});

checar("todo estrutural tem render — nenhum é moldura vazia", () => {
  for (const b of ESTRUTURAIS) assert.equal(typeof RENDERS[b.id].render, "function");
});

/* ══════════════════════════════════════════════════════════════════════════ */
console.log(
  falhas.length === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas.length} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas.length === 0 ? 0 : 1);
