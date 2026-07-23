import { setEntityStatus, updateDailyBudget } from "@/lib/facebook/manage";
import { prisma } from "@/lib/prisma";
import type { RuleLevel } from "@/generated/prisma/enums";

export interface RuleCondition {
  metrica: "cpa" | "roas" | "ctr" | "gasto" | "vendas";
  operador: ">" | "<" | "=";
  valor: number;
}

interface EntityMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  revenue: number;
}

/** Converte o período de cálculo da regra em uma data inicial. */
function calcStart(period: string): Date {
  const now = Date.now();
  switch (period) {
    case "ultimas_3h":
      return new Date(now - 3 * 36e5);
    case "ultimas_6h":
      return new Date(now - 6 * 36e5);
    case "ultimas_12h":
      return new Date(now - 12 * 36e5);
    case "ontem": {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "ultimos_7d":
      return new Date(now - 7 * 864e5);
    case "ultimos_30d":
      return new Date(now - 30 * 864e5);
    case "hoje":
    default: {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

function metricValue(m: EntityMetrics, key: RuleCondition["metrica"]): number {
  switch (key) {
    case "gasto":
      return m.spend;
    case "vendas":
      return m.results;
    case "cpa":
      return m.results ? m.spend / m.results : 0;
    case "roas":
      return m.spend ? m.revenue / m.spend : 0;
    case "ctr":
      return m.impressions ? (m.clicks / m.impressions) * 100 : 0;
  }
}

function conditionsMet(conds: RuleCondition[], m: EntityMetrics): boolean {
  if (!conds.length) return false;
  return conds.every((c) => {
    const actual = metricValue(m, c.metrica);
    if (c.operador === ">") return actual > c.valor;
    if (c.operador === "<") return actual < c.valor;
    return Math.abs(actual - c.valor) < 1e-9;
  });
}

interface RuleRow {
  id: string;
  userId: string;
  targetProduct: string | null;
  adAccountIds: string[];
  level: RuleLevel;
  nameFilter: string | null;
  action: "ATIVAR" | "PAUSAR" | "AJUSTAR_ORCAMENTO";
  actionParams: unknown;
  conditions: unknown;
  calcPeriod: string;
  frequencyMin: number;
  dailyRunLimit: number;
}

export interface RuleRunResult {
  status: "SUCESSO" | "SEM_ACAO" | "ERRO";
  affected: number;
  message: string;
  details: unknown;
}

/** Carrega as entidades no nível da regra, com métricas e vendas atribuídas. */
async function loadEntities(rule: RuleRow, start: Date) {
  const accountFilter = rule.adAccountIds.length ? { id: { in: rule.adAccountIds } } : {};
  const nameContains = rule.nameFilter?.trim();

  // Vendas aprovadas no período para atribuição (utm_campaign / utm_content).
  const sales = await prisma.sale.findMany({
    where: {
      userId: rule.userId,
      status: "APROVADA",
      timestamp: { gte: start },
      ...(rule.targetProduct ? { product: rule.targetProduct } : {}),
    },
    select: { value: true, click: { select: { utmCampaign: true, utmContent: true } } },
  });
  const byCampaign = new Map<string, { results: number; revenue: number }>();
  const byContent = new Map<string, { results: number; revenue: number }>();
  for (const s of sales) {
    const camp = s.click?.utmCampaign?.toLowerCase();
    const cont = s.click?.utmContent?.toLowerCase();
    if (camp) {
      const c = byCampaign.get(camp) ?? { results: 0, revenue: 0 };
      c.results += 1;
      c.revenue += num(s.value);
      byCampaign.set(camp, c);
    }
    if (cont) {
      const c = byContent.get(cont) ?? { results: 0, revenue: 0 };
      c.results += 1;
      c.revenue += num(s.value);
      byContent.set(cont, c);
    }
  }

  const metricWhere = { date: { gte: new Date(start.toDateString()) }, ad: { adAccount: { userId: rule.userId } } };
  const metrics = await prisma.dailyAdMetric.findMany({
    where: metricWhere,
    select: { adId: true, spend: true, impressions: true, clicks: true },
  });
  const metByAd = new Map<string, EntityMetrics>();
  for (const m of metrics) {
    const cur = metByAd.get(m.adId) ?? { spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0 };
    cur.spend += num(m.spend);
    cur.impressions += m.impressions;
    cur.clicks += m.clicks;
    metByAd.set(m.adId, cur);
  }

  const entities: {
    id: string;
    fbId: string;
    name: string;
    status: string;
    token: string | null;
    dailyBudget: number | null;
    metrics: EntityMetrics;
  }[] = [];

  const nameFilterWhere = nameContains ? { name: { contains: nameContains, mode: "insensitive" as const } } : {};

  if (rule.level === "CAMPAIGN") {
    const campaigns = await prisma.campaign.findMany({
      where: { adAccount: { userId: rule.userId, ...accountFilter }, ...nameFilterWhere },
      select: {
        id: true, fbCampaignId: true, name: true, status: true, dailyBudget: true,
        adAccount: { select: { adProfile: { select: { accessToken: true } } } },
        ads: { select: { id: true } },
      },
    });
    for (const c of campaigns) {
      const agg: EntityMetrics = { spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0 };
      for (const ad of c.ads) {
        const m = metByAd.get(ad.id);
        if (m) { agg.spend += m.spend; agg.impressions += m.impressions; agg.clicks += m.clicks; }
      }
      const attr = byCampaign.get(c.name.toLowerCase());
      if (attr) { agg.results = attr.results; agg.revenue = attr.revenue; }
      entities.push({
        id: c.id, fbId: c.fbCampaignId, name: c.name, status: c.status,
        token: c.adAccount.adProfile?.accessToken ?? null,
        dailyBudget: c.dailyBudget != null ? num(c.dailyBudget) : null, metrics: agg,
      });
    }
  } else if (rule.level === "ADSET") {
    const adSets = await prisma.adSet.findMany({
      where: { adAccount: { userId: rule.userId, ...accountFilter }, ...nameFilterWhere },
      select: {
        id: true, fbAdSetId: true, name: true, status: true, dailyBudget: true,
        adAccount: { select: { adProfile: { select: { accessToken: true } } } },
        ads: { select: { id: true } },
      },
    });
    for (const a of adSets) {
      const agg: EntityMetrics = { spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0 };
      for (const ad of a.ads) {
        const m = metByAd.get(ad.id);
        if (m) { agg.spend += m.spend; agg.impressions += m.impressions; agg.clicks += m.clicks; }
      }
      entities.push({
        id: a.id, fbId: a.fbAdSetId, name: a.name, status: a.status,
        token: a.adAccount.adProfile?.accessToken ?? null,
        dailyBudget: a.dailyBudget != null ? num(a.dailyBudget) : null, metrics: agg,
      });
    }
  } else {
    const ads = await prisma.ad.findMany({
      where: { adAccount: { userId: rule.userId, ...accountFilter }, ...nameFilterWhere },
      select: {
        id: true, fbAdId: true, name: true, status: true,
        adAccount: { select: { adProfile: { select: { accessToken: true } } } },
      },
    });
    for (const ad of ads) {
      const agg = metByAd.get(ad.id) ?? { spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0 };
      const attr = byContent.get(ad.name.toLowerCase());
      if (attr) { agg.results = attr.results; agg.revenue = attr.revenue; }
      entities.push({
        id: ad.id, fbId: ad.fbAdId, name: ad.name, status: ad.status,
        token: ad.adAccount.adProfile?.accessToken ?? null, dailyBudget: null, metrics: agg,
      });
    }
  }

  return entities;
}

const LEVEL_TO_TYPE: Record<RuleLevel, "campaign" | "adset" | "ad"> = {
  CAMPAIGN: "campaign",
  ADSET: "adset",
  AD: "ad",
};

/** Avalia uma regra e executa a ação nas entidades que baterem as condições. */
export async function evaluateRule(rule: RuleRow): Promise<RuleRunResult> {
  const conds = (Array.isArray(rule.conditions) ? rule.conditions : []) as RuleCondition[];
  const start = calcStart(rule.calcPeriod);

  // Limite diário de execuções.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const runsToday = await prisma.automationRuleLog.count({
    where: { ruleId: rule.id, ranAt: { gte: startOfDay }, status: "SUCESSO" },
  });
  if (runsToday >= rule.dailyRunLimit) {
    return { status: "SEM_ACAO", affected: 0, message: "Limite diário de execuções atingido.", details: null };
  }

  let entities;
  try {
    entities = await loadEntities(rule, start);
  } catch (e) {
    return { status: "ERRO", affected: 0, message: e instanceof Error ? e.message : "Erro ao carregar entidades.", details: null };
  }

  const matched = entities.filter((e) => conditionsMet(conds, e.metrics));
  if (matched.length === 0) {
    return { status: "SEM_ACAO", affected: 0, message: `Nenhuma entidade satisfez as condições (${entities.length} avaliadas).`, details: null };
  }

  const params = (rule.actionParams ?? {}) as { tipo?: string; valor?: number };
  const applied: { name: string; action: string; ok: boolean; error?: string }[] = [];
  const type = LEVEL_TO_TYPE[rule.level];

  for (const e of matched) {
    if (!e.token) { applied.push({ name: e.name, action: rule.action, ok: false, error: "Sem token do perfil." }); continue; }
    try {
      if (rule.action === "PAUSAR") {
        if (e.status !== "ACTIVE") { applied.push({ name: e.name, action: "PAUSAR", ok: true, error: "já pausada" }); continue; }
        await setEntityStatus(e.fbId, "PAUSED", e.token);
        if (type === "campaign") await prisma.campaign.update({ where: { id: e.id }, data: { status: "PAUSED" } });
        else if (type === "adset") await prisma.adSet.update({ where: { id: e.id }, data: { status: "PAUSED" } });
        else await prisma.ad.update({ where: { id: e.id }, data: { status: "PAUSED" } });
      } else if (rule.action === "ATIVAR") {
        if (e.status === "ACTIVE") { applied.push({ name: e.name, action: "ATIVAR", ok: true, error: "já ativa" }); continue; }
        await setEntityStatus(e.fbId, "ACTIVE", e.token);
        if (type === "campaign") await prisma.campaign.update({ where: { id: e.id }, data: { status: "ACTIVE" } });
        else if (type === "adset") await prisma.adSet.update({ where: { id: e.id }, data: { status: "ACTIVE" } });
        else await prisma.ad.update({ where: { id: e.id }, data: { status: "ACTIVE" } });
      } else {
        // AJUSTAR_ORCAMENTO
        if (e.dailyBudget == null) { applied.push({ name: e.name, action: "AJUSTAR_ORCAMENTO", ok: false, error: "sem orçamento diário (CBO?)" }); continue; }
        const factor = params.tipo === "percentual" ? 1 + (params.valor ?? 0) / 100 : 1;
        const novo = params.tipo === "valor" ? (params.valor ?? e.dailyBudget) : e.dailyBudget * factor;
        await updateDailyBudget(e.fbId, novo, e.token);
        if (type === "campaign") await prisma.campaign.update({ where: { id: e.id }, data: { dailyBudget: novo } });
        else if (type === "adset") await prisma.adSet.update({ where: { id: e.id }, data: { dailyBudget: novo } });
      }
      applied.push({ name: e.name, action: rule.action, ok: true });
    } catch (err) {
      applied.push({ name: e.name, action: rule.action, ok: false, error: err instanceof Error ? err.message : "erro" });
    }
  }

  const affected = applied.filter((a) => a.ok).length;
  return {
    status: affected > 0 ? "SUCESSO" : "ERRO",
    affected,
    message: `${affected} de ${matched.length} entidade(s) afetada(s).`,
    details: applied,
  };
}

/** Executa todas as regras ativas de um usuário respeitando a frequência. */
export async function runUserRules(userId: string): Promise<{ evaluated: number; acted: number }> {
  const rules = await prisma.automationRule.findMany({ where: { userId, active: true } });
  let acted = 0;
  let evaluated = 0;
  const now = Date.now();
  for (const rule of rules) {
    if (rule.lastRunAt && now - rule.lastRunAt.getTime() < rule.frequencyMin * 60_000) continue;
    evaluated++;
    const result = await evaluateRule(rule as RuleRow);
    await prisma.$transaction([
      prisma.automationRuleLog.create({
        data: { ruleId: rule.id, status: result.status, message: result.message, affected: result.affected, details: result.details as object },
      }),
      prisma.automationRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } }),
    ]);
    if (result.affected > 0) acted++;
  }
  return { evaluated, acted };
}
