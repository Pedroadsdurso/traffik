"use client";

import { useEffect, useRef, useState } from "react";
import {
  createWebhook,
  deleteWebhook,
  toggleWebhook,
  type WebhookRowDTO,
} from "@/lib/actions/webhooks";
import { brl, brl0, buildPoints, elapsed, pct, roasFmt } from "@/lib/format";
import {
  initialAccounts,
  initialAds,
  initialAdsets,
  initialCampaigns,
  initialCreatives,
  initialDespesas,
  initialFeed,
  initialFunnel,
  initialGateways,
  initialPixelEvents,
  initialProducts,
  initialRules,
  initialSources,
} from "./mockData";
import type {
  AdAccount,
  AdItem,
  AdSet,
  Campaign,
  Despesa,
  FeedItem,
  Gateway,
  MetricKey,
  PixelEvent,
  Rule,
  Status,
  TabKey,
  TestLogEntry,
} from "./types";

type DashPeriod = "hoje" | "7d" | "30d" | "custom";

interface RuleForm {
  name: string;
  product: string;
  account: string;
  level: "campanha" | "conjunto" | "anuncio";
  metric: string;
  op: string;
  value: string;
  window: string;
  action: string;
  freq: string;
  active: boolean;
}

interface NotifState {
  newSale: boolean;
  showValue: boolean;
  showProduct: boolean;
  channel: string;
  reports: { time: string; on: boolean }[];
}

interface State {
  activeTab: TabKey;
  adsSub: "campaigns" | "adsets" | "ads" | "accounts";
  fbSub: "contas" | "webhooks" | "pixel" | "testes";
  fbConnected: boolean;
  editDashOpen: boolean;
  dashPeriod: DashPeriod;
  dashAccount: string;
  dashProduct: string;
  dashSource: string;
  adsSearch: string;
  adsStatus: string;
  kpi: { revenue: number; spend: number; sales: number; ctr: number };
  chartRevenue: number[];
  chartSpend: number[];
  metricOrder: MetricKey[];
  metricVisible: Record<MetricKey, boolean>;
  campaigns: Campaign[];
  adsets: AdSet[];
  ads: AdItem[];
  accounts: AdAccount[];
  creatives: typeof initialCreatives;
  fees: { gateways: Gateway[]; taxPct: number; despesas: Despesa[] };
  newDespesaName: string;
  newDespesaValue: string;
  webhooks: WebhookRowDTO[];
  newWebhookPlatform: string;
  newWebhookName: string;
  webhookBusy: boolean;
  copiedWebhookId: string | null;
  pixelEvents: PixelEvent[];
  pixelId: string;
  testEvent: string;
  testLog: TestLogEntry[];
  rules: Rule[];
  ruleForm: RuleForm;
  notif: NotifState;
  utmUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  snippetCopied: boolean;
  linkCopied: boolean;
  feed: FeedItem[];
}

function initialState(initialWebhooks: WebhookRowDTO[] = []): State {
  return {
    activeTab: "dashboard",
    adsSub: "campaigns",
    fbSub: "contas",
    fbConnected: false,
    editDashOpen: false,
    dashPeriod: "7d",
    dashAccount: "todas",
    dashProduct: "todos",
    dashSource: "todas",
    adsSearch: "",
    adsStatus: "todos",
    kpi: { revenue: 18420, spend: 4820, sales: 63, ctr: 2.9 },
    chartRevenue: [820, 860, 910, 780, 940, 1020, 980, 1100, 1150, 1080, 1200, 1260, 1180, 1320, 1400, 1350, 1480, 1520, 1460, 1580],
    chartSpend: [210, 230, 250, 220, 260, 280, 270, 300, 310, 290, 320, 330, 300, 340, 360, 350, 370, 380, 360, 390],
    metricOrder: ["faturamento", "gasto", "roas", "roi", "margem", "vendas", "cpa", "ticket", "ctr", "pendentes", "reembolsadas", "chargeback"],
    metricVisible: {
      faturamento: true, gasto: true, roas: true, roi: true, margem: true, vendas: true,
      cpa: true, ticket: true, ctr: false, pendentes: false, reembolsadas: false, chargeback: false,
    },
    campaigns: initialCampaigns,
    adsets: initialAdsets,
    ads: initialAds,
    accounts: initialAccounts,
    creatives: initialCreatives,
    fees: { gateways: initialGateways, taxPct: 6, despesas: initialDespesas },
    newDespesaName: "",
    newDespesaValue: "",
    webhooks: initialWebhooks,
    newWebhookPlatform: "KIRVANO",
    newWebhookName: "",
    webhookBusy: false,
    copiedWebhookId: null,
    pixelEvents: initialPixelEvents,
    pixelId: "284910375562481",
    testEvent: "Purchase",
    testLog: [],
    rules: initialRules,
    ruleForm: { name: "", product: "todos", account: "todas", level: "campanha", metric: "CPA", op: ">", value: "50", window: "3h", action: "pausar", freq: "30min", active: true },
    notif: { newSale: true, showValue: true, showProduct: true, channel: "whatsapp", reports: [{ time: "08:00", on: true }, { time: "12:00", on: true }, { time: "18:00", on: false }, { time: "23:00", on: true }] },
    utmUrl: "https://seusite.com.br/checkout",
    utmSource: "facebook",
    utmMedium: "cpc",
    utmCampaign: "lancamento-metodo-foco",
    utmContent: "criativo-vsl-ana",
    snippetCopied: false,
    linkCopied: false,
    feed: initialFeed(),
  };
}

