import { prisma } from "@/lib/prisma";
// O `where` mora em arquivo próprio: importar ESTE módulo abre conexão, e a
// assimetria da Principal precisava ser exercida por teste puro. É um MOVE.
import { whereDaArea, type WhereDaArea } from "./escopoWhere";

export { whereDaArea, type WhereDaArea };

/**
 * Escopo de CONFIGURAÇÃO por Área de Trabalho.
 *
 * Separado da atribuição de métrica (`./precedencia.ts`) de propósito — são
 * perguntas diferentes:
 *
 * - **Métrica**: "de quem é esta VENDA?" → cadeia de precedência, porque a
 *   venda chega por atribuição e não tem dono declarado.
 * - **Configuração**: "de quem é este WEBHOOK?" → uma FK, e pronto. Webhook,
 *   pixel, conta, regra e despesa têm dono explícito.
 *
 * Por isso aqui é uma consulta leve, e não o mapa de 6 consultas.
 *
 * ## ⚠️ A Principal é catch-all também na configuração
 *
 * `workspaceId` NULO = "sem dono". Se a Principal filtrasse por
 * `workspaceId = principal.id`, todo webhook e pixel existente (que a migration
 * deixou NULO de propósito) ficaria **invisível** — o usuário abriria
 * Integrações e veria a tela vazia, com as integrações funcionando normalmente
 * no servidor. É a mesma lógica do dashboard: o não atribuído precisa aparecer
 * em algum lugar, e esse lugar é a Principal.
 */
export interface EscopoConfig {
  areaId: string;
  ehPrincipal: boolean;
  /** `where` do Prisma para listar o que pertence a esta área. */
  where: WhereDaArea;
}

export async function escopoDeConfig(
  userId: string,
  workspaceId?: string | null,
): Promise<EscopoConfig> {
  // Valida a posse: id de outra pessoa (ou área arquivada) cai na Principal,
  // nunca em "sem filtro". Mesma garantia do `areaValida` das métricas.
  const w =
    (workspaceId
      ? await prisma.workspace.findFirst({
          where: { id: workspaceId, userId, archived: false },
          select: { id: true, isDefault: true },
        })
      : null) ??
    (await prisma.workspace.findFirst({
      where: { userId, isDefault: true },
      select: { id: true, isDefault: true },
    }));

  // Sem área nenhuma (usuário no meio da primeira requisição): não filtra, em
  // vez de esconder tudo. `garantirAreaPrincipal` cria a área logo em seguida.
  if (!w) return { areaId: "", ehPrincipal: true, where: whereDaArea("", true) };

  return { areaId: w.id, ehPrincipal: w.isDefault, where: whereDaArea(w.id, w.isDefault) };
}

/**
 * Despesas de UMA área — isoladas, como o resto.
 *
 * ⚠️ **Isto reverteu a semântica anterior** (NULO = vale para todas as áreas),
 * por decisão do usuário em 30/07/2026: ele quer cada área com suas próprias
 * taxas. A migration `20260730120000` levou as despesas nulas para a Principal.
 *
 * 🔴 **O risco que a decisão anterior evitava continua real:** área sem taxa de
 * gateway ou sem imposto cadastrado calcula lucro **sem eles** — número maior
 * que a realidade, e plausível. A mitigação é a TELA avisar (`faltamTaxas`),
 * transformando erro silencioso em erro visível. Se um dia o aviso sair, o risco
 * volta inteiro.
 */
/**
 * Despesas que se aplicam a uma área.
 *
 * 🔴 **É a MESMA função de `precedencia.ts`, e agora é literalmente a mesma.**
 *
 * Eram duas cópias, em arquivos diferentes, com o mesmo corpo — e as duas
 * tinham o mesmo bug (descartavam `workspaceId` NULO, que aqui significa "vale
 * para todas as áreas"). **Errar junto é pior que divergir**: com a listagem e o
 * cálculo concordando, a divergência que denunciaria o erro não existia, e toda
 * despesa cadastrada ficou fora do lucro sem ninguém perceber.
 *
 * ⚠️ `escopoConfig` e `precedencia` continuam separados de propósito — "de quem
 * é esta VENDA?" e "de quem é este WEBHOOK?" são perguntas diferentes. Mas
 * **para despesa a pergunta é a mesma**, e duas implementações dela não podem
 * existir.
 */
export { whereDespesasDaArea as whereDespesas } from "./precedencia";

