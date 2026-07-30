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
export function faltamTaxas(tipos: string[]): string[] {
  const falta: string[] = [];
  if (!tipos.includes("TAXA_GATEWAY")) falta.push("taxa do gateway");
  if (!tipos.includes("IMPOSTO")) falta.push("imposto");
  return falta;
}
