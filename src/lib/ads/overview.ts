import { carregarMapaDeAreas } from "@/lib/areas/atribuicao";
import { getUserTimezone } from "@/lib/userTimezone";
import { prisma } from "@/lib/prisma";
import { janelaDoPeriodo, type PeriodoNome } from "@/lib/periodo";
import { dateColumnKey, dayEnd, dayKeyInTz, dayKeyRange, dayStart, keyToDateColumn } from "@/lib/timezone";
import { chaveDoPedido } from "@/lib/pedidos";
import { splitPipe } from "@/lib/utm/parse";
import { CAMPOS_UTM, utmsDaVenda } from "@/lib/vendas/utmsDaVenda";

export interface AdsFilters {
  /**
   * ⚠️ Os 7 períodos de `lib/periodo.ts`, não os 3 de antes. O Gerenciador tinha
   * só Hoje/7d/30d; agora usa o mesmo seletor do Dashboard.
   */
  period: PeriodoNome;
  /** Apenas para `period: "custom"`. */
  from?: string;
  to?: string;
  account: string; // "todas" ou AdAccount.id
  status: string; // "todos" | "ativo" | "pausado"
  search: string;
  /**
   * Filtros BASE da Área de Trabalho, carregados no servidor a partir do `?ws=`.
   * Mesma convenção do Dashboard: lista vazia/ausente = não filtra, e o filtro
   * da TELA age DENTRO dela.
   */
  /**
   * Área de Trabalho ATIVA — só o id. A pertinência de cada linha é resolvida
   * no servidor por `lib/areas/precedencia.ts`. Ver o porquê em `metrics.ts`.
   */
  workspaceId?: string | null;
}

/**
 * Os três estados de MEDIÇÃO de uma linha do Gerenciador.
 *
 * ⛔ São TRÊS, não dois, e a terceira não é redundante: `medida` com `spend: 0`
 * é uma afirmação legítima ("a Meta reportou zero"), enquanto as outras duas
 * são ausências de afirmação. Colapsar `medida` nas outras faria a tela esconder
 * um zero que é verdade; colapsar as duas primeiras entre si daria a mesma
 * resposta a quem precisa conferir a integração e a quem não tem o que fazer.
 */
export type Medicao = "nunca-sincronizada" | "sem-veiculacao" | "medida";

/**
 * A série DIÁRIA de uma campanha, alinhada a `AdsOverview.dias`.
 *
 * 🔴 ELA EXISTE PARA QUE O KPI E O SPARKLINE NÃO POSSAM DIVERGIR. Os cinco KPIs
 * do Gerenciador são a soma das campanhas que passam no filtro da tela, e a
 * linha embaixo do número é a soma das MESMAS séries — não uma segunda consulta
 * ao servidor com outro recorte. É a regra do CLAUDE.md aplicada na origem:
 * quando dois cálculos precisam concordar, faça deles um só.
 *
 * ⛔ **SÓ A CAMPANHA TEM SÉRIE, e o tipo cobra isso** (`AdSetRow`/`AdRow` a
 * removem no `Omit`). Os KPIs descrevem o Gerenciador inteiro, não o nível que a
 * tabela está listando — na referência eles somam as 40 campanhas enquanto a
 * tabela mostra 7. Dar série aos outros dois níveis seria carregar 30 números
 * por anúncio para alimentar um número que ninguém lê ali.
 *
 * ⚠️ Acrescentada em 07/08/2026, e é **aditiva**: `sumAds`, `results`, `revenue`
 * e a atribuição continuam byte a byte como estavam. O que entrou foi `date` no
 * `select` das métricas e `timestamp` no das vendas — dois campos que já
 * existiam nas linhas e não eram pedidos.
 */
export interface SerieDaCampanha {
  spend: number[];
  revenue: number[];
  /** Vendas aprovadas, contadas POR PEDIDO — a mesma dedup do agregado. */
  results: number[];
}

