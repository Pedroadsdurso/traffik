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
 *
 * ### 🔴 E A SEÇÃO QUE A F5 ACRESCENTOU: **ninguém muda de lugar**
 *
 * A F5 colapsou três zonas numa grade só. A promessa que ela fez é dura de
 * verificar e fácil de quebrar: *"quem já tem layout salvo abre o Dashboard e
 * encontra os cards onde deixou"*. A única mudança de posição declarada é a
 * faixa de oito métricas virando duas fileiras de quatro — **qualquer outra é
 * defeito**, e a seção 5 é quem mede isso.
 */
import { migrarLayout, layoutPadrao, colunasDoGridAntigo, linhasDoGridAntigo, fileirasDeMetricas, MAX_FAIXA, METRICAS_POR_FILEIRA } from "@/components/dashboard/layout/migrar";
import { CATALOGO_META, COLUNAS_GRADE, ESTRUTURAIS, ehBlocoDeMetrica, encaixarColunas, metaDoBloco, passosDoBloco, proximoPasso, reporEstruturais } from "@/components/dashboard/catalogo";
import { idDaMetrica, METRICAS } from "@/components/dashboard/metricas";
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
     tela); `chart:posicionamento` porque o bloco não existia. */
  "chart:receita": "receita-gasto", "chart:paises": "paises",
  "chart:posicionamento": "posicionamento",
};

const IDS_ESTRUTURAIS = ESTRUTURAIS.map((b) => b.id);
/** Os PAINÉIS do resultado que não são estruturais, na ordem. */
const opcionais = (r) => r.blocos.map((p) => p.id).filter((id) => !IDS_ESTRUTURAIS.includes(id) && !ehBlocoDeMetrica(id));
/** As métricas do resultado, na ordem em que a grade as desenha. */
const metricas = (r) => r.blocos.filter((p) => ehBlocoDeMetrica(p.id));
/** Todo estrutural está presente? É a garantia de "não pode ser ocultado". */
const temTodosEstruturais = (r) => IDS_ESTRUTURAIS.every((id) => r.blocos.some((p) => p.id === id));

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
  eq("null vira o padrão", migrarLayout(null).blocos.length, p.blocos.length);
  eq("undefined vira o padrão", migrarLayout(undefined).blocos.length, p.blocos.length);
  eq("array vazio vira o padrão", migrarLayout([]).blocos.length, p.blocos.length);
  // Prova que o padrão tem conteúdo — senão as três acima passariam com tudo vazio.
  eq("  …e o padrão tem 4 métricas em destaque", metricas(p).filter((m) => m.h === 2).length, 4);
  eq("  …e painéis de verdade", opcionais(p).length > 0, true);
}

console.log("\n\x1b[1m2. Layout antigo VÁLIDO\x1b[0m");
{
  const antigo = [
    kpi("faturamento", 0, 0), kpi("vendas", 3, 0), kpi("roas", 6, 0), kpi("cpa", 9, 0),
    kpi("ticket", 0, 4), kpi("margem", 3, 4),
    chart("funil", 0, 8, 4), chart("fontes", 4, 8, 4), chart("vendasDia", 0, 16, 12),
  ];
  const r = migrarLayout(antigo);

  /* 🔴 OS 4 PRIMEIROS KPIs CONTINUAM SENDO OS PRIMEIROS BLOCOS DA GRADE, na
     ordem do usuário — é a metade "ninguém muda de lugar" da promessa da F5. */
  eq("os 4 primeiros KPIs abrem a grade, na ordem do usuário",
     metricas(r).slice(0, 4).map((m) => m.id),
     ["faturamento", "vendas", "roas", "cpa"].map(idDaMetrica));
  eq("  …e eles são os que têm altura de DESTAQUE", metricas(r).slice(0, 4).map((m) => m.h), [2, 2, 2, 2]);
  eq("o resto vem depois, na ordem, em altura compacta",
     metricas(r).slice(4).map((m) => [m.id, m.h]),
     [["ticket", 1], ["margem", 1]].map(([c, h]) => [idDaMetrica(c), h]));
  eq("os 3 painéis sobrevivem, na ordem de leitura", opcionais(r), ["funil", "fontes", "vendas-por-dia"]);
  /* ⚠️ A asserção olha só os OPCIONAIS porque os quatro estruturais entram
     sempre, no fim — se ela comparasse a lista inteira, mediria a reposição
     junto com a ordem de leitura e não se saberia qual das duas quebrou. */
  eq("  …e os estruturais foram repostos", temTodosEstruturais(r), true);

  /* 🔴 E AS MÉTRICAS VÊM ANTES DOS PAINÉIS. Sem isto, a conversão poderia
     preservar tudo e ainda assim embaralhar a tela — os quatro números que
     abriam o Dashboard apareceriam no meio dos gráficos. */
  const iUltimaMetrica = r.blocos.findLastIndex((p) => ehBlocoDeMetrica(p.id));
  const iPrimeiroPainel = r.blocos.findIndex((p) => !ehBlocoDeMetrica(p.id));
  eq("as métricas vêm todas ANTES do primeiro painel", iUltimaMetrica < iPrimeiroPainel, true);

  eq("12 colunas do grid antigo chegam como 12", r.blocos.find((p) => p.id === "vendas-por-dia").col, 12);
  eq("4 colunas do grid antigo chegam como 4", r.blocos.find((p) => p.id === "funil").col, 4);

  /* 🔴 NINGUÉM PERDE BLOCO QUE EXISTE. A asserção mede o conjunto, não a
     contagem: contar 3 passaria se um bloco tivesse virado outro. */
  const esperados = ["funil", "fontes", "vendas-por-dia"];
  eq("nenhum bloco que ainda existe se perdeu", esperados.every((id) => r.blocos.some((p) => p.id === id)), true);
}

