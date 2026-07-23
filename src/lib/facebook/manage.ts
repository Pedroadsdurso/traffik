import { GRAPH_URL } from "@/lib/facebook/graph";

interface GraphWriteResult {
  id?: string;
  success?: boolean;
  error?: { message: string };
}

async function graphPost(path: string, body: Record<string, string>): Promise<GraphWriteResult> {
  const res = await fetch(`${GRAPH_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
  const json = (await res.json()) as GraphWriteResult;
  if (!res.ok || json.error) throw new Error(json.error?.message || `Graph API ${res.status}`);
  return json;
}

/** Pausa ou ativa uma campanha/conjunto/anúncio pelo id do Facebook. */
export async function setEntityStatus(fbId: string, status: "ACTIVE" | "PAUSED", accessToken: string): Promise<void> {
  await graphPost(`/${fbId}`, { status, access_token: accessToken });
}

/** Ajusta o orçamento diário (em reais) de uma campanha/conjunto. */
export async function updateDailyBudget(fbId: string, budgetReais: number, accessToken: string): Promise<void> {
  await graphPost(`/${fbId}`, { daily_budget: String(Math.round(budgetReais * 100)), access_token: accessToken });
}

/** Cria uma campanha básica (nasce pausada por segurança). */
export async function createCampaign(
  fbAccountId: string,
  accessToken: string,
  input: { name: string; objective: string; dailyBudget?: number | null },
): Promise<string> {
  const body: Record<string, string> = {
    name: input.name,
    objective: input.objective,
    status: "PAUSED",
    // Obrigatório desde 2020; vazio = campanha comum.
    special_ad_categories: "[]",
    access_token: accessToken,
  };
  if (input.dailyBudget && input.dailyBudget > 0) {
    // Orçamento em centavos.
    body.daily_budget = String(Math.round(input.dailyBudget * 100));
  }
  const res = await graphPost(`/act_${fbAccountId}/campaigns`, body);
  if (!res.id) throw new Error("Facebook não retornou o id da campanha.");
  return res.id;
}
