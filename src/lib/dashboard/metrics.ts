import { carregarMapaDeAreas, whereDespesasDaArea } from "@/lib/areas/atribuicao";
import { getUserTimezone } from "@/lib/userTimezone";
import { prisma } from "@/lib/prisma";
import {
  addDaysToKey,
  dateColumnKey,
  dayEnd,
  dayKeyInTz,
  dayKeyRange,
  dayStart,
  hourInTz,
  keyToDateColumn,
  zonedToUtc,
} from "@/lib/timezone";
import { calcularFinanceiro, type Composicao } from "@/lib/financeiro";
import { janelaAnterior, janelaDoPeriodo, type PeriodoNome } from "@/lib/periodo";
import type { PaymentMethod } from "@/generated/prisma/enums";

/**
 * ⚠️ Alias de `PeriodoNome`, que vive em `lib/periodo.ts`.
 *
 * Era uma união própria com 4 valores (`hoje | 7d | 30d | custom`). Enquanto o
 * Dashboard era a única tela com filtro de data isso passava; com o Gerenciador
 * e os Criativos usando o mesmo seletor, duas uniões diferentes significariam
 * "Mês passado" existir numa tela e não na outra.
 */
export type DashPeriod = PeriodoNome;

export interface DashboardFilters {
  period: DashPeriod;
  account: string; // "todas" ou AdAccount.id
  product: string; // "todos" ou nome do produto
  source: string; // "todas" ou utm_source
  from?: string; // ISO, apenas para custom
  to?: string;
  /**
   * Área de Trabalho ATIVA. É só o id — o servidor resolve a pertinência de
   * cada linha em `lib/areas/precedencia.ts`.
   *
   * ⛔ **Substituiu as listas de inclusão/exclusão** (`accounts`, `products`,
   * `webhooks`, `excluir*`). Aquele modelo aplicava as dimensões em AND no
   * `where`, e por isso uma linha podia não casar com área NENHUMA e sumir do
   * produto inteiro — medido no backup de produção: 12 de 14 vendas. A
   * pergunta agora é "de quem é esta linha?", que sempre tem exatamente uma
   * resposta.
   */
  workspaceId?: string | null;
}