console.log("\n\x1b[1m3. Bloco que NÃO EXISTE mais\x1b[0m");
{
  /* ⛔ Um bloco INVENTADO (`chart:bloco-que-morreu`) é a entrada certa para esta
     guarda, e é permanente: ele nunca vai voltar ao catálogo, então a asserção
     não pode envelhecer. Usar um id real fazia o teste depender de uma decisão
     de produto que muda. */
  const antigo = [
    kpi("faturamento", 0, 0), kpi("gasto", 3, 0), kpi("roas", 6, 0), kpi("lucroLiquido", 9, 0),
    chart("bloco-que-morreu", 0, 8, 6),
    chart("funil", 6, 8, 6),
  ];
  const r = migrarLayout(antigo);

  eq("o bloco inexistente foi descartado", r.blocos.some((p) => p.id === "bloco-que-morreu"), false);
  eq("e não levou o vizinho junto", opcionais(r), ["funil"]);
  // Prova que havia o que descartar — senão "não contém" passa com lista vazia.
  eq("  …e havia 1 para descartar de 2 (senão isto é vácuo)", antigo.filter((i) => i.i.startsWith("chart:")).length, 2);
  eq("e as métricas ficaram intactas", metricas(r).map((m) => m.id),
     ["faturamento", "gasto", "roas", "lucroLiquido"].map(idDaMetrica));

  /* 🔴 MÉTRICA QUE NÃO EXISTE MAIS segue a MESMA regra do painel: some em
     silêncio. Sem esta guarda, um `kpi:metrica-que-morreu` viraria um id sem
     meta e a tela desenharia uma célula vazia. */
  const rm = migrarLayout([kpi("metrica-que-morreu", 0, 0), kpi("roas", 3, 0), chart("funil", 0, 8, 6)]);
  eq("métrica fora do catálogo é descartada", rm.blocos.some((p) => p.id === "metrica:metrica-que-morreu"), false);
  eq("  …e a métrica válida continua lá", rm.blocos.some((p) => p.id === idDaMetrica("roas")), true);

  /* 🔴 OS TRÊS QUE VOLTARAM, com asserção própria. */
  const rv = migrarLayout([
    kpi("faturamento", 0, 0),
    chart("receita", 0, 8, 12),
    chart("paises", 0, 16, 8),
    chart("posicionamento", 8, 16, 4),
  ]);
  eq("`chart:receita` volta como painel (era descartado)", rv.blocos.some((p) => p.id === "receita-gasto"), true);
  eq("`chart:paises` volta como painel (era descartado)", rv.blocos.some((p) => p.id === "paises"), true);
  eq("`chart:posicionamento` volta como painel (o bloco existe de novo)",
     rv.blocos.some((p) => p.id === "posicionamento"), true);
  /* 🔴 E A LARGURA DELE É A DO USUÁRIO, não a do padrão. */
  eq("  …e o `w: 8` gravado vira 8 colunas", rv.blocos.find((p) => p.id === "paises").col, 8);
  eq("  …e o `w: 12` também", rv.blocos.find((p) => p.id === "receita-gasto").col, 12);
}

