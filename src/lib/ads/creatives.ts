import { getUserTimezone } from "@/lib/userTimezone";
import { prisma } from "@/lib/prisma";
import { addDaysToKey, dayStart, keyToDateColumn, todayKey } from "@/lib/timezone";
import { splitPipe } from "@/lib/utm/parse";

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

/** Mesma janela do gerenciador, no fuso do usuário. Ver `ads/overview.ts`. */
function rangeStart(period: CreativePeriod, tz: string): { start: Date; startKey: string } {
  const hoje = todayKey(tz);
  const startKey = period === "hoje" ? hoje : addDaysToKey(hoje, -((period === "30d" ? 30 : 7) - 1));
  return { start: dayStart(startKey, tz), startKey };
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

export async function computeCreatives(
  userId: string,
  opts: {
    period: CreativePeriod;
    sort: CreativeSort;
    /** Filtros BASE da Área de Trabalho (carregados no servidor pelo `?ws=`). */
    accounts?: string[];
    products?: string[];
    sources?: string[];
    webhooks?: string[];
  },
): Promise<CreativeRow[]> {
  const tz = await getUserTimezone(userId);
  const { start, startKey } = rangeStart(opts.period, tz);

  // Sem filtro de tela aqui: a área é a única fonte de recorte da aba Criativos.
  const contas = opts.accounts?.length ? opts.accounts : null;
  const produtos = opts.products?.length ? opts.products : null;
  const fontes = opts.sources?.length ? opts.sources : null;
  const webhooks = opts.webhooks?.length ? opts.webhooks : null;
  const contaWhere = contas ? { id: { in: contas } } : {};

  const [ads, metrics, sales] = await Promise.all([
    prisma.ad.findMany({
      where: { adAccount: { userId, ...contaWhere }, creative: { isNot: null } },
      select: {
        id: true,
        fbAdId: true,
        name: true,
        campaign: { select: { name: true } },
        creative: { select: { name: true, title: true, thumbnailUrl: true, imageUrl: true, videoId: true } },
      },
    }),
    prisma.dailyAdMetric.findMany({
      where: { date: { gte: keyToDateColumn(startKey) }, ad: { adAccount: { userId, ...contaWhere } } },
      select: { adId: true, spend: true, impressions: true, clicks: true },
    }),
    // Vendas aprovadas no período; atribuídas ao anúncio por utm_content → nome.
    prisma.sale.findMany({
      where: {
        userId,
        status: "APROVADA",
        timestamp: { gte: start },
        ...(produtos ? { product: { in: produtos } } : {}),
        ...(webhooks ? { webhookId: { in: webhooks } } : {}),
        ...(fontes ? { click: { is: { utmSource: { in: fontes } } } } : {}),
      },
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

  // Atribuição venda→anúncio: preferimos casar pelo id do Facebook extraído do
  // utm_content (`nome|id`, Bloco 11); caímos no nome para cliques antigos.
  const salesByAdId = new Map<string, { sales: number; revenue: number }>();
  const salesByName = new Map<string, { sales: number; revenue: number }>();
  for (const s of sales) {
    const { name, id } = splitPipe(s.click?.utmContent);
    const bump = (map: Map<string, { sales: number; revenue: number }>, key: string) => {
      const cur = map.get(key) ?? { sales: 0, revenue: 0 };
      cur.sales += 1;
      cur.revenue += num(s.value);
      map.set(key, cur);
    };
    if (id) bump(salesByAdId, id);
    else if (name) bump(salesByName, name.toLowerCase());
  }

  const rows: CreativeRow[] = ads.map((a) => {
    const met = metByAd.get(a.id) ?? { spend: 0, impressions: 0, clicks: 0 };
    // Cada venda cai em exatamente um mapa (por id se tiver, senão por nome),
    // então somamos os dois sem risco de contar a mesma venda duas vezes.
    const byId = salesByAdId.get(a.fbAdId);
    const byName = salesByName.get(a.name.toLowerCase());
    const attr = {
      sales: (byId?.sales ?? 0) + (byName?.sales ?? 0),
      revenue: (byId?.revenue ?? 0) + (byName?.revenue ?? 0),
    };
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
