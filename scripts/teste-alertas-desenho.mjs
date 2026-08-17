/**
 * OS OITO ALERTAS, DESENHADOS — a outra metade de `test:alertas`.
 *
 * ## 🔴 A DÍVIDA QUE ESTE ARQUIVO FECHA
 *
 * `test:alertas` cobre o CONSTRUTOR, com o par dispara / não-dispara para cada
 * alerta. E o `07` registrava, ao encerrar 15/08/2026:
 *
 * | metade | 15/08 | hoje |
 * |---|---|---|
 * | o alerta é CONSTRUÍDO quando deve | ✅ 7 de 7 | ✅ 8 de 8 |
 * | o alerta é DESENHADO na tela | ⛔ **0 de 7** | ✅ **8 de 8** |
 *
 * ⚠️ O oitavo (`padrao-teste-`, §7b) nasceu em 17/08 e é o único com AÇÃO: ele
 * anuncia um bloqueio irreversível e carrega o botão que o desfaz, porque a
 * tela que fazia isso foi deletada e o remédio tinha ficado inalcançável.
 *
 * `AlertList.tsx` era apenas LIDO por `teste-grade.mjs` (análise estática da
 * grade) — nenhum teste o renderizava. É a família *"passa no build com a coisa
 * desligada"*: o construtor devolve o alerta certo, e nada afirma que ele chega
 * ao markup.
 *
 * ⚠️ **Isto não é a dívida de janela.** Os quatro itens de tela do `07` (bandas
 * de 8/4/1, origens A e B, `h` do vazio) precisam de um navegador visível, e o
 * instrumento está indisponível nesta máquina. Este precisa de um RENDER — e
 * `AlertList` **não porta para o `<body>`** (sem `createPortal`, sem
 * `useOverlay`), então `renderToStaticMarkup` o alcança.
 *
 * ## ⛔ A NEGAÇÃO AQUI É SEGURA, E VALE ESCREVER POR QUÊ
 *
 * Esta base tem a regra: *negação sobre string vazia sempre passa* — um
 * componente que porta devolve `""`, e `!html.includes("X")` vira um atestado
 * de que algo não está lá quando NADA está.
 *
 * A metade "não desenha" deste arquivo escapa disso por ESTRUTURA, não por
 * sorte: com zero alertas o `AlertList` renderiza o **estado vazio** ("Nada
 * exigindo ação"), que é markup de verdade. Toda negação daqui carrega, junto,
 * a afirmação de que o estado vazio foi desenhado — se o componente algum dia
 * passar a devolver `null` ou a portar, as asserções caem em vez de passarem.
 *
 * ## 🔎 O QUE A SONDA MEDIU ANTES DA PRIMEIRA ASSERÇÃO
 *
 *   1 alerta,  limite padrão .... desenhados [1]              rodapé —
 *   6 alertas, limite padrão .... desenhados [1]              rodapé "+ 5 alertas"
 *   6 alertas, limite 6 ......... desenhados [1,2,3,4,5,6]    rodapé —
 *   0 alertas ................... estado vazio, 585 chars
 *
 * ⛔ **Por isso cada alerta é renderizado SOZINHO.** Renderizar os oito juntos e
 * procurar os oito títulos mediria o TRUNCAMENTO, não o desenho — e daria 1 de
 * 8 com o componente perfeitamente correto. É *a medição não acertou o alvo*
 * esperando para acontecer, e a §9 a converteu em asserção explícita em vez de
 * deixá-la como armadilha.
 *
 * ✅ **E a linha do meio virou defeito CONSERTADO em 17/08/2026.** Ela media o
 * `comRodape`, que calculava sem guarda de estado não medido e prendia o
 * visível em **1**. Hoje a mesma sonda devolve `desenhados [1,2,3]` com rodapé
 * `+ 3 alertas` — o `limite` declarado. As três linhas acima ficam como estavam
 * porque são o retrato do que a sonda achou; quem diz o que vale hoje é a §9.
 *
 *   npm run test:alertas-desenho
 */

import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { montarAlertas } from "@/lib/dashboard/alertas";

const { AlertList } = await import("../src/components/tk/AlertList.tsx");

