import { prisma } from "@/lib/prisma";

/**
 * Alíquota do imposto sobre o GASTO com anúncios, em % — `0` quando desligado.
 *
 * Fica FORA de `actions/*` pelo mesmo motivo do `getUserTimezone`: aqueles
 * módulos são `"use server"` e importam o `@/auth`, o que transformaria este
 * helper num endpoint e arrastaria o NextAuth para dentro de `metrics.ts`, que
 * também roda em cron, sem request nenhum.
 *
 * ## 🔴 Por que a base é o GASTO e não o faturamento
 *
 * A Meta reporta o gasto **líquido**: o tributo que incide sobre o anúncio nunca
 * chega em `DailyAdMetric.spend`. Sem esta linha o lucro sai sistematicamente
 * maior que a realidade, por uma fração fixa do investimento.
 *
 * Modelar isso como uma despesa do tipo `IMPOSTO` seria pior que não ter: lá a
 * base é o faturamento, então a alíquota certa incidiria sobre o número errado —
 * e o resultado teria a mesma ordem de grandeza sempre que faturamento e gasto
 * forem parecidos, que é exatamente o caso de quem está perto do ponto de
 * equilíbrio. Erro invisível por construção.
 *
 * ## ⚠️ Falha de leitura devolve 0, e isso é deliberado
 *
 * Zero significa "não descontamos imposto de anúncio", que é o estado de quem
 * não ligou o recurso — a grande maioria. O erro para o lado de exibir um lucro
 * **otimista**, que é o comportamento que a ferramenta já tinha antes desta
 * coluna existir; inventar uma alíquota que o usuário não configurou seria pior,
 * porque mudaria o lucro exibido por causa de uma falha de banco.
 *
 * O fallback é registrado, não engolido — mesma regra do `getUserTimezone`.
 */
export async function getImpostoAnunciosPct(userId: string): Promise<number> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { impostoAnunciosAtivo: true, impostoAnunciosPct: true },
    });
    if (!u?.impostoAnunciosAtivo) return 0;
    const pct = Number(u.impostoAnunciosPct);
    // Valor ilegível na coluna: não dá para descontar um imposto que não sabemos
    // qual é. Volta a zero e diz por quê.
    if (!Number.isFinite(pct) || pct < 0) {
      console.error(
        `[impostoAnuncios] aliquota invalida para o usuario ${userId}: ${JSON.stringify(u.impostoAnunciosPct)} — ` +
          `usando 0. O lucro deste carregamento nao desconta o imposto do anuncio.`,
      );
      return 0;
    }
    return pct;
  } catch (e) {
    console.error(
      `[impostoAnuncios] falha ao ler a aliquota do usuario ${userId} — usando 0. ` +
        `Se este usuario tem o imposto ligado, o lucro deste carregamento esta MAIOR que a realidade.`,
      e,
    );
    return 0;
  }
}
