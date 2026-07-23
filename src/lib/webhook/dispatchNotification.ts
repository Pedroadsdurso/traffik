import { prisma } from "@/lib/prisma";

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Cria uma Notification para o dashboard quando uma venda chega pelo webhook,
 * respeitando as preferências do usuário (pendente/aprovada + o que exibir).
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
    if (!sale) return;
    if (sale.status !== "APROVADA" && sale.status !== "PENDENTE") return;

    const settings = await prisma.notificationSettings.findUnique({ where: { userId: sale.userId } });
    if (!settings) return;
    if (sale.status === "APROVADA" && !settings.notifyApprovedSale) return;
    if (sale.status === "PENDENTE" && !settings.notifyPendingSale) return;

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
  } catch (e) {
    console.error("[dispatchSaleNotification]", e);
  }
}