let n = 0;
const falhas = [];
const ok = (nome, cond, extra) => {
  try {
    assert.ok(cond, nome + (extra ? " — " + extra : ""));
    console.log("  \x1b[32m✓\x1b[0m " + nome + (extra ? " — " + extra : ""));
    n++;
  } catch (e) {
    falhas.push(nome);
    console.log("  \x1b[31m✗\x1b[0m " + nome + "\n      " + e.message);
  }
};
const secao = (t) => console.log("\n\x1b[1m" + t + "\x1b[0m");

const brl = (x) => "R$ " + x.toFixed(2).replace(".", ",");
const AGORA = Date.UTC(2026, 7, 14, 12, 0, 0);
const VENCIDO = new Date(AGORA - 86_400_000).toISOString();

/** A MESMA entrada saudável de `test:alertas` — o par vive nela. */
const limpa = (o = {}) => ({
  fbConnected: true,
  perfisCrus: [],
  adProfiles: [],
  roi: { value: "1,20x", delta: 5 },
  chartSerie: { spend: [10, 20], revenue: [50, 60] },
  agora: AGORA,
  brl,
  ...o,
});

/**
 * ⛔ `limite` alto de propósito: o padrão é 3, e a §9 mede o que ele faz.
 * Aqui a pergunta é "o alerta CHEGA ao markup", não "quantos cabem".
 */
const desenhar = (alertas, limite = 20) =>
  renderToStaticMarkup(React.createElement(AlertList, { alertas, limite }));

/** O markup com o texto legível: sem tags, sem escapes de entidade. */
const texto = (html) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");

const VAZIO_MARCA = "Nada exigindo ação";

/**
 * O PAR, numa função — e ela é o coração deste arquivo.
 *
 * `entradaQueDispara` e `entradaQueNao` são as MESMAS de `test:alertas`. A
 * diferença é o que se afirma: lá, o id sai do construtor; aqui, o TÍTULO
 * chega ao markup.
 *
 * ⛔ As três linhas de base não são cerimônia:
 *   1. o construtor produziu exatamente o alerta esperado (senão eu mediria
 *      outro alerta, ou nenhum);
 *   2. o markup do lado que dispara é não-vazio (senão `includes` de qualquer
 *      coisa falharia por motivo errado);
 *   3. o markup do lado que NÃO dispara é o ESTADO VAZIO desenhado — é isto
 *      que impede a negação de passar sobre string vazia.
 */
function par(rotulo, entradaQueDispara, entradaQueNao, idEsperado) {
  const lista = montarAlertas(entradaQueDispara);
  ok(
    `${rotulo} · linha de base: o construtor produziu SÓ \`${idEsperado}\``,
    lista.length === 1 && lista[0].id === idEsperado,
    lista.map((a) => a.id).join(" · ") || "(nenhum)",
  );
  const alerta = lista[0];
  const html = desenhar(lista);
  const t = texto(html);

  ok(`${rotulo} · o TÍTULO é desenhado`, t.includes(alerta.titulo), alerta.titulo);
  if (alerta.detalhe) {
    ok(`${rotulo} · …e o DETALHE junto`, t.includes(alerta.detalhe), alerta.detalhe.slice(0, 60));
  }

  /* ⛔ A severidade também vira TEXTO (WCAG 1.4.1): cor e glifo sozinhos não
     comunicam gravidade a quem usa leitor de tela. */
  const rotuloSev = { danger: "Crítico", warning: "Atenção", info: "Informação" }[alerta.severidade];
  ok(
    `${rotulo} · a severidade \`${alerta.severidade}\` vira TEXTO (\`${rotuloSev}\`), não só cor`,
    t.includes(rotuloSev + ":"),
    "WCAG 1.4.1",
  );
  ok(
    `${rotulo} · …e o tinte bate com a severidade`,
    html.includes(`bg-tint-${alerta.severidade}`),
    `bg-tint-${alerta.severidade}`,
  );

  /* O par de dentro do componente: com `href` vira `<a>` navegável; sem, `<div>`
     inerte. Trocar um pelo outro é affordance mentindo — a regra que matou a
     interação do globo. */
  if (alerta.href) {
    ok(
      `${rotulo} · leva LINK para onde resolver (\`${alerta.href}\`)`,
      new RegExp(`<a [^>]*href="${alerta.href.replace(/\//g, "\\/")}"`).test(html),
      "sem href seria um alerta sem saída",
    );
  } else {
    ok(
      `${rotulo} · ⛔ sem \`href\`, NÃO desenha âncora — não há para onde ir`,
      !/<a /.test(html),
      "affordance mentindo",
    );
  }

  /* ── A outra metade: a MESMA tela, com a condição desfeita ─────────────── */
  const nenhum = montarAlertas(entradaQueNao);
  ok(
    `${rotulo} · linha de base do NÃO: o construtor não produz \`${idEsperado}\``,
    !nenhum.some((a) => a.id === idEsperado),
    nenhum.map((a) => a.id).join(" · ") || "(nenhum)",
  );
  const htmlNao = desenhar(nenhum);
  const tNao = texto(htmlNao);
  ok(
    `${rotulo} · ⛔ e a NEGAÇÃO é medível: o estado VAZIO foi desenhado`,
    tNao.includes(VAZIO_MARCA) && htmlNao.length > 200,
    `${htmlNao.length} chars — sem isto, \`!includes\` passaria sobre string vazia`,
  );
  ok(`${rotulo} · …e o título SOME do markup`, !tNao.includes(alerta.titulo), alerta.titulo);
}

