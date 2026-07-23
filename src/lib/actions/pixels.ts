"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { PixelEventType, PurchaseSendMode, PurchaseValueMode } from "@/generated/prisma/enums";

export interface EventRuleDTO {
  eventType: PixelEventType;
  enabled: boolean;
  detection: { tipo?: string; valor?: string } | null;
  sendMode: PurchaseSendMode | null;
  valueMode: PurchaseValueMode | null;
  fixedValue: number | null;
  targetProduct: string | null;
}

export interface PixelConfigDTO {
  id: string;
  name: string;
  pixelId: string;
  enabled: boolean;
  hasToken: boolean;
  rules: EventRuleDTO[];
}

const EVENT_TYPES: PixelEventType[] = ["LEAD", "ADD_TO_CART", "INITIATE_CHECKOUT", "PURCHASE"];

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

function toDTO(px: {
  id: string;
  name: string;
  pixelId: string;
  enabled: boolean;
  accessToken: string | null;
  eventRules: {
    eventType: PixelEventType;
    enabled: boolean;
    detection: unknown;
    sendMode: PurchaseSendMode | null;
    valueMode: PurchaseValueMode | null;
    fixedValue: unknown;
    targetProduct: string | null;
  }[];
}): PixelConfigDTO {
  const byType = new Map(px.eventRules.map((r) => [r.eventType, r]));
  return {
    id: px.id,
    name: px.name,
    pixelId: px.pixelId,
    enabled: px.enabled,
    hasToken: Boolean(px.accessToken),
    rules: EVENT_TYPES.map((t) => {
      const r = byType.get(t);
      return {
        eventType: t,
        enabled: r?.enabled ?? false,
        detection: (r?.detection as EventRuleDTO["detection"]) ?? null,
        sendMode: r?.sendMode ?? "APENAS_APROVADAS",
        valueMode: r?.valueMode ?? "VALOR_DA_VENDA",
        fixedValue: r?.fixedValue != null ? Number(r.fixedValue) : null,
        targetProduct: r?.targetProduct ?? null,
      };
    }),
  };
}

export async function listPixels(): Promise<PixelConfigDTO[]> {
  const userId = await requireUserId();
  const pixels = await prisma.pixelConfig.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { eventRules: true },
  });
  return pixels.map(toDTO);
}

export async function createPixel(input: { name: string; pixelId: string; accessToken?: string }): Promise<PixelConfigDTO> {
  const userId = await requireUserId();
  const name = input.name?.trim() || "Meta Pixel";
  const pixelId = input.pixelId?.trim();
  if (!pixelId) throw new Error("Informe o ID do pixel.");

  const px = await prisma.pixelConfig.create({
    data: {
      userId,
      name,
      pixelId,
      accessToken: input.accessToken?.trim() || null,
      provider: "META",
      // Purchase já nasce habilitado (apenas aprovadas); demais desabilitados.
      eventRules: {
        create: EVENT_TYPES.map((t) => ({
          eventType: t,
          enabled: t === "PURCHASE",
          ...(t === "PURCHASE" ? { sendMode: "APENAS_APROVADAS", valueMode: "VALOR_DA_VENDA" } : {}),
        })),
      },
    },
    include: { eventRules: true },
  });
  return toDTO(px);
}

export async function deletePixel(id: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  const px = await prisma.pixelConfig.findFirst({ where: { id, userId }, select: { id: true } });
  if (!px) throw new Error("Pixel não encontrado.");
  await prisma.pixelConfig.delete({ where: { id } });
  return { id };
}

export async function togglePixel(id: string): Promise<{ id: string; enabled: boolean }> {
  const userId = await requireUserId();
  const px = await prisma.pixelConfig.findFirst({ where: { id, userId }, select: { enabled: true } });
  if (!px) throw new Error("Pixel não encontrado.");
  const updated = await prisma.pixelConfig.update({ where: { id }, data: { enabled: !px.enabled } });
  return { id, enabled: updated.enabled };
}

export async function updateEventRule(
  pixelConfigId: string,
  eventType: PixelEventType,
  patch: Partial<{
    enabled: boolean;
    detectionText: string | null;
    sendMode: PurchaseSendMode;
    valueMode: PurchaseValueMode;
    fixedValue: number | null;
    targetProduct: string | null;
  }>,
): Promise<void> {
  const userId = await requireUserId();
  const px = await prisma.pixelConfig.findFirst({ where: { id: pixelConfigId, userId }, select: { id: true } });
  if (!px) throw new Error("Pixel não encontrado.");

  const data: Record<string, unknown> = {};
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  if (patch.detectionText !== undefined) {
    data.detection = patch.detectionText ? { tipo: "contem_texto", valor: patch.detectionText } : undefined;
  }
  if (patch.sendMode !== undefined) data.sendMode = patch.sendMode;
  if (patch.valueMode !== undefined) data.valueMode = patch.valueMode;
  if (patch.fixedValue !== undefined) data.fixedValue = patch.fixedValue;
  if (patch.targetProduct !== undefined) data.targetProduct = patch.targetProduct || null;

  await prisma.pixelEventRule.upsert({
    where: { pixelConfigId_eventType: { pixelConfigId, eventType } },
    update: data,
    create: { pixelConfigId, eventType, enabled: patch.enabled ?? false, ...data },
  });
}
