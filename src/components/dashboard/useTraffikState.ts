"use client";

import { useCallback, useEffect, useState } from "react";
import { saveDashboardPrefs, type DashboardPrefsDTO } from "@/lib/actions/dashboardPrefs";
import {
  disconnectProfile,
  toggleAccountTracking,
  type AdProfileDTO,
} from "@/lib/actions/facebook";
import {
  createPixel,
  deletePixel,
  togglePixel,
  updateEventRule,
  type PixelConfigDTO,
} from "@/lib/actions/pixels";
import {
  createExpense,
  deleteExpense,
  updateExpense,
  type ExpenseDTO,
} from "@/lib/actions/expenses";
import {
  markAllNotificationsRead,
  updateNotificationSettings,
  type NotificationDTO,
  type NotificationSettingsDTO,
} from "@/lib/actions/notifications";
import {
  createRule,
  deleteRule,
  listRules,
  toggleRule,
  type RuleDTO,
} from "@/lib/actions/rules";
import type { PixelEventType, PurchaseSendMode, PurchaseValueMode, RuleAction, RuleLevel } from "@/generated/prisma/enums";
import {
  createWebhook,
  deleteWebhook,
  toggleWebhook,
  type WebhookRowDTO,
} from "@/lib/actions/webhooks";
import type { CreativeRow } from "@/lib/ads/creatives";
import type { AdsOverview } from "@/lib/ads/overview";
import type { DashboardData } from "@/lib/dashboard/metrics";
import { brl, brl0, buildPoints, elapsed, pct, roasFmt } from "@/lib/format";
import {
  initialAccounts,
  initialAds,
  initialAdsets,
  initialCampaigns,
  initialCreatives,
  initialPixelEvents,
} from "./mockData";
import type {
  AdAccount,
  AdItem,
  AdSet,
  Campaign,
  MetricKey,
  PixelEvent,
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
  budgetPct: string;
  freq: string;
  dailyLimit: string;
  active: boolean;
}

const DEFAULT_NOTIF_SETTINGS: NotificationSettingsDTO = {
  notifyPendingSale: true,
  notifyApprovedSale: true,
  showValue: true,
  showProductName: true,
  showUtmCampaign: true,
  showDashboardName: false,
  report08: false,
  report12: false,
  report18: false,
  report23: true,
  reportPattern: "STATUS_LUCRO",
};

interface State {
  activeTab: TabKey;
  adsSub: "campaigns" | "adsets" | "ads" | "accounts";
  fbSub: "contas" | "webhooks" | "pixel" | "testes";
  fbConnected: boolean;
  adProfiles: AdProfileDTO[];
  expandedProfiles: Record<string, boolean>;
  pixels: PixelConfigDTO[];
  newPixelName: string;
  newPixelId: string;
  newPixelToken: string;
  pixelBusy: boolean;
  editDashOpen: boolean;
  dashPeriod: DashPeriod;
  dashAccount: string;
  dashProduct: string;
  dashSource: string;
  adsSearch: string;
  adsStatus: string;
  adsPeriod: "hoje" | "7d" | "30d";
  adsAccount: string;
  adsData: AdsOverview | null;
  adsLoading: boolean;
  adsRefreshKey: number;
  adsBusyId: string | null;
  newCampaignOpen: boolean;
  newCampaignAccount: string;
  newCampaignName: string;
  newCampaignObjective: string;
  newCampaignBudget: string;
  newCampaignBusy: boolean;
  creativesPeriod: "hoje" | "7d" | "30d";
  creativesSort: "roas" | "ctr" | "spend" | "sales";
  creativesData: CreativeRow[] | null;
  creativesLoading: boolean;
  dashData: DashboardData | null;
  dashLoading: boolean;
  refreshKey: number;
  syncBusy: boolean;
  syncResult: string | null;
  metricOrder: MetricKey[];
  metricVisible: Record<MetricKey, boolean>;
  campaigns: Campaign[];
  adsets: AdSet[];
  ads: AdItem[];
  accounts: AdAccount[];
  creatives: typeof initialCreatives;
  expenses: ExpenseDTO[];
  newDespesaName: string;
  newDespesaValue: string;
  newGatewayMethod: string;
  newGatewayPct: string;
  newTaxName: string;
  newTaxPct: string;
  webhooks: WebhookRowDTO[];
  newWebhookPlatform: string;
  newWebhookName: string;
  webhookBusy: boolean;
  copiedWebhookId: string | null;
  pixelEvents: PixelEvent[];
  pixelId: string;
  testEvent: string;
  testLog: TestLogEntry[];
  rules: RuleDTO[];
  ruleBusy: boolean;
  ruleRunBusy: boolean;
  ruleRunResult: string | null;
  ruleForm: RuleForm;
  notifSettings: NotificationSettingsDTO;
  notifications: NotificationDTO[];
  notifUnread: number;
  notifOpen: boolean;
  utmUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  snippetCopied: boolean;
  linkCopied: boolean;
}

const DEFAULT_METRIC_ORDER: MetricKey[] = [
  "faturamento", "gasto", "roas", "roi", "margem", "vendas",
  "cpa", "ticket", "ctr", "pendentes", "reembolsadas", "chargeback",
];
const DEFAULT_METRIC_VISIBLE: Record<MetricKey, boolean> = {
  faturamento: true, gasto: true, roas: true, roi: true, margem: true, vendas: true,
  cpa: true, ticket: true, ctr: false, pendentes: false, reembolsadas: false, chargeback: false,
};

