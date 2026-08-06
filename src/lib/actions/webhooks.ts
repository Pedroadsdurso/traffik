"use server";

import { auth } from "@/auth";
import { getAppUrl } from "@/lib/appUrl";
import { getLastWorkspaceId } from "@/lib/actions/workspaces";
import { escopoDeConfig } from "@/lib/areas/escopoConfig";
import { prisma } from "@/lib/prisma";
import { gatewayDoWebhook, gatewayValido, REGISTRO } from "@/lib/gateways/registro";

export interface WebhookRowDTO {
  id: string;
  name: string;
  platform: string;
  token: string;
  url: string;
  active: boolean;
  eventCount: number;
  /** Se há chave de segurança configurada. */
  hasSecret: boolean;
  /**
   * A chave, **em texto**, e SÓ para gateway cuja chave nós geramos.
   *
   * 🔴 Sem isto a Cakto era um beco sem saída: a ferramenta gerava a chave,
   * mostrava uma vez e nunca mais. Quem perdesse a cópia — ou copiasse a errada
   * — não tinha como recuperá-la, e a única saída era apagar o webhook e criar
   * outro, trocando a URL no painel do gateway.
   *
   * ⚠️ Fica `null` para gateway cuja chave o USUÁRIO cria (Kirvano): ali ele já
   * tem o valor no painel do gateway, e expor não resolveria nada que ele não
   * pudesse resolver de lá. Menos superfície, mesma utilidade.
   */
  secret: string | null;
  /**
   * Ultimo evento RECEBIDO. `null` = nunca recebeu nada.
   *
   * ⚠️ Campo ADITIVO, so leitura. A coluna ja existia e ja era escrita a cada
   * webhook processado; o que faltava era ela chegar a tela. E o que distingue
   * "webhook configurado e funcionando" de "configurado e mudo ha 30 dias" —
   * e o segundo caso e indistinguivel do primeiro sem esta data.
   */
  lastEventAt: Date | null;
  /** Quando o webhook foi criado. Alimenta "Criada em" no painel. */
  createdAt: Date;
}

/**
 * A URL pública vem do REGISTRO, não de um `if` por plataforma.
 *
 * ⚠️ A Kirvano tem uma URL própria (`/api/webhook/kirvano?id=`) por motivo
 * histórico: ela já está colada no painel do gateway e nenhum identificador já
 * emitido pode mudar de significado. Gateway novo cai no caminho universal —
 * e é o registro que sabe disso, não esta função.
 */
