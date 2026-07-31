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

/**
 * De onde saiu um desconto, quando parte das vendas informa o valor real e
 * parte não. **Período misto é o caso NORMAL**, não a exceção: basta ter dois
 * gateways, ou um gateway que só informa a taxa em alguns eventos.
 */
export interface FonteDoDesconto {
  /** Somado do que os gateways informaram, venda a venda. */
  real: number;
  /** Calculado pela taxa cadastrada, para as vendas que não informaram. */
  estimado: number;
  vendasComValorReal: number;
  vendasSemValorReal: number;
}

/** Uma venda, no mínimo que a conta precisa saber. */
export interface VendaParaFinanceiro {
  valor: number;
  formaPagamento: PaymentMethod;
  /** NULO = gateway não informou. ZERO = informou que não cobrou. */
  taxaGateway: number | null;
  coproducao: number | null;
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
  /**
   * A procedência de cada desconto.
   *
   * ⚠️ **A tela é OBRIGADA a mostrar isto quando há mistura.** Um Faturamento
   * Líquido que soma valor medido com estimativa, sem dizer qual é qual, é pior
   * que não ter o dado: o número parece exato e não é. Exigência explícita do
   * usuário em 31/07/2026.
   */
  fontes: { gateway: FonteDoDesconto; coproducao: FonteDoDesconto };
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
  /**
   * As vendas aprovadas do período, para usar a taxa REAL de quem informou.
   *
   * Omitir mantém o comportamento anterior (tudo pela taxa cadastrada) — é o
   * que os testes puros e qualquer chamador antigo esperam.
   */
  vendas?: VendaParaFinanceiro[];
}): Composicao {
  const { bruto, brutoPorPagamento, gastoAnuncios } = opts;

  // ── Taxas REPORTADAS pelo gateway ────────────────────────────────────────
  //
  // O que o gateway informou é medida; a taxa cadastrada é média. Onde há
  // medida, ela vence — e a base da taxa cadastrada encolhe para não descontar
  // duas vezes da mesma venda.
  const vendas = opts.vendas ?? [];
  const zerada = (): FonteDoDesconto => ({ real: 0, estimado: 0, vendasComValorReal: 0, vendasSemValorReal: 0 });
  const fGateway = zerada();
  const fCoprod = zerada();
  // Faturamento que AINDA precisa da taxa cadastrada, por forma de pagamento.
  const baseSemTaxaReal = new Map<PaymentMethod, number>();
  let baseSemCoprodReal = 0;

  for (const v of vendas) {
    if (v.taxaGateway != null) {
      fGateway.real += v.taxaGateway;
      fGateway.vendasComValorReal += 1;
    } else {
      fGateway.vendasSemValorReal += 1;
      baseSemTaxaReal.set(v.formaPagamento, (baseSemTaxaReal.get(v.formaPagamento) ?? 0) + v.valor);
    }
    if (v.coproducao != null) {
      fCoprod.real += v.coproducao;
      fCoprod.vendasComValorReal += 1;
    } else {
      fCoprod.vendasSemValorReal += 1;
      baseSemCoprodReal += v.valor;
    }
  }

  // Sem lista de vendas, a base da taxa cadastrada é o faturamento inteiro —
  // exatamente como antes.
  const baseGateway = opts.vendas ? baseSemTaxaReal : brutoPorPagamento;
  const baseGatewayTotal = opts.vendas ? [...baseSemTaxaReal.values()].reduce((x, y) => x + y, 0) : bruto;
  const baseCoprod = opts.vendas ? baseSemCoprodReal : bruto;

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
      case "TAXA_GATEWAY": {
        const base = e.paymentMethod ? baseGateway.get(e.paymentMethod) ?? 0 : baseGatewayTotal;
        const valor = aplicar(e, base);
        fGateway.estimado += valor;
        gateway += valor;
        break;
      }
      case "IMPOSTO":
        impostos += aplicar(e, bruto);
        break;
      case "COPRODUCAO": {
        const valor = aplicar(e, baseCoprod);
        fCoprod.estimado += valor;
        coproducao += valor;
        break;
      }
      case "CUSTO_PRODUTO":
        custoProduto += aplicar(e, bruto);
        break;
      default:
        // DESPESA_RECORRENTE — custo fixo do período, não incide sobre venda.
        recorrentes += e.amount;
    }
  }

  // O que o gateway informou entra somado ao que a taxa cadastrada cobriu.
  gateway += fGateway.real;
  coproducao += fCoprod.real;

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
    // ⚠️ Não acusa "falta cadastrar" o que os gateways já informaram em TODAS
    // as vendas do período — cobrar cadastro de um número que já é medido
    // treinaria o usuário a ignorar o aviso.
    faltando: (Object.values(POR_TIPO) as RotuloDesconto[]).filter((r) => {
      if (cadastrados.has(r)) return false;
      if (r === "taxa do gateway") return fGateway.vendasSemValorReal > 0 || fGateway.vendasComValorReal === 0;
      if (r === "coprodução") return fCoprod.vendasSemValorReal > 0 || fCoprod.vendasComValorReal === 0;
      return true;
    }),
    fontes: { gateway: fGateway, coproducao: fCoprod },
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