console.log("\n\x1b[1mOs oito alertas, DESENHADOS\x1b[0m");

/* ═══ 0 · A LINHA DE BASE DO ARQUIVO INTEIRO ════════════════════════════════

   Se `AlertList` passasse a portar para o `<body>` — via `createPortal` ou
   `useOverlay`, como `Gaveta`, `Drawer`, `Modal` e a paleta ⌘K —, TODO este
   arquivo viraria negação sobre string vazia e ficaria verde medindo nada.
   A asserção abaixo é o que faz esse dia produzir uma FALHA NOMEADA.          */
secao("0 · O instrumento — `renderToStaticMarkup` alcança o `AlertList`?");
{
  const { readFileSync } = await import("node:fs");
  const FONTE = readFileSync("src/components/tk/AlertList.tsx", "utf8").replace(/\r\n/g, "\n");
  ok(
    "0 · linha de base: o arquivo foi lido",
    FONTE.length > 2000 && FONTE.includes("export function AlertList"),
    FONTE.length + " chars",
  );
  ok(
    "0 · ⛔ o `AlertList` NÃO porta para o `<body>` — é o que torna este arquivo possível",
    !/createPortal|useOverlay/.test(FONTE),
    "se um dia portar, tudo aqui vira negação sobre string vazia",
  );

  const cheio = desenhar([{ id: "x", severidade: "info", titulo: "Sonda", detalhe: "d" }]);
  ok("0 · …e um alerta produz markup de verdade", cheio.length > 400 && texto(cheio).includes("Sonda"), cheio.length + " chars");

  const vazio = desenhar([]);
  ok(
    "0 · o estado VAZIO diz que é boa notícia, não falha de carregamento",
    texto(vazio).includes(VAZIO_MARCA),
    VAZIO_MARCA,
  );
  ok(
    "0 · …e explica o que foi conferido",
    /ROI abaixo da meta|gasto sem convers/i.test(texto(vazio)),
    "um \"nenhum resultado\" cinza aqui lê como erro",
  );
}

/* ═══ 1 · `sem-conta` ═════════════════════════════════════════════════════ */
secao("1 · `sem-conta` — sem ela não há gasto, ROAS nem ROI");
par("1", limpa({ fbConnected: false }), limpa({ fbConnected: true }), "sem-conta");

/* ═══ 2 · `token-<id>` — a falha MAIS CARA, e ela é muda ══════════════════ */
secao("2 · `token-<id>` — o token vence, o gasto congela, o ROAS mente por omissão");
par(
  "2",
  limpa({ perfisCrus: [{ id: "p1", name: "Perfil A", tokenExpiresAt: VENCIDO }] }),
  limpa({ perfisCrus: [{ id: "p1", name: "Perfil A", tokenExpiresAt: new Date(AGORA + 400 * 86_400_000).toISOString() }] }),
  "token-p1",
);
{
  /* ⚠️ O nome do perfil vem da Meta — é texto de TERCEIRO chegando ao markup.
     React escapa por padrão; a asserção existe para que trocar por
     `dangerouslySetInnerHTML` numa "melhoria de tipografia" reprove. */
  const lista = montarAlertas(limpa({ perfisCrus: [{ id: "p1", name: "<img src=x onerror=alert(1)>", tokenExpiresAt: VENCIDO }] }));
  const html = desenhar(lista);
  ok("2 · linha de base: o alerta com nome hostil foi construído", lista.length === 1, lista[0]?.id);
  ok(
    "2 · ⛔ o nome vindo da Meta é ESCAPADO no markup",
    !html.includes("<img src=x") && html.includes("&lt;img"),
    "nome de perfil é texto de terceiro",
  );
}

