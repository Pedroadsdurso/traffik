"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/timezone";
// A leitura por id vive em `lib/userTimezone.ts`, fora deste módulo `"use server"`:
// aqui todo export vira endpoint de server action, e as agregações que precisam
// do fuso rodam em cron, sem sessão.
import { getUserTimezone } from "@/lib/userTimezone";

/** Fuso do usuário logado, para o layout passar ao cliente. */
export async function getMyTimezone(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) return DEFAULT_TIMEZONE;
  return getUserTimezone(session.user.id);
}

export async function setMyTimezone(timezone: string): Promise<{ ok: boolean; timezone: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, timezone: DEFAULT_TIMEZONE, error: "Sessão expirada." };
  const tz = timezone.trim();
  // Valida contra o ICU e não contra a lista da UI: a lista é só uma
  // conveniência, e um fuso válido fora dela não deveria ser recusado.
  if (!isValidTimezone(tz)) return { ok: false, timezone: DEFAULT_TIMEZONE, error: "Fuso horário inválido." };
  await prisma.user.update({ where: { id: session.user.id }, data: { timezone: tz } });
  return { ok: true, timezone: tz };
}
