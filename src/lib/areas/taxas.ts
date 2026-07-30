/**
 * Helper PURO sobre taxas de uma área — sem Prisma, sem `"use server"`.
 *
 * ⚠️ Vive num módulo separado de propósito. Ele nasceu em `escopoConfig.ts`, que
 * importa `@/lib/prisma`; como `FeesView` é client component, isso arrastava o
 * driver `pg` (que usa `dns` e `fs`) para o bundle do navegador e **quebrava o
 * build**. Qualquer helper que a UI precise consumir tem de morar fora dos
 * módulos que tocam o banco.
 */

/**
 * Quais tipos de custo faltam nesta área.
 *
 * 🔴 Existe porque taxa isolada por área tem uma falha silenciosa embutida:
 * esquecer o imposto faz o lucro aparecer **maior do que é**, com número
 * plausível, e nada denuncia. Este é o que denuncia.
 */
/**
 * ⚠️ Os quatro descontos que compõem o Faturamento Líquido. Coprodução e custo de
 * produto entraram em 30/07/2026 — sem eles na lista, faltar uma comissão de
 * afiliado não gerava aviso nenhum e o líquido aparecia maior do que é.
 *
 * A ordem é a da cadeia de desconto, não alfabética.
 */
const DESCONTOS: [tipo: string, rotulo: string][] = [
  ["TAXA_GATEWAY", "taxa do gateway"],
  ["COPRODUCAO", "coprodução ou afiliado"],
  ["IMPOSTO", "imposto"],
  ["CUSTO_PRODUTO", "custo de produto"],
];

export function faltamTaxas(tipos: string[]): string[] {
  return DESCONTOS.filter(([t]) => !tipos.includes(t)).map(([, rotulo]) => rotulo);
}
