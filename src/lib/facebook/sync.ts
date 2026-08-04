import { getUserTimezone } from "@/lib/userTimezone";
import { GRAPH_URL, getAdAccounts, mapAccountStatus } from "@/lib/facebook/graph";
import { prisma } from "@/lib/prisma";
import { addDaysToKey, todayKey } from "@/lib/timezone";
import { Prisma } from "@/generated/prisma/client";
import type { EntityStatus } from "@/generated/prisma/enums";

// ─────────────────── Helpers de Graph API ───────────────────

interface Paged<T> {
  data?: T[];
  paging?: { next?: string };
  error?: { message: string };
}

/** GET paginado: segue `paging.next` até o fim. */
async function graphAll<T>(path: string, params: Record<string, string>, accessToken: string): Promise<T[]> {
  const out: T[] = [];
  let url: string | null =
    `${GRAPH_URL}${path}?` + new URLSearchParams({ ...params, limit: "200", access_token: accessToken }).toString();
  while (url) {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as Paged<T>;
    if (!res.ok || json.error) throw new Error(json.error?.message || `Graph API ${res.status} em ${path}`);
    if (json.data) out.push(...json.data);
    url = json.paging?.next ?? null;
  }
  return out;
}

/**
 * Status que a sincronização traz da Meta.
 *
 * ⚠️ **As arestas `/campaigns`, `/adsets` e `/ads` excluem ARQUIVADOS por
 * padrão.** Sem este filtro elas devolviam `0` numa conta que tinha 7 campanhas
 * arquivadas — enquanto `/insights` continuava reportando R$ 114,34 de gasto
 * daquelas mesmas campanhas. Resultado: nenhum `Ad` local, o `adIdMap` vazio, e
 * TODA linha de insight caindo no `continue` por não achar o anúncio. O sync
 * dizia `metrics: 0, errors: 0` e o gerenciador ficava zerado.
 *
 * `DELETED` não entra: a Meta não devolve objetos excluídos nestas arestas de
 * jeito nenhum. O gasto histórico deles é contabilizado como `metricasOrfas`
 * (ver `SyncSummary`) em vez de sumir em silêncio.
 */
const STATUS_SINCRONIZADOS = JSON.stringify([
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
  "ADSET_PAUSED",
  "CAMPAIGN_PAUSED",
  "DISAPPROVED",
  "PENDING_REVIEW",
  "IN_PROCESS",
  "WITH_ISSUES",
]);

/**
 * `effective_status` era usado só como PARÂMETRO DE FILTRO (acima) e nunca
 * pedido como CAMPO — então o valor não era guardado em lugar nenhum.
 *
 * Guardamos a string crua. Ver o comentário de `Campaign.effectiveStatus` no
 * schema: enum faria o sync FALHAR num valor novo da Meta, e a tradução para
 * linguagem simples vive em `lib/ads/veiculacao.ts`.
 */
function efetivo(s?: string): string | null {
  const v = s?.trim();
  return v ? v : null;
}

function mapStatus(s?: string): EntityStatus {
  switch (s) {
    case "ACTIVE":
      return "ACTIVE";
    case "PAUSED":
      return "PAUSED";
    case "ARCHIVED":
      return "ARCHIVED";
    case "DELETED":
      return "DELETED";
    default:
      return "UNKNOWN";
  }
}

/** Orçamentos vêm em unidades menores (centavos) como string. */
function budget(v?: string): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n / 100 : null;
}

function toDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─────────────────── Tipos da Graph API ───────────────────

interface FbCampaign {
  id: string;
  name: string;
  status?: string;
  /** Se está REALMENTE veiculando. Ver `lib/ads/veiculacao.ts`. */
  effective_status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  start_time?: string;
  stop_time?: string;
}
interface FbAdSet {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  bid_amount?: string;
  campaign_id?: string;
  targeting?: { geo_locations?: FbGeoLocations };
}

