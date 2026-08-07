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
import { migrarLayout, layoutPadrao, colunasDoGridAntigo, linhasDoGridAntigo, MAX_FAIXA } from "@/components/dashboard/layout/migrar";
import { encaixarColunas, metaDoBloco, passosDoBloco, proximoPasso } from "@/components/dashboard/catalogo";
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
    console.log(`  [32m✓[0m ${nome} — ${JSON.stringify(obtido)}`);
  } else {
    falhas++;
    console.log(`  [31m✗[0m ${nome}\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`);
  }
}

const kpi = (m, x, y) => ({ i: `kpi:${m}`, x, y, w: 3, h: 4 });
const chart = (n, x, y, w) => ({ i: `chart:${n}`, x, y, w, h: 8 });

console.log("\n[1m1. Sem layout salvo[0m");
{
  const p = layoutPadrao();
  eq("null vira o padrão", migrarLayout(null), p);
  eq("undefined vira o padrão", migrarLayout(undefined), p);
  eq("array vazio vira o padrão", migrarLayout([]), p);
  // Prova que o padrão tem conteúdo — senão as três acima passariam com tudo vazio.
  eq("  …e o padrão tem 4 heros", p.hero.length, 4);
  eq("  …e painéis de verdade", p.paineis.length > 0, true);
}

console.log("\n[1m2. Layout antigo VÁLIDO[0m");
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
  eq("12 colunas do grid antigo chegam como 12", r.paineis.find((p) => p.id === "vendas-por-dia").col, 12);
  eq("4 colunas do grid antigo chegam como 4", r.paineis.find((p) => p.id === "funil").col, 4);

  /* 🔴 NINGUÉM PERDE BLOCO QUE EXISTE. A asserção mede o conjunto, não a
     contagem: contar 3 passaria se um bloco tivesse virado outro. */
  const esperados = ["funil", "fontes", "vendas-por-dia"];
  eq("nenhum bloco que ainda existe se perdeu", esperados.every((id) => r.paineis.some((p) => p.id === id)), true);
}

console.log("\n[1m3. Bloco que NÃO EXISTE mais[0m");
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

console.log("\n[1mAs guardas que a leitura do código exigiu[0m");
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

