import { prisma } from "@/lib/prisma";
import {
  NOTIF_CRIADA,
  NOTIF_DESLIGADA,
  NOTIF_ERRO,
  NOTIF_SEM_CONFIG,
  NOTIF_STATUS,
  mensagemCurta,
} from "@/lib/webhook/efeitos";
import { marcarEfeito } from "@/lib/webhook/marcarEfeito";

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Cria uma Notification para o dashboard quando uma venda chega pelo webhook,
 * respeitando as preferências do usuário (pendente/aprovada + o que exibir).
 *
 * 🔴 Todo `return` aqui era MUDO. O mais caro é o de `settings` ausente: sem a
 * linha de preferências nenhum aviso saía, para nenhuma venda, para sempre — e
 * a tela de Notificações mostrava os toggles como se estivessem valendo. Agora
 * cada saída anota o motivo em `Sale.notifStatus`; ver `efeitos.ts`.
 */
export async function dispatchSaleNotification(saleId: string): Promise<void> {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: {
        id: true,
        userId: true,
        value: true,
        product: true,
        status: true,
        click: { select: { utmCampaign: true } },
      },
    });
    // ⚠️ Venda apagada entre a ingestão e o `after()`: não há onde anotar, e
    // marcar seria escrever numa linha que não existe mais.
    if (!sale) return;
    if (sale.status !== "APROVADA" && sale.status !== "PENDENTE") {
      await marcarEfeito(saleId, "notif", NOTIF_STATUS);
      return;
    }

    const settings = await prisma.notificationSettings.findUnique({ where: { userId: sale.userId } });
    if (!settings) {
      await marcarEfeito(saleId, "notif", NOTIF_SEM_CONFIG);
      return;
    }
    if (sale.status === "APROVADA" && !settings.notifyApprovedSale) {
      await marcarEfeito(saleId, "notif", NOTIF_DESLIGADA);
      return;
    }
    if (sale.status === "PENDENTE" && !settings.notifyPendingSale) {
      await marcarEfeito(saleId, "notif", NOTIF_DESLIGADA);
      return;
    }

    const parts: string[] = [];
    if (settings.showValue) parts.push(brl(Number(sale.value)));
    if (settings.showProductName) parts.push(sale.product);
    if (settings.showUtmCampaign && sale.click?.utmCampaign) parts.push(sale.click.utmCampaign);

    const title = sale.status === "APROVADA" ? "💰 Nova venda aprovada" : "⏳ Venda pendente";

    await prisma.notification.create({
      data: {
        userId: sale.userId,
        type: sale.status === "APROVADA" ? "VENDA_APROVADA" : "VENDA_PENDENTE",
        title,
        content: parts.join(" · ") || "Nova venda registrada",
        data: { saleId: sale.id, value: Number(sale.value), product: sale.product },
        saleId: sale.id,
      },
    });
    await marcarEfeito(saleId, "notif", NOTIF_CRIADA);
  } catch (e) {
    console.error("[dispatchSaleNotification]", e);
    await marcarEfeito(saleId, "notif", NOTIF_ERRO, mensagemCurta(e));
  }
}
