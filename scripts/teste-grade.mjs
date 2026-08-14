/**
 * A GRADE DE CÉLULAS — asserções da F1 (`docs/design/07-GRADE-E-BLOCOS.md`).
 *
 * 🔴 O QUE MUDOU, e por que ele existe: a altura do card deixou de vir do
 * CONTEÚDO (`linhas` × 44px virando `minHeight`, um piso) e passou a vir do
 * LAYOUT (`h` × 96px virando `grid-row: span`, uma altura exata).
 *
 * Uma inversão dessas quebra em três lugares diferentes, e cada um tem seção
 * aqui:
 *
 *   §A  a CONVERSÃO 44 → 96 — comparar os números crus DOBRA a altura
 *   §B  a GUARDA de três camadas (elegibilidade → completude → reserva)
 *   §C  §7.1 do `07` — a altura do card não muda com a variante do bloco
 *   §D  §7.8 do `07` — nenhum bloco fixa a própria altura em px
 *
 * ⚠️ O que este arquivo NÃO responde é **como ficou**. `scrollHeight >
 * clientHeight` no `h` migrado (§7.3) exige motor de layout, e `jsdom` não tem
 * um — quem responde é a passada visual, e a lista do que estoura é o escopo da
 * F3. Está escrito aqui para ninguém ler o verde como "a F1 fechou".
 *
 *   npm run test:grade
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

const {
  ALTURA_CELULA,
  ALTURA_LINHA_ANTIGA,
  CATALOGO_META,
  GAP_GRADE,
  celulasDePx,
  ehBlocoDeMetrica,
  encaixarAltura,
  metaDoBloco,
} = await import("../src/components/dashboard/catalogo.ts");
const { alturaMigrada, celulasDeLinhas, layoutPadrao, migrarAlturas, migrarLayout, precisaMigrarAltura } =
  await import("../src/components/dashboard/layout/migrar.ts");
const { CountryPanel } = await import("../src/components/tk/CountryPanel.tsx");
const { colunasParaLargura, derivarLayout, larguraDerivada } = await import(
  "../src/components/dashboard/layout/derivar.ts"
);
const { RENDERS } = await import("../src/components/dashboard/catalogoRender.tsx");
const { METRICAS } = await import("../src/components/dashboard/metricas.ts");

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
const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8").replace(/\r\n/g, "\n");

/**
 * 🔤 APAGA COMENTÁRIOS, PRESERVANDO AS QUEBRAS DE LINHA.
 *
 * ⛔ Toda guarda deste arquivo que procura CÓDIGO passa por aqui primeiro. Este
 * repositório documenta o cabeçalho de um arquivo explicando por que um símbolo
 * NÃO existe — e é justamente essa prosa que uma busca por substring acha
 * primeiro. Já aconteceu seis vezes; a sétima foi nesta sessão, na guarda do
 * `CountryPanel`.
 *
 * ⚠️ As quebras ficam para o número de linha reportado continuar sendo o do
 * arquivo. Uma guarda que aponta a linha errada custa quase tanto quanto uma que
 * não dispara.
 */
const semComentarios = (fonte) =>
  fonte
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));

/* ══ §A — A CONVERSÃO ═══════════════════════════════════════════════════════
   🔴 A TABELA ABAIXO É A SAÍDA DA F0b (§11 do `07`), e ela é dado de ENTRADA da
   migração: a medição só existia enquanto a grade estava em `grid-auto-rows:
   auto`, que é justamente o que a F1 removeu. Colher esses números de novo é
   impossível — por isso eles estão congelados aqui E no catálogo, e esta seção
   é o que impede os dois de divergirem. */
secao("§A — a conversão 44 → 96, e a tabela da F0b");

/** `[id, linhas gravado (ou null), h migrado esperado]` — a §11 do `07`, inteira. */
const F0B = [
  ["funil", 5, 5],
  ["heatmap", 8, 5],
  ["atividade", 8, 4],
  ["paises", 8, 4],
  ["alertas", 4, 4],
  ["top-campanhas", 4, 4],
  ["aprovacao", null, 3],
  ["posicionamento", null, 3],
  ["lucro-por-hora", 4, 3],
  ["vendas-por-dia", 4, 3],
  ["vendas-por-hora", 4, 3],
  ["receita-gasto", 5, 3],
  ["fontes", null, 3],
  ["produtos", null, 3],
  ["pagamentos", null, 3],
  ["rodape", null, 3],
];

/* 🔴 A TABELA COBRE OS PAINÉIS, e a distinção nasceu com a F5: as métricas
   entraram no catálogo em 12/08/2026 e **não têm medição F0b** — ela era a
   altura que o bloco ocupava na grade em `auto`, e naquele momento métrica não
   era bloco. O `hMin`/`hPadrao` delas é decisão (1 e 1 ou 2), não medição, e
   está escrito no catálogo.

   ⚠️ A asserção continua exigindo cobertura TOTAL do que ela cobre, senão a
   varredura vira parcial em silêncio no dia em que um painel novo entrar. */
const PAINEIS_DO_CATALOGO = CATALOGO_META.filter((b) => !ehBlocoDeMetrica(b.id));

checar("a tabela da F0b cobre TODO PAINEL do catálogo (senão a varredura é parcial)", () => {
  assert.equal(F0B.length, PAINEIS_DO_CATALOGO.length);
  assert.deepEqual(
    F0B.map(([id]) => id).sort(),
    PAINEIS_DO_CATALOGO.map((b) => b.id).sort(),
  );
  /* Linha de base do outro lado: as métricas EXISTEM no catálogo e ficaram de
     fora de propósito. Sem isto, a asserção passaria com o catálogo vazio de
     métricas — que é o estado que a F5 acabou de mudar. */
  assert.ok(CATALOGO_META.length > PAINEIS_DO_CATALOGO.length, "nenhuma métrica no catálogo");
});

checar("o passo da célula é 96 — e é o divisor de toda conversão", () => {
  assert.equal(ALTURA_CELULA + GAP_GRADE, 96);
});

/* 🔴 O CASO QUE NOMEIA A ARMADILHA. `linhas: 8` são 352px na unidade antiga; 8
   CÉLULAS seriam 752px. Se alguém um dia trocar a conversão por uma cópia crua
   do número, esta asserção é a que cai. */
checar("`linhas: 8` (352px) vira 4 células, NÃO 8", () => {
  assert.equal(8 * ALTURA_LINHA_ANTIGA, 352);
  assert.equal(celulasDeLinhas(8), 4);
});

checar("a fronteira da célula fecha exata: 192px (3 células menos os gaps) dá 3", () => {
  assert.equal(celulasDePx(192), 3);
  assert.equal(celulasDePx(193), 3);
  /* O degrau seguinte. Sem o `+ GAP` no numerador, 192 daria 2 e todo bloco
     ficaria uma célula curto — o corte em silêncio que a migração existe para
     evitar. */
  assert.equal(celulasDePx(272), 3);
  assert.equal(celulasDePx(273), 4);
});

checar("as 16 alturas migradas batem com a medição da F0b", () => {
  const divergentes = F0B.filter(([id, linhas, esperado]) => alturaMigrada(metaDoBloco(id), linhas ?? undefined) !== esperado)
    .map(([id, linhas, esperado]) => `${id}: esperado ${esperado}, saiu ${alturaMigrada(metaDoBloco(id), linhas ?? undefined)} (linhas=${linhas})`);
  assert.deepEqual(divergentes, []);
});

