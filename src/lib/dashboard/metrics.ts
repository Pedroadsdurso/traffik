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
    /** Faturamento ÷ compradores únicos (Bloco 4). */
    arpu: number;
    buyers: number;
  };
  deltas: Record<string, number | null>;
  chart: {
    labels: string[];
    revenue: number[];
    spend: number[];
    periodLabel: string;
    granularity: "hour" | "day";
    /** Série por bucket de cada KPI, para os mini-gráficos dos cards. */
    sparklines: Record<string, number[]>;
  };
  expenses: { gateway: number; tax: number; recurring: number; total: number };
  products: { name: string; total: number; sales: number }[];
  sources: { name: string; total: number }[];
  payments: { name: string; total: number; count: number }[];
  funnel: { cliques: number; visitas: number; checkouts: number; iniciadas: number; vendas: number };
  /** Vendas aprovadas por país (ISO-2), ordenado por faturamento — Bloco 5. */
  byCountry: { code: string; sales: number; revenue: number }[];
  /** Taxa de aprovação por método de pagamento — Bloco 5. */
  approval: { name: string; geradas: number; pagas: number; rate: number }[];
  /** 24 posições (0–23) da janela filtrada — Bloco 4. */
  byHour: { hour: number; sales: number; revenue: number; profit: number }[];
  /** Vendas por dia da janela filtrada, no máximo 30 dias — Bloco 4. */
  byDay: { date: string; sales: number; revenue: number }[];
  activity: {
    id: string;
    /** Tipos do feed unificado — cada um com badge e cor próprios na UI. */
    type: "clique" | "checkout" | "venda_pendente" | "venda_aprovada" | "reembolso" | "chargeback";
    source: string;
    campaign: string;
    value: number | null;
    ts: number;
  }[];
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

  const [sales, clicks, metrics, expenses, pixelEvents] = await Promise.all([
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
        buyerEmail: true, // identifica comprador único para o ARPU
        country: true, // "Vendas por país" (Bloco 5)
        click: { select: { utmSource: true, utmCampaign: true, country: true } },
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
    // Alimenta o estágio "Initiate Checkout" do funil E o feed de atividade.
    prisma.pixelEvent.findMany({
      where: { userId, event: "InitiateCheckout", timestamp: { gte: start, lte: end } },
      select: { id: true, url: true, timestamp: true },
      orderBy: { timestamp: "desc" },
      take: 200,
    }),
  ]);

  return { sales, clicks, metrics, expenses, pixelEvents, initiateCheckouts: pixelEvents.length, janela: { start, end } };
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
    arpu: pctDelta(summary.arpu, prev.arpu),
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
      arpu: summary.arpu,
      buyers: summary.buyers,
      profit: summary.profit,
    },
    deltas,
    chart,
    expenses: summary.expenses,
    products: summary.products,
    sources: summary.sources,
    payments: summary.payments,
    funnel: summary.funnel,
    byCountry: summary.byCountry,
    approval: summary.approval,
    byHour: summary.byHour,
    byDay: summary.byDay,
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
  // ROI como **multiplicador** (Bloco 4), na mesma escala do ROAS: 1,87x.
  // Antes era `* 100` e a UI mostrava "1331%".
  const roi = totalCost ? profit / totalCost : 0;
  const margin = revenue ? (profit / revenue) * 100 : 0;

  // ARPU = faturamento ÷ compradores únicos. O comprador é identificado pelo
  // e-mail; vendas sem e-mail não dá para agrupar, então cada uma conta como um
  // comprador distinto — melhor superestimar o denominador (ARPU conservador)
  // do que fundir pessoas diferentes num só.
  const emails = new Set<string>();
  let semEmail = 0;
  for (const s of approved) {
    const e = s.buyerEmail?.trim().toLowerCase();
    if (e) emails.add(e);
    else semEmail += 1;
  }
  const buyers = emails.size + semEmail;
  const arpu = buyers ? revenue / buyers : 0;

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

  // ── Funil de 5 estágios (Bloco 5) ──
  // "Cliques" são os cliques NO ANÚNCIO (métricas do Facebook); "visitas" são as
  // páginas efetivamente carregadas com o nosso script. A diferença entre os
  // dois é justamente o que o funil existe para mostrar.
  const funnel = {
    cliques: adClicks,
    visitas: clicksCount,
    checkouts: w.initiateCheckouts,
    iniciadas: totalSalesEvents,
    vendas: salesCount,
  };

  // ── Vendas por país (Bloco 5) ──
  // Prefere o país da venda; cai no país do clique quando o gateway não manda.
  const paisMap = new Map<string, { sales: number; revenue: number }>();
  for (const s of approved) {
    const code = (s.country ?? s.click?.country ?? "").trim().toUpperCase();
    if (!code) continue;
    const cur = paisMap.get(code) ?? { sales: 0, revenue: 0 };
    cur.sales += 1;
    cur.revenue += num(s.value);
    paisMap.set(code, cur);
  }
  const byCountry = [...paisMap.entries()]
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Taxa de aprovação por método (Bloco 5) ──
  // "Gerada" é qualquer evento de venda daquele método; "paga" é a APROVADA.
  // O upsert por externalId (Bloco 10) faz a transição gerada→paga na MESMA
  // linha, então basta contar por status — não há dupla contagem.
  const aprovMap = new Map<PaymentMethod, { geradas: number; pagas: number }>();
  for (const s of w.sales) {
    const cur = aprovMap.get(s.paymentMethod) ?? { geradas: 0, pagas: 0 };
    cur.geradas += 1;
    if (s.status === "APROVADA") cur.pagas += 1;
    aprovMap.set(s.paymentMethod, cur);
  }
  const approval = [...aprovMap.entries()]
    .map(([method, v]) => ({
      name: PAYMENT_LABEL[method],
      geradas: v.geradas,
      pagas: v.pagas,
      rate: v.geradas ? (v.pagas / v.geradas) * 100 : 0,
    }))
    .sort((a, b) => b.geradas - a.geradas);

  // ── Séries por horário e por dia (Bloco 4) ──
  //
  // O roteiro pede "24h do dia atual" e "últimos 30 dias", mas também exige que
  // toda métrica respeite os filtros. Resolvemos bucketizando a **janela já
  // filtrada**: com o período em "Hoje" o gráfico por horário É as 24h de hoje,
  // e com "Últimos 30 dias" o por-dia É o mês. Fica coerente com qualquer
  // filtro em vez de ignorar o de cima.
  //
  // O lucro por hora rateia as despesas (gateway/imposto/recorrentes) na
  // proporção do faturamento daquela hora — não há como atribuí-las por hora,
  // então o rateio proporcional é a aproximação honesta. Gasto de anúncio vem
  // de métricas diárias e também é rateado.
  const custoSobreReceita = revenue ? (spend + exp.total) / revenue : 0;

  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, sales: 0, revenue: 0, profit: 0 }));
  for (const s of approved) {
    const h = new Date(s.timestamp).getHours();
    const v = num(s.value);
    byHour[h]!.sales += 1;
    byHour[h]!.revenue += v;
    byHour[h]!.profit += v - v * custoSobreReceita;
  }

  const diaMap = new Map<string, { sales: number; revenue: number }>();
  for (const s of approved) {
    const d = new Date(s.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cur = diaMap.get(key) ?? { sales: 0, revenue: 0 };
    cur.sales += 1;
    cur.revenue += num(s.value);
    diaMap.set(key, cur);
  }
  // Preenche todos os dias da janela, inclusive os sem venda: o gráfico desenha
  // barra-fantasma nas lacunas, e sem elas a série temporal ficaria com buracos.
  const byDay: { date: string; sales: number; revenue: number }[] = [];
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const cursor = new Date(w.janela.start);
  cursor.setHours(0, 0, 0, 0);
  const limite = new Date(w.janela.end);
  while (cursor <= limite && byDay.length < 60) {
    const k = iso(cursor);
    byDay.push({ date: k, ...(diaMap.get(k) ?? { sales: 0, revenue: 0 }) });
    cursor.setDate(cursor.getDate() + 1);
  }
  byDay.splice(0, Math.max(0, byDay.length - 30));

  const expenses = { gateway: exp.gateway, tax: exp.tax, recurring: exp.recurring, total: exp.total };

  return {
    revenue, salesCount, pendentes, reembolsadas, chargebackRate,
    spend, clicksCount, ticket, cpa, roas, ctr, profit, roi, margin, arpu, buyers,
    expenses, products, sources, payments, funnel, byHour, byDay, byCountry, approval,
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
    // `+ 1` porque os dois extremos entram: em "últimos 7 dias" o intervalo vai
    // de hoje-7 até agora, e sem o +1 o último bucket parava ONTEM — as vendas
    // de hoje caíam fora de todos os buckets e o gráfico ficava achatado em zero.
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 864e5) + 1);
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

  // Séries por bucket para os sparklines dos cards de KPI (Bloco 5 — polimento).
  // Derivadas dos mesmos buckets do gráfico, para a mini-linha contar a mesma
  // história do gráfico grande.
  const vendasPorBucket = buckets.map((b) =>
    approved.filter((s) => s.timestamp.getTime() >= b.start && s.timestamp.getTime() < b.end).length,
  );
  const compradoresPorBucket = buckets.map((b) => {
    const nesse = approved.filter((s) => s.timestamp.getTime() >= b.start && s.timestamp.getTime() < b.end);
    const emails = new Set(nesse.map((s) => s.buyerEmail?.trim().toLowerCase()).filter(Boolean));
    return emails.size + nesse.filter((s) => !s.buyerEmail?.trim()).length;
  });
  const div = (a: number, b: number) => (b ? a / b : 0);
  const sparklines: Record<string, number[]> = {
    faturamento: revenue,
    gasto: spend,
    vendas: vendasPorBucket,
    roas: revenue.map((r, i) => div(r, spend[i] ?? 0)),
    ticket: revenue.map((r, i) => div(r, vendasPorBucket[i] ?? 0)),
    arpu: revenue.map((r, i) => div(r, compradoresPorBucket[i] ?? 0)),
    cpa: spend.map((sp, i) => div(sp, vendasPorBucket[i] ?? 0)),
  };

  const periodLabel =
    { hoje: "Hoje · por hora", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", custom: "Período personalizado" }[period];

  return { labels: buckets.map((b) => b.label), revenue, spend, periodLabel, granularity, sparklines };
}

