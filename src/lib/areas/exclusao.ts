import { carregarMapaDeAreas } from "@/lib/areas/atribuicao";
import { prisma } from "@/lib/prisma";

/**
 * Núcleo da exclusão de Área de Trabalho — **sem `"use server"` e sem `auth()`**.
 *
 * As server actions em `actions/workspaces.ts` são casca fina em volta destas
 * funções, que recebem o `userId` pronto. Mesmo motivo de `precedencia.ts`:
 * módulo de action importa o NextAuth, e isso o torna impossível de exercitar
 * fora de um request — inclusive por teste. A exclusão é a operação mais
 * destrutiva da ferramenta; ela precisa ser testável.
 */

/** O que uma área tem, para o diálogo poder oferecer escolha por grupo. */
export interface PreviaExclusao {
  nome: string;
  contas: { id: string; nome: string; identificador: string }[];
  webhooks: { id: string; nome: string; gateway: string; vendasRecebidas: number }[];
  pixels: { id: string; nome: string; eventosRegistrados: number }[];
  regras: { id: string; nome: string; ativa: boolean }[];
  despesas: { id: string; nome: string }[];
  dados: { vendas: number; faturamento: number; cliques: number; eventos: number };
}

/** Escolha por grupo. O padrão de cada uma é sempre a opção mais segura. */
export interface OpcoesExclusao {
  /** `desvincular` (padrão) não mexe em nada no Facebook. */
  contas?: "mover" | "desvincular";
  webhooks?: "mover" | "excluir";
  pixels?: "mover" | "excluir";
  /** Padrão move E desativa: regra nula seria GLOBAL e continuaria agindo. */
  regras?: "mover" | "desativar" | "excluir";
  despesas?: "mover" | "excluir";
  apagarDados?: boolean;
  /** Confirmação por digitação, comparada com o nome da área. */
  nomeDigitado?: string;
}

export interface ResultadoExclusao {
  ok: boolean;
  motivo?: "principal" | "nome-nao-confere" | "nao-encontrada";
  apagados?: { vendas: number; cliques: number; eventos: number };
}

/** Carrega o que a precedência precisa para dizer de quem é cada linha. */
async function linhasDoUsuario(userId: string) {
  const [vendas, cliques, eventos] = await Promise.all([
    prisma.sale.findMany({
      where: { userId },
      select: {
        id: true, value: true, status: true, product: true, webhookId: true, apiCredentialId: true,
        click: { select: { utmCampaign: true, workspaceId: true } },
      },
    }),
    prisma.click.findMany({ where: { userId }, select: { id: true, utmCampaign: true, workspaceId: true, fbclid: true } }),
    prisma.pixelEvent.findMany({ where: { userId }, select: { id: true, pixelConfigId: true, fbclid: true } }),
  ]);
  const porFbclid = new Map(cliques.filter((c) => c.fbclid).map((c) => [c.fbclid as string, c]));
  return { vendas, cliques, eventos, porFbclid };
}

/**
 * O que existe nesta área, com os números que o usuário precisa para decidir.
 *
 * ⚠️ O conjunto de DADOS é calculado pela precedência, não por uma coluna — não
 * existe FK de venda para área. Por isso a prévia e a exclusão rodam **antes**
 * de mexer na configuração: mover um webhook para a Principal muda a resposta
 * de "esta venda é de quem?".
 */
