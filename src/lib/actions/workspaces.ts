"use server";

import { auth } from "@/auth";
import { carregarMapaDeAreas } from "@/lib/areas/atribuicao";
import { excluirArea, exportarDados, exportarHistoricoDasRegras, preverExclusao, type OpcoesExclusao as OpcoesExclusaoTipo } from "@/lib/areas/exclusao";
import { prisma } from "@/lib/prisma";

export interface WorkspaceDTO {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  /** Área principal: não pode ser excluída nem arquivada. Uma por usuário. */
  isDefault: boolean;
  archived: boolean;
  accountIds: string[];
  products: string[];
  sources: string[];
  webhookIds: string[];
  pixelConfigIds: string[];
}

/** Uma conta de anúncio que já pertence a outra área — e a qual. */
export interface ContaOcupada {
  accountId: string;
  workspaceId: string;
  workspaceName: string;
}

/** Resultado de criar/salvar. O erro previsível é conflito de conta. */
export type SalvarAreaResult =
  | { ok: true; area: WorkspaceDTO }
  | { ok: false; conflitos: ContaOcupada[]; motivo?: "principal-nao-arquiva" };

/**
 * Áreas de Trabalho.
 *
 * ⚠️ **Excluir uma área NÃO apaga dados por padrão — mas passou a poder.** Desde
 * 29/07/2026 o diálogo oferece escolha por grupo, e apagar vendas é uma opção
 * explícita, atrás de download obrigatório e confirmação por digitação. O texto
 * antigo aqui prometia que não havia o que perder; deixou de ser verdade.
 * Ver `lib/areas/exclusao.ts`.
 */
async function uid(): Promise<string> {
  const s = await auth();
  if (!s?.user?.id) throw new Error("Não autenticado.");
  return s.user.id;
}

const SELECT = {
  id: true, name: true, color: true, description: true, isDefault: true, archived: true,
  accountIds: true, products: true, sources: true, webhookIds: true, pixelConfigIds: true,
} as const;

const dto = (w: WorkspaceDTO): WorkspaceDTO => ({ ...w });

/**
 * Garante que o usuário tenha uma área PRINCIPAL. Idempotente.
 *
 * A principal é o **catch-all**: mostra tudo o que nenhuma outra área
 * reivindicou, inclusive o que não é atribuível a conta nenhuma (clique sem
 * `utm_campaign`, venda sem clique). Por isso ela nasce **sem listas**: o
 * escopo dela é DERIVADO das outras áreas em `filtrosDaArea`, e assim nunca
 * fica desatualizado quando uma área nova aparece.
 *
 * ⚠️ Ela já nasceu com todas as contas numa lista de INCLUSÃO, e isso **zerou o
 * dashboard em produção** — inclusão descarta o não atribuível. Não voltar
 * atrás nisto.
 */