console.log("\n\x1b[1m3b. ESTRUTURAL NÃO PODE SUMIR DO LAYOUT\x1b[0m");
{
  /* 🔴 A REPOSIÇÃO É O QUE FAZ "NÃO PODE SER OCULTADO" SER UMA GARANTIA, e não
     uma promessa da interface. A ausência do ✕ cobre o usuário de hoje; ela não
     cobre um layout gravado por uma versão anterior. */
  eq("layout v3 sem nenhum estrutural recebe os quatro de volta",
     temTodosEstruturais(migrarLayout({ v: 3, hero: [], faixa: [], paineis: [{ id: "funil", col: 6 }] })), true);
  eq("  …e o opcional gravado continua lá, na frente",
     opcionais(migrarLayout({ v: 3, hero: [], faixa: [], paineis: [{ id: "funil", col: 6 }] })), ["funil"]);

  /* ⛔ REPOR NÃO PODE MEXER EM QUEM JÁ ESTÁ. */
  const custom = migrarLayout({
    v: 3, hero: [], faixa: [],
    paineis: [{ id: "alertas", col: 8 }, { id: "funil", col: 4 }],
  });
  eq("estrutural JÁ PRESENTE mantém posição", opcionais(custom).length >= 1 && custom.blocos.find((p) => !ehBlocoDeMetrica(p.id)).id, "alertas");
  eq("  …e mantém a largura escolhida", custom.blocos.find((p) => p.id === "alertas").col, 8);

  eq("`reporEstruturais([])` devolve exatamente os estruturais",
     reporEstruturais([]).map((p) => p.id), IDS_ESTRUTURAIS);
  eq("  …e é idempotente", reporEstruturais(reporEstruturais([])).length, IDS_ESTRUTURAIS.length);
  eq("  …e há estruturais para repor", IDS_ESTRUTURAIS.length > 0, true);
}

console.log("\n\x1b[1mAs guardas que a leitura do código exigiu\x1b[0m");
{
  /* HERO COM MENOS DE 4 — o envelope antigo desenhava quatro, completando com o
     padrão. A migração precisa reproduzir o que ele DESENHAVA. */
  const r = migrarLayout([kpi("vendas", 0, 0), kpi("roas", 3, 0)]);
  eq("hero incompleto é completado até 4", metricas(r).filter((m) => m.h === 2).length, 4);
  eq("  …mantendo a escolha do usuário na frente",
     metricas(r).slice(0, 2).map((m) => m.id), ["vendas", "roas"].map(idDaMetrica));
  eq("  …e sem repetir o que ele já tinha", new Set(metricas(r).map((m) => m.id)).size, metricas(r).length);

  /* FAIXA ACIMA DO TETO — o v1/v3 cortava em 8, e é o que a pessoa via. */
  const muitos = ["faturamento", "gasto", "roas", "lucroLiquido", "ticket", "ctr", "cpa", "arpu", "margem", "vendas", "roi", "liquido", "chargeback"];
  const r2 = migrarLayout(muitos.map((m, i) => kpi(m, (i % 4) * 3, Math.floor(i / 4) * 4)));
  eq(`a faixa antiga não passava de ${MAX_FAIXA}`, metricas(r2).filter((m) => m.h === 1).length <= MAX_FAIXA, true);
  eq("  …e havia mais que isso para cortar", muitos.length - 4 > MAX_FAIXA, true);

  /* LAYOUT CORROMPIDO — nunca lança, sempre devolve algo desenhável. */
  eq("objeto no lugar de array -> padrão", migrarLayout({ i: "kpi:roas" }).blocos.length, layoutPadrao().blocos.length);
  eq("array de lixo -> padrão", migrarLayout([1, "x", null]).blocos.length, layoutPadrao().blocos.length);
  eq("item sem `i` é ignorado", migrarLayout([{ x: 0, y: 0, w: 3, h: 4 }]).blocos.length, layoutPadrao().blocos.length);

  /* SÓ BLOCOS MORTOS — a grade não pode ficar só com métrica: ela pareceria uma
     tela pela metade, e o usuário não teria como saber que foi o layout dele. */
  /* ⛔ CAI NO PADRÃO DE PAINÉIS, E SÓ NELE. As métricas do usuário são dele, e
     antes da F5 isso era automático — `hero` era um campo separado que
     sobrevivia. Numa lista só, trocar a lista inteira apagaria a escolha dele
     junto com os painéis mortos. */
  const r3 = migrarLayout([kpi("roas", 0, 0), chart("bloco-que-morreu", 0, 8, 6)]);
  eq("layout só com painéis mortos cai no padrão DE PAINÉIS",
     r3.blocos.filter((p) => !ehBlocoDeMetrica(p.id)).length,
     layoutPadrao().blocos.filter((p) => !ehBlocoDeMetrica(p.id)).length);
  eq("  …e a métrica do usuário NÃO foi levada junto",
     metricas(r3).map((m) => m.id).includes(idDaMetrica("roas")), true);

  /* DUPLICATA no salvo — o grid antigo permitia. */
  const r4 = migrarLayout([chart("funil", 0, 8, 4), chart("funil", 4, 8, 4)]);
  eq("bloco duplicado entra uma vez só", r4.blocos.filter((p) => p.id === "funil").length, 1);
}

