import { ESCOPO_TUDO, carregarEscopoContas, filtroEfetivo } from "@/lib/ads/escopo";
import { getUserTimezone } from "@/lib/userTimezone";
import { prisma } from "@/lib/prisma";
import {
  addDaysToKey,
  dateColumnKey,
  dayEnd,
  dayKeyInTz,
  dayKeyRange,
  dayStart,
  daysBetweenKeys,
  hourInTz,
  keyToDateColumn,
  todayKey,
  zonedToUtc,
} from "@/lib/timezone";
import type { PaymentMethod } from "@/generated/prisma/enums";

export type DashPeriod = "hoje" | "7d" | "30d" | "custom";

export interface DashboardFilters {
  period: DashPeriod;
  account: string; // "todas" ou AdAccount.id
  product: string; // "todos" ou nome do produto
  source: string; // "todas" ou utm_source
  from?: string; // ISO, apenas para custom
  to?: string;
  /**
   * Filtro BASE da Área de Trabalho. Os campos acima são os filtros da TELA e
   * agem dentro deste — a interseção é feita em `filtroEfetivo`, para que
   * escolher na tela algo de fora da área não traga dados de fora.
   */
  accounts?: string[];
  products?: string[];
  sources?: string[];
  /**
   * Webhooks da área. Não existe filtro de tela correspondente, então age
   * direto (sem interseção). É o recorte de venda **mais confiável** desta
   * lista: `Sale.webhookId` é FK, ao contrário de `products`, que é texto livre
   * do gateway e para de casar em silêncio quando o produto é renomeado lá.
   *
   * ⚠️ Venda sem `webhookId` (ingestão pela chave de API, ou importada) fica de
   * fora quando este filtro está ligado — não há como afirmar que ela veio
   * daquele gateway.
   */
  webhooks?: string[];
  /**
   * Pixels da área, casando com `PixelEvent.pixelConfigId`.
   *
   * ⚠️ O Initiate Checkout gerado pelo WEBHOOK do gateway
   * (`webhook/checkoutEvent.ts`) nasce **sem** `pixelConfigId` — ele não passa
   * por pixel nenhum. Com este filtro ligado ele fica de fora, e o funil conta
   * só os checkouts que o script daquele(s) pixel(s) viu.
   */
  pixelConfigs?: string[];
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
    /** `null` quando não houve custo nenhum — ROI é indefinido, não zero. */
    roi: number | null;
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
    type: "clique" | "pageview" | "checkout" | "lead" | "add_to_cart" | "venda_pendente" | "venda_aprovada" | "reembolso" | "chargeback";
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

/**
 * A janela do filtro, resolvida **no fuso do usuário**.
 *
 * Devolve as pontas como chaves de dia (`YYYY-MM-DD`) além dos instantes: os
 * buckets e as consultas de `DailyAdMetric` precisam da chave, e derivá-la de
 * volta a partir do `Date` seria reabrir exatamente o bug que isto conserta.
 *
 * A janela anterior (para os deltas) também é alinhada ao calendário. Antes ela
 * era `start - (end - start)`, o que para "Hoje" comparava contra um pedaço de
 * ontem+anteontem em vez de contra ontem.
 */
interface Range {
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
  granularity: "hour" | "day";
  prevStart: Date;
  prevEnd: Date;
}

function resolveRange(f: DashboardFilters, tz: string): Range {
  const agora = new Date();
  const hoje = todayKey(tz);

  if (f.period === "custom" && f.from) {
    const startKey = f.from;
    // `to` inclusivo até 23:59:59.999 do fuso do usuário. Antes era
    // `new Date("2026-07-25")` = meia-noite UTC, então um período de UM dia
    // (from === to) resultava numa janela de duração ZERO e o dashboard vinha
    // vazio — e um período normal perdia o último dia inteiro.
    const endKey = f.to ?? f.from;
    const dias = Math.max(1, daysBetweenKeys(startKey, endKey) + 1);
    const start = dayStart(startKey, tz);
    return {
      start,
      end: dayEnd(endKey, tz),
      startKey,
      endKey,
      granularity: "day",
      prevStart: dayStart(addDaysToKey(startKey, -dias), tz),
      prevEnd: dayEnd(addDaysToKey(startKey, -1), tz),
    };
  }

  if (f.period === "hoje") {
    const start = dayStart(hoje, tz);
    // Ontem, do começo do dia até o mesmo ponto do dia em que estamos agora —
    // comparar o dia parcial contra um dia inteiro faria "Hoje" parecer sempre
    // pior de manhã.
    const ontem = addDaysToKey(hoje, -1);
    const prevStart = dayStart(ontem, tz);
    return {
      start,
      end: agora,
      startKey: hoje,
      endKey: hoje,
      granularity: "hour",
      prevStart,
      prevEnd: new Date(prevStart.getTime() + (agora.getTime() - start.getTime())),
    };
  }

  // "Últimos 7/30 dias" = 7/30 dias de CALENDÁRIO terminando hoje, alinhados à
  // meia-noite do usuário. Antes era um deslocamento cru de `n × 86400000` a
  // partir de agora, que caía no meio de um dia e produzia um bucket parcial a
  // mais na ponta — a origem do `+ 1` que o `buildChart` precisava ter.
  const dias = f.period === "30d" ? 30 : 7;
  const startKey = addDaysToKey(hoje, -(dias - 1));
  return {
    start: dayStart(startKey, tz),
    end: agora,
    startKey,
    endKey: hoje,
    granularity: "day",
    prevStart: dayStart(addDaysToKey(startKey, -dias), tz),
    prevEnd: dayEnd(addDaysToKey(startKey, -1), tz),
  };
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

async function windowAggregate(
  userId: string,
  filters: DashboardFilters,
  start: Date,
  end: Date,
  tz: string,
) {
  // Listas efetivas = área de trabalho ∩ filtro da tela. `null` = sem filtro.
  const contas = filtroEfetivo(filters.accounts, filters.account, "todas");
  const produtos = filtroEfetivo(filters.products, filters.product, "todos");
  const fontes = filtroEfetivo(filters.sources, filters.source, "todas");
  // Webhooks e pixels não têm filtro na barra do topo: a área é a única fonte,
  // então vão direto ao `where` sem interseção.
  const webhooks = filters.webhooks?.length ? filters.webhooks : null;
  const pixelConfigs = filters.pixelConfigs?.length ? filters.pixelConfigs : null;
  // As pontas em chave de dia do fuso do usuário — é assim que `DailyAdMetric`
  // (coluna `@db.Date`, um dia de calendário) tem de ser filtrada.
  const startKey = dayKeyInTz(start, tz);
  const endKey = dayKeyInTz(end, tz);
  // ⚠️ O escopo de contas é resolvido ANTES das consultas: sem ele, o filtro de
  // conta só alcançava `DailyAdMetric` — ou seja, só o gasto. Ver `ads/escopo.ts`.
  const escopo = contas ? await carregarEscopoContas(userId, contas) : ESCOPO_TUDO;

  const [sales, clicks, metrics, expenses, pixelEvents, initiateCheckouts] = await Promise.all([
    prisma.sale.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
        ...(produtos ? { product: { in: produtos } } : {}),
        ...(fontes ? { click: { is: { utmSource: { in: fontes } } } } : {}),
        ...(webhooks ? { webhookId: { in: webhooks } } : {}),
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
        ...(fontes ? { utmSource: { in: fontes } } : {}),
      },
      select: { id: true, utmSource: true, utmCampaign: true, fbclid: true, timestamp: true },
      orderBy: { timestamp: "desc" },
    }),
    prisma.dailyAdMetric.findMany({
      where: {
        // `keyToDateColumn` em vez de `new Date(start.toDateString())`: o
        // `toDateString()` reinterpretava a data no fuso do PROCESSO, então na
        // Vercel (UTC) a janela começava um dia adiantada.
        date: { gte: keyToDateColumn(startKey), lte: keyToDateColumn(endKey) },
        ad: {
          adAccount: { userId },
          ...(contas ? { adAccountId: { in: contas } } : {}),
        },
      },
      select: { date: true, spend: true, impressions: true, clicks: true },
    }),
    prisma.expense.findMany({
      where: { userId, active: true },
      select: { type: true, calc: true, amount: true, paymentMethod: true },
    }),
    // Feed de atividade: TODOS os eventos do pixel, cada um com seu badge.
    // Antes esta consulta filtrava `event: "InitiateCheckout"`, então Lead e
    // AddToCart eram gravados mas nunca apareciam na tela.
    prisma.pixelEvent.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
        ...(pixelConfigs ? { pixelConfigId: { in: pixelConfigs } } : {}),
      },
      select: { id: true, event: true, url: true, fbclid: true, timestamp: true },
      orderBy: { timestamp: "desc" },
      take: 200,
    }),
    // O funil conta só Initiate Checkout, e conta a janela inteira — por isso é
    // uma consulta separada, e não a lista acima (que é truncada em 200).
    //
    // Traz as chaves em vez de `count()` porque o funil precisa de VISITANTES
    // distintos, não de eventos: o `px.js` dispara um IC a cada clique no link
    // de checkout, e quem clica duas vezes gerava dois eventos. Medido no banco:
    // 31 eventos para 25 visitantes. Esse era o inflador que fazia uma etapa
    // ultrapassar a anterior.
    prisma.pixelEvent.findMany({
      where: {
        userId,
        event: "InitiateCheckout",
        timestamp: { gte: start, lte: end },
        ...(pixelConfigs ? { pixelConfigId: { in: pixelConfigs } } : {}),
      },
      select: { id: true, fbclid: true, eventId: true },
    }),
  ]);

  // ── Aplicação do escopo de CONTA ──────────────────────────────────────────
  //
  // Feito em memória, e não no `where`, porque a ligação venda→conta passa pelo
  // `utm_campaign` no formato `nome|id`, que o Postgres não sabe interpretar.
  // É a mesma atribuição do Gerenciador (ver `ads/escopo.ts`).
  //
  // Antes disto, o filtro de conta alcançava só `DailyAdMetric`: o gasto era de
  // uma conta e o faturamento de todas, o que inflava ROAS, ROI, CPA e Lucro.
  const salesEscopo = contas ? sales.filter((v) => escopo.combina(v.click?.utmCampaign)) : sales;
  const clicksEscopo = contas ? clicks.filter((c) => escopo.combina(c.utmCampaign)) : clicks;

  // Evento de pixel não tem UTM: chega à conta pelo `fbclid` do clique casado.
  // Sem fbclid não há atribuição possível, e o evento fica de fora do escopo.
  const fbclidsNoEscopo = new Set(clicksEscopo.map((c) => c.fbclid).filter(Boolean) as string[]);
  const noEscopoPorFbclid = (fbclid: string | null) =>
    !contas || (fbclid != null && fbclidsNoEscopo.has(fbclid));
  const pixelEventsEscopo = contas ? pixelEvents.filter((e) => noEscopoPorFbclid(e.fbclid)) : pixelEvents;
  const icsEscopo = contas ? initiateCheckouts.filter((e) => noEscopoPorFbclid(e.fbclid)) : initiateCheckouts;

  // Visitantes distintos que iniciaram checkout. A chave é o `fbclid` (o mesmo
  // visitante clicando várias vezes carrega o mesmo), caindo no `eventId` e por
  // fim no id da linha quando não há como identificar — sem fbclid não dá para
  // afirmar que dois eventos são a mesma pessoa, e contar a mais é melhor do
  // que fundir visitantes diferentes num só.
  const checkoutsDistintos = new Set(
    icsEscopo.map((e) => e.fbclid || e.eventId || `row:${e.id}`),
  ).size;

  return {
    sales: salesEscopo, clicks: clicksEscopo, metrics, expenses, pixelEvents: pixelEventsEscopo,
    initiateCheckouts: checkoutsDistintos,
    janela: { start, end, startKey, endKey, tz },
  };
}

