"use client";

import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";
import type { DashboardPrefsDTO } from "@/lib/actions/dashboardPrefs";
import {
  disconnectProfile,
  listAdProfiles,
  setProfileTracking,
  toggleAccountTracking,
  type AdProfileDTO,
} from "@/lib/actions/facebook";
import type { PixelConfigDTO } from "@/lib/actions/pixels";
import type { RuleDTO } from "@/lib/actions/rules";
import { corFinanceira } from "@/lib/financeiro";
import { contarUnicasAtivas } from "@/lib/despesas/rateio";
// A regra de denominador zero é UMA só nesta base. Ver o comentário do `div`.
import { div } from "@/lib/ads/metrics";
import { estadoDaConta, podeRastrear } from "@/lib/facebook/contaStatus";
import { explicarErroDeConta } from "@/lib/facebook/erroMeta";
import { rotuloDaEspera } from "@/lib/facebook/backoff";
import { rotuloDoGateway } from "@/lib/gateways/registro";
/* ⛔ `gatewayInicial` e `segredoInicial` SAÍRAM em 11/08/2026, com a gaveta
   que os usava. ⚠️ O segundo NÃO era cosmético: ele gerava a chave da Cakto,
   e sem ela o webhook nasce com `secret` nulo e a Cakto recusa toda venda com
   401. A geração vive hoje em `views/webhooks/GavetaWebhook.tsx`, com o mesmo
   cuidado de não regerar por clique. */
import type { PeriodoNome } from "@/lib/periodo";
import type { NomeIcone } from "./ui/Icone";
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
  deleteWebhook,
  type WebhookRowDTO,
} from "@/lib/actions/webhooks";
import type { CreativeRow } from "@/lib/ads/creatives";
import type { AdsOverview } from "@/lib/ads/overview";
import type { DashboardData } from "@/lib/dashboard/metrics";
import { brl, brl0, buildPoints, elapsed, multFmt, pct, plural, roasFmt, TRACO } from "@/lib/format";
import { setLastWorkspaceId, type WorkspaceDTO } from "@/lib/actions/workspaces";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import type { MetricKey } from "./types";
/* 🔴 O RÓTULO DA MÉTRICA VEM DE FORA, e a direção da dependência é o ponto.
   Ele estava escrito aqui em quinze literais; com a F5 (12/08/2026) a métrica
   virou bloco do catálogo, e o catálogo lateral precisa do MESMO nome que o card
   desenha. Copiá-lo para lá daria duas listas que divergem no primeiro commit
   que renomear uma — com a lista oferecendo um nome e a tela mostrando outro.
   ⚠️ MOVE, não mudança: nenhum rótulo foi alterado. */
import { ROTULO_DA_METRICA } from "./metricas";

/**
 * ⚠️ Vem de `lib/periodo.ts`. Era uma união local de 4 valores, uma TERCEIRA
 * cópia da mesma lista (havia outra em `metrics.ts` e outra na rota). Um período
 * novo tinha de ser escrito em três lugares para funcionar.
 */
type DashPeriod = PeriodoNome;


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
  adsSub: "campaigns" | "adsets" | "ads" | "accounts";
  fbConnected: boolean;
  adProfiles: AdProfileDTO[];
  expandedProfiles: Record<string, boolean>;
  accountSync: Record<string, { busy: boolean; msg: string | null }>;
  pixels: PixelConfigDTO[];
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
  adsPeriod: PeriodoNome;
  adsFrom: string | null;
  adsTo: string | null;
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
  creativesPeriod: PeriodoNome;
  creativesFrom: string | null;
  creativesTo: string | null;
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
  /** Passagem pura, sem cálculo: o rodapé do Dashboard conta ativas/em execução. */
  rules: RuleDTO[];
  newDespesaName: string;
  newDespesaValue: string;
  newGatewayMethod: string;
  newGatewayPct: string;
  newTaxName: string;
  newTaxPct: string;
  webhooks: WebhookRowDTO[];
  /* ⛔ O maquinário de MODAL de webhook e as credenciais de API saíram
     daqui em 11/08/2026, com a `WebhooksView`. A `WebhooksScreen` tem
     estado próprio e chama as server actions direto — porque o que ela
     entrega é uma URL que vai para o painel de um gateway, e lista mantida
     por um hook global não acompanha a troca de área.
     ⚠️ `webhooks` FICA: a Visão geral de Integrações monta o inventário
     com ela. */
  notifSettings: NotificationSettingsDTO;
  notifications: NotificationDTO[];
  notifUnread: number;
  notifOpen: boolean;
}

const DEFAULT_METRIC_ORDER: MetricKey[] = [
  "faturamento", "liquido", "lucroLiquido", "gasto", "roas", "roi", "margem", "vendas",
  "cpa", "ticket", "arpu", "ctr", "pendentes", "reembolsadas", "chargeback",
];
/**
 * ⚠️ Líquido e Lucro entram DESLIGADOS aqui, e isso não os esconde: o layout
 * padrão do Dashboard (`blocks.ts`) é quem decide o que aparece de início, e
 * este mapa só serve à lista antiga de "métricas disponíveis". Ligá-los aqui
 * mudaria o dashboard de quem já tem layout salvo, sem pedir.
 */
const DEFAULT_METRIC_VISIBLE: Record<MetricKey, boolean> = {
  faturamento: true, liquido: false, lucroLiquido: false, gasto: true, roas: true, roi: true,
  margem: true, vendas: true,
  cpa: true, ticket: true, arpu: false, ctr: false, pendentes: false, reembolsadas: false, chargeback: false,
};

