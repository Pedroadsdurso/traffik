"use server";

import { auth } from "@/auth";
import { getLastWorkspaceId } from "@/lib/actions/workspaces";
import { escopoDeConfig, whereDespesas } from "@/lib/areas/escopoConfig";
import { prisma } from "@/lib/prisma";
import type { ExpenseCalc, ExpenseRecurrence, ExpenseType, PaymentMethod } from "@/generated/prisma/enums";

export interface ExpenseDTO {
  id: string;
  name: string;
  type: ExpenseType;
  calc: ExpenseCalc;
  amount: number;
  paymentMethod: PaymentMethod | null;
  recurrence: ExpenseRecurrence;
  active: boolean;
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

function toDTO(e: {
  id: string; name: string; type: ExpenseType; calc: ExpenseCalc; amount: unknown;
  paymentMethod: PaymentMethod | null; recurrence: ExpenseRecurrence; active: boolean;
}): ExpenseDTO {
  return {
    id: e.id, name: e.name, type: e.type, calc: e.calc, amount: Number(e.amount),
    paymentMethod: e.paymentMethod, recurrence: e.recurrence, active: e.active,
  };
}

/**
 * Despesas que se aplicam à área ativa.
 *
 * 🔴 **`workspaceId` NULO = vale para TODAS as áreas** — e por isso a lista
 * SEMPRE inclui as nulas, inclusive numa área secundária. Taxa de gateway e
 * imposto são globais por natureza; escondê-los numa área faria o lucro dela
 * ser calculado sem imposto, com um número que continua parecendo plausível.
 */
export async function listExpenses(workspaceId?: string | null): Promise<ExpenseDTO[]> {
  const userId = await requireUserId();
  const escopo = await escopoDeConfig(userId, workspaceId ?? (await getLastWorkspaceId()));
  const rows = await prisma.expense.findMany({
    where: { userId, ...whereDespesas(escopo.areaId) },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDTO);
}

export interface CreateExpenseInput {
  name: string;
  type: ExpenseType;
  calc: ExpenseCalc;
  amount: number;
  paymentMethod?: PaymentMethod | null;
  recurrence?: ExpenseRecurrence;
  /** Area dona. Omitido = a area ativa. Toda despesa pertence a uma area. */
  workspaceId?: string | null;
}

export async function createExpense(input: CreateExpenseInput): Promise<ExpenseDTO> {
  const userId = await requireUserId();
  // Toda despesa nasce vinculada a area ativa. Nao existe mais despesa
  // global: o usuario pediu isolamento por area em 30/07/2026.
  const escopo = await escopoDeConfig(userId, input.workspaceId ?? (await getLastWorkspaceId()));
  const row = await prisma.expense.create({
    data: {
      userId,
      name: input.name.trim() || "Despesa",
      type: input.type,
      calc: input.calc,
      amount: input.amount,
      paymentMethod: input.paymentMethod ?? null,
      recurrence: input.recurrence ?? "MENSAL",
      workspaceId: escopo.areaId || null,
    },
  });
  return toDTO(row);
}

export async function updateExpense(id: string, patch: Partial<Pick<ExpenseDTO, "amount" | "name" | "active">>): Promise<ExpenseDTO> {
  const userId = await requireUserId();
  const cur = await prisma.expense.findFirst({ where: { id, userId }, select: { id: true } });
  if (!cur) throw new Error("Despesa não encontrada.");
  const row = await prisma.expense.update({ where: { id }, data: patch });
  return toDTO(row);
}

export async function deleteExpense(id: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  const cur = await prisma.expense.findFirst({ where: { id, userId }, select: { id: true } });
  if (!cur) throw new Error("Despesa não encontrada.");
  await prisma.expense.delete({ where: { id } });
  return { id };
}
