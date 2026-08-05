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

/**
 * Sentinela da opcao "Todas as formas" no cadastro de taxa de gateway.
 *
 * ## 🔴 Por que nao pode ser `OUTRO`
 *
 * `OUTRO` e uma forma de pagamento REAL do enum `PaymentMethod` — e
 * `mapPayment` devolve `OUTRO` para tudo que ele nao reconhece. A tela oferecia
 * `{ value: "OUTRO", label: "Todas" }`, entao uma taxa cadastrada como "Todas"
 * incidia **so sobre as vendas classificadas como Outro**, e as vendas de
 * metodo nao reconhecido levavam essa taxa em vez da de Pix ou cartao. Era
 * exatamente o "a taxa de uma entra na conta da outra" relatado nos testes.
 *
 * O suporte a taxa global sempre existiu (`paymentMethod: null` usa o
 * faturamento inteiro como base) — a tela e que nao tinha como produzi-lo.
 *
 * ⚠️ Vale so na INTERFACE. No banco continua `null`; nunca grave esta string.
 */
export const TODAS_AS_FORMAS = "__TODAS__";

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
  /**
   * Chave do PEDIDO — o agrupador do checkout.
   *
   * > ### 🔴 SEM ISTO A TAXA POR VENDA VIRA TAXA POR ITEM, EM SILÊNCIO
   * > Uma taxa de "R$ 2,50 por venda" é cobrada uma vez por **compra**, não uma
   * > vez por linha. Um checkout com order bump grava 2 linhas e 1 pedido: sem a
   * > chave, o desconto sairia R$ 5,00 e o Faturamento Líquido apareceria menor
   * > que a realidade — plausível e errado, que é a assinatura desta classe de
   * > bug neste projeto.
   * >
   * > ⚠️ **É a mesma armadilha do `pedidoId` fora do `select`**: quem monta esta
   * > lista precisa TRAZER a coluna. Sem ela `chaveDoPedido` cai no `id` da
   * > linha e tudo volta a ser por item, sem `tsc`/`lint`/`build` acusarem nada.
   */
  chavePedido: string;
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
  /**
   * Imposto sobre o gasto com anúncios. `0` quando desligado.
   *
   * ⚠️ Fica FORA de `totalDescontos` de propósito: aquilo é o que incide sobre
   * o faturamento. Este é custo de mídia, e entra no lucro e no custo total.
   */
  impostoAnuncios: number;
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
 * Aplica uma despesa: percentual sobre a base, ou valor fixo **por pedido**.
 *
 * ## Os três modos que a tela oferece
 *
 * | Modo | `type` / `calc` | Como incide |
 * |---|---|---|
 * | % por venda | qualquer / `PERCENTUAL` | sobre o faturamento da base |
 * | R$ por venda | qualquer / `FIXO` | × número de **pedidos** da base |
 * | R$ por mês | `DESPESA_RECORRENTE` | uma vez no período, não passa por aqui |
 *
 * > ### 🔴 `FIXO` incidia UMA VEZ, no período inteiro
 * > `return e.amount` sem multiplicar. Uma taxa de "R$ 2,50 por venda" com 40
 * > vendas no mês descontava R$ 2,50 — e o Faturamento Líquido aparecia
 * > **R$ 97,50 maior que a realidade**, com o número continuando plausível.
 *
 * ⚠️ A base do **gateway** é o faturamento (ou a contagem) DAQUELA forma de
 * pagamento, não o total: uma taxa de 4,9% do cartão não incide sobre o que
 * entrou por Pix, e uma de R$ 1,00 por Pix não é cobrada nas vendas por cartão.
 */
function aplicar(e: DespesaEntrada, base: number, pedidos: number): number {
  return e.calc === "PERCENTUAL" ? (base * e.amount) / 100 : e.amount * pedidos;
}

/** Faturamento e nº de PEDIDOS de um recorte — as duas bases que `aplicar` usa. */
interface Base {
  valor: number;
  pedidos: number;
}