const NAV_DEF: Record<TabKey, [string, string]> = {
  dashboard: ["Dashboard", "M40 40 h72 v72 h-72 Z M144 40 h72 v72 h-72 Z M40 144 h72 v72 h-72 Z M144 144 h72 v72 h-72 Z"],
  ads: ["Gerenciador de Anúncios", "M128 40 a88 88 0 100 176 a88 88 0 100 -176 M128 80 a48 48 0 100 96 a48 48 0 100 -96"],
  creatives: ["Criativos", "M32 56 h192 v144 h-192 Z M32 176 L92 128 L140 160 L176 120 L224 164"],
  rules: ["Regras", "M144 24 L48 144 h64 l-16 88 96 -128 h-64 Z"],
  notifications: ["Notificações", "M128 32 a56 56 0 00-56 56 c0 46 -24 58 -24 72 h160 c0 -14 -24 -26 -24 -72 a56 56 0 00-56 -56 Z M104 216 a24 24 0 0048 0"],
  fees: ["Taxas e Despesas", "M72 184 L184 72 M80 56 a24 24 0 100 48 a24 24 0 100 -48 M176 152 a24 24 0 100 48 a24 24 0 100 -48"],
  facebook: ["Facebook Ads", "M96 72 a56 56 0 100 112 a56 56 0 100 -112 M160 72 a56 56 0 100 112 a56 56 0 100 -112"],
  utm: ["Rastreamento UTM", "M88 72 L32 128 L88 184 M168 72 L224 128 L168 184"],
};

const TITLES: Record<TabKey, [string, string]> = {
  dashboard: ["Dashboard", "Visão geral do tráfego, vendas e retorno em tempo real"],
  ads: ["Gerenciador de Anúncios", "Administre campanhas, conjuntos e anúncios do Facebook Ads"],
  creatives: ["Ranking de Criativos", "Os anúncios com melhor performance hoje"],
  rules: ["Regras de Automação", "Automatize pausas, escalas e alertas por condição"],
  notifications: ["Notificações", "Alertas de venda e relatórios programados"],
  fees: ["Taxas e Despesas", "Configure custos para um cálculo de lucro preciso"],
  facebook: ["Facebook Ads", "Contas, webhooks, pixel e testes de integração"],
  utm: ["Rastreamento UTM", "Instale o pixel e gere links com parâmetros UTM"],
};

const PERIOD_MULT: Record<DashPeriod, number> = { hoje: 1, "7d": 6.4, "30d": 27, custom: 6.4 };

function jitter(v: number, pctAmount: number): number {
  return Math.max(0, v * (1 + (Math.random() - 0.5) * pctAmount));
}

const UP_PATH = "M32 176 L96 112 L136 144 L224 64 M176 64 L224 64 L224 112";
const DOWN_PATH = "M32 80 L96 144 L136 112 L224 192 M176 192 L224 192 L224 144";

