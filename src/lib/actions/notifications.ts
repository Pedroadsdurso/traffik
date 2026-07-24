"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ReportPattern } from "@/generated/prisma/enums";

export interface NotificationSettingsDTO {
  notifyPendingSale: boolean;
  notifyApprovedSale: boolean;
  showValue: boolean;
  showProductName: boolean;
  showUtmCampaign: boolean;
  showDashboardName: boolean;
  report08: boolean;
  report12: boolean;
  report18: boolean;
  report23: boolean;
  reportPattern: ReportPattern;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  content: string;
  read: boolean;
  timestamp: string;
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

const DEFAULTS: NotificationSettingsDTO = {
  notifyPendingSale: true,
  notifyApprovedSale: true,
  showValue: true,
  showProductName: true,
  showUtmCampaign: true,
  showDashboardName: false,
  report08: false,
  report12: false,
  report18: false,
  report23: true,
  reportPattern: "STATUS_LUCRO",
};

/**
 * Lê as preferências de notificação. Roda no layout, ou seja, **em todo
 * carregamento de página** — por isso é caminho de leitura pura.
 *
 * Antes eram 3 idas ao banco em série (checar usuário → upsert) e, pior, uma
 * ESCRITA a cada page load mesmo sem nada mudar: ~630ms, segurando sozinho o
 * `Promise.all` do layout. Agora o caso comum é **uma** leitura; só cria a linha
 * quando ela realmente não existe.
 */
export async function getNotificationSettings(): Promise<NotificationSettingsDTO> {
  const userId = await requireUserId();

  let row = await prisma.notificationSettings.findUnique({ where: { userId } });
  if (!row) {
    try {
      row = await prisma.notificationSettings.create({ data: { userId } });
    } catch {
      // Sessão órfã (usuário removido → viola a FK) ou corrida com outra
      // request criando a mesma linha. Nenhum dos dois deve derrubar o dashboard.
      row = await prisma.notificationSettings.findUnique({ where: { userId } });
      if (!row) return DEFAULTS;
    }
  }

  return {
    notifyPendingSale: row.notifyPendingSale,
    notifyApprovedSale: row.notifyApprovedSale,
    showValue: row.showValue,
    showProductName: row.showProductName,
    showUtmCampaign: row.showUtmCampaign,
    showDashboardName: row.showDashboardName,
    report08: row.report08,
    report12: row.report12,
    report18: row.report18,
    report23: row.report23,
    reportPattern: row.reportPattern,
  };
}

export async function updateNotificationSettings(patch: Partial<NotificationSettingsDTO>): Promise<void> {
  const userId = await requireUserId();
  await prisma.notificationSettings.upsert({
    where: { userId },
    update: patch,
    create: { userId, ...DEFAULTS, ...patch },
  });
}

export async function listNotifications(): Promise<{ items: NotificationDTO[]; unread: number }> {
  const userId = await requireUserId();
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { timestamp: "desc" }, take: 20 }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return {
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      read: n.read,
      timestamp: n.timestamp.toISOString(),
    })),
    unread,
  };
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireUserId();
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}
