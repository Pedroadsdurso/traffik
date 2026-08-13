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
  encaixarAltura,
  metaDoBloco,
} = await import("../src/components/dashboard/catalogo.ts");
const { alturaMigrada, celulasDeLinhas, layoutPadrao, migrarAlturas, migrarLayout, precisaMigrarAltura } =
  await import("../src/components/dashboard/layout/migrar.ts");
const { CountryPanel } = await import("../src/components/tk/CountryPanel.tsx");

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

checar("a tabela da F0b cobre TODO o catálogo (senão a varredura é parcial)", () => {
  assert.equal(F0B.length, CATALOGO_META.length);
  assert.deepEqual(
    F0B.map(([id]) => id).sort(),
    CATALOGO_META.map((b) => b.id).sort(),
  );
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
checar("hoje `hMin` e `hPadrao` são iguais nos 16 — a F3 é quem separa os dois", () => {
  const separados = CATALOGO_META.filter((b) => b.hMin !== b.hPadrao).map((b) => b.id);
  assert.deepEqual(separados, []);
  assert.ok(CATALOGO_META.every((b) => b.hPadrao >= b.hMin));
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
  const funil = l.paineis.find((p) => p.id === "funil");
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
  assert.equal(r.paineis.find((p) => p.id === "funil").h, undefined);
  assert.equal(r.paineis.find((p) => p.id === "fontes").h, metaDoBloco("fontes").hMin);
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
  assert.equal(r.paineis.find((p) => p.id === "funil").h, 5);
  assert.equal(r.paineis.find((p) => p.id === "fontes").h, metaDoBloco("fontes").hPadrao);
  /* ⛔ ESTA ASSERÇÃO AFIRMAVA O CONTRÁRIO — que o campo legado SOME no migrado,
     "porque é ele que impede a próxima abertura de converter de novo". As duas
     metades estavam erradas: quem impede a reconversão é o `h` existir
     (`precisaMigrarAltura`), e descartar o legado jogava fora a única rede de
     uma conversão irreversível que roda sozinha em produção.
     Ver as três asserções de REDE, abaixo. */
  assert.equal(r.paineis.find((p) => p.id === "funil").linhasLegado, 5);
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
  const funil = r.paineis.find((p) => p.id === "funil");
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
  const funil = l.paineis.find((p) => p.id === "funil");
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
  assert.match(corpo, /linhas: p\.linhasLegado/);
  /* E o tipo do servidor precisa aceitá-lo, senão o `tsc` estaria calado sobre
     um campo que nunca chega ao banco. */
  const acao = ler("../src/lib/actions/dashboardLayout.ts");
  const j = acao.indexOf("interface PainelSalvo");
  assert.ok(j > 0, "linha de base: `PainelSalvo` não existe");
  assert.match(acao.slice(j, acao.indexOf("\n}", j)), /linhas\?: number/);
});

checar("bloco JÁ migrado não é tocado — nem quando ficaria maior", () => {
  const v4 = { v: 4, hero: V3.hero, faixa: V3.faixa, paineis: [{ id: "funil", col: 6, h: 8 }] };
  const l = migrarLayout(v4);
  assert.equal(l.paineis.find((p) => p.id === "funil").h, 8);
  assert.equal(precisaMigrarAltura(l), false);
  const r = migrarAlturas(l, () => true);
  assert.equal(r.paineis.find((p) => p.id === "funil").h, 8);
});

checar("o padrão do produto já nasce migrado — conta nova não passa pela guarda", () => {
  const padrao = layoutPadrao();
  assert.equal(precisaMigrarAltura(padrao), false);
  assert.ok(padrao.paineis.length > 0, "linha de base: o padrão tem painéis");
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
  const i = tela.indexOf("const GRADE: React.CSSProperties");
  assert.ok(i > 0, "linha de base: a constante GRADE não existe");
  const corpo = tela.slice(i, tela.indexOf("};", i));
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

console.log(
  falhas.length === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas.length} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas.length === 0 ? 0 : 1);