console.log("");
console.log("\x1b[1m5. A CONVERSÃO DAS ZONAS — 'ninguém muda de lugar'\x1b[0m");
{
  /* 🔴 A PROMESSA DA F5, MEDIDA. As fileiras de métrica têm de FECHAR 12: uma
     fileira que não fecha deixa sobra, e na sobra um painel estreito SOBE —
     encostando num grupo do qual ele nunca fez parte. É a única forma pela qual
     a conversão poderia mover um card sem que ninguém notasse. */
  const fecha = (n) => {
    const linhas = linhasDaGrade(fileirasDeMetricas(METRICAS.slice(0, n).map((m) => m.chave), 1).map((b) => b.col));
    return linhas.every((l) => l.livres === 0);
  };
  eq("toda faixa de 1 a 15 métricas fecha TODAS as fileiras em 12",
     Array.from({ length: 15 }, (_, i) => i + 1).filter((n) => !fecha(n)), []);

  /* A EXCEÇÃO DECLARADA, e ela é a única. */
  const oito = fileirasDeMetricas(METRICAS.slice(0, 8).map((m) => m.chave), 1);
  eq("a faixa de 8 vira DUAS fileiras de quatro (a exceção declarada)",
     linhasDaGrade(oito.map((b) => b.col)).map((l) => l.indices.length), [4, 4]);
  eq("  …e cada uma delas tem a largura padrão de métrica", [...new Set(oito.map((b) => b.col))], [3]);

  /* ⚠️ O hero fecha UMA fileira exata, e é isso que faz o Resumo começar numa
     fileira nova. Sem esta linha, a asserção de agrupamento acima passaria por
     coincidência. */
  const quatro = fileirasDeMetricas(["faturamento", "gasto", "roas", "lucroLiquido"], 2);
  eq("o hero de 4 fica em UMA fileira", linhasDaGrade(quatro.map((b) => b.col)).length, 1);
  eq("  …com 3 colunas cada", quatro.map((b) => b.col), [3, 3, 3, 3]);
  eq("  …e altura de destaque", quatro.map((b) => b.h), [2, 2, 2, 2]);

  /* Uma métrica sozinha ocupava a faixa inteira, e continua ocupando: a faixa
     de Resumo era largura cheia com um item. */
  eq("uma métrica sozinha fica com a fileira inteira", fileirasDeMetricas(["roas"], 1)[0].col, COLUNAS_GRADE);
  eq("nenhuma métrica ultrapassa a grade",
     fileirasDeMetricas(METRICAS.map((m) => m.chave), 1).filter((b) => b.col > COLUNAS_GRADE), []);
  eq("no máximo 4 por fileira", METRICAS_POR_FILEIRA, 4);

  /* ⛔ A ALTURA VEM DA ZONA, NÃO DO CATÁLOGO. Uma métrica de destaque que o
     usuário arrastou para o Resumo volta compacta — onde ela estava. Sem isto, a
     migração "corrigiria" a escolha dele para o padrão. */
  eq("métrica de destaque que estava no Resumo volta COMPACTA",
     fileirasDeMetricas(["faturamento"], 1)[0].h, 1);
  eq("  …e uma comum promovida ao hero volta em DESTAQUE",
     fileirasDeMetricas(["ctr"], 2)[0].h, 2);

  /* Chave que não é métrica some, como painel fora do catálogo. */
  eq("chave desconhecida não vira bloco", fileirasDeMetricas(["nao-existe", "roas"], 1).map((b) => b.id), [idDaMetrica("roas")]);
}

console.log("");
console.log("\x1b[1mEmpacotamento da linha e o aviso de sobra\x1b[0m");
{
  eq("linha que fecha em 12 nao tem sobra", linhasDaGrade([6, 6]).map((l) => l.livres).join(","), "0");
  eq("6+4 deixa 2 livres", linhasDaGrade([6, 4])[0].livres, 2);
  eq("  ...e o aviso diz quantas", avisoDeSobra(linhasDaGrade([6, 4])[0].livres), "2 colunas livres");
  eq("uma sozinha fica no singular", avisoDeSobra(1), "1 coluna livre");
  eq("linha fechada NAO tem aviso", avisoDeSobra(0), null);

  const tres = linhasDaGrade([6, 4, 4]);
  eq("o que nao cabe desce", tres.length, 2);
  eq("  ...e a linha 1 fica com dois", tres[0].indices.join(","), "0,1");
  eq("  ...e a 2 comeca com o terceiro", tres[1].indices.join(","), "2");
  eq("  ...com 8 livres nela", tres[1].livres, 8);

  /* ⚠️ Largura invalida vira grade CHEIA, nunca descartada. */
  eq("largura zero nao some do agrupamento", linhasDaGrade([0, 6]).length, 2);
  eq("  ...e ocupa a linha inteira", linhasDaGrade([0, 6])[0].livres, 0);

  eq("lista vazia nao produz linha", linhasDaGrade([]).length, 0);
}