export async function computeDashboard(userId: string, filters: DashboardFilters): Promise<DashboardData> {
  // O fuso vem antes de tudo: é ele que define onde a janela começa, e resolver
  // a janela sem ele é o bug que este módulo inteiro passou a evitar.
  const tz = await getUserTimezone(userId);
  const { start, end, startKey, endKey, granularity, prevStart, prevEnd } = resolveRange(filters, tz);

  const [current, previous, filterOptions] = await Promise.all([
    windowAggregate(userId, filters, start, end, tz),
    windowAggregate(userId, filters, prevStart, prevEnd, tz),
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

  const chart = buildChart(current, startKey, endKey, end, granularity, filters.period, tz);
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
  //
  // ⚠️ NÃO existe clamp aqui, e o piso de −1,00x é matemático, não um bug:
  //   roi = (revenue − custo) / custo = revenue/custo − 1
  // Com `revenue = 0` o resultado é exatamente −1 por qualquer custo, porque
  // não dá para perder mais do que 100% do que se investiu. Um ROI "cada vez
  // mais negativo" só existe se o faturamento for NEGATIVO — e os reembolsos
  // hoje saem do faturamento (viram status REEMBOLSADA) em vez de subtraí-lo.
  // Quem varia com o tamanho do prejuízo é o LUCRO, em reais.
  // Ver a nota "ROI travado em −1,00x" no CLAUDE.md.
  //
  // Sem custo nenhum o ROI é indefinido (dividir por zero), não "zero": devolver
  // 0 fazia a tela dizer "0,00x" — que se lê como empate — para uma conta que
  // faturou sem gastar. Agora vira `null` e a UI mostra "—".
  const roi = totalCost > 0 ? profit / totalCost : null;
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

  // `hourInTz` em vez de `getHours()`: era exatamente aqui que uma venda das
  // 17h em Brasília aparecia às 20h — o processo na Vercel roda em UTC e
  // `getHours()` devolve a hora do processo, não a do usuário.
  const tz = w.janela.tz;
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, sales: 0, revenue: 0, profit: 0 }));
  for (const s of approved) {
    const h = hourInTz(s.timestamp, tz);
    const v = num(s.value);
    byHour[h]!.sales += 1;
    byHour[h]!.revenue += v;
    byHour[h]!.profit += v - v * custoSobreReceita;
  }

  const diaMap = new Map<string, { sales: number; revenue: number }>();
  for (const s of approved) {
    const key = dayKeyInTz(s.timestamp, tz);
    const cur = diaMap.get(key) ?? { sales: 0, revenue: 0 };
    cur.sales += 1;
    cur.revenue += num(s.value);
    diaMap.set(key, cur);
  }
  // Preenche todos os dias da janela, inclusive os sem venda: o gráfico desenha
  // barra-fantasma nas lacunas, e sem elas a série temporal ficaria com buracos.
  const byDay = dayKeyRange(w.janela.startKey, w.janela.endKey, 60)
    .map((k) => ({ date: k, ...(diaMap.get(k) ?? { sales: 0, revenue: 0 }) }))
    .slice(-30);

  const expenses = { gateway: exp.gateway, tax: exp.tax, recurring: exp.recurring, total: exp.total };

  return {
    revenue, salesCount, pendentes, reembolsadas, chargebackRate,
    spend, clicksCount, ticket, cpa, roas, ctr, profit, roi, margin, arpu, buyers,
    expenses, products, sources, payments, funnel, byHour, byDay, byCountry, approval,
  };
}

