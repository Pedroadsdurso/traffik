import { prisma } from "@/lib/prisma";

/**
 * # A etapa "checkout iniciado" pertence à JORNADA, não ao evento
 *
 * ## O defeito que isto substitui
 *
 * O checkout era um `PixelEvent`, e havia **duas fontes criando o seu**:
 *
 * | Fonte | Quando | `eventId` |
 * |---|---|---|
 * | `px.js` no navegador | clique no link de checkout | `InitiateCheckout-<hash>` |
 * | webhook do gateway | PIX gerado / carrinho abandonado | `gw:<pedidoId>` |
 *
 * A dedup entre elas era chaveada em **`fbclid`** — nas duas pontas
 * (`checkoutEvent.ts` pulava o bloco inteiro sem ele; o funil caía no `eventId`,
 * que difere por construção). E `fbclid` **só existe para tráfego de anúncio do
 * Facebook**.
 *
 * Então, em tráfego direto, a mesma jornada aparecia **duas vezes** — no funil e
 * no feed, com origens diferentes. Não era janela de dedup curta demais: era
 * chave ausente.
 *
 * > ### ⛔ Duplicar deixou de ser possível — por ESTRUTURA, não por dedup
 * > As duas fontes agora escrevem na **mesma linha** (`Click.checkoutAt`). Não há
 * > janela para acertar, não há chave para faltar. É o mesmo princípio do upsert
 * > monotônico de vendas: quem resolve o conflito é o banco, não uma comparação
 * > no código.
 *
 * ## A responsabilidade que isto separa
 *
 * - **RASTREAMENTO (`Click`) é dono do funil**: clique, visita, checkout.
 * - **PIXEL é despachante**: manda `InitiateCheckout`/`Purchase`/`Lead`/
 *   `AddToCart` para a Meta e pronto.
 *
 * `PixelEvent` continua sendo gravado — ele é o registro do que foi DESPACHADO
 * (com `espelho`, `detectores`, `ambiente`), e é disso que o diagnóstico da
 * gaveta vive. Ele só deixou de ser a fonte do funil.
 */

/** Quem detectou o checkout. O navegador vê antes; o gateway confirma. */
export type FonteDoCheckout = "navegador" | "gateway";

/**
 * Marca que uma jornada chegou ao checkout.
 *
 * > ### ⚠️ Vence o instante MAIS ANTIGO, e isso não é detalhe
 * > O clique no botão de compra acontece **antes** de o gateway gerar o PIX. Se o
 * > webhook sobrescrevesse, a etapa andaria para a frente no tempo — e num
 * > período curto ("Hoje", "Ontem") o checkout sairia da janela em que a visita
 * > que o gerou está, quebrando a leitura do funil.
 * >
 * > O `WHERE` faz a comparação, então **duas escritas concorrentes convergem**
 * > para o mesmo resultado independentemente da ordem de chegada. É o padrão da
 * > casa: quem decide o vencedor é o banco.
 *
 * ⚠️ `checkoutSource` só é gravado junto do instante que venceu. Sobrescrever a
 * fonte sem sobrescrever o instante faria a linha dizer "detectado pelo gateway"
 * sobre um instante que veio do navegador.
 *
 * Nunca lança: marcar o funil não pode derrubar a ingestão de uma venda nem o
 * despacho de um evento para a Meta.
 *
 * @returns `true` se ESTA chamada moveu o instante (serve para o log dizer se
 *          houve efeito, em vez de afirmar sucesso sobre um no-op).
 */
export async function marcarCheckoutDaJornada(
  clickId: string,
  quando: Date,
  fonte: FonteDoCheckout,
): Promise<boolean> {
  try {
    const r = await prisma.click.updateMany({
      where: {
        id: clickId,
        // Passa quando ainda não há checkout, ou quando este é mais antigo que o
        // gravado. Monotônico e independente de ordem.
        OR: [{ checkoutAt: null }, { checkoutAt: { gt: quando } }],
      },
      data: { checkoutAt: quando, checkoutSource: fonte },
    });
    return r.count > 0;
  } catch (e) {
    console.error("[checkoutDaJornada] falha ao marcar o checkout do clique", clickId, e);
    return false;
  }
}
