"use client";

import { useCallback, useEffect, useState } from "react";
import { saveDashboardPrefs, type DashboardPrefsDTO } from "@/lib/actions/dashboardPrefs";
import {
  disconnectProfile,
  toggleAccountTracking,
  type AdProfileDTO,
} from "@/lib/actions/facebook";
import {
  createWebhook,
  deleteWebhook,
  toggleWebhook,
  type WebhookRowDTO,
} from "@/lib/actions/webhooks";
import type { AdsOverview } from "@/lib/ads/overview";
import type { DashboardData } from "@/lib/dashboard/metrics";
import { brl, brl0, buildPoints, elapsed, pct, roasFmt } from "@/lib/format";
import {
  initialAccounts,
  initialAds,
  initialAdsets,
  initialCampaigns,
  initialCreatives,
  initialDespesas,
  initialGateways,
  initialPixelEvents,
  initialRules,
} from "./mockData";
import type {
  AdAccount,
  AdItem,
  AdSet,
  Campaign,
  Despesa,
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
  adProfiles: AdProfileDTO[];
  expandedProfiles: Record<string, boolean>;
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
  } = {},
) {
  const brandName = opts.brandName || "Traffik";
  const liveUpdates = opts.liveUpdates !== false;
  const trackingId = opts.trackingId || "SEU_ID";
  const appUrl = (opts.appUrl || "https://app.traffik.io").replace(/\/+$/, "");

  const [s, setS] = useState<State>(() => initialState(opts.initialWebhooks, opts.dashboardPrefs, opts.initialProfiles));

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

  // Resumo financeiro da tela de Taxas (mock até a Fase 13), sobre o faturamento real.
  const feesGatewayPct = s.fees.gateways.reduce((a, g) => a + g.pct, 0) / (s.fees.gateways.length || 1);
  const feesGatewayCost = (revenue * feesGatewayPct) / 100;
  const feesTaxCost = (revenue * s.fees.taxPct) / 100;
  const feesDespesasTotal = s.fees.despesas.reduce((a, dd) => a + dd.value, 0);
  const feesProfit = revenue - spend - feesGatewayCost - feesTaxCost - feesDespesasTotal;
  const feesMargin = revenue ? (feesProfit / revenue) * 100 : 0;

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
    finance: { revenue: brl(revenue), spend: brl(spend), gateway: brl(feesGatewayCost), tax: brl(feesTaxCost), despesas: brl(feesDespesasTotal), profit: brl(feesProfit), margin: pct(feesMargin) },

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
