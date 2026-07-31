"use server";

import { auth } from "@/auth";
import { encryptSecret } from "@/lib/crypto/secrets";
import { getLastWorkspaceId } from "@/lib/actions/workspaces";
import { escopoDeConfig } from "@/lib/areas/escopoConfig";
import { prisma } from "@/lib/prisma";
import type { PixelEventType, PurchaseSendMode, PurchaseValueMode } from "@/generated/prisma/enums";

/**
 * `clique_checkout` é o padrão: dispara no clique num link que leva ao gateway,
 * na página de vendas. É o único modo que funciona quando o checkout é hospedado
 * pelo gateway (pay.kirvano.com), onde o cliente não consegue instalar script.
 */
import { lerDonos, type MapaDeDonos } from "@/lib/pixel/donos";

export type DetectionType = "clique_checkout" | "contem_texto" | "contem_css" | "contem_url";

export interface MetaPixelDTO {
  id: string;
  pixelId: string;
  nickname: string | null;
  hasToken: boolean;
}

export interface EventRuleDTO {
  eventType: PixelEventType;
  enabled: boolean;
  detectionType: DetectionType | null;
  detectionValue: string | null;
  sendMode: PurchaseSendMode | null;
  valueMode: PurchaseValueMode | null;
  fixedValue: number | null;
  targetProduct: string | null;
}

export interface PixelConfigDTO {
  id: string;
  name: string;
  enabled: boolean;
  metaPixels: MetaPixelDTO[];
  rules: EventRuleDTO[];
  /**
   * Quem envia cada evento para a Meta. Evento ausente = `traffik`.
   *
   * ⚠️ Só decide quem fala com a META. O evento continua sendo GRAVADO em
   * qualquer caso — o funil e o Dashboard contam do nosso banco.
   */
  eventOwners: MapaDeDonos;
}

/** Input do formulário do popup (Bloco 12). */
export interface PixelFormInput {
  name: string;
  /** Área dona. Omitido = a área ativa. Só é lido na criação. */
  workspaceId?: string | null;
  metaPixels: { pixelId: string; accessToken?: string; nickname?: string }[];
  lead: boolean;
  addToCart: boolean;
  initiateCheckout: { enabled: boolean; detectionType?: DetectionType; detectionValue?: string };
  purchase: {
    enabled: boolean;
    sendMode: PurchaseSendMode;
    valueMode: PurchaseValueMode;
    fixedValue?: number | null;
    targetProduct?: string | null;
  };
  /** Quem envia cada evento. Omitido = mantém o que está gravado. */
  eventOwners?: MapaDeDonos;
}

const EVENT_TYPES: PixelEventType[] = ["LEAD", "ADD_TO_CART", "INITIATE_CHECKOUT", "PURCHASE"];

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

type DetectionJson = { tipo?: DetectionType; valor?: string } | null;

function toDTO(px: {
  id: string;
  name: string;
  enabled: boolean;
  eventOwners: unknown;
  metaPixels: { id: string; pixelId: string; nickname: string | null; accessToken: string | null }[];
  eventRules: {
    eventType: PixelEventType;
    enabled: boolean;
    detection: unknown;
    sendMode: PurchaseSendMode | null;
    valueMode: PurchaseValueMode | null;
    fixedValue: unknown;
    targetProduct: string | null;
  }[];
}): PixelConfigDTO {
  const byType = new Map(px.eventRules.map((r) => [r.eventType, r]));
  return {
    id: px.id,
    name: px.name,
    enabled: px.enabled,
    eventOwners: lerDonos(px.eventOwners),
    metaPixels: px.metaPixels.map((m) => ({
      id: m.id,
      pixelId: m.pixelId,
      nickname: m.nickname,
      hasToken: Boolean(m.accessToken),
    })),
    rules: EVENT_TYPES.map((t) => {
      const r = byType.get(t);
      const det = (r?.detection as DetectionJson) ?? null;
      return {
        eventType: t,
        enabled: r?.enabled ?? false,
        detectionType: det?.tipo ?? null,
        detectionValue: det?.valor ?? null,
        sendMode: r?.sendMode ?? "APENAS_APROVADAS",
        valueMode: r?.valueMode ?? "VALOR_DA_VENDA",
        fixedValue: r?.fixedValue != null ? Number(r.fixedValue) : null,
        targetProduct: r?.targetProduct ?? null,
      };
    }),
  };
}

const INCLUDE = { metaPixels: true, eventRules: true } as const;

/**
 * Pixels da Área de Trabalho ativa. Na Principal inclui os de `workspaceId`
 * NULO (catch-all) — senão todo pixel existente sumiria da tela enquanto o
 * script dele continuaria disparando no site do cliente.
 */
export async function listPixels(workspaceId?: string | null): Promise<PixelConfigDTO[]> {
  const userId = await requireUserId();
  const escopo = await escopoDeConfig(userId, workspaceId ?? (await getLastWorkspaceId()));
  const pixels = await prisma.pixelConfig.findMany({
    where: { userId, ...escopo.where },
    orderBy: { createdAt: "asc" },
    include: INCLUDE,
  });
  return pixels.map(toDTO);
}

/** Produtos distintos que já têm venda trackeada (para a regra de Purchase). */
export async function listTrackedProducts(): Promise<string[]> {
  const userId = await requireUserId();
  const rows = await prisma.sale.findMany({
    where: { userId },
    distinct: ["product"],
    select: { product: true },
    orderBy: { product: "asc" },
  });
  return rows.map((r) => r.product).filter(Boolean);
}

