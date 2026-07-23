import { prisma } from "@/lib/prisma";

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
  dailyBudget: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  revenue: number;
}
export interface AdSetRow extends Omit<CampaignRow, "dailyBudget"> {
  campaignId: string;
  campaignName: string;
  dailyBudget: number | null;
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

function rangeStart(period: AdsFilters["period"]): Date {
  if (period === "hoje") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const days = period === "30d" ? 30 : 7;
  return new Date(Date.now() - days * 864e5);
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
  const start = rangeStart(filters.period);
  const accountWhere = filters.account !== "todas" ? { id: filters.account } : {};

  const [accounts, campaigns, adSets, ads, metrics, sales] = await Promise.all([
    prisma.adAccount.findMany({
      where: { userId, ...accountWhere },
      select: { id: true, fbAccountId: true, name: true, currency: true, trackingEnabled: true },
      orderBy: { name: "asc" },
    }),
    prisma.campaign.findMany({
      where: { adAccount: { userId, ...accountWhere } },
      select: { id: true, fbCampaignId: true, name: true, status: true, dailyBudget: true, adAccountId: true },
    }),
    prisma.adSet.findMany({
      where: { adAccount: { userId, ...accountWhere } },
      select: { id: true, fbAdSetId: true, name: true, status: true, dailyBudget: true, adAccountId: true, campaignId: true },
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
      where: { date: { gte: new Date(start.toDateString()) }, ad: { adAccount: { userId, ...accountWhere } } },
      select: { adId: true, spend: true, impressions: true, clicks: true },
    }),
    // Vendas aprovadas no período, para atribuir resultados por utm_campaign → nome da campanha.
    prisma.sale.findMany({
      where: { userId, status: "APROVADA", timestamp: { gte: start } },
      select: { value: true, click: { select: { utmCampaign: true } } },
    }),
  ]);

  // Métricas por anúncio
  const metByAd = new Map<string, { spend: number; impressions: number; clicks: number }>();
  for (const m of metrics) {
    const cur = metByAd.get(m.adId) ?? { spend: 0, impressions: 0, clicks: 0 };
    cur.spend += num(m.spend);
    cur.impressions += m.impressions;
    cur.clicks += m.clicks;
    metByAd.set(m.adId, cur);
  }

  // Resultados por nome de campanha (atribuição best-effort via utm_campaign)
  const resultsByName = new Map<string, { results: number; revenue: number }>();
  for (const s of sales) {
    const name = s.click?.utmCampaign;
    if (!name) continue;
    const key = name.toLowerCase();
    const cur = resultsByName.get(key) ?? { results: 0, revenue: 0 };
    cur.results += 1;
    cur.revenue += num(s.value);
    resultsByName.set(key, cur);
  }

  // Anúncios
  const adRows: AdRow[] = ads.map((a) => {
    const met = metByAd.get(a.id) ?? { spend: 0, impressions: 0, clicks: 0 };
    return {
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
      }),
      { spend: 0, impressions: 0, clicks: 0 },
    );

  const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));

  const campaignRows: CampaignRow[] = campaigns.map((c) => {
    const agg = sumAds(adsByCampaign.get(c.id));
    const attr = resultsByName.get(c.name.toLowerCase()) ?? { results: 0, revenue: 0 };
    return {
      id: c.id,
      fbId: c.fbCampaignId,
      name: c.name,
      status: c.status,
      accountId: c.adAccountId,
      dailyBudget: c.dailyBudget != null ? num(c.dailyBudget) : null,
      spend: agg.spend,
      impressions: agg.impressions,
      clicks: agg.clicks,
      results: attr.results,
      revenue: attr.revenue,
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
      spend: agg.spend,
      impressions: agg.impressions,
      clicks: agg.clicks,
      results: 0,
      revenue: 0,
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