const BASE_ZERO: Base = { valor: 0, pedidos: 0 };

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
  /**
   * Alíquota do imposto sobre o GASTO com anúncios, em % (ex.: 12).
   *
   * ⚠️ `0` ou omitido = desligado. É diferente das despesas: a base aqui é o
   * gasto, não o faturamento.
   */
  impostoAnunciosPct?: number;
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

  /**
   * ⛔ AGRUPA POR PEDIDO ANTES DE QUALQUER CONTA.
   *
   * Taxa de gateway e coprodução são da **compra**, não do item. Um checkout com
   * order bump chega como 2 linhas e é 1 conversão — e as duas coisas que
   * dependem disso erram em direções opostas se a linha for a unidade:
   *
   * | | contando linhas | contando pedidos |
   * |---|---|---|
   * | taxa FIXA de R$ 2,50 | R$ 5,00 (dobrada) | R$ 2,50 |
   * | "taxa real em N de M vendas" | M inflado | M = conversões, igual ao resto do produto |
   *
   * ⚠️ Um pedido conta como "informou a taxa" se **qualquer** linha dele
   * informou — as parcelas são somadas. Exigir que todas informem faria o
   * pedido cair na taxa cadastrada **por cima** da parte já medida, que é
   * cobrar duas vezes da mesma compra.
   */
  interface Pedido {
    valor: number;
    forma: PaymentMethod;
    taxa: number | null;
    coprod: number | null;
  }
  const pedidos = new Map<string, Pedido>();
  for (const v of vendas) {
    const p = pedidos.get(v.chavePedido) ?? { valor: 0, forma: v.formaPagamento, taxa: null, coprod: null };
    p.valor += v.valor;
    if (v.taxaGateway != null) p.taxa = (p.taxa ?? 0) + v.taxaGateway;
    if (v.coproducao != null) p.coprod = (p.coprod ?? 0) + v.coproducao;
    pedidos.set(v.chavePedido, p);
  }

  // Faturamento e nº de pedidos que AINDA precisam da taxa cadastrada.
  const baseSemTaxaReal = new Map<PaymentMethod, Base>();
  let baseSemCoprodReal: Base = { valor: 0, pedidos: 0 };

  for (const p of pedidos.values()) {
    if (p.taxa != null) {
      fGateway.real += p.taxa;
      fGateway.vendasComValorReal += 1;
    } else {
      fGateway.vendasSemValorReal += 1;
      const cur = baseSemTaxaReal.get(p.forma) ?? { valor: 0, pedidos: 0 };
      baseSemTaxaReal.set(p.forma, { valor: cur.valor + p.valor, pedidos: cur.pedidos + 1 });
    }
    if (p.coprod != null) {
      fCoprod.real += p.coprod;
      fCoprod.vendasComValorReal += 1;
    } else {
      fCoprod.vendasSemValorReal += 1;
      baseSemCoprodReal = { valor: baseSemCoprodReal.valor + p.valor, pedidos: baseSemCoprodReal.pedidos + 1 };
    }
  }

  /**
   * Sem lista de vendas, a base é o faturamento inteiro — exatamente como antes.
   *
   * ⚠️ E `pedidos: 1`, que preserva o comportamento antigo do `FIXO` (incidir
   * uma vez). Um chamador que não passa as vendas **não tem como saber quantas
   * compras houve**, e chutar 0 apagaria a despesa em silêncio. Todo chamador
   * real passa a lista; isto cobre os testes puros e o legado.
   */
  const semLista: Base = { valor: bruto, pedidos: 1 };
  const baseGateway = (m: PaymentMethod): Base =>
    opts.vendas ? (baseSemTaxaReal.get(m) ?? BASE_ZERO) : { valor: brutoPorPagamento.get(m) ?? 0, pedidos: 1 };
  const baseGatewayTotal: Base = opts.vendas
    ? [...baseSemTaxaReal.values()].reduce(
        (a, b) => ({ valor: a.valor + b.valor, pedidos: a.pedidos + b.pedidos }),
        BASE_ZERO,
      )
    : semLista;
  const baseCoprod: Base = opts.vendas ? baseSemCoprodReal : semLista;
  /** Base das despesas que incidem sobre o faturamento inteiro (imposto, custo). */
  const baseTotal: Base = { valor: bruto, pedidos: opts.vendas ? pedidos.size : 1 };

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
        const base = e.paymentMethod ? baseGateway(e.paymentMethod) : baseGatewayTotal;
        const valor = aplicar(e, base.valor, base.pedidos);
        fGateway.estimado += valor;
        gateway += valor;
        break;
      }
      case "IMPOSTO":
        impostos += aplicar(e, baseTotal.valor, baseTotal.pedidos);
        break;
      case "COPRODUCAO": {
        const valor = aplicar(e, baseCoprod.valor, baseCoprod.pedidos);
        fCoprod.estimado += valor;
        coproducao += valor;
        break;
      }
      case "CUSTO_PRODUTO":
        custoProduto += aplicar(e, baseTotal.valor, baseTotal.pedidos);
        break;
      default:
        // DESPESA_RECORRENTE — custo fixo do PERÍODO, não incide sobre venda.
        // Não passa por `aplicar`: multiplicar por pedidos aqui transformaria a
        // mensalidade da ferramenta numa taxa por venda.
        recorrentes += e.amount;
    }
  }

  // O que o gateway informou entra somado ao que a taxa cadastrada cobriu.
  gateway += fGateway.real;
  coproducao += fCoprod.real;

  /**
   * Imposto sobre o GASTO com anúncios.
   *
   * 🔴 A Meta reporta o gasto LÍQUIDO: o tributo que incide sobre o anúncio
   * (no Brasil ~12%) nunca chega em `DailyAdMetric.spend`. Sem esta linha o
   * lucro sai sistematicamente maior que a realidade, por uma fração fixa do
   * investimento — e o número continua plausível, que é o que o torna caro.
   *
   * ⚠️ **Não entra em `totalDescontos`.** Aquele campo é o que incide sobre o
   * FATURAMENTO (é o `expenses.total` que o resto do código já espera, e a base
   * da linha "descontos" da tela). Somar aqui um custo de mídia misturaria as
   * duas naturezas e faria a decomposição do líquido deixar de fechar.
   *
   * Ele entra no LUCRO e no CUSTO TOTAL, que é onde ele de fato pesa.
   */
  const pctAnuncios = Math.max(0, opts.impostoAnunciosPct ?? 0);
  const impostoAnuncios = gastoAnuncios * (pctAnuncios / 100);

  const totalDescontos = gateway + coproducao + impostos + custoProduto;
  const liquido = bruto - totalDescontos;
  const lucro = liquido - gastoAnuncios - impostoAnuncios - recorrentes;
  const custoTotal = totalDescontos + gastoAnuncios + impostoAnuncios + recorrentes;

  return {
    bruto,
    gateway,
    coproducao,
    impostos,
    custoProduto,
    liquido,
    gastoAnuncios,
    impostoAnuncios,
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