/* 🔴 UM ACHADO, e ele reprovou a primeira versão desta asserção.
   O `07` §11 diz *"em 4 deles o `linhas` VENCE a medição"*. **Não vence em
   nenhum.** No layout de dev os `linhas` gravados dão 2, 3 ou 4 células, e o
   `hMin` (que É a medição) dá o mesmo ou mais em todos os 16 — em três há
   EMPATE, e no resto a medição domina.

   ⚠️ Isso não torna o `linhas` dispensável, e é o que a segunda metade prova: um
   `linhas` maior — que qualquer testador pode ter — passa a mandar. O que o
   fixture do dev não exercita, a asserção exercita. */
checar("no layout de dev a medição domina; o `linhas` no máximo EMPATA", () => {
  const empates = F0B.filter(([id, linhas]) => linhas !== null && celulasDeLinhas(linhas) === metaDoBloco(id).hMin).map(
    ([id]) => id,
  );
  assert.deepEqual(empates.sort(), ["atividade", "paises", "receita-gasto"]);
  const vencem = F0B.filter(([id, linhas]) => linhas !== null && celulasDeLinhas(linhas) > metaDoBloco(id).hMin);
  assert.deepEqual(vencem, []);
});

checar("um `linhas` MAIOR que a medição vence — é a altura que o usuário escolheu", () => {
  const fontes = metaDoBloco("fontes"); // hMin 3
  /* 12 linhas de 44px = 528px = 6 células. É o caso que o dev não tem e que uma
     migração pela TELA teria perdido: `celulaDaGrade` só aplicava o piso COM
     dado, então um bloco vazio no período aparecia como "sem altura escolhida"
     tendo altura gravada. */
  assert.equal(celulasDeLinhas(12), 6);
  assert.equal(alturaMigrada(fontes, 12), 6);
  /* Linha de base: sem `linhas`, o mesmo bloco cai no `hMin`. Sem ela, a
     asserção acima passaria com uma função que ignorasse o `linhas` e por acaso
     devolvesse 6. */
  assert.equal(alturaMigrada(fontes, undefined), fontes.hMin);
  assert.notEqual(fontes.hMin, 6);
});

checar("o `hMin` é piso do encaixe, e o teto não deixa passar de 12", () => {
  const funil = metaDoBloco("funil");
  assert.equal(encaixarAltura(1, funil), funil.hMin);
  assert.equal(encaixarAltura(99, funil), 12);
  assert.equal(encaixarAltura(undefined, funil), funil.hPadrao);
});

/* ⚠️ `hMin === hPadrao` é decisão do dono ("`hMin` provisório = h migrado, e só
   baixa com a F3 do bloco"), e o preço está escrito no catálogo: enquanto forem
   iguais, o bloco não encolhe abaixo do padrão. Esta asserção existe para o dia
   em que a F3 baixar um `hMin` — ela cai, e o commit tem de dizer por quê. */
checar("nos PAINÉIS `hMin` e `hPadrao` são iguais — a F3 é quem separa os dois", () => {
  const separados = PAINEIS_DO_CATALOGO.filter((b) => b.hMin !== b.hPadrao).map((b) => b.id);
  assert.deepEqual(separados, []);
  assert.ok(CATALOGO_META.every((b) => b.hPadrao >= b.hMin), "algum hPadrao abaixo do hMin");
});

/* 🔑 E NA MÉTRICA ELES DIVERGEM, de propósito — é o primeiro bloco da base com
   versão compacta de verdade. `hMin: 1` é honesto porque existe container query
   que produz a leitura de uma célula; o `hPadrao: 2` do destaque é a hierarquia
   do layout padrão, não um piso. */
checar("a métrica de destaque tem `hMin` 1 e `hPadrao` 2 — o único par separado", () => {
  const metricas = CATALOGO_META.filter((b) => ehBlocoDeMetrica(b.id));
  assert.ok(metricas.length >= 10, `só ${metricas.length} métricas no catálogo`);
  assert.deepEqual([...new Set(metricas.map((b) => b.hMin))], [1]);
  assert.deepEqual([...new Set(metricas.map((b) => b.hPadrao))].sort(), [1, 2]);
});

/* 🔎 A ÚNICA CÓPIA DE `ALTURA_CELULA` QUE SOBROU. O CSS não pode importar TS, e
   o `--tk-row` é o número que o navegador de fato usa — se os dois divergirem, o
   layout inteiro sai de escala e nada mais nesta suíte percebe. */
checar("`--tk-row` do globals.css é o mesmo `ALTURA_CELULA` do catálogo", () => {
  const css = ler("../src/app/globals.css");
  const m = css.match(/--tk-row:\s*(\d+)px/);
  assert.ok(m, "linha de base: `--tk-row` não existe no globals.css");
  assert.equal(Number(m[1]), ALTURA_CELULA);
});

/* ══ §B — A GUARDA DE TRÊS CAMADAS ══════════════════════════════════════════ */
secao("§B — elegibilidade → completude → reserva");

/** Um envelope v3 com dois painéis, um deles com altura escolhida. */
const V3 = {
  v: 3,
  hero: ["faturamento", "gasto", "roas", "lucroLiquido"],
  faixa: ["ticket"],
  paineis: [
    { id: "funil", col: 6, linhas: 5 },
    { id: "fontes", col: 4 },
  ],
};

checar("o v3 é lido SEM converter: os painéis chegam sem `h`", () => {
  const l = migrarLayout(V3);
  const funil = l.blocos.find((p) => p.id === "funil");
  assert.equal(funil.h, undefined);
  /* ⚠️ E o `linhas` atravessa a leitura para o efeito de migração usar UMA vez.
     Sem isto, a conversão teria de acontecer na leitura — e aí toda abertura do
     Dashboard reinterpretaria o salvo. */
  assert.equal(funil.linhasLegado, 5);
  assert.equal(precisaMigrarAltura(l), true);
});

checar("CAMADA 1 — bloco sem dado NÃO ganha `h`", () => {
  const l = migrarLayout(V3);
  const r = migrarAlturas(l, (id) => id !== "funil");
  assert.equal(r.blocos.find((p) => p.id === "funil").h, undefined);
  assert.equal(r.blocos.find((p) => p.id === "fontes").h, metaDoBloco("fontes").hMin);
});

checar("CAMADA 2 — com um bloco pendente, `completo` é falso (nada é gravado)", () => {
  const r = migrarAlturas(migrarLayout(V3), (id) => id !== "funil");
  assert.equal(r.completo, false);
});

/* 🔴 A LINHA DE BASE DA CAMADA 2, e sem ela o teste acima passaria com uma
   função que devolvesse `completo: false` sempre. */
checar("CAMADA 2 — com todos elegíveis, `completo` é verdadeiro e as alturas saem", () => {
  const r = migrarAlturas(migrarLayout(V3), () => true);
  assert.equal(r.completo, true);
  assert.equal(r.blocos.find((p) => p.id === "funil").h, 5);
  assert.equal(r.blocos.find((p) => p.id === "fontes").h, metaDoBloco("fontes").hPadrao);
  /* ⛔ ESTA ASSERÇÃO AFIRMAVA O CONTRÁRIO — que o campo legado SOME no migrado,
     "porque é ele que impede a próxima abertura de converter de novo". As duas
     metades estavam erradas: quem impede a reconversão é o `h` existir
     (`precisaMigrarAltura`), e descartar o legado jogava fora a única rede de
     uma conversão irreversível que roda sozinha em produção.
     Ver as três asserções de REDE, abaixo. */
  assert.equal(r.blocos.find((p) => p.id === "funil").linhasLegado, 5);
});