/**
 * `targeting.geo_locations` da Meta.
 *
 * ⚠️ **Não basta ler `countries`.** Campanha segmentada por cidade ou por
 * região não preenche `countries` — o país vem DENTRO de cada item. Ler só
 * `countries` faria toda campanha segmentada por cidade parecer mundial, que é
 * exatamente o caso em que o desempate mais importa (anúncio local).
 */
interface FbGeoLocations {
  countries?: string[];
  country_groups?: string[];
  regions?: { country?: string }[];
  cities?: { country?: string }[];
  geo_markets?: { country?: string }[];
  zips?: { country?: string }[];
  places?: { country?: string }[];
}

/** Todos os países citados numa segmentação, venham de onde vierem. */
function paisesDaSegmentacao(geo: FbGeoLocations | undefined): string[] {
  if (!geo) return [];
  const out = new Set<string>();
  for (const c of geo.countries ?? []) if (c) out.add(c.toUpperCase());
  for (const chave of ["regions", "cities", "geo_markets", "zips", "places"] as const) {
    for (const item of geo[chave] ?? []) if (item?.country) out.add(item.country.toUpperCase());
  }
  // ⚠️ `country_groups` (ex.: "worldwide", "europe") NÃO é expandido de
  // propósito: expandir "europe" para 44 países tornaria a interseção tão larga
  // que nunca sobraria um país só — desempate que nunca dispara é pior que
  // desempate ausente, porque parece que está funcionando.
  return [...out];
}
interface FbCreative {
  id?: string;
  name?: string;
  title?: string;
  body?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  call_to_action_type?: string;
  object_story_spec?: { link_data?: { message?: string; name?: string; link?: string; call_to_action?: { type?: string } } };
}
interface FbAd {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  campaign_id?: string;
  adset_id?: string;
  creative?: FbCreative;
}
interface FbInsight {
  ad_id?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  reach?: string;
  frequency?: string;
  date_start?: string;
}

/**
 * Zera o erro da conta apos uma sincronizacao bem-sucedida.
 *
 * ⚠️ Nunca lanca: marcar o estado nao pode derrubar uma sincronizacao que deu
 * certo. Mesma regra do `logWebhook`.
 */
async function marcarSucesso(adAccountId: string): Promise<void> {
  try {
    // `updateMany` com o contador no `where`: sem isso, TODA conta que
    // sincroniza com sucesso faria um UPDATE por ciclo, a cada 20s, para
    // reescrever os mesmos zeros.
    await prisma.adAccount.updateMany({
      where: { id: adAccountId, OR: [{ syncErrorCount: { gt: 0 } }, { lastSyncError: { not: null } }] },
      data: { lastSyncError: null, lastSyncErrorAt: null, syncErrorCount: 0 },
    });
  } catch {
    // silencioso de proposito — ver o aviso acima
  }
}

/** Guarda o erro na conta e conta as falhas consecutivas. */
async function registrarErro(adAccountId: string, mensagem: string): Promise<void> {
  try {
    await prisma.adAccount.update({
      where: { id: adAccountId },
      data: {
        // Texto CRU. A traducao vive em `lib/facebook/erroMeta.ts`, e a lista
        // dela e incompleta por natureza — apagar o original tornaria o erro
        // real irrecuperavel.
        lastSyncError: mensagem.slice(0, 500),
        lastSyncErrorAt: new Date(),
        syncErrorCount: { increment: 1 },
      },
    });
  } catch {
    // idem
  }
}

export interface SyncSummary {
  accounts: number;
  campaigns: number;
  adSets: number;
  ads: number;
  metrics: number;
  /** Entidades apagadas localmente por não existirem mais no Facebook. */
  removidos?: number;
  /** Contas de anúncio detectadas agora, que ainda não existiam no banco. */
  contasNovas?: number;
  /**
   * Linhas de insight cujo `ad_id` não existe localmente — quase sempre gasto de
   * anúncio EXCLUÍDO na Meta, que não vem em `/ads` de forma alguma. Fica
   * explícito no retorno porque antes esse gasto era descartado num `continue`
   * silencioso e o cron reportava `errors: 0`.
   */
  metricasOrfas?: number;
  errors: string[];
}

