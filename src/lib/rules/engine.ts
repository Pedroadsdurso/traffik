import { getUserTimezone } from "@/lib/userTimezone";
import type { EntityStatus } from "@/generated/prisma/enums";
import { setEntityStatus, updateDailyBudget } from "@/lib/facebook/manage";
import { carregarMapaDeAreas } from "@/lib/areas/atribuicao";
import { prisma } from "@/lib/prisma";
import { addDaysToKey, dayKeyInTz, dayStart, hourInTz, keyToDateColumn, todayKey } from "@/lib/timezone";
import type { RuleLevel } from "@/generated/prisma/enums";

export interface RuleCondition {
  metrica: "cpa" | "roas" | "ctr" | "gasto" | "vendas";
  /**
   * ⚠️ `>=` e `<=` foram ADICIONADOS — antes o tipo só admitia `>`, `<` e `=`,
   * e o avaliador transformava qualquer outro em igualdade. Uma regra gravada
   * com "maior ou igual" (que a UI vai oferecer) virava "exatamente igual" e
   * praticamente nunca disparava.
   */
  operador: ">" | "<" | ">=" | "<=" | "=";
  valor: number;
}

interface EntityMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  revenue: number;
}

/**
 * Período de cálculo da regra → instante inicial, **no fuso do usuário**.
 *
 * Isto aqui pausa campanha e mexe em orçamento de verdade, então "hoje"
 * começando 3h cedo não é cosmético: às 21h de Brasília o gasto do dia zerava
 * e uma regra de "gasto > X" voltava a permitir o que já tinha bloqueado.
 *
 * Devolve também a chave do dia, porque `DailyAdMetric.date` é `@db.Date` e se
 * compara por dia de calendário, não por instante.
 */