function initialState(
  initialWebhooks: WebhookRowDTO[] = [],
  prefs?: DashboardPrefsDTO | null,
  initialProfiles: AdProfileDTO[] = [],
  initialPixels: PixelConfigDTO[] = [],
  initialRulesDTO: RuleDTO[] = [],
  initialNotifSettings: NotificationSettingsDTO = DEFAULT_NOTIF_SETTINGS,
  initialNotifications: NotificationDTO[] = [],
  initialExpenses: ExpenseDTO[] = [],
): State {
  const order = prefs?.order?.length
    ? (prefs.order.filter((k) => DEFAULT_METRIC_ORDER.includes(k as MetricKey)) as MetricKey[])
    : DEFAULT_METRIC_ORDER;
  // Garante que nenhuma métrica nova fique de fora de uma preferência antiga.
  const fullOrder = [...order, ...DEFAULT_METRIC_ORDER.filter((k) => !order.includes(k))];
  const visible = { ...DEFAULT_METRIC_VISIBLE, ...(prefs?.visible ?? {}) } as Record<MetricKey, boolean>;

  return {
    activeTab: "dashboard",
    adsSub: "campaigns",
    fbSub: "contas",
    fbConnected: initialProfiles.length > 0,
    adProfiles: initialProfiles,
    expandedProfiles: {},
    pixels: initialPixels,
    newPixelName: "",
    newPixelId: "",
    newPixelToken: "",
    pixelBusy: false,
    editDashOpen: false,
    dashPeriod: "7d",
    dashAccount: "todas",
    dashProduct: "todos",
    dashSource: "todas",
    adsSearch: "",
    adsStatus: "todos",
    adsPeriod: "7d",
    adsAccount: "todas",
    adsData: null,
    adsLoading: true,
    adsRefreshKey: 0,
    adsBusyId: null,
    newCampaignOpen: false,
    newCampaignAccount: "",
    newCampaignName: "",
    newCampaignObjective: "OUTCOME_TRAFFIC",
    newCampaignBudget: "",
    newCampaignBusy: false,
    creativesPeriod: "7d",
    creativesSort: "roas",
    creativesData: null,
    creativesLoading: true,
    dashData: null,
    dashLoading: true,
    refreshKey: 0,
    syncBusy: false,
    syncResult: null,
    metricOrder: fullOrder,
    metricVisible: visible,
    campaigns: initialCampaigns,
    adsets: initialAdsets,
    ads: initialAds,
    accounts: initialAccounts,
    creatives: initialCreatives,
    expenses: initialExpenses,
    newDespesaName: "",
    newDespesaValue: "",
    newGatewayMethod: "PIX",
    newGatewayPct: "",
    newTaxName: "",
    newTaxPct: "",
    webhooks: initialWebhooks,
    newWebhookPlatform: "KIRVANO",
    newWebhookName: "",
    webhookBusy: false,
    copiedWebhookId: null,
    pixelEvents: initialPixelEvents,
    pixelId: "284910375562481",
    testEvent: "Purchase",
    testLog: [],
    rules: initialRulesDTO,
    ruleBusy: false,
    ruleRunBusy: false,
    ruleRunResult: null,
    ruleForm: { name: "", product: "todos", account: "todas", level: "campanha", metric: "CPA", op: ">", value: "50", window: "hoje", action: "pausar", budgetPct: "20", freq: "30min", dailyLimit: "10", active: true },
    notifSettings: initialNotifSettings,
    notifications: initialNotifications,
    notifUnread: initialNotifications.filter((n) => !n.read).length,
    notifOpen: false,
    utmUrl: "https://seusite.com.br/checkout",
    utmSource: "facebook",
    utmMedium: "cpc",
    utmCampaign: "lancamento-metodo-foco",
    utmContent: "criativo-vsl-ana",
    snippetCopied: false,
    linkCopied: false,
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

const UP_PATH = "M32 176 L96 112 L136 144 L224 64 M176 64 L224 64 L224 112";
const DOWN_PATH = "M32 80 L96 144 L136 112 L224 192 M176 192 L224 192 L224 144";

export function useTraffikState(
  opts: {
    brandName?: string;
    liveUpdates?: boolean;
    trackingId?: string;
    appUrl?: string;
    initialWebhooks?: WebhookRowDTO[];
    dashboardPrefs?: DashboardPrefsDTO | null;
    initialProfiles?: AdProfileDTO[];
    initialPixels?: PixelConfigDTO[];
    initialRules?: RuleDTO[];
    initialNotifSettings?: NotificationSettingsDTO;
    initialNotifications?: NotificationDTO[];
    initialExpenses?: ExpenseDTO[];
  } = {},
) {
  const brandName = opts.brandName || "Traffik";
  const liveUpdates = opts.liveUpdates !== false;
  const trackingId = opts.trackingId || "SEU_ID";
  const appUrl = (opts.appUrl || "https://app.traffik.io").replace(/\/+$/, "");

  const [s, setS] = useState<State>(() => initialState(opts.initialWebhooks, opts.dashboardPrefs, opts.initialProfiles, opts.initialPixels, opts.initialRules, opts.initialNotifSettings, opts.initialNotifications, opts.initialExpenses));

  function set(patch: Partial<State>) {
    setS((st) => ({ ...st, ...patch }));
  }
  function setNested<K extends keyof State>(key: K, sub: string, val: unknown) {
    setS((st) => ({ ...st, [key]: { ...(st[key] as object), [sub]: val } }));
  }

  // Busca as métricas reais e faz polling a cada 15s; refaz ao mudar um filtro.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      const qs = new URLSearchParams({
        period: s.dashPeriod,
        account: s.dashAccount,
        product: s.dashProduct,
        source: s.dashSource,
      });
      try {
        const res = await fetch(`/api/dashboard?${qs.toString()}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as DashboardData;
        if (active) setS((st) => ({ ...st, dashData: data, dashLoading: false }));
      } catch {
        /* abortado ou erro de rede — mantém dados anteriores */
      }
    }
    load();
    if (!liveUpdates) return () => { active = false; controller.abort(); };
    const t = setInterval(load, 15000);
    return () => { active = false; controller.abort(); clearInterval(t); };
  }, [s.dashPeriod, s.dashAccount, s.dashProduct, s.dashSource, s.refreshKey, liveUpdates]);

  // Gerenciador de anúncios: busca sob demanda (período/conta) — status e busca
  // são filtrados no cliente para não refazer a cada tecla.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    (async () => {
      const qs = new URLSearchParams({ period: s.adsPeriod, account: s.adsAccount });
      try {
        const res = await fetch(`/api/ads?${qs.toString()}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as AdsOverview;
        if (active) setS((st) => ({ ...st, adsData: data, adsLoading: false }));
      } catch {
        /* abortado ou erro de rede */
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [s.adsPeriod, s.adsAccount, s.adsRefreshKey]);

  // Ranking de criativos.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    (async () => {
      const qs = new URLSearchParams({ period: s.creativesPeriod, sort: s.creativesSort });
      try {
        const res = await fetch(`/api/creatives?${qs.toString()}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { creatives: CreativeRow[] };
        if (active) setS((st) => ({ ...st, creativesData: data.creatives, creativesLoading: false }));
      } catch {
        /* abortado ou erro de rede */
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [s.creativesPeriod, s.creativesSort, s.adsRefreshKey]);

  // Notificações: polling do sino a cada 15s.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch("/api/notifications", { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { items: NotificationDTO[]; unread: number };
        if (active) setS((st) => ({ ...st, notifications: data.items, notifUnread: data.unread }));
      } catch {
        /* abortado ou erro de rede */
      }
    }
    load();
    if (!liveUpdates) return () => { active = false; controller.abort(); };
    const t = setInterval(load, 15000);
    return () => { active = false; controller.abort(); clearInterval(t); };
  }, [liveUpdates]);

  const persistPrefs = useCallback((order: MetricKey[], visible: Record<MetricKey, boolean>) => {
    saveDashboardPrefs({ order, visible }).catch(() => {});
  }, []);

  const d = s.dashData;
  const k = d?.kpis;
  const revenue = k?.revenue ?? 0;
  const spend = k?.spend ?? 0;
  const sales = k?.sales ?? 0;
  const ticket = k?.ticket ?? 0;
  const cpa = k?.cpa ?? 0;
  const roas = k?.roas ?? 0;
  const roi = k?.roi ?? 0;
  const margin = k?.margin ?? 0;
  const ctr = k?.ctr ?? 0;
  const pendentes = k?.pendentes ?? 0;
  const reembolsadas = k?.reembolsadas ?? 0;
  const chargebackRate = k?.chargebackRate ?? 0;

  const A = "var(--color-accent-300)";
  const N = "var(--color-neutral-400)";
  function fmtDelta(v: number | null | undefined): string {
    if (v === null || v === undefined || !isFinite(v)) return "vs. período anterior";
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(1).replace(".", ",")}% vs. período ant.`;
  }
  function trendOf(key: string, invert = false) {
    const dv = d?.deltas?.[key] ?? null;
    const good = dv === null ? true : invert ? dv <= 0 : dv >= 0;
    return { trendColor: good ? A : N, trendPath: (dv ?? 0) >= 0 ? UP_PATH : DOWN_PATH, trendLabel: fmtDelta(dv) };
  }

  const reg: Record<MetricKey, { label: string; value: string; trendColor: string; trendPath: string; trendLabel: string }> = {
    faturamento: { label: "Faturamento", value: brl(revenue), ...trendOf("revenue") },
    gasto: { label: "Gasto total", value: brl(spend), ...trendOf("spend", true) },
    roas: { label: "ROAS", value: roasFmt(roas), ...trendOf("roas") },
    roi: { label: "ROI", value: roi.toFixed(0) + "%", ...trendOf("roi") },
    margem: { label: "Margem de lucro", value: pct(margin), ...trendOf("margem") },
    vendas: { label: "Vendas", value: String(sales), ...trendOf("sales") },
    cpa: { label: "CPA", value: brl(cpa), ...trendOf("cpa", true) },
    ticket: { label: "Ticket médio", value: brl(ticket), ...trendOf("ticket") },
    ctr: { label: "CTR", value: pct(ctr), ...trendOf("ctr") },
    pendentes: { label: "Vendas pendentes", value: String(pendentes), trendColor: N, trendPath: DOWN_PATH, trendLabel: "aguardando pgto." },
    reembolsadas: { label: "Reembolsadas", value: String(reembolsadas), trendColor: N, trendPath: DOWN_PATH, trendLabel: "no período" },
    chargeback: { label: "Taxa de chargeback", value: pct(chargebackRate), trendColor: A, trendPath: UP_PATH, trendLabel: "sobre eventos de venda" },
  };
  const kpiCards = s.metricOrder.filter((key) => s.metricVisible[key]).map((key) => reg[key]);
  const metricList = s.metricOrder.map((key, i) => ({
    key,
    label: reg[key].label,
    on: !!s.metricVisible[key],
    toggle: () => {
      const visible = { ...s.metricVisible, [key]: !s.metricVisible[key] };
      set({ metricVisible: visible });
      persistPrefs(s.metricOrder, visible);
    },
    moveUp: () => {
      if (i === 0) return;
      const o = [...s.metricOrder];
      [o[i - 1], o[i]] = [o[i], o[i - 1]];
      set({ metricOrder: o });
      persistPrefs(o, s.metricVisible);
    },
    moveDown: () => {
      if (i === s.metricOrder.length - 1) return;
      const o = [...s.metricOrder];
      [o[i + 1], o[i]] = [o[i], o[i + 1]];
      set({ metricOrder: o });
      persistPrefs(o, s.metricVisible);
    },
  }));

  const W = 600, H = 180, PAD = 12;
  const cr = d?.chart.revenue?.length ? d.chart.revenue : [0, 0];
  const cs = d?.chart.spend?.length ? d.chart.spend : [0, 0];
  const combinedMax = Math.max(1, ...cr, ...cs) * 1.15;
  const revenueLine = buildPoints(cr.length > 1 ? cr : [...cr, ...cr], combinedMax, W, H, PAD);
  const spendLine = buildPoints(cs.length > 1 ? cs : [...cs, ...cs], combinedMax, W, H, PAD);
  const lastPt = revenueLine.split(" ").pop()!.split(",");
  const chart = { revenueLine, spendLine, revenueArea: "0," + H + " " + revenueLine + " " + W + "," + H, lastX: lastPt[0], lastY: lastPt[1] };
  const chartPeriodLabel = d?.chart.periodLabel ?? "Últimos 7 dias";

  const prodMax = Math.max(1, ...(d?.products ?? []).map((p) => p.total));
  const products = (d?.products ?? []).map((p) => ({
    name: p.name,
    sales: p.sales,
    totalLabel: brl0(p.total),
    barWidth: Math.round((p.total / prodMax) * 100) + "%",
  }));
  const srcTotal = (d?.sources ?? []).reduce((a, x) => a + x.total, 0) || 1;
  const srcMax = Math.max(1, ...(d?.sources ?? []).map((x) => x.total));
  const sources = (d?.sources ?? []).map((x) => ({
    name: x.name,
    totalLabel: brl0(x.total),
    pctLabel: Math.round((x.total / srcTotal) * 100) + "%",
    barWidth: Math.round((x.total / srcMax) * 100) + "%",
  }));
  const payTotal = (d?.payments ?? []).reduce((a, x) => a + x.total, 0) || 1;
  const payMax = Math.max(1, ...(d?.payments ?? []).map((x) => x.total));
  const payments = (d?.payments ?? []).map((x) => ({
    name: x.name,
    count: x.count,
    totalLabel: brl0(x.total),
    pctLabel: Math.round((x.total / payTotal) * 100) + "%",
    barWidth: Math.round((x.total / payMax) * 100) + "%",
  }));

  const fn = d?.funnel ?? { cliques: 0, checkouts: 0, vendas: 0 };
  const maxF = Math.max(1, fn.cliques, fn.checkouts, fn.vendas);
  const funH = (n: number) => Math.max(24, Math.round((n / maxF) * 120)) + "px";
  const rate = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1).replace(".", ",") : "0") + "%";
  const funnel = [
    { label: "Cliques", count: fn.cliques.toLocaleString("pt-BR"), height: funH(fn.cliques), color: "var(--color-accent-800)", hasRate: false, rate: "" },
    { label: "Checkouts iniciados", count: fn.checkouts.toLocaleString("pt-BR"), height: funH(fn.checkouts), color: "var(--color-accent-600)", hasRate: true, rate: rate(fn.checkouts, fn.cliques) },
    { label: "Vendas", count: fn.vendas.toLocaleString("pt-BR"), height: funH(fn.vendas), color: "var(--color-accent)", hasRate: true, rate: rate(fn.vendas, fn.checkouts) },
  ];

  const feed = (d?.activity ?? []).map((f) => ({
    id: f.id,
    type: f.type,
    source: f.source,
    campaign: f.campaign,
    tagClass: f.type === "venda" ? "tag tag-accent" : "tag tag-outline",
    typeLabel: f.type === "venda" ? "Venda" : "Clique",
    valueLabel: f.value != null ? brl(f.value) : "—",
    timeLabel: elapsed(f.ts),
  }));

  const filterOptions = d?.filterOptions ?? { accounts: [], products: [], sources: [] };

  // ── Taxas e Despesas (Fase 13) ── resumo vem do dashboard real.
  const feesExp = d?.expenses ?? { gateway: 0, tax: 0, recurring: 0, total: 0 };
  const PAYMENT_LABEL: Record<string, string> = { PIX: "Pix", CARTAO: "Cartão", BOLETO: "Boleto", OUTRO: "Todas", "": "Todas" };
  const gatewayExpenses = s.expenses
    .filter((e) => e.type === "TAXA_GATEWAY")
    .map((e) => ({
      id: e.id,
      name: e.name,
      methodLabel: PAYMENT_LABEL[e.paymentMethod ?? ""] ?? "Todas",
      amountStr: String(e.amount),
      unit: e.calc === "PERCENTUAL" ? "%" : "R$",
      onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
        const amount = parseFloat(ev.target.value) || 0;
        setS((st) => ({ ...st, expenses: st.expenses.map((x) => (x.id === e.id ? { ...x, amount } : x)) }));
      },
      commit: (ev: React.FocusEvent<HTMLInputElement>) => updateExpense(e.id, { amount: parseFloat(ev.target.value) || 0 }).catch(() => {}),
      remove: async () => {
        await deleteExpense(e.id);
        setS((st) => ({ ...st, expenses: st.expenses.filter((x) => x.id !== e.id) }));
      },
    }));
  const taxExpenses = s.expenses
    .filter((e) => e.type === "IMPOSTO")
    .map((e) => ({
      id: e.id,
      name: e.name,
      amountStr: String(e.amount),
      onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
        const amount = parseFloat(ev.target.value) || 0;
        setS((st) => ({ ...st, expenses: st.expenses.map((x) => (x.id === e.id ? { ...x, amount } : x)) }));
      },
      commit: (ev: React.FocusEvent<HTMLInputElement>) => updateExpense(e.id, { amount: parseFloat(ev.target.value) || 0 }).catch(() => {}),
      remove: async () => {
        await deleteExpense(e.id);
        setS((st) => ({ ...st, expenses: st.expenses.filter((x) => x.id !== e.id) }));
      },
    }));
  const despesaRows = s.expenses
    .filter((e) => e.type === "DESPESA_RECORRENTE")
    .map((e) => ({
      id: e.id,
      name: e.name,
      valueLabel: brl0(e.amount),
      remove: async () => {
        await deleteExpense(e.id);
        setS((st) => ({ ...st, expenses: st.expenses.filter((x) => x.id !== e.id) }));
      },
    }));

  // Perfis do Facebook conectados (reais), com contas expansíveis e toggles.
  const trackedAccounts = s.adProfiles.reduce((a, p) => a + p.accounts.filter((ac) => ac.trackingEnabled).length, 0);
  const adProfiles = s.adProfiles.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    pictureUrl: p.pictureUrl,
    accountCount: p.accounts.length,
    expanded: s.expandedProfiles[p.id] ?? true,
    toggleExpanded: () =>
      setS((st) => ({ ...st, expandedProfiles: { ...st.expandedProfiles, [p.id]: !(st.expandedProfiles[p.id] ?? true) } })),
    disconnect: async () => {
      await disconnectProfile(p.id);
      setS((st) => ({ ...st, adProfiles: st.adProfiles.filter((x) => x.id !== p.id) }));
    },
    accounts: p.accounts.map((ac) => ({
      id: ac.id,
      name: ac.name,
      fbAccountId: ac.fbAccountId,
      currency: ac.currency,
      statusTag: ac.status === "ACTIVE" ? "tag tag-accent" : "tag tag-neutral",
      statusLabel: ac.status === "ACTIVE" ? "Ativa" : ac.status === "PAUSED" ? "Pausada" : "—",
      trackingOn: ac.trackingEnabled,
      toggleTracking: async () => {
        const updated = await toggleAccountTracking(ac.id);
        setS((st) => ({
          ...st,
          adProfiles: st.adProfiles.map((pr) =>
            pr.id === p.id
              ? { ...pr, accounts: pr.accounts.map((a2) => (a2.id === ac.id ? { ...a2, trackingEnabled: updated.trackingEnabled } : a2)) }
              : pr,
          ),
        }));
      },
    })),
  }));

  // ── Pixels / Conversions API (Fase 10) ──
  const EVENT_LABELS: Record<PixelEventType, { label: string; desc: string }> = {
    LEAD: { label: "Lead", desc: "Cadastro / formulário enviado" },
    ADD_TO_CART: { label: "Add to Cart", desc: "Produto adicionado ao carrinho" },
    INITIATE_CHECKOUT: { label: "Initiate Checkout", desc: "Checkout iniciado" },
    PURCHASE: { label: "Purchase", desc: "Compra confirmada (enviado via servidor)" },
  };
  const patchRule = (pixelId: string, eventType: PixelEventType, patch: Partial<{ enabled: boolean; detection: { tipo?: string; valor?: string } | null; sendMode: PurchaseSendMode; valueMode: PurchaseValueMode; fixedValue: number | null; targetProduct: string | null }>) =>
    setS((st) => ({
      ...st,
      pixels: st.pixels.map((px) =>
        px.id === pixelId ? { ...px, rules: px.rules.map((r) => (r.eventType === eventType ? { ...r, ...patch } : r)) } : px,
      ),
    }));

  const pixels = s.pixels.map((px) => ({
    id: px.id,
    name: px.name,
    pixelId: px.pixelId,
    enabled: px.enabled,
    hasToken: px.hasToken,
    toggle: async () => {
      const r = await togglePixel(px.id);
      setS((st) => ({ ...st, pixels: st.pixels.map((x) => (x.id === px.id ? { ...x, enabled: r.enabled } : x)) }));
    },
    remove: async () => {
      await deletePixel(px.id);
      setS((st) => ({ ...st, pixels: st.pixels.filter((x) => x.id !== px.id) }));
    },
    rules: px.rules.map((r) => ({
      eventType: r.eventType,
      label: EVENT_LABELS[r.eventType].label,
      desc: EVENT_LABELS[r.eventType].desc,
      enabled: r.enabled,
      detectionText: r.detection?.valor ?? "",
      sendMode: r.sendMode ?? "APENAS_APROVADAS",
      valueMode: r.valueMode ?? "VALOR_DA_VENDA",
      fixedValue: r.fixedValue != null ? String(r.fixedValue) : "",
      targetProduct: r.targetProduct ?? "",
      toggle: () => {
        const enabled = !r.enabled;
        patchRule(px.id, r.eventType, { enabled });
        updateEventRule(px.id, r.eventType, { enabled }).catch(() => {});
      },
      onDetection: (e: React.ChangeEvent<HTMLInputElement>) => {
        const valor = e.target.value;
        patchRule(px.id, r.eventType, { detection: valor ? { tipo: "contem_texto", valor } : null });
      },
      commitDetection: (e: React.FocusEvent<HTMLInputElement>) => {
        updateEventRule(px.id, r.eventType, { detectionText: e.target.value || null }).catch(() => {});
      },
      onSendMode: (e: React.ChangeEvent<HTMLSelectElement>) => {
        const sendMode = e.target.value as PurchaseSendMode;
        patchRule(px.id, r.eventType, { sendMode });
        updateEventRule(px.id, r.eventType, { sendMode }).catch(() => {});
      },
      onValueMode: (e: React.ChangeEvent<HTMLSelectElement>) => {
        const valueMode = e.target.value as PurchaseValueMode;
        patchRule(px.id, r.eventType, { valueMode });
        updateEventRule(px.id, r.eventType, { valueMode }).catch(() => {});
      },
      onFixedValue: (e: React.ChangeEvent<HTMLInputElement>) => patchRule(px.id, r.eventType, { fixedValue: e.target.value ? parseFloat(e.target.value) : null }),
      commitFixedValue: (e: React.FocusEvent<HTMLInputElement>) => updateEventRule(px.id, r.eventType, { fixedValue: e.target.value ? parseFloat(e.target.value) : null }).catch(() => {}),
      onTargetProduct: (e: React.ChangeEvent<HTMLInputElement>) => patchRule(px.id, r.eventType, { targetProduct: e.target.value }),
      commitTargetProduct: (e: React.FocusEvent<HTMLInputElement>) => updateEventRule(px.id, r.eventType, { targetProduct: e.target.value || null }).catch(() => {}),
    })),
  }));

  // ── Gerenciador de anúncios (dados reais sincronizados) ──
  const adsStatusInfo = (st: string) => {
    if (st === "ACTIVE") return { tag: "tag tag-accent", label: "Ativo", active: true };
    if (st === "ARCHIVED") return { tag: "tag tag-neutral", label: "Arquivado", active: false };
    return { tag: "tag tag-neutral", label: "Pausado", active: false };
  };
  const ctrLabel = (impr: number, clk: number) => (impr ? pct((clk / impr) * 100) : "—");
  const cpaLabel = (spd: number, res: number) => (res ? brl(spd / res) : "—");
  const roasLabel = (rev: number, spd: number) => (spd ? roasFmt(rev / spd) : "—");
  const adsMatch = (name: string, st: string) =>
    name.toLowerCase().includes(s.adsSearch.toLowerCase()) &&
    (s.adsStatus === "todos" || (s.adsStatus === "ativo" ? st === "ACTIVE" : st !== "ACTIVE"));

  const toggleEntity = (type: "campaign" | "adset" | "ad", id: string) => async () => {
    set({ adsBusyId: id });
    try {
      await fetch("/api/ads/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
    } finally {
      setS((st) => ({ ...st, adsBusyId: null, adsRefreshKey: st.adsRefreshKey + 1 }));
    }
  };

  const ao = s.adsData;
  const filteredCampaigns = (ao?.campaigns ?? [])
    .filter((c) => adsMatch(c.name, c.status))
    .map((c) => {
      const info = adsStatusInfo(c.status);
      return {
        id: c.id,
        name: c.name,
        statusTag: info.tag,
        statusLabel: info.label,
        budgetLabel: c.dailyBudget != null ? brl(c.dailyBudget) : "—",
        spendLabel: brl(c.spend),
        results: c.results,
        cpaLabel: cpaLabel(c.spend, c.results),
        ctrLabel: ctrLabel(c.impressions, c.clicks),
        roasLabel: roasLabel(c.revenue, c.spend),
        busy: s.adsBusyId === c.id,
        toggleIconPath: info.active ? "M88 64 h28 v128 h-28 Z M140 64 h28 v128 h-28 Z" : "M96 72 L96 184 L192 128 Z",
        toggle: toggleEntity("campaign", c.id),
      };
    });

  const filteredAdsets = (ao?.adSets ?? [])
    .filter((a) => adsMatch(a.name, a.status))
    .map((a) => {
      const info = adsStatusInfo(a.status);
      return {
        id: a.id,
        name: a.name,
        campaign: a.campaignName,
        statusTag: info.tag,
        statusLabel: info.label,
        spendLabel: brl(a.spend),
        results: a.results,
        cpaLabel: cpaLabel(a.spend, a.results),
        ctrLabel: ctrLabel(a.impressions, a.clicks),
        roasLabel: roasLabel(a.revenue, a.spend),
        busy: s.adsBusyId === a.id,
        toggle: toggleEntity("adset", a.id),
        toggleIconPath: info.active ? "M88 64 h28 v128 h-28 Z M140 64 h28 v128 h-28 Z" : "M96 72 L96 184 L192 128 Z",
      };
    });
  const filteredAds = (ao?.ads ?? [])
    .filter((a) => adsMatch(a.name, a.status))
    .map((a) => {
      const info = adsStatusInfo(a.status);
      return {
        slotId: a.id,
        id: a.id,
        name: a.name,
        format: a.format,
        thumbnailUrl: a.thumbnailUrl,
        campaign: a.campaignName,
        statusTag: info.tag,
        statusLabel: info.label,
        spendLabel: brl(a.spend),
        results: a.results,
        cpaLabel: cpaLabel(a.spend, a.results),
        ctrLabel: ctrLabel(a.impressions, a.clicks),
        roasLabel: roasLabel(a.revenue, a.spend),
        busy: s.adsBusyId === a.id,
        toggle: toggleEntity("ad", a.id),
        toggleIconPath: info.active ? "M88 64 h28 v128 h-28 Z M140 64 h28 v128 h-28 Z" : "M96 72 L96 184 L192 128 Z",
      };
    });
  const accounts = (ao?.accounts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    actId: "act_" + a.fbAccountId,
    spendLabel: brl0(a.spend),
    revenueLabel: brl0(a.revenue),
    campaigns: a.campaigns,
    roasLabel: roasLabel(a.revenue, a.spend),
    trackingTag: a.tracking ? "tag tag-accent" : "tag tag-neutral",
    trackingLabel: a.tracking ? "Rastreando" : "Pausado",
  }));
  const creatives = (s.creativesData ?? []).map((c) => ({
    id: c.id,
    slotId: "creative-" + c.id,
    name: c.name,
    campaign: c.campaign,
    thumbnailUrl: c.thumbnailUrl,
    format: c.format,
    best: c.best,
    sales: c.sales,
    spendLabel: brl(c.spend),
    ctrLabel: c.ctr ? pct(c.ctr) : "—",
    roasLabel: c.spend ? roasFmt(c.roas) : "—",
  }));

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

  const LEVEL_LABEL: Record<RuleLevel, string> = { CAMPAIGN: "Campanha", ADSET: "Conjunto", AD: "Anúncio" };
  const RULE_STATUS_LABEL: Record<string, string> = { SUCESSO: "Executou", SEM_ACAO: "Sem ação", ERRO: "Erro" };
  const rules = s.rules.map((r) => ({
    id: r.id,
    name: r.name,
    summary: r.summary,
    levelLabel: LEVEL_LABEL[r.level],
    freq: `A cada ${r.frequencyMin} min`,
    on: r.active,
    lastRunLabel: r.lastRunAt ? elapsed(new Date(r.lastRunAt).getTime()) : "nunca",
    logs: r.logs.map((l) => ({
      id: l.id,
      statusLabel: RULE_STATUS_LABEL[l.status] ?? l.status,
      statusTag: l.status === "SUCESSO" ? "tag tag-accent" : l.status === "ERRO" ? "tag tag-neutral" : "tag tag-neutral",
      message: l.message ?? "",
      timeLabel: elapsed(new Date(l.ranAt).getTime()),
    })),
    toggle: async () => {
      const res = await toggleRule(r.id);
      setS((st) => ({ ...st, rules: st.rules.map((x) => (x.id === r.id ? { ...x, active: res.active } : x)) }));
    },
    remove: async () => {
      await deleteRule(r.id);
      setS((st) => ({ ...st, rules: st.rules.filter((x) => x.id !== r.id) }));
    },
  }));

  // ── Notificações (Fase 12) ──
  const ns = s.notifSettings;
  const setSetting = (patch: Partial<NotificationSettingsDTO>) => {
    setS((st) => ({ ...st, notifSettings: { ...st.notifSettings, ...patch } }));
    updateNotificationSettings(patch).catch(() => {});
  };
  const REPORT_TIMES: { key: "report08" | "report12" | "report18" | "report23"; time: string }[] = [
    { key: "report08", time: "08:00" },
    { key: "report12", time: "12:00" },
    { key: "report18", time: "18:00" },
    { key: "report23", time: "23:00" },
  ];
  const reports = REPORT_TIMES.map((r) => ({
    time: r.time,
    on: ns[r.key],
    toggle: () => setSetting({ [r.key]: !ns[r.key] }),
  }));
  const previewParts = ["Nova venda aprovada"];
  if (ns.showValue) previewParts.push("R$ 497,00");
  if (ns.showProductName) previewParts.push("Método Foco 3.0");
  if (ns.showUtmCampaign) previewParts.push("lancamento-metodo-foco");
  const notifPreview = previewParts.join(" · ");

  const NOTIF_ICON: Record<string, string> = { VENDA_APROVADA: "💰", VENDA_PENDENTE: "⏳", RELATORIO: "📊", REGRA_EXECUTADA: "⚙️", SISTEMA: "🔔" };
  const notifItems = s.notifications.map((n) => ({
    id: n.id,
    icon: NOTIF_ICON[n.type] ?? "🔔",
    title: n.title,
    content: n.content,
    read: n.read,
    timeLabel: elapsed(new Date(n.timestamp).getTime()),
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

    fbConnected: s.adProfiles.length > 0,
    activeAccountCount: trackedAccounts + " contas",

    dashPeriod: s.dashPeriod,
    dashAccount: s.dashAccount,
    dashProduct: s.dashProduct,
    dashSource: s.dashSource,
    onDashPeriod: (e: React.ChangeEvent<HTMLSelectElement>) => set({ dashPeriod: e.target.value as DashPeriod }),
    onDashAccount: (e: React.ChangeEvent<HTMLSelectElement>) => set({ dashAccount: e.target.value }),
    onDashProduct: (e: React.ChangeEvent<HTMLSelectElement>) => set({ dashProduct: e.target.value }),
    onDashSource: (e: React.ChangeEvent<HTMLSelectElement>) => set({ dashSource: e.target.value }),

    kpiCards, chart, chartPeriodLabel, products, sources, payments, funnel, feed, metricList,
    dashLoading: s.dashLoading,
    filterAccounts: filterOptions.accounts,
    filterProducts: filterOptions.products,
    filterSources: filterOptions.sources,

    editDashOpen: s.editDashOpen,
    openEditDash: () => set({ editDashOpen: true }),
    closeEditDash: () => set({ editDashOpen: false }),

    adsTabs,
    adsSub: s.adsSub,
    adsSearch: s.adsSearch,
    adsStatus: s.adsStatus,
    adsPeriod: s.adsPeriod,
    adsAccount: s.adsAccount,
    adsLoading: s.adsLoading,
    onAdsSearch: (e: React.ChangeEvent<HTMLInputElement>) => set({ adsSearch: e.target.value }),
    onAdsStatus: (e: React.ChangeEvent<HTMLSelectElement>) => set({ adsStatus: e.target.value }),
    onAdsPeriod: (e: React.ChangeEvent<HTMLSelectElement>) => set({ adsPeriod: e.target.value as "hoje" | "7d" | "30d" }),
    onAdsAccount: (e: React.ChangeEvent<HTMLSelectElement>) => set({ adsAccount: e.target.value }),
    adsAccountOptions: (ao?.accounts ?? []).map((a) => ({ id: a.id, name: a.name })),
    filteredCampaigns, filteredAdsets, filteredAds, accounts, creatives,

    // Ranking de criativos
    creativesPeriod: s.creativesPeriod,
    creativesSort: s.creativesSort,
    creativesLoading: s.creativesLoading,
    onCreativesPeriod: (e: React.ChangeEvent<HTMLSelectElement>) => set({ creativesPeriod: e.target.value as "hoje" | "7d" | "30d" }),
    onCreativesSort: (e: React.ChangeEvent<HTMLSelectElement>) => set({ creativesSort: e.target.value as "roas" | "ctr" | "spend" | "sales" }),

    // Criar campanha
    newCampaignOpen: s.newCampaignOpen,
    newCampaignAccount: s.newCampaignAccount,
    newCampaignName: s.newCampaignName,
    newCampaignObjective: s.newCampaignObjective,
    newCampaignBudget: s.newCampaignBudget,
    newCampaignBusy: s.newCampaignBusy,
    openNewCampaign: () =>
      set({ newCampaignOpen: true, newCampaignAccount: (ao?.accounts ?? [])[0]?.id ?? "", newCampaignName: "", newCampaignBudget: "" }),
    closeNewCampaign: () => set({ newCampaignOpen: false }),
    onNewCampaignAccount: (e: React.ChangeEvent<HTMLSelectElement>) => set({ newCampaignAccount: e.target.value }),
    onNewCampaignName: (e: React.ChangeEvent<HTMLInputElement>) => set({ newCampaignName: e.target.value }),
    onNewCampaignObjective: (e: React.ChangeEvent<HTMLSelectElement>) => set({ newCampaignObjective: e.target.value }),
    onNewCampaignBudget: (e: React.ChangeEvent<HTMLInputElement>) => set({ newCampaignBudget: e.target.value }),
    createCampaign: async () => {
      if (!s.newCampaignAccount || !s.newCampaignName.trim()) return;
      set({ newCampaignBusy: true });
      try {
        const res = await fetch("/api/ads/campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: s.newCampaignAccount,
            name: s.newCampaignName.trim(),
            objective: s.newCampaignObjective,
            dailyBudget: s.newCampaignBudget ? parseFloat(s.newCampaignBudget) : undefined,
          }),
        });
        if (res.ok) {
          setS((st) => ({ ...st, newCampaignBusy: false, newCampaignOpen: false, adsRefreshKey: st.adsRefreshKey + 1 }));
        } else {
          const j = await res.json().catch(() => ({}));
          setS((st) => ({ ...st, newCampaignBusy: false, syncResult: j.error ?? "Falha ao criar campanha." }));
        }
      } catch {
        set({ newCampaignBusy: false });
      }
    },

    connectHref: "/api/auth/facebook",
    adProfiles,
    syncBusy: s.syncBusy,
    syncResult: s.syncResult,
    runSync: async () => {
      set({ syncBusy: true, syncResult: null });
      try {
        const res = await fetch("/api/sync/facebook", { method: "POST" });
        const json = await res.json();
        if (res.ok) {
          setS((st) => ({
            ...st,
            syncBusy: false,
            syncResult: `Sincronizado: ${json.campaigns} campanhas, ${json.ads} anúncios, ${json.metrics} dias de métricas${json.errors?.length ? ` (${json.errors.length} erro(s))` : ""}.`,
            refreshKey: st.refreshKey + 1,
          }));
        } else {
          set({ syncBusy: false, syncResult: json.error ?? "Falha na sincronização." });
        }
      } catch (e) {
        set({ syncBusy: false, syncResult: "Erro de rede: " + String(e) });
      }
    },
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

    pixels,
    newPixelName: s.newPixelName,
    newPixelId: s.newPixelId,
    newPixelToken: s.newPixelToken,
    pixelBusy: s.pixelBusy,
    onNewPixelName: (e: React.ChangeEvent<HTMLInputElement>) => set({ newPixelName: e.target.value }),
    onNewPixelId: (e: React.ChangeEvent<HTMLInputElement>) => set({ newPixelId: e.target.value }),
    onNewPixelToken: (e: React.ChangeEvent<HTMLInputElement>) => set({ newPixelToken: e.target.value }),
    addPixel: async () => {
      if (!s.newPixelId.trim()) return;
      set({ pixelBusy: true });
      try {
        const created = await createPixel({ name: s.newPixelName, pixelId: s.newPixelId, accessToken: s.newPixelToken });
        setS((st) => ({ ...st, pixels: [...st.pixels, created], newPixelName: "", newPixelId: "", newPixelToken: "", pixelBusy: false }));
      } catch {
        set({ pixelBusy: false });
      }
    },
    testEvent: s.testEvent,
    onTestEvent: (e: React.ChangeEvent<HTMLSelectElement>) => set({ testEvent: e.target.value }),
    testLog: s.testLog,
    fireTest: () =>
      setS((st) => ({ ...st, testLog: [{ event: st.testEvent, status: "200 OK", time: new Date().toLocaleTimeString("pt-BR") }, ...st.testLog].slice(0, 6) })),

    gatewayExpenses,
    taxExpenses,
    despesaRows,
    // Novo gateway
    newGatewayMethod: s.newGatewayMethod,
    newGatewayPct: s.newGatewayPct,
    onNewGatewayMethod: (e: React.ChangeEvent<HTMLSelectElement>) => set({ newGatewayMethod: e.target.value }),
    onNewGatewayPct: (e: React.ChangeEvent<HTMLInputElement>) => set({ newGatewayPct: e.target.value }),
    addGateway: async () => {
      const amount = parseFloat(s.newGatewayPct) || 0;
      if (!amount) return;
      const method = s.newGatewayMethod as ExpenseDTO["paymentMethod"];
      const label = PAYMENT_LABEL[method ?? ""] ?? "Todas";
      const created = await createExpense({ name: `Taxa ${label}`, type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount, paymentMethod: method });
      setS((st) => ({ ...st, expenses: [...st.expenses, created], newGatewayPct: "" }));
    },
    // Novo imposto
    newTaxName: s.newTaxName,
    newTaxPct: s.newTaxPct,
    onNewTaxName: (e: React.ChangeEvent<HTMLInputElement>) => set({ newTaxName: e.target.value }),
    onNewTaxPct: (e: React.ChangeEvent<HTMLInputElement>) => set({ newTaxPct: e.target.value }),
    addTax: async () => {
      const amount = parseFloat(s.newTaxPct) || 0;
      if (!amount) return;
      const created = await createExpense({ name: s.newTaxName.trim() || "Imposto", type: "IMPOSTO", calc: "PERCENTUAL", amount });
      setS((st) => ({ ...st, expenses: [...st.expenses, created], newTaxName: "", newTaxPct: "" }));
    },
    // Nova despesa recorrente
    newDespesaName: s.newDespesaName,
    newDespesaValue: s.newDespesaValue,
    onNewDespesaName: (e: React.ChangeEvent<HTMLInputElement>) => set({ newDespesaName: e.target.value }),
    onNewDespesaValue: (e: React.ChangeEvent<HTMLInputElement>) => set({ newDespesaValue: e.target.value }),
    addDespesa: async () => {
      const amount = parseFloat(s.newDespesaValue) || 0;
      if (!s.newDespesaName.trim() || !amount) return;
      const created = await createExpense({ name: s.newDespesaName.trim(), type: "DESPESA_RECORRENTE", calc: "FIXO", amount, recurrence: "MENSAL" });
      setS((st) => ({ ...st, expenses: [...st.expenses, created], newDespesaName: "", newDespesaValue: "" }));
    },
    finance: {
      revenue: brl(revenue),
      spend: brl(spend),
      gateway: brl(feesExp.gateway),
      tax: brl(feesExp.tax),
      despesas: brl(feesExp.recurring),
      profit: brl(revenue - spend - feesExp.total),
      margin: pct(revenue ? ((revenue - spend - feesExp.total) / revenue) * 100 : 0),
    },

    rules,
    ruleBusy: s.ruleBusy,
    ruleRunBusy: s.ruleRunBusy,
    ruleRunResult: s.ruleRunResult,
    ruleAccountOptions: (ao?.accounts ?? []).map((a) => ({ id: a.id, name: a.name })),
    addRule: async () => {
      const f = s.ruleForm;
      const levelMap: Record<string, RuleLevel> = { campanha: "CAMPAIGN", conjunto: "ADSET", anuncio: "AD" };
      const actionMap: Record<string, RuleAction> = { pausar: "PAUSAR", ativar: "ATIVAR", aumentar: "AJUSTAR_ORCAMENTO", reduzir: "AJUSTAR_ORCAMENTO" };
      const metricMap: Record<string, "cpa" | "roas" | "ctr" | "gasto" | "vendas"> = { CPA: "cpa", ROAS: "roas", CTR: "ctr", Gasto: "gasto", Vendas: "vendas" };
      const action = actionMap[f.action];
      const pct = parseFloat(f.budgetPct) || 0;
      const actionParams =
        action === "AJUSTAR_ORCAMENTO" ? { tipo: "percentual", valor: f.action === "reduzir" ? -Math.abs(pct) : Math.abs(pct) } : null;
      set({ ruleBusy: true });
      try {
        const created = await createRule({
          name: f.name || `${f.metric} ${f.op} ${f.value}`,
          targetProduct: f.product === "todos" ? null : f.product,
          adAccountIds: f.account === "todas" ? [] : [f.account],
          level: levelMap[f.level],
          action,
          actionParams,
          conditions: [{ metrica: metricMap[f.metric], operador: f.op as ">" | "<" | "=", valor: parseFloat(f.value) || 0 }],
          calcPeriod: f.window,
          frequencyMin: parseInt(f.freq, 10) || 30,
          dailyRunLimit: parseInt(f.dailyLimit, 10) || 10,
          active: f.active,
        });
        setS((st) => ({ ...st, rules: [created, ...st.rules], ruleBusy: false, ruleForm: { ...st.ruleForm, name: "", value: "" } }));
      } catch {
        set({ ruleBusy: false });
      }
    },
    runRules: async () => {
      set({ ruleRunBusy: true, ruleRunResult: null });
      try {
        const res = await fetch("/api/rules/run", { method: "POST" });
        const json = await res.json();
        if (res.ok) {
          // Recarrega as regras para trazer os logs novos.
          const fresh = await listRules();
          setS((st) => ({ ...st, ruleRunBusy: false, rules: fresh, ruleRunResult: `${json.evaluated} regra(s) avaliada(s), ${json.acted} com ação.` }));
        } else {
          set({ ruleRunBusy: false, ruleRunResult: json.error ?? "Falha ao executar." });
        }
      } catch {
        set({ ruleRunBusy: false, ruleRunResult: "Erro de rede." });
      }
    },
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
    onRuleBudgetPct: (e: React.ChangeEvent<HTMLInputElement>) => setNested("ruleForm", "budgetPct", e.target.value),
    onRuleFreq: (e: React.ChangeEvent<HTMLSelectElement>) => setNested("ruleForm", "freq", e.target.value),
    onRuleDailyLimit: (e: React.ChangeEvent<HTMLInputElement>) => setNested("ruleForm", "dailyLimit", e.target.value),
    onRuleActive: () => setS((st) => ({ ...st, ruleForm: { ...st.ruleForm, active: !st.ruleForm.active } })),

    notif: {
      notifyPendingSale: ns.notifyPendingSale,
      notifyApprovedSale: ns.notifyApprovedSale,
      showValue: ns.showValue,
      showProductName: ns.showProductName,
      showUtmCampaign: ns.showUtmCampaign,
      showDashboardName: ns.showDashboardName,
      reportPattern: ns.reportPattern,
      preview: notifPreview,
    },
    toggleNotifyPending: () => setSetting({ notifyPendingSale: !ns.notifyPendingSale }),
    toggleNotifyApproved: () => setSetting({ notifyApprovedSale: !ns.notifyApprovedSale }),
    toggleShowValue: () => setSetting({ showValue: !ns.showValue }),
    toggleShowProduct: () => setSetting({ showProductName: !ns.showProductName }),
    toggleShowUtm: () => setSetting({ showUtmCampaign: !ns.showUtmCampaign }),
    toggleShowDashboard: () => setSetting({ showDashboardName: !ns.showDashboardName }),
    onReportPattern: (e: React.ChangeEvent<HTMLSelectElement>) => setSetting({ reportPattern: e.target.value as NotificationSettingsDTO["reportPattern"] }),
    reports,

    // Sino de notificações
    notifItems,
    notifUnread: s.notifUnread,
    notifOpen: s.notifOpen,
    toggleNotifOpen: () => setS((st) => ({ ...st, notifOpen: !st.notifOpen })),
    closeNotif: () => set({ notifOpen: false }),
    markAllRead: async () => {
      setS((st) => ({ ...st, notifications: st.notifications.map((n) => ({ ...n, read: true })), notifUnread: 0 }));
      await markAllNotificationsRead();
    },

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