console.log("\x1b[1mA grade de 12: encaixe, piso e o grid antigo\x1b[0m");
{
  const funil = metaDoBloco("funil");            // colMin 4
  const porDia = metaDoBloco("vendas-por-dia");  // colMin 4
  const semAlca = metaDoBloco("fontes");
  eq("o bloco de referência existe no catálogo", !!semAlca, true);

  /* 🔴 TODAS AS COLUNAS INTEIRAS EXISTEM. */
  eq("5 existe, e nao vira 4", encaixarColunas(5, funil), 5);
  eq("7 existe", encaixarColunas(7, funil), 7);
  eq("9, 10 e 11 existem", [9, 10, 11].map((c) => encaixarColunas(c, funil)).join(","), "9,10,11");
  eq("o bloco oferece do minimo ate 12, sem buraco",
     passosDoBloco(funil).join(","), "4,5,6,7,8,9,10,11,12");
  eq("fracao arredonda para a coluna mais proxima", encaixarColunas(6.6, funil), 7);
  /* ⛔ CONGELA A RELACAO, NAO O NUMERO. */
  eq("nunca abaixo do minimo do bloco",
     encaixarColunas(porDia.colMin - 2, porDia), porDia.colMin);
  eq("  ...nem com valor absurdo", encaixarColunas(-99, porDia), porDia.colMin);
  eq("teto na largura da grade", encaixarColunas(999, funil), 12);

  /* 🔴 A GUARDA DO CONTROLE INERTE. */
  eq("seta para a direita anda UMA coluna", proximoPasso(funil, 4, +1), 5);
  eq("  ...e a da esquerda volta uma", proximoPasso(funil, 6, -1), 5);
  eq("no maior passo, a direita não passa do teto", proximoPasso(funil, 12, +1), 12);
  eq("no minimo do bloco, a esquerda nao desce",
     proximoPasso(porDia, porDia.colMin, -1), porDia.colMin);

  eq("grid antigo w=4 -> 4 colunas", colunasDoGridAntigo(4, funil), 4);
  eq("grid antigo w=12 -> 12 colunas", colunasDoGridAntigo(12, funil), 12);
  eq("grid antigo abaixo do minimo SOBE para ele",
     colunasDoGridAntigo(porDia.colMin - 1, porDia), porDia.colMin);

  /* ⚠️ `linhasDoGridAntigo` para em `linhas` de 44px DE PROPOSITO — e a mesma
     unidade do v3, para o grid antigo e o v3 entrarem no MESMO ponto de
     conversao (`alturaMigrada`). A conversao 44 -> 96 tem arquivo proprio:
     `npm run test:grade`. */
  eq("h=8 do grid antigo -> 6 linhas de 44px", linhasDoGridAntigo(8), 6);
  eq("  ...e nunca abaixo de 1", linhasDoGridAntigo(0), 1);
  eq("o padrao do produto ja nasce MIGRADO (altura em celulas)",
     layoutPadrao().blocos.find((p) => p.id === semAlca.id).h, semAlca.hPadrao);
  eq("  ...e nenhum bloco do padrao fica sem h",
     layoutPadrao().blocos.every((p) => typeof p.h === "number"), true);
  eq("  ...e havia blocos para examinar (senao o every e vacuo)",
     layoutPadrao().blocos.length > 0, true);

  /* 🔑 O MÍNIMO DE UMA MÉTRICA É 2, e ele é o único mínimo de LARGURA que a F5
     acrescentou. A §3 do `07` sugeria 1 — recusado, e o motivo está no catálogo:
     uma coluna dá ~42px úteis, e ali não cabe rótulo nem número. */
  eq("toda métrica declara colMin 2",
     [...new Set(CATALOGO_META.filter((b) => ehBlocoDeMetrica(b.id)).map((b) => b.colMin))], [2]);
  eq("  …e hMin 1 — a leitura compacta CABE numa célula",
     [...new Set(CATALOGO_META.filter((b) => ehBlocoDeMetrica(b.id)).map((b) => b.hMin))], [1]);
}


