import { sendPurchaseEvent } from "@/lib/facebook/capi";
import { prisma } from "@/lib/prisma";

/**
 * Após uma venda ser salva pelo webhook, dispara o evento Purchase para a
 * Conversions API de cada pixel configurado do usuário (respeitando as regras).
 * Nunca lança — falhas são registradas mas não quebram o webhook.
 */
export async function dispatchPurchaseEvents(saleId: string): Promise<void> {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: {
        id: true,
        userId: true,
        value: true,
        currency: true,
        product: true,
        status: true,
        buyerEmail: true,
        buyerPhone: true,
        country: true,
        click: { select: { fbclid: true, ip: true, userAgent: true, url: true } },
      },
    });
    if (!sale) return;

    const pixels = await prisma.pixelConfig.findMany({
      where: {
        userId: sale.userId,
        enabled: true,
        accessToken: { not: null },
        eventRules: { some: { eventType: "PURCHASE", enabled: true } },
      },
      include: { eventRules: { where: { eventType: "PURCHASE" } } },
    });

    for (const px of pixels) {
      const rule = px.eventRules[0];
      if (!rule || !rule.enabled || !px.accessToken) continue;
      if (rule.sendMode === "APENAS_APROVADAS" && sale.status !== "APROVADA") continue;
      if (rule.targetProduct && rule.targetProduct.trim() && rule.targetProduct.toLowerCase() !== sale.product.toLowerCase()) {
        continue;
      }
      const value = rule.valueMode === "VALOR_FIXO" ? Number(rule.fixedValue ?? 0) : Number(sale.value);

      const result = await sendPurchaseEvent({
        pixelId: px.pixelId,
        accessToken: px.accessToken,
        value,
        currency: sale.currency,
        eventId: sale.id, // dedup com o pixel do navegador
        email: sale.buyerEmail,
        phone: sale.buyerPhone,
        country: sale.country,
        fbclid: sale.click?.fbclid,
        clientIp: sale.click?.ip,
        clientUserAgent: sale.click?.userAgent,
        eventSourceUrl: sale.click?.url,
      });
      if (!result.ok) console.error(`[CAPI] pixel ${px.pixelId}: ${result.error}`);
    }
  } catch (e) {
    console.error("[dispatchPurchaseEvents]", e);
  }
}
