import { decryptSecretSafe } from "@/lib/crypto/secrets";
import { sendPurchaseEvent } from "@/lib/facebook/capi";
import { prisma } from "@/lib/prisma";
import { traffikEnvia } from "@/lib/pixel/donos";

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
        fbc: true,
        fbp: true,
        click: { select: { fbclid: true, ip: true, userAgent: true, url: true, timestamp: true } },
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
      // Purchase é o caso que mais dói: com o pixel do gateway disparando na
      // página de obrigado E a nossa CAPI disparando pelo webhook, a Meta
      // conta a conversão duas vezes e otimiza a campanha com sinal inflado.
      if (!traffikEnvia(px.eventOwners, "Purchase")) continue;
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
          /**
           * 🔴 Isto NÃO deduplica com o pixel do navegador — e o comentário que
           * estava aqui afirmava que sim, desde o primeiro commit do pixel
           * (`f62d2db`, Fase 10).
           *
           * `sale.id` é um cuid do NOSSO banco. Nenhum pixel de navegador — nem
           * o do usuário, nem o do gateway — consegue gerar esse id, e o nosso
           * script nunca dispara `Purchase` (a rota `/api/pixel/event` o recusa).
           * Então nunca houve par para a Meta juntar: **a dedup do Purchase
           * jamais funcionou.** Não é regressão, é defeito de origem.
           *
           * O `event_id` continua sendo enviado porque serve para outra coisa,
           * essa sim real: a **idempotência do nosso lado**. Reentrega do mesmo
           * webhook reenvia o mesmo id, e a Meta descarta a repetição.
           *
           * Quem resolve a contagem dobrada é a PARTIÇÃO — `traffikEnvia` acima,
           * alimentada pela pergunta do preset. Ver `lib/pixel/preset.ts`.
           */
          eventId: sale.id,
          email: sale.buyerEmail,
          phone: sale.buyerPhone,
          country: sale.country,
          fbclid: sale.click?.fbclid,
          // O cookie REAL que o gateway mandou, quando houver.
          fbc: sale.fbc,
          fbp: sale.fbp,
          // Instante do CLIQUE, para reconstruir o `_fbc` com o timestamp certo
          // quando o gateway não manda o cookie.
          fbclidEm: sale.click ? Math.floor(sale.click.timestamp.getTime() / 1000) : null,
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
