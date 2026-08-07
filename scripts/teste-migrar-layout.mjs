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
import { ESTRUTURAIS, encaixarColunas, metaDoBloco, passosDoBloco, proximoPasso, reporEstruturais } from "@/components/dashboard/catalogo";
import { avisoDeSobra, linhasDaGrade } from "@/components/dashboard/layout/grade";
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
  /* 🔴 OS TRÊS QUE VOLTARAM em 07/08/2026. `chart:receita` e `chart:paises`
     eram descartados porque os blocos estavam fora do catálogo (JSX fixo na
     tela); `chart:posicionamento` porque o bloco não existia. As três premissas
     caíram — ver o `DE_PARA` da migração. */
  "chart:receita": "receita-gasto", "chart:paises": "paises",
  "chart:posicionamento": "posicionamento",
};

const IDS_ESTRUTURAIS = ESTRUTURAIS.map((b) => b.id);
/** Os ids do resultado que NÃO são estruturais, na ordem. */
const opcionais = (r) => r.paineis.map((p) => p.id).filter((id) => !IDS_ESTRUTURAIS.includes(id));
/** Todo estrutural está presente? É a garantia de "não pode ser ocultado". */
const temTodosEstruturais = (r) => IDS_ESTRUTURAIS.every((id) => r.paineis.some((p) => p.id === id));

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
  eq("os 3 painéis sobrevivem, na ordem de leitura", opcionais(r), ["funil", "fontes", "vendas-por-dia"]);
  /* ⚠️ A asserção olha só os OPCIONAIS porque os quatro estruturais entram
     sempre, no fim — se ela comparasse a lista inteira, mediria a reposição
     junto com a ordem de leitura e não se saberia qual das duas quebrou. */
  eq("  …e os estruturais foram repostos", temTodosEstruturais(r), true);

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
  /* ⚠️ ESTE CASO MUDOU DE PROTAGONISTA em 07/08/2026, e a mudança é
     instrutiva. Ele testava `chart:posicionamento`, `chart:receita` e
     `chart:paises` — os três "que não existem mais". Os três voltaram a existir,
     então testá-los aqui provaria o contrário do que o nome diz.

     ⛔ Um bloco INVENTADO (`chart:bloco-que-morreu`) é a entrada certa para esta
     guarda, e agora é permanente: ele nunca vai voltar ao catálogo, então a
     asserção não pode envelhecer de novo. Usar um id real fazia o teste depender
     de uma decisão de produto que muda. */
  const antigo = [
    kpi("faturamento", 0, 0), kpi("gasto", 3, 0), kpi("roas", 6, 0), kpi("lucroLiquido", 9, 0),
    chart("bloco-que-morreu", 0, 8, 6),
    chart("funil", 6, 8, 6),
  ];
  const r = migrarLayout(antigo);

  eq("o bloco inexistente foi descartado", r.paineis.some((p) => p.id === "bloco-que-morreu"), false);
  eq("e não levou o vizinho junto", opcionais(r), ["funil"]);
  // Prova que havia o que descartar — senão "não contém" passa com lista vazia.
  eq("  …e havia 1 para descartar de 2 (senão isto é vácuo)", antigo.filter((i) => i.i.startsWith("chart:")).length, 2);
  eq("e o hero ficou intacto", r.hero, ["faturamento", "gasto", "roas", "lucroLiquido"]);

  /* 🔴 OS TRÊS QUE VOLTARAM, com asserção própria. Sem ela, apagar uma entrada
     do `DE_PARA` por engano voltaria a descartar o arranjo do usuário em
     silêncio — que é o modo de falha desta função. */
  const rv = migrarLayout([
    kpi("faturamento", 0, 0),
    chart("receita", 0, 8, 12),
    chart("paises", 0, 16, 8),
    chart("posicionamento", 8, 16, 4),
  ]);
  eq("`chart:receita` volta como painel (era descartado)", rv.paineis.some((p) => p.id === "receita-gasto"), true);
  eq("`chart:paises` volta como painel (era descartado)", rv.paineis.some((p) => p.id === "paises"), true);
  eq("`chart:posicionamento` volta como painel (o bloco existe de novo)",
     rv.paineis.some((p) => p.id === "posicionamento"), true);
  /* 🔴 E A LARGURA DELE É A DO USUÁRIO, não a do padrão. Mapear o id sem
     preservar a largura entregaria o bloco de volta no lugar errado — que para
     quem customizou é indistinguível de ter perdido o arranjo. */
  eq("  …e o `w: 8` gravado vira 8 colunas", rv.paineis.find((p) => p.id === "paises").col, 8);
  eq("  …e o `w: 12` também", rv.paineis.find((p) => p.id === "receita-gasto").col, 12);
}

