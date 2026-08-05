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

/**
 * Liga/desliga o imposto sobre o GASTO com anúncios e grava a alíquota.
 *
 * ⚠️ A alíquota é guardada mesmo quando o toggle está desligado — desligar não
 * pode apagar o número que o usuário levantou com o contador dele. Religar
 * devolve o valor, em vez de voltar ao padrão de 12.
 */
export async function setImpostoAnuncios(
  ativo: boolean,
  pct: number,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão expirada." };
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    // ⛔ Acima de 100% o "imposto" comeria mais que o próprio gasto e o lucro
    // viraria uma função do erro de digitação, não da operação.
    return { ok: false, error: "A alíquota precisa estar entre 0 e 100." };
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { impostoAnunciosAtivo: ativo, impostoAnunciosPct: pct },
  });
  return { ok: true };
}

/**
 * Estado atual do imposto sobre anúncios.
 *
 * ⚠️ O card que consome isto busca no MOUNT, e isso é seguro aqui: a
 * configuração é do USUÁRIO, não da Área de Trabalho. O defeito documentado
 * (componente cliente que busca por server action escopada por área, com deps
 * `[]`, e passa a mostrar a área anterior) exige uma action escopada por área —
 * esta não é. Se um dia virar por área, a busca PRECISA receber o
 * `workspaceId` por prop e tê-lo nas dependências.
 */
export async function getImpostoAnuncios(): Promise<{ ativo: boolean; pct: number }> {
  const session = await auth();
  if (!session?.user?.id) return { ativo: false, pct: 12 };
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { impostoAnunciosAtivo: true, impostoAnunciosPct: true },
  });
  return { ativo: u?.impostoAnunciosAtivo ?? false, pct: Number(u?.impostoAnunciosPct ?? 12) };
}
