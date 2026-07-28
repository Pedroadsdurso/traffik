/**
 * Métricas derivadas das colunas do Gerenciador de Anúncios (Bloco 6).
 *
 * Ficam aqui, e não na view, porque as mesmas fórmulas valem para conta,
 * campanha, conjunto e anúncio — e porque divisão por zero em métrica de
 * performance é a fonte clássica de `NaN`/`Infinity` na tela.
 */

export interface LinhaBase {
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  revenue: number;
  /** Initiate Checkout atribuídos. Opcional: nem toda chamada tem o dado. */
  ic?: number;
}

export interface MetricasDerivadas {
  /** Faturamento ÷ gasto. */
  roas: number | null;
  /** Lucro ÷ gasto, como multiplicador. */
  roi: number | null;
  /** Gasto ÷ vendas. */
  cpa: number | null;
  /** Faturamento − gasto. Não desconta taxas/impostos (ver nota abaixo). */
  lucro: number;
  /** Gasto ÷ cliques. */
  cpc: number | null;
  /** Cliques ÷ impressões, em %. */
  ctr: number | null;
  /** Gasto por mil impressões. */
  cpm: number | null;
  /** Custo por Initiate Checkout: gasto ÷ IC. */
  cpi: number | null;
}

/** Divisão que devolve `null` em vez de `Infinity`/`NaN`. */
function div(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

/**
 * O **lucro aqui é bruto**: faturamento − gasto de anúncio. As taxas de gateway,
 * impostos e despesas recorrentes só existem no nível da conta (aba Taxas), e
 * não há como ratear com honestidade por campanha. O Dashboard, que trabalha no
 * nível da conta, usa o lucro líquido.
 */
export function derivar(r: LinhaBase): MetricasDerivadas {
  const lucro = r.revenue - r.spend;
  return {
    roas: div(r.revenue, r.spend),
    roi: div(lucro, r.spend),
    cpa: div(r.spend, r.results),
    lucro,
    cpc: div(r.spend, r.clicks),
    ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null,
    cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : null,
    cpi: div(r.spend, r.ic ?? 0),
  };
}

/** Soma linhas — usado no rodapé de totais da tabela. */
export function somar(linhas: LinhaBase[]): LinhaBase {
  return linhas.reduce<LinhaBase>(
    (a, r) => ({
      spend: a.spend + r.spend,
      impressions: a.impressions + r.impressions,
      clicks: a.clicks + r.clicks,
      results: a.results + r.results,
      revenue: a.revenue + r.revenue,
      ic: (a.ic ?? 0) + (r.ic ?? 0),
    }),
    { spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0, ic: 0 },
  );
}
