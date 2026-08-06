import { carregarMapaDeAreas, whereDespesasDaArea } from "@/lib/areas/atribuicao";
// A regra de denominador zero é UMA só nesta base. Ver o comentário do `div`.
import { div } from "@/lib/ads/metrics";
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
  weekdayDaChave,
  zonedToUtc,
} from "@/lib/timezone";
import { chaveDoPedido, contarPedidos, umPorPedido } from "@/lib/pedidos";
import { nomeDaFonte } from "@/lib/fontes";
import { ehTemplateNaoSubstituido, splitPipe } from "@/lib/utm/parse";
import { CAMPOS_UTM, utmsDaVenda } from "@/lib/vendas/utmsDaVenda";
import { getImpostoAnunciosPct } from "@/lib/impostoAnuncios";
import { calcularFinanceiro, type Composicao } from "@/lib/financeiro";
import { janelaAnterior, janelaDoPeriodo, type PeriodoNome } from "@/lib/periodo";
import { SENTINELA_CHECKOUT_GATEWAY } from "@/lib/webhook/checkoutEvent";
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
    /** `null` = nenhum evento de venda no periodo. Indefinido, nao 0%. */
    chargebackRate: number | null;
    /**
     * ⚠️ As cinco abaixo são `number | null`, e `null` significa **indefinido**,
     * nunca zero. Sem venda não existe ticket nem CPA; sem gasto não existe
     * ROAS; sem impressão não existe CTR; sem comprador não existe ARPU.
     *
     * Devolver `0` fazia a tela imprimir "R$ 0,00" e "0,00x" como se fossem
     * medição — um CPA de zero se lê como aquisição de graça. É a mesma
     * correção que o ROI já tinha, estendida aos irmãos dele; o Gerenciador
     * (`lib/ads/metrics.ts`) sempre devolveu `null` aqui, então as duas telas
     * respondiam diferente à mesma pergunta.
     */
    ticket: number | null;
    cpa: number | null;
    roas: number | null;
    /** `null` quando não houve custo nenhum — ROI é indefinido, não zero. */
    roi: number | null;
    /** `null` = sem faturamento no periodo. Indefinido, nao 0%. */
    margin: number | null;
    ctr: number | null;
    clicks: number;
    profit: number;
    /** Faturamento bruto menos gateway, coprodução, impostos e custo de produto. */
    liquido: number;
    /** Faturamento ÷ compradores únicos (Bloco 4). */
    arpu: number | null;
    buyers: number;
  };
  /**
   * Faturamento aprovado por ORIGEM. Vai para o card de ROI.
   *
   * ⚠️ As três somam `kpis.revenue` por construção — são partição, não
   * amostragem. Se um dia deixarem de somar, é bug de classificação.
   */
  origemDaReceita: { campanha: number; direto: number; semOrigem: number };
  deltas: Record<string, number | null>;
  chart: {
    labels: string[];
    revenue: number[];
    /**
     * Gasto por bucket. **VAZIO na granularidade horária** — ver `gastoNaSerie`.
     */
    spend: number[];
    /**
     * A série de gasto existe nesta granularidade?
     *
     * ⛔ `false` por hora: `DailyAdMetric` é diária e a Meta não reporta gasto
     * por hora. Antes o total do dia era lançado no bucket das 00h, o que
     * desenhava um pico de madrugada que nunca houve — e um ROAS de 0 naquela
     * hora contra ∞ nas outras 23. A tela é obrigada a dizer que a linha não
     * existe; sumir sem explicação seria a mesma falha muda do outro lado.
     */
    gastoNaSerie: boolean;
    periodLabel: string;
    granularity: "hour" | "day";
    /**
     * Série por bucket de cada KPI, para os mini-gráficos dos cards.
     *
     * ⚠️ `null` = bucket com denominador zero (dia sem gasto, dia sem venda).
     * **Não é zero**, e o desenho tem de INTERROMPER a linha ali — ver o
     * `Sparkline`. Um zero plotado no chão é indistinguível de uma queda real,
     * e foi por isso que o defeito passou tanto tempo invisível.
     */
    sparklines: Record<string, (number | null)[]>;
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
  /**
   * Vendas aprovadas por POSICIONAMENTO da Meta (`utm_term`).
   *
   * ⚠️ Só entram as vendas cujo clique trouxe o `{{placement}}` substituído. A
   * soma NÃO fecha com `kpis.revenue` — venda sem clique, sem UTM ou com
   * template cru fica de fora, e a tela diz isso.
   */
  byPlacement: { name: string; total: number; sales: number }[];
  payments: { name: string; total: number; count: number }[];
  funnel: { cliques: number; visitas: number; checkouts: number; iniciadas: number; vendas: number };
  /**
   * Cliques classificados como robô no período, por motivo. **Já estão FORA de
   * `funnel.visitas` e de todas as métricas** — vai para a tela só para o
   * usuário poder conferir se o filtro exagera ou falha.
   */
  bots: { motivo: string; total: number }[];
  /** Eventos de pixel fora do funil por virem de ambiente efêmero. */
  ambientesDeTeste: { ambiente: string; total: number }[];
  /**
   * As campanhas que mais faturaram NA JANELA DO DASHBOARD.
   *
   * ⚠️ `roas` e `null` quando a campanha nao teve gasto — indefinido, nao zero.
   * Regra unica de denominador zero: `lib/ads/metrics.ts`.
   */
  topCampaigns: { id: string; nome: string; receita: number; gasto: number; vendas: number; roas: number | null }[];
  /**
   * HEATMAP dia-da-semana × hora. 7 linhas (0=domingo) × 24 colunas.
   *
   * 🔴 `observacoes` É O CAMPO QUE FAZ O BLOCO SER HONESTO, e ele não é
   * decoração: célula com `observacoes: 0` **nunca foi observada** — a janela
   * não passou por aquele dia da semana —, e é diferente de célula observada
   * que teve zero venda. Pintar as duas igual faria o gráfico afirmar ausência
   * de venda onde não houve medição. É a mesma distinção do mapa das razões.
   *
   * ⚠️ Os valores são SOMA; a média é `valor / observacoes` e quem divide é a
   * tela — porque é lá que o denominador precisa aparecer no tooltip.
   *
   * ⛔ NÃO EXISTE GASTO AQUI, e é impossível: `DailyAdMetric` é diária e a Meta
   * não reporta gasto por hora. É o mesmo motivo pelo qual a linha de gasto
   * desaparece na granularidade horária (`gastoNaSerie`). Um gasto por hora
   * seria o total do dia lançado às 00h — um pico de madrugada que nunca houve.
   */
  heatmap: {
    /** `[diaDaSemana][hora]` — 7 × 24. */
    celulas: { revenue: number; sales: number; profit: number; observacoes: number }[][];
    /** Maior número de observações de qualquer célula. 1 = retrato, não padrão. */
    maxObservacoes: number;
  };
  /** Vendas aprovadas por país (ISO-2), ordenado por faturamento — Bloco 5. */
  /** `code: ""` = não identificado. Nunca é descartado — ver `paisMap`. */
  byCountry: { code: string; sales: number; revenue: number; estimadas: number }[];
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
  const [sales, clicks, botsPorMotivo, metrics, expenses, pixelEvents, initiateCheckouts, ambientesDeTeste] = await Promise.all([
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
        // ⚠️ `pedidoId` é o agrupador de conversão. Sem ele no select,
        // `chaveDoPedido` cai no `id` e TODA contagem volta a ser por item —
        // silenciosamente, com o número parecendo plausível.
        pedidoId: true,
        status: true,
        paymentMethod: true,
        timestamp: true,
        buyerName: true,
        buyerEmail: true, // identifica comprador único para o ARPU
        country: true, // "Vendas por país" (Bloco 5)
        countrySource: true, // procedência, para a tela marcar estimativa
        // Taxas REPORTADAS pelo gateway. NULO ≠ zero — ver `lib/financeiro.ts`.
        taxaGateway: true,
        coproducao: true,
        // O resolvedor de área precisa destes três para aplicar a precedência.
        webhookId: true,
        apiCredentialId: true,
        // ⚠️ Os UTMs vêm das DUAS pontas de propósito: a cadeia `Sale -> Click`
        // é a fonte, e a cópia na venda é o seguro para quando o clique some
        // (`clickId` é `SetNull`). Ver `lib/vendas/utmsDaVenda`.
        ...CAMPOS_UTM,
        click: { select: { ...CAMPOS_UTM, country: true, workspaceId: true } },
      },
      orderBy: { timestamp: "desc" },
    }),
    prisma.click.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
        // ⚠️ Bot FORA de toda métrica. Eram 16,5% dos cliques em produção,
        // inflando "Visita na página" no funil e diluindo toda taxa de
        // conversão calculada a partir dela. A linha continua no banco.
        bot: false,
        ...(fontes ? { utmSource: { in: fontes } } : {}),
      },
      // ⚠️ `checkoutAt` vem daqui: a etapa "Initiate Checkout" do funil é do
      // RASTREAMENTO, não do pixel. Ver `lib/funil/checkoutDaJornada.ts`.
      select: { id: true, utmSource: true, utmCampaign: true, fbclid: true, timestamp: true, workspaceId: true, checkoutAt: true, checkoutSource: true },
      orderBy: { timestamp: "desc" },
    }),
    // Contagem de bot do MESMO período e recorte. Existe para o usuário poder
    // auditar se o filtro exagera ou falha — sem isso, "removemos os bots" é
    // uma afirmação que ele teria de aceitar no escuro.
    prisma.click.groupBy({
      by: ["botMotivo"],
      where: {
        userId,
        timestamp: { gte: start, lte: end },
        bot: true,
        ...(fontes ? { utmSource: { in: fontes } } : {}),
      },
      _count: { _all: true },
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
      /* ⚠️ `ad.campaign` entrou para o bloco Top Campanhas. É leitura ADITIVA na
         MESMA consulta — nao ha query nova, e o gasto por campanha nao existia
         em lugar nenhum do lado do Dashboard.

         ⛔ E ele NAO pode vir de `adsData`: aquela lista obedece a janela do
         GERENCIADOR (`period=7d` fixo) e ao filtro de status daquela tela. Usar
         a de la faria o bloco mostrar um periodo diferente do filtro que esta
         em cima dele, EM SILENCIO — e com o campo de busca vazio, que e o caso
         comum, as duas listas sao identicas, entao o defeito seria mudo. */
      select: {
        date: true, spend: true, impressions: true, clicks: true,
        ad: { select: { campaign: { select: { id: true, name: true, fbCampaignId: true } } } },
      },
    }),
    prisma.expense.findMany({
      // 🔴 `workspaceId` NULO = vale para TODAS as áreas. Taxa de gateway e
      // imposto são globais; prendê-los a uma área faria toda área secundária
      // calcular lucro SEM imposto, com número plausível.
      where: { userId, active: true, ...whereDespesasDaArea(areaAtiva) },
      /* ⚠️ `recurrence` ENTROU AQUI, e a ausência dela era metade do bug: sem o
         campo no `select` ele chega `undefined`, o rateio cai no padrão
         `MENSAL` e uma despesa ANUAL volta a ser cobrada como mensalidade — em
         silêncio, com `tsc` verde. É a armadilha do `pedidoId`, de novo. */
      select: { type: true, calc: true, amount: true, paymentMethod: true, recurrence: true },
    }),
    // Feed de atividade: TODOS os eventos do pixel, cada um com seu badge.
    // Antes esta consulta filtrava `event: "InitiateCheckout"`, então Lead e
    // AddToCart eram gravados mas nunca apareciam na tela.
    // ⚠️ `ambiente: null` = produção. Evento de deploy preview, localhost ou
    // túnel fica GRAVADO e sai daqui — ver `lib/pixel/ambiente.ts`.
    prisma.pixelEvent.findMany({
      where: {
        userId,
        ambiente: null,
        timestamp: { gte: start, lte: end },
      },
      select: { id: true, event: true, url: true, fbclid: true, timestamp: true, pixelConfigId: true, clickId: true },
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
        ambiente: null,
        timestamp: { gte: start, lte: end },
      },
      // `clickId` separa as duas populações: com jornada (já contado pelo
      // `Click.checkoutAt`) e sem jornada (só existe aqui).
      select: { id: true, fbclid: true, eventId: true, pixelConfigId: true, clickId: true },
    }),
    // Quantos ficaram FORA por serem de ambiente efêmero. Existe para a tela
    // dizer o número: uma detecção que silencia o que removeu é indistinguível
    // de um bug que come eventos.
    prisma.pixelEvent.groupBy({
      by: ["ambiente"],
      where: { userId, ambiente: { not: null }, timestamp: { gte: start, lte: end } },
      _count: { _all: true },
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
    (v) => mapa.areaDaVenda(v).areaId === areaAtiva && naContaDaTela(utmsDaVenda(v).utms.utmCampaign),
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

  /**
   * ## Checkout iniciado = JORNADAS que chegaram ao checkout
   *
   * > ### 🔴 Antes isto contava EVENTOS, e a chave era `fbclid`
   * > `new Set(icsEscopo.map((e) => e.fbclid || e.eventId || ...))`. Sem `fbclid`
   * > — ou seja, em todo tráfego que não veio de anúncio do Facebook — a chave
   * > caía no `eventId`, que é `InitiateCheckout-<hash>` no navegador e
   * > `gw:<pedido>` no gateway. **Chaves diferentes por construção**, então a
   * > mesma jornada contava duas vezes.
   *
   * Hoje a fonte é `Click.checkoutAt`: as duas pontas escrevem na mesma linha, e
   * o funil só conta linhas. Duplicar deixou de ser possível.
   *
   * ⚠️ **A segunda parcela não é opcional.** Checkout de venda que não casou
   * jornada nenhuma (comprador que nunca passou pelo nosso script) continua
   * existindo, e sem ele o funil perderia o checkout de quem não é rastreável —
   * exatamente o número que o usuário usa para descobrir que o rastreamento não
   * está instalado. São somados porque são populações DISJUNTAS: um tem jornada,
   * o outro não.
   */
  const comJornada = clicksEscopo.filter((c) => c.checkoutAt != null).length;
  const semJornada = new Set(
    icsEscopo.filter((e) => e.clickId == null).map((e) => e.eventId || `row:${e.id}`),
  ).size;
  const checkoutsDistintos = comJornada + semJornada;

  return {
    sales: salesEscopo, clicks: clicksEscopo, metrics, expenses, pixelEvents: pixelEventsEscopo,
    initiateCheckouts: checkoutsDistintos,
    // ⚠️ NÃO passa pelo escopo de área: um clique de robô raramente tem
    // `utm_campaign` atribuível, então filtrá-lo por área o esconderia justamente
    // de quem precisa auditá-lo. É diagnóstico da conta, não métrica de operação.
    bots: botsPorMotivo.map((b) => ({ motivo: b.botMotivo ?? "Robô", total: b._count._all })),
    // Mesma razão do `bots`: NÃO passa pelo escopo de área. É diagnóstico da
    // conta — esconder por área tiraria o número de quem precisa auditá-lo.
    ambientesDeTeste: ambientesDeTeste.map((a) => ({ ambiente: a.ambiente ?? "teste", total: a._count._all })),
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

  /**
   * ⚠️ A MESMA alíquota vai para as duas janelas.
   *
   * Os deltas comparam período atual com anterior; aplicar o imposto só no
   * atual faria a variação do lucro incluir a mudança de regra de cálculo, e o
   * usuário leria isso como queda de desempenho no dia em que ligou o toggle.
   */
  const impostoAnunciosPct = await getImpostoAnunciosPct(userId);
  const summary = summarize(current, impostoAnunciosPct);
  const prev = summarize(previous, impostoAnunciosPct);

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
    origemDaReceita: summary.origem,
    deltas,
    chart,
    expenses: summary.expenses,
    financeiro: summary.financeiro,
    products: summary.products,
    sources: summary.sources,
    byPlacement: summary.byPlacement,
    payments: summary.payments,
    funnel: summary.funnel,
    bots: current.bots,
    ambientesDeTeste: current.ambientesDeTeste,
    byCountry: summary.byCountry,
    topCampaigns: summary.topCampaigns,
    heatmap: summary.heatmap,
    approval: summary.approval,
    byHour: summary.byHour,
    byDay: summary.byDay,
    activity,
    filterOptions,
  };
}

type Window = Awaited<ReturnType<typeof windowAggregate>>;

function summarize(w: Window, impostoAnunciosPct = 0) {
  const approved = w.sales.filter((s) => s.status === "APROVADA");
  const revenue = approved.reduce((a, s) => a + num(s.value), 0);
  // ⚠️ CONVERSÕES, não itens. Um checkout com order bump gera 2 linhas e 1
  // conversão — contar linhas derrubaria o CPA pela metade e inflaria a taxa de
  // conversão do funil, com os dois parecendo números plausíveis.
  const salesCount = contarPedidos(approved);
  const pendentesLista = w.sales.filter((s) => s.status === "PENDENTE");
  /**
   * ⚠️ CONVERSÕES, como `salesCount` — não `.length`.
   *
   * 🔴 Estas três contagens eram as ÚNICAS que ainda contavam itens, na mesma
   * função em que `salesCount` já contava pedidos. Um PIX com order bump é UM
   * pagamento esperando, não dois, e aparecia como dois.
   *
   * O caso caro é o `chargebackRate` logo abaixo: ele dividia uma contagem de
   * ITENS por uma de PEDIDOS. Não é imprecisão — é razão com unidades
   * diferentes no numerador e no denominador, que **infla a taxa** exatamente
   * em quem vende com order bump. E o número continua entre 0 e 100, plausível.
   */
  const pendentes = contarPedidos(pendentesLista);
  // ⚠️ VALOR, não contagem: é o que diz quanto dinheiro está esperando pagamento.
  // Aqui a soma é por LINHA de propósito — o dinheiro do order bump é real.
  const pendentesValor = pendentesLista.reduce((a, v) => a + num(v.value), 0);
  const reembolsadas = contarPedidos(w.sales.filter((s) => s.status === "REEMBOLSADA"));
  const chargebacks = contarPedidos(w.sales.filter((s) => s.status === "CHARGEBACK"));
  // Idem para o topo do funil: "vendas iniciadas" é quanta gente chegou a
  // comprar, não quantos itens foram para o carrinho.
  const totalSalesEvents = contarPedidos(w.sales);
  /* `null` = NENHUM evento de venda no periodo. Uma taxa de chargeback de
     "0,00%" afirma que houve movimento e nada foi contestado — que e uma
     tranquilidade fabricada quando nao houve venda nenhuma. */
  const taxaCb = div(chargebacks, totalSalesEvents);
  const chargebackRate = taxaCb === null ? null : taxaCb * 100;

  const spend = w.metrics.reduce((a, m) => a + num(m.spend), 0);
  const impressions = w.metrics.reduce((a, m) => a + m.impressions, 0);
  const adClicks = w.metrics.reduce((a, m) => a + m.clicks, 0);
  const clicksCount = w.clicks.length;

  /**
   * 🔴 INDEFINIDO é `null`, não zero — e o Gerenciador já fazia isso.
   *
   * `lib/ads/metrics.ts` tem um `div()` que devolve `null` quando o denominador
   * é 0, e a célula mostra "—". Aqui as mesmas quatro contas devolviam `0`, e a
   * tela imprimia o zero como se fosse medição:
   *
   * | Situação | Antes | Como se lia |
   * |---|---|---|
   * | Nenhuma venda | `CPA R$ 0,00` | aquisição de graça |
   * | Nenhuma venda | `Ticket R$ 0,00` | vendi por zero |
   * | Sem gasto | `ROAS 0,00x` | não retornou nada |
   *
   * É exatamente a correção que o ROI já tinha recebido (`totalCost === 0`
   * devolvia 0 e a tela dizia "0,00x", que se lê como empate) — e que os irmãos
   * dele nunca receberam. Duas telas respondiam diferente à mesma pergunta.
   *
   * ⚠️ O card de ROAS já sabia disso pela METADE: `corFinanceira(spend > 0 ?
   * roas : null, ...)` deixava a cor neutra sem gasto, enquanto o número
   * continuava dizendo "0,0x". A cor sabia; o valor não.
   */
  const ticket = salesCount ? revenue / salesCount : null;
  const cpa = salesCount ? spend / salesCount : null;
  const roas = spend ? revenue / spend : null;
  const ctr = impressions ? (adClicks / impressions) * 100 : null;

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
    // Onde o gateway informou a taxa, ela vence a cadastrada — e a `Composicao`
    // devolve quantas vendas usaram cada fonte, para a tela poder dizer.
    vendas: approved.map((s) => ({
      valor: num(s.value),
      formaPagamento: s.paymentMethod,
      taxaGateway: s.taxaGateway == null ? null : num(s.taxaGateway),
      coproducao: s.coproducao == null ? null : num(s.coproducao),
      // ⚠️ `chaveDoPedido` cai no `id` da linha quando `pedidoId` não vem no
      // `select` — e aí a taxa FIXA volta a ser cobrada por item, em silêncio.
      // A consulta de `w.sales` PRECISA trazer `pedidoId`. É a mesma armadilha
      // que já mordeu a contagem de conversões.
      chavePedido: chaveDoPedido(s),
    })),
    impostoAnunciosPct,
    /* A janela que o filtro da tela definiu. É o que faz a mensalidade valer
       3/31 num "Últimos 3 dias" em vez de inteira. */
    janela: { startKey: w.janela.startKey, endKey: w.janela.endKey },
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
  // Sem comprador nenhum o ARPU é indefinido, não zero — ver a nota acima.
  const arpu = buyers ? revenue / buyers : null;

  /**
   * De onde veio o faturamento — TRÊS origens, não duas.
   *
   * ## 🔴 "Não atribuído" juntava coisas diferentes
   *
   * Uma linha só de "sem campanha" soa como falha da ferramenta, e nem sempre
   * é. Medido em 04/08/2026: 49,6% do faturamento de um usuário e 100% do de
   * outro apareciam assim — e boa parte era venda de teste feita por link
   * direto do checkout, que **não tem campanha mesmo**.
   *
   * | Origem | O que aconteceu |
   * |---|---|
   * | `campanha` | clique com `utm_campaign` — veio de anúncio |
   * | `direto` | clique SEM `utm_campaign` — vimos a visita, não houve anúncio |
   * | `semOrigem` | nenhum clique — nunca tocou o nosso script |
   *
   * ⚠️ **Só a terceira pede ação**, e mesmo ela é ambígua por construção: link
   * direto do checkout e falha de rastreamento produzem o MESMO estado (o
   * visitante não passou pelo script). A tela diz as duas possibilidades em vez
   * de escolher uma — ver o texto do card.
   */
  const origem = { campanha: 0, direto: 0, semOrigem: 0 };
  for (const s of approved) {
    const v = num(s.value);
    const { utms, fonte } = utmsDaVenda(s);
    /**
     * ⚠️ `fonte === "copia"` **prova que houve clique** — a cópia só é gravada a
     * partir de um clique casado. Consultá-la aqui não é detalhe: sem isso, uma
     * venda cujo clique foi apagado cairia em `semOrigem`, que é a ÚNICA das três
     * que pede ação. A tela mandaria o usuário investigar o rastreamento por
     * causa de uma linha que rastreou corretamente.
     *
     * ⚠️ **Limite honesto:** clique de tráfego DIRETO que foi apagado tem cópia
     * toda nula, então continua caindo em `semOrigem`. Não há o que preserve a
     * existência dele — e inventar a distinção seria pior que perdê-la.
     */
    const houveClique = s.click != null || fonte === "copia";
    if (!houveClique) origem.semOrigem += v;
    else if (utms.utmCampaign?.trim()) origem.campanha += v;
    else origem.direto += v;
  }


  /* ── TOP CAMPANHAS ────────────────────────────────────────────────────────
     Faturamento, gasto e ROAS por campanha, na JANELA DO DASHBOARD.

     🔴 A ATRIBUICAO PREFERE O ID, e cai no nome — a mesma regra de
     `ads/overview.ts` e `ads/creatives.ts`. O `utm_campaign` do Bloco 11 vem
     como `nome|id`; para trafego antigo so ha o nome, e ai o casamento e
     ambiguo quando duas campanhas se chamam igual (divida #3, conhecida).

     ⚠️ CONTAGEM POR PEDIDO, SOMA POR LINHA — a mesma decisao de
     `ads/overview.ts`. `vendas` conta pedidos distintos (contar itens inflaria
     order bump); `receita` soma as linhas, porque o dinheiro do bump e real. */
  const campPorId = new Map<string, { id: string; nome: string; gasto: number }>();
  const campPorNome = new Map<string, string>(); // nome minusculo -> id do fb
  for (const m of w.metrics) {
    const c = m.ad?.campaign;
    if (!c) continue;
    const cur = campPorId.get(c.fbCampaignId) ?? { id: c.fbCampaignId, nome: c.name, gasto: 0 };
    cur.gasto += num(m.spend);
    campPorId.set(c.fbCampaignId, cur);
    campPorNome.set(c.name.toLowerCase(), c.fbCampaignId);
  }

  const receitaPorCamp = new Map<string, { receita: number; pedidos: Set<string> }>();
  for (const v of approved) {
    const { name, id } = splitPipe(utmsDaVenda(v).utms.utmCampaign);
    /* Sem id E sem nome nao ha a que atribuir. A venda continua no faturamento
       total — ela so nao aparece NESTE bloco, e o rodape diz quanto ficou de
       fora, senao a soma das linhas nao bate com o KPI e parece erro. */
    const chave = id ?? (name ? campPorNome.get(name.toLowerCase()) ?? null : null);
    if (!chave) continue;
    const cur = receitaPorCamp.get(chave) ?? { receita: 0, pedidos: new Set<string>() };
    cur.receita += num(v.value);
    cur.pedidos.add(chaveDoPedido(v));
    receitaPorCamp.set(chave, cur);
    if (!campPorId.has(chave)) campPorId.set(chave, { id: chave, nome: name ?? chave, gasto: 0 });
  }

  const topCampaigns = [...campPorId.values()]
    .map((c) => {
      const r = receitaPorCamp.get(c.id);
      const receita = r?.receita ?? 0;
      return { id: c.id, nome: c.nome, receita, gasto: c.gasto, vendas: r?.pedidos.size ?? 0, roas: div(receita, c.gasto) };
    })
    /* Campanha sem faturamento E sem gasto e ruido — nem rodou, nem vendeu. */
    .filter((c) => c.receita > 0 || c.gasto > 0)
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 5);

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
    /**
     * ⚠️ Agrupa pelo nome DE EXIBIÇÃO, não pelo valor cru.
     *
     * `FB`, `facebook` e `Meta` são a mesma fonte, e apareciam como três fatias
     * separadas somando a mesma coisa. Quem decide é `lib/fontes.ts` — o valor
     * gravado no clique continua intocado, porque `utm_source=FB` já está
     * colado no painel dos gateways de quem gerou os códigos.
     */
    const src = nomeDaFonte(utmsDaVenda(s).utms.utmSource);
    srcMap.set(src, (srcMap.get(src) ?? 0) + num(s.value));
  }
  const sources = [...srcMap.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  /**
   * Vendas por POSICIONAMENTO (`utm_term` = `{{placement}}` da Meta).
   *
   * Responde "onde o anúncio converteu?" — feed do Instagram, stories, reels,
   * audience network. É a dimensão que o Gerenciador não mostra e que decide
   * onde vale a pena concentrar entrega.
   *
   * ⛔ Template não substituído NÃO vira posicionamento.
   *
   * Um clique com `{{placement}}` cru (ou `%7B%7Bplacement%7D%7D`) não veio de
   * entrega de anúncio — é preview, crawler ou link colado à mão. Deixá-lo
   * entrar criaria um "posicionamento" fantasma no topo do ranking, com nome de
   * macro, e a soma pareceria completa. `ehTemplateNaoSubstituido` é o MESMO
   * guarda que o parser de tracking usa; duplicar a checagem aqui faria as duas
   * divergirem no primeiro formato novo.
   *
   * ⚠️ Conta PEDIDOS e soma LINHAS: o posicionamento descreve a compra, não o
   * item, então um checkout com order bump é uma conversão — mas o dinheiro dos
   * dois itens é real.
   */
  const placeMap = new Map<string, { total: number; sales: number }>();
  const pedidosPorPlacement = new Set<string>();
  for (const s of approved) {
    const bruto = utmsDaVenda(s).utms.utmTerm;
    const place = ehTemplateNaoSubstituido(bruto) ? null : bruto?.trim() || null;
    if (!place) continue;
    const cur = placeMap.get(place) ?? { total: 0, sales: 0 };
    cur.total += num(s.value);
    const chave = `${place}::${chaveDoPedido(s)}`;
    if (!pedidosPorPlacement.has(chave)) {
      pedidosPorPlacement.add(chave);
      cur.sales += 1;
    }
    placeMap.set(place, cur);
  }
  const byPlacement = [...placeMap.entries()]
    .map(([name, v]) => ({ name, total: v.total, sales: v.sales }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

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
  //
  // ⚠️ **Venda sem país NÃO é descartada** — vira a entrada `code: ""`, que a
  // tela mostra como "Não identificado". Antes ela sumia do bloco inteiro, e o
  // ranking dava a impressão de que 100% das vendas estavam geolocalizadas.
  // Some justamente quem a base não cobre (a África tem ~4% de lacuna), que é o
  // caso em que o usuário mais precisa saber que não sabemos.
  //
  // ⚠️ `estimadas` conta as que herdaram o país do CLIQUE em vez de trazer o
  // próprio. O clique pode ter passado pelo datacenter da rede social (55,6% do
  // tráfego humano vem do navegador embutido do app), então esse país é palpite,
  // não medida. Hoje isso é 0 com a Kirvano — que manda o IP do comprador —,
  // mas é propriedade DELA, não do nosso desenho: um gateway novo que não mande
  // IP faz o número subir, e é assim que a tela avisa.
  const paisMap = new Map<string, { sales: number; revenue: number; estimadas: number }>();
  // ⚠️ DUAS contagens no mesmo laço, e elas NÃO são a mesma coisa: `sales` conta
  // conversões (um pedido, um país), `revenue` soma TODAS as linhas — senão o
  // faturamento do order bump sumiria do ranking de países.
  //
  // Por isso o laço percorre `approved` inteiro e o `sales` só incrementa no
  // primeiro item de cada pedido, em vez de usar `umPorPedido`.
  const pedidosVistos = new Set<string>();
  for (const s of approved) {
    const proprio = (s.country ?? "").trim().toUpperCase();
    const doClique = (s.click?.country ?? "").trim().toUpperCase();
    const code = proprio || doClique;
    const cur = paisMap.get(code) ?? { sales: 0, revenue: 0, estimadas: 0 };
    const primeiroDoPedido = !pedidosVistos.has(chaveDoPedido(s));
    pedidosVistos.add(chaveDoPedido(s));
    if (primeiroDoPedido) cur.sales += 1;
    cur.revenue += num(s.value);
    // Estimada = herdou o país do CLIQUE (gateway sem IP do comprador), ou o
    // próprio clique teve o país inferido em vez de medido. `payload` e `ip`
    // são medida; o resto é inferência e a tela precisa dizer isso.
    const inferida = s.countrySource != null && !["payload", "ip"].includes(s.countrySource);
    if (primeiroDoPedido && ((!proprio && doClique) || inferida)) cur.estimadas += 1;
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
  // ⚠️ Por PEDIDO: a forma de pagamento é da compra, não do item. Um carrinho
  // com bump geraria 2 "geradas" e 2 "pagas" para o mesmo Pix.
  for (const s of umPorPedido(w.sales)) {
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
  /* 🔴 O COMENTÁRIO AQUI AFIRMAVA QUE AS RECORRENTES ENTRAVAM, E ELAS NÃO
     ENTRAVAM. `fin.totalDescontos` é `gateway + coprodução + impostos +
     custoProduto` — as recorrentes ficam FORA dele (ver `financeiro.ts:399`).
     Então o lucro por horário simplesmente as ignorava, enquanto o card de
     Lucro as cobrava inteiras: o MESMO custo, dois tratamentos, e o comentário
     descrevendo um terceiro que não existia.

     Agora entra `fin.despesas`, que já vem RATEADO pelos dias da janela
     (`lib/despesas/rateio.ts`). O rateio por dias acontece uma vez, no nível do
     período; aqui só se distribui o que sobrou entre as horas.

     ⚠️ A distribuição POR HORA continua proporcional ao faturamento, e isso é
     deliberado: não há informação de hora numa despesa de calendário. A soma
     das 24 horas fecha com o lucro do período, que é a propriedade que importa
     — dividir igual pelas 24 faria toda hora sem venda mostrar prejuízo. */
  const custoSobreReceita = revenue ? (spend + fin.totalDescontos + fin.despesas) / revenue : 0;

  // `hourInTz` em vez de `getHours()`: era exatamente aqui que uma venda das
  // 17h em Brasília aparecia às 20h — o processo na Vercel roda em UTC e
  // `getHours()` devolve a hora do processo, não a do usuário.
  const tz = w.janela.tz;
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, sales: 0, revenue: 0, profit: 0 }));
  // ⚠️ `sales` conta CONVERSÕES e `revenue` soma TODAS as linhas. Usar
  // `umPorPedido` aqui descartaria o faturamento do order bump — o gráfico
  // deixaria de bater com o KPI de faturamento.
  const horasVistas = new Set<string>();
  for (const s of approved) {
    const h = hourInTz(s.timestamp, tz);
    const v = num(s.value);
    if (!horasVistas.has(chaveDoPedido(s))) {
      horasVistas.add(chaveDoPedido(s));
      byHour[h]!.sales += 1;
    }
    byHour[h]!.revenue += v;
    byHour[h]!.profit += v - v * custoSobreReceita;
  }

  const diaMap = new Map<string, { sales: number; revenue: number }>();
  const diasVistos = new Set<string>();
  for (const s of approved) {
    const key = dayKeyInTz(s.timestamp, tz);
    const cur = diaMap.get(key) ?? { sales: 0, revenue: 0 };
    if (!diasVistos.has(chaveDoPedido(s))) {
      diasVistos.add(chaveDoPedido(s));
      cur.sales += 1;
    }
    cur.revenue += num(s.value);
    diaMap.set(key, cur);
  }
  // Preenche todos os dias da janela, inclusive os sem venda: o gráfico desenha
  // barra-fantasma nas lacunas, e sem elas a série temporal ficaria com buracos.
  /* ── HEATMAP dia-da-semana × hora ────────────────────────────────────────
     Mesma passagem sobre `approved` do `byHour`, com a segunda dimensão.

     🔴 A COBERTURA VEM DO CALENDÁRIO, NÃO DO DADO. Percorrer as vendas diria
     quantas células TIVERAM venda; o que o gráfico precisa saber é quantas
     células a JANELA visitou. Com filtro de 3 dias, quatro dias da semana nunca
     foram observados — e as 96 células deles têm de ficar em branco, não em
     "zero venda". Sem isto o mapa afirmaria que ninguém compra às quartas
     porque o recorte não tinha nenhuma quarta.

     ⚠️ `weekdayDaChave` e não `getDay()`: a chave já está no fuso do usuário. */
  const celulas = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ revenue: 0, sales: 0, profit: 0, observacoes: 0 })),
  );
  for (const k of dayKeyRange(w.janela.startKey, w.janela.endKey)) {
    const wd = weekdayDaChave(k);
    for (let h = 0; h < 24; h++) celulas[wd]![h]!.observacoes += 1;
  }
  const vistosHeat = new Set<string>();
  for (const s2 of approved) {
    const wd = weekdayDaChave(dayKeyInTz(s2.timestamp, tz));
    const h = hourInTz(s2.timestamp, tz);
    const v = num(s2.value);
    const c = celulas[wd]![h]!;
    // Mesma regra do `byHour`: conversão conta por PEDIDO, faturamento soma linhas.
    const chave = chaveDoPedido(s2);
    if (!vistosHeat.has(chave)) {
      vistosHeat.add(chave);
      c.sales += 1;
    }
    c.revenue += v;
    c.profit += v - v * custoSobreReceita;
  }
  const maxObservacoes = Math.max(...celulas.flat().map((c) => c.observacoes), 0);
  const heatmap = { celulas, maxObservacoes };

  const byDay = dayKeyRange(w.janela.startKey, w.janela.endKey, 60)
    .map((k) => ({ date: k, ...(diaMap.get(k) ?? { sales: 0, revenue: 0 }) }))
    .slice(-30);

  const expenses = { gateway: fin.gateway, tax: fin.impostos, recurring: fin.despesas, total: fin.totalDescontos };

  return {
    revenue, origem, salesCount, pendentes, pendentesValor, reembolsadas, chargebackRate,
    spend, clicksCount, ticket, cpa, roas, ctr, profit, roi, margin, arpu, buyers, topCampaigns, heatmap,
    expenses, products, sources, byPlacement, payments, funnel, byHour, byDay, byCountry, approval,
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
  const buckets: { label: string; start: number; end: number; dayKey: string }[] = [];
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
      });
    }
  }

  const approved = w.sales.filter((s) => s.status === "APROVADA");
  const revenue = buckets.map((b) =>
    approved.filter((s) => s.timestamp.getTime() >= b.start && s.timestamp.getTime() < b.end).reduce((a, s) => a + num(s.value), 0),
  );
  /**
   * # ⛔ NÃO EXISTE GASTO POR HORA — e desenhá-lo era pior que não desenhar
   *
   * `DailyAdMetric` é, como o nome diz, **diária**: a Meta não reporta gasto por
   * hora e não há como pedir. Até aqui a série horária lançava o total do dia
   * inteiro no bucket das **00h**, com o argumento de que assim a soma do
   * gráfico continuava batendo com o KPI.
   *
   * O argumento estava errado, e o custo é maior que o ganho:
   *
   * | O que o gráfico mostrava | O que o usuário lia |
   * |---|---|
   * | pico de gasto às 00h, zero nas outras 23h | "gastei tudo de madrugada" |
   * | ROAS do bucket das 00h ≈ 0 | "a madrugada não converte" |
   * | ROAS das outras 23h = ∞ (gasto 0) | "o dia inteiro é lucrativo" |
   *
   * Nenhuma dessas leituras é verdade, e as três são acionáveis — é o tipo de
   * número que muda decisão de mídia. **Somar certo não compensa distribuir
   * errado**: o KPI de gasto continua correto porque vem de `summarize`, não
   * daqui, então o que se perdia era só a coincidência de a série somar o mesmo.
   *
   * Hoje, em granularidade horária, a série de gasto simplesmente **não
   * existe** — e `gastoNaSerie: false` faz a tela dizer isso, em vez de deixar
   * uma linha sumir sem explicação (que seria a mesma falha muda, do outro lado).
   */
  const gastoNaSerie = granularity === "day";
  const spend = gastoNaSerie
    ? buckets.map((b) =>
        w.metrics.filter((m) => dateColumnKey(m.date) === b.dayKey).reduce((a, m) => a + num(m.spend), 0),
      )
    : [];

  // Séries por bucket para os sparklines dos cards de KPI (Bloco 5 — polimento).
  // Derivadas dos mesmos buckets do gráfico, para a mini-linha contar a mesma
  // história do gráfico grande.
  const vendasPorBucket = buckets.map((b) =>
    // Conversões, para o sparkline de vendas/ticket/CPA bater com os cards.
    contarPedidos(approved.filter((s) => s.timestamp.getTime() >= b.start && s.timestamp.getTime() < b.end)),
  );
  const compradoresPorBucket = buckets.map((b) => {
    const nesse = approved.filter((s) => s.timestamp.getTime() >= b.start && s.timestamp.getTime() < b.end);
    const emails = new Set(nesse.map((s) => s.buyerEmail?.trim().toLowerCase()).filter(Boolean));
    return emails.size + nesse.filter((s) => !s.buyerEmail?.trim()).length;
  });
  /* ⛔ O `div` LOCAL FOI DELETADO. Ele era `(a, b) => (b ? a / b : 0)` — mesmo
     NOME e contrato OPOSTO ao de `lib/ads/metrics.ts`, a 56 linhas do
     comentário desta função que cita aquele como o modelo certo.

     Duas implementações da mesma conta divergem sempre; com o mesmo nome,
     divergem sem ninguém notar, porque o `grep` acha as duas e a leitura assume
     que são a mesma. Agora há UMA, importada. */

  // ⚠️ Sem gasto na série INTEIRA, as três métricas que dividem por ele saem
  // vazias em vez de zeradas — a série nem chega ao componente. Isto continua
  // valendo, e é diferente do buraco NO MEIO: aquele agora é `null` bucket a
  // bucket, e a linha se interrompe em vez de descer ao chão.
  const serieVazia: (number | null)[] = [];
  const sparklines: Record<string, (number | null)[]> = {
    faturamento: revenue,
    gasto: gastoNaSerie ? spend : serieVazia,
    vendas: vendasPorBucket,
    roas: gastoNaSerie ? revenue.map((r, i) => div(r, spend[i] ?? 0)) : serieVazia,
    ticket: revenue.map((r, i) => div(r, vendasPorBucket[i] ?? 0)),
    arpu: revenue.map((r, i) => div(r, compradoresPorBucket[i] ?? 0)),
    cpa: gastoNaSerie ? spend.map((sp, i) => div(sp, vendasPorBucket[i] ?? 0)) : serieVazia,
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

  return { labels: buckets.map((b) => b.label), revenue, spend, gastoNaSerie, periodLabel, granularity, sparklines };
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
    const { utms: feedUtms } = utmsDaVenda(s);
    items.push({
      id: "s-" + s.id,
      type: tipo,
      // ⚠️ MESMA tradução do donut e do filtro. Sem ela a coluna ORIGEM do feed
      // mostrava "FB" enquanto o gráfico ao lado já dizia "Meta Ads" — a mesma
      // fonte com dois nomes na mesma tela.
      source: feedUtms.utmSource ? nomeDaFonte(feedUtms.utmSource) : "Direto",
      campaign: feedUtms.utmCampaign ?? s.product,
      value: num(s.value),
      ts: s.timestamp.getTime(),
    });
  }
  for (const c of w.clicks.slice(0, 40)) {
    items.push({
      id: "c-" + c.id,
      type: "clique",
      source: c.utmSource ? nomeDaFonte(c.utmSource) : "Direto",
      campaign: c.utmCampaign ?? "—",
      value: null,
      ts: c.timestamp.getTime(),
    });
  }
  /**
   * ## O checkout do feed vem da JORNADA, não de `PixelEvent`
   *
   * > ### 🔴 Era isto que o usuário VIA duas vezes
   * > ```
   * > Checkout · Gateway · 31s
   * > Checkout · Pixel   · sigmatools.shop/ · 2min
   * > ```
   * > Duas linhas para a mesma jornada, porque o feed listava um item por
   * > `PixelEvent` e havia dois eventos — um do navegador, um do webhook. Corrigir
   * > só a CONTAGEM do funil e deixar o feed assim resolveria o número e manteria
   * > o sintoma na tela.
   *
   * `Lead`, `AddToCart` e `PageView` continuam saindo de `PixelEvent`: eles são
   * eventos de PIXEL, não etapas de funil, e cada um é um fato próprio.
   */
  for (const c of w.clicks.filter((x) => x.checkoutAt != null).slice(0, 40)) {
    items.push({
      id: "co-" + c.id,
      type: "checkout",
      // A fonte diz QUEM detectou — é o que permite ver, no próprio feed, se o
      // detector do script está vivo ou se só o gateway está reportando.
      source: c.checkoutSource === "gateway" ? "Gateway" : "Pixel",
      campaign: c.checkoutSource === "gateway" ? "Checkout no gateway" : "Clique no botão de compra",
      value: null,
      ts: c.checkoutAt!.getTime(),
    });
  }
  for (const e of w.pixelEvents.slice(0, 40)) {
    // ⚠️ IC COM jornada já apareceu acima. Sem jornada continua aqui: é checkout
    // de quem não é rastreável, e sumir dele esconderia justamente o caso que
    // denuncia rastreamento não instalado.
    if (e.event === "InitiateCheckout" && e.clickId != null) continue;
    items.push({
      id: "p-" + e.id,
      type:
        e.event === "Lead" ? "lead"
        : e.event === "AddToCart" ? "add_to_cart"
        : e.event === "PageView" ? "pageview"
        : "checkout",
      source: e.url === SENTINELA_CHECKOUT_GATEWAY ? "Gateway" : "Pixel",
      // ⚠️ `gateway:webhook` é SENTINELA, não URL: marca o InitiateCheckout que
      // nasceu do webhook do gateway (checkout hospedado por ele, onde o nosso
      // script não roda). Vazava cru para a coluna e se lia como nome de
      // campanha inexistente — ver `registrarCheckoutDoGateway`.
      campaign:
        e.url === SENTINELA_CHECKOUT_GATEWAY
          ? "Checkout no gateway"
          : e.url
            ? e.url.replace(/^https?:\/\//, "").slice(0, 48)
            : "—",
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