console.log("");
console.log("A grade de 12: encaixe, piso e o grid antigo");
{
  const funil = metaDoBloco("funil");            // colMin 4
  const porDia = metaDoBloco("vendas-por-dia");  // colMin 6

  /* 🔴 TODAS AS COLUNAS INTEIRAS EXISTEM. A lista curada `[3,4,6,8,12]` foi
     recusada pelo dono: cinco presets nao dao liberdade, dao formulario de cinco
     opcoes. O que segura o layout e o encaixe em coluna inteira e o minimo do
     bloco -- nao a escassez de opcoes. */
  eq("5 existe, e nao vira 4", encaixarColunas(5, funil), 5);
  eq("7 existe", encaixarColunas(7, funil), 7);
  eq("9, 10 e 11 existem", [9, 10, 11].map((c) => encaixarColunas(c, funil)).join(","), "9,10,11");
  eq("o bloco oferece do minimo ate 12, sem buraco",
     passosDoBloco(funil).join(","), "4,5,6,7,8,9,10,11,12");
  eq("fracao arredonda para a coluna mais proxima", encaixarColunas(6.6, funil), 7);
  eq("nunca abaixo do mínimo do bloco", encaixarColunas(3, porDia), 6);
  eq("  …nem com valor absurdo", encaixarColunas(-99, porDia), 6);
  eq("teto na largura da grade", encaixarColunas(999, funil), 12);

  /* 🔴 O grid ANTIGO já era de 12 colunas, então esta migração é quase uma
     identidade — e o `encaixarColunas` por cima é o que impede que um `w`
     gravado abaixo do mínimo de hoje entre num tamanho que o redimensionamento
     recusaria. Sem ele o modo de edição mostraria um bloco menor do que o
     próprio produto permite arrastar. */
  /* 🔴 A GUARDA DO CONTROLE INERTE. As setas da alça somavam +1 coluna e o
     encaixe devolvia o mesmo valor — de 4, `4+1=5` desempata para 4. As setas
     existiam e não moviam nada, e `tsc`/`lint`/`build` passaram os três. Estas
     quatro asserções são o caso que faz o defeito voltar a aparecer. */
  eq("seta para a direita anda UMA coluna", proximoPasso(funil, 4, +1), 5);
  eq("  ...e a da esquerda volta uma", proximoPasso(funil, 6, -1), 5);
  eq("no maior passo, a direita não passa do teto", proximoPasso(funil, 12, +1), 12);
  eq("no mínimo do bloco, a esquerda não desce", proximoPasso(porDia, 6, -1), 6);

  eq("grid antigo w=4 -> 4 colunas", colunasDoGridAntigo(4, funil), 4);
  eq("grid antigo w=12 -> 12 colunas", colunasDoGridAntigo(12, funil), 12);
  eq("grid antigo w=3 num bloco de mínimo 6 SOBE para 6", colunasDoGridAntigo(3, porDia), 6);

  /* ⚠️ A unidade de ALTURA mudou entre os dois grids: a linha do
     `react-grid-layout` valia ~30px e a de hoje vale 44. Um gráfico de `h: 8`
     tem de chegar com 6 linhas — a mesma altura na tela. 1:1 dobraria todo
     bloco de gráfico, e o usuário veria um layout que não é o dele. */
  /* 🔴 A ALTURA VEM DO CONTEUDO, e e a correcao do painel esburacado: um bloco
     VAZIO reservava as linhas que teria COM dado. So quem declara
     `alturaAjustavel` tem altura no layout; para o resto, `undefined` -- que nao
     e "nao sei", e "a altura e a do conteudo". */
  eq("bloco SEM alca de altura nao recebe linhas", linhasDoGridAntigo(8, funil), undefined);
  eq("  ...nem pelo padrao do produto",
     layoutPadrao().paineis.find((p) => p.id === "funil").linhas, undefined);
  const feed = metaDoBloco("atividade"); // alturaAjustavel
  eq("bloco COM alca: h=8 do grid antigo -> 6 linhas", linhasDoGridAntigo(8, feed), 6);
  eq("  ...e nunca abaixo do piso dele", linhasDoGridAntigo(1, feed), feed.linhasMin);
}


// ── O LAYOUT REAL DO PRODUTO ────────────────────────────────────────────────
//
// 🔴 A fixture NÃO é um exemplo inventado: o comentário
// dele diz "transcrito do arranjo do usuário (30/07/2026)". É o layout que toda
// conta viu por semanas, e o que está gravado nos `DashboardLayout` de quem
// nunca customizou. Migrar ELE é o teste que mais se aproxima de produção.
console.log("\n[1mO layout REAL do produto (defaultLayout de blocks.ts)[0m");
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
console.log("\n[1mO envelope v2[0m");
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

  /* 🔴 GUARDA: o v2 falava por RÓTULO e continua sendo lido — ele foi o formato
     gravado entre 06 e 07/08/2026, e tratá-lo como desconhecido faria quem
     salvou naquela janela cair no padrão, perdendo o arranjo em silêncio.
     Antes: largura que o bloco NÃO declara. `funil` aceitava um-terco/metade;
     um `cheia` gravado (por versão antiga ou edição manual) cai na padrão DELE,
     não é aceito. Sem isto o modo de edição mostraria uma largura que ele mesmo
     não oferece. */
  eq("v2 'cheia' vira 12 colunas",
     v2({ paineis: [{ id: "funil", largura: "cheia" }] }).paineis[0].col, 12);
  eq("v2 'metade' vira 6 colunas",
     v2({ paineis: [{ id: "funil", largura: "metade" }] }).paineis[0].col, 6);
  eq("v2 'um-terco' num bloco de mínimo 6 SOBE para 6",
     v2({ paineis: [{ id: "vendas-por-dia", largura: "um-terco" }] }).paineis[0].col, 6);
  eq("v2 nao trazia altura -- e o bloco sem alca continua sem",
     v2({ paineis: [{ id: "funil", largura: "metade" }] }).paineis[0].linhas, undefined);

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
    ? `\n[1m[32m${ok} asserções passaram, 0 falharam.[0m\n`
    : `\n[1m[31m${ok} passaram, ${falhas} FALHARAM.[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
