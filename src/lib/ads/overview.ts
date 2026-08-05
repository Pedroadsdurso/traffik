import { carregarMapaDeAreas } from "@/lib/areas/atribuicao";
import { getUserTimezone } from "@/lib/userTimezone";
import { prisma } from "@/lib/prisma";
import { janelaDoPeriodo, type PeriodoNome } from "@/lib/periodo";
import { dayEnd, dayKeyInTz, dayStart, keyToDateColumn } from "@/lib/timezone";
import { chaveDoPedido } from "@/lib/pedidos";
import { splitPipe } from "@/lib/utm/parse";
import { CAMPOS_UTM, utmsDaVenda } from "@/lib/vendas/utmsDaVenda";

export interface AdsFilters {
  /**
   * ⚠️ Os 7 períodos de `lib/periodo.ts`, não os 3 de antes. O Gerenciador tinha
   * só Hoje/7d/30d; agora usa o mesmo seletor do Dashboard.
   */
  period: PeriodoNome;
  /** Apenas para `period: "custom"`. */
  from?: string;
  to?: string;
  account: string; // "todas" ou AdAccount.id
  status: string; // "todos" | "ativo" | "pausado"
  search: string;
  /**
   * Filtros BASE da Área de Trabalho, carregados no servidor a partir do `?ws=`.
   * Mesma convenção do Dashboard: lista vazia/ausente = não filtra, e o filtro
   * da TELA age DENTRO dela.
   */
  /**
   * Área de Trabalho ATIVA — só o id. A pertinência de cada linha é resolvida
   * no servidor por `lib/areas/precedencia.ts`. Ver o porquê em `metrics.ts`.
   */
  workspaceId?: string | null;
}

export interface CampaignRow {
  id: string;
  fbId: string;
  name: string;
  status: string;
  /**
   * `effective_status` cru da Meta — se está REALMENTE veiculando.
   *
   * ⚠️ NULO = a Meta ainda não informou (sync antigo), **não** "parado". Quem
   * traduz para linguagem de tela é `lib/ads/veiculacao.ts`.
   */
  effectiveStatus: string | null;
  accountId: string;
  /// Orçamento na campanha ⇒ CBO. Nulo ⇒ ABO (orçamento nos conjuntos).
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  bidStrategy: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  revenue: number;
  /** Initiate Checkout atribuídos (visitantes distintos). NOSSO rastreamento. */
  ic: number;
  /** Cliques que chegaram ao site com UTM. NOSSO rastreamento — não confundir
   *  com `clicks`, que é o clique no anúncio reportado pela Meta. */
  cliquesAtribuidos: number;
  /** Vendas em QUALQUER status (pendente, aprovada, reembolsada…). NOSSO. */
  vendasIniciadas: number;
}
export interface AdSetRow extends Omit<CampaignRow, "dailyBudget"> {
  campaignId: string;
  campaignName: string;
  dailyBudget: number | null;
  /** Bid cap do conjunto (`bid_amount`). */
  bidAmount: number | null;
}
export interface AdRow extends Omit<CampaignRow, "dailyBudget"> {
  campaignId: string;
  campaignName: string;
  adSetId: string;
  format: string;
  thumbnailUrl: string | null;
}
export interface AccountRow {
  id: string;
  fbAccountId: string;
  name: string;
  currency: string;
  tracking: boolean;
  campaigns: number;
  spend: number;
  revenue: number;
}

export interface AdsOverview {
  campaigns: CampaignRow[];
  adSets: AdSetRow[];
  ads: AdRow[];
  accounts: AccountRow[];
}

/**
 * Janela do gerenciador, no fuso do usuário. Devolve o instante inicial (para
 * `Sale.timestamp`) e a chave do dia (para `DailyAdMetric.date`, que é
 * `@db.Date` e não pode ser comparada com um instante).
 */
