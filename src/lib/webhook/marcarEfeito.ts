import { prisma } from "@/lib/prisma";

/**
 * Grava o desfecho de um efeito pós-venda nas colunas da `Sale`.
 *
 * ## ⛔ NUNCA lança — e isso não é zelo, é a única forma de a coluna ser confiável
 *
 * Se registrar a falha pudesse falhar, o efeito ganharia um segundo modo de
 * falha silenciosa exatamente onde estamos tentando acabar com o primeiro. Pior:
 * uma exceção aqui subiria pelo `catch` do chamador e viraria "erro no efeito",
 * atribuindo ao Purchase um problema que é do nosso `UPDATE`.
 *
 * Mesma regra do `logWebhook.ts`, pelo mesmo motivo.
 *
 * ⚠️ `updateMany` e não `update`: a venda pode ter sido apagada entre a ingestão
 * e o `after()` (exclusão de área com "apagar dados"). `update` lançaria P2025;
 * `updateMany` com 0 linhas é o desfecho correto — não há mais o que anotar.
 *
 * ⚠️ Este módulo importa Prisma de propósito, separado de `efeitos.ts`, que é
 * puro porque a UI o consome. Juntar os dois arrastaria o driver `pg` para o
 * bundle do cliente — ver a lição de `lib/areas/taxas.ts`.
 */
export async function marcarEfeito(
  saleId: string,
  efeito: "capi" | "checkout" | "notif",
  status: string,
  erro?: string | null,
): Promise<void> {
  try {
    await prisma.sale.updateMany({
      where: { id: saleId },
      data:
        efeito === "capi"
          ? { capiStatus: status, capiErro: erro ?? null }
          : efeito === "checkout"
            ? { checkoutStatus: status, checkoutErro: erro ?? null }
            : { notifStatus: status, notifErro: erro ?? null },
    });
  } catch (e) {
    console.error(`[marcarEfeito] ${efeito} da venda ${saleId}:`, e);
  }
}