export async function preverExclusao(userId: string, id: string): Promise<PreviaExclusao | null> {
  const area = await prisma.workspace.findFirst({ where: { id, userId }, select: { name: true, isDefault: true } });
  if (!area || area.isDefault) return null;

  const [contas, webhooks, pixels, regras, despesas, mapa] = await Promise.all([
    prisma.adAccount.findMany({ where: { userId, workspaceId: id }, select: { id: true, name: true, fbAccountId: true } }),
    prisma.webhook.findMany({ where: { userId, workspaceId: id }, select: { id: true, name: true, platform: true, eventCount: true } }),
    prisma.pixelConfig.findMany({ where: { userId, workspaceId: id }, select: { id: true, name: true } }),
    prisma.automationRule.findMany({ where: { userId, workspaceId: id }, select: { id: true, name: true, active: true } }),
    prisma.expense.findMany({ where: { userId, workspaceId: id }, select: { id: true, name: true } }),
    carregarMapaDeAreas(userId),
  ]);

  const porPixel = await prisma.pixelEvent.groupBy({
    by: ["pixelConfigId"],
    where: { userId, pixelConfigId: { in: pixels.map((p) => p.id) } },
    _count: { _all: true },
  });
  const contagemPixel = new Map(porPixel.map((e) => [e.pixelConfigId, e._count._all]));

  const { vendas, cliques, eventos, porFbclid } = await linhasDoUsuario(userId);
  const vendasDaArea = vendas.filter((v) => mapa.areaDaVenda(v).areaId === id);

  return {
    nome: area.name,
    contas: contas.map((c) => ({ id: c.id, nome: c.name, identificador: c.fbAccountId })),
    webhooks: webhooks.map((w) => ({ id: w.id, nome: w.name, gateway: w.platform, vendasRecebidas: w.eventCount })),
    pixels: pixels.map((p) => ({ id: p.id, nome: p.name, eventosRegistrados: contagemPixel.get(p.id) ?? 0 })),
    regras: regras.map((r) => ({ id: r.id, nome: r.name, ativa: r.active })),
    despesas: despesas.map((d) => ({ id: d.id, nome: d.name })),
    dados: {
      vendas: vendasDaArea.length,
      // Só APROVADA entra, para o número bater com o faturamento do painel.
      faturamento: vendasDaArea.filter((v) => v.status === "APROVADA").reduce((t, v) => t + Number(v.value), 0),
      cliques: cliques.filter((c) => mapa.areaDoClique(c).areaId === id).length,
      eventos: eventos.filter((e) => {
        const cl = e.fbclid ? porFbclid.get(e.fbclid) : undefined;
        return (
          mapa.areaDoEvento({
            pixelConfigId: e.pixelConfigId,
            utmCampaign: cl?.utmCampaign ?? null,
            clickWorkspaceId: cl?.workspaceId ?? null,
          }).areaId === id
        );
      }).length,
    },
  };
}

/**
 * Arquivo com os dados desta área, para baixar ANTES de apagar.
 *
 * 🔴 O download é **obrigatório** no fluxo de exclusão de dados: o Supabase Free
 * não tem recuperação point-in-time, então `npm run backup` é o único backup que
 * existe. Sem o arquivo, apagar faturamento seria irreversível de verdade — e
 * irreversibilidade tem de ser honesta, não teórica.
 */
export async function exportarDados(userId: string, id: string): Promise<string | null> {
  const area = await prisma.workspace.findFirst({ where: { id, userId }, select: { name: true } });
  if (!area) return null;
  const mapa = await carregarMapaDeAreas(userId);

  const [vendas, cliques] = await Promise.all([
    prisma.sale.findMany({
      where: { userId },
      include: { click: { select: { clickId: true, utmCampaign: true, utmSource: true, utmContent: true, workspaceId: true } } },
    }),
    prisma.click.findMany({ where: { userId } }),
  ]);

  return JSON.stringify(
    {
      area: area.name,
      geradoEm: new Date().toISOString(),
      aviso: "Cópia dos dados desta área de trabalho, gerada antes da exclusão.",
      vendas: vendas.filter((v) => mapa.areaDaVenda(v).areaId === id),
      cliques: cliques.filter((c) => mapa.areaDoClique(c).areaId === id),
    },
    null,
    2,
  );
}

/**
 * Exclui uma área **com escolha por grupo**.
 *
 * ## ⛔ Por que `SetNull` não servia como padrão
 *
 * As FKs são todas `onDelete: SetNull`, e antes isso era o comportamento
 * inteiro: tudo virava "sem dono" e reaparecia na Principal. Duas dessas
 * colunas, porém, têm o significado INVERTIDO quando nulas:
 *
 * - **`AutomationRule.workspaceId` nulo = regra GLOBAL.** Excluir a área
 *   transformava "pause as campanhas desta operação" em "pause as campanhas de
 *   TODAS as contas" — e a regra continuava ativa, agindo com dinheiro real.
 * - **`Expense.workspaceId` nulo = vale para TODAS as áreas.** A despesa da
 *   área excluída passava a inflar o custo de todas as outras.
 *
 * Por isso o padrão aqui **move as duas para a Principal** (e desativa a
 * regra): nenhuma das duas amplia escopo sozinha.
 *
 * ⚠️ **O gasto NUNCA é apagado**, nem quando o usuário pede para apagar dados.
 * `DailyAdMetric` pende do anúncio, não da área: apagar venda e manter gasto
 * deixaria custo sem faturamento (ROI travado em −1,00x) e mudaria os totais
 * históricos do painel. É o registro do que a Meta cobrou, não um dado nosso.
 */
