import { decryptSecretSafe } from "@/lib/crypto/secrets";
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
        eventRules: { some: { eventType: "PURCHASE", enabled: true } },
      },
      include: { eventRules: { where: { eventType: "PURCHASE" } }, metaPixels: true },
    });

    for (const px of pixels) {
      const rule = px.eventRules[0];
      if (!rule || !rule.enabled) continue;
      if (rule.sendMode === "APENAS_APROVADAS" && sale.status !== "APROVADA") continue;
      if (rule.targetProduct && rule.targetProduct.trim() && rule.targetProduct.toLowerCase() !== sale.product.toLowerCase()) {
        continue;
      }
      const value = rule.valueMode === "VALOR_FIXO" ? Number(rule.fixedValue ?? 0) : Number(sale.value);

      // Dispara para cada pixel da Meta com token (fallback ao legado da Fase 10).
      const targets =
        px.metaPixels.length > 0
          ? px.metaPixels
          : px.pixelId
            ? [{ pixelId: px.pixelId, accessToken: px.accessToken }]
            : [];

      for (const mp of targets) {
        // O token fica encriptado no banco; decripta só aqui, para a chamada.
        const accessToken = decryptSecretSafe(mp.accessToken);
        if (!accessToken) continue;
        const result = await sendPurchaseEvent({
          pixelId: mp.pixelId,
          accessToken,
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
        if (!result.ok) console.error(`[CAPI] pixel ${mp.pixelId}: ${result.error}`);
      }
    }
  } catch (e) {
    console.error("[dispatchPurchaseEvents]", e);
  }
}
