/**
 * Asserções da migração de layout. Sem banco, sem rede.
 *
 * 🔴 CADA GUARDA DA MIGRAÇÃO É EXERCITADA UMA VEZ AQUI, e é por isso que este
 * arquivo existe: *guarda que nunca disparou não é guarda*. Migração cujo
 * caminho de erro nunca foi produzido é migração não testada — e ela é a peça
 * que, falhando, deixa o usuário sem tela.
 *
 * Os três casos obrigatórios:
 *   1. sem layout salvo        → vê o padrão
 *   2. layout antigo válido    → migrado, e nada que ainda existe se perde
 *   3. bloco que não existe    → descartado em silêncio, sem quebrar
 *
 * Mais os que a leitura do código exigiu: hero incompleto, faixa acima do teto,
 * layout corrompido, e o layout que só tem blocos mortos.
 */
import { migrarLayout, layoutPadrao, larguraMaisProxima, MAX_FAIXA } from "@/components/dashboard/layout/migrar";
import { readFileSync } from "node:fs";

/**
 * O LAYOUT REAL DO PRODUTO, CONGELADO.
 *
 * ⛔ Ele vinha de `defaultLayout()` de `components/dashboard/blocks.ts`, que foi
 * DELETADO em 06/08/2026 com o resto do grid antigo. O arranjo não podia morrer
 * junto: ele é o que está gravado nos `DashboardLayout` de quem nunca
 * customizou, e migrar ELE é o caso mais próximo de produção que este teste tem.
 *
 * ⚠️ Congelar é melhor do que importar, e não é só consequência da remoção: um
 * teste de MIGRAÇÃO cuja entrada vem do código vivo passa a medir o presente
 * contra o presente. O que ele precisa medir é o passado — e o passado não muda
 * mais, então tem de ser um arquivo.
 */
const LAYOUT_ANTIGO = JSON.parse(
  readFileSync(new URL("./fixtures/layout-antigo-padrao.json", import.meta.url), "utf8"),
);
const defaultLayout = (vp) => LAYOUT_ANTIGO[vp];

