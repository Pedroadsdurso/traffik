import type { PaymentMethod } from "@/generated/prisma/enums";

/**
 * # Faturamento líquido e lucro — UMA conta, um lugar
 *
 * ## Por que existe
 *
 * A conta de lucro estava dentro de `computeExpenses` + `summarize` em
 * `dashboard/metrics.ts`, e a `AdsTable` fazia a **sua própria** ("lucro bruto =
 * faturamento − gasto", documentado como divergência aceita). Ao acrescentar
 * "Faturamento líquido" e "Lucro" como cards, haveria uma terceira conta.
 *
 * Aqui a composição é explícita e devolvida **item por item**, porque o tooltip
 * precisa mostrar de onde cada desconto saiu — um número de lucro sem a
 * decomposição é impossível de conferir.
 *
 * ## A cadeia
 *
 * ```
 *   Faturamento bruto        (vendas APROVADAS no período)
 * − Taxa de gateway         (por forma de pagamento)
 * − Coprodução / afiliados  (% sobre o faturamento)
 * − Impostos                (alíquotas)
 * − Custo de produto
 * = FATURAMENTO LÍQUIDO
 * − Gasto com anúncios      (Meta)
 * − Despesas recorrentes
 * = LUCRO
 * ```
 *
 * ## ⚠️ Desconto não cadastrado vale ZERO, e isso é perigoso
 *
 * Nenhum item é obrigatório: quem não cadastrou imposto tem `impostos: 0`. Isso
 * evita quebrar a conta, mas faz o líquido aparecer **maior que a realidade** — e
 * o número continua plausível, então nada denuncia sozinho. Por isso
 * `faltando` devolve quais descontos estão ausentes, e a UI é obrigada a dizer.
 * **Não remova esse campo sem antes tornar as taxas obrigatórias.**
 */

/** Uma despesa cadastrada, no formato que a conta precisa. */
export interface DespesaEntrada {
  type: string;
  calc: string;
  amount: number;
  paymentMethod: PaymentMethod | null;
}

export interface Composicao {
  /** Faturamento das vendas APROVADAS no período. */
  bruto: number;
  gateway: number;
  coproducao: number;
  impostos: number;
  custoProduto: number;
  /** bruto − (gateway + coprodução + impostos + custo de produto) */
  liquido: number;
  /** Gasto com anúncios (Meta) no período. */
  gastoAnuncios: number;
  /** Despesas recorrentes rateadas no período. */
  despesas: number;
  /** liquido − gastoAnuncios − despesas */
  lucro: number;
  /**
   * Soma dos descontos sobre o faturamento (sem gasto de anúncio e sem
   * despesas). É o `expenses.total` que o resto do código já esperava.
   */
  totalDescontos: number;
  /** Custo total: descontos + anúncios + despesas. Base do ROI. */
  custoTotal: number;
  /** `lucro / bruto` em %. `0` quando não houve faturamento. */
  margem: number;
  /**
   * ROI como MULTIPLICADOR (`lucro / custoTotal`).
   *
   * ⚠️ `null` quando não houve custo — e não `0`. "0,00x" se lê como empate, o
   * que é falso para quem faturou sem gastar nada.
   */
  roi: number | null;
  /** Tipos de desconto que NÃO estão cadastrados. Ver o aviso acima. */
  faltando: RotuloDesconto[];
}

export type RotuloDesconto = "taxa do gateway" | "imposto" | "coprodução" | "custo de produto";

const POR_TIPO: Record<string, RotuloDesconto> = {
  TAXA_GATEWAY: "taxa do gateway",
  IMPOSTO: "imposto",
  COPRODUCAO: "coprodução",
  CUSTO_PRODUTO: "custo de produto",
};

/**
 * Aplica uma despesa: percentual sobre a base, ou valor fixo.
 *
 * ⚠️ A base do **gateway** é o faturamento DAQUELA forma de pagamento, não o
 * total: uma taxa de 4,9% do cartão não incide sobre o que entrou por Pix.
 */
function aplicar(e: DespesaEntrada, base: number): number {
  return e.calc === "PERCENTUAL" ? (base * e.amount) / 100 : e.amount;
}