// ─────────────────── Sincronização ───────────────────

/** Sincroniza uma conta de anúncio: estrutura + criativos + métricas diárias. */
async function syncAccount(
  account: { id: string; userId: string; fbAccountId: string },
  accessToken: string,
  summary: SyncSummary,
  days: number,
) {
  const act = `/act_${account.fbAccountId}`;

  // 1. Campanhas
  const campaigns = await graphAll<FbCampaign>(
    `${act}/campaigns`,
    {
      // ⚠️ `effective_status` aparece DUAS vezes e com papéis diferentes: em
      // `fields` é o campo que queremos LER; embaixo é o FILTRO de quais
      // objetos trazer. Ele estava só no filtro — por isso o valor nunca era
      // guardado.
      fields:
        "id,name,status,effective_status,objective,daily_budget,lifetime_budget,bid_strategy,start_time,stop_time",
      effective_status: STATUS_SINCRONIZADOS,
    },
    accessToken,
  );
  const campaignIdMap = new Map<string, string>(); // fbCampaignId → interno
  for (const c of campaigns) {
    const row = await prisma.campaign.upsert({
      where: { adAccountId_fbCampaignId: { adAccountId: account.id, fbCampaignId: c.id } },
      update: {
        name: c.name,
        status: mapStatus(c.status),
        effectiveStatus: efetivo(c.effective_status),
        objective: c.objective ?? null,
        dailyBudget: budget(c.daily_budget),
        lifetimeBudget: budget(c.lifetime_budget),
        bidStrategy: c.bid_strategy ?? null,
        startTime: toDate(c.start_time),
        stopTime: toDate(c.stop_time),
      },
      create: {
        adAccountId: account.id,
        fbCampaignId: c.id,
        name: c.name,
        status: mapStatus(c.status),
        effectiveStatus: efetivo(c.effective_status),
        objective: c.objective ?? null,
        dailyBudget: budget(c.daily_budget),
        lifetimeBudget: budget(c.lifetime_budget),
        bidStrategy: c.bid_strategy ?? null,
        startTime: toDate(c.start_time),
        stopTime: toDate(c.stop_time),
      },
      select: { id: true },
    });
    campaignIdMap.set(c.id, row.id);
    summary.campaigns++;
  }

  // 2. Conjuntos
  const adSets = await graphAll<FbAdSet>(
    `${act}/adsets`,
    {
      // `targeting{geo_locations}` é CAMPO NUMA CHAMADA QUE JÁ ACONTECE — custo
      // zero de rate limit. Consultar sob demanda seria uma requisição por
      // clique, dentro de uma rota que hoje só escreve no banco.
      fields:
        "id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,bid_amount,campaign_id,targeting{geo_locations}",
      effective_status: STATUS_SINCRONIZADOS,
    },
    accessToken,
  );
  const adSetIdMap = new Map<string, string>();
  for (const a of adSets) {
    const campaignId = a.campaign_id ? campaignIdMap.get(a.campaign_id) : undefined;
    if (!campaignId) continue; // conjunto sem campanha conhecida
    const row = await prisma.adSet.upsert({
      where: { adAccountId_fbAdSetId: { adAccountId: account.id, fbAdSetId: a.id } },
      update: {
        name: a.name,
        status: mapStatus(a.status),
        effectiveStatus: efetivo(a.effective_status),
        dailyBudget: budget(a.daily_budget),
        lifetimeBudget: budget(a.lifetime_budget),
        optimizationGoal: a.optimization_goal ?? null,
        bidAmount: budget(a.bid_amount),
        geoCountries: paisesDaSegmentacao(a.targeting?.geo_locations),
        campaignId,
      },
      create: {
        adAccountId: account.id,
        fbAdSetId: a.id,
        name: a.name,
        status: mapStatus(a.status),
        effectiveStatus: efetivo(a.effective_status),
        dailyBudget: budget(a.daily_budget),
        lifetimeBudget: budget(a.lifetime_budget),
        optimizationGoal: a.optimization_goal ?? null,
        bidAmount: budget(a.bid_amount),
        geoCountries: paisesDaSegmentacao(a.targeting?.geo_locations),
        campaignId,
      },
      select: { id: true },
    });
    adSetIdMap.set(a.id, row.id);
    summary.adSets++;
  }

  // 3. Anúncios + criativos
  const ads = await graphAll<FbAd>(
    `${act}/ads`,
    {
      fields:
        "id,name,status,effective_status,campaign_id,adset_id,creative{id,name,title,body,thumbnail_url,image_url,video_id,call_to_action_type,object_story_spec}",
      effective_status: STATUS_SINCRONIZADOS,
    },
    accessToken,
  );
  const adIdMap = new Map<string, string>();
  for (const ad of ads) {
    const campaignId = ad.campaign_id ? campaignIdMap.get(ad.campaign_id) : undefined;
    const adSetId = ad.adset_id ? adSetIdMap.get(ad.adset_id) : undefined;
    if (!campaignId || !adSetId) continue;

    const row = await prisma.ad.upsert({
      where: { adAccountId_fbAdId: { adAccountId: account.id, fbAdId: ad.id } },
      update: {
        name: ad.name,
        status: mapStatus(ad.status),
        effectiveStatus: efetivo(ad.effective_status),
        campaignId,
        adSetId,
      },
      create: {
        adAccountId: account.id,
        fbAdId: ad.id,
        name: ad.name,
        status: mapStatus(ad.status),
        effectiveStatus: efetivo(ad.effective_status),
        campaignId,
        adSetId,
      },
      select: { id: true },
    });
    adIdMap.set(ad.id, row.id);
    summary.ads++;

    // Criativo (1:1 com o anúncio)
    const cr = ad.creative;
    if (cr) {
      const link = cr.object_story_spec?.link_data;
      const creativeData = {
        fbCreativeId: cr.id ?? null,
        name: cr.name ?? null,
        title: cr.title ?? link?.name ?? null,
        body: cr.body ?? link?.message ?? null,
        thumbnailUrl: cr.thumbnail_url ?? null,
        imageUrl: cr.image_url ?? null,
        videoId: cr.video_id ?? null,
        callToAction: cr.call_to_action_type ?? link?.call_to_action?.type ?? null,
        linkUrl: link?.link ?? null,
      };
      await prisma.creative.upsert({
        where: { adId: row.id },
        update: creativeData,
        create: { adId: row.id, ...creativeData },
      });
    }
  }

  // 3.5 Poda: o que sumiu do Facebook tem que sumir daqui.
  //
  // Era o bug de "excluí no Facebook e continua aparecendo": o sync só fazia
  // upsert do que a Graph API devolvia e **nunca removia** o que deixou de vir.
  // Uma campanha excluída/arquivada some da listagem da Meta, então a ausência
  // é justamente o sinal.
  //
  // A poda é feita por CONTA e só quando a Graph respondeu — se `campaigns`
  // viesse vazio por erro de rede, apagaríamos tudo. Como `graphAll` lança em
  // falha, chegar aqui significa que a resposta é confiável.
  await podar(account.id, campaigns.map((c) => c.id), adSets.map((a) => a.id), ads.map((a) => a.id), summary);

  // 4. Métricas diárias por anúncio.
  //
  // `time_range` explícito em vez de `date_preset`: os presets da Meta
  // (`last_7d`/`last_30d`) são ancorados no fuso da CONTA e, na prática, não
  // trazem o dia corrente de forma confiável — era por isso que um gasto feito
  // hoje aparecia como R$ 0,00 na ferramenta. Com `since`/`until` até hoje, o
  // dia parcial vem junto.
  //
  // As pontas saem do fuso do USUÁRIO, não do processo: rodando na Vercel (UTC),
  // a partir das 21h de Brasília o `until` já apontava para o dia seguinte e o
  // `since` pulava o dia mais antigo — a janela inteira andava um dia.
  const tz = await getUserTimezone(account.userId);
  const hoje = todayKey(tz);
  const desde = addDaysToKey(hoje, -days);

  const insights = await graphAll<FbInsight>(
    `${act}/insights`,
    {
      level: "ad",
      fields: "ad_id,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency",
      time_increment: "1",
      time_range: JSON.stringify({ since: desde, until: hoje }),
      // Sem isto a Meta omite linhas de dias com entrega mas gasto ainda não
      // consolidado, o que abre buracos na série.
      action_report_time: "impression",
    },
    accessToken,
  );
  const linhas: LinhaDeMetrica[] = [];
  for (const ins of insights) {
    const adId = ins.ad_id ? adIdMap.get(ins.ad_id) : undefined;
    if (!adId || !ins.date_start) {
      summary.metricasOrfas = (summary.metricasOrfas ?? 0) + 1;
      continue;
    }
    linhas.push({
      adId,
      // ⚠️ A data segue como STRING `YYYY-MM-DD`, do jeito que a Meta manda.
      // `new Date(ins.date_start)` transformava o dia num instante, que é a
      // origem clássica de bug de fuso neste projeto. O `::date` do SQL recebe
      // a string direto e não há instante nenhum no caminho.
      dia: ins.date_start,
      spend: Number(ins.spend ?? 0),
      impressions: parseInt(ins.impressions ?? "0", 10),
      clicks: parseInt(ins.clicks ?? "0", 10),
      ctr: Number(ins.ctr ?? 0),
      cpc: Number(ins.cpc ?? 0),
      cpm: Number(ins.cpm ?? 0),
      reach: parseInt(ins.reach ?? "0", 10),
      frequency: Number(ins.frequency ?? 0),
    });
  }
  summary.metrics += await gravarMetricas(linhas);
}

