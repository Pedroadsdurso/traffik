"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLastWorkspaceId } from "@/lib/actions/workspaces";
import { carregarMapaDeAreas } from "@/lib/areas/atribuicao";
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

/**
 * Notificações do usuário, recortadas pela Área de Trabalho ativa.
 *
 * ⚠️ **Notificação SEM venda continua aparecendo em toda área.** Relatório
 * diário, alerta de regra e aviso de sistema não pertencem a operação nenhuma;
 * escondê-los na área errada faria o usuário perder aviso por estar na aba
 * errada. Só o que tem `saleId` é recortado — e aí pela mesma regra do
 * Dashboard: webhook e produto da venda.
 */
export async function listNotifications(workspaceId?: string | null): Promise<{ items: NotificationDTO[]; unread: number }> {
  const userId = await requireUserId();
  const mapa = await carregarMapaDeAreas(userId);
/**
 * Área ativa quando o chamador não informa uma.
 *
 * ⚠️ Resolvida AQUI DENTRO, e não no layout, de propósito: o layout busca os 12
 * conjuntos de dados em `Promise.all`, e esperar a área antes de disparar tudo
 * acrescentaria um round-trip (~99ms) ao caminho crítico de toda navegação.
 * Assim os dois hops ficam dentro de um ramo que já roda em paralelo.
 */
  const areaAtiva = mapa.areaValida(workspaceId ?? (await getLastWorkspaceId()));

  // A venda vem junto porque a precedência precisa dela: sem `product`,
  // `webhookId` e o UTM do clique não dá para dizer de que área a notificação é.
  const selectSale = {
    select: { product: true, webhookId: true, apiCredentialId: true, click: { select: { utmCampaign: true } } },
  } as const;

  // ⚠️ Busca ampla e recorta em memória — a atribuição passa pelo
  // `utm_campaign` no formato `nome|id`, que o Postgres não sabe interpretar.
  // O teto existe para a consulta não crescer sem limite; a UI mostra 20.
  const TETO = 300;
  const [brutas, naoLidas] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: TETO,
      include: { sale: selectSale },
    }),
    prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { timestamp: "desc" },
      take: TETO,
      select: { id: true, sale: selectSale },
    }),
  ]);

  // ⚠️ **Notificação SEM venda aparece em TODA área.** Relatório diário, alerta
  // de regra e aviso de sistema não pertencem a operação nenhuma; escondê-los
  // faria o usuário perder aviso por estar na aba errada.
  const daArea = (n: { sale: { product: string; webhookId: string | null; apiCredentialId: string | null; click: { utmCampaign: string | null } | null } | null }) =>
    n.sale === null || mapa.areaDaVenda(n.sale).areaId === areaAtiva;

  return {
    items: brutas.filter(daArea).slice(0, 20).map(paraDTO),
    unread: naoLidas.filter(daArea).length,
  };
}

function paraDTO(n: {
  id: string; type: NotificationDTO["type"]; title: string; content: string; read: boolean; timestamp: Date;
}): NotificationDTO {
  return {
    id: n.id, type: n.type, title: n.title, content: n.content,
    read: n.read, timestamp: n.timestamp.toISOString(),
  };
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireUserId();
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}