/* ═══ 3 · `conta-<id>` — erro de sincronização ════════════════════════════ */
secao("3 · `conta-<id>` — e o TOM do `erroMeta.ts` é respeitado no desenho");
const contaCom = (tom) =>
  limpa({ adProfiles: [{ accounts: [{ id: "c1", name: "Conta 1", erroSync: { tom, mensagem: "Token inválido", acao: "Reconecte" } }] }] });
par("3", contaCom("erro"), limpa({ adProfiles: [{ accounts: [{ id: "c1", name: "Conta 1", erroSync: null }] }] }), "conta-c1");
{
  /* ⛔ Marcar tudo como crítico encheria o painel de vermelho por rate limit,
     que passa sozinho — e aí o vermelho que importa chega no meio de dez. */
  const aviso = desenhar(montarAlertas(contaCom("aviso")));
  const erro = desenhar(montarAlertas(contaCom("erro")));
  ok("3 · tom `aviso` desenha o tinte de ATENÇÃO", aviso.includes("bg-tint-warning") && !aviso.includes("bg-tint-danger"));
  ok("3 · tom `erro` desenha o tinte CRÍTICO", erro.includes("bg-tint-danger"));
  ok(
    "3 · ⛔ e os dois markups DIFEREM — o tom não é decorativo",
    aviso !== erro,
    "mesma conta, mesmo texto, tinte diferente",
  );
}

/* ═══ 4 · `roi-caiu` — e ele NÃO tem href ════════════════════════════════ */
secao("4 · `roi-caiu` — o único par que prova o ramo SEM link");
par("4", limpa({ roi: { value: "0,80x", delta: -25 } }), limpa({ roi: { value: "1,0x", delta: -10 } }), "roi-caiu");

/* ═══ 5 · `gasto-sem-conversao` — o que mais custa dinheiro ══════════════ */
secao("5 · `gasto-sem-conversao` — dinheiro saindo e nada entrando");
par(
  "5",
  limpa({ chartSerie: { spend: [100, 50], revenue: [0, 0] } }),
  limpa({ chartSerie: { spend: [100], revenue: [1] } }),
  "gasto-sem-conversao",
);
{
  /* O VALOR precisa chegar ao desenho: "gastou e não vendeu" sem o número não
     diz se são R$ 12 ou R$ 12.000, e a decisão é outra em cada caso. */
  const html = desenhar(montarAlertas(limpa({ chartSerie: { spend: [1234], revenue: [0] } })));
  ok("5 · o VALOR gasto chega ao markup", texto(html).includes("1234"), texto(html).slice(0, 120));
}

/* ═══ 6 · `faltam-taxas` — o que ficou 2 dias e meio sem consumidor ══════ */
secao("6 · `faltam-taxas` — a ausência que faz o Lucro mentir PARA CIMA");
par(
  "6",
  limpa({ tiposDeDespesa: [] }),
  limpa({ tiposDeDespesa: ["TAXA_GATEWAY", "COPRODUCAO", "IMPOSTO", "CUSTO_PRODUTO"] }),
  "faltam-taxas",
);
{
  /* ⛔ UM alerta com a lista dentro, nunca quatro — e o desenho precisa caber a
     lista inteira, senão o `line-clamp` come justamente o que falta cadastrar.
     ⚠️ O detalhe é `white-space: nowrap` + elipse por CSS: o texto ESTÁ no
     markup, e quem o corta é o navegador. Esta asserção afirma o markup; o
     recorte visual é dos itens de tela que seguem sem medição. */
  const html = desenhar(montarAlertas(limpa({ tiposDeDespesa: [] })));
  const t = texto(html);
  ok(
    "6 · o detalhe NOMEIA os quatro custos que faltam",
    ["gateway", "coprodução", "imposto", "custo de produto"].every((r) => t.includes(r)),
    t.slice(t.indexOf("Sem "), t.indexOf("Sem ") + 100),
  );
  ok("6 · …e diz a consequência: o Lucro aparece MAIOR", /maior do que é/.test(t));
  ok("6 · leva para a tela de Taxas", /href="\/dashboard\/taxas"/.test(html));
}

