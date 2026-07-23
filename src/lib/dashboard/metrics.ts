import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@/generated/prisma/enums";

export type DashPeriod = "hoje" | "7d" | "30d" | "custom";

export interface DashboardFilters {
  period: DashPeriod;
  account: string; // "todas" ou AdAccount.id
  product: string; // "todos" ou nome do produto
  source: string; // "todas" ou utm_source
  from?: string; // ISO, apenas para custom
  to?: string;
}

export interface DashboardData {
  kpis: {
    revenue: number;
    spend: number;
    sales: number;
    pendentes: number;
    reembolsadas: number;
    chargebackRate: number;
    ticket: number;
    cpa: number;
    roas: number;
    roi: number;
    margin: number;
    ctr: number;
    clicks: number;
    profit: number;
  };
  deltas: Record<string, number | null>;
  chart: { labels: string[]; revenue: number[]; spend: number[]; periodLabel: string; granularity: "hour" | "day" };
  products: { name: string; total: number; sales: number }[];
  sources: { name: string; total: number }[];
  payments: { name: string; total: number; count: number }[];
  funnel: { cliques: number; checkouts: number; vendas: number };
  activity: { id: string; type: "venda" | "clique"; source: string; campaign: string; value: number | null; ts: number }[];
  filterOptions: { accounts: { id: string; name: string }[]; products: string[]; sources: string[] };
}

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CARTAO: "Cartão",
  BOLETO: "Boleto",
  OUTRO: "Outro",
};

function resolveRange(f: DashboardFilters): { start: Date; end: Date; granularity: "hour" | "day" } {
  const end = new Date();
  if (f.period === "custom" && f.from) {
    const start = new Date(f.from);
    const to = f.to ? new Date(f.to) : end;
    return { start, end: to, granularity: "day" };
  }
  if (f.period === "hoje") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { start, end, granularity: "hour" };
  }
  const days = f.period === "30d" ? 30 : 7;
  const start = new Date(end.getTime() - days * 864e5);
  return { start, end, granularity: "day" };
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

/** Custo de gateway + imposto + despesas recorrentes sobre um faturamento. */
function computeExpenses(
  expenses: { type: string; calc: string; amount: number; paymentMethod: PaymentMethod | null }[],
  revenueByPayment: Map<PaymentMethod, number>,
  totalRevenue: number,
) {
  let gateway = 0;
  let tax = 0;
  let recurring = 0;
  for (const e of expenses) {
    if (e.type === "TAXA_GATEWAY") {
      // Base é o faturamento da forma de pagamento associada (ou tudo, se nula).
      const base = e.paymentMethod ? revenueByPayment.get(e.paymentMethod) ?? 0 : totalRevenue;
      gateway += e.calc === "PERCENTUAL" ? (base * e.amount) / 100 : e.amount;
    } else if (e.type === "IMPOSTO") {
      tax += e.calc === "PERCENTUAL" ? (totalRevenue * e.amount) / 100 : e.amount;
    } else {
      recurring += e.amount; // despesa recorrente no período (aproximação)
    }
  }
  return { gateway, tax, recurring, total: gateway + tax + recurring };
}

async function windowAggregate(userId: string, filters: DashboardFilters, start: Date, end: Date) {
  const accountId = filters.account !== "todas" ? filters.account : null;
  const sourceFilter = filters.source !== "todas" ? filters.source : null;
  const productFilter = filters.product !== "todos" ? filters.product : null;

  const [sales, clicks, metrics, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
        ...(productFilter ? { product: productFilter } : {}),
        ...(sourceFilter ? { click: { is: { utmSource: sourceFilter } } } : {}),
      },
      select: {
        id: true,
        value: true,
        product: true,
        status: true,
        paymentMethod: true,
        timestamp: true,
        buyerName: true,
        click: { select: { utmSource: true, utmCampaign: true } },
      },
      orderBy: { timestamp: "desc" },
    }),
    prisma.click.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
        ...(sourceFilter ? { utmSource: sourceFilter } : {}),
      },
      select: { id: true, utmSource: true, utmCampaign: true, timestamp: true },
      orderBy: { timestamp: "desc" },
    }),
    prisma.dailyAdMetric.findMany({
      where: {
        date: { gte: new Date(start.toDateString()), lte: end },
        ad: {
          adAccount: { userId },
          ...(accountId ? { adAccountId: accountId } : {}),
        },
      },
      select: { date: true, spend: true, impressions: true, clicks: true },
    }),
    prisma.expense.findMany({
      where: { userId, active: true },
      select: { type: true, calc: true, amount: true, paymentMethod: true },
    }),
  ]);

  return { sales, clicks, metrics, expenses };
}

