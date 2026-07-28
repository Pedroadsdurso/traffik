import { prisma } from "@/lib/prisma";
import { DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/timezone";

/**
 * Fuso de referência de um usuário, a partir do id.
 *
 * Fica FORA de `actions/profile.ts` de propósito: aquele módulo é `"use server"`
 * e importa o `@/auth`, o que (a) transformaria este helper num endpoint de
 * server action exposto ao cliente e (b) arrastaria o NextAuth para dentro de
 * `metrics.ts`, `sync.ts` e do motor de regras — que rodam em cron, sem request
 * nenhum. Aqui é só uma leitura do banco.
 *
 * Nunca lança e nunca devolve vazio: um fuso ilegível não pode derrubar o
 * dashboard, só cair no padrão.
 */
export async function getUserTimezone(userId: string): Promise<string> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const tz = u?.timezone?.trim();
    return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}