export function calcularFinanceiro(opts: {
  /** Faturamento das vendas APROVADAS. */
  bruto: number;
  /** Faturamento aprovado por forma de pagamento — base da taxa de gateway. */
  brutoPorPagamento: Map<PaymentMethod, number>;
  gastoAnuncios: number;
  despesas: DespesaEntrada[];
}): Composicao {
  const { bruto, brutoPorPagamento, gastoAnuncios } = opts;

  let gateway = 0;
  let impostos = 0;
  let coproducao = 0;
  let custoProduto = 0;
  let recorrentes = 0;
  const cadastrados = new Set<RotuloDesconto>();

  for (const e of opts.despesas) {
    const rotulo = POR_TIPO[e.type];
    if (rotulo) cadastrados.add(rotulo);

    switch (e.type) {
      case "TAXA_GATEWAY":
        gateway += aplicar(e, e.paymentMethod ? brutoPorPagamento.get(e.paymentMethod) ?? 0 : bruto);
        break;
      case "IMPOSTO":
        impostos += aplicar(e, bruto);
        break;
      case "COPRODUCAO":
        coproducao += aplicar(e, bruto);
        break;
      case "CUSTO_PRODUTO":
        custoProduto += aplicar(e, bruto);
        break;
      default:
        // DESPESA_RECORRENTE — custo fixo do período, não incide sobre venda.
        recorrentes += e.amount;
    }
  }

  const totalDescontos = gateway + coproducao + impostos + custoProduto;
  const liquido = bruto - totalDescontos;
  const lucro = liquido - gastoAnuncios - recorrentes;
  const custoTotal = totalDescontos + gastoAnuncios + recorrentes;

  return {
    bruto,
    gateway,
    coproducao,
    impostos,
    custoProduto,
    liquido,
    gastoAnuncios,
    despesas: recorrentes,
    lucro,
    totalDescontos,
    custoTotal,
    margem: bruto ? (lucro / bruto) * 100 : 0,
    /**
     * ⚠️ `null` também quando NÃO HOUVE MOVIMENTO — não só quando o custo é zero.
     *
     * A conta é matematicamente correta em qualquer caso, mas uma despesa fixa
     * cadastrada (R$ 20/mês, por exemplo) sozinha produzia `lucro = −20`,
     * `custoTotal = 20` e portanto **−1,00x em vermelho num painel zerado** — a
     * tela gritando prejuízo num período em que nada aconteceu.
     *
     * Sem faturamento E sem gasto de anúncio não existe retorno a medir. A tela
     * mostra "—", que é a resposta honesta.
     */
    roi: bruto === 0 && gastoAnuncios === 0 ? null : custoTotal > 0 ? lucro / custoTotal : null,
    faltando: (Object.values(POR_TIPO) as RotuloDesconto[]).filter((r) => !cadastrados.has(r)),
  };
}

/**
 * Cor de uma métrica financeira, pela regra do produto (30/07/2026).
 *
 * - **Abaixo do ponto de equilíbrio é sempre VERMELHO.** Prejuízo tem de saltar
 *   aos olhos.
 * - **ROI e ROAS acima do equilíbrio são VERDES**; são notas de desempenho.
 * - **Lucro e margem positivos ficam na cor NORMAL do texto**, sem `+`. Pintar
 *   todo lucro de verde tira o contraste de quando algo dá errado — e o `+` num
 *   valor em reais parece erro de digitação.
 *
 * ## ⚠️ O equilíbrio do ROAS é 1x, o do ROI é 0
 *
 * São escalas diferentes e **não podem usar o mesmo corte**:
 *
 * | | Equilíbrio | Abaixo significa |
 * |---|---|---|
 * | ROI (`lucro / custo`) | **0** | prejuízo |
 * | ROAS (`faturamento / gasto`) | **1** | gastou mais do que faturou |
 *
 * `ROAS 0,80x` é positivo como número e **é prejuízo** — cada R$ 1 de anúncio
 * devolveu 80 centavos. Tratá-lo como "positivo = verde" pintaria de verde uma
 * campanha que está queimando dinheiro.
 *
 * ⚠️ Use isto em TODA tela onde essas métricas aparecem (Dashboard, Gerenciador,
 * relatórios). Uma cor decidida na view é uma cor que divergirá.
 */
export function corFinanceira(valor: number | null, tipo: "roi" | "lucro" | "roas"): string {
  const VERMELHO = "var(--color-danger, #f87171)";
  const VERDE = "var(--color-success, #4ade80)";
  const NORMAL = "var(--color-text)";

  // ⚠️ `null` é NEUTRO. Quem chama passa `null` quando a métrica é indefinida —
  // sem gasto não existe ROAS, e sem movimento nenhum não existe ROI. Pintar
  // esse caso de vermelho é o que fazia um painel zerado gritar prejuízo.
  if (valor === null) return NORMAL;

  // O equilíbrio de cada escala. Ver a tabela acima.
  const equilibrio = tipo === "roas" ? 1 : 0;
  if (valor === equilibrio) return NORMAL;
  if (valor < equilibrio) return VERMELHO;
  return tipo === "lucro" ? NORMAL : VERDE;
}