export async function computeDashboard(userId: string, filters: DashboardFilters): Promise<DashboardData> {
  const { start, end, granularity } = resolveRange(filters);

  const [current, previous, filterOptions] = await Promise.all([
    windowAggregate(userId, filters, start, end),
    (async () => {
      // Período imediatamente anterior, de mesma duração, para os deltas.
      const span = end.getTime() - start.getTime();
      return windowAggregate(userId, filters, new Date(start.getTime() - span), start);
    })(),
    loadFilterOptions(userId),
  ]);

  const summary = summarize(current);
  const prev = summarize(previous);

  const deltas: Record<string, number | null> = {
    revenue: pctDelta(summary.revenue, prev.revenue),
    spend: pctDelta(summary.spend, prev.spend),
    sales: pctDelta(summary.salesCount, prev.salesCount),
    ticket: pctDelta(summary.ticket, prev.ticket),
    cpa: pctDelta(summary.cpa, prev.cpa),
    roas: pctDelta(summary.roas, prev.roas),
    ctr: pctDelta(summary.ctr, prev.ctr),
    roi: pctDelta(summary.roi, prev.roi),
    margem: pctDelta(summary.margin, prev.margin),
  };

  const chart = buildChart(current, start, end, granularity, filters.period);
  const activity = buildActivity(current);

  return {
    kpis: {
      revenue: summary.revenue,
      spend: summary.spend,
      sales: summary.salesCount,
      pendentes: summary.pendentes,
      reembolsadas: summary.reembolsadas,
      chargebackRate: summary.chargebackRate,
      ticket: summary.ticket,
      cpa: summary.cpa,
      roas: summary.roas,
      roi: summary.roi,
      margin: summary.margin,
      ctr: summary.ctr,
      clicks: summary.clicksCount,
      profit: summary.profit,
    },
    deltas,
    chart,
    products: summary.products,
    sources: summary.sources,
    payments: summary.payments,
    funnel: summary.funnel,
    activity,
    filterOptions,
  };
}

type Window = Awaited<ReturnType<typeof windowAggregate>>;