function initialState(
  initialWebhooks: WebhookRowDTO[] = [],
  prefs?: DashboardPrefsDTO | null,
  initialProfiles: AdProfileDTO[] = [],
  initialPixels: PixelConfigDTO[] = [],
  initialNotifSettings: NotificationSettingsDTO = DEFAULT_NOTIF_SETTINGS,
  initialNotifications: NotificationDTO[] = [],
  initialExpenses: ExpenseDTO[] = [],
  initialRules: RuleDTO[] = [],
): State {
  const order = prefs?.order?.length
    ? (prefs.order.filter((k) => DEFAULT_METRIC_ORDER.includes(k as MetricKey)) as MetricKey[])
    : DEFAULT_METRIC_ORDER;
  // Garante que nenhuma métrica nova fique de fora de uma preferência antiga.
  const fullOrder = [...order, ...DEFAULT_METRIC_ORDER.filter((k) => !order.includes(k))];
  const visible = { ...DEFAULT_METRIC_VISIBLE, ...(prefs?.visible ?? {}) } as Record<MetricKey, boolean>;

  return {
    adsSub: "campaigns",
    fbConnected: initialProfiles.length > 0,
    adProfiles: initialProfiles,
    expandedProfiles: {},
    accountSync: {},
    pixels: initialPixels,
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
    adsFrom: null,
    adsTo: null,
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
    creativesFrom: null,
    creativesTo: null,
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
    newGatewayMethod: "PIX",
    newGatewayPct: "",
    newTaxName: "",
    newTaxPct: "",
    webhooks: initialWebhooks,
    notifSettings: initialNotifSettings,
    notifications: initialNotifications,
    notifUnread: initialNotifications.filter((n) => !n.read).length,
    notifOpen: false,
    rules: initialRules ?? [],
  };
}



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
    initialNotifSettings?: NotificationSettingsDTO;
    initialNotifications?: NotificationDTO[];
    initialExpenses?: ExpenseDTO[];
  initialRules?: RuleDTO[];
    timezone?: string;
    workspaces?: WorkspaceDTO[];
    lastWorkspaceId?: string | null;
  } = {},
) {
  const brandName = opts.brandName || "TrackHub";
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
  const [s, setS] = useState<State>(() => initialState(opts.initialWebhooks, opts.dashboardPrefs, opts.initialProfiles, opts.initialPixels, opts.initialNotifSettings, opts.initialNotifications, opts.initialExpenses, opts.initialRules));

  // Semeia as áreas vindas do servidor. Só quando MUDAM de verdade: o layout
  // remonta a cada navegação e reescrever o estado igual derrubaria a área
  // ativa que o usuário acabou de escolher.
  useEffect(() => {
    if (!areasServidor) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DELIBERADO: ver "cinco regras que custaram caro" #4 no CLAUDE.md. O inicializador do useState só roda na montagem, então sem este efeito trocar de área mostrava os dados da área ANTERIOR. Já compara por conteúdo antes de gravar.
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

  /**
   * 🐛 SINCRONIZA AS LISTAS DO SERVIDOR. Sem isto, trocar de área não trocava
   * Integrações, Regras nem Taxas.
   *
   * O estado nasce de `useState(() => initialState(props))`, e o inicializador
   * de `useState` **só roda na montagem**. Quando `trocarWorkspace` chama
   * `router.refresh()`, o servidor devolve os dados da área nova — e o estado
   * os IGNORAVA, porque o componente não remonta numa navegação de mesma rota.
   *
   * O sintoma não era só "demora": a tela mostrava o webhook e o pixel da área
   * ANTERIOR. Clicar em "Editar" ali agia sobre a integração de outra
   * operação — o usuário reportou exatamente isso, "configurei o webhook da
   * área secundária e mudou o da principal". Também explicava o "delay de ~1
   * minuto": não havia atualização nenhuma, só uma remontagem eventual ao
   * navegar para outra rota.
   *
   * ⚠️ Só sincroniza o que é **dado do servidor**. Estado de formulário e de
   * modal fica de fora de propósito: reescrevê-lo fecharia a gaveta que o
   * usuário tem aberta a cada refresh.
   *
   * ⚠️ Compara por conteúdo antes de gravar. O layout re-renderiza em toda
   * navegação e as props chegam com identidade nova mesmo sem mudança; sem a
   * comparação, isto viraria um `setState` por render.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DELIBERADO, mesma razão do efeito acima: sincroniza as props do servidor. A comparação por conteúdo é o que impede um setState por render.
    setS((st) => {
      const mudou = <T,>(atual: T, servidor: T | undefined) =>
        servidor !== undefined && JSON.stringify(atual) !== JSON.stringify(servidor);
      const patch: Partial<State> = {};
      if (mudou(st.webhooks, opts.initialWebhooks)) patch.webhooks = opts.initialWebhooks;
      if (mudou(st.adProfiles, opts.initialProfiles)) patch.adProfiles = opts.initialProfiles;
      if (mudou(st.pixels, opts.initialPixels)) patch.pixels = opts.initialPixels;
      if (mudou(st.expenses, opts.initialExpenses)) patch.expenses = opts.initialExpenses;
      return Object.keys(patch).length ? { ...st, ...patch } : st;
    });
  }, [
    opts.initialWebhooks,
    opts.initialProfiles,
    opts.initialPixels,
    opts.initialExpenses,
  ]);

  function set(patch: Partial<State>) {
    setS((st) => ({ ...st, ...patch }));
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
      // `custom` é o único período que precisa das datas: os outros o servidor
      // resolve sozinho, no fuso do usuário.
      if (s.adsPeriod === "custom" && s.adsFrom) {
        qs.set("from", s.adsFrom);
        qs.set("to", s.adsTo ?? s.adsFrom);
      }
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
  }, [s.adsPeriod, s.adsFrom, s.adsTo, s.adsAccount, s.workspaceAtiva, s.adsRefreshKey]);

  // Ranking de criativos.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    (async () => {
      const qs = new URLSearchParams({ period: s.creativesPeriod, sort: s.creativesSort });
      if (s.creativesPeriod === "custom" && s.creativesFrom) {
        qs.set("from", s.creativesFrom);
        qs.set("to", s.creativesTo ?? s.creativesFrom);
      }
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
  }, [s.creativesPeriod, s.creativesFrom, s.creativesTo, s.creativesSort, s.workspaceAtiva, s.adsRefreshKey]);

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


  const d = s.dashData;
  const k = d?.kpis;
  const revenue = k?.revenue ?? 0;
  const spend = k?.spend ?? 0;
  const sales = k?.sales ?? 0;
  /**
   * ⛔ REGRA DESTA CAMADA — vale para QUALQUER valor, não para uma lista deles.
   *
   * **Todo valor que pode ser `null` porque o denominador não existe chega até a
   * apresentação como `null`.** Um `?? 0` ou `|| 0` aqui compila, mantém o tipo
   * correto e **desfaz a correção em silêncio** — o formatador recebe um zero
   * legítimo e imprime "R$ 0,00" ou "0,00%" como se fosse medição.
   *
   * ⚠️ Esta advertência já existiu ENUMERANDO cinco métricas, e foi por isso que
   * ela falhou: o `chargebackRate` não estava na lista, ganhou `?? 0` na linha
   * abaixo, e a correção dele nasceu inerte — compilando, com o tipo certo, sem
   * chegar à tela. **Comentário que lista casos morre no primeiro caso novo;
   * comentário que descreve a regra sobrevive.**
   *
   * O que "indefinido" quer dizer em cada uma: sem venda não existe ticket nem
   * CPA, sem gasto não existe ROAS, sem impressão não existe CTR, sem comprador
   * não existe ARPU, sem faturamento não existe margem, sem evento de venda não
   * existe taxa de chargeback. A lista é ilustração — a regra é a frase acima.
   */
  const ticket = k?.ticket ?? null;
  const cpa = k?.cpa ?? null;
  const arpu = k?.arpu ?? null;
  const buyers = k?.buyers ?? 0;
  const roas = k?.roas ?? null;
  // `null` = sem custo no período, ROI indefinido. Não colapsar para 0: "0,00x"
  // se lê como empate, e empate é diferente de "não dá para calcular".
  const roi = k?.roi ?? null;
  const margin = k?.margin ?? null;
  const ctr = k?.ctr ?? null;
  const pendentes = k?.pendentes ?? 0;
  const pendentesValor = k?.pendentesValor ?? 0;
  const liquido = k?.liquido ?? 0;

  /**
   * De onde saiu a taxa do gateway neste período.
   *
   * ⚠️ **Período MISTO é o caso normal**, não a exceção: basta ter dois gateways,
   * ou um que só informe a taxa em parte dos eventos (a Kirvano manda em 36 de
   * 46). Um Faturamento Líquido que soma valor medido com estimativa sem dizer
   * qual é qual é PIOR que não ter o dado — parece exato e não é.
   *
   * Por isso o rótulo do card muda, em vez de a informação viver só no tooltip:
   * quem olha o número tem de ver a procedência junto.
   */
  const fin = d?.financeiro;
  const fonteTaxa = fin?.fontes?.gateway;
  const rotuloLiquido = (() => {
    if (!fonteTaxa) return "após taxas e impostos";
    const { vendasComValorReal: reais, vendasSemValorReal: estimadas } = fonteTaxa;
    if (reais > 0 && estimadas > 0) {
      return `taxa real em ${reais} de ${reais + estimadas} vendas`;
    }
    if (reais > 0) return "taxa informada pelo gateway";
    return "após taxas e impostos";
  })();
  const lucro = k?.profit ?? 0;
  const unicasFora = contarUnicasAtivas(s.expenses);
  const reembolsadas = k?.reembolsadas ?? 0;
  const chargebackRate = k?.chargebackRate ?? null;

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
    {
      label: string;
      value: string;
      trendColor: string;
      trendPath: string;
      trendLabel: string;
      delta: number | null;
      invertido: boolean;
      /** Cor do NÚMERO, quando a métrica é financeira. Ver `corFinanceira`. */
      cor?: string;
    }
  > = {
    faturamento: { label: ROTULO_DA_METRICA.faturamento, value: brl(revenue), ...trendOf("revenue") },
    // ⚠️ Líquido e Lucro NÃO têm delta: o backend não calcula variação para eles
    // (dependem das taxas do período, que não são reprocessadas na janela
    // anterior). Um delta inventado aqui seria pior que nenhum.
    liquido: {
      label: ROTULO_DA_METRICA.liquido,
      value: brl(liquido),
      delta: null, invertido: false, trendColor: N, trendPath: UP_PATH,
      trendLabel: rotuloLiquido,
      cor: corFinanceira(liquido, "lucro"),
    },
    lucroLiquido: {
      label: ROTULO_DA_METRICA.lucroLiquido,
      value: brl(lucro),
      delta: null, invertido: false, trendColor: N, trendPath: UP_PATH,
      /* 🔴 O AVISO VAI NO CARD, não só no gráfico. Despesa única fica fora do
         cálculo (o schema não guarda quando ela ocorreu), e o card de Lucro é a
         primeira tela onde o número seria diferente por causa dela. Custo que
         some sem avisar onde o lucro aparece é o mesmo erro do rateio, na
         direção oposta. */
      trendLabel:
        unicasFora > 0
          ? `líquido − anúncios − despesas · ${unicasFora} única${unicasFora > 1 ? "s" : ""} fora do cálculo`
          : "líquido − anúncios − despesas",
      cor: corFinanceira(lucro, "lucro"),
    },
    gasto: { label: ROTULO_DA_METRICA.gasto, value: brl(spend), ...trendOf("spend", true) },
    // ⚠️ Tipo "roas": o equilíbrio dele é 1x, não 0 — `0,80x` é prejuízo.
    //    Sem GASTO não existe ROAS, e agora o servidor já devolve `null` nesse
    //    caso — o `spend > 0 ? … : null` que havia aqui virou redundante. Ele
    //    era a metade certa da correção: a COR já sabia que o valor era
    //    indefinido enquanto o número continuava imprimindo "0,0x".
    roas: { label: ROTULO_DA_METRICA.roas, value: roasFmt(roas), ...trendOf("roas"), cor: corFinanceira(roas, "roas") },
    // Bloco 4: ROI passa a ser multiplicador (era "1331%"), com 2 casas como
    // nos exemplos do roteiro. Sem custo no período não há ROI — mostra "—".
    roi: { label: ROTULO_DA_METRICA.roi, value: multFmt(roi), ...trendOf("roi"), cor: corFinanceira(roi, "roi") },
    margem: { label: ROTULO_DA_METRICA.margem, value: pct(margin), ...trendOf("margem"), cor: corFinanceira(margin, "lucro") },
    vendas: { label: ROTULO_DA_METRICA.vendas, value: String(sales), ...trendOf("sales") },
    cpa: { label: ROTULO_DA_METRICA.cpa, value: brl(cpa), ...trendOf("cpa", true) },
    ticket: { label: ROTULO_DA_METRICA.ticket, value: brl(ticket), ...trendOf("ticket") },
    arpu: { label: ROTULO_DA_METRICA.arpu, value: brl(arpu), ...trendOf("arpu") },
    ctr: { label: ROTULO_DA_METRICA.ctr, value: pct(ctr), ...trendOf("ctr") },
    // ⚠️ VALOR em destaque, contagem como apoio. "12 vendas pendentes" não diz
    // quanto dinheiro está na mesa; "R$ 240,00" diz.
    pendentes: {
      label: ROTULO_DA_METRICA.pendentes,
      value: brl(pendentesValor),
      delta: null, invertido: false, trendColor: N, trendPath: DOWN_PATH,
      trendLabel: plural(pendentes, "venda aguardando pagamento", "vendas aguardando pagamento", "nenhuma aguardando"),
    },
    reembolsadas: { label: ROTULO_DA_METRICA.reembolsadas, value: String(reembolsadas), delta: null, invertido: false, trendColor: N, trendPath: DOWN_PATH, trendLabel: "no período" },
    chargeback: { label: ROTULO_DA_METRICA.chargeback, value: pct(chargebackRate), delta: null, invertido: false, trendColor: A, trendPath: UP_PATH, trendLabel: "sobre eventos de venda" },
  };
  const kpiCards = s.metricOrder.filter((key) => s.metricVisible[key]).map((key) => reg[key]);

  const W = 600, H = 180, PAD = 12;
  const cr = d?.chart.revenue?.length ? d.chart.revenue : [0, 0];
  // Série de gasto vazia (granularidade horária) mantém o mini-gráfico com o
  // eixo do faturamento, e a linha de gasto colada no chão em vez de um pico
  // fantasma às 00h.
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
  /** Participação em %, ou "—" quando não há total sobre o que calcular. */
  const pct1 = (parte: number, total: number) => {
    const r = div(parte, total);
    return r === null ? TRACO : Math.round(r * 100) + "%";
  };

  /* 🔴 AQUI HAVIA `|| 1`, E ELE ERA O PIOR DA LISTA. Os outros defeitos deste
     mapa devolviam ZERO, que alguém atento reconhece como "sem dado". O `|| 1`
     FABRICAVA um denominador: com todas as fontes zeradas, `x.total / 1` saía
     `0%` — um percentual plausível, calculado sobre uma unidade que não existe
     em lugar nenhum. Não é arredondamento nem fallback: é um número inventado
     com aparência de medição. */
  const srcTotal = (d?.sources ?? []).reduce((a, x) => a + x.total, 0);
  const srcMax = Math.max(1, ...(d?.sources ?? []).map((x) => x.total));
  const sources = (d?.sources ?? []).map((x) => ({
    name: x.name,
    total: x.total,
    totalLabel: brl0(x.total),
    pctLabel: pct1(x.total, srcTotal),
    barWidth: Math.round((x.total / srcMax) * 100) + "%",
  }));
  /**
   * Posicionamento (`utm_term`). É TABELA, não donut: a lista tem cauda longa
   * (feed, stories, reels, explore, audience network…) e um donut com 12 fatias
   * vira legenda ilegível. Aqui o que se compara é linha a linha.
   */
  const placeMax = Math.max(1, ...(d?.byPlacement ?? []).map((x) => x.total));
  const placements = (d?.byPlacement ?? []).map((x) => ({
    name: x.name,
    total: x.total,
    sales: x.sales,
    totalLabel: brl0(x.total),
    // Ticket do posicionamento: faturamento ÷ CONVERSÕES daquele lugar.
    ticketLabel: (() => { const t = div(x.total, x.sales); return t === null ? TRACO : brl0(t); })(),
    barWidth: Math.round((x.total / placeMax) * 100) + "%",
  }));
  /**
   * Faturamento aprovado que NÃO tem posicionamento.
   *
   * ⚠️ A tabela precisa dizer isto. Ela nunca soma o faturamento total — venda
   * sem clique, sem UTM ou com `{{placement}}` cru fica de fora —, e sem a
   * linha do resto o usuário compara os números com o KPI, vê que não fecham e
   * conclui que um dos dois está errado.
   */
  const placementSemDados = Math.max(0, revenue - (d?.byPlacement ?? []).reduce((a, x) => a + x.total, 0));

  const payTotal = (d?.payments ?? []).reduce((a, x) => a + x.total, 0); // ver a nota do `srcTotal`
  const payMax = Math.max(1, ...(d?.payments ?? []).map((x) => x.total));
  const payments = (d?.payments ?? []).map((x) => ({
    name: x.name,
    total: x.total,
    count: x.count,
    totalLabel: brl0(x.total),
    pctLabel: pct1(x.total, payTotal),
    barWidth: Math.round((x.total / payMax) * 100) + "%",
  }));

  /* ⛔ O `funnel` de TRÊS etapas foi DELETADO em 07/08/2026, junto do `rate()`
     que só ele usava. Ele montava `{label, acao, valor, count, hasRate, rate}`
     para o desenho antigo, e ficou sem consumidor quando o bloco passou a ler
     `funnelStages` — que tem CINCO etapas, os nomes curtos da referência e a
     `fonte` de cada número.

     ⚠️ Ele calculava a conversão em relação à etapa ANTERIOR. A fita mostra a
     fração do MÁXIMO, que é outra conta: as duas coincidem num funil que só
     cai e divergem quando uma etapa cresce. Reaproveitar o `rate` daqui na
     figura nova daria "194%" numa pílula. */

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
      /* ⚠️ SEGURO POR TIMING, NAO POR ESTRUTURA — e a diferenca importa.
         `elapsed()` le `Date.now()` e produz mismatch de hidratacao quando o
         mesmo dado renderiza no servidor e no cliente. Aqui nao acontece
         porque `dashData` nasce `null` e so e preenchido por `fetch` no
         cliente: na passagem do servidor esta lista esta VAZIA.
         ⛔ Isso quebra no dia em que alguem passar `initialDashData` do
         layout. Se for fazer isso, troque por `<Desde>` (tk/Desde.tsx). */
      timeLabel: elapsed(f.ts),
    };
  });

  const filterOptions = d?.filterOptions ?? { accounts: [], products: [], sources: [] };

  // ── Taxas e Despesas (Fase 13) ── resumo vem do dashboard real.
  const PAYMENT_LABEL: Record<string, string> = { PIX: "Pix", CARTAO: "Cartão", BOLETO: "Boleto", OUTRO: "Todas", "": "Todas" };
  const gatewayExpenses = s.expenses
    .filter((e) => e.type === "TAXA_GATEWAY")
    .map((e) => ({
      id: e.id,
      name: e.name,
      methodLabel: e.paymentMethod ? PAYMENT_LABEL[e.paymentMethod] : "todas as formas",
      amountStr: String(e.amount),
      // ⚠️ "R$" sozinho era ambíguo — não dizia se a taxa incide por venda ou
      // uma vez no período. E ela incidia UMA VEZ, que era o bug. O rótulo
      // agora afirma a unidade que o cálculo usa.
      unit: e.calc === "PERCENTUAL" ? "% por venda" : "R$ por venda",
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
      /* O NÚMERO ao lado do formatado. Expor só `valueLabel` é a mesma doença do
         `finance`: cálculo e apresentação misturados, e quem precisa somar tem
         de reverter uma string em reais. O formatado FICA — quem já consome não
         pode quebrar. */
      value: e.amount,
      /** A frequência cadastrada — hoje ela É respeitada pelo rateio. */
      recurrence: e.recurrence,
      /**
       * 🔴 `true` = esta linha NÃO entra no cálculo do lucro.
       *
       * Despesa única não tem data de ocorrência no schema, então não há em que
       * período somá-la. Ela fica de fora — mas a linha tem de DIZER isso, aqui
       * e no card de Lucro. Custo que some em silêncio é o defeito que o rateio
       * acabou de consertar, na direção oposta.
       */
      foraDoCalculo: e.recurrence === "UNICA",
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
    /**
     * Erro da DESCOBERTA de contas deste perfil, ja traduzido.
     *
     * Passa `null` como status porque isto e do PERFIL, nao de uma conta — nao
     * ha `account_status` para cruzar. Cai direto na traducao da mensagem.
     */
    erroDescoberta: explicarErroDeConta(p.lastDiscoveryError, null),
    accounts: p.accounts.map((ac) => ({
      id: ac.id,
      name: ac.name,
      fbAccountId: ac.fbAccountId,
      currency: ac.currency,
      /**
       * ⚠️ O rotulo vem do `account_status` CRU, nao do enum `status`.
       *
       * O enum colapsa DESABILITADA (2) e PAGAMENTO PENDENTE (3) no mesmo
       * `PAUSED` — e as duas coisas pedem acoes opostas do usuario. Foi por
       * isso que uma conta desabilitada apareceu como se fosse normal por dois
       * dias. Ver `lib/facebook/contaStatus.ts`.
       */
      statusTag:
        estadoDaConta(ac.accountStatus).tom === "ok" ? "tag tag-accent"
        : estadoDaConta(ac.accountStatus).tom === "erro" ? "tag tag-danger"
        : "tag tag-neutral",
      /**
       * ⚠️ TRES estados, nao dois. `accountStatus` nulo pode ser "o perfil
       * ainda nao sincronizou" ou "a Meta nao informou" — e so o segundo e
       * motivo de estranheza. Sem a distincao, uma conta recem-conectada
       * aparecia com o mesmo rotulo de uma conta cujo perfil perdeu permissao.
       */
      statusLabel:
        ac.accountStatus == null && p.nuncaSincronizou
          ? "Aguardando 1ª sincronização"
          : estadoDaConta(ac.accountStatus).rotulo,
      /** O que fazer a respeito, quando ha algo a fazer. */
      statusAcao: estadoDaConta(ac.accountStatus).acao,
      /** A conta consegue ser lida pela API? Decide o bloqueio do toggle. */
      podeRastrear: podeRastrear(ac.accountStatus),
      /**
       * A explicacao de por que esta conta nao sincroniza, cruzando o erro
       * guardado com o status. O status VENCE o erro quando ja explica — a
       * mensagem da Meta diz "permission" para conta desabilitada.
       */
      erroSync: explicarErroDeConta(ac.lastSyncError, ac.accountStatus),
      falhasSeguidas: ac.syncErrorCount,
      /**
       * A mensagem CRUA da Meta, para o detalhe tecnico.
       *
       * ⚠️ Ela existe na tela, mas ESCONDIDA. A traducao existe justamente
       * para o usuario nao precisar ler ingles truncado com URL de
       * documentacao no meio — e mostrar as duas ao mesmo tempo desfaz o
       * ganho. Some quando a traducao ja disse tudo (mensagem desconhecida ja
       * mostra o texto cru como conteudo principal).
       */
      erroCru: ac.lastSyncError,
      /**
       * "nova tentativa em ~28 min", quando a conta esta em backoff.
       *
       * ⚠️ Existe para a espera nao parecer abandono. Uma conta que para de
       * tentar sem dizer que vai voltar a tentar e indistinguivel de uma conta
       * esquecida.
       */
      esperaLabel: rotuloDaEspera(ac.syncErrorCount, ac.lastSyncErrorAt),
      /**
       * 🔴 "sem gasto no periodo" e "ainda nao buscamos o historico" eram
       * INDISTINGUIVEIS: as duas mostravam zero. Foi por isso que um testador
       * viu tres contas vazias e so descobriu o motivo porque mandaram clicar
       * em Sincronizar.
       */
      buscandoHistorico: ac.backfillFeitoEm == null,
      /**
       * O erro desta conta e o MESMO do perfil?
       *
       * 🔴 Quando o token perde permissao, as N contas falham pela mesma causa
       * e a tela repetia o mesmo bloco N+1 vezes (uma por conta + a do perfil).
       * Com 5 contas eram 6 blocos identicos. A causa e uma so; o lugar de
       * dizer isso e o topo.
       */
      mesmoErroDoPerfil:
        p.lastDiscoveryError != null &&
        ac.lastSyncError != null &&
        // Compara a CAUSA traduzida, nao o texto cru: a Meta acrescenta o nome
        // da conta e a URL da doc, entao as strings nunca sao identicas.
        explicarErroDeConta(ac.lastSyncError, ac.accountStatus)?.mensagem ===
          explicarErroDeConta(p.lastDiscoveryError, null)?.mensagem,
      trackingOn: ac.trackingEnabled,
      syncBusy: s.accountSync[ac.id]?.busy ?? false,
      syncMsg: s.accountSync[ac.id]?.msg ?? null,
      toggleTracking: async () => {
        // ⛔ Nao bloqueia o clique — AVISA. Bloquear impediria de DESLIGAR o
        // rastreamento de uma conta desabilitada, que e exatamente o que o
        // usuario quer fazer quando descobre o problema. O aviso fica no card.
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
          /**
           * 🔴 Aqui estava `" (erro)"` — a MENSAGEM da Meta era descartada.
           *
           * `syncUserMetrics` faz `try/catch` por conta e empilha o erro em
           * `summary.errors`, então uma conta que falha não derruba as outras:
           * o ciclo termina "com sucesso", `lastMetricsAt` avança e a conta
           * quebrada fica **invisível**. O único lugar que exibia isso mostrava
           * um "(erro)" mudo, e a única forma de ler a causa era chamar a rota
           * de cron com o `CRON_SECRET`.
           *
           * É o mesmo defeito do `affected: 1` das regras: o produto sabia o
           * que houve e escolhia não dizer.
           */
          const msg = res.ok
            ? json.errors?.length
              ? `✗ ${json.errors.join(" · ")}`
              : `${json.campaigns || 0} camp. · ${json.ads || 0} anúncios · ${json.metrics || 0} dias`
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
  /**
   * ⚠️ Os `CreativeRow` CRUS, sem modelo de apresentação no meio.
   *
   * Aqui havia um `.map()` que já entregava `ctrLabel`/`roasLabel`/`spendLabel`
   * formatados — e a tela nova precisa dos NÚMEROS: ela ordena, soma para os
   * KPIs, compara metades da janela e decide abas. Reverter string em real é o
   * mesmo defeito que o `despesaRows` pagou em 06/08.
   *
   * ⛔ E o mapa antigo escondia um bug: `c.ctr ? pct(c.ctr) : "—"` trata **CTR
   * zero como indefinido**. `0` é falsy, e um criativo com impressão e nenhum
   * clique tem CTR de 0% medido — não ausente. É a distinção central do projeto
   * colapsada por um `?`. A tela nova formata por `=== null`.
   *
   * A paleta ⌘K (`AppShell`) consome `id`/`name`/`campaign`, que o DTO cru já
   * tem — por isso ela não muda.
   */
  const creatives = s.creativesData ?? [];

  const adsTabs = (["campaigns", "adsets", "ads", "accounts"] as const).map((k, i) => ({
    key: k,
    label: ["Campanhas", "Conjuntos", "Anúncios", "Contas"][i],
    checked: s.adsSub === k,
    go: () => set({ adsSub: k }),
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

  /**
   * Ícone e cor por tipo de notificação.
   *
   * ⚠️ Devolve o NOME do ícone (`ui/Icone`), não um emoji. Emoji é desenhado
   * pelo sistema operacional: muda de forma entre plataformas, ignora a cor da
   * marca e some no tema escuro em alguns aparelhos. A cor aqui carrega
   * informação — verde para venda aprovada, âmbar para pendente.
   */
  const NOTIF_ICON: Record<string, { nome: NomeIcone; cor: "ok" | "aviso" | "marca" | "suave" }> = {
    VENDA_APROVADA: { nome: "vendaAprovada", cor: "ok" },
    VENDA_PENDENTE: { nome: "vendaPendente", cor: "aviso" },
    RELATORIO: { nome: "relatorio", cor: "marca" },
    REGRA_EXECUTADA: { nome: "automacao", cor: "marca" },
    SISTEMA: { nome: "sino", cor: "suave" },
  };
  const notifItems = s.notifications.map((n) => ({
    id: n.id,
    icone: NOTIF_ICON[n.type] ?? { nome: "sino" as NomeIcone, cor: "suave" as const },
    title: n.title,
    content: n.content,
    read: n.read,
    /* ⚠️ SEGURO POR ESTRUTURA, nao por timing: `timeLabel` so e renderizado
       dentro do `Popover` do sino, que faz `return null` enquanto fechado — e
       ele nasce fechado, entao o texto nunca entra no HTML do servidor.
       ⛔ Quem renderiza notificacao FORA do popover nao pode usar este campo:
       use `timestamp` com `<Desde>` (tk/Desde.tsx). Foi o que a Visao geral de
       Integracoes fez. */
    timeLabel: elapsed(new Date(n.timestamp).getTime()),
    /** O instante CRU, para quem precisa renderizar com `<Desde>`. */
    timestamp: n.timestamp,
  }));


  return {
    brandName,
    brandInitial: brandName.charAt(0),

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
    // ⚠️ Sair do "Personalizado" LIMPA o intervalo. Sem isso, o rótulo do
    // seletor voltaria a mostrar as datas antigas ao reescolher "Personalizado".
    setDashPeriod: (p: DashPeriod, from?: string, to?: string) =>
      set({ dashPeriod: p, dashFrom: from ?? null, dashTo: to ?? null }),
    setDashAccount: (v: string) => set({ dashAccount: v }),
    setDashProduct: (v: string) => set({ dashProduct: v }),
    setDashSource: (v: string) => set({ dashSource: v }),
    /** Aplica o intervalo do calendário e já muda o período para "custom". */
    setDashRange: (from: string, to: string) => set({ dashPeriod: "custom", dashFrom: from, dashTo: to }),

    // Registro por chave: o grid do Bloco 2 renderiza cada KPI como bloco
    // independente, então precisa acessar a métrica pelo id e não pela ordem.
    kpiCards, chart, chartPeriodLabel, products, sources, placements, placementSemDados, payments, feed,
    metricCards: reg,
    // Séries do Bloco 4 (por horário / por dia), já filtradas no servidor.
    // Bloco 5: séries brutas para os gráficos novos (o front formata).
    chartSerie: {
      labels: d?.chart.labels ?? [],
      revenue: d?.chart.revenue ?? [],
      spend: d?.chart.spend ?? [],
      // Sem gasto por hora a linha não é desenhada, e o gráfico diz por quê.
      gastoNaSerie: d?.chart.gastoNaSerie ?? true,
    },
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
        // ⚠️ `custoTotal` do servidor, não `spend + expenses.total`: aquela
        // soma EXCLUÍA as despesas recorrentes, então o tooltip do ROI mostrava
        // um custo menor que o usado na conta. Mesmo bug do painel de Taxas.
        case "roi": return [["Lucro líquido", brl(k?.profit ?? 0)], ["Investimento total", brl(fin?.custoTotal ?? 0)]];
        case "cpa": return [["Gasto", brl(spend)], ["Vendas", n(sales)]];
        case "ticket": return [["Faturamento", brl(revenue)], ["Vendas", n(sales)]];
        case "arpu": return [["Faturamento", brl(revenue)], ["Compradores únicos", n(k?.buyers ?? 0)]];
        case "margem": return [["Lucro", brl(k?.profit ?? 0)], ["Faturamento", brl(revenue)]];
        case "lucro": return [["Faturamento", brl(revenue)], ["Gasto", brl(spend)], ["Taxas e despesas", brl((fin?.totalDescontos ?? 0) + (fin?.despesas ?? 0))]];
        case "ctr": return [["Cliques", n(k?.clicks ?? 0)]];
        default: return undefined;
      }
    },
    /**
     * De onde veio o faturamento, para o card de ROI.
     *
     * ⚠️ A terceira linha diz as DUAS possibilidades porque elas são
     * indistinguíveis por construção: quem foi direto ao link do checkout e
     * quem teve o rastreamento falhando produzem o mesmo estado — o visitante
     * não passou pelo nosso script. Escolher uma seria inventar.
     */
    origemDaReceita: (() => {
      const o = d?.origemDaReceita ?? { campanha: 0, direto: 0, semOrigem: 0 };
      return [
        { rotulo: "de campanha", valor: o.campanha, brl: brl(o.campanha), alerta: false, ajuda: null as string | null },
        {
          rotulo: "de tráfego direto",
          valor: o.direto,
          brl: brl(o.direto),
          alerta: false,
          ajuda: "O visitante chegou ao seu site sem vir de anúncio — orgânico, link na bio, indicação.",
        },
        {
          rotulo: "sem origem identificada",
          valor: o.semOrigem,
          brl: brl(o.semOrigem),
          // Só esta pede atenção, e mesmo assim pode ser legítima.
          alerta: o.semOrigem > 0,
          ajuda:
            "Veio direto ao checkout ou o rastreamento não pegou — não dá para saber qual dos dois. " +
            "Se você mesmo abriu o link do checkout para testar, é isto.",
        },
      ];
    })(),
    /** Ticket médio cru — o funil usa para estimar o faturamento perdido. */
    ticketMedio: k?.ticket,
    /**
     * 🔴 O RÓTULO SEGUE A CONTAGEM, NÃO A REFERÊNCIA.
     *
     * A etapa 2 chama **Sessões**, não "Vis. Página". O runtime grava uma linha
     * de `Click` por SESSÃO (`sessionStorage` no `pixel.js`), então quem abre
     * cinco páginas conta um. "Vis. Página" prometia pageview e entregava
     * sessão — número certo com nome errado, que é pior que a ausência porque o
     * gestor divide por ele.
     *
     * ⚠️ A `fonte` já dizia a verdade ("1 por sessão") enquanto o rótulo ao lado
     * dizia outra coisa. Quando os dois discordam, o errado é o que promete
     * mais. Divergência da referência registrada no `04`.
     */
    funnelStages: [
      { chaveInfo: "cliques", label: "Cliques no anúncio", curto: "Cliques", value: d?.funnel.cliques ?? 0, fonte: "Meta Ads (métrica diária)" },
      {
        chaveInfo: "visitas",
        label: "Sessões rastreadas",
        curto: "Sessões",
        value: d?.funnel.visitas ?? 0,
        fonte: "Nosso script — 1 por sessão",
        ajuda:
          "Sessões rastreadas pelo nosso script na sua página — uma por sessão, " +
          "não uma por página aberta. Por isso o número difere de “Cliques no link” " +
          "da Meta, que conta cliques.",
      },
      {
        chaveInfo: "checkouts",
        label: "Initiate Checkout",
        curto: "ICs",
        /**
         * 🔴 SÓ OS ICs COM JORNADA — e é o que mantém a cadeia medível.
         *
         * `funnel.checkouts` passou a ser `icsComJornada` em 13/08/2026. Antes
         * era `comJornada + semJornada`, e as duas parcelas são POPULAÇÕES
         * DISJUNTAS: uma é `Click` com `checkoutAt`, a outra é `PixelEvent` sem
         * `clickId`. Somadas, a etapa ficava maior que `Sessões` — medido no
         * dev, 38 + 35 = 73 contra 57, e a pílula imprimia **128,1%**.
         *
         * Uma taxa de conversão pressupõe numerador SUBCONJUNTO do
         * denominador. `comJornada` é subconjunto de `Sessões` (mesma tabela);
         * `semJornada` não é subconjunto de nada da cadeia.
         */
        value: d?.funnel.checkouts ?? 0,
        fonte: "Nosso script — sessões que iniciaram checkout",
        ajuda:
          "Sessões que chegaram ao checkout. Entram aqui as que o nosso script " +
          "viu começar E as que o webhook do gateway carimbou na mesma jornada — " +
          "as duas são linhas da tabela de sessões, então a razão com a etapa " +
          "anterior é conversão dentro do mesmo instrumento. O checkout sem " +
          "jornada nenhuma fica FORA: ele não é subconjunto de sessões, é " +
          "disjunto delas, e aparece declarado sob o número. " +
          "Atenção ao trecho seguinte: a parcela carimbada pelo gateway existe " +
          "porque a venda chegou, então ela não perde ninguém no caminho até a " +
          "venda — por isso a taxa dali sai como 'fontes diferentes' em vez de " +
          "porcentagem.",
        /**
         * 🔴 OS CHECKOUTS DERIVADOS DA VENDA — declarados, FORA da geometria.
         *
         * Mesma decisão de `Cliques`: eles existem, o usuário precisa vê-los, e
         * não podem entrar na escala porque são de outro instrumento. Aqui é
         * pior que "outro instrumento": é o instrumento SEGUINTE escrevendo a
         * etapa anterior.
         */
        derivadosDaVenda: d?.funnel.checkoutsDerivadosDaVenda ?? 0,
        /**
         * 🔴 A ENTRADA LATERAL — declarada, e FORA da cadeia.
         *
         * Checkout que não casou jornada nenhuma: o comprador nunca passou pelo
         * nosso script. Ele existe, é o número que revela rastreamento mal
         * instalado, e **não pode entrar na fita** — não é subconjunto de
         * `Sessões`, é disjunto dela.
         *
         * ⛔ Somar de volta "para não perder o número" é exatamente o defeito
         * que saiu daqui. O número não se perde: ele é dito, com o nome do que
         * é, ao lado da etapa.
         */
        entradaLateral: d?.funnel.checkoutsSemJornada ?? 0,
      },
      { chaveInfo: "iniciadas", label: "Vendas iniciadas", curto: "Vendas Inic.", value: d?.funnel.iniciadas ?? 0, fonte: "Gateway — todos os status" },
      { chaveInfo: "aprovadas", label: "Vendas aprovadas", curto: "Vendas Apr.", value: d?.funnel.vendas ?? 0, fonte: "Gateway — status APROVADA" },
    ],
    /**
     * 🔴 AS PONTAS DA COBERTURA, CRUAS — a tela é que forma a frase.
     *
     * Elas não entram em `funnelStages` porque não são etapas: `visitasDaMeta`
     * é um RECORTE de `Sessões`, e desenhá-lo como etapa própria contaria a
     * mesma pessoa duas vezes na fita.
     *
     * ⚠️ As duas janelas vêm juntas de propósito. A cobertura só é comparável
     * quando os dois lados cobrem os mesmos dias, e no dev eles não cobrem —
     * `DailyAdMetric` de 30/07 a 12/08 contra `Click` de 04/08 a 07/08.
     */
    funnelCobertura: {
      cliquesDaMeta: d?.funnel.cliques ?? 0,
      sessoesDaMeta: d?.funnel.visitasDaMeta ?? 0,
      sessoesDeOutrasOrigens: d?.funnel.visitasDeOutrasOrigens ?? 0,
      janelaCliques: d?.funnel.janelaCliques,
      janelaSessoes: d?.funnel.janelaSessoes,
    },
    /**
     * Robôs já EXCLUÍDOS das métricas, por motivo. A tela mostra para o usuário
     * poder conferir se o filtro exagera ou falha — sem isso, "removemos os
     * bots" seria uma afirmação que ele teria de aceitar no escuro.
     */
    bots: d?.bots ?? [],
    ambientesDeTeste: d?.ambientesDeTeste ?? [],
    sparklines: d?.chart.sparklines ?? {},
    /**
     * As 5 campanhas que mais faturaram NA JANELA DO DASHBOARD.
     *
     * ⛔ NAO use `adsData.campaigns` nem `filteredCampaigns` para isto. Aquelas
     * obedecem a janela do GERENCIADOR (`period=7d` fixo) e ao filtro de status
     * daquela tela — o bloco mostraria um periodo diferente do filtro que esta
     * logo acima dele, e com o campo de busca vazio (o caso comum) as duas
     * listas sao identicas, entao o defeito seria MUDO.
     *
     * ⚠️ Valores CRUS. `roas` e `null` quando nao houve gasto — a tela mostra
     * "—". Nada de `?? 0` no caminho.
     */
    topCampaigns: d?.topCampaigns ?? [],
    /**
     * Heatmap dia-da-semana x hora. Passagem PURA — a media e a escala moram na
     * tela, porque e la que o denominador precisa aparecer no tooltip.
     *
     * ⚠️ `observacoes: 0` = a janela nao passou por aquele dia da semana. Nao e
     * "zero venda". Quem desenhar tem de manter a distincao.
     */
    heatmap: d?.heatmap ?? { celulas: [], maxObservacoes: 0 },
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


    adsTabs,
    adsSub: s.adsSub,
    // Bloco 6: a tabela nova precisa dos NÚMEROS CRUS para derivar
    // ROAS/ROI/CPA/CPC/CTR/CPM — as linhas pré-formatadas acima só têm texto.
    adsRaw: s.adsData,
    adsBusyId: s.adsBusyId,
    setAdsSub: (k: "campaigns" | "adsets" | "ads" | "accounts") => set({ adsSub: k }),
    toggleAdsEntity: (type: "campaign" | "adset" | "ad", id: string) => toggleEntity(type, id)(),
    /**
     * Liga/desliga o RASTREAMENTO de uma conta de anúncio, a partir da aba
     * Contas do Gerenciador.
     *
     * 🐛 A aba Contas tem `nivel: null` (conta não é entidade da Meta que se
     * pausa), e o handler da tabela era `if (nivel) v.toggleAdsEntity(...)` —
     * então **clicar no toggle ali não fazia absolutamente nada, sem erro
     * nenhum**. O controle existia, refletia o estado certo, e era inerte.
     *
     * ⚠️ É outra ação que a das outras abas, não a mesma com outro argumento:
     * lá o toggle pausa/ativa NA META; aqui ele decide se a Trackhub sincroniza
     * esta conta. Por isso a server action é outra (`toggleAccountTracking`).
     *
     * ⚠️ Atualiza as DUAS fontes: `adProfiles` (o que Integrações › Anúncios
     * mostra) e o overview do Gerenciador, via `adsRefreshKey`. Elas são
     * consultas diferentes sobre a mesma coluna — mexer em uma só faria as duas
     * telas discordarem até o próximo recarregamento.
     */
    toggleAdsAccountTracking: async (id: string) => {
      setS((st) => ({ ...st, adsBusyId: id }));
      try {
        const updated = await toggleAccountTracking(id);
        setS((st) => ({
          ...st,
          adsBusyId: null,
          adsRefreshKey: st.adsRefreshKey + 1,
          adProfiles: st.adProfiles.map((pr) => ({
            ...pr,
            accounts: pr.accounts.map((a) =>
              a.id === id ? { ...a, trackingEnabled: updated.trackingEnabled } : a,
            ),
          })),
        }));
      } catch {
        setS((st) => ({ ...st, adsBusyId: null }));
      }
    },
    /** Força um recarregamento do overview (após ação em massa ou sync). */
    refreshAds: () => setS((st) => ({ ...st, adsRefreshKey: st.adsRefreshKey + 1 })),
    adsSearch: s.adsSearch,
    adsStatus: s.adsStatus,
    adsPeriod: s.adsPeriod,
    adsFrom: s.adsFrom,
    adsTo: s.adsTo,
    adsAccount: s.adsAccount,
    /**
     * Idade do dado vindo do Facebook. Existe para o usuário PARAR de clicar em
     * "Sincronizar": sem um sinal na tela de que a atualização é automática, a
     * reação natural é apertar o botão de novo.
     */
    syncLabel: s.syncRodando
      ? "Sincronizando…"
      : s.syncLastAt
        /* ⚠️ SEGURO POR TIMING, NAO POR ESTRUTURA — ver a nota do `feed`.
           `syncLastAt` nasce `null` e so e preenchido pelo fetch do cliente.
           Passar isto do servidor reintroduz o mismatch. */
        ? `Atualizado ${elapsed(new Date(s.syncLastAt).getTime())}`
        : "Aguardando 1ª sincronização",
    syncRodando: s.syncRodando,
    adsLoading: s.adsLoading,
    onAdsSearch: (e: React.ChangeEvent<HTMLInputElement>) => set({ adsSearch: e.target.value }),
    // Setters por VALOR, não por evento: o `ui/Select` entrega o valor direto.
    // Os `onAdsX` que recebiam `ChangeEvent` existiam só para o `<select>`
    // nativo — ver a nota sobre padronização de controles no CLAUDE.md.
    setAdsStatus: (adsStatus: string) => set({ adsStatus }),
    setAdsPeriod: (adsPeriod: PeriodoNome, from?: string, to?: string) =>
      set({ adsPeriod, adsFrom: from ?? null, adsTo: to ?? null }),
    setAdsAccount: (adsAccount: string) => set({ adsAccount }),
    adsAccountOptions: (ao?.accounts ?? []).map((a) => ({ id: a.id, name: a.name })),
    filteredCampaigns, filteredAdsets, filteredAds, accounts, creatives,

    // Ranking de criativos
    creativesPeriod: s.creativesPeriod,
    creativesFrom: s.creativesFrom,
    creativesTo: s.creativesTo,
    creativesSort: s.creativesSort,
    creativesLoading: s.creativesLoading,
    setCreativesPeriod: (creativesPeriod: PeriodoNome, from?: string, to?: string) =>
      set({ creativesPeriod, creativesFrom: from ?? null, creativesTo: to ?? null }),
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
    // ⚠️ Recebem o VALOR, não o evento. Os quatro eram `ChangeEvent<HTMLSelectElement>`
    // / `<HTMLInputElement>` — assinatura de `<select>` nativo, que este projeto
    // não usa mais (`ui/Select` devolve o valor). Nunca houve tela consumindo
    // isto, então a assinatura antiga era herança de um formulário que não
    // existiu; ajustada junto com a tela que finalmente a usa.
    setNewCampaignAccount: (newCampaignAccount: string) => set({ newCampaignAccount }),
    setNewCampaignName: (newCampaignName: string) => set({ newCampaignName }),
    setNewCampaignObjective: (newCampaignObjective: string) => set({ newCampaignObjective }),
    setNewCampaignBudget: (newCampaignBudget: string) => set({ newCampaignBudget }),
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
    /**
     * Os DTOs CRUS dos perfis, sem os handlers.
     *
     * ⚠️ Existe ao lado de `adProfiles` de proposito, e nao e duplicacao: aquele
     * e um MODELO DE TELA para Integracoes › Anuncios — traz `expanded`,
     * `toggleExpanded`, `disconnect`, erros ja traduzidos. A Visao geral precisa
     * do dado bruto (`tokenExpiresAt`, `connectedAt`, contagens) para derivar
     * inventario e saude, e enfiar esses campos no modelo de tela faria uma
     * estrutura servir a duas telas com necessidades opostas.
     *
     * ⛔ Nao derive nada aqui. A derivacao vive em `lib/integracoes/`, pura e
     * testavel sem React.
     */
    perfisCrus: s.adProfiles,

    /**
     * 🔎 Os dois campos abaixo existem para a PALETA ⌘K do shell, e são
     * acessores puros do estado — nada é derivado aqui.
     *
     * ⚠️ `adsData` é a lista CRUA de propósito. O que já era exposto,
     * `filteredCampaigns`, passa pelo `adsMatch`, que aplica a busca e o filtro
     * de status DO GERENCIADOR. A paleta consumindo aquela lista faria o
     * resultado da busca global depender do que estivesse digitado numa caixa de
     * outra tela — e o defeito seria invisível, porque com o campo vazio (o caso
     * comum) as duas listas são idênticas.
     */
    adsData: s.adsData,
    pixels: s.pixels,
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
            syncResult: `Sincronizado: ${json.campaigns} campanhas, ${json.ads} anúncios, ${json.metrics} dias de métricas${json.errors?.length ? ` (${plural(json.errors.length, "erro", "erros")})` : ""}.`,
            refreshKey: st.refreshKey + 1,
          }));
        } else {
          set({ syncBusy: false, syncResult: json.error ?? "Falha na sincronização." });
        }
      } catch (e) {
        set({ syncBusy: false, syncResult: "Erro de rede: " + String(e) });
      }
    },

    // ───────────── Webhooks (bloco esquerdo) ─────────────
    webhooks: s.webhooks,
    /* ⚠️ `toggleWebhook` saiu: só a `WebhooksView` o chamava, e a tela nova
       chama a server action direto. `removeWebhook` FICA — a Visão geral de
       Integrações exclui webhook a partir do painel de detalhe dela. */
    removeWebhook: async (id: string) => {
      await deleteWebhook(id);
      setS((st) => ({ ...st, webhooks: st.webhooks.filter((w) => w.id !== id) }));
    },
    webhookPlatformLabel: (p: string) =>
      rotuloDoGateway(p),

    // O teste de pixel virou parte da TestesView autocontida (Bloco 13).

    gatewayExpenses,
    taxExpenses,
    despesaRows,
    /**
     * As despesas CRUAS — os DTOs sem handlers e sem rótulo pronto.
     *
     * ⚠️ Terceiro acessor "cru" desta reescrita, depois de `perfisCrus` e do
     * `notifItems[].timestamp`, e pelo mesmo motivo: os derivados acima são
     * modelo de TELA (cada um traz `unit`/`unidade`/`methodLabel` já formatado,
     * e cada um formata de um jeito). A tela nova de Taxas precisa dizer sobre
     * O QUE cada linha incide, e essa frase depende de `calc`, `paymentMethod` e
     * `recurrence` JUNTOS — três campos que nenhum derivado expõe ao mesmo
     * tempo. Quem monta a frase é `lib/taxas/apresentacao.ts`, função pura e
     * testada; reformatar aqui criaria a sexta formatação da mesma despesa.
     *
     * ⛔ Não use isto para desenhar lista onde já existe derivado pronto — o
     * monolito não precisa de mais um consumidor. Ver o número dele abaixo.
     */
    despesasCruas: s.expenses,
    /** Passagem pura — o rodapé do Dashboard conta ativas e em execução. */
    rules: s.rules,
    // Novo gateway
    newGatewayMethod: s.newGatewayMethod,
    newGatewayPct: s.newGatewayPct,
    onNewGatewayMethod: (e: React.ChangeEvent<HTMLSelectElement>) => set({ newGatewayMethod: e.target.value }),
    onNewGatewayPct: (e: React.ChangeEvent<HTMLInputElement>) => set({ newGatewayPct: e.target.value }),
    /**
     * O criador COMPLETO — o que a tela nova de Taxas usa nos cinco grupos.
     *
     * ⚠️ ELE SUBSTITUIU CINCO HELPERS que fixavam `type`/`calc`/`recurrence` no
     * código (`addGateway`, `addTax`, `addCoproducao`, `addCustoProduto`,
     * `addDespesa`), deletados em 12/08/2026 junto da `FeesView`. Este aceita o
     * input inteiro, e é o que torna os três seletores da tela possíveis.
     *
     * 🔴 A CONVERSÃO DO SENTINELA `__TODAS__` → `null` VEIO DO `addGateway` e
     * está viva em `lib/taxas/apresentacao.ts` (`formaParaServidor`). Ela NÃO
     * era código cosmético: gravar a string faria a taxa não casar com forma de
     * pagamento nenhuma, e a linha existiria sem entrar em cálculo algum. Foi
     * movida de casa em vez de morrer com o helper, e `test:taxas` a exercita
     * com os dois valores — senão ela vira a próxima proteção morta.
     *
     * ⛔ `workspaceId: s.workspaceAtiva` NÃO É OPCIONAL AQUI, e é a linha
     * vermelha do `CLAUDE.md`: `Expense.workspaceId` NULO significa **vale para
     * TODAS as áreas**, não "sem dono". Omitir faria a despesa de uma operação
     * ser descontada do lucro de todas as outras — com número plausível nas duas
     * pontas, que é o que torna o defeito mudo. `test:taxas` prova que a chamada
     * carrega a área.
     */
    criarDespesa: async (input: {
      name: string;
      type: ExpenseDTO["type"];
      calc: ExpenseDTO["calc"];
      amount: number;
      paymentMethod?: ExpenseDTO["paymentMethod"];
      recurrence?: ExpenseDTO["recurrence"];
    }) => {
      if (!input.name.trim() || !input.amount) return;
      const created = await createExpense({ ...input, name: input.name.trim(), workspaceId: s.workspaceAtiva });
      setS((st) => ({ ...st, expenses: [...st.expenses, created] }));
    },
    /** Remove por id — o mesmo caminho dos derivados, para a tela nova. */
    removerDespesa: async (id: string) => {
      await deleteExpense(id);
      setS((st) => ({ ...st, expenses: st.expenses.filter((x) => x.id !== id) }));
    },
    /**
     * Edita valor ou nome.
     *
     * ⚠️ O patch é `amount | name | active` porque é isso que `updateExpense`
     * aceita — e a restrição é PROPOSITAL: não existe caminho pelo qual a edição
     * toque no `workspaceId`. Ampliar este tipo sem ler a nota do `createExpense`
     * é como a linha vermelha volta.
     */
    editarDespesa: async (id: string, patch: { amount?: number; name?: string; active?: boolean }) => {
      setS((st) => ({ ...st, expenses: st.expenses.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      await updateExpense(id, patch).catch(() => {});
    },
    /**
     * O painel "Cálculo de lucro" da tela de Taxas.
     *
     * 🔴 Ele REIMPLEMENTAVA a conta e errava em dois pontos:
     *
     * 1. `revenue − spend − expenses.total` — e `expenses.total` é
     *    `totalDescontos`, que **exclui as despesas recorrentes**. O painel
     *    mostrava a linha "Despesas − R$ X" e **não a subtraía**. Só não
     *    aparecia para quem tinha despesa zerada.
     * 2. Não havia linha de **coprodução** nem de **custo de produto**, então
     *    com esses cadastrados a soma deixava de fechar visualmente.
     *
     * Agora lê a `Composicao` do servidor — a MESMA que alimenta os cards de
     * Faturamento Líquido e Lucro. Uma conta, um lugar.
     */
    finance: {
      revenue: brl(fin?.bruto ?? revenue),
      spend: brl(fin?.gastoAnuncios ?? spend),
      gateway: brl(fin?.gateway ?? 0),
      coproducao: brl(fin?.coproducao ?? 0),
      tax: brl(fin?.impostos ?? 0),
      custoProduto: brl(fin?.custoProduto ?? 0),
      /**
       * ⚠️ O painel PRECISA desta linha, senão ele para de fechar.
       *
       * Com o imposto de anúncios ligado o Lucro cai, e sem a linha o usuário
       * soma o que está na tela, não bate, e conclui que o Lucro está errado.
       * É exatamente o defeito que já existiu aqui com coprodução e custo de
       * produto — o painel mostrando um desconto que não subtraía, ou
       * subtraindo um que não mostrava.
       */
      impostoAnuncios: brl(fin?.impostoAnuncios ?? 0),
      temImpostoAnuncios: (fin?.impostoAnuncios ?? 0) > 0,
      despesas: brl(fin?.despesas ?? 0),
      liquido: brl(fin?.liquido ?? 0),
      profit: brl(fin?.lucro ?? 0),
      margin: pct(fin?.margem ?? null),
      /**
       * O break-even, NÚMERO e rótulo — nesta ordem, e os dois.
       *
       * ⛔ Só o formatado foi o defeito original de `finance` (mapa das razões,
       * item 5): quem precisa desenhar a linha tem de reverter "R$ 1.234,00" em
       * reais. O `LineChart` consome `breakEven`; o painel de Taxas consome
       * `breakEvenLabel`. Nada de `?? 0` — `null` é "não dá para calcular".
       */
      breakEven: fin?.breakEven ?? null,
      breakEvenLabel: brl(fin?.breakEven ?? null),
      /**
       * Quantas despesas ÚNICAS ativas ficaram FORA do cálculo.
       *
       * 🔴 Custo que sumiu do cálculo sem avisar na tela onde o lucro aparece é
       * o mesmo erro que o rateio acabou de consertar, na direção oposta. Este
       * número existe para o card de Lucro e o break-even poderem dizer.
       */
      unicasForaDoCalculo: unicasFora,
      /** Linhas com valor zero somem do painel — ver a nota na FeesView. */
      temCoproducao: (fin?.coproducao ?? 0) > 0,
      temCustoProduto: (fin?.custoProduto ?? 0) > 0,
    },


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
    /**
     * O DTO CRU das configurações — os onze campos, com os quatro horários.
     *
     * ⚠️ `notif` é modelo de TELA e NÃO tem `report08`…`report23`: eles saem
     * dele para virar a lista `reports`, com um `toggle` por horário. A tela
     * nova escreve os onze pelo MESMO caminho, e para isso precisa dos onze
     * juntos — foi o `tsc` que denunciou a diferença de forma, ao recusar
     * `notif` onde o DTO era esperado.
     */
    notifCru: ns,
    /**
     * O caminho ÚNICO de escrita das configurações de notificação.
     *
     * ⛔ A tela nova manda os ONZE campos por aqui, e a lista deles é dado em
     * `lib/notificacoes/apresentacao.ts`. Um acessor por campo seria onze
     * lugares onde esquecer um — a forma exata da regressão do `calc` em Taxas.
     */
    salvarNotificacao: (patch: Partial<NotificationSettingsDTO>) => setSetting(patch),
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

    trackingId,
    appUrl,
    timezone,
  };
}

export type TraffikView = ReturnType<typeof useTraffikState>;
