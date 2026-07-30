export type TabKey =
  | "dashboard"
  | "ads"
  | "creatives"
  | "rules"
  | "notifications"
  | "fees"
  | "facebook"
  | "utm";

export type MetricKey =
  | "faturamento"
  /** Bruto menos gateway, coprodução, impostos e custo de produto. */
  | "liquido"
  /**
   * Líquido menos gasto com anúncios e despesas recorrentes.
   *
   * ⚠️ Chave `lucroLiquido`, não `lucro`: o Gerenciador já usa `lucro` para o
   * lucro BRUTO por campanha, que não desconta taxas. O rótulo na tela é "Lucro"
   * nos dois casos, mas são contas diferentes.
   */
  | "lucroLiquido"
  | "gasto"
  | "roas"
  | "roi"
  | "margem"
  | "vendas"
  | "cpa"
  | "ticket"
  | "arpu"
  | "ctr"
  | "pendentes"
  | "reembolsadas"
  | "chargeback";
