"use server";

import { auth } from "@/auth";
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

export async function listExpenses(): Promise<ExpenseDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.expense.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return rows.map(toDTO);
}

export interface CreateExpenseInput {
  name: string;
  type: ExpenseType;
  calc: ExpenseCalc;
  amount: number;
  paymentMethod?: PaymentMethod | null;
  recurrence?: ExpenseRecurrence;
}

export async function createExpense(input: CreateExpenseInput): Promise<ExpenseDTO> {
  const userId = await requireUserId();
  const row = await prisma.expense.create({
    data: {
      userId,
      name: input.name.trim() || "Despesa",
      type: input.type,
      calc: input.calc,
      amount: input.amount,
      paymentMethod: input.paymentMethod ?? null,
      recurrence: input.recurrence ?? "MENSAL",
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