/** Monta os event rules a partir do formulário. */
function rulesFromForm(input: PixelFormInput) {
  const detection =
    input.initiateCheckout.enabled && input.initiateCheckout.detectionType && input.initiateCheckout.detectionValue?.trim()
      ? { tipo: input.initiateCheckout.detectionType, valor: input.initiateCheckout.detectionValue.trim() }
      : undefined;
  return [
    { eventType: "LEAD" as const, enabled: input.lead },
    { eventType: "ADD_TO_CART" as const, enabled: input.addToCart },
    { eventType: "INITIATE_CHECKOUT" as const, enabled: input.initiateCheckout.enabled, detection },
    {
      eventType: "PURCHASE" as const,
      enabled: input.purchase.enabled,
      sendMode: input.purchase.sendMode,
      valueMode: input.purchase.valueMode,
      fixedValue: input.purchase.valueMode === "VALOR_FIXO" ? input.purchase.fixedValue ?? 0 : null,
      targetProduct: input.purchase.targetProduct?.trim() || null,
    },
  ];
}

/** Normaliza o form e **encripta** os tokens antes de tocar no banco. */
function cleanMetaPixels(list: PixelFormInput["metaPixels"]) {
  return list
    .filter((m) => m.pixelId?.trim())
    .map((m) => {
      const token = m.accessToken?.trim();
      return {
        pixelId: m.pixelId.trim(),
        accessToken: token ? encryptSecret(token) : null,
        nickname: m.nickname?.trim() || null,
      };
    });
}

export async function createPixel(input: PixelFormInput): Promise<PixelConfigDTO> {
  const userId = await requireUserId();
  // Nasce vinculado à área ativa. O `PixelConfig.id` embutido no script NÃO
  // muda por isso — nenhum identificador já emitido muda de significado.
  const escopo = await escopoDeConfig(userId, input.workspaceId ?? (await getLastWorkspaceId()));
  const name = input.name?.trim() || "Meta Pixel";
  const metaPixels = cleanMetaPixels(input.metaPixels);
  if (metaPixels.length === 0) throw new Error("Adicione ao menos um pixel da Meta.");

  const px = await prisma.pixelConfig.create({
    data: {
      userId,
      name,
      provider: "META",
      workspaceId: escopo.areaId || null,
      eventOwners: input.eventOwners ?? {},
      metaPixels: { create: metaPixels },
      eventRules: { create: rulesFromForm(input) },
    },
    include: INCLUDE,
  });
  return toDTO(px);
}

export async function updatePixel(id: string, input: PixelFormInput): Promise<PixelConfigDTO> {
  const userId = await requireUserId();
  const existing = await prisma.pixelConfig.findFirst({
    where: { id, userId },
    select: { id: true, metaPixels: { select: { pixelId: true, accessToken: true } } },
  });
  if (!existing) throw new Error("Pixel não encontrado.");

  // O token nunca volta para o cliente, então o formulário reenvia vazio para os
  // pixels já salvos. Preserva o token atual quando o form não trouxer um novo.
  const tokenByPixelId = new Map(existing.metaPixels.map((m) => [m.pixelId, m.accessToken]));
  const metaPixels = cleanMetaPixels(input.metaPixels).map((m) => ({
    ...m,
    accessToken: m.accessToken ?? tokenByPixelId.get(m.pixelId) ?? null,
  }));
  if (metaPixels.length === 0) throw new Error("Adicione ao menos um pixel da Meta.");

  // Substitui pixels e regras (mais simples e previsível que fazer diff).
  await prisma.$transaction([
    prisma.metaPixel.deleteMany({ where: { pixelConfigId: id } }),
    prisma.pixelEventRule.deleteMany({ where: { pixelConfigId: id } }),
    prisma.pixelConfig.update({
      where: { id },
      data: {
        name: input.name?.trim() || "Meta Pixel",
        // ⚠️ `undefined` MANTÉM o valor gravado; `{}` o zera. O formulário só
        // manda o mapa quando o usuário mexeu nele — sem esta distinção, salvar
        // qualquer outra coisa do pixel devolveria todos os eventos à Traffik em
        // silêncio, que é o mesmo defeito do token apagado ao renomear.
        eventOwners: input.eventOwners ?? undefined,
        metaPixels: { create: metaPixels },
        eventRules: { create: rulesFromForm(input) },
      },
    }),
  ]);
  const px = await prisma.pixelConfig.findUnique({ where: { id }, include: INCLUDE });
  return toDTO(px!);
}

export async function deletePixel(id: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  const px = await prisma.pixelConfig.findFirst({ where: { id, userId }, select: { id: true } });
  if (!px) throw new Error("Pixel não encontrado.");
  await prisma.pixelConfig.delete({ where: { id } });
  return { id };
}

export async function togglePixel(id: string): Promise<{ id: string; enabled: boolean }> {
  const userId = await requireUserId();
  const px = await prisma.pixelConfig.findFirst({ where: { id, userId }, select: { enabled: true } });
  if (!px) throw new Error("Pixel não encontrado.");
  const updated = await prisma.pixelConfig.update({ where: { id }, data: { enabled: !px.enabled } });
  return { id, enabled: updated.enabled };
}