/* ═══ 7 · `donos-<id>` — a contagem dobrada na Meta ══════════════════════ */
secao("7 · `donos-<id>` — o envio religado, e a Meta contando em dobro");
const pixelCom = (corr) => limpa({ pixels: [{ id: "px1", name: "Pixel Loja", donosCorrompidos: corr }] });
par("7", pixelCom([{ chave: "Purchase", bruto: "1", assumido: "traffik" }]), pixelCom([]), "donos-px1");
{
  /* Cinco corrupções no mesmo pixel são UM alerta — e o desenho tem de listar
     as cinco, senão a consolidação vira omissão. */
  const cinco = [
    { chave: "Purchase", bruto: "1", assumido: "traffik" },
    { chave: "Lead", bruto: "{}", assumido: "traffik" },
    { chave: "purchase", bruto: "gateway", assumido: "traffik" },
    { chave: "AddToCart", bruto: " x", assumido: "traffik" },
    { chave: "PageView", bruto: "9", assumido: "navegador" },
  ];
  const lista = montarAlertas(pixelCom(cinco));
  ok("7 · linha de base: cinco corrupções viram UM alerta", lista.length === 1, lista.length + " alertas");
  const t = texto(desenhar(lista));
  ok(
    "7 · …e o desenho lista as CINCO chaves",
    cinco.every((d) => t.includes(d.chave)),
    "consolidar não pode virar omitir",
  );
  ok("7 · o título NOMEIA o pixel", t.includes("Pixel Loja"));
}

/* ═══ 7b · `padrao-teste-<host>` — o único alerta com AÇÃO, e é a porta ═══

   🔴 Um padrão aprovado bloqueia envio à CAPI **na ingestão**, e o evento não
   volta. A remoção existia e a tela que a chamava foi deletada — o produto
   tinha o remédio e nenhuma porta. Este alerta é a porta, e o botão é a
   maçaneta: se ele não desenhar, o remédio continua inalcançável.            */
secao("7b · `padrao-teste-<host>` — o alerta que ANUNCIA o bloqueio e o DESFAZ");
const PADRAO = [{ padrao: "moldes-*-projeto.vercel.app", criadoEm: "2026-08-14T12:00:00.000Z" }];
par("7b", limpa({ padroesDeTeste: PADRAO }), limpa({ padroesDeTeste: [] }), "padrao-teste-moldes-*-projeto.vercel.app");
{
  const removidos = [];
  const lista = montarAlertas(limpa({ padroesDeTeste: PADRAO, aoRemoverPadrao: (p) => removidos.push(p) }));
  const html = desenhar(lista);
  const t = texto(html);

  ok("7b · linha de base: o alerta veio COM ação", lista[0].acao?.rotulo === "Remover", lista[0].acao?.rotulo);
  ok("7b · 🔑 o botão de remover é DESENHADO", /<button[^>]*>Remover<\/button>/.test(html), "sem ele o remédio segue inalcançável");
  ok("7b · o padrão bloqueado aparece no texto", t.includes("moldes-*-projeto.vercel.app"), t.slice(0, 90));

  /* ⛔ COM AÇÃO, NUNCA ÂNCORA. `<button>` dentro de `<a>` é markup inválido, e
     o clique fica ambíguo: o usuário mira "Remover" e navega. */
  ok("7b · ⛔ a linha NÃO é âncora quando há ação", !/<a /.test(html), "botão dentro de <a> é inválido");

  /* O PAR: sem `aoRemoverPadrao` o alerta ainda anuncia — e é aí que ele volta
     a ser o estado que existe para denunciar. */
  const semPorta = desenhar(montarAlertas(limpa({ padroesDeTeste: PADRAO })));
  ok(
    "7b · …e SEM a ação injetada, o alerta anuncia e NÃO oferece saída",
    texto(semPorta).includes("moldes-*-projeto.vercel.app") && !/<button[^>]*>Remover/.test(semPorta),
    "← o par prova que quem traz a porta é a TELA, não o construtor",
  );

  /* ⚠️ E o botão precisa ter ÁREA DE CLIQUE estável: `flex: none` impede que
     ele encolha quando o título ocupa duas linhas. É a falha muda do rail
     recolhido, onde a `Tooltip` derrubou o alvo de 43px para 17. */
  ok(
    "7b · o botão não encolhe com o título ao lado (`flex:none`)",
    /<button[^>]*style="[^"]*flex:none/.test(html.replace(/\s*:\s*/g, ":")),
    "área de clique que muda de tamanho com o texto vizinho é falha muda",
  );
}