/* ══ A REDE DA CONVERSÃO IRREVERSÍVEL ═══════════════════════════════════════
   🔴 `linhas → h` NÃO TEM VOLTA: `h` é `max(células(linhas), hMin)`, e do `max`
   não se recupera o operando. A migração roda SOZINHA ao abrir o Dashboard, e a
   partir de 12/08/2026 roda em PRODUÇÃO. O `linhas` preservado é a única coisa
   que ainda sabe o que o usuário tinha escolhido.

   ⛔ Estas três asserções existem porque a primeira versão DESCARTAVA o campo, e
   o descarte estava documentado como decisão certa em três arquivos. */
checar("REDE — o `linhas` sobrevive à migração, dentro do envelope migrado", () => {
  const r = migrarAlturas(migrarLayout(V3), () => true);
  const funil = r.blocos.find((p) => p.id === "funil");
  assert.equal(funil.h, 5, "linha de base: a migração converteu");
  assert.equal(funil.linhasLegado, 5, "o `linhas` original tem de continuar lá");
  /* E ele NÃO desenha: a altura é `h`, não o legado. Sem esta metade, preservar
     o campo poderia virar aplicá-lo — que dobraria todo bloco alto. */
  assert.notEqual(funil.h, funil.linhasLegado * 1 + 1);
});

checar("REDE — o v4 relido devolve o `linhas`, e não pede migração de novo", () => {
  /* O ciclo completo: v4 gravado COM `linhas` volta com o legado intacto. */
  const v4 = {
    v: 4,
    hero: V3.hero,
    faixa: V3.faixa,
    paineis: [{ id: "funil", col: 6, h: 5, linhas: 5 }],
  };
  const l = migrarLayout(v4);
  const funil = l.blocos.find((p) => p.id === "funil");
  assert.equal(funil.h, 5);
  assert.equal(funil.linhasLegado, 5, "ler `linhas` só no v3 o perderia no primeiro save");
  assert.equal(precisaMigrarAltura(l), false, "quem trava a reconversão é o `h`, não o campo sumir");
});

checar("REDE — quem GRAVA leva o campo junto (a ponta que o descarte tinha)", () => {
  const hook = ler("../src/components/dashboard/layout/useLayoutDashboard.ts");
  const i = hook.indexOf("function paraSalvar");
  assert.ok(i > 0, "linha de base: `paraSalvar` não existe");
  const corpo = hook.slice(i, hook.indexOf("\n}", i));
  /* Mira a MONTAGEM do objeto salvo. Foi exatamente aqui que o campo morria. */
  assert.match(corpo, /linhas: b\.linhasLegado/);
  /* E o tipo do servidor precisa aceitá-lo, senão o `tsc` estaria calado sobre
     um campo que nunca chega ao banco. */
  const acao = ler("../src/lib/actions/dashboardLayout.ts");
  const j = acao.indexOf("interface BlocoSalvo");
  assert.ok(j > 0, "linha de base: `BlocoSalvo` não existe");
  assert.match(acao.slice(j, acao.indexOf("\n}", j)), /linhas\?: number/);
});

checar("bloco JÁ migrado não é tocado — nem quando ficaria maior", () => {
  const v4 = { v: 4, hero: V3.hero, faixa: V3.faixa, paineis: [{ id: "funil", col: 6, h: 8 }] };
  const l = migrarLayout(v4);
  assert.equal(l.blocos.find((p) => p.id === "funil").h, 8);
  assert.equal(precisaMigrarAltura(l), false);
  const r = migrarAlturas(l, () => true);
  assert.equal(r.blocos.find((p) => p.id === "funil").h, 8);
});

checar("o padrão do produto já nasce migrado — conta nova não passa pela guarda", () => {
  const padrao = layoutPadrao();
  assert.equal(precisaMigrarAltura(padrao), false);
  assert.ok(padrao.blocos.length > 0, "linha de base: o padrão tem painéis");
});

/* CAMADA 3 — a reserva é no banco (`migrarAlturaDoLayout`) e não roda aqui: ela
   exige Prisma. O que dá para afirmar estaticamente é que ela **existe e é
   condicional**, e é o que esta guarda faz. Sem isso, trocar o `updateMany` por
   um `update` cru passaria despercebido — e a corrida voltaria em silêncio. */
