"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface DashboardPrefsDTO {
  order: string[];
  visible: Record<string, boolean>;
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

/** Persiste ordem + visibilidade dos cards. Guardamos ambos em `visibility`. */
export async function saveDashboardPrefs(prefs: DashboardPrefsDTO): Promise<void> {
  const userId = await requireUserId();
  await prisma.dashboardPreference.upsert({
    where: { userId },
    update: { visibility: prefs as object },
    create: { userId, visibility: prefs as object },
  });
}

export async function loadDashboardPrefs(): Promise<DashboardPrefsDTO | null> {
  const userId = await requireUserId();
  const row = await prisma.dashboardPreference.findUnique({ where: { userId }, select: { visibility: true } });
  if (!row) return null;
  const v = row.visibility as unknown;
  if (v && typeof v === "object" && "order" in v && "visible" in v) {
    return v as DashboardPrefsDTO;
  }
  return null;
}