export async function garantirAreaPrincipal(userIdParam?: string): Promise<WorkspaceDTO> {
  const userId = userIdParam ?? (await uid());

  const existente = await prisma.workspace.findFirst({ where: { userId, isDefault: true }, select: SELECT });
  if (existente) return dto(existente);

  // Tem áreas, mas nenhuma marcada: promove a mais antiga em vez de criar uma
  // sexta caixa vazia na tela de alguém que já organizou tudo.
  const maisAntiga = await prisma.workspace.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (maisAntiga) {
    await prisma.workspace.update({ where: { id: maisAntiga.id }, data: { isDefault: true, archived: false } });
    return dto(await prisma.workspace.findUniqueOrThrow({ where: { id: maisAntiga.id }, select: SELECT }));
  }

  // ⚠️ `createMany({ skipDuplicates: true })` e NÃO `create` dentro de try/catch.
  //
  // O layout dispara ~12 leituras em `Promise.all`, e várias passam por
  // `filtrosDaArea` → aqui. Todas correm ao mesmo tempo para o MESMO usuário.
  // Com `create`, a perdedora estourava no índice parcial único e caía no
  // `catch` — que então lia a linha da vencedora e **não encontrava nada**,
  // porque a transação dela ainda não tinha commitado. O erro real era
  // `findFirstOrThrow` falhando, e o `catch` vazio escondia a causa.
  //
  // `ON CONFLICT DO NOTHING` (o que o `skipDuplicates` gera) resolve a corrida
  // no BANCO: a perdedora **espera** a vencedora commitar e só então segue. Ao
  // retornar, a linha existe com certeza — inserida por mim ou por quem chegou
  // primeiro. Sem try/catch, então nenhum erro de verdade fica escondido.
  await prisma.workspace.createMany({
    data: [
      {
        userId,
        name: "Principal",
        color: "#8b5cf6",
        description: "Operação padrão. Esta área não pode ser excluída.",
        isDefault: true,
        // Listas VAZIAS: o escopo da principal é derivado das outras áreas em
        // `filtrosDaArea` (catch-all por exclusão), não gravado aqui. Preenchê-la
        // com todas as contas foi o que zerou o dashboard em produção.
      },
    ],
    skipDuplicates: true,
  });

  return dto(await prisma.workspace.findFirstOrThrow({ where: { userId, isDefault: true }, select: SELECT }));
}

export async function listWorkspaces(): Promise<WorkspaceDTO[]> {
  const userId = await uid();
  const rows = await prisma.workspace.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { archived: "asc" }, { createdAt: "asc" }],
    select: SELECT,
  });
  // Só escreve quando realmente falta — o caminho normal é uma leitura só.
  if (!rows.some((r) => r.isDefault)) {
    await garantirAreaPrincipal(userId);
    return (await prisma.workspace.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { archived: "asc" }, { createdAt: "asc" }],
      select: SELECT,
    })).map(dto);
  }
  return rows.map(dto);
}

/**
 * A área a abrir. **Nunca `null`**: sem preferência salva, é a PRINCIPAL.
 *
 * Área arquivada ou excluída também cai na principal — não existe estado "sem
 * área" para onde escorregar.
 */
export async function getLastWorkspaceId(): Promise<string | null> {
  const userId = await uid();
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { lastWorkspaceId: true } });
  if (u?.lastWorkspaceId) {
    const valida = await prisma.workspace.findFirst({
      where: { id: u.lastWorkspaceId, userId, archived: false },
      select: { id: true },
    });
    if (valida) return valida.id;
  }
  return (await garantirAreaPrincipal(userId)).id;
}

/**
 * Lembra a área escolhida.
 *
 * Aceita `null` só para não quebrar chamada antiga: como não existe mais visão
 * consolidada, gravar "sem área" não teria significado — a próxima sessão
 * abriria na principal de qualquer jeito.
 */
export async function setLastWorkspaceId(workspaceId: string | null): Promise<void> {
  if (!workspaceId) return;
  const userId = await uid();
  // Valida a posse antes de gravar: um id de outro usuário viraria uma FK
  // válida apontando para área alheia.
  const existe = await prisma.workspace.findFirst({ where: { id: workspaceId, userId }, select: { id: true } });
  if (!existe) return;
  await prisma.user.update({ where: { id: userId }, data: { lastWorkspaceId: workspaceId } });
}

/**
 * Quais das contas informadas já pertencem a OUTRA área, e a qual.
 *
 * **Uma conta de anúncio pertence a apenas uma área.** A regra existe porque o
 * gasto daquela conta é a base de ROAS/ROI/CPA: a mesma conta em duas áreas
 * faria o mesmo investimento ser contado como se fossem duas operações, e nada
 * na tela denunciaria a sobreposição.
 *
 * `exceto` é a área que está sendo editada — sem ele, salvar uma área sem mexer
 * nas contas acusaria conflito com ela mesma.
 *
 * Devolve a lista de conflitos em vez de um booleano: a tela precisa dizer
 * **qual** área ocupa a conta, senão o bloqueio vira um "não" sem saída.
 */
