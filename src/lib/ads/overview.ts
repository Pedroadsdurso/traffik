import { filtroEfetivo } from "@/lib/ads/escopo";
import { getUserTimezone } from "@/lib/userTimezone";
import { prisma } from "@/lib/prisma";
import { addDaysToKey, dayStart, keyToDateColumn, todayKey } from "@/lib/timezone";
import { splitPipe } from "@/lib/utm/parse";

export interface AdsFilters {
  period: "hoje" | "7d" | "30d";
  account: string; // "todas" ou AdAccount.id
  status: string; // "todos" | "ativo" | "pausado"
  search: string;
  /**
   * Filtros BASE da Área de Trabalho, carregados no servidor a partir do `?ws=`.
   * Mesma convenção do Dashboard: lista vazia/ausente = não filtra, e o filtro
   * da TELA age DENTRO destes (interseção via `filtroEfetivo`).
   */
  accounts?: string[];
  products?: string[];
  sources?: string[];
  webhooks?: string[];
  pixelConfigs?: string[];
  /** Exclusões da área principal (catch-all). Ver `lib/ads/escopo.ts`. */
  excluirAccounts?: string[];
  excluirProducts?: string[];
  excluirWebhooks?: string[];
  excluirPixelConfigs?: string[];
}

export interface CampaignRow {
  id: string;
  fbId: string;
  name: string;
  status: string;
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
}
export interface AdSetRow extends Omit<CampaignRow, "dailyBudget"> {
  campaignId: string;
  campaignName: string;
  dailyBudget: number | null;
  /** Bid cap do conjunto (`bid_amount`). */
  bidAmount: number | null;
}
export interface AdRow extends Omit<CampaignRow, "dailyBudget"> {
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
}

/**
 * Janela do gerenciador, no fuso do usuário. Devolve o instante inicial (para
 * `Sale.timestamp`) e a chave do dia (para `DailyAdMetric.date`, que é
 * `@db.Date` e não pode ser comparada com um instante).
 */
function rangeStart(period: AdsFilters["period"], tz: string): { start: Date; startKey: string } {
  const hoje = todayKey(tz);
  const startKey = period === "hoje" ? hoje : addDaysToKey(hoje, -((period === "30d" ? 30 : 7) - 1));
  return { start: dayStart(startKey, tz), startKey };
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}


