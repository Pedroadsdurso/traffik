/**
 * Persistência do payload cru de cada webhook recebido (Bloco 13). O log é
 * gravado ANTES do processamento, então um payload que quebre no meio do
 * caminho ainda aparece na aba Testes — que é justamente quando o usuário
 * precisa vê-lo.
 *
 * Nada aqui lança: uma falha ao logar não pode derrubar a ingestão da venda.
 */

import type { Prisma } from "@/generated/prisma/client";
import type { WebhookLogStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export interface WebhookLogStart {
  /** "KIRVANO" | "CUSTOM" | "API" … */
  gateway: string;
  payload: unknown;
  userId?: string | null;
  webhookId?: string | null;
}

export interface WebhookLogFinish {
  status: WebhookLogStatus;
  message?: string | null;
  saleId?: string | null;
  httpStatus?: number | null;
}

/**
 * O corpo pode não ser um JSON válido (ou nem ser objeto). Guarda sempre algo
 * inspecionável em vez de perder o payload.
 */
function toJson(payload: unknown): Prisma.InputJsonValue {
  if (payload === null || payload === undefined) return {};
  if (typeof payload === "object") return payload as Prisma.InputJsonValue;
  return { raw: String(payload) };
}

/** Grava o payload recebido e devolve o id do log (ou null se falhar). */
export async function startWebhookLog(input: WebhookLogStart): Promise<string | null> {
  try {
    const log = await prisma.webhookLog.create({
      data: {
        gateway: input.gateway,
        payloadRaw: toJson(input.payload),
        userId: input.userId ?? null,
        webhookId: input.webhookId ?? null,
        status: "RECEBIDO",
      },
      select: { id: true },
    });
    return log.id;
  } catch (e) {
    console.error("[webhookLog] falha ao gravar payload recebido:", e);
    return null;
  }
}

/** Fecha o log com o desfecho do processamento. */
export async function finishWebhookLog(id: string | null, result: WebhookLogFinish): Promise<void> {
  if (!id) return;
  try {
    await prisma.webhookLog.update({
      where: { id },
      data: {
        status: result.status,
        message: result.message ?? null,
        saleId: result.saleId ?? null,
        httpStatus: result.httpStatus ?? null,
      },
    });
  } catch (e) {
    console.error("[webhookLog] falha ao atualizar log:", e);
  }
}