function calcStart(period: string, tz: string): { start: Date; startKey: string } {
  const agora = Date.now();
  const hoje = todayKey(tz);
  // Janelas móveis de N horas: o instante já é absoluto, mas a chave ainda tem
  // de sair do fuso do usuário para a consulta de métrica diária bater.
  const movel = (horas: number) => {
    const start = new Date(agora - horas * 36e5);
    return { start, startKey: dayKeyInTz(start, tz) };
  };
  const doDia = (key: string) => ({ start: dayStart(key, tz), startKey: key });

  switch (period) {
    case "ultimas_3h":
      return movel(3);
    case "ultimas_6h":
      return movel(6);
    case "ultimas_12h":
      return movel(12);
    case "ontem":
      return doDia(addDaysToKey(hoje, -1));
    case "ultimos_7d":
      return doDia(addDaysToKey(hoje, -6));
    case "ultimos_30d":
      return doDia(addDaysToKey(hoje, -29));
    case "hoje":
    default:
      return doDia(hoje);
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

/**
 * Todas as condições em E (nenhuma condição = não dispara).
 *
 * ⚠️ **`>=` e `<=` eram tratados como `=`.** O `switch` só cobria `>` e `<` e
 * o `return` final assumia igualdade, então uma regra configurada com "maior ou
 * igual" virava "exatamente igual" e praticamente nunca disparava — falha
 * silenciosa, sem erro em lugar nenhum. Operador desconhecido agora **não
 * dispara**, em vez de virar igualdade por acidente: numa regra que pausa
 * campanha, errar para o lado de não agir é o único lado seguro.
 */
function conditionsMet(conds: RuleCondition[], m: EntityMetrics): boolean {
  if (!conds.length) return false;
  return conds.every((c) => {
    const actual = metricValue(m, c.metrica);
    switch (c.operador) {
      case ">": return actual > c.valor;
      case "<": return actual < c.valor;
      case ">=": return actual >= c.valor;
      case "<=": return actual <= c.valor;
      case "=": return Math.abs(actual - c.valor) < 1e-9;
      default: return false;
    }
  });
}

interface RuleRow {
  id: string;
  userId: string;
  targetProduct: string | null;
  adAccountIds: string[];
  /**
   * Área dona da regra. NULO = regra GLOBAL, age sobre todas as contas.
   *
   * 🔴 **O escopo do MOTOR e a ocultação na TELA andam juntos, sempre.** Uma
   * regra que sumisse da Área B mas continuasse pausando as campanhas dela
   * mexeria em orçamento real de forma invisível — o pior dos dois mundos.
   * Se um dia só um dos dois couber, a escolha é deixar a regra APARECENDO em
   * todas as áreas, nunca deixar o motor desescopado.
   */
  workspaceId: string | null;
  level: RuleLevel;
  nameFilter: string | null;
  action: "ATIVAR" | "PAUSAR" | "AJUSTAR_ORCAMENTO";
  actionParams: unknown;
  conditions: unknown;
  calcPeriod: string;
  frequencyMin: number;
  dailyRunLimit: number;
  /** 🔴 Teto de orçamento. NULO = o motor RECUSA aumentar. Ver o schema. */
  maxBudget: unknown;
  windowStartHour: number | null;
  windowEndHour: number | null;
}

export interface RuleRunResult {
  status: "SUCESSO" | "SEM_ACAO" | "ERRO";
  affected: number;
  message: string;
  details: unknown;
}

/** Carrega as entidades no nível da regra, com métricas e vendas atribuídas. */
async function loadEntities(rule: RuleRow, start: Date, startKey: string) {
  // ── Escopo da área ────────────────────────────────────────────────────────
  //
  // Contas-alvo = as escolhidas na regra ∩ as contas da área dona dela. Regra
  // sem conta escolhida ("todas") passa a significar "todas as contas DESTA
  // área", não todas as contas do usuário.
  //
  // ⚠️ A interseção pode dar VAZIO — regra que mira uma conta que saiu da área.
  // Aí ela não age sobre nada, que é o comportamento seguro: agir sobre a conta
  // de outra área seria exatamente o que a área existe para impedir.
  const mapa = await carregarMapaDeAreas(rule.userId);
  const contasDaArea = rule.workspaceId ? mapa.contasDaArea(rule.workspaceId) : null;
  const alvo = rule.adAccountIds.length ? rule.adAccountIds : contasDaArea;
  const contasEfetivas =
    alvo && contasDaArea ? alvo.filter((id) => contasDaArea.includes(id)) : alvo;
  const accountFilter = contasEfetivas ? { id: { in: contasEfetivas } } : {};
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

  const metricWhere = { date: { gte: keyToDateColumn(startKey) }, ad: { adAccount: { userId: rule.userId } } };
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

  /**
   * ⛔ REGRA NÃO ENXERGA O QUE JÁ FOI APAGADO.
   *
   * 🔴 As três consultas abaixo NÃO filtravam status. Toda campanha, conjunto e
   * anúncio da conta entrava no escopo — inclusive `ARCHIVED` e `DELETED`.
   *
   * Para **Pausar** era inofensivo: o laço pula quem não está ACTIVE. Para
   * **Ativar** era o oposto — arquivada não é ACTIVE, então ela **não era
   * pulada**, e o motor chamava `setEntityStatus(ARCHIVED, "ACTIVE")`. Uma
   * regra de ativar tentaria RESSUSCITAR tudo que o usuário já tinha apagado.
   *
   * Medido em produção: a conta CA 1 MARIA tem 12 campanhas arquivadas, e as
   * duas regras cadastradas são de ATIVAR, com escopo "todas as contas".
   * Estavam desativadas — foi só isso que impediu o estrago.
   *
   * ⚠️ `UNKNOWN` CONTINUA no escopo, de propósito: significa que não
   * conseguimos determinar o status, não que a entidade foi apagada. Excluí-lo
   * faria uma regra de pausar deixar de agir justamente onde há incerteza.
   *
   * ⚠️ Este filtro é do MOTOR, não das listagens. `ads/overview.ts` e
   * `facebook/sync.ts` trazem arquivados de propósito — o gasto histórico deles
   * é real e some do Dashboard se forem excluídos. A diferença é que aqueles
   * LEEM e este AGE.
   */
  const semApagados = { status: { notIn: ["ARCHIVED", "DELETED"] as EntityStatus[] } };

  if (rule.level === "CAMPAIGN") {
    const campaigns = await prisma.campaign.findMany({
      where: { adAccount: { userId: rule.userId, ...accountFilter }, ...nameFilterWhere, ...semApagados },
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
      where: { adAccount: { userId: rule.userId, ...accountFilter }, ...nameFilterWhere, ...semApagados },
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
      where: { adAccount: { userId: rule.userId, ...accountFilter }, ...nameFilterWhere, ...semApagados },
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
  const tz = await getUserTimezone(rule.userId);
  const { start, startKey } = calcStart(rule.calcPeriod, tz);

  // Limite diário de execuções — "diário" também no fuso do usuário, senão a
  // cota reiniciava às 21h de Brasília e a regra ganhava execuções extras.
  // Janela de horário, na hora LOCAL do usuário. `start > end` atravessa a
  // meia-noite (22 → 6). Fora da janela a regra não é avaliada: uma regra que
  // só deve mexer em campanha durante o dia não pode agir às 3h porque o cron
  // acordou.
  if (rule.windowStartHour != null && rule.windowEndHour != null) {
    // ⚠️ `hourInTz`, nunca `getHours()`: na Vercel o processo roda em UTC, e a
    // janela "8h–18h" viraria 5h–15h em Brasília.
    const h = hourInTz(new Date(), tz);
    const dentro =
      rule.windowStartHour <= rule.windowEndHour
        ? h >= rule.windowStartHour && h < rule.windowEndHour
        : h >= rule.windowStartHour || h < rule.windowEndHour;
    if (!dentro) {
      return {
        status: "SEM_ACAO",
        affected: 0,
        message: `Fora da janela de execução (${rule.windowStartHour}h–${rule.windowEndHour}h; agora ${h}h).`,
        details: null,
      };
    }
  }

  const startOfDay = dayStart(todayKey(tz), tz);
  const runsToday = await prisma.automationRuleLog.count({
    where: { ruleId: rule.id, ranAt: { gte: startOfDay }, status: "SUCESSO" },
  });
  if (runsToday >= rule.dailyRunLimit) {
    return { status: "SEM_ACAO", affected: 0, message: "Limite diário de execuções atingido.", details: null };
  }

  let entities;
  try {
    entities = await loadEntities(rule, start, startKey);
  } catch (e) {
    return { status: "ERRO", affected: 0, message: e instanceof Error ? e.message : "Erro ao carregar entidades.", details: null };
  }

  const matched = entities.filter((e) => conditionsMet(conds, e.metrics));

  /**
   * O que foi AVALIADO, com os valores reais — sem isto o log diz "nenhuma
   * entidade satisfez" e não há como auditar por quê. Guarda no máximo 20
   * entidades para o Json do log não crescer sem limite.
   */
  const avaliado = entities.slice(0, 20).map((e) => ({
    nome: e.name,
    bateu: conditionsMet(conds, e.metrics),
    valores: Object.fromEntries(
      // ⚠️ Via `metricValue`, não pelo mapa cru: `cpa`, `roas` e `ctr` são
      // DERIVADAS e não existem como chave em `EntityMetrics` — lendo direto,
      // o log mostrava `null` justamente nas métricas mais usadas.
      conds.map((c) => [c.metrica, metricValue(e.metrics, c.metrica)]),
    ),
  }));
  const condicoesTexto = conds.map((c) => `${c.metrica} ${c.operador} ${c.valor}`).join(" E ");

  if (matched.length === 0) {
    return {
      status: "SEM_ACAO",
      affected: 0,
      message: `Nenhuma entidade satisfez as condições (${entities.length} avaliadas).`,
      details: { condicoes: condicoesTexto, avaliado },
    };
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
        // Três modos, e a diferença importa:
        //   percentual  → fator sobre o orçamento ATUAL (+20% = ×1,2)
        //   valor       → define um valor absoluto
        //   pct_gasto   → define uma fração do GASTO do período (ex.: 80% do
        //                 que foi gasto), útil para acompanhar a entrega em vez
        //                 de compor sobre o próprio orçamento
        let novo: number;
        if (params.tipo === "valor") novo = params.valor ?? e.dailyBudget;
        else if (params.tipo === "pct_gasto") novo = (e.metrics.spend * (params.valor ?? 0)) / 100;
        else novo = e.dailyBudget * (1 + (params.valor ?? 0) / 100);

        // Orçamento zero ou negativo seria recusado pela Meta e, pior, é o
        // resultado natural de `pct_gasto` num dia sem gasto nenhum.
        if (!Number.isFinite(novo) || novo <= 0) {
          applied.push({
            name: e.name, action: "AJUSTAR_ORCAMENTO", ok: false,
            error: `valor calculado inválido (${novo}) — sem gasto no período?`,
          });
          continue;
        }

        // ── 🔴 TETO DE ORÇAMENTO ────────────────────────────────────────────
        //
        // O aumento é a única ação desta ferramenta que **gasta mais dinheiro
        // do usuário a cada execução**. Uma regra "+20%" sem teto multiplica o
        // orçamento indefinidamente: 100 → 120 → 144 → 173…
        //
        // FAIL-CLOSED: sem teto configurado, a regra NÃO aumenta. É a mesma
        // regra da autenticação de cron e webhook — ausência de configuração
        // nunca vira permissão. Recusar é visível (aparece no log); aumentar
        // sem limite não é, até a fatura chegar.
        const aumenta = novo > e.dailyBudget;
        const teto = rule.maxBudget == null ? null : Number(rule.maxBudget);
        if (aumenta && teto == null) {
          applied.push({
            name: e.name, action: "AJUSTAR_ORCAMENTO", ok: false,
            error: "recusado: aumento sem teto de orçamento configurado",
          });
          continue;
        }
        if (teto != null) {
          if (e.dailyBudget >= teto) {
            applied.push({
              name: e.name, action: "AJUSTAR_ORCAMENTO", ok: true,
              error: `já no teto (R$ ${teto.toFixed(2)})`,
            });
            continue;
          }
          // Trava no teto em vez de recusar: subir até o limite é o que o
          // usuário pediu, e parar exatamente nele é o comportamento seguro.
          if (novo > teto) novo = teto;
        }
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
    details: { condicoes: condicoesTexto, avaliado, aplicado: applied },
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
    const result = await evaluateRule(rule as unknown as RuleRow);
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