/**
 * Só as MÉTRICAS de uma conta — **1 chamada à Graph**, contra 4 do sync cheio.
 *
 * É o que torna a atualização quase em tempo real viável. O ciclo completo lê
 * campanhas + conjuntos + anúncios + insights; estrutura muda raramente (criar
 * campanha é ato humano), enquanto o **gasto muda o tempo todo**. Repetir as 4
 * chamadas a cada poucos segundos só para ver o gasto subir estouraria o rate
 * limit da Meta sem entregar nada a mais.
 *
 * Aqui o mapa `fbAdId → id interno` sai do BANCO em vez da Graph. A consequência
 * é que **anúncio criado depois do último ciclo completo não recebe métrica
 * ainda** — ele entra no ciclo seguinte. É o trade-off aceito: gasto fresco a
 * cada poucos segundos, estrutura nova em poucos minutos.
 */
export async function syncAccountMetrics(
  account: { id: string; userId: string; fbAccountId: string },
  accessToken: string,
  summary: SyncSummary,
  days: number,
) {
  const ads = await prisma.ad.findMany({
    where: { adAccountId: account.id },
    select: { id: true, fbAdId: true },
  });
  if (ads.length === 0) return; // nada mapeado ainda: espera o ciclo completo
  const adIdMap = new Map(ads.map((a) => [a.fbAdId, a.id]));

  const tz = await getUserTimezone(account.userId);
  const hoje = todayKey(tz);
  const desde = addDaysToKey(hoje, -days);

  const insights = await graphAll<FbInsight>(
    `/act_${account.fbAccountId}/insights`,
    {
      level: "ad",
      fields: "ad_id,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency",
      time_increment: "1",
      time_range: JSON.stringify({ since: desde, until: hoje }),
      action_report_time: "impression",
    },
    accessToken,
  );

  const linhas: LinhaDeMetrica[] = [];
  for (const ins of insights) {
    const adId = ins.ad_id ? adIdMap.get(ins.ad_id) : undefined;
    if (!adId || !ins.date_start) {
      summary.metricasOrfas = (summary.metricasOrfas ?? 0) + 1;
      continue;
    }
    linhas.push({
      adId,
      // ⚠️ A data segue como STRING `YYYY-MM-DD`, do jeito que a Meta manda.
      // `new Date(ins.date_start)` transformava o dia num instante, que é a
      // origem clássica de bug de fuso neste projeto. O `::date` do SQL recebe
      // a string direto e não há instante nenhum no caminho.
      dia: ins.date_start,
      spend: Number(ins.spend ?? 0),
      impressions: parseInt(ins.impressions ?? "0", 10),
      clicks: parseInt(ins.clicks ?? "0", 10),
      ctr: Number(ins.ctr ?? 0),
      cpc: Number(ins.cpc ?? 0),
      cpm: Number(ins.cpm ?? 0),
      reach: parseInt(ins.reach ?? "0", 10),
      frequency: Number(ins.frequency ?? 0),
    });
  }
  summary.metrics += await gravarMetricas(linhas);
}