/**
 * Janela do Gerenciador, da fonte ÚNICA (`lib/periodo.ts`).
 *
 * 🔴 **Agora tem as DUAS pontas.** O `rangeStart` que existia aqui devolvia só o
 * início e todo filtro era `timestamp >= start`, ou seja "do início até agora".
 * Isso funcionava porque os únicos períodos eram Hoje/7d/30d, que terminam hoje.
 * Com "Ontem" e "Mês passado" no seletor, aquilo traria **a janela escolhida mais
 * tudo o que veio depois** — "Mês passado" incluindo o mês atual.
 */
function janela(filters: AdsFilters, tz: string) {
  const agora = new Date();
  const j = janelaDoPeriodo(filters.period, tz, { from: filters.from, to: filters.to }, agora);
  return {
    start: dayStart(j.startKey, tz),
    // Janela que termina hoje fecha em "agora"; no passado, no fim do dia.
    end: j.endKey === dayKeyInTz(agora, tz) ? agora : dayEnd(j.endKey, tz),
    startKey: j.startKey,
    endKey: j.endKey,
  };
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}


export async function computeAdsOverview(userId: string, filters: AdsFilters): Promise<AdsOverview> {
  const tz = await getUserTimezone(userId);
  const { start, end, startKey, endKey } = janela(filters, tz);

  // Área ∩ filtro da tela. `null` = sem filtro.
  // Pertinência de área — ver `lib/areas/precedencia.ts`.
  const mapa = await carregarMapaDeAreas(userId);
  const areaAtiva = mapa.areaValida(filters.workspaceId);
  const contasDaArea = mapa.contasDaArea(areaAtiva);
  const contas =
    filters.account !== "todas"
      ? contasDaArea.includes(filters.account) ? [filters.account] : []
      : contasDaArea;

  // A LISTAGEM do Gerenciador é sempre por inclusão: uma campanha pertence a
  // uma conta concreta, e as contas da área são um conjunto fechado.
  const accountWhere = { id: { in: contas } };

  const [accounts, campaigns, adSets, ads, metrics, sales, cliquesNossos] = await Promise.all([
    prisma.adAccount.findMany({
      where: { userId, ...accountWhere },
      select: { id: true, fbAccountId: true, name: true, currency: true, trackingEnabled: true },
      orderBy: { name: "asc" },
    }),
    prisma.campaign.findMany({
      where: { adAccount: { userId, ...accountWhere } },
      select: { id: true, fbCampaignId: true, name: true, status: true, effectiveStatus: true, dailyBudget: true, lifetimeBudget: true, bidStrategy: true, adAccountId: true },
    }),
    prisma.adSet.findMany({
      where: { adAccount: { userId, ...accountWhere } },
      select: { id: true, fbAdSetId: true, name: true, status: true, effectiveStatus: true, dailyBudget: true, lifetimeBudget: true, bidAmount: true, adAccountId: true, campaignId: true },
    }),
    prisma.ad.findMany({
      where: { adAccount: { userId, ...accountWhere } },
      select: {
        id: true,
        fbAdId: true,
        name: true,
        status: true,
        effectiveStatus: true,
        adAccountId: true,
        campaignId: true,
        adSetId: true,
        creative: { select: { thumbnailUrl: true, videoId: true } },
      },
    }),
    prisma.dailyAdMetric.findMany({
      where: {
        date: { gte: keyToDateColumn(startKey), lte: keyToDateColumn(endKey) },
        ad: { adAccount: { userId, ...accountWhere } },
      },
      select: { adId: true, spend: true, impressions: true, clicks: true },
    }),
    // TODAS as vendas do período (qualquer status). As aprovadas viram
    // `results`/`revenue`; o total vira `vendasIniciadas`. Uma consulta só —
    // buscar duas vezes com filtros diferentes custaria outro round-trip.
    prisma.sale.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
      },
      // `CAMPOS_UTM` nas duas pontas: a relação `click` é a fonte, as colunas na
      // venda são a cópia para quando o clique some (`clickId` é `SetNull`).
      select: { id: true, pedidoId: true, value: true, status: true, product: true, webhookId: true, apiCredentialId: true, ...CAMPOS_UTM, click: { select: { ...CAMPOS_UTM, workspaceId: true } } },
    }),
    // Cliques rastreados por NÓS, atribuídos por UTM. Chegam ao banco no
    // instante do clique (via `t.js`), sem depender do Facebook.
    prisma.click.findMany({
      // ⚠️ `bot: false` — alimenta a coluna "Cliq. atr.", que é métrica.
      where: { userId, timestamp: { gte: start, lte: end }, bot: false },
      // `checkoutAt`: a coluna IC do Gerenciador passa a sair da JORNADA, não de
      // `PixelEvent`. Ver `lib/funil/checkoutDaJornada.ts`.
      select: { utmCampaign: true, utmContent: true, fbclid: true, workspaceId: true, checkoutAt: true },
    }),
  ]);

  // ── Pertinência de área ────────────────────────────────────────────────────
  //
  // As contas/campanhas já vêm recortadas pelo `accountWhere` (são ancoradas em
  // conta por FK). Venda, clique e IC não são: eles chegam pela atribuição, e é
  // aqui que a precedência decide de quem são.
  //
  // ⚠️ O IC saiu daqui: ele agora é uma coluna da JORNADA (`Click.checkoutAt`),
  // então a área dele é a área do próprio clique — não há mais mapa
  // `fbclid → clique` para montar, nem consulta de `PixelEvent` para fazer.
  const vendasDaArea = sales.filter((v) => mapa.areaDaVenda(v).areaId === areaAtiva);

  /**
   * ## IC do Gerenciador: sai da JORNADA, não de `PixelEvent`
   *
   * > ### 🔴 O join por `fbclid` PERDIA todo checkout de tráfego direto
   * > O código anterior era `if (!e.fbclid) continue`, seguido de uma consulta
   * > `Click where fbclid in (...)` para chegar aos UTMs. Como `fbclid` só existe
   * > para tráfego de anúncio do Facebook, **checkout de tráfego direto nunca
   * > chegava à coluna IC nem ao CPI** — e nada na tela dizia isso.
   *
   * Agora o clique JÁ traz `checkoutAt` e os UTMs na mesma linha: a atribuição é
   * direta, sem join, sem `fbclid`, e **com uma consulta a menos** ao banco.
   *
   * ⚠️ Continua sendo "uma jornada conta uma vez": a contagem é por linha de
   * `Click`, então quem clicou duas vezes no botão de compra segue valendo 1.
   *
   * ⚠️ Checkout SEM jornada (venda que não casou clique) fica de fora daqui, e
   * está certo: sem clique não há UTM, logo não há campanha a que atribuir. Ele
   * conta no funil do Dashboard, que é nível de conta. Por isso o total do
   * Gerenciador pode ser menor — mesma ressalva que já valia antes.
   */
  const icByCampaignId = new Map<string, number>();
  const icByCampaignName = new Map<string, number>();
  const icByContentId = new Map<string, number>();
  const icByContentName = new Map<string, number>();
  for (const c of cliquesNossos) {
    if (c.checkoutAt == null) continue;
    if (mapa.areaDoClique(c).areaId !== areaAtiva) continue;
    const camp = splitPipe(c.utmCampaign);
    const cont = splitPipe(c.utmContent);
    const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    if (camp.id) inc(icByCampaignId, camp.id);
    else if (camp.name) inc(icByCampaignName, camp.name.toLowerCase());
    if (cont.id) inc(icByContentId, cont.id);
    else if (cont.name) inc(icByContentName, cont.name.toLowerCase());
  }

  // Métricas por anúncio
  const metByAd = new Map<string, { spend: number; impressions: number; clicks: number }>();
  for (const m of metrics) {
    const cur = metByAd.get(m.adId) ?? { spend: 0, impressions: 0, clicks: 0 };
    cur.spend += num(m.spend);
    cur.impressions += m.impressions;
    cur.clicks += m.clicks;
    metByAd.set(m.adId, cur);
  }

  // Atribuição por campanha: preferimos o id do Facebook extraído do
  // utm_campaign (`nome|id`, Bloco 11); caímos no nome para cliques antigos.
  interface Attr { results: number; revenue: number; iniciadas: number }
  const vazio = (): Attr => ({ results: 0, revenue: 0, iniciadas: 0 });
  const resultsByCampaignId = new Map<string, Attr>();
  const resultsByName = new Map<string, Attr>();
  const iniciadasByContentId = new Map<string, number>();
  const iniciadasByContentName = new Map<string, number>();

  // ⚠️ CONTAGEM POR PEDIDO, SOMA POR LINHA. `results` e `iniciadas` são
  // conversões — o CPA e o ROAS da tabela saem delas, e contar itens derrubaria
  // o CPA pela metade num checkout com order bump. `revenue` soma todas as
  // linhas, senão o faturamento do bump sumiria da campanha que o vendeu.
  //
  // O `Set` é por CHAVE DE MAPA, não global: a mesma venda pode ser atribuída a
  // uma campanha e a um anúncio, e um conjunto único faria a segunda atribuição
  // ser descartada.
  const pedidosPorChave = new Map<string, Set<string>>();
  const primeiraVezNoDestino = (destino: string, venda: { id: string; pedidoId?: string | null }) => {
    const chave = chaveDoPedido(venda);
    let vistos = pedidosPorChave.get(destino);
    if (!vistos) pedidosPorChave.set(destino, (vistos = new Set()));
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  };

  for (const s of vendasDaArea) {
    // 🔴 É daqui que saem ROAS e CPA por campanha. Apagar o clique não pode
    // zerar a linha: a cópia responde quando a relação já não existe.
    const { utms } = utmsDaVenda(s);
    const camp = splitPipe(utms.utmCampaign);
    const cont = splitPipe(utms.utmContent);
    const aprovada = s.status === "APROVADA";
    const bump = (map: Map<string, Attr>, key: string, prefixo: string) => {
      const cur = map.get(key) ?? vazio();
      const nova = primeiraVezNoDestino(`${prefixo}:${key}`, s);
      if (nova) cur.iniciadas += 1; // conversão iniciada, em qualquer status
      if (aprovada) {
        if (nova) cur.results += 1;
        cur.revenue += num(s.value);
      }
      map.set(key, cur);
    };
    if (camp.id) bump(resultsByCampaignId, camp.id, "campId");
    else if (camp.name) bump(resultsByName, camp.name.toLowerCase(), "campNome");
    // Nível de anúncio: atribuição por utm_content.
    const incC = (m: Map<string, number>, k: string, prefixo: string) => {
      if (primeiraVezNoDestino(`${prefixo}:${k}`, s)) m.set(k, (m.get(k) ?? 0) + 1);
    };
    if (cont.id) incC(iniciadasByContentId, cont.id, "contId");
    else if (cont.name) incC(iniciadasByContentName, cont.name.toLowerCase(), "contNome");
  }

  // Cliques rastreados por nós, pelos mesmos dois caminhos de atribuição.
  const cliquesByCampaignId = new Map<string, number>();
  const cliquesByCampaignName = new Map<string, number>();
  const cliquesByContentId = new Map<string, number>();
  const cliquesByContentName = new Map<string, number>();
  // O clique tem UTM próprio: a área dele é decidida pela mesma regra da venda.
  const cliquesDaArea = cliquesNossos.filter((c) => mapa.areaDoClique(c).areaId === areaAtiva);
  for (const c of cliquesDaArea) {
    const camp = splitPipe(c.utmCampaign);
    const cont = splitPipe(c.utmContent);
    const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    if (camp.id) inc(cliquesByCampaignId, camp.id);
    else if (camp.name) inc(cliquesByCampaignName, camp.name.toLowerCase());
    if (cont.id) inc(cliquesByContentId, cont.id);
    else if (cont.name) inc(cliquesByContentName, cont.name.toLowerCase());
  }

  // Anúncios
  const adRows: AdRow[] = ads.map((a) => {
    const met = metByAd.get(a.id) ?? { spend: 0, impressions: 0, clicks: 0 };
    return {
      // Orçamento/lance não existem no nível de anúncio na Meta.
      lifetimeBudget: null,
      bidStrategy: null,
      id: a.id,
      fbId: a.fbAdId,
      name: a.name,
      status: a.status,
      effectiveStatus: a.effectiveStatus,
      accountId: a.adAccountId,
      campaignId: a.campaignId,
      campaignName: "",
      adSetId: a.adSetId,
      format: a.creative?.videoId ? "Vídeo" : "Imagem",
      thumbnailUrl: a.creative?.thumbnailUrl ?? null,
      spend: met.spend,
      impressions: met.impressions,
      clicks: met.clicks,
      results: 0,
      revenue: 0,
      // IC do anúncio vem do utm_content (`nome|id`), somando id + nome como a
      // atribuição de vendas: cada visitante cai em só um dos dois mapas.
      ic: (icByContentId.get(a.fbAdId) ?? 0) + (icByContentName.get(a.name.toLowerCase()) ?? 0),
      cliquesAtribuidos:
        (cliquesByContentId.get(a.fbAdId) ?? 0) + (cliquesByContentName.get(a.name.toLowerCase()) ?? 0),
      vendasIniciadas:
        (iniciadasByContentId.get(a.fbAdId) ?? 0) + (iniciadasByContentName.get(a.name.toLowerCase()) ?? 0),
    };
  });

  // Agrega anúncios → conjuntos e → campanhas
  const adsByAdSet = new Map<string, AdRow[]>();
  const adsByCampaign = new Map<string, AdRow[]>();
  for (const a of adRows) {
    (adsByAdSet.get(a.adSetId) ?? adsByAdSet.set(a.adSetId, []).get(a.adSetId)!).push(a);
    (adsByCampaign.get(a.campaignId) ?? adsByCampaign.set(a.campaignId, []).get(a.campaignId)!).push(a);
  }
  const sumAds = (list: AdRow[] = []) =>
    list.reduce(
      (acc, a) => ({
        spend: acc.spend + a.spend,
        impressions: acc.impressions + a.impressions,
        clicks: acc.clicks + a.clicks,
        ic: acc.ic + a.ic,
        cliquesAtribuidos: acc.cliquesAtribuidos + a.cliquesAtribuidos,
        vendasIniciadas: acc.vendasIniciadas + a.vendasIniciadas,
      }),
      { spend: 0, impressions: 0, clicks: 0, ic: 0, cliquesAtribuidos: 0, vendasIniciadas: 0 },
    );

  const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));

  const campaignRows: CampaignRow[] = campaigns.map((c) => {
    const agg = sumAds(adsByCampaign.get(c.id));
    // Soma id + nome: cada venda está em só um dos mapas (ver creatives.ts).
    const byId = resultsByCampaignId.get(c.fbCampaignId);
    const byName = resultsByName.get(c.name.toLowerCase());
    const attr = {
      results: (byId?.results ?? 0) + (byName?.results ?? 0),
      revenue: (byId?.revenue ?? 0) + (byName?.revenue ?? 0),
      iniciadas: (byId?.iniciadas ?? 0) + (byName?.iniciadas ?? 0),
    };
    return {
      id: c.id,
      fbId: c.fbCampaignId,
      name: c.name,
      status: c.status,
      effectiveStatus: c.effectiveStatus,
      accountId: c.adAccountId,
      dailyBudget: c.dailyBudget != null ? num(c.dailyBudget) : null,
      lifetimeBudget: c.lifetimeBudget != null ? num(c.lifetimeBudget) : null,
      bidStrategy: c.bidStrategy ?? null,
      spend: agg.spend,
      impressions: agg.impressions,
      clicks: agg.clicks,
      results: attr.results,
      revenue: attr.revenue,
      // Na campanha o IC vem do utm_campaign; se nada casar, cai na soma dos
      // anúncios (que atribuem por utm_content).
      ic:
        (icByCampaignId.get(c.fbCampaignId) ?? 0) + (icByCampaignName.get(c.name.toLowerCase()) ?? 0) ||
        agg.ic,
      cliquesAtribuidos:
        (cliquesByCampaignId.get(c.fbCampaignId) ?? 0) +
          (cliquesByCampaignName.get(c.name.toLowerCase()) ?? 0) || agg.cliquesAtribuidos,
      vendasIniciadas: attr.iniciadas || agg.vendasIniciadas,
    };
  });

  const adSetRows: AdSetRow[] = adSets.map((a) => {
    const agg = sumAds(adRows.filter((ad) => ad.adSetId === a.id));
    return {
      id: a.id,
      fbId: a.fbAdSetId,
      name: a.name,
      status: a.status,
      effectiveStatus: a.effectiveStatus,
      accountId: a.adAccountId,
      campaignId: a.campaignId,
      campaignName: campaignNameById.get(a.campaignId) ?? "",
      dailyBudget: a.dailyBudget != null ? num(a.dailyBudget) : null,
      lifetimeBudget: a.lifetimeBudget != null ? num(a.lifetimeBudget) : null,
      bidAmount: a.bidAmount != null ? num(a.bidAmount) : null,
      bidStrategy: null,
      spend: agg.spend,
      impressions: agg.impressions,
      clicks: agg.clicks,
      results: 0,
      revenue: 0,
      // Conjunto não tem UTM próprio: soma o dos anúncios dele.
      ic: agg.ic,
      cliquesAtribuidos: agg.cliquesAtribuidos,
      vendasIniciadas: agg.vendasIniciadas,
    };
  });

  for (const a of adRows) a.campaignName = campaignNameById.get(a.campaignId) ?? "";

  // Contas (totais agregados)
  const accountRows: AccountRow[] = accounts.map((ac) => {
    const camps = campaignRows.filter((c) => c.accountId === ac.id);
    return {
      id: ac.id,
      fbAccountId: ac.fbAccountId,
      name: ac.name,
      currency: ac.currency,
      tracking: ac.trackingEnabled,
      campaigns: camps.length,
      spend: camps.reduce((s, c) => s + c.spend, 0),
      revenue: camps.reduce((s, c) => s + c.revenue, 0),
    };
  });

  // Filtros de status + busca (contas sempre completas)
  const search = filters.search.trim().toLowerCase();
  // ⚠️ O filtro de STATUS é do CLIENTE, não daqui.
  //
  // O painel manda só `period` e `account` na querystring — status e busca são
  // aplicados no navegador para trocar de filtro não custar um round-trip. Ou
  // seja: `filters.status` chega SEMPRE como o padrão "todos".
  //
  // Enquanto "todos" significava "tudo", filtrar aqui era inofensivo. Quando
  // "todos" passou a excluir arquivados, este filtro virou uma peneira que
  // descartava as 12 campanhas arquivadas ANTES de saírem do servidor — e a
  // opção "Arquivados" da tela passou a filtrar uma lista já vazia.
  //
  // O servidor manda tudo; quem decide o que aparece é `lib/ads/status.ts` no
  // cliente. Se um dia o status voltar a ser filtrado aqui, ele PRECISA vir na
  // querystring junto.
  const byFilters = <T extends { name: string; status: string }>(rows: T[]) =>
    rows.filter((r) => !search || r.name.toLowerCase().includes(search));

  return {
    campaigns: byFilters(campaignRows),
    adSets: byFilters(adSetRows),
    ads: byFilters(adRows),
    accounts: accountRows,
  };
}