function buildActivity(w: Window) {
  const items: DashboardData["activity"] = [];

  // Uma venda vira um evento diferente conforme o status — antes tudo era
  // "venda", o que fazia o feed parecer que só existia esse tipo.
  for (const s of w.sales.slice(0, 40)) {
    const tipo =
      s.status === "APROVADA" ? "venda_aprovada"
      : s.status === "REEMBOLSADA" ? "reembolso"
      : s.status === "CHARGEBACK" ? "chargeback"
      : "venda_pendente";
    items.push({
      id: "s-" + s.id,
      type: tipo,
      source: s.click?.utmSource ?? "Direto",
      campaign: s.click?.utmCampaign ?? s.product,
      value: num(s.value),
      ts: s.timestamp.getTime(),
    });
  }
  for (const c of w.clicks.slice(0, 40)) {
    items.push({
      id: "c-" + c.id,
      type: "clique",
      source: c.utmSource ?? "Direto",
      campaign: c.utmCampaign ?? "—",
      value: null,
      ts: c.timestamp.getTime(),
    });
  }
  for (const e of w.pixelEvents.slice(0, 40)) {
    items.push({
      id: "p-" + e.id,
      type: "checkout",
      source: "Pixel",
      campaign: e.url ? e.url.replace(/^https?:\/\//, "").slice(0, 48) : "—",
      value: null,
      ts: e.timestamp.getTime(),
    });
  }

  return items.sort((a, b) => b.ts - a.ts).slice(0, 40);
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