/** Cópia do `DE_PARA` da migração — para a asserção saber o que É migrável. */
const DESTINOS = {
  "chart:funil": "funil", "chart:fontes": "fontes", "chart:produtos": "produtos",
  "chart:pagamentos": "pagamentos", "chart:vendasDia": "vendas-por-dia",
  "chart:vendasHora": "vendas-por-hora", "chart:lucroHora": "lucro-por-hora",
  "chart:aprovacao": "aprovacao", "chart:feed": "atividade",
};

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${JSON.stringify(obtido)}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`);
  }
}

const kpi = (m, x, y) => ({ i: `kpi:${m}`, x, y, w: 3, h: 4 });
const chart = (n, x, y, w) => ({ i: `chart:${n}`, x, y, w, h: 8 });

console.log("\n\x1b[1m1. Sem layout salvo\x1b[0m");
{
  const p = layoutPadrao();
  eq("null vira o padrão", migrarLayout(null), p);
  eq("undefined vira o padrão", migrarLayout(undefined), p);
  eq("array vazio vira o padrão", migrarLayout([]), p);
  // Prova que o padrão tem conteúdo — senão as três acima passariam com tudo vazio.
  eq("  …e o padrão tem 4 heros", p.hero.length, 4);
  eq("  …e painéis de verdade", p.paineis.length > 0, true);
}

console.log("\n\x1b[1m2. Layout antigo VÁLIDO\x1b[0m");
{
  const antigo = [
    kpi("faturamento", 0, 0), kpi("vendas", 3, 0), kpi("roas", 6, 0), kpi("cpa", 9, 0),
    kpi("ticket", 0, 4), kpi("margem", 3, 4),
    chart("funil", 0, 8, 4), chart("fontes", 4, 8, 4), chart("vendasDia", 0, 16, 12),
  ];
  const r = migrarLayout(antigo);

  eq("os 4 primeiros KPIs viram o hero, na ordem do usuário", r.hero, ["faturamento", "vendas", "roas", "cpa"]);
  eq("o resto vai para a faixa, na ordem", r.faixa, ["ticket", "margem"]);
  eq("os 3 painéis sobrevivem, na ordem de leitura", r.paineis.map((p) => p.id), ["funil", "fontes", "vendas-por-dia"]);

  /* A LARGURA cai na permitida mais próxima ENTRE AS DO BLOCO. `vendasDia`
     ocupava 12 colunas e aceita metade/cheia → cheia. `funil` ocupava 4 e
     aceita um-terco/metade → um-terco. */
  eq("12 colunas -> cheia (o bloco aceita)", r.paineis.find((p) => p.id === "vendas-por-dia").largura, "cheia");
  eq("4 colunas -> um-terco", r.paineis.find((p) => p.id === "funil").largura, "um-terco");

  /* 🔴 NINGUÉM PERDE BLOCO QUE EXISTE. A asserção mede o conjunto, não a
     contagem: contar 3 passaria se um bloco tivesse virado outro. */
  const esperados = ["funil", "fontes", "vendas-por-dia"];
  eq("nenhum bloco que ainda existe se perdeu", esperados.every((id) => r.paineis.some((p) => p.id === id)), true);
}

console.log("\n\x1b[1m3. Bloco que NÃO EXISTE mais\x1b[0m");
{
  /* `chart:posicionamento` sumiu do produto; `chart:receita` e `chart:paises`
     viraram blocos ESTRUTURAIS, fixos no Dashboard e fora do catálogo. Os três
     têm de sumir sem levar os vizinhos junto. */
  const antigo = [
    kpi("faturamento", 0, 0), kpi("gasto", 3, 0), kpi("roas", 6, 0), kpi("lucroLiquido", 9, 0),
    chart("posicionamento", 0, 8, 6),
    chart("funil", 6, 8, 6),
    chart("receita", 0, 16, 12),
    chart("paises", 0, 24, 12),
  ];
  const r = migrarLayout(antigo);

  eq("o bloco inexistente foi descartado", r.paineis.some((p) => p.id === "posicionamento"), false);
  eq("os estruturais também (não estão no catálogo)", r.paineis.map((p) => p.id), ["funil"]);
  // Prova que havia o que descartar — senão "não contém" passa com lista vazia.
  eq("  …e havia 3 para descartar de 4 (senão isto é vácuo)", antigo.filter((i) => i.i.startsWith("chart:")).length, 4);
  eq("o vizinho sobreviveu", r.paineis[0].id, "funil");
  eq("e o hero ficou intacto", r.hero, ["faturamento", "gasto", "roas", "lucroLiquido"]);
}

console.log("\n\x1b[1mAs guardas que a leitura do código exigiu\x1b[0m");
{
  /* HERO COM MENOS DE 4 — o modo de edição proíbe esse estado, então ele não
     pode NASCER da migração. Completa com o padrão, sem repetir. */
  const r = migrarLayout([kpi("vendas", 0, 0), kpi("roas", 3, 0)]);
  eq("hero incompleto é completado até 4", r.hero.length, 4);
  eq("  …mantendo a escolha do usuário na frente", r.hero.slice(0, 2), ["vendas", "roas"]);
  eq("  …e sem repetir o que ele já tinha", new Set(r.hero).size, 4);

  /* FAIXA ACIMA DO TETO */
  const muitos = ["faturamento", "gasto", "roas", "lucroLiquido", "ticket", "ctr", "cpa", "arpu", "margem", "vendas", "roi", "liquido", "chargeback"];
  const r2 = migrarLayout(muitos.map((m, i) => kpi(m, (i % 4) * 3, Math.floor(i / 4) * 4)));
  eq(`faixa não passa de ${MAX_FAIXA}`, r2.faixa.length <= MAX_FAIXA, true);
  eq("  …e havia mais que isso para cortar", muitos.length - 4 > MAX_FAIXA, true);

  /* LAYOUT CORROMPIDO — nunca lança, sempre devolve algo desenhável. */
  eq("objeto no lugar de array -> padrão", migrarLayout({ i: "kpi:roas" }), layoutPadrao());
  eq("array de lixo -> padrão", migrarLayout([1, "x", null]), layoutPadrao());
  eq("item sem `i` é ignorado", migrarLayout([{ x: 0, y: 0, w: 3, h: 4 }]), layoutPadrao());

  /* SÓ BLOCOS MORTOS — a zona 3 não pode ficar vazia: zona vazia parece tela
     quebrada, e o usuário não tem como saber que foi o layout dele. */
  const r3 = migrarLayout([kpi("roas", 0, 0), chart("posicionamento", 0, 8, 6)]);
  eq("layout só com blocos mortos cai no padrão de painéis", r3.paineis.length, layoutPadrao().paineis.length);

  /* DUPLICATA no salvo — o grid antigo permitia. */
  const r4 = migrarLayout([chart("funil", 0, 8, 4), chart("funil", 4, 8, 4)]);
  eq("bloco duplicado entra uma vez só", r4.paineis.filter((p) => p.id === "funil").length, 1);
}

console.log("\n\x1b[1mLargura: a mais próxima ENTRE AS DO BLOCO\x1b[0m");
{
  eq("12 col, só aceita um-terco/metade -> metade", larguraMaisProxima(12, ["um-terco", "metade"]), "metade");
  eq("  …e NÃO 'cheia', que o bloco não aceita", larguraMaisProxima(12, ["um-terco", "metade"]) === "cheia", false);
  eq("4 col -> um-terco", larguraMaisProxima(4, ["um-terco", "metade", "cheia"]), "um-terco");
  eq("6 col -> metade", larguraMaisProxima(6, ["um-terco", "metade", "cheia"]), "metade");
  eq("largura absurda não quebra", larguraMaisProxima(99, ["um-terco"]), "um-terco");
}


// ── O LAYOUT REAL DO PRODUTO ────────────────────────────────────────────────
//
// 🔴 A fixture NÃO é um exemplo inventado: o comentário
// dele diz "transcrito do arranjo do usuário (30/07/2026)". É o layout que toda
// conta viu por semanas, e o que está gravado nos `DashboardLayout` de quem
// nunca customizou. Migrar ELE é o teste que mais se aproxima de produção.
console.log("\n\x1b[1mO layout REAL do produto (defaultLayout de blocks.ts)\x1b[0m");
{
  for (const vp of ["desktop", "mobile"]) {
    const antigo = defaultLayout(vp);
    const r = migrarLayout(antigo);

    eq(`${vp}: hero com exatamente 4`, r.hero.length, 4);
    eq(`${vp}: faixa dentro do teto`, r.faixa.length <= MAX_FAIXA, true);

    /* 🔴 A ASSERÇÃO QUE IMPORTA: nenhum bloco MIGRÁVEL se perdeu. Ela conta os
       `chart:` do layout real que têm destino no catálogo e exige que TODOS
       apareçam — se um dia alguém remover uma entrada do `DE_PARA` por engano,
       esta linha cai. Contar só `paineis.length` não pegaria: um bloco a mais e
       um a menos dariam o mesmo número. */
    const migraveis = antigo.filter((i) => i.i.startsWith("chart:") && DESTINOS[i.i]).map((i) => DESTINOS[i.i]);
    const sobreviventes = new Set(r.paineis.map((p) => p.id));
    eq(`${vp}: todos os ${migraveis.length} painéis migráveis sobreviveram`, migraveis.every((id) => sobreviventes.has(id)), true);
    // Prova que havia o que migrar — senão o `every` passa com lista vazia.
    eq(`${vp}:   …e havia migráveis (senão o every é vácuo)`, migraveis.length > 0, true);

    /* E os que NÃO têm destino somem: dois viraram estruturais e um morreu. */
    const semDestino = antigo.filter((i) => i.i.startsWith("chart:") && !DESTINOS[i.i]);
    eq(`${vp}: os ${semDestino.length} sem destino foram descartados`, r.paineis.length, migraveis.length);
  }
}


// ── O ENVELOPE v2 (o que o modo de edição grava) ───────────────────────────
//
// 🔴 UM LAYOUT v2 PASSA PELAS MESMAS REGRAS DE UM ANTIGO. Confiar na marca `v:2`
// para pular a validação é confiar que o passado obedeceu regras que só existem
// no presente — e o payload pode ter vindo de uma versão anterior do editor, de
// edição manual, ou de um restore de backup.
console.log("\n\x1b[1mO envelope v2\x1b[0m");
{
  const v2 = (o) => migrarLayout({ v: 2, hero: [], faixa: [], paineis: [], ...o });

  eq("v2 é reconhecido e NÃO passa pela migração de grid",
     v2({ hero: ["vendas", "cpa", "roas", "margem"], faixa: ["ctr"], paineis: [{ id: "funil", largura: "metade" }] }).hero,
     ["vendas", "cpa", "roas", "margem"]);

  /* GUARDA: hero v2 com menos de 4 — completa, igual ao caminho antigo. */
  eq("v2 com hero de 2 é completado até 4", v2({ hero: ["vendas", "cpa"] }).hero.length, 4);

  /* GUARDA: bloco que saiu do catálogo DEPOIS de gravado. */
  const r = v2({ paineis: [{ id: "funil", largura: "metade" }, { id: "bloco-que-morreu", largura: "cheia" }] });
  eq("v2 descarta bloco fora do catálogo", r.paineis.map((p) => p.id), ["funil"]);

  /* 🔴 GUARDA: largura que o bloco NÃO declara. `funil` aceita um-terco/metade;
     um `cheia` gravado (por versão antiga ou edição manual) cai na padrão DELE,
     não é aceito. Sem isto o modo de edição mostraria uma largura que ele mesmo
     não oferece. */
  eq("v2 com largura não declarada cai na padrão do bloco",
     v2({ paineis: [{ id: "funil", largura: "cheia" }] }).paineis[0].largura, "um-terco");
  eq("  …e a largura declarada é mantida",
     v2({ paineis: [{ id: "funil", largura: "metade" }] }).paineis[0].largura, "metade");

  /* GUARDA: faixa acima do teto e duplicata entre hero e faixa. */
  eq("v2 respeita o teto da faixa",
     v2({ hero: ["a","b","c","d"], faixa: ["m1","m2","m3","m4","m5","m6","m7","m8","m9","m10"] }).faixa.length, MAX_FAIXA);
  eq("v2 não deixa a mesma métrica no hero E na faixa",
     v2({ hero: ["vendas","cpa","roas","margem"], faixa: ["vendas","ctr"] }).faixa, ["ctr"]);

  /* GUARDA: v2 corrompido. */
  /* 🔴 LISTA VAZIA VÁLIDA != CAMPO CORROMPIDO, e a assercao existe porque eu
     tinha colapsado os dois. No modo de edicao o usuario PODE remover todos os
     paineis; um `[]` legitimo caindo no padrao desfaria a escolha dele em
     silencio no recarregamento. */
  eq("v2 com `paineis` NÃO-array cai no padrão (corrupção)",
     migrarLayout({ v: 2, hero: "x", faixa: null, paineis: "y" }).paineis.length, layoutPadrao().paineis.length);
  eq("v2 com `paineis: []` RESPEITA a escolha (o usuário removeu todos)",
     v2({ paineis: [] }).paineis.length, 0);
  eq("  …e ainda entrega 4 heros", migrarLayout({ v: 2, hero: "x", faixa: null, paineis: "y" }).hero.length, 4);

  /* O CONTROLE: sem a marca, é grid antigo. Se `ehLayoutV2` ficasse frouxo e
     aceitasse qualquer objeto, o caminho de migração morreria em silêncio. */
  eq("objeto SEM `v:2` não é tratado como v2 (vai para o padrão)",
     migrarLayout({ hero: ["vendas"] }), layoutPadrao());
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