/** Atualiza só as métricas de todas as contas rastreadas de um usuário. */
export async function syncUserMetrics(userId: string, days = 2): Promise<SyncSummary> {
  const summary: SyncSummary = { accounts: 0, campaigns: 0, adSets: 0, ads: 0, metrics: 0, errors: [] };
  const accounts = await prisma.adAccount.findMany({
    where: { userId, trackingEnabled: true, adProfile: { isNot: null } },
    select: { id: true, userId: true, fbAccountId: true, name: true, adProfile: { select: { accessToken: true } } },
  });
  for (const acc of accounts) {
    const token = acc.adProfile?.accessToken;
    if (!token) continue;
    try {
      await syncAccountMetrics({ id: acc.id, userId: acc.userId, fbAccountId: acc.fbAccountId }, token, summary, days);
      summary.accounts++;
      await marcarSucesso(acc.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push(`${acc.name}: ${msg}`);
      // 🔴 O erro passa a FICAR na conta. Antes ele so existia dentro de
      // `summary.errors`, que a tela descartava — e uma conta sem permissao
      // falhava a cada 20s para sempre sem nada aparecer.
      await registrarErro(acc.id, msg);
    }
  }
  return summary;
}

export interface LinhaDeMetrica {
  adId: string;
  /** Dia de calendário como `YYYY-MM-DD`, exatamente como a Meta manda. */
  dia: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  frequency: number;
}

/** Máximo de linhas por instrução. Ver a nota sobre o teto de parâmetros. */
const LOTE_METRICAS = 500;

/**
 * Grava as métricas do período em LOTE.
 *
 * ## 🔴 O que isto substitui
 *
 * Era um `prisma.dailyAdMetric.upsert()` **por linha de insight**, dentro do
 * laço — nos DOIS caminhos de sincronização (o completo e o só-métricas). Uma
 * conta com 48 anúncios × 2 dias são **96 idas ao Supabase em série**: a ~99 ms
 * de latência, ~9,5 s só de rede, dentro de um `after()` com `maxDuration`.
 *
 * Contas grandes estouravam o tempo, a função morria, a reserva do `autoSync`
 * ficava presa até expirar (10 min) e **a métrica nunca era gravada**; contas
 * pequenas passavam. É exatamente o padrão observado em produção em 04/08/2026:
 * as contas de 48 e 28 anúncios sem métrica nenhuma, a de 4 anúncios normal.
 *
 * Agora é **uma instrução por lote de 500 linhas**.
 *
 * ## ⛔ `createMany({ skipDuplicates: true })` NÃO serve aqui
 *
 * Ele pula a linha que já existe — e a linha de HOJE sempre existe, porque o
 * gasto do dia corrente é reescrito a cada ciclo enquanto a campanha entrega.
 * O gasto congelaria no primeiro valor do dia, e o número continuaria
 * plausível. É preciso `ON CONFLICT DO UPDATE`: upsert de verdade.
 *
 * ## ⚠️ As duas colunas que o Prisma preenche e o SQL cru não
 *
 * | Coluna | Por que quebraria |
 * |---|---|
 * | `id` | `@default(cuid())` é gerado na APLICAÇÃO. No banco a coluna é `NOT NULL` **sem default** — um INSERT cru violaria a restrição |
 * | `updatedAt` | `@updatedAt` também é do cliente. Sem preencher à mão, o INSERT viola `NOT NULL` e o UPDATE deixaria o valor velho |
 *
 * `timezone('UTC', now())` e não `now()` seco: a coluna é `timestamp WITHOUT
 * time zone` guardando UTC, e `now()` seria convertido pelo fuso da SESSÃO.
 *
 * ⚠️ O lote existe pelo teto de **65535 parâmetros** do Postgres. São 10
 * parâmetros por linha, o que dá um limite real perto de 6500; 500 é folgado.
 */
export async function gravarMetricas(linhas: LinhaDeMetrica[]): Promise<number> {
  if (linhas.length === 0) return 0;

  let gravadas = 0;
  for (let i = 0; i < linhas.length; i += LOTE_METRICAS) {
    const parte = linhas.slice(i, i + LOTE_METRICAS);
    const values = parte.map(
      (m) => Prisma.sql`(
        gen_random_uuid()::text, ${m.adId}, ${m.dia}::date,
        ${m.spend}::numeric, ${m.impressions}::int, ${m.clicks}::int,
        ${m.ctr}::double precision, ${m.cpc}::numeric, ${m.cpm}::numeric,
        ${m.reach}::int, ${m.frequency}::double precision,
        timezone('UTC', now()), timezone('UTC', now())
      )`,
    );

    // `$executeRaw` devolve as linhas AFETADAS, que com `ON CONFLICT DO UPDATE`
    // inclui inserção e atualização — que é o que `summary.metrics` sempre
    // significou ("linhas de DailyAdMetric gravadas").
    gravadas += await prisma.$executeRaw`
      INSERT INTO "DailyAdMetric"
        ("id", "adId", "date", "spend", "impressions", "clicks", "ctr", "cpc", "cpm",
         "reach", "frequency", "createdAt", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("adId", "date") DO UPDATE SET
        "spend"       = EXCLUDED."spend",
        "impressions" = EXCLUDED."impressions",
        "clicks"      = EXCLUDED."clicks",
        "ctr"         = EXCLUDED."ctr",
        "cpc"         = EXCLUDED."cpc",
        "cpm"         = EXCLUDED."cpm",
        "reach"       = EXCLUDED."reach",
        "frequency"   = EXCLUDED."frequency",
        "updatedAt"   = timezone('UTC', now())
    `;
  }
  return gravadas;
}

/**
 * Remove da base local o que não veio mais na resposta do Facebook.
 * A ordem importa: anúncios → conjuntos → campanhas, para não esbarrar em FK.
 */
async function podar(
  adAccountId: string,
  fbCampaignIds: string[],
  fbAdSetIds: string[],
  fbAdIds: string[],
  summary: SyncSummary,
) {
  const [ads, adSets, campaigns] = await Promise.all([
    prisma.ad.deleteMany({ where: { adAccountId, fbAdId: { notIn: fbAdIds } } }),
    prisma.adSet.deleteMany({ where: { adAccountId, fbAdSetId: { notIn: fbAdSetIds } } }),
    prisma.campaign.deleteMany({ where: { adAccountId, fbCampaignId: { notIn: fbCampaignIds } } }),
  ]);
  summary.removidos = (summary.removidos ?? 0) + ads.count + adSets.count + campaigns.count;
}

/** Sincroniza uma única conta de anúncio pelo id interno. */
export async function syncSingleAccount(userId: string, accountId: string, days = 30): Promise<SyncSummary> {
  const summary: SyncSummary = { accounts: 0, campaigns: 0, adSets: 0, ads: 0, metrics: 0, errors: [] };
  const acc = await prisma.adAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true, userId: true, fbAccountId: true, name: true, adProfile: { select: { accessToken: true } } },
  });
  if (!acc) {
    summary.errors.push("Conta não encontrada.");
    return summary;
  }
  const token = acc.adProfile?.accessToken;
  if (!token) {
    summary.errors.push("Perfil sem token do Facebook.");
    return summary;
  }
  try {
    await syncAccount({ id: acc.id, userId: acc.userId, fbAccountId: acc.fbAccountId }, token, summary, days);
    summary.accounts++;
  } catch (e) {
    summary.errors.push(`${acc.name}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return summary;
}

/**
 * Redescobre as contas de anúncio de cada perfil conectado.
 *
 * **Por que existe:** o `syncUser` só iterava as `AdAccount` que já estavam no
 * banco, e a única coisa que já chamou `/me/adaccounts` era o callback do OAuth.
 * Resultado: uma conta criada na BM depois da conexão **nunca aparecia** — a
 * saída era desconectar e reconectar o perfil, que é o que o usuário vinha
 * fazendo. Agora toda sincronização reconsulta a lista.
 *
 * O `upsert` por `userId_fbAccountId` também atualiza nome, moeda e status das
 * contas que já existiam, então renomear uma conta na BM passa a refletir aqui.
 *
 * Conta nova entra com `trackingEnabled: true` — é o mesmo padrão do callback,
 * e uma conta que aparece desligada por padrão pareceria "não detectada".
 * Contas que somem da resposta **não são apagadas**: perda de permissão é
 * temporária com frequência, e apagar levaria junto o histórico de métricas.
 */
export async function descobrirContas(userId: string, summary: SyncSummary): Promise<number> {
  const perfis = await prisma.adProfile.findMany({
    where: { userId },
    select: { id: true, name: true, accessToken: true },
  });

  let novas = 0;
  for (const p of perfis) {
    if (!p.accessToken) continue;
    try {
      const contas = await getAdAccounts(p.accessToken);
      for (const a of contas) {
        const existente = await prisma.adAccount.findUnique({
          where: { userId_fbAccountId: { userId, fbAccountId: a.account_id } },
          select: { id: true },
        });
        await prisma.adAccount.upsert({
          where: { userId_fbAccountId: { userId, fbAccountId: a.account_id } },
          update: {
            name: a.name,
            currency: a.currency,
            timezone: a.timezone_name ?? null,
            status: mapAccountStatus(a.account_status),
            // Codigo CRU da Meta, ao lado do enum reduzido. E ele que diz
            // DESABILITADA vs PAUSADA -- o enum colapsa os dois.
            accountStatus: a.account_status ?? null,
            adProfileId: p.id,
          },
          create: {
            userId,
            fbAccountId: a.account_id,
            name: a.name,
            currency: a.currency,
            timezone: a.timezone_name ?? null,
            status: mapAccountStatus(a.account_status),
            // Codigo CRU da Meta, ao lado do enum reduzido. E ele que diz
            // DESABILITADA vs PAUSADA -- o enum colapsa os dois.
            accountStatus: a.account_status ?? null,
            adProfileId: p.id,
            trackingEnabled: true,
          },
        });
        if (!existente) novas++;
      }
    } catch (e) {
      // Falhar a descoberta não pode impedir a sincronização das contas que já
      // existem — token de UM perfil expirado não derruba os outros.
      summary.errors.push(`Contas de ${p.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return novas;
}

/** Sincroniza todas as contas rastreadas de um usuário. */
export async function syncUser(userId: string, days = 30): Promise<SyncSummary> {
  const summary: SyncSummary = { accounts: 0, campaigns: 0, adSets: 0, ads: 0, metrics: 0, errors: [] };

  // Antes de sincronizar, descobre contas novas — senão uma conta criada hoje
  // na BM só entraria no próximo reconectar.
  summary.contasNovas = await descobrirContas(userId, summary);

  const accounts = await prisma.adAccount.findMany({
    where: { userId, trackingEnabled: true, adProfile: { isNot: null } },
    select: { id: true, userId: true, fbAccountId: true, name: true, adProfile: { select: { accessToken: true } } },
  });

  for (const acc of accounts) {
    const token = acc.adProfile?.accessToken;
    if (!token) continue;
    try {
      await syncAccount({ id: acc.id, userId: acc.userId, fbAccountId: acc.fbAccountId }, token, summary, days);
      summary.accounts++;
    } catch (e) {
      summary.errors.push(`${acc.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return summary;
}