// ── O LAYOUT REAL DO PRODUTO ────────────────────────────────────────────────
//
// 🔴 A fixture NÃO é um exemplo inventado: o comentário dele diz "transcrito do
// arranjo do usuário (30/07/2026)". É o layout que toda conta viu por semanas.
console.log("\n\x1b[1mO layout REAL do produto (defaultLayout de blocks.ts)\x1b[0m");
{
  for (const vp of ["desktop", "mobile"]) {
    const antigo = defaultLayout(vp);
    const r = migrarLayout(antigo);

    eq(`${vp}: quatro métricas em destaque`, metricas(r).filter((m) => m.h === 2).length, 4);
    eq(`${vp}: o resto dentro do teto antigo`, metricas(r).filter((m) => m.h === 1).length <= MAX_FAIXA, true);

    /* 🔴 A ASSERÇÃO QUE IMPORTA: nenhum bloco MIGRÁVEL se perdeu. */
    const migraveis = antigo.filter((i) => i.i.startsWith("chart:") && DESTINOS[i.i]).map((i) => DESTINOS[i.i]);
    const sobreviventes = new Set(r.blocos.map((p) => p.id));
    eq(`${vp}: todos os ${migraveis.length} painéis migráveis sobreviveram`, migraveis.every((id) => sobreviventes.has(id)), true);
    eq(`${vp}:   …e havia migráveis (senão o every é vácuo)`, migraveis.length > 0, true);

    /* 🔴 NADA A MAIS E NADA A MENOS, entre os PAINÉIS. */
    const esperado = new Set([...migraveis, ...IDS_ESTRUTURAIS]);
    eq(`${vp}: nem sobrou nem faltou painel`, r.blocos.filter((p) => !ehBlocoDeMetrica(p.id)).length, esperado.size);
    eq(`${vp}:   …e os estruturais que o layout real não tinha entraram`,
       IDS_ESTRUTURAIS.filter((id) => !migraveis.includes(id)).length > 0, true);

    /* 🔑 E A FILEIRA DE MÉTRICAS FECHA, no layout mais próximo de produção que
       este arquivo tem. É a promessa da F5 medida contra dado real. */
    const larguras = metricas(r).map((m) => m.col);
    eq(`${vp}: as fileiras de métrica fecham 12`, linhasDaGrade(larguras).filter((l) => l.livres !== 0), []);
  }
}


// ── OS ENVELOPES ANTIGOS ───────────────────────────────────────────────────
//
// 🔴 UM LAYOUT VERSIONADO PASSA PELAS MESMAS REGRAS DE UM ANTIGO. Confiar na
// marca para pular a validação é confiar que o passado obedeceu regras que só
// existem no presente.
console.log("\n\x1b[1mO envelope v2\x1b[0m");
{
  const v2 = (o) => migrarLayout({ v: 2, hero: [], faixa: [], paineis: [], ...o });

  eq("v2 é reconhecido e NÃO passa pela migração de grid",
     metricas(v2({ hero: ["vendas", "cpa", "roas", "margem"], faixa: ["ctr"], paineis: [{ id: "funil", largura: "metade" }] })).slice(0, 4).map((m) => m.id),
     ["vendas", "cpa", "roas", "margem"].map(idDaMetrica));

  eq("v2 com hero de 2 é completado até 4", metricas(v2({ hero: ["vendas", "cpa"] })).filter((m) => m.h === 2).length, 4);

  const r = v2({ paineis: [{ id: "funil", largura: "metade" }, { id: "bloco-que-morreu", largura: "cheia" }] });
  eq("v2 descarta bloco fora do catálogo", opcionais(r), ["funil"]);

  eq("v2 'cheia' vira 12 colunas",
     v2({ paineis: [{ id: "funil", largura: "cheia" }] }).blocos.find((p) => p.id === "funil").col, 12);
  eq("v2 'metade' vira 6 colunas",
     v2({ paineis: [{ id: "funil", largura: "metade" }] }).blocos.find((p) => p.id === "funil").col, 6);
  eq("v2 'um-terco' nunca entra abaixo do minimo do bloco",
     v2({ paineis: [{ id: "vendas-por-dia", largura: "um-terco" }] }).blocos.find((p) => p.id === "vendas-por-dia").col,
     Math.max(4, metaDoBloco("vendas-por-dia").colMin));
  /* ⚠️ `undefined` aqui significa "AINDA NAO MIGRADO", nao "sem altura". */
  eq("v2 nao trazia altura -- o painel entra NAO MIGRADO",
     v2({ paineis: [{ id: "fontes", largura: "metade" }] }).blocos.find((p) => p.id === "fontes").h, undefined);
  /* ⛔ …e a MÉTRICA entra COM altura, sempre. Ela nasce da conversão de zonas,
     que dá 2 ou 1 — nunca `undefined`. Sem esta linha, uma métrica sem `h`
     travaria a migração de altura para sempre (`completo` nunca vira true). */
  eq("  …mas TODA métrica entra com altura",
     metricas(v2({ hero: ["roas"], faixa: ["ctr"] })).every((m) => typeof m.h === "number"), true);

  eq("v2 respeita o teto da faixa antiga",
     metricas(v2({ hero: ["faturamento","gasto","roas","cpa"], faixa: ["ticket","ctr","arpu","margem","vendas","roi","liquido","chargeback","reembolsadas","pendentes"] })).filter((m) => m.h === 1).length, MAX_FAIXA);
  eq("v2 não deixa a mesma métrica no hero E na faixa",
     metricas(v2({ hero: ["vendas","cpa","roas","margem"], faixa: ["vendas","ctr"] })).filter((m) => m.h === 1).map((m) => m.id),
     [idDaMetrica("ctr")]);

  /* 🔴 LISTA VAZIA VÁLIDA != CAMPO CORROMPIDO. */
  eq("v2 com `paineis` NÃO-array cai no padrão (corrupção)",
     migrarLayout({ v: 2, hero: "x", faixa: null, paineis: "y" }).blocos.length, layoutPadrao().blocos.length);
  eq("v2 com `paineis: []` RESPEITA a escolha (o usuário removeu todos os opcionais)",
     opcionais(v2({ paineis: [] })), []);
  eq("  …e os estruturais continuam lá", temTodosEstruturais(v2({ paineis: [] })), true);

  /* O CONTROLE: sem a marca, é grid antigo. */
  eq("objeto SEM `v` não é tratado como envelope (vai para o padrão)",
     migrarLayout({ hero: ["vendas"] }).blocos.length, layoutPadrao().blocos.length);
}

