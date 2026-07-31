import { getUserTimezone } from "@/lib/userTimezone";
import { carregarMapaDeAreas } from "@/lib/areas/atribuicao";
import { prisma } from "@/lib/prisma";
import { janelaDoPeriodo, type PeriodoNome } from "@/lib/periodo";
import { dayEnd, dayKeyInTz, dayStart, keyToDateColumn } from "@/lib/timezone";
import { chaveDoPedido } from "@/lib/pedidos";
import { splitPipe } from "@/lib/utm/parse";

/** ⚠️ Alias de `PeriodoNome` — mesma união do Dashboard e do Gerenciador. */
export type CreativePeriod = PeriodoNome;
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

/**
 * Janela dos Criativos, da fonte ÚNICA (`lib/periodo.ts`).
 *
 * ⚠️ Isto era uma cópia do `rangeStart` do `overview.ts`, com o comentário
 * "mesma janela do gerenciador" — que é a confissão de que eram duas cópias da
 * mesma regra. As duas herdavam o mesmo defeito: sem ponta final.
 */
function janela(opts: { period: CreativePeriod; from?: string; to?: string }, tz: string) {
  const agora = new Date();
  const j = janelaDoPeriodo(opts.period, tz, { from: opts.from, to: opts.to }, agora);
  return {
    start: dayStart(j.startKey, tz),
    end: j.endKey === dayKeyInTz(agora, tz) ? agora : dayEnd(j.endKey, tz),
    startKey: j.startKey,
    endKey: j.endKey,
  };
}


function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

export async function computeCreatives(
  userId: string,
  opts: {
    period: CreativePeriod;
    /** Apenas para `period: "custom"`. */
    from?: string;
    to?: string;
    sort: CreativeSort;
    /** Área de Trabalho ATIVA — só o id. Ver `lib/areas/precedencia.ts`. */
    workspaceId?: string | null;
  },
): Promise<CreativeRow[]> {
  const tz = await getUserTimezone(userId);
  const { start, end, startKey, endKey } = janela(opts, tz);

  // Sem filtro de tela aqui: a área é a única fonte de recorte da aba Criativos.
  const mapa = await carregarMapaDeAreas(userId);
  const areaAtiva = mapa.areaValida(opts.workspaceId);
  const contaWhere = { id: { in: mapa.contasDaArea(areaAtiva) } };

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
      where: {
        date: { gte: keyToDateColumn(startKey), lte: keyToDateColumn(endKey) },
        ad: { adAccount: { userId, ...contaWhere } },
      },
      select: { adId: true, spend: true, impressions: true, clicks: true },
    }),
    // Vendas aprovadas no período; atribuídas ao anúncio por utm_content → nome.
    prisma.sale.findMany({
      where: {
        userId,
        status: "APROVADA",
        timestamp: { gte: start, lte: end },
      },
      select: { id: true, pedidoId: true, value: true, product: true, webhookId: true, apiCredentialId: true, click: { select: { utmContent: true, utmCampaign: true, workspaceId: true } } },
    }),
  ]);

  // Pertinência de área: a venda chega pela atribuição, não por FK de conta.
  const vendasDaArea = sales.filter((v) => mapa.areaDaVenda(v).areaId === areaAtiva);

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
  // ⚠️ `sales` conta CONVERSÕES (pedidos distintos), `revenue` soma as linhas.
  // Ver a mesma decisão em `ads/overview.ts` e `lib/pedidos.ts`.
  const pedidosPorChave = new Map<string, Set<string>>();
  for (const s of vendasDaArea) {
    const { name, id } = splitPipe(s.click?.utmContent);
    const bump = (map: Map<string, { sales: number; revenue: number }>, key: string, prefixo: string) => {
      const cur = map.get(key) ?? { sales: 0, revenue: 0 };
      const destino = `${prefixo}:${key}`;
      let vistos = pedidosPorChave.get(destino);
      if (!vistos) pedidosPorChave.set(destino, (vistos = new Set()));
      const chave = chaveDoPedido(s);
      if (!vistos.has(chave)) {
        vistos.add(chave);
        cur.sales += 1;
      }
      cur.revenue += num(s.value);
      map.set(key, cur);
    };
    if (id) bump(salesByAdId, id, "id");
    else if (name) bump(salesByName, name.toLowerCase(), "nome");
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
