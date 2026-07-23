import { GRAPH_URL } from "@/lib/facebook/graph";
import { prisma } from "@/lib/prisma";
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
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}
interface FbAdSet {
  id: string;
  name: string;
  status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  campaign_id?: string;
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

export interface SyncSummary {
  accounts: number;
  campaigns: number;
  adSets: number;
  ads: number;
  metrics: number;
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
    { fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time" },
    accessToken,
  );
  const campaignIdMap = new Map<string, string>(); // fbCampaignId → interno
  for (const c of campaigns) {
    const row = await prisma.campaign.upsert({
      where: { adAccountId_fbCampaignId: { adAccountId: account.id, fbCampaignId: c.id } },
      update: {
        name: c.name,
        status: mapStatus(c.status),
        objective: c.objective ?? null,
        dailyBudget: budget(c.daily_budget),
        lifetimeBudget: budget(c.lifetime_budget),
        startTime: toDate(c.start_time),
        stopTime: toDate(c.stop_time),
      },
      create: {
        adAccountId: account.id,
        fbCampaignId: c.id,
        name: c.name,
        status: mapStatus(c.status),
        objective: c.objective ?? null,
        dailyBudget: budget(c.daily_budget),
        lifetimeBudget: budget(c.lifetime_budget),
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
    { fields: "id,name,status,daily_budget,lifetime_budget,optimization_goal,campaign_id" },
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
        dailyBudget: budget(a.daily_budget),
        lifetimeBudget: budget(a.lifetime_budget),
        optimizationGoal: a.optimization_goal ?? null,
        campaignId,
      },
      create: {
        adAccountId: account.id,
        fbAdSetId: a.id,
        name: a.name,
        status: mapStatus(a.status),
        dailyBudget: budget(a.daily_budget),
        lifetimeBudget: budget(a.lifetime_budget),
        optimizationGoal: a.optimization_goal ?? null,
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
        "id,name,status,campaign_id,adset_id,creative{id,name,title,body,thumbnail_url,image_url,video_id,call_to_action_type,object_story_spec}",
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
      update: { name: ad.name, status: mapStatus(ad.status), campaignId, adSetId },
      create: { adAccountId: account.id, fbAdId: ad.id, name: ad.name, status: mapStatus(ad.status), campaignId, adSetId },
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

  // 4. Métricas diárias por anúncio (últimos N dias)
  const insights = await graphAll<FbInsight>(
    `${act}/insights`,
    {
      level: "ad",
      fields: "ad_id,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency",
      time_increment: "1",
      date_preset: days > 7 ? "last_30d" : "last_7d",
    },
    accessToken,
  );
  for (const ins of insights) {
    const adId = ins.ad_id ? adIdMap.get(ins.ad_id) : undefined;
    if (!adId || !ins.date_start) continue;
    const date = new Date(ins.date_start);
    const metric = {
      spend: Number(ins.spend ?? 0),
      impressions: parseInt(ins.impressions ?? "0", 10),
      clicks: parseInt(ins.clicks ?? "0", 10),
      ctr: Number(ins.ctr ?? 0),
      cpc: Number(ins.cpc ?? 0),
      cpm: Number(ins.cpm ?? 0),
      reach: parseInt(ins.reach ?? "0", 10),
      frequency: Number(ins.frequency ?? 0),
    };
    await prisma.dailyAdMetric.upsert({
      where: { adId_date: { adId, date } },
      update: metric,
      create: { adId, date, ...metric },
    });
    summary.metrics++;
  }
}

/** Sincroniza todas as contas rastreadas de um usuário. */
export async function syncUser(userId: string, days = 30): Promise<SyncSummary> {
  const summary: SyncSummary = { accounts: 0, campaigns: 0, adSets: 0, ads: 0, metrics: 0, errors: [] };

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
