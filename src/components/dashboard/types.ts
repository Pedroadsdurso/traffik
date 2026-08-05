/**
 * ⛔ `TabKey` foi REMOVIDA na faxina de 05/08/2026 — não a reintroduza.
 *
 * Era o vocabulário da navegação por ESTADO (`activeTab`, `navAnalise`,
 * `pageTitle`, `fbSub`), que o Bloco 1 substituiu por rotas reais do Next em
 * 24/07/2026. O tipo e todo o estado em volta dele sobreviveram mais de um ano
 * sem nenhum consumidor: `Sidebar` e `Header` decidem por `usePathname`, e as
 * sub-abas de Integrações são rotas próprias.
 *
 * Quem precisa saber "onde estou" pergunta ao roteador, não ao hook.
 */
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