/* ═══ 8 · A COMPOSIÇÃO — o máximo simultâneo é SEIS, e os seis desenham ═══

   ⛔ Os SETE não podem coexistir, e não é limitação da fixture: `faltam-taxas`
   exige `receita > 0` e `gasto-sem-conversao` exige `receita === 0`. São
   mutuamente exclusivos POR CONSTRUÇÃO. Afirmar "os 7 juntos" seria escrever
   uma asserção que não pode passar — e "consertá-la" mexendo no portão da
   receita reintroduziria o ruído que ele existe para impedir.                */
secao("8 · A composição — o máximo simultâneo é SEIS, e os seis chegam ao markup");
{
  const tudo = limpa({
    fbConnected: false,
    perfisCrus: [{ id: "p1", name: "Perfil A", tokenExpiresAt: VENCIDO }],
    adProfiles: [{ accounts: [{ id: "c1", name: "Conta 1", erroSync: { tom: "erro", mensagem: "Token inválido", acao: null } }] }],
    roi: { value: "0,5x", delta: -50 },
    chartSerie: { spend: [100], revenue: [0] },
    pixels: [{ id: "px1", name: "Pixel Loja", donosCorrompidos: [{ chave: "Purchase", bruto: "1", assumido: "traffik" }] }],
  });
  const lista = montarAlertas(tudo);
  ok("8 · linha de base: seis alertas construídos", lista.length === 6, lista.map((a) => a.id).join(" · "));

  const t = texto(desenhar(lista));
  const desenhados = lista.filter((a) => t.includes(a.titulo));
  ok(
    "8 · os SEIS títulos chegam ao markup",
    desenhados.length === 6,
    `${desenhados.length} de ${lista.length} — faltaram: ${lista.filter((a) => !t.includes(a.titulo)).map((a) => a.id).join(", ") || "nenhum"}`,
  );

  /* ⛔ Crítico primeiro. Se a ordem se perder, o alerta que custa dinheiro
     agora fica abaixo de um "vence em 20 dias" — e com o truncamento da §9 ele
     é o que some. */
  const pos = lista.map((a) => ({ id: a.id, sev: a.severidade, i: t.indexOf(a.titulo) }));
  const ultimoDanger = Math.max(...pos.filter((p) => p.sev === "danger").map((p) => p.i));
  const primeiroWarning = Math.min(...pos.filter((p) => p.sev === "warning").map((p) => p.i));
  ok(
    "8 · ⛔ TODO `danger` é desenhado antes de qualquer `warning`",
    ultimoDanger < primeiroWarning,
    pos.sort((a, b) => a.i - b.i).map((p) => `${p.id}(${p.sev})`).join(" → "),
  );

  /* A troca EXATA do §7 de `test:alertas`, agora no desenho: com receita, um
     título sai da tela e o outro entra. */
  const comVenda = montarAlertas({ ...tudo, tiposDeDespesa: [], chartSerie: { spend: [100], revenue: [50] } });
  const tv = texto(desenhar(comVenda));
  ok(
    "8 · com receita, o desenho troca `gasto-sem-conversao` por `faltam-taxas`",
    !tv.includes("Gasto sem nenhuma conversão") && /Faltam \d+ custos cadastrados/.test(tv),
    comVenda.map((a) => a.id).join(" · "),
  );
}

