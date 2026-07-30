import { prisma } from "@/lib/prisma";

/** Janela para considerar que o clique no site e o pedido no gateway são o mesmo checkout. */
const JANELA_DEDUP_MS = 6 * 60 * 60 * 1000;

/**
 * Registra um **InitiateCheckout a partir do webhook do gateway**.
 *
 * Por que existe: quando o checkout é hospedado pelo próprio gateway
 * (`pay.kirvano.com`), o cliente **não tem acesso ao código daquela página** e é
 * impossível instalar nosso `px.js` lá. Detectar "checkout iniciado" no
 * navegador, nesse cenário, nunca vai funcionar. O webhook resolve na fonte: a
 * Kirvano avisa quando o pedido foi gerado e ainda não foi pago.
 *
 * Quais eventos entram: qualquer venda que chega com status **PENDENTE** — o que
 * cobre `PIX_GENERATED`, `BANK_SLIP_GENERATED`, `SALE_PENDING` e
 * `ABANDONED_CART` (ver `KIRVANO_EVENT_STATUS` em `parseKirvano.ts`). Vendas que
 * já chegam APROVADAS não geram checkout aqui: elas entram no funil como venda,
 * e criar os dois inflaria o estágio.
 *
 * **Dedup em duas camadas**, porque o mesmo checkout pode ser visto duas vezes:
 *  1. `eventId = "gw:<externalId>"` — a Kirvano reentrega o mesmo evento (foi
 *     observado em produção: dois `PIX_GENERATED` do mesmo pedido no mesmo dia).
 *     Como o id é derivado do pedido, a reentrega não vira evento novo.
 *  2. `fbclid` do clique casado — se o visitante já disparou o InitiateCheckout
 *     clicando no link de checkout no site de vendas, o evento do webhook é
 *     ignorado dentro de 6h. Sem isso o mesmo checkout contaria em dobro.
 *
 * Nunca lança: registrar o evento não pode derrubar a ingestão da venda.
 */
export async function registrarCheckoutDoGateway(
  saleId: string,
  gerouCheckout: boolean,
): Promise<"criado" | "duplicado" | "ignorado"> {
  // ⚠️ Quem decide é o EVENTO, não o status. Antes era `status === "PENDENTE"`,
  // e a suposição quebrou ao separar ABANDONADA de PENDENTE: um carrinho
  // abandonado chegou ao checkout, mas deixaria de gerar InitiateCheckout — o
  // funil encolheria como efeito colateral invisível de uma correção de KPI.
  if (!gerouCheckout) return "ignorado";
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: {
        userId: true,
        status: true,
        externalId: true,
        timestamp: true,
        click: { select: { fbclid: true } },
      },
    });
    if (!sale) return "ignorado";

    // Sem `externalId` não há chave estável para deduplicar reentrega.
    const eventId = sale.externalId ? `gw:${sale.externalId}` : null;
    if (!eventId) return "ignorado";

    const jaExiste = await prisma.pixelEvent.findFirst({
      where: { userId: sale.userId, event: "InitiateCheckout", eventId },
      select: { id: true },
    });
    if (jaExiste) return "duplicado";

    // Camada 2: o mesmo visitante já pode ter disparado o evento pelo clique.
    const fbclid = sale.click?.fbclid ?? null;
    if (fbclid) {
      const peloClique = await prisma.pixelEvent.findFirst({
        where: {
          userId: sale.userId,
          event: "InitiateCheckout",
          fbclid,
          timestamp: { gte: new Date(sale.timestamp.getTime() - JANELA_DEDUP_MS) },
        },
        select: { id: true },
      });
      if (peloClique) return "duplicado";
    }

    await prisma.pixelEvent.create({
      data: {
        userId: sale.userId,
        event: "InitiateCheckout",
        eventId,
        url: "gateway:webhook",
        fbclid,
      },
    });
    return "criado";
  } catch (e) {
    console.error("[checkoutEvent] falha ao registrar InitiateCheckout do gateway:", e);
    return "ignorado";
  }
}