console.log("\n[1m3b. ESTRUTURAL NÃO PODE SUMIR DO LAYOUT[0m");
{
  /* 🔴 A REPOSIÇÃO É O QUE FAZ "NÃO PODE SER OCULTADO" SER UMA GARANTIA, e não
     uma promessa da interface. A ausência do ✕ cobre o usuário de hoje; ela não
     cobre um layout gravado por uma versão anterior — que é justamente o estado
     de todo mundo que salvou antes de 07/08/2026, porque naquele formato os
     estruturais NÃO estavam na zona. */
  eq("layout v3 sem nenhum estrutural recebe os quatro de volta",
     temTodosEstruturais(migrarLayout({ v: 3, hero: [], faixa: [], paineis: [{ id: "funil", col: 6 }] })), true);
  // Prova que havia o que repor — senão a asserção passaria com o padrão.
  eq("  …e o opcional gravado continua lá, na frente",
     opcionais(migrarLayout({ v: 3, hero: [], faixa: [], paineis: [{ id: "funil", col: 6 }] })), ["funil"]);

  /* ⛔ REPOR NÃO PODE MEXER EM QUEM JÁ ESTÁ. Se o usuário arrastou `Alertas`
     para a primeira posição com 8 colunas, é assim que ele volta. */
  const custom = migrarLayout({
    v: 3, hero: [], faixa: [],
    paineis: [{ id: "alertas", col: 8 }, { id: "funil", col: 4 }],
  });
  eq("estrutural JÁ PRESENTE mantém posição", custom.paineis[0].id, "alertas");
  eq("  …e mantém a largura escolhida", custom.paineis[0].col, 8);

  /* A função pura, isolada — o `reporEstruturais` é quem carrega a regra. */
  eq("`reporEstruturais([])` devolve exatamente os estruturais",
     reporEstruturais([]).map((p) => p.id), IDS_ESTRUTURAIS);
  eq("  …e é idempotente", reporEstruturais(reporEstruturais([])).length, IDS_ESTRUTURAIS.length);
  // Prova que a lista não está vazia — senão as duas acima são vácuo.
  eq("  …e há estruturais para repor", IDS_ESTRUTURAIS.length > 0, true);
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
  const r3 = migrarLayout([kpi("roas", 0, 0), chart("bloco-que-morreu", 0, 8, 6)]);
  eq("layout só com blocos mortos cai no padrão de painéis", r3.paineis.length, layoutPadrao().paineis.length);

  /* DUPLICATA no salvo — o grid antigo permitia. */
  const r4 = migrarLayout([chart("funil", 0, 8, 4), chart("funil", 4, 8, 4)]);
  eq("bloco duplicado entra uma vez só", r4.paineis.filter((p) => p.id === "funil").length, 1);
}

console.log("");
console.log("Empacotamento da linha e o aviso de sobra");
{
  eq("linha que fecha em 12 nao tem sobra", linhasDaGrade([6, 6]).map((l) => l.livres).join(","), "0");
  eq("6+4 deixa 2 livres", linhasDaGrade([6, 4])[0].livres, 2);
  eq("  ...e o aviso diz quantas", avisoDeSobra(linhasDaGrade([6, 4])[0].livres), "2 colunas livres");
  eq("uma sozinha fica no singular", avisoDeSobra(1), "1 coluna livre");
  eq("linha fechada NAO tem aviso", avisoDeSobra(0), null);

  /* O que nao cabe DESCE inteiro -- e o proximo comeca a linha nova. E a
     politica do CSS Grid sem `dense`, que esta funcao simula. */
  const tres = linhasDaGrade([6, 4, 4]);
  eq("o que nao cabe desce", tres.length, 2);
  eq("  ...e a linha 1 fica com dois", tres[0].indices.join(","), "0,1");
  eq("  ...e a 2 comeca com o terceiro", tres[1].indices.join(","), "2");
  eq("  ...com 8 livres nela", tres[1].livres, 8);

  /* ⚠️ Largura invalida vira grade CHEIA, nunca descartada. Descartar faria o
     painel sumir do agrupamento e aparecer na tela -- o aviso mentiria sobre
     uma linha que existe. */
  eq("largura zero nao some do agrupamento", linhasDaGrade([0, 6]).length, 2);
  eq("  ...e ocupa a linha inteira", linhasDaGrade([0, 6])[0].livres, 0);

  eq("lista vazia nao produz linha", linhasDaGrade([]).length, 0);
}