export interface CampaignRow {
  id: string;
  fbId: string;
  name: string;
  status: string;
  /**
   * `effective_status` cru da Meta — se está REALMENTE veiculando.
   *
   * ⚠️ NULO = a Meta ainda não informou (sync antigo), **não** "parado". Quem
   * traduz para linguagem de tela é `lib/ads/veiculacao.ts`.
   */
  effectiveStatus: string | null;
  /**
   * `objective` da Meta, cru (`OUTCOME_SALES`, `OUTCOME_LEADS`…).
   *
   * ⚠️ NULO = a campanha nunca foi sincronizada, **não** "sem objetivo" — toda
   * campanha da Meta tem um. Quem traduz para a tela é a tabela.
   */
  objective: string | null;
  /**
   * 🕳️ HOUVE MEDIÇÃO? — a distinção central do projeto, aplicada à LINHA.
   *
   * `spend: 0` não distingue "a Meta reportou zero" de "não existe linha
   * nenhuma", e as duas pedem reações diferentes de quem está olhando. Antes
   * disto a tabela mostrava `R$ 0,00` para campanha que **nunca sincronizou** —
   * afirmando "gastou zero" sobre algo que ninguém mediu.
   *
   * | valor | o que houve | o que o usuário faz |
   * |---|---|---|
   * | `nunca-sincronizada` | a conta nunca conversou com a Meta sobre ela | **confere a integração** |
   * | `sem-veiculacao` | ela sincroniza, e não rodou nesta janela | nada — é normal |
   * | `medida` | há linha na janela. `spend: 0` aqui é VERDADE | lê o número |
   *
   * ⛔ **É FATO SOBRE EXISTÊNCIA DE LINHA, NÃO MÉTRICA DERIVADA** — por isso é
   * enum e não número, e por isso `sumAds` continua reduzindo a partir de
   * `{ spend: 0 }`, intocado. Nada aqui muda uma conta: muda o que a tela tem
   * permissão de afirmar sobre ela. Mesma solução da linha de base do ROAS.
   */
  medicao: Medicao;
  accountId: string;
  /// Orçamento na campanha ⇒ CBO. Nulo ⇒ ABO (orçamento nos conjuntos).
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  bidStrategy: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  revenue: number;
  /** Initiate Checkout atribuídos (visitantes distintos). NOSSO rastreamento. */
  ic: number;
  /** Cliques que chegaram ao site com UTM. NOSSO rastreamento — não confundir
   *  com `clicks`, que é o clique no anúncio reportado pela Meta. */
  cliquesAtribuidos: number;
  /** Vendas em QUALQUER status (pendente, aprovada, reembolsada…). NOSSO. */
  vendasIniciadas: number;
  /** Por dia, alinhada a `AdsOverview.dias`. Ver `SerieDaCampanha`. */
  serie: SerieDaCampanha;
}
export interface AdSetRow extends Omit<CampaignRow, "dailyBudget" | "serie"> {
  campaignId: string;
  campaignName: string;
  dailyBudget: number | null;
  /** Bid cap do conjunto (`bid_amount`). */
  bidAmount: number | null;
}
export interface AdRow extends Omit<CampaignRow, "dailyBudget" | "serie"> {
  campaignId: string;
  campaignName: string;
  adSetId: string;
  format: string;
  thumbnailUrl: string | null;
}
export interface AccountRow {
  id: string;
  fbAccountId: string;
  name: string;
  currency: string;
  tracking: boolean;
  campaigns: number;
  spend: number;
  revenue: number;
}

export interface AdsOverview {
  campaigns: CampaignRow[];
  adSets: AdSetRow[];
  ads: AdRow[];
  accounts: AccountRow[];
  /**
   * Os dias da janela, em ordem, no fuso do USUÁRIO — o eixo de toda
   * `SerieDaCampanha`. Vem uma vez, e não repetido em cada linha.
   */
  dias: string[];
}

/**
 * Janela do gerenciador, no fuso do usuário. Devolve o instante inicial (para
 * `Sale.timestamp`) e a chave do dia (para `DailyAdMetric.date`, que é
 * `@db.Date` e não pode ser comparada com um instante).
 */
/**
 * Janela do Gerenciador, da fonte ÚNICA (`lib/periodo.ts`).
 *
 * 🔴 **Agora tem as DUAS pontas.** O `rangeStart` que existia aqui devolvia só o
 * início e todo filtro era `timestamp >= start`, ou seja "do início até agora".
 * Isso funcionava porque os únicos períodos eram Hoje/7d/30d, que terminam hoje.
 * Com "Ontem" e "Mês passado" no seletor, aquilo traria **a janela escolhida mais
 * tudo o que veio depois** — "Mês passado" incluindo o mês atual.
 */
function janela(filters: AdsFilters, tz: string) {
  const agora = new Date();
  const j = janelaDoPeriodo(filters.period, tz, { from: filters.from, to: filters.to }, agora);
  return {
    start: dayStart(j.startKey, tz),
    // Janela que termina hoje fecha em "agora"; no passado, no fim do dia.
    end: j.endKey === dayKeyInTz(agora, tz) ? agora : dayEnd(j.endKey, tz),
    startKey: j.startKey,
    endKey: j.endKey,
  };
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}