export async function contasOcupadas(
  accountIds: string[],
  exceto?: string | null,
): Promise<ContaOcupada[]> {
  if (accountIds.length === 0) return [];
  const userId = await uid();
  const outras = await prisma.workspace.findMany({
    where: { userId, ...(exceto ? { id: { not: exceto } } : {}) },
    select: { id: true, name: true, accountIds: true },
  });

  const dono = new Map<string, { workspaceId: string; workspaceName: string }>();
  for (const w of outras) {
    for (const acc of w.accountIds) {
      // A primeira área que reivindicou a conta é a dona. Se houver duplicata
      // legada (a validação não existia antes), quem aparece é a mais antiga —
      // e é ela que a tela vai mostrar como ocupante.
      if (!dono.has(acc)) dono.set(acc, { workspaceId: w.id, workspaceName: w.name });
    }
  }

  return accountIds
    .map((accountId) => {
      const d = dono.get(accountId);
      return d ? { accountId, ...d } : null;
    })
    .filter((c): c is ContaOcupada => c !== null);
}

interface AreaInput {
  name?: string;
  color?: string | null;
  description?: string | null;
  archived?: boolean;
  accountIds?: string[];
  products?: string[];
  sources?: string[];
  webhookIds?: string[];
  pixelConfigIds?: string[];
  /** Contas que o usuário autorizou explicitamente a SAIR de outra área. */
  moverContas?: string[];
}

/**
 * Tira as contas autorizadas a MUDAR de área das áreas onde estavam.
 *
 * O bloqueio continua sendo o padrão — nada troca de área em silêncio. Mas com
 * a principal nascendo dona de todas as contas, criar a primeira secundária
 * esbarraria sempre no bloqueio; sem esta saída, o fluxo principal viraria um
 * beco. Aqui a mudança só acontece para os ids que o usuário marcou "mover".
 */
async function liberarContas(userId: string, mover: string[], exceto?: string | null): Promise<void> {
  if (mover.length === 0) return;
  const donas = await prisma.workspace.findMany({
    where: { userId, ...(exceto ? { id: { not: exceto } } : {}), accountIds: { hasSome: mover } },
    select: { id: true, accountIds: true },
  });
  await Promise.all(
    donas.map((d) =>
      prisma.workspace.update({
        where: { id: d.id },
        data: { accountIds: d.accountIds.filter((a) => !mover.includes(a)) },
      }),
    ),
  );
}

export async function createWorkspace(input: AreaInput & { name: string }): Promise<SalvarAreaResult> {
  const userId = await uid();
  await liberarContas(userId, input.moverContas ?? []);
  // A validação roda no SERVIDOR mesmo com a tela já bloqueando a seleção: o
  // bloqueio da tela é conveniência, e uma server action é um endpoint público.
  const conflitos = await contasOcupadas(input.accountIds ?? []);
  if (conflitos.length) return { ok: false, conflitos };

  const w = await prisma.workspace.create({
    data: {
      userId,
      name: input.name.trim() || "Nova área",
      color: input.color ?? null,
      description: input.description?.trim() || null,
      accountIds: input.accountIds ?? [],
      products: input.products ?? [],
      sources: input.sources ?? [],
      webhookIds: input.webhookIds ?? [],
      pixelConfigIds: input.pixelConfigIds ?? [],
    },
    select: SELECT,
  });
  return { ok: true, area: dto(w) };
}