export async function excluirArea(
  userId: string,
  id: string,
  opcoes: OpcoesExclusao,
  principalId: string,
): Promise<ResultadoExclusao> {
  const area = await prisma.workspace.findFirst({ where: { id, userId }, select: { name: true, isDefault: true } });
  if (!area) return { ok: false, motivo: "nao-encontrada" };
  // ⛔ A principal nunca é excluída. A checagem vive AQUI, e não só no botão
  // desabilitado: server action é endpoint público, e sem principal o seletor
  // fica sem fallback e o usuário sem operação padrão.
  if (area.isDefault) return { ok: false, motivo: "principal" };

  let apagados: ResultadoExclusao["apagados"];

  // ── 1. DADOS primeiro, enquanto a atribuição ainda é a de agora ───────────
  //
  // A área de uma venda é calculada pela precedência, e mover um webhook para a
  // Principal muda essa resposta. Se a configuração fosse alterada antes, o
  // conjunto a apagar já não seria o que o usuário viu na prévia.
  if (opcoes.apagarDados) {
    if ((opcoes.nomeDigitado ?? "").trim() !== area.name.trim()) {
      return { ok: false, motivo: "nome-nao-confere" };
    }
    const mapa = await carregarMapaDeAreas(userId);
    const { vendas, cliques, eventos, porFbclid } = await linhasDoUsuario(userId);

    const idsVendas = vendas.filter((v) => mapa.areaDaVenda(v).areaId === id).map((v) => v.id);
    const idsCliques = cliques.filter((c) => mapa.areaDoClique(c).areaId === id).map((c) => c.id);
    const idsEventos = eventos
      .filter((e) => {
        const cl = e.fbclid ? porFbclid.get(e.fbclid) : undefined;
        return (
          mapa.areaDoEvento({
            pixelConfigId: e.pixelConfigId,
            utmCampaign: cl?.utmCampaign ?? null,
            clickWorkspaceId: cl?.workspaceId ?? null,
          }).areaId === id
        );
      })
      .map((e) => e.id);

    await prisma.pixelEvent.deleteMany({ where: { id: { in: idsEventos } } });
    await prisma.sale.deleteMany({ where: { id: { in: idsVendas } } });
    // Cliques por último: a venda referencia o clique, e apagar na ordem inversa
    // deixaria a venda sem origem antes de ela mesma sair.
    await prisma.click.deleteMany({ where: { id: { in: idsCliques } } });
    apagados = { vendas: idsVendas.length, cliques: idsCliques.length, eventos: idsEventos.length };
  }

  // ── 2. CONFIGURAÇÃO, grupo por grupo ─────────────────────────────────────
  const paraPrincipal = { workspaceId: principalId };

  // Conta de anúncio: NUNCA apaga a linha. `Campaign`/`AdSet`/`Ad`/
  // `DailyAdMetric` pendem dela com `Cascade` — apagar destruiria todo o
  // histórico de gasto. "Desvincular" é o mais destrutivo que faz sentido.
  await prisma.adAccount.updateMany({
    where: { userId, workspaceId: id },
    data: opcoes.contas === "mover" ? paraPrincipal : { workspaceId: null },
  });

  if (opcoes.webhooks === "excluir") await prisma.webhook.deleteMany({ where: { userId, workspaceId: id } });
  else await prisma.webhook.updateMany({ where: { userId, workspaceId: id }, data: paraPrincipal });

  if (opcoes.pixels === "excluir") await prisma.pixelConfig.deleteMany({ where: { userId, workspaceId: id } });
  else await prisma.pixelConfig.updateMany({ where: { userId, workspaceId: id }, data: paraPrincipal });

  if (opcoes.regras === "excluir") await prisma.automationRule.deleteMany({ where: { userId, workspaceId: id } });
  else if (opcoes.regras === "mover") await prisma.automationRule.updateMany({ where: { userId, workspaceId: id }, data: paraPrincipal });
  // Padrão: move E desativa. Só desativar deixaria a regra nula, e nula é
  // GLOBAL — bastaria alguém religá-la para ela agir em todas as contas.
  else await prisma.automationRule.updateMany({ where: { userId, workspaceId: id }, data: { ...paraPrincipal, active: false } });

  if (opcoes.despesas === "excluir") await prisma.expense.deleteMany({ where: { userId, workspaceId: id } });
  else await prisma.expense.updateMany({ where: { userId, workspaceId: id }, data: paraPrincipal });

  // Credenciais de API não aparecem no diálogo (não são configuração de
  // operação); vão para a Principal para não virarem globais por omissão.
  await prisma.apiCredential.updateMany({ where: { userId, workspaceId: id }, data: paraPrincipal });

  await prisma.workspace.deleteMany({ where: { id, userId, isDefault: false } });
  return { ok: true, apagados };
}