export async function computeAdsOverview(userId: string, filters: AdsFilters): Promise<AdsOverview> {
  const tz = await getUserTimezone(userId);
  const { start, end, startKey, endKey } = janela(filters, tz);

  // Área ∩ filtro da tela. `null` = sem filtro.
  // Pertinência de área — ver `lib/areas/precedencia.ts`.
  const mapa = await carregarMapaDeAreas(userId);
  const areaAtiva = mapa.areaValida(filters.workspaceId);
  const contasDaArea = mapa.contasDaArea(areaAtiva);
  const contas =
    filters.account !== "todas"
      ? contasDaArea.includes(filters.account) ? [filters.account] : []
      : contasDaArea;

  // A LISTAGEM do Gerenciador é sempre por inclusão: uma campanha pertence a
  // uma conta concreta, e as contas da área são um conjunto fechado.
  const accountWhere = { id: { in: contas } };

  const [accounts, campaigns, adSets, ads, metrics, metricasDeSempre, sales, cliquesNossos] = await Promise.all([
    prisma.adAccount.findMany({
      where: { userId, ...accountWhere },
      select: { id: true, fbAccountId: true, name: true, currency: true, trackingEnabled: true },
      orderBy: { name: "asc" },
    }),
    prisma.campaign.findMany({
      where: { adAccount: { userId, ...accountWhere } },
      /* `objective` entrou em 07/08/2026 para o subtítulo `Objetivo | Plataforma`
         da tabela (`04`, CAMPANHAS). A coluna existe no schema desde sempre e o
         `sync.ts` a escreve — ela só não era PEDIDA aqui, então chegava
         `undefined` na tela sem nada acusar. É a armadilha do `pedidoId`, de
         novo: coluna fora do `select` não quebra `tsc`, `lint` nem `build`. */
      select: { id: true, fbCampaignId: true, name: true, status: true, effectiveStatus: true, objective: true, dailyBudget: true, lifetimeBudget: true, bidStrategy: true, adAccountId: true },
    }),
    prisma.adSet.findMany({
      where: { adAccount: { userId, ...accountWhere } },
      select: { id: true, fbAdSetId: true, name: true, status: true, effectiveStatus: true, dailyBudget: true, lifetimeBudget: true, bidAmount: true, adAccountId: true, campaignId: true },
    }),
    prisma.ad.findMany({
      where: { adAccount: { userId, ...accountWhere } },
      select: {
        id: true,
        fbAdId: true,
        name: true,
        status: true,
        effectiveStatus: true,
        adAccountId: true,
        campaignId: true,
        adSetId: true,
        creative: { select: { thumbnailUrl: true, videoId: true } },
      },
    }),
    prisma.dailyAdMetric.findMany({
      where: {
        date: { gte: keyToDateColumn(startKey), lte: keyToDateColumn(endKey) },
        ad: { adAccount: { userId, ...accountWhere } },
      },
      /* `date` entrou em 07/08/2026 para a série diária dos 5 KPIs. Ele já
         existe na linha e não era pedido — a mesma armadilha do `pedidoId`. */
      select: { adId: true, date: true, spend: true, impressions: true, clicks: true },
    }),
    /* Anúncios que têm métrica em ALGUMA janela — sem filtro de data.
     *
     * 🕳️ É o que separa "nunca sincronizou" de "não veiculou NESTE período", e
     * as duas pedem ação diferente: na primeira o usuário confere a integração,
     * na segunda não há o que fazer. Sem esta consulta as duas ficariam
     * indistinguíveis, e a tela daria a mesma resposta para os dois.
     *
     * ⚠️ `distinct` no `adId` e só ele no `select`: é uma pergunta de
     * EXISTÊNCIA, e trazer `spend` faria uma varredura do histórico inteiro
     * para responder sim/não. */
    prisma.dailyAdMetric.findMany({
      where: { ad: { adAccount: { userId, ...accountWhere } } },
      select: { adId: true },
      distinct: ["adId"],
    }),
    // TODAS as vendas do período (qualquer status). As aprovadas viram
    // `results`/`revenue`; o total vira `vendasIniciadas`. Uma consulta só —
    // buscar duas vezes com filtros diferentes custaria outro round-trip.
    prisma.sale.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
      },
      // `CAMPOS_UTM` nas duas pontas: a relação `click` é a fonte, as colunas na
      // venda são a cópia para quando o clique some (`clickId` é `SetNull`).
      // `timestamp` entrou em 07/08/2026, pelo mesmo motivo do `date` acima: é o
      // eixo da série diária. A janela da consulta NÃO mudou.
      select: { id: true, pedidoId: true, timestamp: true, value: true, status: true, product: true, webhookId: true, apiCredentialId: true, ...CAMPOS_UTM, click: { select: { ...CAMPOS_UTM, workspaceId: true } } },
    }),
    // Cliques rastreados por NÓS, atribuídos por UTM. Chegam ao banco no
    // instante do clique (via `t.js`), sem depender do Facebook.
    prisma.click.findMany({
      // ⚠️ `bot: false` — alimenta a coluna "Cliq. atr.", que é métrica.
      where: { userId, timestamp: { gte: start, lte: end }, bot: false },
      // `checkoutAt`: a coluna IC do Gerenciador passa a sair da JORNADA, não de
      // `PixelEvent`. Ver `lib/funil/checkoutDaJornada.ts`.
      select: { utmCampaign: true, utmContent: true, fbclid: true, workspaceId: true, checkoutAt: true },
    }),
  ]);

  // ── Pertinência de área ────────────────────────────────────────────────────
  //
  // As contas/campanhas já vêm recortadas pelo `accountWhere` (são ancoradas em
  // conta por FK). Venda, clique e IC não são: eles chegam pela atribuição, e é
  // aqui que a precedência decide de quem são.
  //
  // ⚠️ O IC saiu daqui: ele agora é uma coluna da JORNADA (`Click.checkoutAt`),
  // então a área dele é a área do próprio clique — não há mais mapa
  // `fbclid → clique` para montar, nem consulta de `PixelEvent` para fazer.
  const vendasDaArea = sales.filter((v) => mapa.areaDaVenda(v).areaId === areaAtiva);

  /**
   * ## IC do Gerenciador: sai da JORNADA, não de `PixelEvent`
   *
   * > ### 🔴 O join por `fbclid` PERDIA todo checkout de tráfego direto
   * > O código anterior era `if (!e.fbclid) continue`, seguido de uma consulta
   * > `Click where fbclid in (...)` para chegar aos UTMs. Como `fbclid` só existe
   * > para tráfego de anúncio do Facebook, **checkout de tráfego direto nunca
   * > chegava à coluna IC nem ao CPI** — e nada na tela dizia isso.
   *
   * Agora o clique JÁ traz `checkoutAt` e os UTMs na mesma linha: a atribuição é
   * direta, sem join, sem `fbclid`, e **com uma consulta a menos** ao banco.
   *
   * ⚠️ Continua sendo "uma jornada conta uma vez": a contagem é por linha de
   * `Click`, então quem clicou duas vezes no botão de compra segue valendo 1.
   *
   * ⚠️ Checkout SEM jornada (venda que não casou clique) fica de fora daqui, e
   * está certo: sem clique não há UTM, logo não há campanha a que atribuir. Ele
   * conta no funil do Dashboard, que é nível de conta. Por isso o total do
   * Gerenciador pode ser menor — mesma ressalva que já valia antes.
   */
  const icByCampaignId = new Map<string, number>();
  const icByCampaignName = new Map<string, number>();
  const icByContentId = new Map<string, number>();
  const icByContentName = new Map<string, number>();
  for (const c of cliquesNossos) {
    if (c.checkoutAt == null) continue;
    if (mapa.areaDoClique(c).areaId !== areaAtiva) continue;
    const camp = splitPipe(c.utmCampaign);
    const cont = splitPipe(c.utmContent);
    const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    if (camp.id) inc(icByCampaignId, camp.id);
    else if (camp.name) inc(icByCampaignName, camp.name.toLowerCase());
    if (cont.id) inc(icByContentId, cont.id);
    else if (cont.name) inc(icByContentName, cont.name.toLowerCase());
  }

  // Métricas por anúncio
  const metByAd = new Map<string, { spend: number; impressions: number; clicks: number }>();
  for (const m of metrics) {
    const cur = metByAd.get(m.adId) ?? { spend: 0, impressions: 0, clicks: 0 };
    cur.spend += num(m.spend);
    cur.impressions += m.impressions;
    cur.clicks += m.clicks;
    metByAd.set(m.adId, cur);
  }

  /* ── 📈 A SÉRIE DIÁRIA (aditiva, 07/08/2026) ────────────────────────────────
   *
   * Ver `SerieDaCampanha`. O eixo é o mesmo para todas as linhas e vem uma vez
   * em `AdsOverview.dias`.
   *
   * ⚠️ `dateColumnKey` e não `dayKeyInTz`: `DailyAdMetric.date` é `@db.Date` e
   * volta do banco como meia-noite UTC. Passá-lo pelo fuso do usuário o jogaria
   * para o dia anterior em todo fuso a oeste de Greenwich — que é o nosso.
   * A venda, essa sim, tem instante e vai pelo fuso.
   */
  const dias = dayKeyRange(startKey, endKey);
  const indiceDoDia = new Map(dias.map((d, i) => [d, i]));
  const zeros = () => new Array<number>(dias.length).fill(0);

  const campanhaDoAd = new Map(ads.map((a) => [a.id, a.campaignId]));
  const gastoPorDia = new Map<string, number[]>();
  for (const m of metrics) {
    const cid = campanhaDoAd.get(m.adId);
    if (!cid) continue;
    const i = indiceDoDia.get(dateColumnKey(m.date));
    if (i === undefined) continue;
    const serie = gastoPorDia.get(cid) ?? gastoPorDia.set(cid, zeros()).get(cid)!;
    serie[i] += num(m.spend);
  }

  /**
   * Receita e vendas por dia, na MESMA chave de atribuição do agregado
   * (`campId:<id>` ou `campNome:<nome>`).
   *
   * ⛔ Escrita DENTRO do `bump`, e não num laço próprio. A contagem de vendas é
   * por PEDIDO, e a dedup mora lá — um segundo laço teria de reimplementá-la,
   * e o dia em que as duas divergissem o sparkline mostraria um total diferente
   * do KPI logo acima dele, sem nada acusar.
   */
  const vendasPorDia = new Map<string, { revenue: number[]; results: number[] }>();
  const serieDoDestino = (destino: string) =>
    vendasPorDia.get(destino) ??
    vendasPorDia.set(destino, { revenue: zeros(), results: zeros() }).get(destino)!;

  // Atribuição por campanha: preferimos o id do Facebook extraído do
  // utm_campaign (`nome|id`, Bloco 11); caímos no nome para cliques antigos.
  interface Attr { results: number; revenue: number; iniciadas: number }
  const vazio = (): Attr => ({ results: 0, revenue: 0, iniciadas: 0 });
  const resultsByCampaignId = new Map<string, Attr>();
  const resultsByName = new Map<string, Attr>();
  const iniciadasByContentId = new Map<string, number>();
  const iniciadasByContentName = new Map<string, number>();

  // ⚠️ CONTAGEM POR PEDIDO, SOMA POR LINHA. `results` e `iniciadas` são
  // conversões — o CPA e o ROAS da tabela saem delas, e contar itens derrubaria
  // o CPA pela metade num checkout com order bump. `revenue` soma todas as
  // linhas, senão o faturamento do bump sumiria da campanha que o vendeu.
  //
  // O `Set` é por CHAVE DE MAPA, não global: a mesma venda pode ser atribuída a
  // uma campanha e a um anúncio, e um conjunto único faria a segunda atribuição
  // ser descartada.
  const pedidosPorChave = new Map<string, Set<string>>();
  const primeiraVezNoDestino = (destino: string, venda: { id: string; pedidoId?: string | null }) => {
    const chave = chaveDoPedido(venda);
    let vistos = pedidosPorChave.get(destino);
    if (!vistos) pedidosPorChave.set(destino, (vistos = new Set()));
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  };

  for (const s of vendasDaArea) {
    // 🔴 É daqui que saem ROAS e CPA por campanha. Apagar o clique não pode
    // zerar a linha: a cópia responde quando a relação já não existe.
    const { utms } = utmsDaVenda(s);
    const camp = splitPipe(utms.utmCampaign);
    const cont = splitPipe(utms.utmContent);
    const aprovada = s.status === "APROVADA";
    // Índice do dia DESTA venda na série. Fora da janela é impossível (a
    // consulta já recorta), mas `undefined` aqui não escreve nada em vez de
    // escrever na posição errada.
    const iDia = indiceDoDia.get(dayKeyInTz(s.timestamp, tz));
    const bump = (map: Map<string, Attr>, key: string, prefixo: string) => {
      const cur = map.get(key) ?? vazio();
      const nova = primeiraVezNoDestino(`${prefixo}:${key}`, s);
      if (nova) cur.iniciadas += 1; // conversão iniciada, em qualquer status
      if (aprovada) {
        if (nova) cur.results += 1;
        cur.revenue += num(s.value);
      }
      map.set(key, cur);
      // 📈 A série, com exatamente as mesmas condições da linha acima.
      if (iDia !== undefined && aprovada) {
        const serie = serieDoDestino(`${prefixo}:${key}`);
        serie.revenue[iDia] += num(s.value);
        if (nova) serie.results[iDia] += 1;
      }
    };
    if (camp.id) bump(resultsByCampaignId, camp.id, "campId");
    else if (camp.name) bump(resultsByName, camp.name.toLowerCase(), "campNome");
    // Nível de anúncio: atribuição por utm_content.
    const incC = (m: Map<string, number>, k: string, prefixo: string) => {
      if (primeiraVezNoDestino(`${prefixo}:${k}`, s)) m.set(k, (m.get(k) ?? 0) + 1);
    };
    if (cont.id) incC(iniciadasByContentId, cont.id, "contId");
    else if (cont.name) incC(iniciadasByContentName, cont.name.toLowerCase(), "contNome");
  }

  // Cliques rastreados por nós, pelos mesmos dois caminhos de atribuição.
  const cliquesByCampaignId = new Map<string, number>();
  const cliquesByCampaignName = new Map<string, number>();
  const cliquesByContentId = new Map<string, number>();
  const cliquesByContentName = new Map<string, number>();
  // O clique tem UTM próprio: a área dele é decidida pela mesma regra da venda.
  const cliquesDaArea = cliquesNossos.filter((c) => mapa.areaDoClique(c).areaId === areaAtiva);
  for (const c of cliquesDaArea) {
    const camp = splitPipe(c.utmCampaign);
    const cont = splitPipe(c.utmContent);
    const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    if (camp.id) inc(cliquesByCampaignId, camp.id);
    else if (camp.name) inc(cliquesByCampaignName, camp.name.toLowerCase());
    if (cont.id) inc(cliquesByContentId, cont.id);
    else if (cont.name) inc(cliquesByContentName, cont.name.toLowerCase());
  }

  /* O objetivo do anúncio e do conjunto é o da CAMPANHA deles — a Meta só o
     define nesse nível. Herdar aqui é o que permite os três níveis mostrarem o
     mesmo subtítulo sem cada um consultar o banco de novo.

     🔴 A DECLARAÇÃO FICA AQUI, ANTES DE `adRows`, e isso não é estilo. Eu a
     escrevi junto do `campaignNameById`, 50 linhas ABAIXO — `const` em zona
     morta temporal, e `adRows.map` estourava `Cannot access
     'campaignObjectiveById' before initialization` em toda carga do
     Gerenciador.

     ⚠️ `tsc`, `lint` e `build` passaram os três: TDZ é erro de execução, não de
     tipo. Só a tela mostrou — a tabela ficou em "Carregando…" e a `/api/ads`
     devolvia 500 com corpo vazio.

     ⚠️ E a saída já estava escrita ao lado: `campaignName` resolve o MESMO
     problema com um pós-passe (`for (const a of adRows)`, no fim da função),
     justamente porque o mapa não existe no momento do `.map()`. */
  const campaignObjectiveById = new Map(campaigns.map((c) => [c.id, c.objective]));

  /* ── 🕳️ OS TRÊS ESTADOS DE MEDIÇÃO ──────────────────────────────────────────
   *
   * Derivado de FATO sobre existência de linha, nunca de um número: `spend > 0`
   * como discriminador colapsaria "gastou zero" em "não mediu", que é
   * exatamente o defeito. Os conjuntos abaixo respondem sim/não.
   *
   * ⛔ `sumAds` continua reduzindo a partir de `{ spend: 0 }` e NÃO foi
   * alterado — ele é anterior a `4e6aa9e` e está congelado. O que nasce aqui é
   * um fato ao LADO do número, para a apresentação decidir o que afirmar. */
  const adsComMetricaNaJanela = new Set(metrics.map((m) => m.adId));
  const adsComMetricaAlgumDia = new Set(metricasDeSempre.map((m) => m.adId));
  const adsDaCampanha = new Map<string, string[]>();
  for (const a of ads) {
    const lista = adsDaCampanha.get(a.campaignId);
    if (lista) lista.push(a.id);
    else adsDaCampanha.set(a.campaignId, [a.id]);
  }

  /**
   * ⛔ CADA NÍVEL RESPONDE SOBRE SI, não sobre a campanha acima.
   *
   * A primeira versão passava os anúncios DA CAMPANHA junto do `effectiveStatus`
   * DO FILHO — e o teste pegou: o conjunto de uma campanha nunca sincronizada
   * saía `sem-veiculacao`, porque o `effectiveStatus` dele próprio não era nulo.
   * Misturar o escopo de uma metade com o da outra dá uma resposta que não é
   * verdadeira sobre nenhum dos dois.
   *
   * Então o chamador entrega os anúncios que a linha DELE cobre: a campanha
   * entrega os seus, o conjunto os dele, o anúncio a si mesmo.
   */
  const medicaoDe = (adIds: string[], effectiveStatus: string | null): Medicao => {
    if (adIds.some((id) => adsComMetricaNaJanela.has(id))) return "medida";
    /* Sincronizou alguma vez? Duas evidências independentes, e basta uma:
       a Meta já reportou veiculação (`effectiveStatus`), ou já houve gasto em
       alguma janela. Uma campanha recém-criada e sincronizada tem a primeira e
       não a segunda — e ela É "sem veiculação", não "nunca sincronizada":
       o usuário não tem o que conferir na integração. */
    const conversouComAMeta =
      effectiveStatus !== null || adIds.some((id) => adsComMetricaAlgumDia.has(id));
    return conversouComAMeta ? "sem-veiculacao" : "nunca-sincronizada";
  };

  const adsDoConjunto = new Map<string, string[]>();
  for (const a of ads) {
    const lista = adsDoConjunto.get(a.adSetId);
    if (lista) lista.push(a.id);
    else adsDoConjunto.set(a.adSetId, [a.id]);
  }

  // Anúncios
  const adRows: AdRow[] = ads.map((a) => {
    const met = metByAd.get(a.id) ?? { spend: 0, impressions: 0, clicks: 0 };
    return {
      // Orçamento/lance não existem no nível de anúncio na Meta.
      lifetimeBudget: null,
      bidStrategy: null,
      objective: campaignObjectiveById.get(a.campaignId) ?? null,
      medicao: medicaoDe([a.id], a.effectiveStatus),
      id: a.id,
      fbId: a.fbAdId,
      name: a.name,
      status: a.status,
      effectiveStatus: a.effectiveStatus,
      accountId: a.adAccountId,
      campaignId: a.campaignId,
      campaignName: "",
      adSetId: a.adSetId,
      format: a.creative?.videoId ? "Vídeo" : "Imagem",
      thumbnailUrl: a.creative?.thumbnailUrl ?? null,
      spend: met.spend,
      impressions: met.impressions,
      clicks: met.clicks,
      results: 0,
      revenue: 0,
      // IC do anúncio vem do utm_content (`nome|id`), somando id + nome como a
      // atribuição de vendas: cada visitante cai em só um dos dois mapas.
      ic: (icByContentId.get(a.fbAdId) ?? 0) + (icByContentName.get(a.name.toLowerCase()) ?? 0),
      cliquesAtribuidos:
        (cliquesByContentId.get(a.fbAdId) ?? 0) + (cliquesByContentName.get(a.name.toLowerCase()) ?? 0),
      vendasIniciadas:
        (iniciadasByContentId.get(a.fbAdId) ?? 0) + (iniciadasByContentName.get(a.name.toLowerCase()) ?? 0),
    };
  });

  // Agrega anúncios → conjuntos e → campanhas
  const adsByAdSet = new Map<string, AdRow[]>();
  const adsByCampaign = new Map<string, AdRow[]>();
  for (const a of adRows) {
    (adsByAdSet.get(a.adSetId) ?? adsByAdSet.set(a.adSetId, []).get(a.adSetId)!).push(a);
    (adsByCampaign.get(a.campaignId) ?? adsByCampaign.set(a.campaignId, []).get(a.campaignId)!).push(a);
  }
  const sumAds = (list: AdRow[] = []) =>
    list.reduce(
      (acc, a) => ({
        spend: acc.spend + a.spend,
        impressions: acc.impressions + a.impressions,
        clicks: acc.clicks + a.clicks,
        ic: acc.ic + a.ic,
        cliquesAtribuidos: acc.cliquesAtribuidos + a.cliquesAtribuidos,
        vendasIniciadas: acc.vendasIniciadas + a.vendasIniciadas,
      }),
      { spend: 0, impressions: 0, clicks: 0, ic: 0, cliquesAtribuidos: 0, vendasIniciadas: 0 },
    );

  const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));

  /* Soma elemento a elemento as séries dos DOIS caminhos de atribuição (id e
     nome), do mesmo jeito que o agregado soma `byId` e `byName` logo abaixo.
     Cada venda cai em só um dos dois, então a soma não conta duas vezes. */
  const somarSeries = (...listas: (number[] | undefined)[]): number[] =>
    listas.reduce<number[]>(
      (acc, l) => (l ? acc.map((x, i) => x + (l[i] ?? 0)) : acc),
      zeros(),
    );

  const campaignRows: CampaignRow[] = campaigns.map((c) => {
    const agg = sumAds(adsByCampaign.get(c.id));
    // Soma id + nome: cada venda está em só um dos mapas (ver creatives.ts).
    const byId = resultsByCampaignId.get(c.fbCampaignId);
    const byName = resultsByName.get(c.name.toLowerCase());
    const attr = {
      results: (byId?.results ?? 0) + (byName?.results ?? 0),
      revenue: (byId?.revenue ?? 0) + (byName?.revenue ?? 0),
      iniciadas: (byId?.iniciadas ?? 0) + (byName?.iniciadas ?? 0),
    };
    return {
      id: c.id,
      fbId: c.fbCampaignId,
      name: c.name,
      status: c.status,
      objective: c.objective,
      medicao: medicaoDe(adsDaCampanha.get(c.id) ?? [], c.effectiveStatus),
      effectiveStatus: c.effectiveStatus,
      accountId: c.adAccountId,
      dailyBudget: c.dailyBudget != null ? num(c.dailyBudget) : null,
      lifetimeBudget: c.lifetimeBudget != null ? num(c.lifetimeBudget) : null,
      bidStrategy: c.bidStrategy ?? null,
      spend: agg.spend,
      impressions: agg.impressions,
      clicks: agg.clicks,
      results: attr.results,
      revenue: attr.revenue,
      // Na campanha o IC vem do utm_campaign; se nada casar, cai na soma dos
      // anúncios (que atribuem por utm_content).
      ic:
        (icByCampaignId.get(c.fbCampaignId) ?? 0) + (icByCampaignName.get(c.name.toLowerCase()) ?? 0) ||
        agg.ic,
      cliquesAtribuidos:
        (cliquesByCampaignId.get(c.fbCampaignId) ?? 0) +
          (cliquesByCampaignName.get(c.name.toLowerCase()) ?? 0) || agg.cliquesAtribuidos,
      vendasIniciadas: attr.iniciadas || agg.vendasIniciadas,
      serie: {
        spend: gastoPorDia.get(c.id) ?? zeros(),
        revenue: somarSeries(
          vendasPorDia.get(`campId:${c.fbCampaignId}`)?.revenue,
          vendasPorDia.get(`campNome:${c.name.toLowerCase()}`)?.revenue,
        ),
        results: somarSeries(
          vendasPorDia.get(`campId:${c.fbCampaignId}`)?.results,
          vendasPorDia.get(`campNome:${c.name.toLowerCase()}`)?.results,
        ),
      },
    };
  });

  const adSetRows: AdSetRow[] = adSets.map((a) => {
    const agg = sumAds(adRows.filter((ad) => ad.adSetId === a.id));
    return {
      id: a.id,
      fbId: a.fbAdSetId,
      name: a.name,
      status: a.status,
      effectiveStatus: a.effectiveStatus,
      objective: campaignObjectiveById.get(a.campaignId) ?? null,
      medicao: medicaoDe(adsDoConjunto.get(a.id) ?? [], a.effectiveStatus),
      accountId: a.adAccountId,
      campaignId: a.campaignId,
      campaignName: campaignNameById.get(a.campaignId) ?? "",
      dailyBudget: a.dailyBudget != null ? num(a.dailyBudget) : null,
      lifetimeBudget: a.lifetimeBudget != null ? num(a.lifetimeBudget) : null,
      bidAmount: a.bidAmount != null ? num(a.bidAmount) : null,
      bidStrategy: null,
      spend: agg.spend,
      impressions: agg.impressions,
      clicks: agg.clicks,
      results: 0,
      revenue: 0,
      // Conjunto não tem UTM próprio: soma o dos anúncios dele.
      ic: agg.ic,
      cliquesAtribuidos: agg.cliquesAtribuidos,
      vendasIniciadas: agg.vendasIniciadas,
    };
  });

  for (const a of adRows) a.campaignName = campaignNameById.get(a.campaignId) ?? "";

  // Contas (totais agregados)
  const accountRows: AccountRow[] = accounts.map((ac) => {
    const camps = campaignRows.filter((c) => c.accountId === ac.id);
    return {
      id: ac.id,
      fbAccountId: ac.fbAccountId,
      name: ac.name,
      currency: ac.currency,
      tracking: ac.trackingEnabled,
      campaigns: camps.length,
      spend: camps.reduce((s, c) => s + c.spend, 0),
      revenue: camps.reduce((s, c) => s + c.revenue, 0),
    };
  });

  // Filtros de status + busca (contas sempre completas)
  const search = filters.search.trim().toLowerCase();
  // ⚠️ O filtro de STATUS é do CLIENTE, não daqui.
  //
  // O painel manda só `period` e `account` na querystring — status e busca são
  // aplicados no navegador para trocar de filtro não custar um round-trip. Ou
  // seja: `filters.status` chega SEMPRE como o padrão "todos".
  //
  // Enquanto "todos" significava "tudo", filtrar aqui era inofensivo. Quando
  // "todos" passou a excluir arquivados, este filtro virou uma peneira que
  // descartava as 12 campanhas arquivadas ANTES de saírem do servidor — e a
  // opção "Arquivados" da tela passou a filtrar uma lista já vazia.
  //
  // O servidor manda tudo; quem decide o que aparece é `lib/ads/status.ts` no
  // cliente. Se um dia o status voltar a ser filtrado aqui, ele PRECISA vir na
  // querystring junto.
  const byFilters = <T extends { name: string; status: string }>(rows: T[]) =>
    rows.filter((r) => !search || r.name.toLowerCase().includes(search));

  return {
    campaigns: byFilters(campaignRows),
    adSets: byFilters(adSetRows),
    ads: byFilters(adRows),
    accounts: accountRows,
    dias,
  };
}
