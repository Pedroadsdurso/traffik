import type {
  AdAccount,
  AdItem,
  AdSet,
  Campaign,
  Creative,
  Despesa,
  FeedItem,
  FunnelBase,
  Gateway,
  PixelEvent,
  ProductBase,
  Rule,
  SourceBase,
  WebhookRow,
} from "./types";

/**
 * Seed data ported verbatim from the Claude Design handoff's demo state, so
 * the imported UI looks identical before Fase 5 wires it to real data.
 */

export const initialCampaigns: Campaign[] = [
  { id: 1, name: "Lançamento Método Foco 3.0 — Conversão", status: "ativo", budget: 500, spend: 3842, results: 87, cpa: 44.16, ctr: 3.8, roas: 5.2 },
  { id: 2, name: "Retargeting Carrinho Abandonado", status: "ativo", budget: 150, spend: 1120, results: 34, cpa: 32.94, ctr: 2.1, roas: 6.8 },
  { id: 3, name: "TOFU — Vídeo Depoimentos", status: "pausado", budget: 300, spend: 2560, results: 41, cpa: 62.44, ctr: 1.4, roas: 2.9 },
  { id: 4, name: "Advantage+ Shopping — Curso Completo", status: "ativo", budget: 800, spend: 6230, results: 152, cpa: 40.98, ctr: 4.2, roas: 7.1 },
  { id: 5, name: "Lookalike 1% Compradores", status: "pausado", budget: 200, spend: 980, results: 19, cpa: 51.58, ctr: 1.9, roas: 3.4 },
];

export const initialAdsets: AdSet[] = [
  { name: "Interesses — Empreendedorismo 25-45", campaign: "Advantage+ Shopping", status: "ativo", spend: 2140, results: 52, cpa: 41.15, ctr: 4.6, roas: 7.8 },
  { name: "Lookalike 1% — Compradores 90d", campaign: "Lançamento Método Foco", status: "ativo", spend: 1580, results: 38, cpa: 41.58, ctr: 3.9, roas: 5.6 },
  { name: "Retargeting — Visitou checkout", campaign: "Retargeting Carrinho", status: "ativo", spend: 620, results: 21, cpa: 29.52, ctr: 2.4, roas: 6.1 },
  { name: "Ampla — 18-55 Brasil", campaign: "TOFU Vídeo Depoimentos", status: "pausado", spend: 1340, results: 18, cpa: 74.44, ctr: 1.2, roas: 2.4 },
];

export const initialAds: AdItem[] = [
  { name: "VSL 12min — Depoimento Ana", format: "Vídeo", status: "ativo", spend: 1890, results: 42, cpa: 45.0, ctr: 5.1, roas: 8.4 },
  { name: "Carrossel — 5 resultados", format: "Carrossel", status: "ativo", spend: 1120, results: 24, cpa: 46.67, ctr: 3.4, roas: 5.9 },
  { name: "Estático — Prova social", format: "Imagem", status: "pausado", spend: 740, results: 12, cpa: 61.67, ctr: 2.0, roas: 4.1 },
  { name: "UGC — Depoimento Marcos", format: "Vídeo", status: "ativo", spend: 1660, results: 31, cpa: 53.55, ctr: 4.4, roas: 6.7 },
];

export const initialAccounts: AdAccount[] = [
  { id: 1, name: "Método Foco Cursos LTDA", actId: "act_9284710234", spend: 12094, campaigns: 8, roas: 6.1, tracking: true },
  { id: 2, name: "Mentoria Alta Renda", actId: "act_5510983221", spend: 4870, campaigns: 4, roas: 4.3, tracking: true },
];

