import { prisma } from "@/lib/prisma";

export type CreativePeriod = "hoje" | "7d" | "30d";
export type CreativeSort = "roas" | "ctr" | "spend" | "sales";

export interface CreativeRow {
  id: string;
  name: string;
  campaign: string;
  thumbnailUrl: string | null;
  format: string;
  ctr: number;
  roas: number;
  spend: number;
  sales: number;
  revenue: number;
  best: boolean;
}

function rangeStart(period: CreativePeriod): Date {
  if (period === "hoje") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(Date.now() - (period === "30d" ? 30 : 7) * 864e5);
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

export async function computeCreatives(
  userId: string,
  opts: { period: CreativePeriod; sort: CreativeSort },
): Promise<CreativeRow[]> {
  const start = rangeStart(opts.period);

  const [ads, metrics, sales] = await Promise.all([
    prisma.ad.findMany({
      where: { adAccount: { userId }, creative: { isNot: null } },
      select: {
        id: true,
        name: true,
        campaign: { select: { name: true } },
        creative: { select: { name: true, title: true, thumbnailUrl: true, imageUrl: true, videoId: true } },
      },
    }),
    prisma.dailyAdMetric.findMany({
      where: { date: { gte: new Date(start.toDateString()) }, ad: { adAccount: { userId } } },
      select: { adId: true, spend: true, impressions: true, clicks: true },
    }),
    // Vendas aprovadas no período; atribuídas ao anúncio por utm_content → nome.
    prisma.sale.findMany({
      where: { userId, status: "APROVADA", timestamp: { gte: start } },
      select: { value: true, click: { select: { utmContent: true } } },
    }),
  ]);

  const metByAd = new Map<string, { spend: number; impressions: number; clicks: number }>();
  for (const m of metrics) {
    const cur = metByAd.get(m.adId) ?? { spend: 0, impressions: 0, clicks: 0 };
    cur.spend += num(m.spend);
    cur.impressions += m.impressions;
    cur.clicks += m.clicks;
    metByAd.set(m.adId, cur);
  }

  const salesByContent = new Map<string, { sales: number; revenue: number }>();
  for (const s of sales) {
    const key = s.click?.utmContent?.toLowerCase();
    if (!key) continue;
    const cur = salesByContent.get(key) ?? { sales: 0, revenue: 0 };
    cur.sales += 1;
    cur.revenue += num(s.value);
    salesByContent.set(key, cur);
  }

  const rows: CreativeRow[] = ads.map((a) => {
    const met = metByAd.get(a.id) ?? { spend: 0, impressions: 0, clicks: 0 };
    const attr = salesByContent.get(a.name.toLowerCase()) ?? { sales: 0, revenue: 0 };
    const ctr = met.impressions ? (met.clicks / met.impressions) * 100 : 0;
    const roas = met.spend ? attr.revenue / met.spend : 0;
    return {
      id: a.id,
      name: a.creative?.title || a.creative?.name || a.name,
      campaign: a.campaign?.name ?? "—",
      thumbnailUrl: a.creative?.thumbnailUrl ?? a.creative?.imageUrl ?? null,
      format: a.creative?.videoId ? "Vídeo" : "Imagem",
      ctr,
      roas,
      spend: met.spend,
      sales: attr.sales,
      revenue: attr.revenue,
      best: false,
    };
  });

  // "Melhor do dia" = maior ROAS entre os que tiveram gasto.
  let bestId: string | null = null;
  let bestRoas = 0;
  for (const r of rows) {
    if (r.spend > 0 && r.roas > bestRoas) {
      bestRoas = r.roas;
      bestId = r.id;
    }
  }
  if (bestId) rows.find((r) => r.id === bestId)!.best = true;

  const sortKey = opts.sort;
  rows.sort((a, b) => b[sortKey] - a[sortKey]);

  return rows;
}
