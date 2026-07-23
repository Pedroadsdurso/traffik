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
}

const PLATFORMS: WebhookPlatform[] = ["KIRVANO", "HOTMART", "KIWIFY", "CUSTOM"];

function toDTO(w: {
  id: string;
  name: string;
  platform: WebhookPlatform;
  token: string;
  active: boolean;
  eventCount: number;
}): WebhookRowDTO {
  return {
    id: w.id,
    name: w.name,
    platform: w.platform,
    token: w.token,
    url: `${getAppUrl()}/api/webhook/sale/${w.token}`,
    active: w.active,
    eventCount: w.eventCount,
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

export async function createWebhook(input: { platform: string; name?: string }): Promise<WebhookRowDTO> {
  const userId = await requireUserId();
  const platform = (PLATFORMS.includes(input.platform as WebhookPlatform)
    ? input.platform
    : "CUSTOM") as WebhookPlatform;
  const name =
    input.name?.trim() ||
    `Webhook ${platform.charAt(0) + platform.slice(1).toLowerCase()}`;

  const created = await prisma.webhook.create({
    data: { userId, platform, name },
  });
  return toDTO(created);
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
