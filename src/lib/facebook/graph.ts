import { getAppUrl } from "@/lib/appUrl";

export const GRAPH_VERSION = "v21.0";
export const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function fbAppId(): string {
  const id = process.env.FACEBOOK_APP_ID;
  if (!id) throw new Error("FACEBOOK_APP_ID não configurado.");
  return id;
}

export function fbAppSecret(): string {
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!secret) throw new Error("FACEBOOK_APP_SECRET não configurado.");
  return secret;
}

export function fbRedirectUri(): string {
  return process.env.FACEBOOK_REDIRECT_URI || `${getAppUrl()}/api/auth/facebook/callback`;
}

/** True quando as credenciais do app estão presentes. */
export function facebookConfigured(): boolean {
  return Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

/** URL do diálogo de login/permissões do Facebook. */
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: fbAppId(),
    redirect_uri: fbRedirectUri(),
    state,
    scope: "ads_read,ads_management",
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

interface GraphError {
  error?: { message: string; type?: string; code?: number };
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GRAPH_URL}${path}?${qs}`, { cache: "no-store" });
  const json = (await res.json()) as T & GraphError;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Erro na Graph API (${res.status}).`);
  }
  return json;
}

/** Troca o `code` do callback por um access token de curta duração. */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const data = await graphGet<{ access_token: string }>("/oauth/access_token", {
    client_id: fbAppId(),
    client_secret: fbAppSecret(),
    redirect_uri: fbRedirectUri(),
    code,
  });
  return data.access_token;
}

/** Converte um token curto em um de longa duração (~60 dias). */
export async function getLongLivedToken(shortToken: string): Promise<{ token: string; expiresAt: Date | null }> {
  const data = await graphGet<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: fbAppId(),
    client_secret: fbAppSecret(),
    fb_exchange_token: shortToken,
  });
  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
  return { token: data.access_token, expiresAt };
}

export interface FacebookProfile {
  id: string;
  name: string;
  email?: string;
  picture?: { data?: { url?: string } };
}

export async function getMe(accessToken: string): Promise<FacebookProfile> {
  return graphGet<FacebookProfile>("/me", {
    fields: "id,name,email,picture.type(large)",
    access_token: accessToken,
  });
}

export interface FacebookAdAccount {
  id: string; // "act_123"
  account_id: string; // "123"
  name: string;
  currency: string;
  timezone_name?: string;
  account_status: number;
}

/** Contas de anúncio às quais o usuário conectado tem acesso. */
export async function getAdAccounts(accessToken: string): Promise<FacebookAdAccount[]> {
  const all: FacebookAdAccount[] = [];
  let url: string | null =
    `${GRAPH_URL}/me/adaccounts?` +
    new URLSearchParams({
      fields: "account_id,name,currency,timezone_name,account_status",
      limit: "200",
      access_token: accessToken,
    }).toString();

  // Segue a paginação até acabar.
  while (url) {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { data?: FacebookAdAccount[]; paging?: { next?: string } } & GraphError;
    if (!res.ok || json.error) throw new Error(json.error?.message || "Falha ao listar contas de anúncio.");
    if (json.data) all.push(...json.data);
    url = json.paging?.next ?? null;
  }
  return all;
}

/** Mapeia o account_status numérico do Facebook para o nosso enum. */
export function mapAccountStatus(status: number): "ACTIVE" | "PAUSED" | "UNKNOWN" {
  if (status === 1) return "ACTIVE";
  if (status === 2 || status === 3) return "PAUSED";
  return "UNKNOWN";
}