export async function updateWorkspace(id: string, input: AreaInput): Promise<SalvarAreaResult | null> {
  const userId = await uid();
  const alvo = await prisma.workspace.findFirst({ where: { id, userId }, select: { isDefault: true } });
  if (!alvo) return null;
  // Arquivar a principal deixaria o seletor sem fallback — ela é o destino de
  // quem não tem preferência salva.
  if (alvo.isDefault && input.archived) return { ok: false, conflitos: [], motivo: "principal-nao-arquiva" };

  await liberarContas(userId, input.moverContas ?? [], id);
  if (input.accountIds) {
    const conflitos = await contasOcupadas(input.accountIds, id);
    if (conflitos.length) return { ok: false, conflitos };
  }

  // `updateMany` com userId no where: `update` por id sozinho deixaria editar
  // área de outro usuário se o id vazasse.
  const r = await prisma.workspace.updateMany({
    where: { id, userId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() || "Sem nome" } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
      ...(input.accountIds !== undefined ? { accountIds: input.accountIds } : {}),
      ...(input.products !== undefined ? { products: input.products } : {}),
      ...(input.sources !== undefined ? { sources: input.sources } : {}),
      ...(input.webhookIds !== undefined ? { webhookIds: input.webhookIds } : {}),
      ...(input.pixelConfigIds !== undefined ? { pixelConfigIds: input.pixelConfigIds } : {}),
    },
  });
  if (r.count === 0) return null;
  const w = await prisma.workspace.findUniqueOrThrow({ where: { id }, select: SELECT });
  return { ok: true, area: dto(w) };
}

/**
 * Duplica só a CONFIGURAÇÃO — não há dado para copiar.
 *
 * ⚠️ **A cópia nasce SEM contas de anúncio**, de propósito: uma conta pertence a
 * uma única área, então copiá-las produziria um conflito garantido no ato da
 * duplicação. Duplicar serve para reaproveitar produtos/webhooks/pixels e
 * apontar a cópia para outras contas.
 */
export async function duplicateWorkspace(id: string): Promise<SalvarAreaResult | null> {
  const userId = await uid();
  const o = await prisma.workspace.findFirst({ where: { id, userId }, select: SELECT });
  if (!o) return null;
  return createWorkspace({
    name: `${o.name} (cópia)`,
    color: o.color,
    description: o.description,
    accountIds: [],
    products: o.products,
    sources: o.sources,
    webhookIds: o.webhookIds,
    pixelConfigIds: o.pixelConfigIds,
  });
}

/**
 * Remove o agrupamento. **Nenhum dado é apagado** — só a área e o layout de
 * dashboard dela (que é configuração de tela, não dado de negócio).
 */
/**
 * Exclusão de área — casca de autenticação. A lógica inteira (e os motivos das
 * escolhas) vive em `lib/areas/exclusao.ts`, que é testável fora de um request.
 */
export type { OpcoesExclusao, PreviaExclusao, ResultadoExclusao } from "@/lib/areas/exclusao";

export async function preverExclusaoDaArea(id: string) {
  return preverExclusao(await uid(), id);
}

export async function exportarDadosDaArea(id: string) {
  return exportarDados(await uid(), id);
}

export async function exportarHistoricoDasRegrasDaArea(id: string) {
  return exportarHistoricoDasRegras(await uid(), id);
}

export async function deleteWorkspace(id: string, opcoes: OpcoesExclusaoTipo = {}) {
  const userId = await uid();
  const principal = await garantirAreaPrincipal(userId);
  return excluirArea(userId, id, opcoes, principal.id);
}

export interface ProdutoDescoberto {
  produto: string;
  vendas: number;
  faturamento: number;
}

/**
 * Produtos DESCOBERTOS em cada área — informação, não configuração.
 *
 * ## Por que produto deixou de ser filtro
 *
 * Pedir ao usuário que escolha os produtos da área não funciona: a ferramenta
 * só conhece um produto **depois** que ele é vendido, então numa oferta nova
 * não há o que selecionar. E o nome vem como texto livre do gateway — renomear
 * lá fazia o filtro parar de casar **em silêncio**.
 *
 * Agora a venda é atribuída pelos vínculos reais (conta de anúncio, área do
 * script, webhook, credencial) e o produto vem junto, como consequência. Todo
 * produto que aparece numa venda daquela área é associado a ela sozinho.
 *
 * ⚠️ Produto renomeado no gateway aparece como produto NOVO na lista, sem
 * quebrar filtro nenhum — o vínculo real nunca foi o texto.
 */
