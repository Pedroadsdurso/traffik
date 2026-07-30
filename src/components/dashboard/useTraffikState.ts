"use client";

import { useRouter } from "next/navigation";

import { useCallback, useEffect, useState } from "react";
import { saveDashboardPrefs, type DashboardPrefsDTO } from "@/lib/actions/dashboardPrefs";
import {
  disconnectProfile,
  listAdProfiles,
  setProfileTracking,
  toggleAccountTracking,
  type AdProfileDTO,
} from "@/lib/actions/facebook";
import type { PixelConfigDTO } from "@/lib/actions/pixels";
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
import type { RuleAction, RuleLevel } from "@/generated/prisma/enums";
import {
  createWebhook,
  deleteWebhook,
  toggleWebhook,
  updateWebhook,
  type WebhookRowDTO,
} from "@/lib/actions/webhooks";
import {
  createApiCredential,
  deleteApiCredential,
  revealApiCredential,
  revokeApiCredential,
  type ApiCredentialDTO,
} from "@/lib/actions/apiCredentials";
import type { CreativeRow } from "@/lib/ads/creatives";
import type { AdsOverview } from "@/lib/ads/overview";
import type { DashboardData } from "@/lib/dashboard/metrics";
import { brl, brl0, buildPoints, elapsed, multFmt, pct, roasFmt } from "@/lib/format";
import { setLastWorkspaceId, type WorkspaceDTO } from "@/lib/actions/workspaces";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import type { MetricKey, TabKey } from "./types";

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
  accountSync: Record<string, { busy: boolean; msg: string | null }>;
  pixels: PixelConfigDTO[];
  editDashOpen: boolean;
  /** Última sincronização concluída (ISO) e se há uma em andamento. */
  syncLastAt: string | null;
  syncRodando: boolean;
  /** Sincronização manual (botão "Atualizar") em andamento. */
  /**
   * Áreas de Trabalho e a ativa.
   *
   * `workspaceAtiva` é `null` APENAS no instante entre a montagem do hook e a
   * chegada das áreas do servidor — não é mais um modo. Não existe visão
   * consolidada: o usuário está sempre dentro de uma área.
   */
  workspaces: WorkspaceDTO[];
  workspaceAtiva: string | null;
  syncManualBusy: boolean;
  /** Texto do resultado da última sincronização manual. */
  syncManualMsg: string | null;
  dashPeriod: DashPeriod;
  /** Intervalo do período "Personalizado" (ISO `YYYY-MM-DD`). */
  dashFrom: string | null;
  dashTo: string | null;
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
  expenses: ExpenseDTO[];
  newDespesaName: string;
  newDespesaValue: string;
  /** Despesa recorrente restrita à área ativa. Padrão `false` = vale para todas. */
  despesaSoNestaArea: boolean;
  newGatewayMethod: string;
  newGatewayPct: string;
  newTaxName: string;
  newTaxPct: string;
  webhooks: WebhookRowDTO[];
  webhookBusy: boolean;
  copiedWebhookId: string | null;
  // Modal "Adicionar Webhook" (bloco esquerdo)
  webhookModalOpen: boolean;
  webhookGatewaySearch: string;
  webhookGateway: string;
  webhookEditId: string | null;
  kirvanoToken: string;
  kirvanoName: string;
  webhookError: string | null;
  // Credenciais de API (bloco direito)
  apiCredentials: ApiCredentialDTO[];
  credModalOpen: boolean;
  newCredName: string;
  credBusy: boolean;
  createdCredKey: string | null;
  revealedKeys: Record<string, string>;
  copiedCredId: string | null;
  credError: string | null;
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
  "cpa", "ticket", "arpu", "ctr", "pendentes", "reembolsadas", "chargeback",
];
const DEFAULT_METRIC_VISIBLE: Record<MetricKey, boolean> = {
  faturamento: true, gasto: true, roas: true, roi: true, margem: true, vendas: true,
  cpa: true, ticket: true, arpu: false, ctr: false, pendentes: false, reembolsadas: false, chargeback: false,
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
  initialApiCredentials: ApiCredentialDTO[] = [],
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
    accountSync: {},
    pixels: initialPixels,
    editDashOpen: false,
    syncLastAt: null,
    syncRodando: false,
    workspaces: [],
    workspaceAtiva: null,
    syncManualBusy: false,
    syncManualMsg: null,
    // O filtro sempre abre em HOJE. Era "7d", então sair e voltar à ferramenta
    // mostrava a semana inteira e dava a impressão de que os números do dia
    // estavam errados. O período não é persistido de propósito: é um filtro de
    // sessão, não uma preferência.
    dashPeriod: "hoje",
    dashFrom: null,
    dashTo: null,
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
    expenses: initialExpenses,
    newDespesaName: "",
    newDespesaValue: "",
    despesaSoNestaArea: false,
    newGatewayMethod: "PIX",
    newGatewayPct: "",
    newTaxName: "",
    newTaxPct: "",
    webhooks: initialWebhooks,
    webhookBusy: false,
    copiedWebhookId: null,
    webhookModalOpen: false,
    webhookGatewaySearch: "",
    webhookGateway: "KIRVANO",
    webhookEditId: null,
    kirvanoToken: "",
    kirvanoName: "",
    webhookError: null,
    apiCredentials: initialApiCredentials,
    credModalOpen: false,
    newCredName: "",
    credBusy: false,
    createdCredKey: null,
    revealedKeys: {},
    copiedCredId: null,
    credError: null,
    rules: initialRulesDTO,
    ruleBusy: false,
    ruleRunBusy: false,
    ruleRunResult: null,
    ruleForm: { name: "", product: "todos", account: "todas", level: "campanha", metric: "CPA", op: ">", value: "50", window: "hoje", action: "pausar", budgetPct: "20", freq: "30", dailyLimit: "10", active: true },
    notifSettings: initialNotifSettings,
    notifications: initialNotifications,
    notifUnread: initialNotifications.filter((n) => !n.read).length,
    notifOpen: false,
    utmUrl: "",
    utmSource: "facebook",
    utmMedium: "cpc",
    utmCampaign: "",
    utmContent: "",
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

/**
 * Liga um `setInterval` que só roda com a **aba visível**, e revalida na hora em
 * que ela volta ao primeiro plano.
 *
 * Antes o polling continuava em abas de fundo: cada usuário com o painel aberto
 * em segundo plano mantinha o servidor ocupado indefinidamente, e a contenção
 * fazia as mesmas rotas irem de ~380ms para ~1.4s. Devolve o teardown.
 */
/**
 * Intervalo do polling ao vivo. Era 15s, o que dava a sensação de "a venda
 * chegou mas o dashboard não mexeu". Agora que a rota de webhook responde em
 * ~100ms (a CAPI saiu do caminho da resposta) e o polling pausa em aba
 * escondida, 5s é sustentável.
 */
const DASH_POLL_MS = 5000;
/** Gerenciador de Anúncios: reflete o Facebook sem depender do botão manual. */
const ADS_POLL_MS = 8000;
/** Contas/perfis mudam raramente — 30s basta e mantém a chamada barata. */
const PROFILES_POLL_MS = 30000;

function startPolling(load: () => void, intervalMs: number): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  const start = () => {
    if (timer === null) timer = setInterval(load, intervalMs);
  };
  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      load(); // dados podem ter envelhecido enquanto a aba estava escondida
      start();
    } else {
      stop();
    }
  };

  if (document.visibilityState === "visible") start();
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

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
    initialApiCredentials?: ApiCredentialDTO[];
    timezone?: string;
    workspaces?: WorkspaceDTO[];
    lastWorkspaceId?: string | null;
  } = {},
) {
  const brandName = opts.brandName || "Traffik";
  const liveUpdates = opts.liveUpdates !== false;
  const trackingId = opts.trackingId || "SEU_ID";
  const appUrl = (opts.appUrl || "https://app.traffik.io").replace(/\/+$/, "");
  // Fuso de referência do usuário. O servidor agrega por ele; o calendário do
  // filtro precisa do mesmo valor para "hoje" significar a mesma coisa dos dois
  // lados. Ver `src/lib/timezone.ts`.
  const timezone = opts.timezone || DEFAULT_TIMEZONE;

  // As áreas vêm do servidor no primeiro render. `useEffect` em vez de estado
  // inicial porque o layout é remontado a cada navegação e o hook não: semear
  // no `useState` congelaria a lista da primeira página aberta.
  const areasServidor = opts.workspaces;
  const ultimaArea = opts.lastWorkspaceId ?? null;

  const router = useRouter();
  const [s, setS] = useState<State>(() => initialState(opts.initialWebhooks, opts.dashboardPrefs, opts.initialProfiles, opts.initialPixels, opts.initialRules, opts.initialNotifSettings, opts.initialNotifications, opts.initialExpenses, opts.initialApiCredentials));

  // Semeia as áreas vindas do servidor. Só quando MUDAM de verdade: o layout
  // remonta a cada navegação e reescrever o estado igual derrubaria a área
  // ativa que o usuário acabou de escolher.
  useEffect(() => {
    if (!areasServidor) return;
    setS((st) => {
      const igual = JSON.stringify(st.workspaces) === JSON.stringify(areasServidor);
      const principal = areasServidor.find((a) => a.isDefault) ?? null;
      const proxima = st.workspaceAtiva ?? ultimaArea;
      // ⛔ Não existe mais estado "sem área". Se a área ativa foi arquivada ou
      // excluída, o fallback é a PRINCIPAL — nunca `null`, que era o
      // consolidado. `null` aqui só sobrevive no instante anterior ao primeiro
      // carregamento das áreas, e nenhuma requisição sai nesse intervalo.
      const valida =
        proxima && areasServidor.some((a) => a.id === proxima && !a.archived) ? proxima : principal?.id ?? null;
      if (igual && st.workspaceAtiva === valida) return st;
      return { ...st, workspaces: areasServidor, workspaceAtiva: valida };
    });
  }, [areasServidor, ultimaArea]);

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
      // `from`/`to` só fazem sentido no período personalizado.
      // A área ativa vai como ID: o servidor carrega os filtros dela. Mandar
      // as listas pela URL deixaria o cliente forjar o escopo.
      if (s.workspaceAtiva) qs.set("ws", s.workspaceAtiva);
      if (s.dashPeriod === "custom" && s.dashFrom) {
        qs.set("from", s.dashFrom);
        qs.set("to", s.dashTo ?? s.dashFrom);
      }
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
    const stop = startPolling(load, DASH_POLL_MS);
    return () => { active = false; controller.abort(); stop(); };
  }, [s.dashPeriod, s.dashFrom, s.dashTo, s.dashAccount, s.dashProduct, s.dashSource, s.workspaceAtiva, s.refreshKey, liveUpdates]);

  // Gerenciador de anúncios: busca sob demanda (período/conta) — status e busca
  // são filtrados no cliente para não refazer a cada tecla.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function carregar() {
      const qs = new URLSearchParams({ period: s.adsPeriod, account: s.adsAccount });
      if (s.workspaceAtiva) qs.set("ws", s.workspaceAtiva);
      try {
        const res = await fetch(`/api/ads?${qs.toString()}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as AdsOverview & {
          sync?: { lastSyncedAt: string | null; sincronizando: boolean };
        };
        if (active) {
          setS((st) => ({
            ...st,
            adsData: data,
            adsLoading: false,
            syncLastAt: data.sync?.lastSyncedAt ?? null,
            syncRodando: data.sync?.sincronizando ?? false,
          }));
        }
      } catch {
        /* abortado ou erro de rede */
      }
    }
    void carregar();
    // Gerenciador ao vivo: sem isso, campanha nova / métrica nova / mudança de
    // status só apareciam ao clicar em "Sincronizar". Pausa em aba escondida
    // (ver `startPolling`), então não custa nada com o painel em segundo plano.
    const stop = startPolling(() => { void carregar(); }, ADS_POLL_MS);
    return () => { active = false; controller.abort(); stop(); };
  }, [s.adsPeriod, s.adsAccount, s.workspaceAtiva, s.adsRefreshKey]);

  // Ranking de criativos.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    (async () => {
      const qs = new URLSearchParams({ period: s.creativesPeriod, sort: s.creativesSort });
      if (s.workspaceAtiva) qs.set("ws", s.workspaceAtiva);
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
  }, [s.creativesPeriod, s.creativesSort, s.workspaceAtiva, s.adsRefreshKey]);

  // Perfis e contas de anúncio: repescagem a cada 30s.
  //
  // A vitrine de Integrações › Anúncios era montada só com os dados do servidor
  // no carregamento da página. Como a sincronização agora descobre contas novas
  // da BM sozinha, sem isto a conta nova só apareceria ao navegar/recarregar —
  // que é justamente a intervenção manual que este bloco existe para eliminar.
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const perfis = await listAdProfiles();
        if (!active) return;
        setS((st) => {
          // Só troca o estado quando algo mudou de verdade: substituir o array
          // a cada 30s remontaria a lista e derrubaria a gaveta aberta.
          const igual = JSON.stringify(st.adProfiles) === JSON.stringify(perfis);
          return igual ? st : { ...st, adProfiles: perfis, fbConnected: perfis.length > 0 };
        });
      } catch {
        /* erro de rede: a próxima volta tenta de novo */
      }
    }
    const stop = startPolling(() => { void load(); }, PROFILES_POLL_MS);
    return () => { active = false; stop(); };
  }, []);

  // Notificações: polling do sino a cada 15s.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const url = s.workspaceAtiva ? `/api/notifications?ws=${encodeURIComponent(s.workspaceAtiva)}` : "/api/notifications";
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { items: NotificationDTO[]; unread: number };
        if (active) setS((st) => ({ ...st, notifications: data.items, notifUnread: data.unread }));
      } catch {
        /* abortado ou erro de rede */
      }
    }
    load();
    if (!liveUpdates) return () => { active = false; controller.abort(); };
    const stop = startPolling(load, DASH_POLL_MS);
    return () => { active = false; controller.abort(); stop(); };
  }, [liveUpdates, s.workspaceAtiva]);

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
  const arpu = k?.arpu ?? 0;
  const buyers = k?.buyers ?? 0;
  const roas = k?.roas ?? 0;
  // `null` = sem custo no período, ROI indefinido. Não colapsar para 0: "0,00x"
  // se lê como empate, e empate é diferente de "não dá para calcular".
  const roi = k?.roi ?? null;
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
    return {
      trendColor: good ? A : N,
      trendPath: (dv ?? 0) >= 0 ? UP_PATH : DOWN_PATH,
      trendLabel: fmtDelta(dv),
      // Bloco 5 (polimento): o card usa o número cru para colorir e apontar a
      // seta; `invertido` marca métrica de custo, onde subir é ruim.
      delta: dv,
      invertido: invert,
    };
  }

  const reg: Record<
    MetricKey,
    { label: string; value: string; trendColor: string; trendPath: string; trendLabel: string; delta: number | null; invertido: boolean }
  > = {
    faturamento: { label: "Faturamento", value: brl(revenue), ...trendOf("revenue") },
    gasto: { label: "Gasto total", value: brl(spend), ...trendOf("spend", true) },
    roas: { label: "ROAS", value: roasFmt(roas), ...trendOf("roas") },
    // Bloco 4: ROI passa a ser multiplicador (era "1331%"), com 2 casas como
    // nos exemplos do roteiro. Sem custo no período não há ROI — mostra "—".
    roi: { label: "ROI", value: roi != null ? multFmt(roi) : "—", ...trendOf("roi") },
    margem: { label: "Margem de lucro", value: pct(margin), ...trendOf("margem") },
    vendas: { label: "Vendas", value: String(sales), ...trendOf("sales") },
    cpa: { label: "CPA", value: brl(cpa), ...trendOf("cpa", true) },
    ticket: { label: "Ticket médio", value: brl(ticket), ...trendOf("ticket") },
    arpu: { label: "ARPU", value: brl(arpu), ...trendOf("arpu") },
    ctr: { label: "CTR", value: pct(ctr), ...trendOf("ctr") },
    pendentes: { label: "Vendas pendentes", value: String(pendentes), delta: null, invertido: false, trendColor: N, trendPath: DOWN_PATH, trendLabel: "aguardando pgto." },
    reembolsadas: { label: "Reembolsadas", value: String(reembolsadas), delta: null, invertido: false, trendColor: N, trendPath: DOWN_PATH, trendLabel: "no período" },
    chargeback: { label: "Taxa de chargeback", value: pct(chargebackRate), delta: null, invertido: false, trendColor: A, trendPath: UP_PATH, trendLabel: "sobre eventos de venda" },
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
    total: p.total, // valor cru: o Donut calcula a fatia (Bloco 5)
    totalLabel: brl0(p.total),
    barWidth: Math.round((p.total / prodMax) * 100) + "%",
  }));
  const srcTotal = (d?.sources ?? []).reduce((a, x) => a + x.total, 0) || 1;
  const srcMax = Math.max(1, ...(d?.sources ?? []).map((x) => x.total));
  const sources = (d?.sources ?? []).map((x) => ({
    name: x.name,
    total: x.total,
    totalLabel: brl0(x.total),
    pctLabel: Math.round((x.total / srcTotal) * 100) + "%",
    barWidth: Math.round((x.total / srcMax) * 100) + "%",
  }));
  const payTotal = (d?.payments ?? []).reduce((a, x) => a + x.total, 0) || 1;
  const payMax = Math.max(1, ...(d?.payments ?? []).map((x) => x.total));
  const payments = (d?.payments ?? []).map((x) => ({
    name: x.name,
    total: x.total,
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

  // Feed unificado: cada tipo de evento tem rótulo e cor próprios.
  const EVENTO_META: Record<string, { label: string; cor: string }> = {
    clique: { label: "Clique", cor: "#60a5fa" },
    checkout: { label: "Checkout", cor: "#a78bfa" },
    pageview: { label: "PageView", cor: "#94a3b8" },
    lead: { label: "Lead", cor: "#38bdf8" },
    add_to_cart: { label: "Add to cart", cor: "#c084fc" },
    venda_pendente: { label: "Venda pendente", cor: "#fbbf24" },
    venda_aprovada: { label: "Venda aprovada", cor: "#4ade80" },
    reembolso: { label: "Reembolso", cor: "#f87171" },
    chargeback: { label: "Chargeback", cor: "#fb7185" },
  };
  const feed = (d?.activity ?? []).map((f) => {
    const meta = EVENTO_META[f.type] ?? { label: f.type, cor: "var(--color-neutral-400)" };
    return {
      id: f.id,
      type: f.type,
      source: f.source,
      campaign: f.campaign,
      typeLabel: meta.label,
      cor: meta.cor,
      valueLabel: f.value != null ? brl(f.value) : "—",
      timeLabel: elapsed(f.ts),
    };
  });

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
    trackedCount: p.accounts.filter((a) => a.trackingEnabled).length,
    allTracked: p.accounts.length > 0 && p.accounts.every((a) => a.trackingEnabled),
    expanded: s.expandedProfiles[p.id] ?? false,
    toggleExpanded: () =>
      setS((st) => ({ ...st, expandedProfiles: { ...st.expandedProfiles, [p.id]: !(st.expandedProfiles[p.id] ?? false) } })),
    setAllTracking: async () => {
      const enabled = !(p.accounts.length > 0 && p.accounts.every((a) => a.trackingEnabled));
      await setProfileTracking(p.id, enabled);
      setS((st) => ({
        ...st,
        adProfiles: st.adProfiles.map((pr) =>
          pr.id === p.id ? { ...pr, accounts: pr.accounts.map((a2) => ({ ...a2, trackingEnabled: enabled })) } : pr,
        ),
      }));
    },
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
      statusLabel: ac.status === "ACTIVE" ? "Ativa" : ac.status === "PAUSED" ? "Desabilitada" : "—",
      trackingOn: ac.trackingEnabled,
      syncBusy: s.accountSync[ac.id]?.busy ?? false,
      syncMsg: s.accountSync[ac.id]?.msg ?? null,
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
      sync: async () => {
        setS((st) => ({ ...st, accountSync: { ...st.accountSync, [ac.id]: { busy: true, msg: null } } }));
        try {
          const res = await fetch("/api/sync/facebook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountId: ac.id }),
          });
          const json = await res.json();
          const msg = res.ok
            ? `${json.campaigns || 0} camp. · ${json.ads || 0} anúncios · ${json.metrics || 0} dias${json.errors?.length ? " (erro)" : ""}`
            : json.error || "Falha na sincronização.";
          setS((st) => ({ ...st, accountSync: { ...st.accountSync, [ac.id]: { busy: false, msg } }, adsRefreshKey: st.adsRefreshKey + 1 }));
        } catch {
          setS((st) => ({ ...st, accountSync: { ...st.accountSync, [ac.id]: { busy: false, msg: "Erro de rede." } } }));
        }
      },
    })),
  }));

  // Pixels são geridos pela PixelView autocontida (Bloco 12); aqui só usamos
  // a lista `s.pixels` para popular o seletor da aba Testes (abaixo).

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
  // Regras da ÁREA ATIVA. Uma regra é configuração, não métrica: o recorte é
  // pelas contas de anúncio que ela mira.
  //
  // ⚠️ Regra **sem conta escolhida vale para todas** — então aparece em toda
  // área, e isso é correto: ela realmente age sobre as campanhas desta área
  // também. Escondê-la faria o usuário achar que ninguém está pausando as
  // campanhas dele, enquanto uma regra global as pausa.
  const contasDaArea = s.workspaceAtiva
    ? s.workspaces.find((w) => w.id === s.workspaceAtiva)?.accountIds ?? []
    : [];
  const rules = s.rules
    .filter((r) =>
      contasDaArea.length === 0 || r.adAccountIds.length === 0
        ? true
        : r.adAccountIds.some((id) => contasDaArea.includes(id)),
    )
    .map((r) => ({
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
  // Prévia ilustrativa (não são dados reais) — usa rótulos genéricos.
  const previewParts = ["Nova venda aprovada"];
  if (ns.showValue) previewParts.push("R$ 0,00");
  if (ns.showProductName) previewParts.push("Seu produto");
  if (ns.showUtmCampaign) previewParts.push("sua-campanha");
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
    dashFrom: s.dashFrom,
    dashTo: s.dashTo,
    // Setters por valor: os filtros do Bloco 3 são componentes próprios, não
    // `<select>` nativos, então não existe mais um ChangeEvent para ler.
    setDashPeriod: (p: DashPeriod) => set({ dashPeriod: p }),
    setDashAccount: (v: string) => set({ dashAccount: v }),
    setDashProduct: (v: string) => set({ dashProduct: v }),
    setDashSource: (v: string) => set({ dashSource: v }),
    /** Aplica o intervalo do calendário e já muda o período para "custom". */
    setDashRange: (from: string, to: string) => set({ dashPeriod: "custom", dashFrom: from, dashTo: to }),

    kpiCards, chart, chartPeriodLabel, products, sources, payments, funnel, feed, metricList,
    // Registro por chave: o grid do Bloco 2 renderiza cada KPI como bloco
    // independente, então precisa acessar a métrica pelo id e não pela ordem.
    metricCards: reg,
    // Séries do Bloco 4 (por horário / por dia), já filtradas no servidor.
    // Bloco 5: séries brutas para os gráficos novos (o front formata).
    chartSerie: { labels: d?.chart.labels ?? [], revenue: d?.chart.revenue ?? [], spend: d?.chart.spend ?? [] },
    // Cada etapa declara de ONDE vem a contagem, porque as cinco não saem da
    // mesma fonte — e é exatamente isso que explica uma etapa passar de 100%
    // da anterior. Só "vendas aprovadas ⊆ vendas iniciadas" é garantido por
    // construção (mesma tabela, filtro de status).
    /**
     * Números que compuseram cada métrica no período, para o tooltip mostrar a
     * conta feita e não só a fórmula abstrata.
     */
    valoresMetrica: (chave: string): [string, string][] | undefined => {
      const n = (x: number) => x.toLocaleString("pt-BR");
      switch (chave) {
        case "roas": return [["Faturamento", brl(revenue)], ["Gasto", brl(spend)]];
        case "roi": return [["Lucro", brl(k?.profit ?? 0)], ["Custo total", brl(spend + (d?.expenses.total ?? 0))]];
        case "cpa": return [["Gasto", brl(spend)], ["Vendas", n(sales)]];
        case "ticket": return [["Faturamento", brl(revenue)], ["Vendas", n(sales)]];
        case "arpu": return [["Faturamento", brl(revenue)], ["Compradores únicos", n(k?.buyers ?? 0)]];
        case "margem": return [["Lucro", brl(k?.profit ?? 0)], ["Faturamento", brl(revenue)]];
        case "lucro": return [["Faturamento", brl(revenue)], ["Gasto", brl(spend)], ["Taxas e despesas", brl(d?.expenses.total ?? 0)]];
        case "ctr": return [["Cliques", n(k?.clicks ?? 0)]];
        default: return undefined;
      }
    },
    /** Ticket médio cru — o funil usa para estimar o faturamento perdido. */
    ticketMedio: k?.ticket ?? 0,
    funnelStages: [
      { chaveInfo: "cliques", label: "Cliques no anúncio", curto: "Cliques", value: d?.funnel.cliques ?? 0, fonte: "Meta Ads (métrica diária)" },
      { chaveInfo: "visitas", label: "Visita na página", curto: "Vis. Página", value: d?.funnel.visitas ?? 0, fonte: "Nosso script — 1 por sessão" },
      { chaveInfo: "checkouts", label: "Initiate Checkout", curto: "ICs", value: d?.funnel.checkouts ?? 0, fonte: "Pixel + webhook — visitantes distintos" },
      { chaveInfo: "iniciadas", label: "Vendas iniciadas", curto: "Vendas Inic.", value: d?.funnel.iniciadas ?? 0, fonte: "Gateway — todos os status" },
      { chaveInfo: "aprovadas", label: "Vendas aprovadas", curto: "Vendas Apr.", value: d?.funnel.vendas ?? 0, fonte: "Gateway — status APROVADA" },
    ],
    sparklines: d?.chart.sparklines ?? {},
    /**
     * Botão "Atualizar" do Dashboard — **ponto único de sincronização manual**.
     *
     * Sincroniza com o Facebook (respeitando os intervalos) e só então recarrega
     * os dados da tela. Antes só recarregava a tela, o que relia o mesmo dado do
     * banco e dava a impressão de que o botão não fazia nada.
     *
     * O `syncManualBusy` é lido do estado ANTERIOR dentro do `setS` em vez de
     * checado antes: entre um `if` e o `setS` cabe outro clique, e dois cliques
     * rápidos disparariam duas requisições. Aqui o próprio `setS` é a seção
     * crítica. (O servidor ainda tem a reserva no banco como rede de segurança
     * para o caso de duas abas.)
     */
    refreshDashboard: () => {
      let jaRodando = false;
      setS((st) => {
        jaRodando = st.syncManualBusy;
        return jaRodando ? st : { ...st, syncManualBusy: true, syncManualMsg: null };
      });
      if (jaRodando) return;

      void (async () => {
        try {
          const res = await fetch("/api/sync/manual", { method: "POST" });
          const data = (await res.json()) as { mensagem?: string; error?: string };
          setS((st) => ({
            ...st,
            syncManualBusy: false,
            syncManualMsg: data.mensagem ?? data.error ?? "Não foi possível sincronizar.",
            // Recarrega o painel só depois da sincronização — senão a tela
            // buscaria o dado antigo e o número só mudaria no polling seguinte.
            dashLoading: true,
            refreshKey: st.refreshKey + 1,
            adsRefreshKey: st.adsRefreshKey + 1,
          }));
        } catch {
          setS((st) => ({ ...st, syncManualBusy: false, syncManualMsg: "Falha de rede ao sincronizar." }));
        }
      })();
    },
    workspaces: s.workspaces,
    workspaceAtiva: s.workspaceAtiva,
    // `workspaceAtivaNome`/`Cor` existiam só para o selo do Header, removido em
    // 29/07/2026 — o seletor da sidebar já mostra a área ativa em toda tela.
    workspaceAtivaEhPrincipal: s.workspaces.find((w) => w.id === s.workspaceAtiva)?.isDefault ?? false,
    /**
     * Troca a área ativa. Persiste no servidor (item "lembrar a última área")
     * mas NÃO espera a resposta: a troca de contexto tem que ser imediata, e
     * uma falha ao gravar a preferência não pode travar a tela.
     */
    trocarWorkspace: (id: string) => {
      // 1) Imediato: a troca de contexto não pode esperar rede nenhuma.
      setS((st) => ({
        ...st,
        workspaceAtiva: id,
        // Força o refetch de dashboard, gerenciador e criativos (rotas /api/*).
        refreshKey: st.refreshKey + 1,
        adsRefreshKey: st.adsRefreshKey + 1,
        dashLoading: true,
      }));

      // 2) Depois: as listas de CONFIGURAÇÃO (webhooks, pixels, perfis,
      //    despesas, regras, notificações) vêm do layout no SERVIDOR, que as
      //    resolve pela área lembrada. Sem recarregá-lo, Integrações e Taxas
      //    continuariam mostrando a área ANTERIOR — dado de outra operação na
      //    tela, que é exatamente o que as áreas existem para impedir.
      //
      //    ⚠️ O `router.refresh()` tem de vir DEPOIS do `setLastWorkspaceId`
      //    resolver: ele relê o servidor, e o servidor lê a área persistida.
      //    Disparar os dois em paralelo recarregaria com a área velha.
      void (async () => {
        try {
          await setLastWorkspaceId(id);
        } catch {
          // Falhar ao lembrar a preferência não pode travar a troca; o refresh
          // ainda vale, e a área volta ao normal no próximo carregamento.
        }
        router.refresh();
      })();
    },
    syncManualBusy: s.syncManualBusy,
    syncManualMsg: s.syncManualMsg,
    limparSyncMsg: () => setS((st) => ({ ...st, syncManualMsg: null })),
    byCountry: d?.byCountry ?? [],
    approval: d?.approval ?? [],
    byHour: d?.byHour ?? [],
    byDay: d?.byDay ?? [],
    buyers,
    dashLoading: s.dashLoading,
    filterAccounts: filterOptions.accounts,
    filterProducts: filterOptions.products,
    filterSources: filterOptions.sources,

    editDashOpen: s.editDashOpen,
    openEditDash: () => set({ editDashOpen: true }),
    closeEditDash: () => set({ editDashOpen: false }),

    adsTabs,
    adsSub: s.adsSub,
    // Bloco 6: a tabela nova precisa dos NÚMEROS CRUS para derivar
    // ROAS/ROI/CPA/CPC/CTR/CPM — as linhas pré-formatadas acima só têm texto.
    adsRaw: s.adsData,
    adsBusyId: s.adsBusyId,
    setAdsSub: (k: "campaigns" | "adsets" | "ads" | "accounts") => set({ adsSub: k }),
    toggleAdsEntity: (type: "campaign" | "adset" | "ad", id: string) => toggleEntity(type, id)(),
    /** Força um recarregamento do overview (após ação em massa ou sync). */
    refreshAds: () => setS((st) => ({ ...st, adsRefreshKey: st.adsRefreshKey + 1 })),
    adsSearch: s.adsSearch,
    adsStatus: s.adsStatus,
    adsPeriod: s.adsPeriod,
    adsAccount: s.adsAccount,
    /**
     * Idade do dado vindo do Facebook. Existe para o usuário PARAR de clicar em
     * "Sincronizar": sem um sinal na tela de que a atualização é automática, a
     * reação natural é apertar o botão de novo.
     */
    syncLabel: s.syncRodando
      ? "Sincronizando…"
      : s.syncLastAt
        ? `Atualizado ${elapsed(new Date(s.syncLastAt).getTime())}`
        : "Aguardando 1ª sincronização",
    syncRodando: s.syncRodando,
    adsLoading: s.adsLoading,
    onAdsSearch: (e: React.ChangeEvent<HTMLInputElement>) => set({ adsSearch: e.target.value }),
    // Setters por VALOR, não por evento: o `ui/Select` entrega o valor direto.
    // Os `onAdsX` que recebiam `ChangeEvent` existiam só para o `<select>`
    // nativo — ver a nota sobre padronização de controles no CLAUDE.md.
    setAdsStatus: (adsStatus: string) => set({ adsStatus }),
    setAdsPeriod: (adsPeriod: string) => set({ adsPeriod: adsPeriod as "hoje" | "7d" | "30d" }),
    setAdsAccount: (adsAccount: string) => set({ adsAccount }),
    adsAccountOptions: (ao?.accounts ?? []).map((a) => ({ id: a.id, name: a.name })),
    filteredCampaigns, filteredAdsets, filteredAds, accounts, creatives,

    // Ranking de criativos
    creativesPeriod: s.creativesPeriod,
    creativesSort: s.creativesSort,
    creativesLoading: s.creativesLoading,
    setCreativesPeriod: (creativesPeriod: string) => set({ creativesPeriod: creativesPeriod as "hoje" | "7d" | "30d" }),
    setCreativesSort: (creativesSort: string) => set({ creativesSort: creativesSort as "roas" | "ctr" | "spend" | "sales" }),

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

    // Leva a área ativa: as contas descobertas nascem vinculadas a ela e o
    // callback devolve o usuário para a MESMA área. Sem isto o passo termina e
    // a vitrine da área continua vazia.
    connectHref: s.workspaceAtiva ? `/api/auth/facebook?ws=${encodeURIComponent(s.workspaceAtiva)}` : "/api/auth/facebook",
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

    // ───────────── Webhooks (bloco esquerdo) ─────────────
    webhooks: s.webhooks,
    webhookBusy: s.webhookBusy,
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

    // Modal "Adicionar Webhook" / editar
    webhookModalOpen: s.webhookModalOpen,
    webhookGatewaySearch: s.webhookGatewaySearch,
    webhookGateway: s.webhookGateway,
    webhookEditId: s.webhookEditId,
    kirvanoToken: s.kirvanoToken,
    kirvanoName: s.kirvanoName,
    webhookError: s.webhookError,
    openWebhookModal: () =>
      set({ webhookModalOpen: true, webhookEditId: null, webhookGateway: "KIRVANO", webhookGatewaySearch: "", kirvanoToken: "", kirvanoName: "", webhookError: null }),
    openEditWebhook: (w: WebhookRowDTO) =>
      set({ webhookModalOpen: true, webhookEditId: w.id, webhookGateway: w.platform, kirvanoToken: "", kirvanoName: w.name, webhookError: null }),
    closeWebhookModal: () => set({ webhookModalOpen: false }),
    onWebhookGatewaySearch: (e: React.ChangeEvent<HTMLInputElement>) => set({ webhookGatewaySearch: e.target.value }),
    selectWebhookGateway: (g: string) => set({ webhookGateway: g }),
    onKirvanoToken: (e: React.ChangeEvent<HTMLInputElement>) => set({ kirvanoToken: e.target.value }),
    onKirvanoName: (e: React.ChangeEvent<HTMLInputElement>) => set({ kirvanoName: e.target.value }),
    saveWebhook: async () => {
      set({ webhookBusy: true, webhookError: null });
      try {
        if (s.webhookEditId) {
          const updated = await updateWebhook({ id: s.webhookEditId, name: s.kirvanoName, secret: s.kirvanoToken });
          setS((st) => ({
            ...st,
            webhooks: st.webhooks.map((w) => (w.id === updated.id ? updated : w)),
            webhookBusy: false,
            webhookModalOpen: false,
          }));
        } else {
          const created = await createWebhook({ platform: s.webhookGateway, name: s.kirvanoName, secret: s.kirvanoToken });
          setS((st) => ({ ...st, webhooks: [...st.webhooks, created], webhookBusy: false, webhookModalOpen: false }));
        }
      } catch {
        set({ webhookBusy: false, webhookError: "Não foi possível salvar o webhook. Se o problema persistir, saia e entre novamente." });
      }
    },

    // ───────────── Credenciais de API (bloco direito) ─────────────
    apiCredentials: s.apiCredentials,
    credModalOpen: s.credModalOpen,
    newCredName: s.newCredName,
    credBusy: s.credBusy,
    createdCredKey: s.createdCredKey,
    revealedKeys: s.revealedKeys,
    copiedCredId: s.copiedCredId,
    credError: s.credError,
    openCredModal: () => set({ credModalOpen: true, newCredName: "", createdCredKey: null, credError: null }),
    closeCredModal: () => set({ credModalOpen: false, createdCredKey: null }),
    onNewCredName: (e: React.ChangeEvent<HTMLInputElement>) => set({ newCredName: e.target.value }),
    createCredential: async () => {
      set({ credBusy: true, credError: null });
      try {
        const created = await createApiCredential(s.newCredName);
        const { key, ...dto } = created;
        setS((st) => ({ ...st, apiCredentials: [dto, ...st.apiCredentials], createdCredKey: key, credBusy: false }));
      } catch {
        set({ credBusy: false, credError: "Não foi possível gerar a credencial. Se o problema persistir, saia e entre novamente." });
      }
    },
    revealCredential: async (id: string) => {
      const { key } = await revealApiCredential(id);
      setS((st) => ({ ...st, revealedKeys: { ...st.revealedKeys, [id]: key } }));
    },
    hideCredential: (id: string) =>
      setS((st) => {
        const next = { ...st.revealedKeys };
        delete next[id];
        return { ...st, revealedKeys: next };
      }),
    revokeCredential: async (id: string) => {
      const updated = await revokeApiCredential(id);
      setS((st) => ({ ...st, apiCredentials: st.apiCredentials.map((c) => (c.id === id ? updated : c)) }));
    },
    deleteCredential: async (id: string) => {
      await deleteApiCredential(id);
      setS((st) => ({ ...st, apiCredentials: st.apiCredentials.filter((c) => c.id !== id) }));
    },
    copyCredKey: (id: string, key: string) => {
      navigator.clipboard.writeText(key);
      set({ copiedCredId: id });
      setTimeout(() => set({ copiedCredId: null }), 1500);
    },

    // O teste de pixel virou parte da TestesView autocontida (Bloco 13).

    gatewayExpenses,
    taxExpenses,
    despesaRows,
    // Novo gateway
    newGatewayMethod: s.newGatewayMethod,
    newGatewayPct: s.newGatewayPct,
    onNewGatewayMethod: (e: React.ChangeEvent<HTMLSelectElement>) => set({ newGatewayMethod: e.target.value }),
    onNewGatewayPct: (e: React.ChangeEvent<HTMLInputElement>) => set({ newGatewayPct: e.target.value }),
    /**
     * 🐛 Os `add*` passaram a RECEBER os valores em vez de lê-los do estado
     * global.
     *
     * Os campos do formulário de Taxas moravam no `useTraffikState`, que é
     * provido por contexto ao dashboard inteiro. Cada tecla re-renderizava a
     * árvore toda (gráficos incluídos), e com input controlado o teclado corria
     * mais rápido que o re-render: os caracteres se perdiam e o campo aparecia
     * vazio depois de digitar uma frase.
     *
     * Agora o estado dos campos é LOCAL na `FeesView` — mesmo padrão das views
     * mais novas (`UtmsView`, `PixelView`, `AreasView`, `RulesView`).
     *
     * ⚠️ Campo de formulário não deve morar neste hook. O que vem para cá é
     * dado do servidor e estado compartilhado entre telas, não digitação.
     */
    addGateway: async (metodo: string, pct: string) => {
      const amount = parseFloat(pct) || 0;
      if (!amount) return;
      const method = metodo as ExpenseDTO["paymentMethod"];
      const label = PAYMENT_LABEL[method ?? ""] ?? "Todas";
      const created = await createExpense({ name: `Taxa ${label}`, type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount, paymentMethod: method });
      setS((st) => ({ ...st, expenses: [...st.expenses, created] }));
    },
    // Novo imposto
    newTaxName: s.newTaxName,
    newTaxPct: s.newTaxPct,
    onNewTaxName: (e: React.ChangeEvent<HTMLInputElement>) => set({ newTaxName: e.target.value }),
    onNewTaxPct: (e: React.ChangeEvent<HTMLInputElement>) => set({ newTaxPct: e.target.value }),
    addTax: async (nome: string, pct: string) => {
      const amount = parseFloat(pct) || 0;
      if (!amount) return;
      const created = await createExpense({ name: nome.trim() || "Imposto", type: "IMPOSTO", calc: "PERCENTUAL", amount });
      setS((st) => ({ ...st, expenses: [...st.expenses, created] }));
    },
    // Nova despesa recorrente
    newDespesaName: s.newDespesaName,
    newDespesaValue: s.newDespesaValue,
    onNewDespesaName: (e: React.ChangeEvent<HTMLInputElement>) => set({ newDespesaName: e.target.value }),
    onNewDespesaValue: (e: React.ChangeEvent<HTMLInputElement>) => set({ newDespesaValue: e.target.value }),
    despesaSoNestaArea: s.despesaSoNestaArea,
    toggleDespesaSoNestaArea: () => setS((st) => ({ ...st, despesaSoNestaArea: !st.despesaSoNestaArea })),
    addDespesa: async (nome: string, valor: string, soNestaArea: boolean) => {
      const amount = parseFloat(valor) || 0;
      if (!nome.trim() || !amount) return;
      const created = await createExpense({
        name: nome.trim(),
        type: "DESPESA_RECORRENTE",
        calc: "FIXO",
        amount,
        recurrence: "MENSAL",
        // Padrão: vale para todas as áreas. Só a despesa recorrente oferece a
        // escolha — taxa de gateway e imposto são globais por natureza, e uma
        // caixa neles convidaria a prender por engano justamente o que, se
        // prendido, some da conta de lucro das outras áreas em silêncio.
        todasAsAreas: !soNestaArea,
        workspaceId: s.workspaceAtiva,
      });
      setS((st) => ({ ...st, expenses: [...st.expenses, created] }));
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
          // A regra nasce vinculada à área ATIVA. Sem isto toda regra nasceria
          // global e o escopo do motor nunca teria efeito.
          workspaceId: s.workspaceAtiva,
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
          const fresh = await listRules(s.workspaceAtiva);
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
    setReportPattern: (p: string) => setSetting({ reportPattern: p as NotificationSettingsDTO["reportPattern"] }),
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
    timezone,
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
