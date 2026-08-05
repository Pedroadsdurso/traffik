import { prisma } from "@/lib/prisma";
import {
  CHECKOUT_CRIADO,
  CHECKOUT_DUPLICADO,
  CHECKOUT_ERRO,
  CHECKOUT_IGNORADO,
  mensagemCurta,
} from "@/lib/webhook/efeitos";
import { marcarEfeito } from "@/lib/webhook/marcarEfeito";
import { marcarCheckoutDaJornada } from "@/lib/funil/checkoutDaJornada";

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
 * ## Duas saídas, e a primeira acabou com o checkout duplicado
 *
 * | Venda | O que acontece |
 * |---|---|
 * | **com jornada casada** (`clickId`) | marca `Click.checkoutAt`. Se o navegador já marcou, não move nada → `duplicado`. **Duplicar é impossível por estrutura** |
 * | sem jornada | `PixelEvent` com `eventId = gw:<pedido>` — a reentrega do gateway não vira evento novo, porque o id deriva do pedido |
 *
 * > ### ⛔ A dedup por `fbclid` FOI REMOVIDA — não a traga de volta
 * > Ela era `if (fbclid) { ...procura evento do navegador em 6h... }`, e `fbclid`
 * > **só existe para tráfego de anúncio do Facebook**. Em tráfego direto o bloco
 * > inteiro era pulado e o checkout contava em dobro — foi o bug relatado em
 * > 05/08/2026. O problema não era a janela de 6h: era a chave ausente.
 * >
 * > Marcar na jornada não tem janela nem chave para faltar.
 *
 * Nunca lança: registrar o evento não pode derrubar a ingestão da venda.
 */
export async function registrarCheckoutDoGateway(
  saleId: string,
  gerouCheckout: boolean,
): Promise<VerdictoCheckout> {
  const veredicto = await decidir(saleId, gerouCheckout);
  await marcarEfeito(saleId, "checkout", veredicto.status, veredicto.erro);
  return veredicto.status;
}

type VerdictoCheckout = typeof CHECKOUT_CRIADO | typeof CHECKOUT_DUPLICADO | typeof CHECKOUT_IGNORADO | typeof CHECKOUT_ERRO;

/**
 * ⛔ A decisão vive numa função separada de propósito: o registro acontece em
 * UM lugar, no chamador acima. Espalhar `marcarEfeito` pelos sete pontos de
 * saída faria a próxima saída nova nascer sem registro — e uma saída sem
 * registro é exatamente o silêncio que estas colunas existem para acabar.
 */
async function decidir(
  saleId: string,
  gerouCheckout: boolean,
): Promise<{ status: VerdictoCheckout; erro?: string }> {
  // ⚠️ Quem decide é o EVENTO, não o status. Antes era `status === "PENDENTE"`,
  // e a suposição quebrou ao separar ABANDONADA de PENDENTE: um carrinho
  // abandonado chegou ao checkout, mas deixaria de gerar InitiateCheckout — o
  // funil encolheria como efeito colateral invisível de uma correção de KPI.
  if (!gerouCheckout) return { status: CHECKOUT_IGNORADO };
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: {
        userId: true,
        status: true,
        externalId: true,
        pedidoId: true,
        timestamp: true,
        clickId: true,
        click: { select: { fbclid: true } },
      },
    });
    if (!sale) return { status: CHECKOUT_IGNORADO };

    /**
     * 🔴 A JORNADA é a chave, e é o que acabou com o checkout duplicado.
     *
     * Antes, a dedup contra o evento do navegador era `if (fbclid) { ... }` — e
     * `fbclid` **só existe para tráfego de anúncio do Facebook**. Em tráfego
     * direto o bloco inteiro era pulado, o evento do gateway era criado sempre, e
     * a mesma jornada aparecia duas vezes no funil e no feed.
     *
     * Marcar na jornada torna duplicar **impossível por estrutura**: se o
     * navegador já marcou, esta chamada não move nada (o `WHERE` monotônico
     * recusa) e o veredicto é `duplicado`. Se ninguém marcou, esta marca — e é a
     * ÚNICA. Não há janela de dedup, não há chave para faltar.
     *
     * ⚠️ A precedência de instante é a do módulo: vence o mais ANTIGO, porque o
     * clique no botão vem antes de o gateway gerar o PIX.
     */
    if (sale.clickId) {
      const moveu = await marcarCheckoutDaJornada(sale.clickId, sale.timestamp, "gateway");
      return { status: moveu ? CHECKOUT_CRIADO : CHECKOUT_DUPLICADO };
    }

    // ⚠️ A chave é o PEDIDO, não o item. Com order bump, um único checkout vira
    // N linhas de venda — e uma chave por linha geraria N InitiateCheckout para
    // o mesmo carrinho, inflando o topo do funil e derrubando a taxa de
    // conversão. `pedidoId` é NULO em venda antiga, e aí o `externalId` continua
    // sendo a chave, exatamente como antes.
    const chave = sale.pedidoId ?? sale.externalId;
    const eventId = chave ? `gw:${chave}` : null;
    if (!eventId) return { status: CHECKOUT_IGNORADO };

    /**
     * ── Daqui para baixo: venda SEM jornada casada ────────────────────────────
     *
     * Não houve `click_id`, `fbclid` nem IP que ligassem a venda a um clique
     * nosso — o comprador nunca passou pelo nosso script, ou o casamento falhou.
     * O checkout **aconteceu** (o gateway gerou cobrança), então ele precisa
     * contar; só não há jornada onde marcá-lo.
     *
     * Continua como `PixelEvent` com `eventId = gw:<pedido>`, que é o que o funil
     * soma como "checkout sem jornada identificada".
     *
     * ⚠️ Aqui **não existe risco de duplicar com o navegador**: sem jornada
     * casada, o evento do navegador (se houve) também ficou sem jornada, e o
     * funil conta os dois separadamente — mas esse é o caso em que não há como
     * afirmar que são a mesma pessoa. Fundi-los é que seria o erro.
     */
    const jaExiste = await prisma.pixelEvent.findFirst({
      where: { userId: sale.userId, event: "InitiateCheckout", eventId },
      select: { id: true },
    });
    // A reentrega do gateway é o caso comum: `gw:<pedido>` é derivado do pedido,
    // então o mesmo `PIX_GENERATED` reentregue não vira evento novo.
    if (jaExiste) return { status: CHECKOUT_DUPLICADO };
    const fbclid = sale.click?.fbclid ?? null;

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
    return { status: CHECKOUT_CRIADO };
  } catch (e) {
    console.error("[checkoutEvent] falha ao registrar InitiateCheckout do gateway:", e);
    /**
     * 🔴 Antes isto devolvia `"ignorado"` — o MESMO valor de "esta venda não
     * gera checkout", que é um desfecho perfeitamente correto.
     *
     * Colapsar os dois tornava a falha indistinguível do caso normal, inclusive
     * para quem fosse investigar depois: um funil menor do que deveria e nada,
     * em lugar nenhum, dizendo que houve erro. É a regra do `NULL` que não
     * significa a mesma coisa em toda coluna, aplicada a um valor de retorno.
     */
    return { status: CHECKOUT_ERRO, erro: mensagemCurta(e) };
  }
}