console.log("\n\x1b[1mO envelope v5 — a grade única\x1b[0m");
{
  const v5 = (o) => migrarLayout({ v: 5, blocos: [], ...o });

  eq("v5 é lido como grade, sem passar pela conversão de zonas",
     v5({ blocos: [{ id: "funil", col: 6, h: 5 }] }).blocos.find((p) => p.id === "funil").h, 5);
  eq("  …e métrica no `blocos` é um bloco como outro qualquer",
     v5({ blocos: [{ id: idDaMetrica("roas"), col: 3, h: 2 }] }).blocos.find((p) => p.id === idDaMetrica("roas")).h, 2);

  /* 🔴 A REDE DA F5. `{hero, faixa} → blocos` é irreversível: da lista única não
     se recupera qual métrica era hero. Sem os dois campos atravessando a
     leitura E a gravação, uma conversão errada não teria de onde ser desfeita. */
  const comRede = v5({ blocos: [{ id: "funil", col: 6, h: 5 }], hero: ["roas", "cpa"], faixa: ["ctr"] });
  eq("REDE — o `hero` de origem atravessa a leitura", comRede.heroLegado, ["roas", "cpa"]);
  eq("REDE — e o `faixa` também", comRede.faixaLegado, ["ctr"]);
  /* ⛔ E ele NÃO volta a ser zona: a grade desenhada é só o `blocos`. Sem esta
     metade, preservar o campo poderia virar aplicá-lo — e as métricas
     apareceriam duas vezes na tela. */
  eq("  …e NÃO reinjeta métrica na grade", metricas(comRede).length, 0);

  /* A conversão de zonas PRODUZ a rede — é a outra ponta do mesmo par. */
  const doV4 = migrarLayout({ v: 4, hero: ["roas", "cpa", "ctr", "arpu"], faixa: ["ticket"], paineis: [{ id: "funil", col: 6, h: 5 }] });
  eq("REDE — converter as zonas GRAVA de onde elas vieram", doV4.heroLegado, ["roas", "cpa", "ctr", "arpu"]);
  eq("  …e o `faixa` junto", doV4.faixaLegado, ["ticket"]);
  eq("  …e a conversão de fato aconteceu (linha de base)", metricas(doV4).length, 5);

  eq("v5 descarta bloco fora do catálogo", v5({ blocos: [{ id: "bloco-que-morreu", col: 6, h: 3 }, { id: "funil", col: 6, h: 5 }] }).blocos.some((p) => p.id === "bloco-que-morreu"), false);
  eq("v5 com `blocos` NÃO-array cai no padrão", migrarLayout({ v: 5, blocos: "x" }).blocos.length, layoutPadrao().blocos.length);
  eq("v5 com `blocos: []` respeita a escolha (só os estruturais voltam)", opcionais(v5({ blocos: [] })), []);
  eq("  …e os estruturais continuam lá", temTodosEstruturais(v5({ blocos: [] })), true);
  eq("v5 duplicado entra uma vez só", v5({ blocos: [{ id: "funil", col: 6, h: 5 }, { id: "funil", col: 4, h: 5 }] }).blocos.filter((p) => p.id === "funil").length, 1);
  eq("v5 abaixo do mínimo do bloco SOBE", v5({ blocos: [{ id: "heatmap", col: 2, h: 5 }] }).blocos.find((p) => p.id === "heatmap").col, metaDoBloco("heatmap").colMin);
  eq("v5 preserva o `linhas` legado da F1", v5({ blocos: [{ id: "funil", col: 6, h: 5, linhas: 5 }] }).blocos.find((p) => p.id === "funil").linhasLegado, 5);
}