function pctDelta(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || !prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function buildChart(
  w: Window,
  startKey: string,
  endKey: string,
  end: Date,
  granularity: "hour" | "day",
  period: DashPeriod,
  tz: string,
) {
  // Cada bucket carrega a chave do dia a que pertence: o faturamento casa por
  // instante (é um `DateTime`), mas o gasto casa por CHAVE, porque
  // `DailyAdMetric.date` é `@db.Date` — um dia de calendário gravado como
  // meia-noite UTC, que não coincide com a meia-noite de nenhum outro fuso.
  const buckets: { label: string; start: number; end: number; dayKey: string; primeiroDoDia: boolean }[] = [];
  if (granularity === "hour") {
    const [y, m, d] = startKey.split("-").map(Number);
    for (let h = 0; h < 24; h++) {
      const bs = zonedToUtc(y!, m!, d!, h, 0, 0, 0, tz);
      if (bs > end) break;
      // `+1h` pelo relógio de parede, não `+36e5`: num dia de virada de horário
      // de verão a hora tem 0 ou 2 horas de duração e os buckets ficariam
      // desalinhados do resto do dia.
      const be = zonedToUtc(y!, m!, d!, h + 1, 0, 0, 0, tz);
      buckets.push({
        label: `${String(h).padStart(2, "0")}h`,
        start: bs.getTime(),
        end: be.getTime(),
        dayKey: startKey,
        primeiroDoDia: h === 0,
      });
    }
  } else {
    // As chaves já vêm alinhadas ao calendário do usuário pelo `resolveRange`,
    // então o `+ 1` que existia aqui (para compensar uma janela que começava no
    // meio do dia) deixou de ser necessário.
    for (const key of dayKeyRange(startKey, endKey, 60)) {
      const bs = dayStart(key, tz);
      const be = dayStart(addDaysToKey(key, 1), tz);
      const [, mm, dd] = key.split("-");
      buckets.push({
        label: `${dd}/${mm}`,
        start: bs.getTime(),
        end: be.getTime(),
        dayKey: key,
        primeiroDoDia: true,
      });
    }
  }

  const approved = w.sales.filter((s) => s.status === "APROVADA");
  const revenue = buckets.map((b) =>
    approved.filter((s) => s.timestamp.getTime() >= b.start && s.timestamp.getTime() < b.end).reduce((a, s) => a + num(s.value), 0),
  );
  // Gasto é uma métrica DIÁRIA: não existe gasto por hora. Numa série horária
  // o total do dia é lançado no primeiro bucket, para o gráfico continuar
  // somando o mesmo que o KPI de gasto em vez de zerar a linha inteira.
  const spend = buckets.map((b) =>
    b.primeiroDoDia
      ? w.metrics.filter((m) => dateColumnKey(m.date) === b.dayKey).reduce((a, m) => a + num(m.spend), 0)
      : 0,
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
      type:
        e.event === "Lead" ? "lead"
        : e.event === "AddToCart" ? "add_to_cart"
        : e.event === "PageView" ? "pageview"
        : "checkout",
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
