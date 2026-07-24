"use server";

import { auth } from "@/auth";
import { getAppUrl } from "@/lib/appUrl";
import { prisma } from "@/lib/prisma";
import type { WebhookPlatform } from "@/generated/prisma/enums";

export interface WebhookRowDTO {
  id: string;
  name: string;
  platform: string;
  token: string;
  url: string;
  active: boolean;
  eventCount: number;
  /** Se há token de segurança configurado (não expomos o valor). */
  hasSecret: boolean;
}

const PLATFORMS: WebhookPlatform[] = ["KIRVANO", "HOTMART", "KIWIFY", "CUSTOM"];

/** Monta a URL pública conforme a plataforma. */
function webhookUrl(platform: WebhookPlatform, token: string): string {
  const base = getAppUrl();
  if (platform === "KIRVANO") return `${base}/api/webhook/kirvano?id=${token}`;
  return `${base}/api/webhook/sale/${token}`;
}

function toDTO(w: {
  id: string;
  name: string;
  platform: WebhookPlatform;
  token: string;
  active: boolean;
  eventCount: number;
  secret: string | null;
}): WebhookRowDTO {
  return {
    id: w.id,
    name: w.name,
    platform: w.platform,
    token: w.token,
    url: webhookUrl(w.platform, w.token),
    active: w.active,
    eventCount: w.eventCount,
    hasSecret: Boolean(w.secret),
  };
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

export async function listWebhooks(): Promise<WebhookRowDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.webhook.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDTO);
}

export async function createWebhook(input: {
  platform: string;
  name?: string;
  /** Token de segurança do gateway (obrigatório na Kirvano). */
  secret?: string;
}): Promise<WebhookRowDTO> {
  const userId = await requireUserId();
  const platform = (PLATFORMS.includes(input.platform as WebhookPlatform)
    ? input.platform
    : "CUSTOM") as WebhookPlatform;
  const name =
    input.name?.trim() ||
    `Webhook ${platform.charAt(0) + platform.slice(1).toLowerCase()}`;
  const secret = input.secret?.trim() || null;

  const created = await prisma.webhook.create({
    data: { userId, platform, name, secret },
  });
  return toDTO(created);
}

export async function updateWebhook(input: {
  id: string;
  name?: string;
  secret?: string;
}): Promise<WebhookRowDTO> {
  const userId = await requireUserId();
  const current = await prisma.webhook.findFirst({ where: { id: input.id, userId } });
  if (!current) throw new Error("Webhook não encontrado.");
  const updated = await prisma.webhook.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() || current.name } : {}),
      // secret === "" limpa; undefined mantém.
      ...(input.secret !== undefined ? { secret: input.secret.trim() || null } : {}),
    },
  });
  return toDTO(updated);
}

export async function toggleWebhook(id: string): Promise<WebhookRowDTO> {
  const userId = await requireUserId();
  const current = await prisma.webhook.findFirst({ where: { id, userId } });
  if (!current) throw new Error("Webhook não encontrado.");
  const updated = await prisma.webhook.update({
    where: { id },
    data: { active: !current.active },
  });
  return toDTO(updated);
}

export async function deleteWebhook(id: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  const current = await prisma.webhook.findFirst({ where: { id, userId }, select: { id: true } });
  if (!current) throw new Error("Webhook não encontrado.");
  await prisma.webhook.delete({ where: { id } });
  return { id };
}
