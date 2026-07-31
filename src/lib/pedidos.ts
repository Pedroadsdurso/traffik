/**
 * # CONVERSÃO ≠ ITEM VENDIDO
 *
 * Um checkout com order bump gera **duas linhas de venda e uma conversão**. As
 * duas contagens existem e servem a perguntas diferentes:
 *
 * | Pergunta | Conta |
 * |---|---|
 * | Quanto faturei? | **linhas** — 90 + 27 = 117 |
 * | Quantas conversões tive? | **pedidos** — 1 |
 * | Quanto custou cada conversão (CPA)? | gasto ÷ **pedidos** |
 * | Qual o ticket médio? | faturamento ÷ **pedidos** (é o valor do carrinho) |
 * | Quanto vendi de cada produto? | **linhas** — é onde o item é o assunto |
 *
 * ## ⛔ Por que isto não pode ser `array.length`
 *
 * `salesCount = approved.length` contava itens. Com order bump, o **CPA cai pela
 * metade** e a taxa de conversão do funil infla — e os dois continuam parecendo
 * números plausíveis, que é o pior tipo de erro. Order bump e upsell existem em
 * praticamente todo gateway do mercado, então isto não é um caso de borda: é o
 * caso normal de quem vende bem.
 *
 * ## ⚠️ O fallback para `id` é o que preserva o histórico
 *
 * Venda gravada antes da migration tem `pedidoId` NULO. Aí ela **é** o próprio
 * pedido — que é exatamente o comportamento anterior. Sem esse fallback, toda
 * venda antiga colapsaria num único pedido `null` e o CPA histórico explodiria.
 */

/** O mínimo que uma linha precisa ter para ser agrupada em pedidos. */
export interface LinhaDePedido {
  id: string;
  pedidoId?: string | null;
}

/**
 * Chave do pedido de uma linha.
 *
 * ⚠️ NUNCA devolve `null`: uma venda sem agrupador é o próprio pedido. Devolver
 * `null` faria todas elas caírem no mesmo balde.
 */
export function chaveDoPedido(v: LinhaDePedido): string {
  return v.pedidoId ?? v.id;
}

/** Quantas CONVERSÕES existem nesta lista de linhas de venda. */
export function contarPedidos(vendas: readonly LinhaDePedido[]): number {
  const chaves = new Set<string>();
  for (const v of vendas) chaves.add(chaveDoPedido(v));
  return chaves.size;
}

/**
 * Agrupa as linhas por pedido, preservando a ordem de primeira aparição.
 *
 * Útil quando a conta precisa de um representante por pedido (o país da
 * conversão, o horário dela) em vez de só do total — somar por linha ali
 * contaria o mesmo comprador duas vezes.
 */
export function agruparPorPedido<T extends LinhaDePedido>(vendas: readonly T[]): T[][] {
  const grupos = new Map<string, T[]>();
  for (const v of vendas) {
    const k = chaveDoPedido(v);
    const atual = grupos.get(k);
    if (atual) atual.push(v);
    else grupos.set(k, [v]);
  }
  return [...grupos.values()];
}

/**
 * Um representante por pedido — o primeiro item que apareceu.
 *
 * ⚠️ Para dimensões que descrevem a COMPRA (país, horário, forma de pagamento),
 * não o item. Os itens de um mesmo checkout compartilham essas dimensões, então
 * contar linha inflaria o ranking do país e o gráfico por horário.
 */
export function umPorPedido<T extends LinhaDePedido>(vendas: readonly T[]): T[] {
  return agruparPorPedido(vendas).map((g) => g[0]);
}