console.log("A grade de 12: encaixe, piso e o grid antigo");
{
  const funil = metaDoBloco("funil");            // colMin 4
  const porDia = metaDoBloco("vendas-por-dia");  // colMin 4
  /* 🔴 ESCOLHIDO POR PROPRIEDADE, NÃO POR NOME. Um id cravado aqui (`"funil"`,
     que era o que estava) quebra no dia em que aquele bloco ganhar alça de
     altura — foi exatamente o que aconteceu em 07/08/2026. Perguntando ao
     catálogo qual bloco NÃO tem alça, a asserção continua medindo o que promete
     medir depois de qualquer mudança de produto. */
  const semAlca = metaDoBloco("fontes");
  eq("o bloco de referência realmente não tem alça de altura", !!semAlca.alturaAjustavel, false);

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
  /* ⛔ CONGELA A RELACAO, NAO O NUMERO. Estas duas diziam `6` — o `colMin`
     que `vendas-por-dia` tinha no C2. No C3 ele desceu para 4 junto com as
     container queries, e elas cairam sem que nada estivesse errado. Teste que
     congela VALOR defende o bug; o que congela RELACAO defende o conserto: o
     que tem de valer e "nunca abaixo do minimo DELE". */
  eq("nunca abaixo do minimo do bloco",
     encaixarColunas(porDia.colMin - 2, porDia), porDia.colMin);
  eq("  ...nem com valor absurdo", encaixarColunas(-99, porDia), porDia.colMin);
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
  eq("no minimo do bloco, a esquerda nao desce",
     proximoPasso(porDia, porDia.colMin, -1), porDia.colMin);

  eq("grid antigo w=4 -> 4 colunas", colunasDoGridAntigo(4, funil), 4);
  eq("grid antigo w=12 -> 12 colunas", colunasDoGridAntigo(12, funil), 12);
  eq("grid antigo abaixo do minimo SOBE para ele",
     colunasDoGridAntigo(porDia.colMin - 1, porDia), porDia.colMin);

  /* ⚠️ A unidade de ALTURA mudou entre os dois grids: a linha do
     `react-grid-layout` valia ~30px e a de hoje vale 44. Um gráfico de `h: 8`
     tem de chegar com 6 linhas — a mesma altura na tela. 1:1 dobraria todo
     bloco de gráfico, e o usuário veria um layout que não é o dele. */
  /* 🔴 A ALTURA VEM DO CONTEUDO, e e a correcao do painel esburacado: um bloco
     VAZIO reservava as linhas que teria COM dado. So quem declara
     `alturaAjustavel` tem altura no layout; para o resto, `undefined` -- que nao
     e "nao sei", e "a altura e a do conteudo". */
  /* ⚠️ O BLOCO DE REFERÊNCIA MUDOU: o `funil` GANHOU alça de altura em
     07/08/2026 (a fita cresce e ganha resolução vertical), então ele deixou de
     poder exercer esta guarda. `fontes` é tabela curta — altura extra ali é ar,
     e é por isso que ele não tem alça. */
  eq("bloco SEM alca de altura nao recebe linhas", linhasDoGridAntigo(8, semAlca), undefined);
  eq("  ...nem pelo padrao do produto",
     layoutPadrao().paineis.find((p) => p.id === semAlca.id).linhas, undefined);
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

    /* 🔴 NADA A MAIS E NADA A MENOS. A asserção antiga era
       `paineis.length === migraveis.length`, e ela deixou de valer quando os
       estruturais passaram a ser REPOSTOS: o layout real de 30/07 não tem
       `Alertas` nem o rodapé, então dois entram por reposição e a contagem sobe.

       ⛔ Não foi afrouxada para "≥": o conjunto esperado é exatamente
       migráveis ∪ estruturais, e comparar o TAMANHO desse conjunto com o
       resultado continua caindo se um bloco se perder, se um duplicar, ou se a
       reposição parar de rodar. Trocar por `≥` teria deixado de medir a perda,
       que é o defeito que este arquivo existe para pegar. */
    const esperado = new Set([...migraveis, ...IDS_ESTRUTURAIS]);
    eq(`${vp}: nem sobrou nem faltou painel`, r.paineis.length, esperado.size);
    eq(`${vp}:   …e os estruturais que o layout real não tinha entraram`,
       IDS_ESTRUTURAIS.filter((id) => !migraveis.includes(id)).length > 0, true);
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
  eq("v2 descarta bloco fora do catálogo", opcionais(r), ["funil"]);

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
  /* ⚠️ `um-terco` valia 4 colunas. A assercao so mede subida enquanto o
     minimo do bloco for MAIOR que 4 — senao ela passaria por coincidencia, sem
     poder falhar pelo motivo que alega medir. Por isso ela pergunta o maximo
     entre os dois, e continua verdadeira dos dois lados da mudanca de minimo. */
  eq("v2 'um-terco' nunca entra abaixo do minimo do bloco",
     v2({ paineis: [{ id: "vendas-por-dia", largura: "um-terco" }] }).paineis[0].col,
     Math.max(4, metaDoBloco("vendas-por-dia").colMin));
  eq("v2 nao trazia altura -- e o bloco sem alca continua sem",
     v2({ paineis: [{ id: "fontes", largura: "metade" }] }).paineis[0].linhas, undefined);

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
  /* ⚠️ "TODOS" QUER DIZER TODOS OS OPCIONAIS. Os quatro estruturais voltam —
     remover um opcional é uma escolha que o produto oferece; ocultar um
     estrutural não é. A asserção mede os opcionais para continuar podendo
     falhar pelo motivo que alega medir: comparar `paineis.length` com 4 passaria
     igual se a lista caísse no padrão e por acaso tivesse 4 itens. */
  eq("v2 com `paineis: []` RESPEITA a escolha (o usuário removeu todos os opcionais)",
     opcionais(v2({ paineis: [] })), []);
  eq("  …e os estruturais continuam lá", temTodosEstruturais(v2({ paineis: [] })), true);
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