export function useTraffikState(
  opts: {
    brandName?: string;
    liveUpdates?: boolean;
    trackingId?: string;
    appUrl?: string;
    initialWebhooks?: WebhookRowDTO[];
  } = {},
) {
  const brandName = opts.brandName || "Traffik";
  const liveUpdates = opts.liveUpdates !== false;
  const trackingId = opts.trackingId || "SEU_ID";
  const appUrl = (opts.appUrl || "https://app.traffik.io").replace(/\/+$/, "");

  const [s, setS] = useState<State>(() => initialState(opts.initialWebhooks));
  const nextFeedId = useRef(6);

  useEffect(() => {
    if (!liveUpdates) return;
    const t = setInterval(() => {
      if (Math.random() < 0.6) {
        setS((st) => {
          const isSale = Math.random() < 0.4;
          const camp = st.campaigns[Math.floor(Math.random() * st.campaigns.length)];
          const sources = ["Facebook", "Instagram"];
          const item: FeedItem = {
            id: nextFeedId.current++,
            type: isSale ? "venda" : "clique",
            source: sources[Math.floor(Math.random() * sources.length)],
            campaign: camp.name.split(" — ")[0],
            value: isSale ? Math.round(197 + Math.random() * 800) : undefined,
            ts: Date.now(),
          };
          return { ...st, feed: [item, ...st.feed].slice(0, 6) };
        });
      }
      setS((st) => ({
        ...st,
        kpi: {
          revenue: jitter(st.kpi.revenue, 0.04),
          spend: jitter(st.kpi.spend, 0.03),
          sales: Math.max(1, Math.round(jitter(st.kpi.sales, 0.06))),
          ctr: Math.max(0.5, jitter(st.kpi.ctr, 0.05)),
        },
        chartRevenue: [...st.chartRevenue.slice(1), jitter(st.chartRevenue[st.chartRevenue.length - 1], 0.08)],
        chartSpend: [...st.chartSpend.slice(1), jitter(st.chartSpend[st.chartSpend.length - 1], 0.08)],
      }));
    }, 3000);
    return () => clearInterval(t);
  }, [liveUpdates]);

  function set(patch: Partial<State>) {
    setS((st) => ({ ...st, ...patch }));
  }
  function setNested<K extends keyof State>(key: K, sub: string, val: unknown) {
    setS((st) => ({ ...st, [key]: { ...(st[key] as object), [sub]: val } }));
  }

  const mult = PERIOD_MULT[s.dashPeriod] || 1;
  const revenue = s.kpi.revenue * mult;
  const spend = s.kpi.spend * mult;
  const sales = Math.round(s.kpi.sales * mult);
  const ticket = sales ? revenue / sales : 0;
  const cpa = sales ? spend / sales : 0;
  const roas = spend ? revenue / spend : 0;
  const gatewayPct = s.fees.gateways.reduce((a, g) => a + g.pct, 0) / s.fees.gateways.length;
  const gatewayCost = (revenue * gatewayPct) / 100;
  const taxCost = (revenue * s.fees.taxPct) / 100;
  const despesasTotal = s.fees.despesas.reduce((a, d) => a + d.value, 0) * (mult / 6.4);
  const profit = revenue - spend - gatewayCost - taxCost - despesasTotal;
  const totalCost = spend + gatewayCost + taxCost + despesasTotal;
  const roi = totalCost ? (profit / totalCost) * 100 : 0;
  const margin = revenue ? (profit / revenue) * 100 : 0;
  const pendentes = Math.round(sales * 0.11);
  const reembolsadas = Math.round(sales * 0.04);
  const chargeback = 0.4;

  const A = "var(--color-accent-300)";
  const N = "var(--color-neutral-400)";
  const reg: Record<MetricKey, { label: string; value: string; trendColor: string; trendPath: string; trendLabel: string }> = {
    faturamento: { label: "Faturamento", value: brl(revenue), trendColor: A, trendPath: UP_PATH, trendLabel: "+4,2% vs. período ant." },
    gasto: { label: "Gasto total", value: brl(spend), trendColor: N, trendPath: DOWN_PATH, trendLabel: "+2,1% vs. período ant." },
    roas: { label: "ROAS", value: roasFmt(roas), trendColor: A, trendPath: UP_PATH, trendLabel: "acima da meta (3x)" },
    roi: { label: "ROI", value: roi.toFixed(0) + "%", trendColor: A, trendPath: UP_PATH, trendLabel: "sobre custo total" },
    margem: { label: "Margem de lucro", value: pct(margin), trendColor: A, trendPath: UP_PATH, trendLabel: "líquida" },
    vendas: { label: "Vendas", value: String(sales), trendColor: A, trendPath: UP_PATH, trendLabel: "aprovadas" },
    cpa: { label: "CPA", value: brl(cpa), trendColor: N, trendPath: DOWN_PATH, trendLabel: "-1,8% vs. período ant." },
    ticket: { label: "Ticket médio", value: brl(ticket), trendColor: A, trendPath: UP_PATH, trendLabel: "+3,0% vs. período ant." },
    ctr: { label: "CTR", value: pct(s.kpi.ctr), trendColor: A, trendPath: UP_PATH, trendLabel: "+0,3pp vs. período ant." },
    pendentes: { label: "Vendas pendentes", value: String(pendentes), trendColor: N, trendPath: DOWN_PATH, trendLabel: "aguardando pgto." },
    reembolsadas: { label: "Reembolsadas", value: String(reembolsadas), trendColor: N, trendPath: DOWN_PATH, trendLabel: "no período" },
    chargeback: { label: "Taxa de chargeback", value: pct(chargeback), trendColor: A, trendPath: UP_PATH, trendLabel: "dentro do saudável" },
  };
  const kpiCards = s.metricOrder.filter((k) => s.metricVisible[k]).map((k) => reg[k]);
  const metricList = s.metricOrder.map((k, i) => ({
    key: k,
    label: reg[k].label,
    on: !!s.metricVisible[k],
    toggle: () => setS((st) => ({ ...st, metricVisible: { ...st.metricVisible, [k]: !st.metricVisible[k] } })),
    moveUp: () =>
      setS((st) => {
        if (i === 0) return st;
        const o = [...st.metricOrder];
        [o[i - 1], o[i]] = [o[i], o[i - 1]];
        return { ...st, metricOrder: o };
      }),
    moveDown: () =>
      setS((st) => {
        if (i === st.metricOrder.length - 1) return st;
        const o = [...st.metricOrder];
        [o[i + 1], o[i]] = [o[i], o[i + 1]];
        return { ...st, metricOrder: o };
      }),
  }));

  const W = 600, H = 180, PAD = 12;
  const combinedMax = Math.max(...s.chartRevenue, ...s.chartSpend) * 1.15;
  const revenueLine = buildPoints(s.chartRevenue, combinedMax, W, H, PAD);
  const spendLine = buildPoints(s.chartSpend, combinedMax, W, H, PAD);
  const lastPt = revenueLine.split(" ").pop()!.split(",");
  const chart = { revenueLine, spendLine, revenueArea: "0," + H + " " + revenueLine + " " + W + "," + H, lastX: lastPt[0], lastY: lastPt[1] };
  const chartPeriodLabel = { hoje: "Hoje · por hora", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", custom: "Período personalizado" }[s.dashPeriod];

  const prodMax = Math.max(...initialProducts.map((p) => p.total));
  const products = initialProducts.map((p) => ({
    name: p.name,
    sales: Math.round((p.sales * mult) / 6.4) || p.sales,
    totalLabel: brl0((p.total * mult) / 6.4),
    barWidth: Math.round((p.total / prodMax) * 100) + "%",
  }));
  const srcTotal = initialSources.reduce((a, x) => a + x.total, 0);
  const srcMax = Math.max(...initialSources.map((x) => x.total));
  const sources = initialSources.map((x) => ({
    name: x.name,
    totalLabel: brl0((x.total * mult) / 6.4),
    pctLabel: Math.round((x.total / srcTotal) * 100) + "%",
    barWidth: Math.round((x.total / srcMax) * 100) + "%",
  }));
  const fb = initialFunnel;
  const funnel = [
    { label: "Cliques", count: Math.round((fb.cliques * mult) / 6.4).toLocaleString("pt-BR"), height: "120px", color: "var(--color-accent-800)", hasRate: false, rate: "" },
    { label: "Checkouts iniciados", count: Math.round((fb.checkouts * mult) / 6.4).toLocaleString("pt-BR"), height: "72px", color: "var(--color-accent-600)", hasRate: true, rate: ((fb.checkouts / fb.cliques) * 100).toFixed(1).replace(".", ",") + "%" },
    { label: "Vendas", count: Math.round((fb.vendas * mult) / 6.4).toLocaleString("pt-BR"), height: "38px", color: "var(--color-accent)", hasRate: true, rate: ((fb.vendas / fb.checkouts) * 100).toFixed(1).replace(".", ",") + "%" },
  ];

  const feed = s.feed.map((f) => ({
    ...f,
    tagClass: f.type === "venda" ? "tag tag-accent" : "tag tag-outline",
    typeLabel: f.type === "venda" ? "Venda" : "Clique",
    valueLabel: f.value ? brl(f.value) : "—",
    timeLabel: elapsed(f.ts),
  }));

  const statusTag = (st: Status) => (st === "ativo" ? "tag tag-accent" : "tag tag-neutral");
  const statusLabel = (st: Status) => (st === "ativo" ? "Ativo" : "Pausado");
  function decoRow<T extends { status: Status; spend: number; cpa: number; ctr: number; roas: number }>(a: T) {
    return { ...a, statusTag: statusTag(a.status), statusLabel: statusLabel(a.status), spendLabel: brl(a.spend), cpaLabel: brl(a.cpa), ctrLabel: pct(a.ctr), roasLabel: roasFmt(a.roas) };
  }
  const matchFilter = (name: string, st: string) => name.toLowerCase().includes(s.adsSearch.toLowerCase()) && (s.adsStatus === "todos" || st === s.adsStatus);

  const campaignsView = s.campaigns.map((c) => ({
    ...decoRow(c),
    budgetLabel: brl(c.budget),
    toggleIconPath: c.status === "ativo" ? "M88 64 h28 v128 h-28 Z M140 64 h28 v128 h-28 Z" : "M96 72 L96 184 L192 128 Z",
    toggle: () => setS((st) => ({ ...st, campaigns: st.campaigns.map((x) => (x.id === c.id ? { ...x, status: x.status === "ativo" ? "pausado" : "ativo" } : x)) })),
  }));
  const filteredCampaigns = campaignsView.filter((c) => matchFilter(c.name, c.status));
  const filteredAdsets = s.adsets.map(decoRow).filter((a) => matchFilter(a.name, a.status));
  const filteredAds = s.ads.map((a, i) => ({ ...decoRow(a), slotId: "ad-" + i })).filter((a) => matchFilter(a.name, a.status));
  const accounts = s.accounts.map((a) => ({
    ...a,
    spendLabel: brl0(a.spend),
    roasLabel: roasFmt(a.roas),
    trackingTag: a.tracking ? "tag tag-accent" : "tag tag-neutral",
    trackingLabel: a.tracking ? "Rastreando" : "Pausado",
    trackingOn: a.tracking,
    toggleTracking: () => setS((st) => ({ ...st, accounts: st.accounts.map((x) => (x.id === a.id ? { ...x, tracking: !x.tracking } : x)) })),
  }));
  const creatives = s.creatives.map((c) => ({ ...c, slotId: "creative-" + c.id, spendLabel: brl(c.spend), ctrLabel: pct(c.ctr), roasLabel: roasFmt(c.roas) }));

  const adsTabs = (["campaigns", "adsets", "ads", "accounts"] as const).map((k, i) => ({
    key: k,
    label: ["Campanhas", "Conjuntos", "Anúncios", "Contas"][i],
    checked: s.adsSub === k,
    go: () => set({ adsSub: k }),
  }));
  const fbTabs = (["contas", "webhooks", "pixel", "testes"] as const).map((k, i) => ({
    key: k,
    label: ["Contas", "Webhooks", "Pixel", "Testes"][i],
    checked: s.fbSub === k,
    go: () => set({ fbSub: k }),
  }));

  const gatewayRows = s.fees.gateways.map((g, i) => ({
    name: g.name,
    pctStr: String(g.pct),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setS((st) => ({ ...st, fees: { ...st.fees, gateways: st.fees.gateways.map((x, j) => (j === i ? { ...x, pct: parseFloat(e.target.value) || 0 } : x)) } })),
  }));
  const despesaRows = s.fees.despesas.map((d, i) => ({
    name: d.name,
    valueLabel: brl0(d.value),
    remove: () => setS((st) => ({ ...st, fees: { ...st.fees, despesas: st.fees.despesas.filter((_, j) => j !== i) } })),
  }));

  const rules = s.rules.map((r) => ({
    ...r,
    toggle: () => setS((st) => ({ ...st, rules: st.rules.map((x) => (x.id === r.id ? { ...x, on: !x.on } : x)) })),
  }));

  const reports = s.notif.reports.map((rp, i) => ({
    time: rp.time,
    on: rp.on,
    toggle: () => setS((st) => ({ ...st, notif: { ...st.notif, reports: st.notif.reports.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) } })),
  }));
  const previewParts = ["Nova venda aprovada"];
  if (s.notif.showValue) previewParts.push("R$ 497,00");
  if (s.notif.showProduct) previewParts.push("Método Foco 3.0");
  const notifPreview = previewParts.join(" · ");

  const pixelEvents = s.pixelEvents.map((pe, i) => ({
    ...pe,
    toggle: () => setS((st) => ({ ...st, pixelEvents: st.pixelEvents.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })),
  }));

  // Monta a URL preservando a query já existente e ignorando UTMs vazios.
  const generatedLink = (() => {
    const base = (s.utmUrl || "").trim();
    if (!base) return "";
    const utmPairs: [string, string][] = [
      ["utm_source", s.utmSource],
      ["utm_medium", s.utmMedium],
      ["utm_campaign", s.utmCampaign],
      ["utm_content", s.utmContent],
    ];
    try {
      const url = new URL(base);
      for (const [k, val] of utmPairs) {
        if (val && val.trim()) url.searchParams.set(k, val.trim());
      }
      return url.toString();
    } catch {
      // Fallback quando a URL ainda está incompleta enquanto o usuário digita.
      const query = utmPairs
        .filter(([, val]) => val && val.trim())
        .map(([k, val]) => `${k}=${encodeURIComponent(val.trim())}`)
        .join("&");
      const sep = base.includes("?") ? "&" : "?";
      return query ? `${base}${sep}${query}` : base;
    }
  })();

  const snippetText = `<script src="${appUrl}/pixel.js" data-account="${trackingId}" async></script>`;

  return {
    brandName,
    brandInitial: brandName.charAt(0),
    navAnalise: (["dashboard", "ads", "creatives"] as TabKey[]).map((key) => ({ key, label: NAV_DEF[key][0], icon: NAV_DEF[key][1], active: key === s.activeTab, go: () => set({ activeTab: key }) })),
    navAuto: (["rules", "notifications"] as TabKey[]).map((key) => ({ key, label: NAV_DEF[key][0], icon: NAV_DEF[key][1], active: key === s.activeTab, go: () => set({ activeTab: key }) })),
    navConfig: (["fees", "facebook", "utm"] as TabKey[]).map((key) => ({ key, label: NAV_DEF[key][0], icon: NAV_DEF[key][1], active: key === s.activeTab, go: () => set({ activeTab: key }) })),
    pageTitle: TITLES[s.activeTab][0],
    pageSubtitle: TITLES[s.activeTab][1],
    activeTab: s.activeTab,

    fbConnected: s.fbConnected,
    activeAccountCount: s.accounts.filter((a) => a.tracking).length + " contas",

    dashPeriod: s.dashPeriod,
    dashAccount: s.dashAccount,
    dashProduct: s.dashProduct,
    dashSource: s.dashSource,
    onDashPeriod: (e: React.ChangeEvent<HTMLSelectElement>) => set({ dashPeriod: e.target.value as DashPeriod }),
    onDashAccount: (e: React.ChangeEvent<HTMLSelectElement>) => set({ dashAccount: e.target.value }),
    onDashProduct: (e: React.ChangeEvent<HTMLSelectElement>) => set({ dashProduct: e.target.value }),
    onDashSource: (e: React.ChangeEvent<HTMLSelectElement>) => set({ dashSource: e.target.value }),

    kpiCards, chart, chartPeriodLabel, products, sources, funnel, feed, metricList,

    editDashOpen: s.editDashOpen,
    openEditDash: () => set({ editDashOpen: true }),
    closeEditDash: () => set({ editDashOpen: false }),

    adsTabs,
    adsSub: s.adsSub,
    adsSearch: s.adsSearch,
    adsStatus: s.adsStatus,
    onAdsSearch: (e: React.ChangeEvent<HTMLInputElement>) => set({ adsSearch: e.target.value }),
    onAdsStatus: (e: React.ChangeEvent<HTMLSelectElement>) => set({ adsStatus: e.target.value }),
    filteredCampaigns, filteredAdsets, filteredAds, accounts, creatives,

    connectFacebook: () => set({ fbConnected: true }),
    disconnectFacebook: () => set({ fbConnected: false }),
    fbTabs,
    fbSub: s.fbSub,

    webhooks: s.webhooks,
    newWebhookPlatform: s.newWebhookPlatform,
    newWebhookName: s.newWebhookName,
    webhookBusy: s.webhookBusy,
    onNewWebhookPlatform: (e: React.ChangeEvent<HTMLSelectElement>) => set({ newWebhookPlatform: e.target.value }),
    onNewWebhookName: (e: React.ChangeEvent<HTMLInputElement>) => set({ newWebhookName: e.target.value }),
    addWebhook: async () => {
      set({ webhookBusy: true });
      try {
        const created = await createWebhook({ platform: s.newWebhookPlatform, name: s.newWebhookName });
        setS((st) => ({ ...st, webhooks: [...st.webhooks, created], newWebhookName: "", webhookBusy: false }));
      } catch {
        set({ webhookBusy: false });
      }
    },
    toggleWebhook: async (id: string) => {
      const updated = await toggleWebhook(id);
      setS((st) => ({ ...st, webhooks: st.webhooks.map((w) => (w.id === id ? updated : w)) }));
    },
    removeWebhook: async (id: string) => {
      await deleteWebhook(id);
      setS((st) => ({ ...st, webhooks: st.webhooks.filter((w) => w.id !== id) }));
    },
    copiedWebhookId: s.copiedWebhookId,
    copyWebhookUrl: (id: string, url: string) => {
      navigator.clipboard.writeText(url);
      set({ copiedWebhookId: id });
      setTimeout(() => set({ copiedWebhookId: null }), 1500);
    },
    webhookPlatformLabel: (p: string) =>
      ({ KIRVANO: "Kirvano", HOTMART: "Hotmart", KIWIFY: "Kiwify", CUSTOM: "Custom" })[p] ?? p,

    pixelEvents,
    pixelId: s.pixelId,
    onPixelId: (e: React.ChangeEvent<HTMLInputElement>) => set({ pixelId: e.target.value }),
    testEvent: s.testEvent,
    onTestEvent: (e: React.ChangeEvent<HTMLSelectElement>) => set({ testEvent: e.target.value }),
    testLog: s.testLog,
    fireTest: () =>
      setS((st) => ({ ...st, testLog: [{ event: st.testEvent, status: "200 OK", time: new Date().toLocaleTimeString("pt-BR") }, ...st.testLog].slice(0, 6) })),

    gatewayRows,
    taxPctStr: String(s.fees.taxPct),
    onTaxPct: (e: React.ChangeEvent<HTMLInputElement>) => setNested("fees", "taxPct", parseFloat(e.target.value) || 0),
    despesaRows,
    newDespesaName: s.newDespesaName,
    newDespesaValue: s.newDespesaValue,
    onNewDespesaName: (e: React.ChangeEvent<HTMLInputElement>) => set({ newDespesaName: e.target.value }),
    onNewDespesaValue: (e: React.ChangeEvent<HTMLInputElement>) => set({ newDespesaValue: e.target.value }),
    addDespesa: () =>
      setS((st) => {
        const v = parseFloat(st.newDespesaValue) || 0;
        if (!st.newDespesaName || !v) return st;
        return { ...st, fees: { ...st.fees, despesas: [...st.fees.despesas, { name: st.newDespesaName, value: v }] }, newDespesaName: "", newDespesaValue: "" };
      }),
    finance: { revenue: brl(revenue), spend: brl(spend), gateway: brl(gatewayCost), tax: brl(taxCost), despesas: brl(despesasTotal), profit: brl(profit), margin: pct(margin) },

    rules,
    addRule: () =>
      setS((st) => {
        const f = st.ruleForm;
        const actionLabel: Record<string, string> = { pausar: "pausar", aumentar: "aumentar orçamento 20%", reduzir: "reduzir orçamento 20%", notificar: "notificar" };
        const summary = "Se " + f.metric + " " + f.op + " " + f.value + " em " + f.window + " → " + actionLabel[f.action];
        const freqLabel: Record<string, string> = { "15min": "A cada 15 min", "30min": "A cada 30 min", "1h": "A cada 1h" };
        const name = f.name || f.metric + " " + f.op + " " + f.value;
        return { ...st, rules: [{ id: Date.now(), name, summary, freq: freqLabel[f.freq], on: f.active }, ...st.rules], ruleForm: { ...f, name: "", value: "" } };
      }),
    ruleForm: s.ruleForm,
    onRuleLevelCampanha: () => setNested("ruleForm", "level", "campanha"),
    onRuleLevelConjunto: () => setNested("ruleForm", "level", "conjunto"),
    onRuleLevelAnuncio: () => setNested("ruleForm", "level", "anuncio"),
    onRuleName: (e: React.ChangeEvent<HTMLInputElement>) => setNested("ruleForm", "name", e.target.value),
    onRuleProduct: (e: React.ChangeEvent<HTMLSelectElement>) => setNested("ruleForm", "product", e.target.value),
    onRuleAccount: (e: React.ChangeEvent<HTMLSelectElement>) => setNested("ruleForm", "account", e.target.value),
    onRuleMetric: (e: React.ChangeEvent<HTMLSelectElement>) => setNested("ruleForm", "metric", e.target.value),
    onRuleOp: (e: React.ChangeEvent<HTMLSelectElement>) => setNested("ruleForm", "op", e.target.value),
    onRuleValue: (e: React.ChangeEvent<HTMLInputElement>) => setNested("ruleForm", "value", e.target.value),
    onRuleWindow: (e: React.ChangeEvent<HTMLSelectElement>) => setNested("ruleForm", "window", e.target.value),
    onRuleAction: (e: React.ChangeEvent<HTMLSelectElement>) => setNested("ruleForm", "action", e.target.value),
    onRuleFreq: (e: React.ChangeEvent<HTMLSelectElement>) => setNested("ruleForm", "freq", e.target.value),
    onRuleActive: () => setS((st) => ({ ...st, ruleForm: { ...st.ruleForm, active: !st.ruleForm.active } })),

    notif: { newSale: s.notif.newSale, showValue: s.notif.showValue, showProduct: s.notif.showProduct, channel: s.notif.channel, preview: notifPreview },
    toggleNewSale: () => setNested("notif", "newSale", !s.notif.newSale),
    toggleShowValue: () => setNested("notif", "showValue", !s.notif.showValue),
    toggleShowProduct: () => setNested("notif", "showProduct", !s.notif.showProduct),
    onNotifChannel: (e: React.ChangeEvent<HTMLSelectElement>) => setNested("notif", "channel", e.target.value),
    reports,

    snippetText,
    trackingId,
    appUrl,
    snippetCopyLabel: s.snippetCopied ? "Copiado!" : "Copiar snippet",
    copySnippet: () => {
      navigator.clipboard.writeText(snippetText);
      set({ snippetCopied: true });
      setTimeout(() => set({ snippetCopied: false }), 1500);
    },
    utmUrl: s.utmUrl, utmSource: s.utmSource, utmMedium: s.utmMedium, utmCampaign: s.utmCampaign, utmContent: s.utmContent,
    onUtmUrl: (e: React.ChangeEvent<HTMLInputElement>) => set({ utmUrl: e.target.value }),
    onUtmSource: (e: React.ChangeEvent<HTMLSelectElement>) => set({ utmSource: e.target.value }),
    onUtmMedium: (e: React.ChangeEvent<HTMLInputElement>) => set({ utmMedium: e.target.value }),
    onUtmCampaign: (e: React.ChangeEvent<HTMLInputElement>) => set({ utmCampaign: e.target.value }),
    onUtmContent: (e: React.ChangeEvent<HTMLInputElement>) => set({ utmContent: e.target.value }),
    generatedLink,
    linkCopyLabel: s.linkCopied ? "Copiado!" : "Copiar link",
    copyLink: () => {
      navigator.clipboard.writeText(generatedLink);
      set({ linkCopied: true });
      setTimeout(() => set({ linkCopied: false }), 1500);
    },
  };
}

export type TraffikView = ReturnType<typeof useTraffikState>;