export const initialCreatives: Creative[] = [
  { id: 1, name: "VSL 12min — Depoimento Ana", campaign: "Advantage+ Shopping", ctr: 5.1, roas: 8.4, spend: 1890, sales: 42, best: true },
  { id: 2, name: "UGC — Depoimento Marcos", campaign: "Lançamento Método Foco", ctr: 4.4, roas: 6.7, spend: 1660, sales: 31 },
  { id: 3, name: "Carrossel — 5 resultados", campaign: "Advantage+ Shopping", ctr: 3.4, roas: 5.9, spend: 1120, sales: 24 },
  { id: 4, name: "Estático — Prova social", campaign: "Retargeting Carrinho", ctr: 2.6, roas: 5.2, spend: 640, sales: 16 },
  { id: 5, name: "Reels — Bastidores gravação", campaign: "Lançamento Método Foco", ctr: 2.9, roas: 4.6, spend: 980, sales: 14 },
  { id: 6, name: "Estático — Antes e depois", campaign: "TOFU Vídeo Depoimentos", ctr: 1.4, roas: 2.9, spend: 520, sales: 6 },
];

export const initialProducts: ProductBase[] = [
  { name: "Método Foco 3.0", total: 9840, sales: 33 },
  { name: "Mentoria Alta Renda", total: 5970, sales: 6 },
  { name: "E-book Gatilhos Mentais", total: 1640, sales: 17 },
  { name: "Combo Foco + Mentoria", total: 970, sales: 7 },
];

export const initialSources: SourceBase[] = [
  { name: "Facebook", total: 11420 },
  { name: "Instagram", total: 4980 },
  { name: "Google", total: 1220 },
  { name: "Orgânico", total: 800 },
];

export const initialFunnel: FunnelBase = { cliques: 8420, checkouts: 1240, vendas: 63 };

export const initialGateways: Gateway[] = [
  { name: "Hotmart", pct: 9.9 },
  { name: "Kiwify", pct: 8.99 },
  { name: "Kirvano", pct: 6.99 },
];

export const initialDespesas: Despesa[] = [
  { name: "Ferramentas (Traffik, editor)", value: 297 },
  { name: "Copywriter freelancer", value: 1500 },
];

export const initialWebhooks: WebhookRow[] = [
  { platform: "Hotmart", url: "api.traffik.io/wh/hotmart/48291", status: "Ativo" },
  { platform: "Kiwify", url: "api.traffik.io/wh/kiwify/48291", status: "Ativo" },
];

export const initialPixelEvents: PixelEvent[] = [
  { name: "Lead", desc: "Cadastro em página de captura", on: true },
  { name: "Add to Cart", desc: "Clique em comprar / iniciar", on: true },
  { name: "Initiate Checkout", desc: "Chegou ao checkout", on: true },
  { name: "Purchase", desc: "Venda confirmada (via webhook)", on: true },
];

export const initialRules: Rule[] = [
  { id: 1, name: "Pausar CPA alto", summary: "Se CPA > R$ 50 nas últimas 3h → pausar campanha", freq: "A cada 30 min", on: true },
  { id: 2, name: "Escalar ROAS bom", summary: "Se ROAS > 5x em 24h → aumentar orçamento 20%", freq: "A cada 1h", on: true },
  { id: 3, name: "Alerta gasto sem venda", summary: "Se Gasto > R$ 100 e 0 vendas em 6h → notificar", freq: "A cada 30 min", on: false },
];

export function initialFeed(): FeedItem[] {
  const now = Date.now();
  return [
    { id: 1, type: "venda", source: "Facebook", campaign: "Advantage+ Shopping", value: 497, ts: now - 4000 },
    { id: 2, type: "clique", source: "Instagram", campaign: "Lançamento Método Foco", ts: now - 12000 },
    { id: 3, type: "venda", source: "Facebook", campaign: "Retargeting Carrinho", value: 297, ts: now - 34000 },
    { id: 4, type: "clique", source: "Facebook", campaign: "Advantage+ Shopping", ts: now - 60000 },
    { id: 5, type: "venda", source: "Instagram", campaign: "Lançamento Método Foco", value: 997, ts: now - 120000 },
  ];
}