checar("CAMADA 3 — a escrita da migração é condicional (`updateMany` com reserva)", () => {
  const acao = ler("../src/lib/actions/dashboardLayout.ts");
  const i = acao.indexOf("export async function migrarAlturaDoLayout");
  assert.ok(i > 0, "linha de base: a action de migração não existe");
  const corpo = acao.slice(i);
  assert.match(corpo, /updateMany\(/, "a migração precisa ser condicional");
  assert.match(corpo, /where: \{ id: row\.id, updatedAt: row\.updatedAt \}/);
  /* ⛔ E ela NÃO cria linha: quem não tem layout salvo está no padrão, que já
     nasce com `h`. Criar transformaria "nunca customizei" em "tenho um salvo". */
  assert.ok(!/\.create\(/.test(corpo), "a migração não pode criar linha");
});

/* ══ OS CAMINHOS DE ESCRITA DO LAYOUT — três, e só um é automático ══════════
   🔴 NASCEU DE UMA ESCRITA QUE NINGUÉM SOUBE EXPLICAR (12/08/2026, 01:19): o
   layout do dev apareceu regravado com larguras diferentes das que a migração
   tinha escrito, e nem eu nem o dono sabíamos quem gravou.

   A investigação eliminou a migração pelo código (`precisaMigrarAltura` já era
   falso) e mediu que uma carga SEM TOQUE não escreve nada. Sobrou o `salvar`,
   que exige clique.

   ⛔ Esta guarda existe para o dia em que alguém acrescentar um autosave — de
   arrasto, de `beforeunload`, de intervalo. Escrita silenciosa num campo que o
   usuário configura é a família que apagou o `linhas` e que sumiu com o seletor
   de `calc`: ninguém percebe até o layout de alguém mudar sozinho. */
secao("caminhos de escrita do layout");

checar("só existem TRÊS escritas de layout, e as três estão nomeadas", () => {
  const hook = ler("../src/components/dashboard/layout/useLayoutDashboard.ts");
  const escritas = [...semComentarios(hook).matchAll(/await (saveLayoutZonas|resetDashboardLayout|migrarAlturaDoLayout)\(/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(escritas.sort(), ["migrarAlturaDoLayout", "resetDashboardLayout", "saveLayoutZonas"]);
});

checar("a ÚNICA escrita sem clique é a migração — e ela é travada pelo `h`", () => {
  const hook = semComentarios(ler("../src/components/dashboard/layout/useLayoutDashboard.ts"));
  /* `saveLayoutZonas` e `resetDashboardLayout` moram em `salvar`/`redefinir`,
     que só chegam à tela pela `BarraEdicao` — e ela só desenha os botões em modo
     de edição. Se um deles aparecer dentro de um `useEffect`, isto reprova. */
  const efeitos = [...hook.matchAll(/useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\n  \}/g)].map((m) => m[1]);
  assert.ok(efeitos.length > 0, "linha de base: o hook não tem efeito nenhum");
  const comEscrita = efeitos.filter((c) => /saveLayoutZonas|resetDashboardLayout/.test(c));
  assert.deepEqual(comEscrita, [], "escrita de layout dentro de efeito é autosave");

  const tela = semComentarios(ler("../src/components/dashboard/views/dashboard/DashboardScreen.tsx"));
  assert.match(tela, /aoSalvar=\{ed\.salvar\}/, "linha de base: o Salvar perdeu o dono");
  /* E o gatilho da migração continua sendo um efeito guardado — se alguém tirar
     a guarda, a migração vira autosave de verdade. */
  assert.match(
    semComentarios(ler("../src/components/dashboard/layout/useLayoutDashboard.ts")),
    /if \(tentouMigrar\.current \|\| carregando \|\| snapshot !== null\) return;/,
  );
});

/* ══ §C — §7.1: a altura não muda com a variante ════════════════════════════
   🔴 A MEDIÇÃO DE VERDADE É NA TELA. Aqui o que se prova é a CAUSA: a variante
   Globo cravava `minHeight: 420` (a altura do desenho virando altura do bloco),
   e o Ranking não cravava nada. Enquanto nenhuma das duas declarar altura em px,
   as duas terminam na altura do slot — que é o que a §7.1 pede. */
secao("§C — §7.1: Ranking ↔ Globo");

const PAIS = (visao) =>
  renderToStaticMarkup(
    React.createElement(CountryPanel, {
      visao,
      semPais: 0,
      tema: "dark",
      formatar: (n) => `R$ ${n}`,
      diametroMax: 420,
      linhas: [
        { code: "BR", nome: "Brasil", bandeira: "🇧🇷", vendas: 9, receita: 900, lat: -14, lng: -51 },
        { code: "CL", nome: "Chile", bandeira: "🇨🇱", vendas: 2, receita: 200, lat: -35, lng: -71 },
      ],
    }),
  );

/** Toda declaração de altura em px do markup. É o instrumento da §C. */
const alturasEmPx = (html) => (html.match(/(?:min-|max-)?height:\s*[\d.]+px/g) ?? []).sort();

checar("o instrumento acha altura em px quando ela existe (linha de base)", () => {
  assert.deepEqual(alturasEmPx('<div style="min-height:420px">x</div>'), ["min-height:420px"]);
});

checar("as duas variantes renderizam, e são markup DIFERENTE", () => {
  const r = PAIS("ranking");
  const g = PAIS("globo");
  assert.ok(r.length > 500, "linha de base: o ranking renderizou vazio");
  assert.ok(g.length > 500, "linha de base: o globo renderizou vazio");
  assert.notEqual(r, g, "linha de base: as duas variantes saíram idênticas");
});

checar("§7.1 — trocar de variante não acrescenta altura em px nenhuma", () => {
  assert.deepEqual(alturasEmPx(PAIS("globo")), alturasEmPx(PAIS("ranking")));
});

checar("o `minHeight` do globo foi REMOVIDO da fonte, não só do markup", () => {
  const fonte = ler("../src/components/tk/CountryPanel.tsx");
  /* 🔤 ESTA GUARDA JÁ CAIU UMA VEZ AQUI, pelo motivo de sempre: o arquivo cita
     `minHeight: altura` DUAS vezes na prosa — no comentário que explicava a
     decisão antiga e no ⛔ que registra a remoção. Mirar a substring achou os
     dois comentários e reprovou um arquivo correto.
     É a sétima ocorrência da família nesta base, e a saída também é a de sempre:
     **APAGAR os comentários antes de medir**, preservando as quebras de linha
     para o número reportado continuar sendo o do arquivo. */
  const ofensoras = semComentarios(fonte)
    .split("\n")
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /minHeight:\s*(altura|diametro|[1-9])/.test(l));
  assert.deepEqual(ofensoras, []);
  /* Linha de base DUPLA: o CÓDIGO ainda declara `minHeight: 0` (o arquivo não
     perdeu a forma que a varredura conhece) e a PROSA ainda cita a forma
     proibida — o que prova que o corte de comentários é o que está segurando, e
     não uma varredura que deixou de achar qualquer coisa. */
  assert.match(semComentarios(fonte), /minHeight: 0/);
  assert.match(fonte, /minHeight: altura/);
});

/* ══ §D — §7.8: nenhum bloco fixa a própria altura ══════════════════════════ */
secao("§D — §7.8: piso de altura em px nos componentes de bloco");

/* 🔎 A LISTA É LIDA DO `catalogoRender`, NÃO COPIADA. Um componente de bloco
   novo entra na varredura sozinho; uma lista à mão ficaria atrás do código no
   primeiro commit, que é a família que este projeto já pagou várias vezes. */
const RENDER_TSX = ler("../src/components/dashboard/catalogoRender.tsx");
const ARQUIVOS_DE_BLOCO = [...RENDER_TSX.matchAll(/from "@\/components\/tk\/(\w+)"/g)].map((m) => m[1]);

checar("a varredura tem o que examinar (linha de base)", () => {
  assert.ok(ARQUIVOS_DE_BLOCO.length >= 10, `só ${ARQUIVOS_DE_BLOCO.length} componentes de bloco`);
});

/**
 * ⛔ A REGRA NÃO É "nenhum `min-height` em px" — essa é larga demais e proibiria
 * altura de LINHA de tabela, que é legítima e necessária.
 *
 * O que a §7.8 quer impedir é o piso em px **no elemento que deveria estar
 * recebendo a altura do slot**. Então a guarda mira a combinação: um objeto de
 * estilo que declara `height: "100%"` ou `flex: 1` **e** um `minHeight` em px
 * **sem** um `maxHeight` que o cape.
 *
 * ⚠️ O `DonutChart` e o `MedidorRadial` passam de propósito: os dois têm
 * `maxHeight`, e o piso deles existe só para o uso fora de um pai com altura
 * definida (a `/design-system` e o Gerenciador). Com pai definido, quem decide é
 * o `max-height`.
 */
function pisosQueVencemOSlot(fonte) {
  const objetos = [];
  /* Objeto de estilo delimitado por chaves balanceadas a partir de `style={{`. */
  for (const m of fonte.matchAll(/style=\{\{/g)) {
    let i = m.index + m[0].length - 1;
    let nivel = 1;
    const inicio = i + 1;
    while (++i < fonte.length && nivel > 0) {
      if (fonte[i] === "{") nivel++;
      else if (fonte[i] === "}") nivel--;
    }
    objetos.push(fonte.slice(inicio, i));
  }
  return objetos.filter(
    (o) =>
      /minHeight:\s*[1-9]\d*\b/.test(o) &&
      /(height:\s*"100%"|flex:\s*1\b)/.test(o) &&
      !/maxHeight:/.test(o),
  );
}

checar("a guarda da §7.8 reprova o caso ERRADO (provado pelo lado negativo)", () => {
  const plantado = `<div style={{ flex: 1, minHeight: 190, display: "flex" }}>x</div>`;
  assert.equal(pisosQueVencemOSlot(plantado).length, 1);
  /* E aprova as duas formas legítimas: linha de tabela e piso com teto. */
  assert.equal(pisosQueVencemOSlot(`<div style={{ minHeight: 40 }}>x</div>`).length, 0);
  assert.equal(
    pisosQueVencemOSlot(`<div style={{ height: "100%", minHeight: 132, maxHeight: "var(--x)" }}>x</div>`).length,
    0,
  );
});

checar("nenhum componente de bloco fixa a altura por cima do slot", () => {
  const ofensores = [];
  for (const nome of ARQUIVOS_DE_BLOCO) {
    const fonte = ler(`../src/components/tk/${nome}.tsx`);
    for (const o of pisosQueVencemOSlot(fonte)) ofensores.push(`${nome}: ${o.trim().slice(0, 80)}`);
  }
  assert.deepEqual(ofensores, []);
});

/* ⚠️ SVG com `height` NUMÉRICO. Seis dos sete do inventário são ÍCONE, e ícone
   tem tamanho fixo por definição — a guarda mira o SVG que DESENHA DADO, que é o
   que precisa acompanhar o slot. O discriminador barato é o `viewBox` grande:
   ícone é 16/20/24, plotagem é 100+. */
/**
 * 🔤 O NÚMERO SOZINHO NÃO SERVE DE ALVO — o certo tem a mesma sintaxe.
 *
 * ⛔ Esta guarda também caiu na primeira versão: `height=\d+` casa com
 * `height="100%"`, que é EXATAMENTE a forma correta. É a mesma família da guarda
 * acima, na camada do atributo: a chamada certa contém a sintaxe do defeito, e o
 * que difere é o `%` logo depois.
 *
 * O alvo é um número que termina ali — sem `%`, sem `cq`, sem `em`.
 */
const alturaDeSvgEmPx = (tag) => /height=\{?["']?\d+(\.\d+)?["']?\}?[\s>]/.test(tag);

checar("a guarda do SVG distingue `100%` de `100` (provado pelo lado negativo)", () => {
  assert.equal(alturaDeSvgEmPx('<svg viewBox="0 0 180 180" width="100%" height="100%">'), false);
  assert.equal(alturaDeSvgEmPx('<svg viewBox="0 0 180 180" height={420}>'), true);
});

checar("nenhum SVG de plotagem declara altura numérica", () => {
  const ofensores = [];
  for (const nome of ARQUIVOS_DE_BLOCO) {
    const fonte = semComentarios(ler(`../src/components/tk/${nome}.tsx`));
    for (const m of fonte.matchAll(/<svg[^>]*>/g)) {
      const tag = m[0];
      if (!alturaDeSvgEmPx(tag)) continue;
      /* ⚠️ Seis dos sete SVGs com altura numérica do inventário são ÍCONE, e
         ícone tem tamanho fixo por definição. O discriminador barato é o
         `viewBox`: ícone é 16/20/24, plotagem é 40+. */
      const vb = tag.match(/viewBox="[\d.]+ [\d.]+ ([\d.]+)/);
      if (vb && Number(vb[1]) >= 40) ofensores.push(`${nome}: ${tag.slice(0, 70)}`);
    }
  }
  assert.deepEqual(ofensores, []);
});

/* ══ §7.3 — O LUGAR ONDE ELA CABERIA, E POR QUE ELA NÃO ESTÁ AQUI ═══════════
   🔴 `scrollHeight ≤ clientHeight` é uma pergunta de LAYOUT, e **jsdom não tem
   motor de layout**: ele devolve `0` para as duas medidas. Uma asserção aqui
   compararia `0 ≤ 0`, passaria sempre, e imprimiria um número com cara de
   medição — a forma mais convincente da asserção que não pode falhar.

   ⛔ NÃO ESCREVA A §7.3 AQUI. Ela é `scripts/vazamento-na-tela.js`, rodado no
   console com o Dashboard aberto e um período COM DADO. O registro está no `07`,
   logo abaixo da lista de asserções.

   ⚠️ Esta guarda existe para que a ausência seja DELIBERADA e visível: sem ela,
   a próxima pessoa nota que a §7.3 não tem teste e escreve o `0 ≤ 0`. */
secao("§7.3 — fora daqui, de propósito");

checar("o procedimento de navegador existe e é o que o `07` aponta", () => {
  const proc = ler("./vazamento-na-tela.js");
  assert.match(proc, /naTela/, "linha de base: o procedimento perdeu o nome que o `07` cita");
  /* ⚠️ A âncora NÃO cita o par medido por extenso: a guarda logo abaixo proíbe
     medida de layout neste arquivo, e uma âncora com o nome da segunda metade
     reprovava a si mesma. Sétima vez que uma guarda por texto pega o alvo errado
     nesta base — desta vez o alvo errado era ela própria. */
  assert.match(proc, /scrollHeight - card/, "ele precisa medir a pergunta da §7.3");
  /* E o documento precisa apontar para cá, senão o procedimento é órfão — a
     família "existe e ninguém consome", agora na camada de verificação. */
  const doc = ler("../docs/design/07-GRADE-E-BLOCOS.md");
  assert.match(doc, /vazamento-na-tela\.js/);
  assert.match(doc, /jsdom não tem motor de layout/);
});

checar("nenhuma asserção deste arquivo finge medir layout", () => {
  const eu = ler("./teste-grade.mjs");
  /* `scrollHeight`/`clientHeight`/`getBoundingClientRect` só podem aparecer em
     comentário ou dentro do nome do procedimento — nunca como medida. */
  const ofensoras = semComentarios(eu)
    .split("\n")
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /\.(scrollHeight|clientHeight|getBoundingClientRect)\b/.test(l));
  assert.deepEqual(ofensoras, []);
});

/* ══ §E — a tela declara a grade em células ═════════════════════════════════ */
secao("§E — o `DashboardScreen` monta a grade da F1");

checar("a grade usa `--tk-row`, e não `auto`", () => {
  const tela = ler("../src/components/dashboard/views/dashboard/DashboardScreen.tsx");
  const i = tela.indexOf("const grade = (colunas: number): React.CSSProperties");
  assert.ok(i > 0, "linha de base: a fábrica da GRADE não existe");
  const corpo = tela.slice(i, tela.indexOf("});", i));
  assert.match(corpo, /gridAutoRows: "var\(--tk-row\)"/);
});

checar("o slot leva `span` nos dois eixos e os DOIS mínimos zerados", () => {
  const tela = ler("../src/components/dashboard/views/dashboard/DashboardScreen.tsx");
  const i = tela.indexOf("function celulaDaGrade");
  assert.ok(i > 0, "linha de base: `celulaDaGrade` não existe");
  const corpo = tela.slice(i, tela.indexOf("\n}", i));
  assert.match(corpo, /gridColumn: `span \$\{col\}`/);
  assert.match(corpo, /gridRow: `span \$\{efetivo\}`/);
  /* ⛔ Os dois. Sem `minHeight: 0` o conteúdo empurra a linha e o `span` volta a
     ser um piso — o modelo do qual a F1 acabou de sair. */
  assert.match(corpo, /minWidth: 0/);
  assert.match(corpo, /minHeight: 0/);
});

/* ══ §F — F2: a derivação por viewport (§5 e §7.4/§7.5 do `07`) ═════════════
   🔴 UM LAYOUT SALVO, QUATRO DERIVAÇÕES. O grid antigo gravava um layout por
   breakpoint, e o de `mobile` **nunca foi editável** — uma segunda verdade sobre
   o arranjo que o usuário não tinha como consertar. Aqui há uma verdade e uma
   função pura por cima dela. */
secao("§F — F2: a derivação por viewport");

checar("as quatro faixas do §5 são exatamente estas", () => {
  assert.equal(colunasParaLargura(1920), 12);
  assert.equal(colunasParaLargura(1280), 12);
  assert.equal(colunasParaLargura(1279), 8);
  assert.equal(colunasParaLargura(960), 8);
  assert.equal(colunasParaLargura(959), 4);
  assert.equal(colunasParaLargura(640), 4);
  assert.equal(colunasParaLargura(639), 1);
  assert.equal(colunasParaLargura(320), 1);
});

/* 🔴 §7.4 — `derivar(salvo, 12) === salvo`. Ela é o que garante que a tela
   grande **não passa por transformação nenhuma**: se um dia a derivação começar
   a mexer no layout de 12, esta cai antes de alguém ver na tela. */
checar("§7.4 — a derivação é IDENTIDADE em 12 colunas", () => {
  const salvo = layoutPadrao().blocos;
  assert.ok(salvo.length > 10, "linha de base: o padrão tem poucos blocos");
  assert.deepEqual(derivarLayout(salvo, 12), salvo);
});

/* 🔴 §7.5 — nenhum bloco derivado passa da grade, e a ORDEM é preservada. */
checar("§7.5 — em 8, 4 e 1 nada ultrapassa a grade e a ordem é a mesma", () => {
  const salvo = layoutPadrao().blocos;
  for (const c of [8, 4, 1]) {
    const d = derivarLayout(salvo, c);
    const estouram = d.filter((b) => b.col > c).map((b) => `${b.id}=${b.col}`);
    assert.deepEqual(estouram, [], `em ${c} colunas: ${estouram.join(", ")}`);
    assert.deepEqual(d.map((b) => b.id), salvo.map((b) => b.id), `a ordem mudou em ${c} colunas`);
    assert.deepEqual(d.map((b) => b.h), salvo.map((b) => b.h), `a altura mudou em ${c} colunas`);
  }
});

/* ⛔ A GUARDA QUE PODE FALHAR PELO MOTIVO CERTO: sem o `min(colMin, C)`, um
   bloco de `colMin: 5` numa grade de 4 sairia com 5 e transbordaria. Provado
   pelo lado negativo — a conta sem o clamp devolve o mínimo cru. */
checar("o `colMin` do catálogo NÃO vence a grade (provado pelo lado negativo)", () => {
  const heat = metaDoBloco("heatmap"); // colMin 5
  assert.equal(heat.colMin, 5, "linha de base: o `heatmap` deixou de ter colMin 5");
  assert.equal(larguraDerivada(8, heat.colMin, 4), 4, "o mínimo do bloco transbordou a grade de 4");
  assert.equal(larguraDerivada(8, heat.colMin, 1), 1);
  /* E em 12 ele continua mandando: um `col` abaixo do mínimo sobe. */
  assert.equal(larguraDerivada(2, heat.colMin, 12), 5);
});

checar("o `ceil` preserva a proporção — 8/12 vira 3 de 4, não 2", () => {
  assert.equal(larguraDerivada(8, 2, 4), 3);
  assert.equal(larguraDerivada(12, 2, 8), 8);
  assert.equal(larguraDerivada(3, 2, 8), 2);
  /* ⚠️ Arredondar para BAIXO encolheria todo mundo e a linha deixaria de fechar
     — o oposto do que a proporção deveria preservar. */
  assert.notEqual(larguraDerivada(8, 2, 4), 2);
});

/* ⛔ A EDIÇÃO NÃO É DERIVADA, e a guarda mira o CÓDIGO porque o efeito não é
   mensurável aqui (é um hook de janela). Se a edição passasse a usar a grade
   derivada, a alça mediria contra 4 colunas e o `redimensionar` gravaria "4" num
   campo que significa doze avos — o arranjo do usuário corrompido pelo tamanho
   da janela dele. */
checar("a grade do MODO DE EDIÇÃO é sempre a de 12", () => {
  const tela = semComentarios(ler("../src/components/dashboard/views/dashboard/DashboardScreen.tsx"));
  const i = tela.indexOf("function useColunasDaGrade");
  assert.ok(i > 0, "linha de base: `useColunasDaGrade` não existe");
  const corpo = tela.slice(i, tela.indexOf("\n}", i));
  assert.match(corpo, /return editando \? COLUNAS_GRADE : colunas;/);
});

/* ══ §G — F5: a grade única ═════════════════════════════════════════════════ */
secao("§G — F5: métrica e painel são o mesmo objeto");

/* 🔴 A REGRA DE ENTRADA DO CATÁLOGO, AGORA MEDIDA EM VEZ DE SÓ COMPILADA.
   O `Record<IdPainel, …>` cobra os painéis pelo compilador; os renders de
   métrica são GERADOS, e um `as` desliga a checagem ali. Esta asserção é o que
   troca "confie" por "prove" — e ela vale para os dois lados. */
checar("todo bloco do catálogo tem render, e todo render está no catálogo", () => {
  const semRender = CATALOGO_META.filter((b) => !RENDERS[b.id]).map((b) => b.id);
  assert.deepEqual(semRender, [], `no catálogo e sem render: ${semRender.join(", ")}`);
  const semMeta = Object.keys(RENDERS).filter((id) => !CATALOGO_META.some((b) => b.id === id));
  assert.deepEqual(semMeta, [], `com render e fora do catálogo: ${semMeta.join(", ")}`);
  assert.ok(CATALOGO_META.length >= 25, `só ${CATALOGO_META.length} blocos — a asserção seria fraca`);
});

/* ⛔ O RÓTULO DA MÉTRICA TEM UMA FONTE SÓ. O catálogo lateral oferece um nome e
   o card desenha outro se as duas listas divergirem — e a divergência é muda.
   A asserção LÊ o catálogo e o registro do hook, e exige que batam. */
checar("o rótulo do catálogo é o MESMO que o hook desenha", () => {
  const hook = semComentarios(ler("../src/components/dashboard/useTraffikState.ts"));
  const usados = [...hook.matchAll(/label: ROTULO_DA_METRICA\.(\w+)/g)].map((m) => m[1]);
  assert.ok(usados.length >= 10, `só ${usados.length} rótulos lidos da fonte única`);
  /* Os dois sentidos: nenhuma métrica do catálogo sem rótulo no hook, e nenhum
     rótulo do hook fora do catálogo. */
  const chaves = METRICAS.map((m) => m.chave);
  assert.deepEqual(chaves.filter((c) => !usados.includes(c)), [], "métrica do catálogo que o hook não rotula");
  assert.deepEqual(usados.filter((c) => !chaves.includes(c)), [], "rótulo no hook fora do catálogo");
  /* ⛔ E nenhum literal sobrou DENTRO DO REGISTRO: um `label: "Faturamento"` cru
     reintroduziria a segunda fonte sem que nada acusasse.

     🔤 A JANELA É O PONTO, e a primeira versão desta guarda não a tinha: ela
     procurava `label: "…"` no arquivo inteiro e reprovou **17 rótulos
     legítimos** — etapas do funil, eventos de pixel, status de campanha. É a
     oitava vez que uma guarda por texto desta base pega o alvo errado, e sempre
     pelo mesmo motivo: **o certo contém a mesma sintaxe do errado.** O que
     separa não é a sintaxe, é ONDE ela está. */
  const i = hook.indexOf("const reg: Record<");
  assert.ok(i > 0, "linha de base: o registro de métricas não existe no hook");
  const registro = hook.slice(i, hook.indexOf("\n  };", i));
  assert.ok(registro.includes("ROTULO_DA_METRICA"), "linha de base: a janela pegou o bloco errado");
  const literais = [...registro.matchAll(/label: "[^"]+"/g)].map((m) => m[0]);
  assert.deepEqual(literais, [], `rótulo de métrica escrito à mão: ${literais.join(" · ")}`);
});

/* ⛔ AS ZONAS FORAM APAGADAS, NÃO RENOMEADAS. Enquanto os nomes existissem,
   quem lesse os arquivos encontraria descrita uma categoria que o produto não
   tem — a família da proibição que envelhece e vira ordem de reverter. */
checar("nenhum vestígio de zona no código do layout", () => {
  const arquivos = [
    "../src/components/dashboard/catalogo.ts",
    "../src/components/dashboard/layout/useArrasto.ts",
    "../src/components/dashboard/layout/useLayoutDashboard.ts",
  ];
  const ofensoras = [];
  for (const a of arquivos) {
    semComentarios(ler(a))
      .split("\n")
      .forEach((l, i) => {
        if (/\b(zona|Zona|trocarHero|moverMetrica|inserirFaixa|removerFaixa|faixaCheia)\b/.test(l)) {
          ofensoras.push(`${a.split("/").pop()}:${i + 1} ${l.trim().slice(0, 60)}`);
        }
      });
  }
  assert.deepEqual(ofensoras, []);
  /* Linha de base: os arquivos existem e têm código. Sem ela, um caminho errado
     passaria com três leituras vazias. */
  assert.ok(arquivos.every((a) => semComentarios(ler(a)).length > 500));
});

/* 🔑 A LEITURA COMPACTA EXISTE, e ela é o que torna `hMin: 1` honesto. Um mínimo
   sem container query que o sustente é promessa vazia — a mesma regra que o
   `colMin` do catálogo já carrega. */
checar("a container query de ALTURA do KPI existe, e o limiar cabe entre 1 e 2 células", () => {
  const css = ler("../src/app/globals.css");
  const m = css.match(/@container \(max-height: (\d+)px\) \{\s*\.tk-kpi \{/);
  assert.ok(m, "linha de base: a query de altura do `.tk-kpi` não existe");
  const limiar = Number(m[1]);
  /* ⛔ O limiar NÃO é um número fixado antes de medir — os dois que o cercam são
     a própria geometria da grade. Se `--tk-row` mudar, esta asserção cai. */
  assert.ok(limiar > ALTURA_CELULA, `o limiar ${limiar} não separa a célula de ${ALTURA_CELULA}px`);
  assert.ok(limiar < ALTURA_CELULA * 2 + GAP_GRADE, `o limiar ${limiar} engoliria o slot de 2 células`);
  /* E o que ela esconde tem de existir no componente, senão a regra é órfã. */
  assert.match(ler("../src/components/tk/Kpi.tsx"), /tk-kpi-alto/);
});

/* 🔴 C1 — O PISO DO SPARKLINE, E O LIMIAR É RECALCULADO AQUI, NUNCA REPETIDO.
   ────────────────────────────────────────────────────────────────────────────
   Um sparkline esmagado não fica pequeno: ele vira uma RETA, e uma reta sob um
   número lê como sublinhado. Medido em 13/08/2026 no card de ROAS, cuja caixa
   ia a 0,1px enquanto o traço de 1,5px continuava sendo pintado.

   ⛔ Esta asserção NÃO conhece o número 4. Ela o deriva das três constantes que
   o produzem, lidas do próprio `Sparkline.tsx`. Se qualquer uma mudar — a banda
   do `viewBox`, o respiro ou a espessura do traço —, ela cai e cobra a remedição
   em vez de continuar verde sobre um limiar que deixou de descrever a tela.

   É a mesma disciplina do limiar de 130px acima, e a mesma de
   *documentação que LÊ o valor não envelhece*. */
checar("o piso do sparkline existe, e o limiar é o que a geometria do traço exige", () => {
  const spark = ler("../src/components/tk/Sparkline.tsx");

  /* Linha de base: as três constantes têm de ser ACHADAS. Sem isto uma âncora
     quebrada deixaria a conta rodar sobre `NaN` e o `assert` viraria ruído. */
  const A = Number(spark.match(/const A = (\d+);/)?.[1]);
  const PY = Number(spark.match(/const PY = (\d+);/)?.[1]);
  const traco = Number(spark.match(/strokeWidth="([\d.]+)"/)?.[1]);
  assert.ok(A > 0 && PY > 0 && traco > 0, `linha de base: A=${A} PY=${PY} traço=${traco}`);

  /* A oscilação PINTADA de uma série que usa a banda inteira, numa caixa de `h`,
     é `(A − 2·PY)/A · h`. Ela só é distinguível de uma reta quando sobra mais
     que uma espessura de traço depois de descontar a própria espessura — ou
     seja, quando a oscilação passa de DOIS traços. Medido na tela: 3px dá 0,6×
     o traço e 4px dá 1,2×, que é exatamente onde esta conta cruza. */
  const banda = (A - 2 * PY) / A;
  const esperado = Math.ceil((2 * traco) / banda);

  const css = ler("../src/app/globals.css");
  /* ⚠️ A âncora tolera quebra de linha E `\r\n`: 402 arquivos desta base estão em
     CRLF, e um `\n` cru falharia aqui em SILÊNCIO — devolvendo "não achei" com a
     mesma cara de "está tudo certo". Quem denuncia isso é o `assert.ok` abaixo. */
  const m = css.match(
    /@container \(height < (\d+)px\)\s*\{\s*\.tk-spark > \*\s*\{\s*visibility:\s*hidden;\s*\}\s*\}/,
  );
  assert.ok(m, "linha de base: a query do piso do `.tk-spark` não existe");
  assert.equal(
    Number(m[1]),
    esperado,
    `o piso do CSS (${m?.[1]}) divergiu da geometria do traço (${esperado}) — remeça na tela`,
  );

  /* ⚠️ `visibility`, e NÃO `display: none`: o espaço fica RESERVADO, senão um
     card sem série fica mais baixo que os vizinhos — que é o motivo de o próprio
     `Sparkline` reservar altura nos dois estados vazios dele. */
  assert.doesNotMatch(css, /\.tk-spark > \* \{ display: none/);

  /* E a regra não pode ser órfã: quem a liga é a classe no `Kpi.tsx`, e ela só
     funciona se o wrapper for um contêiner de TAMANHO. */
  assert.match(ler("../src/components/tk/Kpi.tsx"), /className="tk-spark/);
  assert.match(css, /\.tk-spark \{ container-type: size; \}/);
});

/* 🔴 A ORDEM DE SACRIFÍCIO DO KPI — a base sai ANTES do sparkline.
   ────────────────────────────────────────────────────────────────────────────
   Decisão do dono, 13/08/2026: número → rótulo → variação → sparkline → base.
   Até aqui era o inverso por OMISSÃO — a base era `flex: none` e o sparkline o
   único encolhível, então cedia quem devia ceder por último.

   ⛔ O limiar NÃO é o número 176 escrito à mão: ele é a altura de DUAS CÉLULAS,
   recalculada aqui das mesmas constantes que a grade usa. Se `--tk-row` ou o gap
   mudarem, esta asserção cai — a mesma disciplina do limiar de 130px. */
checar("a base do KPI sai no slot de 2 células, e o limiar é a própria grade", () => {
  const css = ler("../src/app/globals.css");
  const kpi = ler("../src/components/tk/Kpi.tsx");

  const duasCelulas = ALTURA_CELULA * 2 + GAP_GRADE;
  const m = css.match(/@container \(max-height: (\d+)px\)\s*\{\s*\.tk-kpi \.tk-kpi-base \{\s*display: none;\s*\}\s*\}/);
  assert.ok(m, "linha de base: a query que esconde a `.tk-kpi-base` não existe");
  assert.equal(
    Number(m[1]),
    duasCelulas,
    `o limiar da base (${m?.[1]}) não é a altura de 2 células (${duasCelulas})`,
  );

  /* A classe tem de estar no componente, senão a regra é órfã. */
  assert.match(kpi, /tk-kpi-alto tk-kpi-base/);

  /* 🔑 ESCONDER NÃO É CORTAR — e é isto que concilia com a decisão de 07/08.
     Se a linha some, a íntegra tem de continuar alcançável: o `title` do número
     leva `dados.base`. Sem esta asserção, um commit futuro removeria o `title`
     e a base sumiria de vez sem nada acusar. */
  assert.match(kpi, /title=\{dados\.base \|\| undefined\}/);

  /* ⛔ E ela NUNCA volta a ser truncada: reticências na base é o que a decisão
     de 07/08/2026 proíbe. A guarda mira a DECLARAÇÃO de estilo da própria base,
     não a palavra solta — `textOverflow` aparece em quatro outros lugares deste
     arquivo, e mirar a palavra pegaria os vizinhos. */
  const decl = kpi.slice(kpi.indexOf("tk-kpi-alto tk-kpi-base"));
  const fim = decl.indexOf("{dados.base}");
  assert.ok(fim > 0, "linha de base: não achei o corpo da linha de base");
  assert.doesNotMatch(decl.slice(0, fim), /textOverflow|text-overflow/);
});

/* 🔴 C2 e C3 — O EIXO É UMA FONTE SÓ, e os dois limiares são DERIVADOS.
   ────────────────────────────────────────────────────────────────────────────
   Até 13/08 o `LineChart` tinha eixo Y e o `SerieTemporal` não, e os números
   (`56`, `160`) eram literais dentro do `LineChart`. Copiá-los para o segundo
   gráfico teria criado a segunda fonte da mesma conta — a família que esta base
   já pagou com `whereDespesasDaArea`.

   ⛔ Esta asserção não conhece nenhum dos números. Ela exige que os dois
   gráficos IMPORTEM a mesma função e que cada limiar continue sendo o produto
   das constantes que o justificam. */
checar("o eixo dos gráficos é uma fonte só, e os limiares são derivados", () => {
  const eixo = ler("../src/lib/grafico/eixo.ts");
  const serie = ler("../src/components/tk/SerieTemporal.tsx");
  const linha = ler("../src/components/tk/LineChart.tsx");

  /* Linha de base: os dois consumidores existem e importam do módulo comum. */
  assert.match(serie, /from "@\/lib\/grafico\/eixo"/, "o SerieTemporal não lê o módulo do eixo");
  assert.match(linha, /from "@\/lib\/grafico\/eixo"/, "o LineChart não lê o módulo do eixo");

  /* ⛔ E NENHUM DOS DOIS pode voltar a ter a conta do eixo Y própria.
     ⚠️ A PRIMEIRA VERSÃO DESTA GUARDA MIROU `Math.max(2, Math.floor(` e reprovou
     o eixo **X** do `LineChart` (`floor(larg / 110)`), que é legítimo e outra
     conta. Sétima vez nesta base que uma guarda por texto pega o que o certo
     também tem. Hoje ela mira o que SÓ o errado tem: a divisão pela altura de
     tick, com o número LIDO do módulo — se ele mudar lá, a guarda acompanha. */
  const alturaTick = Number(eixo.match(/export const ALTURA_POR_TICK = (\d+);/)?.[1]);
  assert.ok(alturaTick > 0, "linha de base: não achei ALTURA_POR_TICK no módulo do eixo");
  for (const [nome, fonte] of [["SerieTemporal", serie], ["LineChart", linha]]) {
    const ofensoras = semComentarios(fonte)
      .split("\n")
      .map((l, i) => [i + 1, l.trim()])
      .filter(([, l]) => new RegExp(`Math\\.floor\\([^)]*\\/\\s*${alturaTick}\\s*\\)`).test(l));
    assert.deepEqual(ofensoras, [], `${nome} recriou a conta do eixo Y em vez de importá-la`);
  }

  /* 🔬 C3 — o piso do eixo Y são DUAS ALTURAS DE RÓTULO. Medido: 3 rótulos
     centrados em 0/50/100% da plotagem ficam a `plot/2` um do outro, então
     colidem quando `plot < 2 × altura do rótulo`. Confirmado na tela: 36px → 0
     colisões, 20px → 2 colisões. */
  assert.match(
    eixo,
    /export const CH_MINIMO_EIXO = ALTURA_ROTULO \* 2;/,
    "o piso do eixo Y virou número cravado — ele tem de sair de ALTURA_ROTULO",
  );

  /* ⛔ E o `160` da §4 não pode voltar: ele escondia o eixo no tamanho PADRÃO do
     catálogo (plotagem de 132px num slot de 3 células), que é o C3 de volta. */
  assert.doesNotMatch(eixo, /CH_MINIMO_EIXO = 160/);

  /* 🔬 C2 — o passo do rótulo de x sai da largura MEDIDA, não de "8 rótulos".
     A causa não era densidade: um rótulo de 36px não cabe numa célula de 7px por
     menos rótulos que se desenhe. */
  assert.match(eixo, /LARGURA_ROTULO_X \+ folga\) \/ celula/);
  assert.match(serie, /passoDoRotuloX\(cwPlot, pontos\.length\)/);
  assert.doesNotMatch(semComentarios(serie), /pontos\.length \/ 8/, "voltou o '8 rótulos' fixo");

  /* A célula do rótulo NÃO pode cortar — é a outra metade do C2, e sozinha a
     primeira não resolve. */
  const fileira = serie.slice(serie.indexOf("i % passoX === 0") - 900, serie.indexOf("i % passoX === 0"));
  assert.ok(fileira.length > 100, "linha de base: não achei a fileira de rótulos de x");
  assert.match(fileira, /overflow: "visible"/);
});

/* 🔴 C6 — VÃO COM `+N` É DEFEITO; VÃO SEM `+N` É ALTURA ESCOLHIDA.
   ────────────────────────────────────────────────────────────────────────────
   Regra do dono, 13/08/2026, e ela é o que separa os dois casos que a medição
   achou juntos:

   | bloco | vão medido | tem `+N`? | |
   |---|---|---|---|
   | `atividade` | 29px | **sim (+32)** | 🔴 defeito — a tela diz "não coube mais" e deixa espaço |
   | `produtos` | 121px | não | ✅ fica — `BreakdownPanel` faz `.map` sem `slice`, mostra tudo |
   | `alertas` | 81px | não | ✅ fica |
   | `top-campanhas` | 56px | não | ✅ fica — `TabelaCampanhas` também não corta |

   ⛔ Consertar os três de baixo seria ENCHER o bloco com o que o usuário não
   pediu. A alça é dele; a altura, também.

   A asserção é ESTRUTURAL porque a de layout não existe em jsdom (§7.3): quem
   tem `+N` ancora o rodapé no fim, e `marginTop: auto` é o que faz isso. */
checar("todo bloco com `+N` ancora o rodapé no fim do card", () => {
  /* Linha de base dupla: os arquivos existem E de fato têm um `+N`. Sem ela,
     renomear o rodapé faria a guarda passar sobre dois arquivos sem rodapé. */
  const comMaisN = [
    ["FeedVendas", ler("../src/components/tk/FeedVendas.tsx")],
    ["AlertList", ler("../src/components/tk/AlertList.tsx")],
  ];
  for (const [nome, fonte] of comMaisN) {
    assert.match(fonte, /\+ \{/, `linha de base: ${nome} não tem rodapé de "+N"`);
    assert.match(
      fonte,
      /marginTop: "auto"/,
      `${nome} tem "+N" e não ancora o rodapé — o vão volta para o fim do card`,
    );
  }

  /* ⛔ E o outro lado: quem NÃO esconde nada não pode ganhar `slice`. Um corte
     silencioso ali seria conteúdo escondido SEM `+N`, que é pior que o vão —
     a tela deixaria de mostrar linha sem dizer que deixou. */
  for (const nome of ["BreakdownPanel", "TabelaCampanhas"]) {
    const fonte = semComentarios(ler(`../src/components/tk/${nome}.tsx`));
    assert.match(fonte, /linhas\.map\(/, `linha de base: ${nome} não desenha a lista`);
    assert.doesNotMatch(fonte, /linhas\.slice\(/, `${nome} passou a cortar a lista sem "+N"`);
  }
});

console.log(
  falhas.length === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas.length} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas.length === 0 ? 0 : 1);
