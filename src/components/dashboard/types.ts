export type Status = "ativo" | "pausado";

export interface Campaign {
  id: number;
  name: string;
  status: Status;
  budget: number;
  spend: number;
  results: number;
  cpa: number;
  ctr: number;
  roas: number;
}

export interface AdSet {
  name: string;
  campaign: string;
  status: Status;
  spend: number;
  results: number;
  cpa: number;
  ctr: number;
  roas: number;
}

export interface AdItem {
  name: string;
  format: string;
  status: Status;
  spend: number;
  results: number;
  cpa: number;
  ctr: number;
  roas: number;
}

export interface AdAccount {
  id: number;
  name: string;
  actId: string;
  spend: number;
  campaigns: number;
  roas: number;
  tracking: boolean;
}

export interface Creative {
  id: number;
  name: string;
  campaign: string;
  ctr: number;
  roas: number;
  spend: number;
  sales: number;
  best?: boolean;
}

export interface ProductBase {
  name: string;
  total: number;
  sales: number;
}

export interface SourceBase {
  name: string;
  total: number;
}

export interface FunnelBase {
  cliques: number;
  checkouts: number;
  vendas: number;
}

export interface Gateway {
  name: string;
  pct: number;
}

export interface Despesa {
  name: string;
  value: number;
}

export interface WebhookRow {
  platform: string;
  url: string;
  status: string;
}

export interface PixelEvent {
  name: string;
  desc: string;
  on: boolean;
}

export interface Rule {
  id: number;
  name: string;
  summary: string;
  freq: string;
  on: boolean;
}

export interface FeedItem {
  id: number;
  type: "venda" | "clique";
  source: string;
  campaign: string;
  value?: number;
  ts: number;
}

export interface TestLogEntry {
  event: string;
  status: string;
  time: string;
}

export type TabKey =
  | "dashboard"
  | "ads"
  | "creatives"
  | "rules"
  | "notifications"
  | "fees"
  | "facebook"
  | "utm";

export type AdsSubTab = "campaigns" | "adsets" | "ads" | "accounts";
export type FacebookSubTab = "contas" | "webhooks" | "pixel" | "testes";

export type MetricKey =
  | "faturamento"
  | "gasto"
  | "roas"
  | "roi"
  | "margem"
  | "vendas"
  | "cpa"
  | "ticket"
  | "ctr"
  | "pendentes"
  | "reembolsadas"
  | "chargeback";
