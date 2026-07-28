import { getUserTimezone } from "@/lib/userTimezone";
import { prisma } from "@/lib/prisma";
import { addDaysToKey, dayStart, keyToDateColumn, todayKey } from "@/lib/timezone";
import { splitPipe } from "@/lib/utm/parse";

export interface AdsFilters {
  period: "hoje" | "7d" | "30d";
  account: string; // "todas" ou AdAccount.id
  status: string; // "todos" | "ativo" | "pausado"
  search: string;
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
  /** Initiate Checkout atribuídos (visitantes distintos). */
  ic: number;
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

function matchesStatus(status: string, filter: string): boolean {
  if (filter === "ativo") return status === "ACTIVE";
  if (filter === "pausado") return status !== "ACTIVE";
  return true;
}

export async function computeAdsOverview(userId: string, filters: AdsFilters): Promise<AdsOverview> {
  const tz = await getUserTimezone(userId);
  const { start, startKey } = rangeStart(filters.period, tz);
  const accountWhere = filters.account !== "todas" ? { id: filters.account } : {};

  const [accounts, campaigns, adSets, ads, metrics, sales, icEvents] = await Promise.all([
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
    // Vendas aprovadas no período, para atribuir resultados por utm_campaign → nome da campanha.
    prisma.sale.findMany({
      where: { userId, status: "APROVADA", timestamp: { gte: start } },
      select: { value: true, click: { select: { utmCampaign: true } } },
    }),
    // Initiate Checkout do período. O evento não carrega campanha, mas carrega
    // o `fbclid` — e é por ele que se chega ao `Click`, que tem os UTMs. É o
    // mesmo caminho de atribuição das vendas, só que via fbclid em vez da FK.
    prisma.pixelEvent.findMany({
      where: { userId, event: "InitiateCheckout", timestamp: { gte: start } },
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
  const resultsByCampaignId = new Map<string, { results: number; revenue: number }>();
  const resultsByName = new Map<string, { results: number; revenue: number }>();
  for (const s of sales) {
    const { name, id } = splitPipe(s.click?.utmCampaign);
    const bump = (map: Map<string, { results: number; revenue: number }>, key: string) => {
      const cur = map.get(key) ?? { results: 0, revenue: 0 };
      cur.results += 1;
      cur.revenue += num(s.value);
      map.set(key, cur);
    };
    if (id) bump(resultsByCampaignId, id);
    else if (name) bump(resultsByName, name.toLowerCase());
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
      }),
      { spend: 0, impressions: 0, clicks: 0, ic: 0 },
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
      // Conjunto não tem UTM próprio: soma o IC dos anúncios dele.
      ic: agg.ic,
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
  const byFilters = <T extends { name: string; status: string }>(rows: T[]) =>
    rows.filter((r) => matchesStatus(r.status, filters.status) && (!search || r.name.toLowerCase().includes(search)));

  return {
    campaigns: byFilters(campaignRows),
    adSets: byFilters(adSetRows),
    ads: byFilters(adRows),
    accounts: accountRows,
  };
}