export async function computeAdsOverview(userId: string, filters: AdsFilters): Promise<AdsOverview> {
  const tz = await getUserTimezone(userId);
  const { start, startKey } = rangeStart(filters.period, tz);

  // Área ∩ filtro da tela. `null` = sem filtro.
  const contas = filtroEfetivo(filters.accounts, filters.account, "todas");
  const produtos = filters.products?.length ? filters.products : null;
  const fontes = filters.sources?.length ? filters.sources : null;
  const webhooks = filters.webhooks?.length ? filters.webhooks : null;
  const pixelConfigs = filters.pixelConfigs?.length ? filters.pixelConfigs : null;
  // `contas` já é a interseção: quando a área restringe e a tela escolhe uma
  // conta de fora dela, `filtroEfetivo` devolve `[]` e nada aparece — que é o
  // correto, e não "cai no filtro da tela".
  const exContas = filters.excluirAccounts?.length ? filters.excluirAccounts : null;
  const exWebhooks = filters.excluirWebhooks?.length ? filters.excluirWebhooks : null;
  const exPixels = filters.excluirPixelConfigs?.length ? filters.excluirPixelConfigs : null;
  const exProdutos = filters.excluirProducts?.length ? filters.excluirProducts : null;
  // `notIn` sozinho descartaria a linha de coluna NULA — e é a venda sem
  // webhook / o evento sem pixel que precisam SOBRAR no catch-all.
  const foraDoWebhook = exWebhooks ? { OR: [{ webhookId: null }, { webhookId: { notIn: exWebhooks } }] } : {};
  const foraDoPixel = exPixels ? { OR: [{ pixelConfigId: null }, { pixelConfigId: { notIn: exPixels } }] } : {};
  // A LISTAGEM do Gerenciador é sempre por inclusão: uma linha de campanha
  // pertence a uma conta concreta, então "excluir as contas das outras áreas"
  // vira "mostrar as demais".
  const accountWhere = contas
    ? { id: { in: contas } }
    : exContas
      ? { id: { notIn: exContas } }
      : {};

  const [accounts, campaigns, adSets, ads, metrics, sales, cliquesNossos, icEvents] = await Promise.all([
    prisma.adAccount.findMany({
      where: { userId, ...accountWhere },
      select: { id: true, fbAccountId: true, name: true, currency: true, trackingEnabled: true },
      orderBy: { name: "asc" },
    }),
    prisma.campaign.findMany({
      where: { adAccount: { userId, ...accountWhere } },
      select: { id: true, fbCampaignId: true, name: true, status: true, dailyBudget: true, lifetimeBudget: true, bidStrategy: true, adAccountId: true },
    }),
    prisma.adSet.findMany({
      where: { adAccount: { userId, ...accountWhere } },
      select: { id: true, fbAdSetId: true, name: true, status: true, dailyBudget: true, lifetimeBudget: true, bidAmount: true, adAccountId: true, campaignId: true },
    }),
    prisma.ad.findMany({
      where: { adAccount: { userId, ...accountWhere } },
      select: {
        id: true,
        fbAdId: true,
        name: true,
        status: true,
        adAccountId: true,
        campaignId: true,
        adSetId: true,
        creative: { select: { thumbnailUrl: true, videoId: true } },
      },
    }),
    prisma.dailyAdMetric.findMany({
      where: { date: { gte: keyToDateColumn(startKey) }, ad: { adAccount: { userId, ...accountWhere } } },
      select: { adId: true, spend: true, impressions: true, clicks: true },
    }),
    // TODAS as vendas do período (qualquer status). As aprovadas viram
    // `results`/`revenue`; o total vira `vendasIniciadas`. Uma consulta só —
    // buscar duas vezes com filtros diferentes custaria outro round-trip.
    prisma.sale.findMany({
      where: {
        userId,
        timestamp: { gte: start },
        ...(produtos ? { product: { in: produtos } } : {}),
        ...(webhooks ? { webhookId: { in: webhooks } } : {}),
        ...(fontes ? { click: { is: { utmSource: { in: fontes } } } } : {}),
        ...(exProdutos ? { product: { notIn: exProdutos } } : {}),
        ...foraDoWebhook,
      },
      select: { value: true, status: true, click: { select: { utmCampaign: true, utmContent: true } } },
    }),
    // Cliques rastreados por NÓS, atribuídos por UTM. Chegam ao banco no
    // instante do clique (via `t.js`), sem depender do Facebook.
    prisma.click.findMany({
      where: { userId, timestamp: { gte: start }, ...(fontes ? { utmSource: { in: fontes } } : {}) },
      select: { utmCampaign: true, utmContent: true },
    }),
    // Initiate Checkout do período. O evento não carrega campanha, mas carrega
    // o `fbclid` — e é por ele que se chega ao `Click`, que tem os UTMs. É o
    // mesmo caminho de atribuição das vendas, só que via fbclid em vez da FK.
    prisma.pixelEvent.findMany({
      where: {
        userId,
        event: "InitiateCheckout",
        timestamp: { gte: start },
        ...(pixelConfigs ? { pixelConfigId: { in: pixelConfigs } } : {}),
        ...foraDoPixel,
      },
      select: { id: true, fbclid: true, eventId: true },
    }),
  ]);

  // Um IC = um VISITANTE distinto, não um evento: o `px.js` dispara a cada
  // clique no link de checkout, e quem clica duas vezes gerava dois eventos.
  const icPorFbclid = new Map<string, Set<string>>();
  for (const e of icEvents) {
    if (!e.fbclid) continue; // sem fbclid não há como ligar a uma campanha
    const visitante = e.fbclid;
    const set = icPorFbclid.get(visitante) ?? new Set<string>();
    set.add(e.eventId || `row:${e.id}`);
    icPorFbclid.set(visitante, set);
  }

  const fbclids = [...icPorFbclid.keys()];
  const cliquesDoIc = fbclids.length
    ? await prisma.click.findMany({
        where: { userId, fbclid: { in: fbclids } },
        select: { fbclid: true, utmCampaign: true, utmContent: true },
      })
    : [];

  // fbclid → campanha/anúncio. Cada visitante conta UMA vez por campanha.
  const icByCampaignId = new Map<string, number>();
  const icByCampaignName = new Map<string, number>();
  const icByContentId = new Map<string, number>();
  const icByContentName = new Map<string, number>();
  const jaContado = new Set<string>();
  for (const c of cliquesDoIc) {
    if (!c.fbclid || jaContado.has(c.fbclid)) continue;
    jaContado.add(c.fbclid);
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

  // Atribuição por campanha: preferimos o id do Facebook extraído do
  // utm_campaign (`nome|id`, Bloco 11); caímos no nome para cliques antigos.
  interface Attr { results: number; revenue: number; iniciadas: number }
  const vazio = (): Attr => ({ results: 0, revenue: 0, iniciadas: 0 });
  const resultsByCampaignId = new Map<string, Attr>();
  const resultsByName = new Map<string, Attr>();
  const iniciadasByContentId = new Map<string, number>();
  const iniciadasByContentName = new Map<string, number>();

  for (const s of sales) {
    const camp = splitPipe(s.click?.utmCampaign);
    const cont = splitPipe(s.click?.utmContent);
    const aprovada = s.status === "APROVADA";
    const bump = (map: Map<string, Attr>, key: string) => {
      const cur = map.get(key) ?? vazio();
      cur.iniciadas += 1; // toda venda conta como iniciada, independente do status
      if (aprovada) {
        cur.results += 1;
        cur.revenue += num(s.value);
      }
      map.set(key, cur);
    };
    if (camp.id) bump(resultsByCampaignId, camp.id);
    else if (camp.name) bump(resultsByName, camp.name.toLowerCase());
    // Nível de anúncio: atribuição por utm_content.
    const incC = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    if (cont.id) incC(iniciadasByContentId, cont.id);
    else if (cont.name) incC(iniciadasByContentName, cont.name.toLowerCase());
  }

  // Cliques rastreados por nós, pelos mesmos dois caminhos de atribuição.
  const cliquesByCampaignId = new Map<string, number>();
  const cliquesByCampaignName = new Map<string, number>();
  const cliquesByContentId = new Map<string, number>();
  const cliquesByContentName = new Map<string, number>();
  for (const c of cliquesNossos) {
    const camp = splitPipe(c.utmCampaign);
    const cont = splitPipe(c.utmContent);
    const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    if (camp.id) inc(cliquesByCampaignId, camp.id);
    else if (camp.name) inc(cliquesByCampaignName, camp.name.toLowerCase());
    if (cont.id) inc(cliquesByContentId, cont.id);
    else if (cont.name) inc(cliquesByContentName, cont.name.toLowerCase());
  }

  // Anúncios
  const adRows: AdRow[] = ads.map((a) => {
    const met = metByAd.get(a.id) ?? { spend: 0, impressions: 0, clicks: 0 };
    return {
      // Orçamento/lance não existem no nível de anúncio na Meta.
      lifetimeBudget: null,
      bidStrategy: null,
      id: a.id,
      fbId: a.fbAdId,
      name: a.name,
      status: a.status,
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
    };
  });

  const adSetRows: AdSetRow[] = adSets.map((a) => {
    const agg = sumAds(adRows.filter((ad) => ad.adSetId === a.id));
    return {
      id: a.id,
      fbId: a.fbAdSetId,
      name: a.name,
      status: a.status,
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
  };
}