export interface DashboardData {
  kpis: {
    revenue: number;
    spend: number;
    sales: number;
    pendentes: number;
    /**
     * VALOR somado das vendas pendentes, em R$.
     *
     * ⚠️ O card mostra o VALOR, não a contagem. "12 vendas pendentes" não diz
     * quanto dinheiro está na mesa — R$ 240,00 diz. A contagem continua em
     * `pendentes`, exibida como informação secundária.
     */
    pendentesValor: number;
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
    /** Faturamento bruto menos gateway, coprodução, impostos e custo de produto. */
    liquido: number;
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
  /**
   * Composição completa do líquido e do lucro, item por item.
   *
   * ⚠️ Vai inteira para o cliente porque o tooltip precisa mostrar CADA desconto.
   * Um lucro sem decomposição é impossível de conferir — e `faltando` é o que
   * denuncia desconto não cadastrado, que faz o líquido parecer maior.
   */
  financeiro: Composicao;
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
  const hoje = dayKeyInTz(agora, tz);

  // A janela em CHAVES DE DIA vem de `lib/periodo.ts` — a mesma função que o
  // seletor da interface e o Gerenciador usam. O que sobra aqui é só o que é
  // específico do Dashboard: granularidade e janela de comparação.
  const j = janelaDoPeriodo(f.period, tz, { from: f.from, to: f.to }, agora);
  const ant = janelaAnterior(j);

  const start = dayStart(j.startKey, tz);
  const terminaHoje = j.endKey === hoje;

  // Janela que termina HOJE fecha em "agora", não às 23:59: o dia está em curso,
  // e fechar no fim do dia criaria buckets de horas que ainda não aconteceram.
  const end = terminaHoje ? agora : dayEnd(j.endKey, tz);

  // Hora a hora só quando a janela é de UM dia. Isso agora vale também para
  // "Ontem", que ganha o detalhamento por hora de graça.
  const granularity: "hour" | "day" = j.startKey === j.endKey ? "hour" : "day";

  const prevStart = dayStart(ant.startKey, tz);
  // ⚠️ "Hoje" compara contra ONTEM ATÉ O MESMO HORÁRIO. Comparar um dia parcial
  // contra um dia inteiro faria "Hoje" parecer sempre pior de manhã.
  const prevEnd =
    terminaHoje && granularity === "hour"
      ? new Date(prevStart.getTime() + (agora.getTime() - start.getTime()))
      : dayEnd(ant.endKey, tz);

  return { start, end, startKey: j.startKey, endKey: j.endKey, granularity, prevStart, prevEnd };
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

async function windowAggregate(
  userId: string,
  filters: DashboardFilters,
  start: Date,
  end: Date,
  tz: string,
) {
  // Listas efetivas = área de trabalho ∩ filtro da tela. `null` = sem filtro.
  // Filtros da TELA. `null` = sem filtro.
  const produtos = filters.product !== "todos" ? [filters.product] : null;
  const fontes = filters.source !== "todas" ? [filters.source] : null;

  // ── Pertinência de área ────────────────────────────────────────────────────
  //
  // O mapa é do usuário INTEIRO: decidir de quem é uma linha exige saber o que
  // todas as áreas reivindicam. Ver `lib/areas/precedencia.ts` para a ordem de
  // precedência e o porquê de a conta de anúncio vencer o webhook.
  const mapa = await carregarMapaDeAreas(userId);
  const areaAtiva = mapa.areaValida(filters.workspaceId);

  // Contas do GASTO: as da área, intersectadas com o filtro da tela. Escolher
  // na tela uma conta de fora da área não pode trazer dado de fora — por isso
  // a lista vazia (nenhuma conta) em vez de ignorar a área.
  const contasDaArea = mapa.contasDaArea(areaAtiva);
  const contas =
    filters.account !== "todas"
      ? contasDaArea.includes(filters.account) ? [filters.account] : []
      : contasDaArea;

  // Filtro de conta da TELA aplicado a venda/clique/evento: a área já decidiu a
  // pertinência, isto restringe dentro dela.
  const contaDaTela = filters.account !== "todas" ? filters.account : null;
  const naContaDaTela = (utmCampaign: string | null | undefined) =>
    contaDaTela === null || mapa.contaDoUtm(utmCampaign) === contaDaTela;

  // As pontas em chave de dia do fuso do usuário — é assim que `DailyAdMetric`
  // (coluna `@db.Date`, um dia de calendário) tem de ser filtrada.
  const startKey = dayKeyInTz(start, tz);
  const endKey = dayKeyInTz(end, tz);
  const [sales, clicks, metrics, expenses, pixelEvents, initiateCheckouts] = await Promise.all([
    prisma.sale.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
        ...(produtos ? { product: { in: produtos } } : {}),
        ...(fontes ? { click: { is: { utmSource: { in: fontes } } } } : {}),
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
        // O resolvedor de área precisa destes três para aplicar a precedência.
        webhookId: true,
        apiCredentialId: true,
        click: { select: { utmSource: true, utmCampaign: true, country: true, workspaceId: true } },
      },
      orderBy: { timestamp: "desc" },
    }),
    prisma.click.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
        ...(fontes ? { utmSource: { in: fontes } } : {}),
      },
      select: { id: true, utmSource: true, utmCampaign: true, fbclid: true, timestamp: true, workspaceId: true },
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
      // 🔴 `workspaceId` NULO = vale para TODAS as áreas. Taxa de gateway e
      // imposto são globais; prendê-los a uma área faria toda área secundária
      // calcular lucro SEM imposto, com número plausível.
      where: { userId, active: true, ...whereDespesasDaArea(areaAtiva) },
      select: { type: true, calc: true, amount: true, paymentMethod: true },
    }),
    // Feed de atividade: TODOS os eventos do pixel, cada um com seu badge.
    // Antes esta consulta filtrava `event: "InitiateCheckout"`, então Lead e
    // AddToCart eram gravados mas nunca apareciam na tela.
    prisma.pixelEvent.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
      },
      select: { id: true, event: true, url: true, fbclid: true, timestamp: true, pixelConfigId: true },
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
      },
      select: { id: true, fbclid: true, eventId: true, pixelConfigId: true },
    }),
  ]);

  // ── Aplicação da PERTINÊNCIA DE ÁREA ──────────────────────────────────────
  //
  // Feito em memória, e não no `where`, por dois motivos: a ligação
  // venda→conta passa pelo `utm_campaign` no formato `nome|id`, que o Postgres
  // não sabe interpretar; e a precedência é uma cadeia de regras, não uma
  // conjunção de colunas.
  //
  // ⚠️ Toda linha tem dono — quando nenhuma regra casa, o dono é a Principal.
  // É isso que garante que as áreas PARTICIONEM o total: nada some, nada é
  // contado duas vezes. O modelo antigo (interseção de listas) não tinha essa
  // garantia e perdia 12 de 14 vendas no backup real de produção.
  const salesEscopo = sales.filter(
    (v) => mapa.areaDaVenda(v).areaId === areaAtiva && naContaDaTela(v.click?.utmCampaign),
  );
  const clicksEscopo = clicks.filter(
    (c) => mapa.areaDoClique(c).areaId === areaAtiva && naContaDaTela(c.utmCampaign),
  );

  // Evento de pixel não guarda UTM, mas guarda `fbclid` — e o clique tem o UTM.
  // O mapa fbclid→utm_campaign sai dos cliques da JANELA, então um evento cujo
  // clique é anterior a ela não chega à conta e é decidido pelo pixel.
  // O evento herda do clique casado por `fbclid` tanto o UTM quanto a área
  // declarada pelo script — as duas coisas que a precedência consulta.
  const doFbclid = new Map(
    clicks.filter((c) => c.fbclid).map((c) => [c.fbclid as string, c]),
  );
  const doArea = (e: { pixelConfigId?: string | null; fbclid: string | null }) => {
    const cl = e.fbclid ? doFbclid.get(e.fbclid) : undefined;
    const utm = cl?.utmCampaign ?? null;
    return (
      mapa.areaDoEvento({
        pixelConfigId: e.pixelConfigId ?? null,
        utmCampaign: utm,
        clickWorkspaceId: cl?.workspaceId ?? null,
      }).areaId === areaAtiva
      && naContaDaTela(utm)
    );
  };
  const pixelEventsEscopo = pixelEvents.filter(doArea);
  const icsEscopo = initiateCheckouts.filter(doArea);

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
      pendentesValor: summary.pendentesValor,
      liquido: summary.financeiro.liquido,
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
    financeiro: summary.financeiro,
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
  const pendentesLista = w.sales.filter((s) => s.status === "PENDENTE");
  const pendentes = pendentesLista.length;
  // ⚠️ VALOR, não contagem: é o que diz quanto dinheiro está esperando pagamento.
  const pendentesValor = pendentesLista.reduce((a, v) => a + num(v.value), 0);
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
  // ⚠️ A conta de lucro vive em `lib/financeiro.ts` — a MESMA função que os cards
  // de Faturamento Líquido e Lucro usam, e que a tela de Taxas exibe. Era um
  // `computeExpenses` local, e acrescentar os cards criaria uma segunda conta.
  const fin = calcularFinanceiro({
    bruto: revenue,
    brutoPorPagamento: revenueByPayment,
    gastoAnuncios: spend,
    despesas: w.expenses.map((e) => ({ ...e, amount: num(e.amount) })),
  });
  const profit = fin.lucro;
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
  const roi = fin.roi;
  const margin = fin.margem;

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
  const custoSobreReceita = revenue ? (spend + fin.totalDescontos) / revenue : 0;

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

  const expenses = { gateway: fin.gateway, tax: fin.impostos, recurring: fin.despesas, total: fin.totalDescontos };

  return {
    revenue, salesCount, pendentes, pendentesValor, reembolsadas, chargebackRate,
    spend, clicksCount, ticket, cpa, roas, ctr, profit, roi, margin, arpu, buyers,
    expenses, products, sources, payments, funnel, byHour, byDay, byCountry, approval,
    // A composição inteira viaja até a UI: o tooltip do Faturamento Líquido e do
    // Lucro precisa mostrar CADA desconto, senão o número é impossível de conferir.
    financeiro: fin,
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

  // ⚠️ `Record<PeriodoNome, string>` e não um objeto solto: o mapa solto deixava
  // `periodLabel` virar `undefined` em silêncio ao entrar um período novo. Com o
  // Record, o compilador exige a entrada — foi ele que pegou os três que faltavam.
  const ROTULO_GRAFICO: Record<PeriodoNome, string> = {
    hoje: "Hoje · por hora",
    ontem: "Ontem · por hora",
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    mesAtual: "Este mês",
    mesPassado: "Mês passado",
    custom: "Período personalizado",
  };
  const periodLabel = ROTULO_GRAFICO[period];

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
