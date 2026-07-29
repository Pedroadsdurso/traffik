"use server";

import { auth } from "@/auth";
import { getLastWorkspaceId } from "@/lib/actions/workspaces";
import { prisma } from "@/lib/prisma";
import type { RuleCondition } from "@/lib/rules/engine";
import type { RuleAction, RuleLevel } from "@/generated/prisma/enums";

export interface RuleLogDTO {
  id: string;
  ranAt: string;
  status: string;
  message: string | null;
  affected: number;
}

export interface RuleDTO {
  id: string;
  name: string;
  targetProduct: string | null;
  adAccountIds: string[];
  level: RuleLevel;
  nameFilter: string | null;
  action: RuleAction;
  actionParams: { tipo?: string; valor?: number } | null;
  conditions: RuleCondition[];
  calcPeriod: string;
  frequencyMin: number;
  dailyRunLimit: number;
  active: boolean;
  lastRunAt: string | null;
  summary: string;
  logs: RuleLogDTO[];
}

const METRIC_LABEL: Record<string, string> = { cpa: "CPA", roas: "ROAS", ctr: "CTR", gasto: "Gasto", vendas: "Vendas" };
const ACTION_LABEL: Record<RuleAction, string> = { PAUSAR: "pausar", ATIVAR: "ativar", AJUSTAR_ORCAMENTO: "ajustar orçamento" };

function buildSummary(conds: RuleCondition[], action: RuleAction, params: { tipo?: string; valor?: number } | null): string {
  const cond = conds.map((c) => `${METRIC_LABEL[c.metrica] ?? c.metrica} ${c.operador} ${c.valor}`).join(" e ");
  let act: string = ACTION_LABEL[action];
  if (action === "AJUSTAR_ORCAMENTO" && params) {
    act = params.tipo === "percentual" ? `ajustar orçamento ${params.valor}%` : `definir orçamento R$${params.valor}`;
  }
  return `Se ${cond || "—"} → ${act}`;
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

function toDTO(r: {
  id: string; name: string; targetProduct: string | null; adAccountIds: string[]; level: RuleLevel;
  nameFilter: string | null; action: RuleAction; actionParams: unknown; conditions: unknown;
  calcPeriod: string; frequencyMin: number; dailyRunLimit: number; active: boolean; lastRunAt: Date | null;
  logs?: { id: string; ranAt: Date; status: string; message: string | null; affected: number }[];
}): RuleDTO {
  const conditions = (Array.isArray(r.conditions) ? r.conditions : []) as RuleCondition[];
  const actionParams = (r.actionParams ?? null) as RuleDTO["actionParams"];
  return {
    id: r.id, name: r.name, targetProduct: r.targetProduct, adAccountIds: r.adAccountIds, level: r.level,
    nameFilter: r.nameFilter, action: r.action, actionParams, conditions,
    calcPeriod: r.calcPeriod, frequencyMin: r.frequencyMin, dailyRunLimit: r.dailyRunLimit,
    active: r.active, lastRunAt: r.lastRunAt?.toISOString() ?? null,
    summary: buildSummary(conditions, r.action, actionParams),
    logs: (r.logs ?? []).map((l) => ({ id: l.id, ranAt: l.ranAt.toISOString(), status: l.status, message: l.message, affected: l.affected })),
  };
}

/**
 * Regras visíveis na Área de Trabalho ativa.
 *
 * ⚠️ **Regra GLOBAL (`workspaceId` nulo) aparece em TODA área** — e isso é
 * proposital: ela realmente age sobre as campanhas desta área também.
 * Escondê-la faria o usuário achar que ninguém está pausando as campanhas dele
 * enquanto uma regra global as pausa.
 *
 * 🔴 O motor (`rules/engine.ts`) aplica o MESMO escopo antes de agir. As duas
 * coisas andam juntas: esconder da tela sem escopar o motor deixaria uma regra
 * mexendo em orçamento real de forma invisível.
 */
export async function listRules(workspaceId?: string | null): Promise<RuleDTO[]> {
  const userId = await requireUserId();
  const ws = workspaceId ?? (await getLastWorkspaceId());
  const rules = await prisma.automationRule.findMany({
    where: {
      userId,
      ...(ws ? { OR: [{ workspaceId: null }, { workspaceId: ws }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { logs: { orderBy: { ranAt: "desc" }, take: 5 } },
  });
  return rules.map(toDTO);
}

export interface CreateRuleInput {
  name: string;
  targetProduct?: string | null;
  adAccountIds?: string[];
  /** Área dona. Ausente/nulo = regra global (vale para todas as áreas). */
  workspaceId?: string | null;
  level: RuleLevel;
  nameFilter?: string | null;
  action: RuleAction;
  actionParams?: { tipo?: string; valor?: number } | null;
  conditions: RuleCondition[];
  calcPeriod: string;
  frequencyMin: number;
  dailyRunLimit: number;
  active: boolean;
}

export async function createRule(input: CreateRuleInput): Promise<RuleDTO> {
  const userId = await requireUserId();
  const created = await prisma.automationRule.create({
    data: {
      userId,
      name: input.name.trim() || "Regra sem nome",
      targetProduct: input.targetProduct?.trim() || null,
      adAccountIds: input.adAccountIds ?? [],
      workspaceId: input.workspaceId ?? null,
      level: input.level,
      nameFilter: input.nameFilter?.trim() || null,
      action: input.action,
      actionParams: (input.actionParams ?? undefined) as object | undefined,
      conditions: input.conditions as object,
      calcPeriod: input.calcPeriod,
      frequencyMin: input.frequencyMin,
      dailyRunLimit: input.dailyRunLimit,
      active: input.active,
    },
    include: { logs: true },
  });
  return toDTO(created);
}

export async function toggleRule(id: string): Promise<{ id: string; active: boolean }> {
  const userId = await requireUserId();
  const r = await prisma.automationRule.findFirst({ where: { id, userId }, select: { active: true } });
  if (!r) throw new Error("Regra não encontrada.");
  const updated = await prisma.automationRule.update({ where: { id }, data: { active: !r.active } });
  return { id, active: updated.active };
}

export async function deleteRule(id: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  const r = await prisma.automationRule.findFirst({ where: { id, userId }, select: { id: true } });
  if (!r) throw new Error("Regra não encontrada.");
  await prisma.automationRule.delete({ where: { id } });
  return { id };
}
