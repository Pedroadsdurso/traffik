"use server";

import { auth } from "@/auth";
import { getLastWorkspaceId } from "@/lib/actions/workspaces";
import { escopoDeConfig } from "@/lib/areas/escopoConfig";
import { plural } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { estadoDasRotinas } from "@/lib/cronBatimento";
import { lerPadroes } from "@/lib/pixel/ambiente";
import type { WebhookLogStatus } from "@/generated/prisma/enums";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

// ─────────────────────── Teste de Webhook (payloads crus) ───────────────────────

export interface WebhookLogDTO {
  id: string;
  gateway: string;
  status: WebhookLogStatus;
  message: string | null;
  httpStatus: number | null;
  saleId: string | null;
  createdAt: string;
  /** Payload cru já serializado e indentado, pronto para exibir. */
  payload: string;
}

/** Últimos payloads recebidos, do mais recente para o mais antigo. */
/**
 * @param webhookId Quando informado, so os logs DAQUELE webhook.
 *
 * ⚠️ Filtro ADITIVO, so leitura. A aba Logs do painel de Integracoes mostra o
 * historico da integracao SELECIONADA — sem o filtro ela mostraria os eventos
 * de todos os gateways sob o titulo de um so, que e pior que nao ter a aba.
 */
export async function listWebhookLogs(limit = 20, webhookId?: string): Promise<WebhookLogDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.webhookLog.findMany({
    where: { userId, ...(webhookId ? { webhookId } : null) },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map((r) => ({
    id: r.id,
    gateway: r.gateway,
    status: r.status,
    message: r.message,
    httpStatus: r.httpStatus,
    saleId: r.saleId,
    createdAt: r.createdAt.toISOString(),
    payload: JSON.stringify(r.payloadRaw, null, 2),
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   🪦 O QUE SAIU EM 17/08/2026 — e o que cada saída CUSTOU

   A tela de `Integrações › Testes` foi deletada em 12/08 e levou os
   consumidores de 12 server actions daqui. Elas ficaram, foram triadas por
   CONSEQUÊNCIA (`npm run test:diagnosticos-orfaos`), e o resultado foi este.

   ⛔ Este bloco não é lápide decorativa: ele existe porque **uma das saídas
   deixou coluna sem leitor**, e isso precisa ser achável por quem for mexer nas
   colunas — não só por quem ler o `git log`.

   | saiu | o que respondia | o que se perdeu |
   |---|---|---|
   | `resumoEspelhos` | "os espelhos estão saindo?" | ⚪ **nada** — a `PixelScreen` já lê `PixelEvent.espelho` por evento (`estadoDoEspelho`). Era a segunda fonte da mesma pergunta |
   | `resumoEfeitos` | os 3 efeitos pós-venda | 🔴 **o único leitor de `Sale.capiStatus`, `checkoutStatus` e `notifStatus`** |
   | `analyzeTrackingUrl` | interpreta URL com UTMs como o webhook faria | ⚪ ferramenta de apoio, sob demanda |
   | `listTestablePixels` · `testarPayloadDeGateway` · `listarGatewaysDoTestador` · `carregarExemploDeGateway` | o testador de payload | ⚪ idem — e `lib/gateways/testador.ts` continua de pé |
   | `getPendenciasDasAreas` | o PLURAL do `getPendenciasDaArea` | ⚪ o singular tem consumidor |

   ## ✅ A LINHA VERMELHA FOI FECHADA NO MESMO DIA — a leitura voltou

   Por algumas horas as três colunas ficaram **só com escritor**: `marcarEfeito`
   as grava em toda venda e, com o `resumoEfeitos` fora, ninguém as lia. Era a
   imagem espelhada do `Sale.apiCredentialId` (6 leitores, 0 escritores).

   ⛔ **Havia duas saídas, e a de parar de escrever foi RECUSADA**: as colunas
   guardam *por que* um efeito falhou, que é exatamente a informação perdida em
   `console.error` antes da Família 1. Fechar o par apagando a escrita seria
   reverter o conserto para arrumar a contabilidade de leitores.

   ✅ **A leitura voltou na LINHA da venda**, não num resumo: `problemasDaVenda`
   (puro, em `webhook/efeitos.ts`) → `buildActivity` → `FeedVendas`. O que a
   coluna guarda é um fato DAQUELA venda; um resumo obrigaria quem lê a ir
   procurar quais, e era essa fricção que fazia ninguém abrir a tela.

   ⚠️ **O que este bloco continua a registrar** é a poda, não a dívida: as
   outras sete saídas seguem valendo, e `resumoEfeitos` saiu de verdade — o que
   voltou foi a PERGUNTA dele, em outro lugar e em outra forma.

   ✅ Congelado em `npm run test:efeitos-na-linha` (32 asserções), que mede o
   par nas DUAS pontas: quem escreve continua escrevendo, e existe quem leia.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─────────────────────── Checklist de instalação ───────────────────────

export interface ChecklistItemDTO {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  /** Para onde mandar o usuário resolver. */
  href: string | null;
}

/**
 * 🎯 FONTE ÚNICA das pendências de uma Área de Trabalho.
 *
 * Três telas fazem a MESMA pergunta — "o que falta configurar aqui?" — e antes
 * cada uma respondia por conta própria:
 *
 * | Tela | Consumia |
 * |---|---|
 * | Banner do Dashboard | (não existia) |
 * | Cards de `/dashboard/areas` | uma função local, olhando as listas do `Workspace` |
 * | ~~Checklist de Integrações › Testes~~ | a tela foi DELETADA em 12/08/2026 |
 *
 * Duas fontes divergindo é questão de tempo: a da tela de Áreas olhava
 * `Workspace.accountIds`, que a Sessão 1 substituiu por FK — ela continuaria
 * dizendo "sem conta de anúncio" para uma área já configurada.
 *
 * Agora `getInstallChecklist` é a fonte, e as telas só a apresentam de formas
 * diferentes.
 *
 * ⚠️ Sobrou UMA (o banner) desde que a tela de Testes morreu — e é por isso que
 * o `getInstallChecklist` deixou de ser `export` em 17/08/2026. A unificação
 * continua valendo: ela existe para o dia da segunda tela, não porque haja duas
 * hoje.
 */
export interface PendenciasDTO {
  areaId: string;
  ehPrincipal: boolean;
  /** Itens que faltam, em ordem de impacto. Vazio = área configurada. */
  faltando: ChecklistItemDTO[];
  /** Todos os itens, para quem quer mostrar os concluídos também. */
  itens: ChecklistItemDTO[];
  total: number;
  ok: number;
}

/**
 * As pendências da área ativa, prontas para o banner e para os cards.
 *
 * ⚠️ **A Principal não gera banner.** Ela é o catch-all e é o estado normal de
 * quem só tem uma operação: um aviso permanente ali viraria ruído que se
 * aprende a ignorar — inclusive quando passar a dizer outra coisa. É a mesma
 * regra da faixa de banco de desenvolvimento.
 */
export async function getPendenciasDaArea(workspaceId?: string | null): Promise<PendenciasDTO> {
  const userId = await requireUserId();
  const escopo = await escopoDeConfig(userId, workspaceId ?? (await getLastWorkspaceId()));
  const itens = await getInstallChecklist(escopo.areaId);
  const faltando = itens.filter((i) => !i.ok);
  return {
    areaId: escopo.areaId,
    ehPrincipal: escopo.ehPrincipal,
    faltando: escopo.ehPrincipal ? [] : faltando,
    itens,
    total: itens.length,
    ok: itens.length - faltando.length,
  };
}

/**
 * Checklist de instalação **da Área de Trabalho ativa**.
 *
 * ⚠️ É diagnóstico de CONFIGURAÇÃO, e configuração agora pertence à área — um
 * checklist global diria "tudo certo" para uma área recém-criada que ainda não
 * tem webhook nem pixel nenhum, que é justamente quando ele precisa avisar.
 *
 * ⚠️ **Cliques não são recortados por área**: um `Click` não tem dono
 * declarado (a área dele sai da atribuição por campanha). O item "script de
 * UTM" continua sendo do nível da conta — e é coerente, porque o script de UTM
 * também é, por desenho.
 */
/* ⛔ NÃO É `export`, e a distinção vale a linha: ele NUNCA esteve órfão — é
   chamado por `getPendenciasDaArea` logo acima, cujo resultado alimenta o
   `BannerPendencias`. O que estava órfão era o EXPORT, criado quando a tela de
   Testes o consumia direto.

   > ## "Órfão" e "super-exportado" têm o mesmo `grep` e consertos opostos: um se apaga, o outro se despromove.

   ⚠️ Reexportar sem consumidor faz dele um endpoint de server action a mais —
   em `"use server"` todo export é entrada. */
async function getInstallChecklist(workspaceId?: string | null): Promise<ChecklistItemDTO[]> {
  const userId = await requireUserId();
  const escopo = await escopoDeConfig(userId, workspaceId ?? (await getLastWorkspaceId()));

  const [contasComPerfil, trackedAccounts, webhooks, clicks, pixels] = await Promise.all([
    prisma.adAccount.count({ where: { userId, adProfileId: { not: null }, ...escopo.where } }),
    prisma.adAccount.count({ where: { userId, trackingEnabled: true, ...escopo.where } }),
    prisma.webhook.count({ where: { userId, active: true, ...escopo.where } }),
    prisma.click.count({ where: { userId } }),
    prisma.pixelConfig.findMany({
      where: { userId, enabled: true, ...escopo.where },
      select: { id: true, metaPixels: { select: { accessToken: true } } },
    }),
  ]);

  const pixelsComToken = pixels.filter((p) => p.metaPixels.some((m) => m.accessToken)).length;

  return [
    {
      key: "facebook",
      label: "Conta de anúncio nesta área",
      ok: contasComPerfil > 0,
      detail:
        contasComPerfil > 0
          ? `${plural(contasComPerfil, "conta de anúncio vinculada", "contas de anúncio vinculadas")} a esta área.`
          : "Nenhuma conta de anúncio nesta área — sem ela, o gasto exibido não é o desta operação.",
      href: "/dashboard/integracoes/anuncios",
    },
    {
      key: "adAccount",
      label: "Ao menos uma conta de anúncio ativa",
      ok: trackedAccounts > 0,
      detail:
        trackedAccounts > 0
          ? `${plural(trackedAccounts, "conta com rastreamento ligado", "contas com rastreamento ligado")}.`
          : "Nenhuma conta de anúncio com rastreamento ligado.",
      href: "/dashboard/integracoes/anuncios",
    },
    {
      key: "webhook",
      label: "Webhook de gateway configurado",
      ok: webhooks > 0,
      detail: webhooks > 0 ? `${plural(webhooks, "webhook ativo", "webhooks ativos")}.` : "Nenhum webhook ativo — as vendas não chegam.",
      href: "/dashboard/integracoes/webhooks",
    },
    {
      key: "utmScript",
      label: "Script de UTM detectado",
      ok: clicks > 0,
      detail:
        clicks > 0
          ? `${plural(clicks, "clique já recebido", "cliques já recebidos")} — o script está reportando.`
          : "Nenhum clique recebido ainda. Copie o script em UTM & Snippets e instale no <head> do site.",
      // ⚠️ Único item que NÃO é por área: o script de UTM é único por conta,
      // por desenho, e um `Click` não tem dono declarado.
      href: "/dashboard/utm",
    },
    {
      key: "pixel",
      label: "Pixel configurado",
      ok: pixelsComToken > 0,
      detail:
        // "token da CAPI" é ESTADO interno — o vocabulário que o resto do
        // produto já trocou por "conectado". O token só é nomeado onde ele é o
        // que o usuário cola (o campo da gaveta do Pixel).
        pixelsComToken > 0
          ? `${plural(pixelsComToken, "pixel conectado", "pixels conectados")}.`
          : "Nenhum pixel conectado — os eventos não chegam ao Facebook.",
      href: "/dashboard/integracoes/pixel",
    },
  ];
}

// ─────────────── Padrões de ambiente de teste aprovados ───────────────

export interface PadraoAprovadoDTO {
  padrao: string;
  criadoEm: string | null;
}

/**
 * Os padrões que o usuário aprovou, e que BLOQUEIAM o envio à CAPI na ingestão.
 *
 * 🔴 Existem na tela porque bloquear é irreversível: o evento não vai para a
 * Meta e não volta. Uma regra de bloqueio que só saísse por SQL seria
 * irreversível na prática — e irreversível é o que ela não pode ser.
 */
export async function listarPadroesDeTeste(): Promise<PadraoAprovadoDTO[]> {
  const userId = await requireUserId();
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { testHostPatterns: true } });
  return lerPadroes(u?.testHostPatterns).map((p) => ({ padrao: p.padrao, criadoEm: p.criadoEm ?? null }));
}

/** Remove um padrão. A partir daí os hosts dele voltam a contar e a ir à CAPI. */
export async function removerPadraoDeTeste(padrao: string): Promise<PadraoAprovadoDTO[]> {
  const userId = await requireUserId();
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { testHostPatterns: true } });
  const restantes = lerPadroes(u?.testHostPatterns).filter((p) => p.padrao !== padrao);
  await prisma.user.update({
    where: { id: userId },
    data: { testHostPatterns: JSON.parse(JSON.stringify(restantes)) },
  });
  return restantes.map((p) => ({ padrao: p.padrao, criadoEm: p.criadoEm ?? null }));
}


/**
 * Estado das rotinas agendadas — no RODAPÉ do Dashboard desde 17/08/2026.
 *
 * 🔴 **Isto e a rede de seguranca de CINCO rotinas** — sincronizacao com o
 * Facebook, motor de regras, relatorios, manutencao e o historico de primeira
 * conexao. Um agendador que para nao tem sintoma imediato: o painel responde,
 * os dados estao la, e o que morre e o que acontece com ninguem olhando.
 *
 * ⚠️ Nao e recortado por area: o agendamento e da CONTA inteira, nao de uma
 * operacao. Recortar aqui esconderia a rotina parada de quem estivesse na area
 * errada — mesma razao pela qual notificacao sem venda aparece em toda area.
 */
export async function getRotinasAgendadas(): Promise<{
  rota: string;
  rotulo: string;
  ultimaEm: string | null;
  atrasada: boolean;
  falhou: boolean;
  erro: string | null;
}[]> {
  await requireUserId();
  const linhas = await estadoDasRotinas();
  // Datas viram string: o retorno de server action e serializado, e um `Date`
  // atravessa como string de qualquer forma — melhor ser explicito.
  return linhas.map((l) => ({ ...l, ultimaEm: l.ultimaEm?.toISOString() ?? null }));
}