/* ═══ 9 · ⚠️ O QUE O `limite` FAZ ANTES DE HAVER MEDIÇÃO ═══════════════════

   🔴 MEDIDO, REGISTRADO, NÃO CORRIGIDO — e a razão está escrita abaixo.

   `cabem` guarda o estado não medido:

       const cabem = ch > 0 && hLinha > 0 ? Math.max(1, …) : limite;

   `comRodape`, a linha seguinte, **não guarda**:

       const comRodape = ordenados.length > cabem ? Math.max(1, Math.floor((ch + 8 - 26) / (hLinha + 8))) : cabem;

   Com `ch = 0` e `hLinha = 0` — que é o estado de TODO render de servidor, e do
   primeiro render do cliente antes de o `ResizeObserver` disparar —, a conta é
   `Math.floor(-18 / 8) = -3`, e o `Math.max(1, …)` a segura em **1**.

   Ou seja: o HTML inicial desenha **um** alerta e um rodapé "+ N", quando o
   `limite` diz 3. É a família *"endurecer uma porta com a outra aberta"*: a
   guarda do não-medido existe numa das duas contas e não na vizinha.

   ⛔ **Não corrigido nesta rodada, e não é hesitação.** Mudar isto muda quantos
   alertas o Dashboard pinta antes da primeira medição — geometria de tela, na
   máquina em que o instrumento de janela está indisponível. A regra desta base
   é literal: *nenhum limiar sem medição do próprio bloco*, e *asserção verde
   não fecha o que a tela não confirmou*. A asserção abaixo congela o valor
   MEDIDO, para a correção — quando houver janela — aparecer como falha e não
   como mudança silenciosa.                                                    */
secao("9 · ✅ Antes da medição, quem manda é o `limite` DECLARADO");
{
  const seis = [1, 2, 3, 4, 5, 6].map((i) => ({
    id: "a" + i,
    severidade: "warning",
    titulo: "Alerta numero " + i,
    detalhe: "detalhe " + i,
  }));

  const padrao = renderToStaticMarkup(React.createElement(AlertList, { alertas: seis }));
  const tp = texto(padrao);
  const quantos = seis.filter((a) => tp.includes(a.titulo)).length;
  ok(
    "9 · ✅ com `limite` 3 e 6 alertas, o markup inicial desenha TRÊS",
    quantos === 3,
    `${quantos} de 6 — antes era 1: \`comRodape\` calculava \`floor(-18/8)\` e o \`max(1,…)\` o segurava`,
  );
  ok(
    "9 · …e o rodapé declara os que ficaram de fora",
    /\+ 3 alertas/.test(tp),
    (tp.match(/\+ \d+ alertas?/) || ["(nenhum)"])[0],
  );
  /* ⛔ A FRONTEIRA da correção: o visível é `min(limite, comRodape)`, e antes o
     `comRodape` valia 1 sem medição. A asserção acima congela o TRÊS; esta
     congela que o `limite` é de fato quem manda — passe 5 e saem 5. */
  ok(
    "9 · 🔑 e é o `limite` que decide, não um piso escondido",
    texto(renderToStaticMarkup(React.createElement(AlertList, { alertas: seis, limite: 5 }))).match(/Alerta numero/g)?.length === 5,
    "com `limite` 5 saem 5 — se voltasse o piso de 1, este número não mexeria",
  );
  ok(
    "9 · ⛔ o rodapé é BOTÃO, não link — ele expande no lugar, não navega",
    /<button[^>]*aria-expanded="false"/.test(padrao),
    "no rodapé expande; no cabeçalho navegaria — e não há tela de \"todos\"",
  );

  /* O par: com `limite` folgado, os seis desenham. É ele que prova que o 1 de
     cima é o `comRodape`, e não um defeito de desenho. */
  const folgado = renderToStaticMarkup(React.createElement(AlertList, { alertas: seis, limite: 6 }));
  const tf = texto(folgado);
  ok(
    "9 · …e o PAR: com `limite` 6, os seis desenham e o rodapé some",
    seis.every((a) => tf.includes(a.titulo)) && !/\+ \d+ alerta/.test(tf),
    "← é isto que prova que o 1 acima é o `comRodape`, não falha de desenho",
  );

  /* Com exatamente `limite` alertas não há truncamento nenhum — a fronteira. */
  const tres = seis.slice(0, 3);
  const t3 = texto(renderToStaticMarkup(React.createElement(AlertList, { alertas: tres })));
  ok(
    "9 · fronteira: com 3 alertas e `limite` 3, os TRÊS desenham",
    tres.every((a) => t3.includes(a.titulo)) && !/\+ \d+ alerta/.test(t3),
    "o truncamento só começa quando há mais do que cabe",
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
if (falhas.length) {
  console.log("\n\x1b[31m" + falhas.length + " falha(s):\x1b[0m\n  - " + falhas.join("\n  - "));
  process.exit(1);
}
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: 8 alertas renderizados um a um, cada um com o par desenha/não-desenha");
console.log("   + composição de 6 (o máximo simultâneo) e o truncamento pré-medição\n");