/* ══════════════════════════════════════════════════════════════════════════
   🔀 AS TRÊS ENTRADAS DO v4→v5, LADO A LADO — e o que se mede é a DIVERGÊNCIA

   🔴 POR QUE ELAS SÃO TESTADAS JUNTAS, e não uma por bloco

   Em 13/08/2026 uma medição destas mesmas entradas devolveu **saída IDÊNTICA
   para todas** — 27 blocos, mesmos ids. A leitura natural foi "a migração sanea
   bem". Era o instrumento: os envelopes tinham `versao: 4` e o campo é `v`,
   então `versaoDe` devolvia `null` e TUDO caía no padrão.

   ## ⛔ Entradas distintas convergindo é sinal de INSTRUMENTO, nunca de robustez.

   Robustez real produz saídas DIFERENTES: ela preserva o que dá para preservar
   em cada caso. Por isso a asserção central aqui não é sobre nenhum número
   isolado — é sobre os quatro serem **distintos entre si**. Uma regressão que
   reintroduza "tudo vira padrão" faz esta asserção cair mesmo que ninguém tenha
   previsto os valores novos.
   ══════════════════════════════════════════════════════════════════════════ */
{
  const PADRAO = layoutPadrao().blocos.length;

  /* 1 · v4 REAL — o arranjo de quem usou o produto: 4 hero, 2 na faixa, 5 painéis. */
  const v4Real = migrarLayout({
    v: 4,
    hero: ["roas", "cpa", "ctr", "arpu"],
    faixa: ["ticket", "margem"],
    paineis: [
      { id: "funil", col: 6, h: 5 },
      { id: "receita-gasto", col: 6, h: 4 },
      { id: "paises", col: 12, h: 6 },
      { id: "alertas", col: 4, h: 3 },
      { id: "rodape", col: 12, h: 2 },
    ],
  });

  /* 2 · v3 de conta que NUNCA ABRIU o Dashboard — envelope gravado, nada escolhido. */
  const v3Virgem = migrarLayout({ v: 3, hero: [], faixa: [], paineis: [] });

  /* 3a · CORROMPIDO sem nada aproveitável. */
  const lixoTotal = migrarLayout({ v: 5, blocos: "x" });

  /* 3b · CORROMPIDO PARCIAL — e é o caso que separa sanear de descartar. */
  const lixoParcial = migrarLayout({
    v: 4,
    hero: null,
    faixa: "z",
    paineis: [{ id: "funil", col: 6 }, 1, null, { semId: true }],
  });

  /* ── A asserção central: as quatro divergem ─────────────────────────────── */
  const tamanhos = [v4Real, v3Virgem, lixoTotal, lixoParcial].map((r) => r.blocos.length);
  eq("linha de base: as quatro entradas migraram", tamanhos.every((n) => n > 0), true);
  eq(
    "entradas DIFERENTES produzem saídas DIFERENTES (não convergem no padrão)",
    new Set(tamanhos).size,
    4,
  );

  /* ── E cada uma preserva o que lhe cabe ─────────────────────────────────── */
  const ids = (r) => r.blocos.map((b) => b.id);

  /* v4 real: o arranjo do usuário sobrevive inteiro, e NÃO vira o padrão. */
  eq("v4 real NÃO cai no padrão", v4Real.blocos.length === PADRAO, false);
  eq("v4 real mantém os 5 painéis escolhidos",
     ["funil", "receita-gasto", "paises", "alertas", "rodape"].every((id) => ids(v4Real).includes(id)), true);
  eq("v4 real mantém a ORDEM dos KPIs do hero",
     ids(v4Real).slice(0, 4), ["roas", "cpa", "ctr", "arpu"].map(idDaMetrica));
  eq("v4 real: todo bloco sai com altura em CÉLULAS", v4Real.blocos.every((b) => typeof b.h === "number"), true);

  /* v3 virgem: respeita o vazio E repõe os estruturais — nem padrão, nem tela oca. */
  eq("v3 virgem NÃO vira o padrão inteiro", v3Virgem.blocos.length === PADRAO, false);
  eq("v3 virgem repõe TODOS os estruturais", temTodosEstruturais(v3Virgem), true);
  eq("v3 virgem repõe o hero padrão", ids(v3Virgem).slice(0, 4).every((id) => ehBlocoDeMetrica(id)), true);
  eq("v3 virgem NÃO inventa painel opcional", opcionais(v3Virgem).length, 0);

  /* Corrompido total: nada a salvar, o padrão é a resposta certa. */
  eq("corrompido sem nada aproveitável cai no padrão", lixoTotal.blocos.length, PADRAO);

  /* 🔴 Corrompido PARCIAL: preserva o que dá. É aqui que "sanear" se distingue
     de "descartar", e era exatamente isto que a medição errada escondia. */
  eq("corrompido parcial PRESERVA o painel válido", ids(lixoParcial).includes("funil"), true);
  eq("corrompido parcial NÃO cai no padrão", lixoParcial.blocos.length === PADRAO, false);
  eq("corrompido parcial descarta os itens inválidos",
     lixoParcial.blocos.every((b) => typeof b.id === "string" && b.id.length > 0), true);
  eq("corrompido parcial repõe os estruturais", temTodosEstruturais(lixoParcial), true);
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
