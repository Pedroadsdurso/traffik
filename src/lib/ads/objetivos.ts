/**
 * Os objetivos ODAX da Marketing API, em português.
 *
 * ⚠️ **Uma lista, e não uma por tela.** Ela nasceu dentro do modal de criar
 * campanha; quando o subtítulo `Objetivo` entrou na tabela (`06` §14.4) e o
 * filtro por objetivo apareceu no Gerenciador, os três precisavam do mesmo
 * mapa — e três cópias divergem no primeiro objetivo que a Meta acrescentar.
 *
 * ⚠️ Os nomes antigos (`LINK_CLICKS`, `CONVERSIONS`, `POST_ENGAGEMENT`…) foram
 * descontinuados pela Meta, mas **continuam no banco** em campanha sincronizada
 * antes da migração ODAX. Eles não estão aqui de propósito: o `rotuloDoObjetivo`
 * devolve o valor CRU quando não conhece a chave — mesma regra do
 * `effective_status` em `veiculacao.ts`. Traduzir por chute seria pior, e o
 * valor cru é o que permite acrescentá-lo aqui sem precisar reproduzir o caso.
 */

export const OBJETIVOS_ODAX: { valor: string; rotulo: string }[] = [
  { valor: "OUTCOME_TRAFFIC", rotulo: "Tráfego" },
  { valor: "OUTCOME_SALES", rotulo: "Vendas" },
  { valor: "OUTCOME_LEADS", rotulo: "Cadastros" },
  { valor: "OUTCOME_ENGAGEMENT", rotulo: "Engajamento" },
  { valor: "OUTCOME_AWARENESS", rotulo: "Reconhecimento" },
  { valor: "OUTCOME_APP_PROMOTION", rotulo: "Promoção de app" },
];

const POR_VALOR = new Map(OBJETIVOS_ODAX.map((o) => [o.valor, o.rotulo]));

/**
 * O rótulo de um objetivo.
 *
 * ⚠️ `null` devolve **string vazia**, não "Sem objetivo": nulo aqui significa
 * que a campanha nunca sincronizou, e toda campanha da Meta tem um objetivo.
 * Escrever "Sem objetivo" na linha afirmaria algo que não é verdade sobre ela.
 */
export function rotuloDoObjetivo(objetivo: string | null | undefined): string {
  if (!objetivo) return "";
  return POR_VALOR.get(objetivo) ?? objetivo;
}
