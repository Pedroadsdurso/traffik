import { prisma } from "@/lib/prisma";
import { splitPipe } from "@/lib/utm/parse";

/**
 * Escopo de contas de anúncio — o que decide se uma VENDA pertence a uma conta.
 *
 * ## O bug que isto conserta
 *
 * O filtro "Conta de anúncio" do Dashboard só alcançava `DailyAdMetric`, ou
 * seja, **só o gasto**. Vendas, cliques e eventos de pixel passavam sem filtro
 * nenhum. Com uma conta selecionada, o ROAS virava
 * *(faturamento de TODAS as contas) ÷ (gasto de UMA)* — inflado, e junto com
 * ele ROI, CPA e Lucro.
 *
 * ## Por que precisa de atribuição, e não de uma FK
 *
 * A venda chega pelo gateway e **não tem coluna de conta de anúncio** — ela só
 * sabe de qual clique veio. A ligação até a conta é a mesma cadeia que o
 * Gerenciador já usa para atribuir vendas por campanha:
 *
 *   Sale → Click.utmCampaign → `nome|id` → Campaign.fbCampaignId → AdAccount
 *
 * Preferimos o **id** do Facebook; caímos no nome para cliques antigos, gravados
 * antes dos códigos do Bloco 11.
 *
 * ⚠️ **Venda sem UTM não pertence a conta nenhuma.** Ela some quando há filtro
 * de conta — e isso é o comportamento correto: afirmar que ela é daquela conta
 * seria inventar atribuição. É a mesma regra do Gerenciador.
 */
export interface EscopoContas {
  /** `true` quando este `utm_campaign` pertence a alguma das contas. */
  combina(utmCampaign: string | null | undefined): boolean;
}

/** Escopo que aceita tudo — usado quando não há filtro de conta. */
export const ESCOPO_TUDO: EscopoContas = { combina: () => true };

export async function carregarEscopoContas(
  userId: string,
  accountIds: string[],
): Promise<EscopoContas> {
  const campanhas = await prisma.campaign.findMany({
    where: { adAccountId: { in: accountIds }, adAccount: { userId } },
    select: { fbCampaignId: true, name: true },
  });

  const porId = new Set(campanhas.map((c) => c.fbCampaignId));
  const porNome = new Set(campanhas.map((c) => c.name.toLowerCase()));

  return {
    combina(utmCampaign) {
      if (!utmCampaign) return false; // sem UTM não há como atribuir
      const { id, name } = splitPipe(utmCampaign);
      if (id) return porId.has(id);
      return name ? porNome.has(name.toLowerCase()) : false;
    },
  };
}

/**
 * Resolve o filtro efetivo de um campo.
 *
 * A área de trabalho define a lista BASE e o filtro da tela escolhe dentro
 * dela — por isso é interseção, e não substituição: selecionar na tela uma
 * conta que não é da área não pode fazer dados de fora aparecerem.
 */
export function filtroEfetivo(base: string[] | undefined, daTela: string, curinga: string): string[] | null {
  const temBase = base && base.length > 0;
  const telaEspecifica = daTela !== curinga;
  if (!temBase && !telaEspecifica) return null; // sem filtro
  if (!temBase) return [daTela];
  if (!telaEspecifica) return base!;
  return base!.includes(daTela) ? [daTela] : []; // fora da área: nada
}