function toDTO(w: {
  id: string;
  name: string;
  platform: string;
  token: string;
  active: boolean;
  eventCount: number;
  secret: string | null;
  lastEventAt: Date | null;
  createdAt: Date;
}): WebhookRowDTO {
  const def = gatewayDoWebhook(w.platform);
  const nosGeramos = def.auth.tipo === "segredo" && def.auth.geradoPorNos;
  return {
    id: w.id,
    name: w.name,
    platform: w.platform,
    token: w.token,
    url: def.urlDoWebhook(w.token, getAppUrl()),
    active: w.active,
    eventCount: w.eventCount,
    hasSecret: Boolean(w.secret),
    secret: nosGeramos ? w.secret : null,
    lastEventAt: w.lastEventAt,
    createdAt: w.createdAt,
  };
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

/**
 * Webhooks da Área de Trabalho ativa.
 *
 * ⚠️ Na Principal a lista inclui os de `workspaceId` NULO — é catch-all. Sem
 * isso, todo webhook existente (que a migration deixou NULO de propósito)
 * sumiria da tela enquanto continuaria recebendo venda no servidor.
 *
 * A área é resolvida AQUI DENTRO quando não vem por parâmetro: o layout busca
 * 12 conjuntos de dados em `Promise.all`, e esperar a área antes de disparar
 * tudo somaria um round-trip ao caminho crítico de toda navegação.
 */
export async function listWebhooks(workspaceId?: string | null): Promise<WebhookRowDTO[]> {
  const userId = await requireUserId();
  const escopo = await escopoDeConfig(userId, workspaceId ?? (await getLastWorkspaceId()));
  const rows = await prisma.webhook.findMany({
    where: { userId, ...escopo.where },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDTO);
}

export async function createWebhook(input: {
  platform: string;
  name?: string;
  /** Token de segurança do gateway (obrigatório na Kirvano). */
  secret?: string;
  /** Área dona. Omitido = a área ativa. */
  workspaceId?: string | null;
}): Promise<WebhookRowDTO> {
  const userId = await requireUserId();
  // Nasce vinculado à área em que foi criado — é o que faz "a área é a
  // ferramenta inteira" valer também para o que se cadastra dentro dela.
  const escopo = await escopoDeConfig(userId, input.workspaceId ?? (await getLastWorkspaceId()));
  // ⛔ ESTA É A PORTA que impõe o domínio de `Webhook.platform`. Um id fora do
  // registro cairia num gateway inexistente e a venda seria recusada — em
  // silêncio, do ponto de vista de quem colou a URL no painel do gateway.
  //
  // ⚠️ Gateway `ativo: false` (Hotmart, Kiwify) tem entrada no registro para que
  // linhas antigas continuem funcionando, mas NÃO pode ser criado: a tela mostra
  // "em breve" e o servidor recusa, porque server action é endpoint público e o
  // bloqueio da tela é conveniência.
  const escolhido = input.platform?.toUpperCase() ?? "";
  const platform = gatewayValido(escolhido) && REGISTRO[escolhido].ativo ? escolhido : "CUSTOM";
  const name = input.name?.trim() || `Webhook ${REGISTRO[platform].nome}`;
  const secret = input.secret?.trim() || null;

  // 🐛 Aqui havia um cast (`platform as ...`) para o TypeScript aceitar uma
  // String numa coluna que ainda era enum. Ele calava o compilador sobre
  // exatamente o que estourava no Postgres: gravar "CAKTO" num enum que só
  // tinha KIRVANO/HOTMART/KIWIFY/CUSTOM. Salvar um webhook da Cakto falhava.
  //
  // ⚠️ **Cast num limite de persistência é um alerta, não uma solução.** Ele
  // troca um erro de compilação por um erro de runtime — e o de runtime só
  // aparece quando alguém clica. A coluna virou `String` na migration
  // `20260731020000` e o cast deixou de existir.
  const created = await prisma.webhook.create({
    data: { userId, platform, name, secret, workspaceId: escopo.areaId || null },
  });
  return toDTO(created);
}

export async function updateWebhook(input: {
  id: string;
  name?: string;
  secret?: string;
}): Promise<WebhookRowDTO> {
  const userId = await requireUserId();
  const current = await prisma.webhook.findFirst({ where: { id: input.id, userId } });
  if (!current) throw new Error("Webhook não encontrado.");
  const updated = await prisma.webhook.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() || current.name } : {}),
      // 🔴 VAZIO MANTÉM O ATUAL — nunca apaga.
      //
      // Era `input.secret.trim() || null`, ou seja: campo vazio APAGAVA a chave.
      // A gaveta de edição abre com o campo em branco ("deixe em branco para
      // manter"), então **salvar sem tocar no campo zerava o segredo** e todas
      // as vendas seguintes eram recusadas com 401.
      //
      // ⚠️ É exatamente o bug já documentado do Pixel ("editar um pixel apagava
      // os tokens da CAPI"). Mesma forma, mesmo estrago, outro lugar: um campo
      // que não volta ao cliente não pode ser reenviado vazio e tratado como
      // "apagar". Quem quiser trocar a chave digita uma nova.
      ...(input.secret?.trim() ? { secret: input.secret.trim() } : {}),
    },
  });
  return toDTO(updated);
}

export async function toggleWebhook(id: string): Promise<WebhookRowDTO> {
  const userId = await requireUserId();
  const current = await prisma.webhook.findFirst({ where: { id, userId } });
  if (!current) throw new Error("Webhook não encontrado.");
  const updated = await prisma.webhook.update({
    where: { id },
    data: { active: !current.active },
  });
  return toDTO(updated);
}

export async function deleteWebhook(id: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  const current = await prisma.webhook.findFirst({ where: { id, userId }, select: { id: true } });
  if (!current) throw new Error("Webhook não encontrado.");
  await prisma.webhook.delete({ where: { id } });
  return { id };
}