export async function produtosDescobertos(dias = 30): Promise<Record<string, ProdutoDescoberto[]>> {
  const userId = await uid();
  const mapa = await carregarMapaDeAreas(userId);
  const desde = new Date(Date.now() - dias * 864e5);

  const vendas = await prisma.sale.findMany({
    where: { userId, timestamp: { gte: desde } },
    select: {
      product: true,
      value: true,
      status: true,
      webhookId: true,
      apiCredentialId: true,
      click: { select: { utmCampaign: true, workspaceId: true } },
    },
  });

  // Agrupa em memória: a área de cada venda sai da precedência, que o Postgres
  // não sabe calcular (o `utm_campaign` é `nome|id` e precisa ser interpretado).
  const porArea = new Map<string, Map<string, ProdutoDescoberto>>();
  for (const v of vendas) {
    const areaId = mapa.areaDaVenda(v).areaId;
    const m = porArea.get(areaId) ?? new Map<string, ProdutoDescoberto>();
    const atual = m.get(v.product) ?? { produto: v.product, vendas: 0, faturamento: 0 };
    atual.vendas += 1;
    // Só venda APROVADA entra no faturamento — mesma regra do dashboard, senão
    // o número aqui divergiria do KPI e pareceria erro.
    if (v.status === "APROVADA") atual.faturamento += Number(v.value);
    m.set(v.product, atual);
    porArea.set(areaId, m);
  }

  return Object.fromEntries(
    mapa.areas.map((a) => [
      a.id,
      [...(porArea.get(a.id)?.values() ?? [])].sort((x, y) => y.faturamento - x.faturamento || y.vendas - x.vendas),
    ]),
  );
}

/**
 * ⛔ `FiltrosDaArea`/`filtrosDaArea` foram REMOVIDOS em 29/07/2026.
 *
 * Eles devolviam listas de inclusão/exclusão que cada consulta aplicava em AND
 * no `where`. Nesse modelo uma linha podia não casar com área nenhuma e sumir
 * do produto inteiro — 12 de 14 vendas no backup real de produção — ou casar
 * com duas e ser contada em dobro.
 *
 * Quem decide de quem é uma linha agora é `lib/areas/precedencia.ts`, e a
 * validação de posse do `?ws=` vive em `mapa.areaValida()`. Toda rota que sirva
 * métrica precisa passar por lá; uma consulta que vá direto ao Prisma sem
 * resolver a área volta a ver tudo.
 */

/** Tudo o que a tela de gerenciar precisa para montar os seletores. */
/**
 * Opções dos seletores da tela de áreas.
 *
 * ⚠️ **`products` e `sources` saíram**: produto virou descoberta (ver
 * `produtosDescobertos`) e `sources` nunca teve uso real. A criação de área não
 * oferece seletor nenhum — a área nasce zerada e é configurada por dentro.
 */
export interface OpcoesAreas {
  accounts: { id: string; name: string; fbAccountId: string; profileName: string }[];
  webhooks: { id: string; name: string; platform: string }[];
  pixels: { id: string; name: string }[];
}

export async function carregarOpcoesAreas(): Promise<OpcoesAreas> {
  const userId = await uid();
  const [accounts, webhooks, pixels] = await Promise.all([
    prisma.adAccount.findMany({
      where: { userId },
      select: { id: true, name: true, fbAccountId: true, adProfile: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.webhook.findMany({ where: { userId }, select: { id: true, name: true, platform: true }, orderBy: { createdAt: "asc" } }),
    prisma.pixelConfig.findMany({ where: { userId }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    accounts: accounts.map((a) => ({
      id: a.id, name: a.name, fbAccountId: a.fbAccountId, profileName: a.adProfile?.name ?? "—",
    })),
    webhooks,
    pixels,
  };
}
