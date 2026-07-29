/**
 * Teste de regressão da ATRIBUIÇÃO POR ÁREA, contra o backup REAL de produção.
 *
 * ## Por que contra o backup, e não contra dado semeado
 *
 * O bug de 29/07 (dashboard zerado) só existia por causa da forma dos dados
 * reais: 89 dos 221 cliques têm `utm_campaign` NULO e a maioria das vendas não
 * tem clique associado. Dado inventado tende a ser bem-comportado e não teria
 * reproduzido nada.
 *
 * ## Só leitura, e sem banco
 *
 * Lê o arquivo JSONL. Não abre conexão, não escreve em lugar nenhum — está
 * dentro da regra permanente "verificação vira leitura + asserção".
 *
 * Uso: node scripts/teste-atribuicao-areas.mjs [caminho-do-backup.jsonl]
 */
import fs from "node:fs";
import path from "node:path";

import { ehBancoDeDesenvolvimento } from "./guard-db.mjs";

import { construirMapa } from "@/lib/areas/precedencia";

/**
 * Escolhe o backup mais recente **de PRODUÇÃO**.
 *
 * ⚠️ Antes era `.sort().pop()` sobre os nomes, e isso quebrou em silêncio no dia
 * em que apareceu um backup de dev: o ref `drdf…` ordena depois de `dgao…`,
 * então o teste passou a rodar contra 8 registros sintéticos e reportou
 * "0 de 8 vendas perdidas" — como se o bug antigo nunca tivesse existido.
 * **Um teste que troca de dado sozinho não prova nada; pior, dá falso verde.**
 *
 * Quem sabe o que é banco de dev é o `guard-db.mjs`, então a pergunta vai a ele
 * em vez de duplicar a lista de refs aqui.
 */
const metaDe = (f) => {
  try {
    return JSON.parse(fs.readFileSync(path.join("backups", f), "utf8").split("\n", 1)[0] ?? "{}");
  } catch {
    return {};
  }
};
const dataDoNome = (f) => f.match(/(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/)?.[1] ?? "";

let arquivo = process.argv[2];
if (!arquivo) {
  const candidatos = fs
    .readdirSync("backups")
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ f, projeto: metaDe(f).projeto ?? "" }))
    .filter(({ projeto }) => projeto && !ehBancoDeDesenvolvimento(`postgres.${projeto}@x`))
    .sort((a, b) => dataDoNome(a.f).localeCompare(dataDoNome(b.f)));
  const escolhido = candidatos.pop();
  if (!escolhido) {
    console.error(
      "\n\x1b[31m✗ Nenhum backup de PRODUÇÃO em backups/.\x1b[0m\n" +
        "  Este teste só prova algo contra dado real.\n" +
        "  Passe o arquivo: npm run test:areas -- <caminho.jsonl>\n",
    );
    process.exit(1);
  }
  arquivo = path.join("backups", escolhido.f);
}