function summarize(w: Window) {
  const approved = w.sales.filter((s) => s.status === "APROVADA");
  const revenue = approved.reduce((a, s) => a + num(s.value), 0);
  const salesCount = approved.length;
  const pendentes = w.sales.filter((s) => s.status === "PENDENTE").length;
  const reembolsadas = w.sales.filter((s) => s.status === "REEMBOLSADA").length;
  const chargebacks = w.sales.filter((s) => s.status === "CHARGEBACK").length;
  const totalSalesEvents = w.sales.length;
  const chargebackRate = totalSalesEvents ? (chargebacks / totalSalesEvents) * 100 : 0;

  const spend = w.metrics.reduce((a, m) => a + num(m.spend), 0);
  const impressions = w.metrics.reduce((a, m) => a + m.impressions, 0);
  const adClicks = w.metrics.reduce((a, m) => a + m.clicks, 0);
  const clicksCount = w.clicks.length;

  const ticket = salesCount ? revenue / salesCount : 0;
  const cpa = salesCount ? spend / salesCount : 0;
  const roas = spend ? revenue / spend : 0;
  const ctr = impressions ? (adClicks / impressions) * 100 : 0;

  // Faturamento por forma de pagamento (aprovadas), para taxas de gateway.
  const revenueByPayment = new Map<PaymentMethod, number>();
  for (const s of approved) {
    revenueByPayment.set(s.paymentMethod, (revenueByPayment.get(s.paymentMethod) ?? 0) + num(s.value));
  }
  const exp = computeExpenses(
    w.expenses.map((e) => ({ ...e, amount: num(e.amount) })),
    revenueByPayment,
    revenue,
  );
  const profit = revenue - spend - exp.total;
  const totalCost = spend + exp.total;
  const roi = totalCost ? (profit / totalCost) * 100 : 0;
  const margin = revenue ? (profit / revenue) * 100 : 0;

  // Vendas por produto
  const prodMap = new Map<string, { total: number; sales: number }>();
  for (const s of approved) {
    const cur = prodMap.get(s.product) ?? { total: 0, sales: 0 };
    cur.total += num(s.value);
    cur.sales += 1;
    prodMap.set(s.product, cur);
  }
  const products = [...prodMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Vendas por fonte
  const srcMap = new Map<string, number>();
  for (const s of approved) {
    const src = s.click?.utmSource ?? "Direto / Orgânico";
    srcMap.set(src, (srcMap.get(src) ?? 0) + num(s.value));
  }
  const sources = [...srcMap.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Vendas por pagamento
  const payMap = new Map<PaymentMethod, { total: number; count: number }>();
  for (const s of approved) {
    const cur = payMap.get(s.paymentMethod) ?? { total: 0, count: 0 };
    cur.total += num(s.value);
    cur.count += 1;
    payMap.set(s.paymentMethod, cur);
  }
  const payments = [...payMap.entries()]
    .map(([k, v]) => ({ name: PAYMENT_LABEL[k], ...v }))
    .sort((a, b) => b.total - a.total);

  const funnel = { cliques: clicksCount, checkouts: totalSalesEvents, vendas: salesCount };

  return {
    revenue, salesCount, pendentes, reembolsadas, chargebackRate,
    spend, clicksCount, ticket, cpa, roas, ctr, profit, roi, margin,
    products, sources, payments, funnel,
  };
}

function pctDelta(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function buildChart(w: Window, start: Date, end: Date, granularity: "hour" | "day", period: DashPeriod) {
  const buckets: { label: string; start: number; end: number }[] = [];
  if (granularity === "hour") {
    for (let h = 0; h < 24; h++) {
      const bs = new Date(start);
      bs.setHours(h, 0, 0, 0);
      const be = new Date(bs.getTime() + 36e5);
      if (bs > end) break;
      buckets.push({ label: `${String(h).padStart(2, "0")}h`, start: bs.getTime(), end: be.getTime() });
    }
  } else {
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 864e5));
    for (let d = 0; d < days; d++) {
      const bs = new Date(start.getTime() + d * 864e5);
      bs.setHours(0, 0, 0, 0);
      const be = new Date(bs.getTime() + 864e5);
      buckets.push({ label: bs.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), start: bs.getTime(), end: be.getTime() });
    }
  }

  const approved = w.sales.filter((s) => s.status === "APROVADA");
  const revenue = buckets.map((b) =>
    approved.filter((s) => s.timestamp.getTime() >= b.start && s.timestamp.getTime() < b.end).reduce((a, s) => a + num(s.value), 0),
  );
  const spend = buckets.map((b) =>
    w.metrics.filter((m) => m.date.getTime() >= b.start && m.date.getTime() < b.end).reduce((a, m) => a + num(m.spend), 0),
  );

  const periodLabel =
    { hoje: "Hoje · por hora", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", custom: "Período personalizado" }[period];

  return { labels: buckets.map((b) => b.label), revenue, spend, periodLabel, granularity };
}

function buildActivity(w: Window) {
  const items: DashboardData["activity"] = [];
  for (const s of w.sales.slice(0, 20)) {
    items.push({
      id: "s-" + s.id,
      type: "venda",
      source: s.click?.utmSource ?? "Direto",
      campaign: s.click?.utmCampaign ?? s.product,
      value: num(s.value),
      ts: s.timestamp.getTime(),
    });
  }
  for (const c of w.clicks.slice(0, 20)) {
    items.push({
      id: "c-" + c.id,
      type: "clique",
      source: c.utmSource ?? "Direto",
      campaign: c.utmCampaign ?? "—",
      value: null,
      ts: c.timestamp.getTime(),
    });
  }
  return items.sort((a, b) => b.ts - a.ts).slice(0, 15);
}

async function loadFilterOptions(userId: string) {
  const [accounts, productRows, sourceRows] = await Promise.all([
    prisma.adAccount.findMany({ where: { userId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.sale.findMany({ where: { userId }, select: { product: true }, distinct: ["product"], take: 50 }),
    prisma.click.findMany({
      where: { userId, utmSource: { not: null } },
      select: { utmSource: true },
      distinct: ["utmSource"],
      take: 50,
    }),
  ]);
  return {
    accounts,
    products: productRows.map((p) => p.product).filter(Boolean),
    sources: sourceRows.map((s) => s.utmSource!).filter(Boolean),
  };
}
