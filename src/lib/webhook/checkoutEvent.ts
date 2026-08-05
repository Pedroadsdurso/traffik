import { prisma } from "@/lib/prisma";

/** Janela para considerar que o clique no site e o pedido no gateway são o mesmo checkout. */
const JANELA_DEDUP_MS = 6 * 60 * 60 * 1000;

/**
 * Marca, no lugar da URL, o InitiateCheckout que **não veio do navegador**.
 *
 * Não é uma URL e não deve ser exibida como tal: o feed de Atividade Recente
 * mostra `PixelEvent.url` na coluna de campanha, e este valor cru aparecia como
 * uma "campanha" chamada `gateway:webhook` que não existe em lugar nenhum.
 * Exportada para que a tela traduza pela MESMA constante — comparar com a
 * string escrita à mão nos dois lados é como as duas pontas divergem.
 */
export const SENTINELA_CHECKOUT_GATEWAY = "gateway:webhook";

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
        pedidoId: true,
        timestamp: true,
        click: { select: { fbclid: true } },
      },
    });
    if (!sale) return "ignorado";

    // ⚠️ A chave é o PEDIDO, não o item. Com order bump, um único checkout vira
    // N linhas de venda — e uma chave por linha geraria N InitiateCheckout para
    // o mesmo carrinho, inflando o topo do funil e derrubando a taxa de
    // conversão. `pedidoId` é NULO em venda antiga, e aí o `externalId` continua
    // sendo a chave, exatamente como antes.
    const chave = sale.pedidoId ?? sale.externalId;
    const eventId = chave ? `gw:${chave}` : null;
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
          // ⚠️ A janela tem as DUAS pontas. Só com `gte` ela era "de 6h antes da
          // venda até o fim dos tempos", o que basta em tempo real (o clique
          // sempre veio antes) e é errado ao reprocessar uma venda antiga: um
          // checkout de meses depois, do mesmo visitante, contaria como
          // duplicata e apagaria o evento que o backfill existe para criar.
          timestamp: {
            gte: new Date(sale.timestamp.getTime() - JANELA_DEDUP_MS),
            lte: new Date(sale.timestamp.getTime() + JANELA_DEDUP_MS),
          },
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
        url: SENTINELA_CHECKOUT_GATEWAY,
        fbclid,
        /**
         * 🔴 O INSTANTE É O DA VENDA, não o do processamento.
         *
         * A coluna tem `@default(now())`, e omiti-la carimbava o evento com a
         * hora em que o webhook chegou. Em tempo real os dois quase coincidem —
         * mas não são a mesma coisa, e as diferenças são exatamente os casos
         * que importam:
         *
         * | Situação | `now()` | `sale.timestamp` |
         * |---|---|---|
         * | Reentrega do gateway horas depois | hora da reentrega | hora do pedido |
         * | Backfill de vendas antigas | **hoje** | o dia real |
         * | Fila do gateway atrasada | hora da vazão | hora do pedido |
         *
         * No backfill isso deixa de ser detalhe: sem o instante explícito, todo
         * checkout recuperado cairia no funil de HOJE, inflando o dia da
         * execução e deixando o passado tão vazio quanto estava. O número
         * continuaria plausível — só distribuído errado.
         *
         * ⚠️ E a venda que o evento acompanha está no bucket do `timestamp`
         * dela. Carimbar o IC noutro instante colocaria as duas pontas do mesmo
         * checkout em períodos diferentes.
         */
        timestamp: sale.timestamp,
      },
    });
    return "criado";
  } catch (e) {
    console.error("[checkoutEvent] falha ao registrar InitiateCheckout do gateway:", e);
    return "ignorado";
  }
}