const linhas = fs.readFileSync(arquivo, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const projetoDoBackup = linhas.find((o) => o.__meta)?.projeto ?? "?";
const tabela = (t) => linhas.filter((o) => o.t === t).map((o) => o.r);

const users = tabela("User");
const workspaces = tabela("Workspace");
const adAccounts = tabela("AdAccount");
const webhooks = tabela("Webhook");
const pixelConfigs = tabela("PixelConfig");
const campaigns = tabela("Campaign");
const clicks = tabela("Click");
const sales = tabela("Sale");
const pixelEvents = tabela("PixelEvent");

let ok = 0;
let falhas = 0;
const t = (nome, cond, detalhe = "") => {
  if (cond) { ok++; console.log(`  \x1b[32m✓\x1b[0m ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
  else { falhas++; console.log(`  \x1b[31m✗ ${nome}${detalhe ? ` — ${detalhe}` : ""}\x1b[0m`); }
};

/** Estado do banco DEPOIS da migration: nenhuma configuração tem dono ainda. */
function dadosDoUsuario(userId, { contaDaArea = {}, webhookDaArea = {}, pixelDaArea = {}, desempate = {} } = {}) {
  const ws = workspaces.filter((w) => w.userId === userId);
  return {
    areas: ws.map((w) => ({
      id: w.id, name: w.name, isDefault: !!w.isDefault, archived: !!w.archived,
      produtosDesempate: desempate[w.id] ?? [],
    })),
    contas: adAccounts.filter((a) => a.userId === userId)
      .map((a) => ({ id: a.id, workspaceId: contaDaArea[a.id] ?? null })),
    webhooks: webhooks.filter((h) => h.userId === userId)
      .map((h) => ({ id: h.id, workspaceId: webhookDaArea[h.id] ?? null })),
    pixels: pixelConfigs.filter((p) => p.userId === userId)
      .map((p) => ({ id: p.id, workspaceId: pixelDaArea[p.id] ?? null })),
    credenciais: [],
    campanhas: campaigns
      .filter((c) => adAccounts.some((a) => a.id === c.adAccountId && a.userId === userId))
      .map((c) => ({ fbCampaignId: c.fbCampaignId, name: c.name, adAccountId: c.adAccountId })),
  };
}

const porClique = new Map(clicks.map((c) => [c.id, c]));
const vendaParaAtribuir = (s) => ({
  product: s.product ?? "",
  webhookId: s.webhookId ?? null,
  apiCredentialId: s.apiCredentialId ?? null,
  click: s.clickId
    ? {
        utmCampaign: porClique.get(s.clickId)?.utmCampaign ?? null,
        workspaceId: porClique.get(s.clickId)?.workspaceId ?? null,
      }
    : null,
});

/** Distribui as linhas do usuário pelas áreas e devolve a contagem por área. */
function distribuir(mapa, userId) {
  const conta = { cliques: {}, vendas: {}, eventos: {} };
  const inc = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
  for (const c of clicks.filter((c) => c.userId === userId))
    inc(conta.cliques, mapa.areaDoClique({ utmCampaign: c.utmCampaign ?? null, workspaceId: c.workspaceId ?? null }).areaId);
  for (const s of sales.filter((s) => s.userId === userId)) inc(conta.vendas, mapa.areaDaVenda(vendaParaAtribuir(s)).areaId);
  for (const e of pixelEvents.filter((e) => e.userId === userId)) {
    const cl = e.fbclid ? clicks.find((c) => c.fbclid === e.fbclid && c.userId === userId) : null;
    inc(conta.eventos, mapa.areaDoEvento({ pixelConfigId: e.pixelConfigId ?? null, utmCampaign: cl?.utmCampaign ?? null }).areaId);
  }
  return conta;
}

const soma = (o) => Object.values(o).reduce((a, b) => a + b, 0);
let mapaBaseGlobal = null;

console.log(`\nBackup: ${path.basename(arquivo)}`);
console.log(`Usuários: ${users.length} · Áreas: ${workspaces.length} · Contas: ${adAccounts.length}\n`);

for (const u of users) {
  const nCliques = clicks.filter((c) => c.userId === u.id).length;
  const nVendas = sales.filter((s) => s.userId === u.id).length;
  const nEventos = pixelEvents.filter((e) => e.userId === u.id).length;
  const contasDoUser = adAccounts.filter((a) => a.userId === u.id);
  const wsDoUser = workspaces.filter((w) => w.userId === u.id);
  const principal = wsDoUser.find((w) => w.isDefault) ?? wsDoUser[0];
  if (!principal) continue;

  console.log(`\x1b[1m${u.email}\x1b[0m — ${nCliques} cliques · ${nVendas} vendas · ${nEventos} eventos · ${contasDoUser.length} contas`);

  mapaBaseGlobal = construirMapa(dadosDoUsuario(u.id));

  // ── Cenário 1: estado imediatamente após a migração ────────────────────────
  // Nenhuma configuração tem dono. TUDO tem de cair na principal — é a
  // condição B: a migração não pode mudar nenhum número.
  {
    const mapa = construirMapa(dadosDoUsuario(u.id));
    const d = distribuir(mapa, u.id);
    t("pós-migração: cliques somam o total", soma(d.cliques) === nCliques, `${soma(d.cliques)}/${nCliques}`);
    t("pós-migração: vendas somam o total", soma(d.vendas) === nVendas, `${soma(d.vendas)}/${nVendas}`);
    t("pós-migração: eventos somam o total", soma(d.eventos) === nEventos, `${soma(d.eventos)}/${nEventos}`);
    t("pós-migração: tudo na Principal (nada muda de lugar)",
      (d.cliques[principal.id] ?? 0) === nCliques && (d.vendas[principal.id] ?? 0) === nVendas,
      `principal ficou com ${d.cliques[principal.id] ?? 0} cliques e ${d.vendas[principal.id] ?? 0} vendas`);
  }

  // ── Cenário 2: uma área secundária dona da primeira conta ──────────────────
  // É o caso que o usuário vai criar de verdade. A partição tem de continuar
  // exata: nada some, nada é contado duas vezes.
  if (contasDoUser.length > 0) {
    const secundaria = wsDoUser.find((w) => !w.isDefault);
    const areaB = secundaria?.id ?? "area-b-sintetica";
    // A conta com MAIS tráfego atribuído — é a que um usuário real poria numa
    // área. Pegar a primeira da lista testava uma conta sem clique nenhum e a
    // asserção "a secundária recebe linhas" passava a medir o dado, não o código.
    const mapaBase = construirMapa(dadosDoUsuario(u.id));
    const trafegoPorConta = new Map();
    for (const c of clicks.filter((c) => c.userId === u.id)) {
      const conta = mapaBase.contaDoUtm(c.utmCampaign);
      if (conta) trafegoPorConta.set(conta, (trafegoPorConta.get(conta) ?? 0) + 1);
    }
    const contaEscolhida =
      [...trafegoPorConta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? contasDoUser[0].id;
    const dados = dadosDoUsuario(u.id, { contaDaArea: { [contaEscolhida]: areaB } });
    if (!secundaria) dados.areas.push({ id: areaB, name: "Área B", isDefault: false, archived: false, produtosDesempate: [] });

    const mapa = construirMapa(dados);
    const d = distribuir(mapa, u.id);
    t("com área secundária: cliques somam o total", soma(d.cliques) === nCliques, `${soma(d.cliques)}/${nCliques}`);
    t("com área secundária: vendas somam o total", soma(d.vendas) === nVendas, `${soma(d.vendas)}/${nVendas}`);
    t("com área secundária: eventos somam o total", soma(d.eventos) === nEventos, `${soma(d.eventos)}/${nEventos}`);
    const naB = (d.cliques[areaB] ?? 0) + (d.vendas[areaB] ?? 0);
    t("a área secundária de fato recebe linhas (o filtro não é no-op)", naB > 0 || contasDoUser.length === 0,
      `${d.cliques[areaB] ?? 0} cliques + ${d.vendas[areaB] ?? 0} vendas na secundária`);
    t("nenhuma linha cai fora de toda área", Object.keys(d.cliques).every((k) => k) && !Object.keys(d.vendas).includes("undefined"));
  }

  // ── Cenário 3: o BUG ANTIGO, reproduzido ──────────────────────────────────
  // Modelo velho: a secundária incluía a conta E o webhook; a principal excluía
  // os dois. Venda sem clique vinda daquele webhook saía das DUAS.
  {
    const wh = webhooks.filter((h) => h.userId === u.id);
    if (wh.length > 0 && contasDoUser.length > 0) {
      // A MESMA conta com tráfego do cenário 2 — usar uma conta sem clique
      // nenhum faria o "modelo antigo perdia N vendas" contar perdas que são
      // do dado, não do modelo. O número tem de ser honesto para servir.
      const mapaBase = construirMapa(dadosDoUsuario(u.id));
      const trafego = new Map();
      for (const c of clicks.filter((c) => c.userId === u.id)) {
        const conta = mapaBase.contaDoUtm(c.utmCampaign);
        if (conta) trafego.set(conta, (trafego.get(conta) ?? 0) + 1);
      }
      const contaEscolhida = [...trafego.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? contasDoUser[0].id;
      const casaNaConta = (utm) => mapaBase.contaDoUtm(utm) === contaEscolhida;

      const vendasDoUser = sales.filter((s) => s.userId === u.id);
      const sumidas = vendasDoUser.filter((s) => {
        const utm = s.clickId ? (porClique.get(s.clickId)?.utmCampaign ?? null) : null;
        const naSecundaria = casaNaConta(utm) && s.webhookId === wh[0].id;
        const naPrincipal = !(s.webhookId === wh[0].id) && !casaNaConta(utm);
        return !naSecundaria && !naPrincipal; // não cabia em nenhuma das duas
      }).length;

      const mapa = construirMapa(dadosDoUsuario(u.id, {
        contaDaArea: { [contaEscolhida]: wsDoUser.find((w) => !w.isDefault)?.id ?? "b" },
        webhookDaArea: { [wh[0].id]: wsDoUser.find((w) => !w.isDefault)?.id ?? "b" },
      }));
      const d = distribuir(mapa, u.id);
      t("modelo ANTIGO perdia vendas (bug reproduzido)", sumidas > 0 || vendasDoUser.length === 0,
        `${sumidas} de ${vendasDoUser.length} vendas ficavam invisíveis nas duas áreas`);
      t("modelo NOVO não perde nenhuma", soma(d.vendas) === nVendas, `${soma(d.vendas)}/${nVendas}`);
    }
  }

  // ── Cenário 4: precedência conta > webhook ────────────────────────────────
  {
    const wh = webhooks.filter((h) => h.userId === u.id);
    const comClique = sales.filter((s) => s.userId === u.id && s.clickId && porClique.get(s.clickId)?.utmCampaign);
    if (wh.length > 0 && comClique.length > 0 && contasDoUser.length > 0) {
      const areaA = principal.id;
      const areaB = "b-teste";
      const dados = dadosDoUsuario(u.id, {
        webhookDaArea: { [wh[0].id]: areaA }, // webhook é da A…
        contaDaArea: Object.fromEntries(contasDoUser.map((a) => [a.id, areaB])), // …conta é da B
      });
      dados.areas.push({ id: areaB, name: "Área B", isDefault: false, archived: false, produtosDesempate: [] });
      const mapa = construirMapa(dados);
      const atribuidas = comClique.map((s) => mapa.areaDaVenda(vendaParaAtribuir(s)));
      const porConta = atribuidas.filter((r) => r.motivo === "conta");
      t("venda com clique atribuído vai para a área da CONTA, não do webhook",
        porConta.length === 0 || porConta.every((r) => r.areaId === areaB),
        `${porConta.length} venda(s) decidida(s) por conta, todas na Área B`);
    }
  }

  // ── Cenário 5: desempate por produto vence o webhook ──────────────────────
  {
    const wh = webhooks.filter((h) => h.userId === u.id);
    const semClique = sales.filter((s) => s.userId === u.id && !s.clickId && s.webhookId);
    if (wh.length > 0 && semClique.length > 0) {
      const produto = semClique[0].product;
      const areaB = "b-desempate";
      const dados = dadosDoUsuario(u.id, { webhookDaArea: { [wh[0].id]: principal.id } });
      dados.areas.push({ id: areaB, name: "Área B", isDefault: false, archived: false, produtosDesempate: [produto] });
      const mapa = construirMapa(dados);
      const r = mapa.areaDaVenda(vendaParaAtribuir(semClique[0]));
      t("desempate por produto vence o dono do webhook", r.areaId === areaB && r.motivo === "produto",
        `"${produto}" → ${r.motivo}`);

      // Produto renomeado no gateway: o desempate para de casar e a venda cai
      // no dono do webhook — não some, não vai para a Principal por engano.
      const dados2 = dadosDoUsuario(u.id, { webhookDaArea: { [wh[0].id]: principal.id } });
      dados2.areas.push({ id: areaB, name: "Área B", isDefault: false, archived: false, produtosDesempate: [`${produto} 2.0`] });
      const mapa2 = construirMapa(dados2);
      const r2 = mapa2.areaDaVenda(vendaParaAtribuir(semClique[0]));
      t("produto renomeado degrada para o dono do webhook (não se perde)",
        r2.areaId === principal.id && r2.motivo === "webhook", `→ ${r2.motivo}`);
    }
  }

  // ── Cenário 6: área arquivada devolve as linhas para a Principal ──────────
  if (contasDoUser.length > 0) {
    const dados = dadosDoUsuario(u.id, { contaDaArea: { [contasDoUser[0].id]: "arquivada" } });
    dados.areas.push({ id: "arquivada", name: "Arquivada", isDefault: false, archived: true, produtosDesempate: [] });
    const mapa = construirMapa(dados);
    const d = distribuir(mapa, u.id);
    t("área arquivada não retém linhas", (d.cliques["arquivada"] ?? 0) === 0 && soma(d.cliques) === nCliques);
  }

  // ── Cenário 7: ÁREA DECLARADA PELO SCRIPT DE UTM ──────────────────────────
  // O script instalado na página carimba o clique com a área. Ele NÃO vence a
  // conta de anúncio — senão o gasto ficaria numa área e a visita em outra.
  {
    const wsDoUser2 = workspaces.filter((w) => w.userId === u.id);
    const areaScript = "area-do-script";
    const dados = dadosDoUsuario(u.id);
    dados.areas.push({ id: areaScript, name: "Área do script", isDefault: false, archived: false, produtosDesempate: [] });
    const mapa = construirMapa(dados);

    // (a) clique SEM campanha atribuível + ws do script → vai para a área do script
    const semUtm = clicks.find((c) => c.userId === u.id && !c.utmCampaign);
    if (semUtm) {
      const r = mapa.areaDoClique({ utmCampaign: null, workspaceId: areaScript });
      t("clique sem campanha + script da área → área do script", r.areaId === areaScript && r.motivo === "script");
      const semScript = mapa.areaDoClique({ utmCampaign: null, workspaceId: null });
      t("o MESMO clique sem o script cai na Principal (comportamento antigo)", semScript.areaId === principal.id);
    }

    // (b) clique COM campanha de outra área + ws do script → a CONTA vence
    const comUtm = clicks.find((c) => c.userId === u.id && mapaBaseGlobal.contaDoUtm(c.utmCampaign));
    if (comUtm && contasDoUser.length > 0) {
      const conta = mapaBaseGlobal.contaDoUtm(comUtm.utmCampaign);
      const areaConta = "area-da-conta";
      const d2 = dadosDoUsuario(u.id, { contaDaArea: { [conta]: areaConta } });
      d2.areas.push({ id: areaConta, name: "Área da conta", isDefault: false, archived: false, produtosDesempate: [] });
      d2.areas.push({ id: areaScript, name: "Área do script", isDefault: false, archived: false, produtosDesempate: [] });
      const m2 = construirMapa(d2);
      const r = m2.areaDoClique({ utmCampaign: comUtm.utmCampaign, workspaceId: areaScript });
      t("clique com campanha: a CONTA vence o script (gasto e visita na mesma área)",
        r.areaId === areaConta && r.motivo === "conta", `→ ${r.motivo}`);
    }

    // (c) ws de área inexistente/arquivada é descartado
    const rInvalido = mapa.areaDoClique({ utmCampaign: null, workspaceId: "area-que-nao-existe" });
    t("ws inválido é descartado e cai na Principal", rInvalido.areaId === principal.id);

    // (d) a partição continua exata com cliques carimbados
    const metade = clicks.filter((c) => c.userId === u.id).map((c, i) => ({ ...c, workspaceId: i % 2 === 0 ? areaScript : null }));
    const contagem = {};
    for (const c of metade) {
      const k = mapa.areaDoClique({ utmCampaign: c.utmCampaign ?? null, workspaceId: c.workspaceId }).areaId;
      contagem[k] = (contagem[k] ?? 0) + 1;
    }
    t("com metade dos cliques carimbados, a partição continua exata",
      soma(contagem) === nCliques, `${soma(contagem)}/${nCliques}`);
  }

  console.log("");
}

console.log(`\n\x1b[1m${ok} asserções passaram, ${falhas} falharam.\x1b[0m\n`);
process.exit(falhas === 0 ? 0 : 1);
