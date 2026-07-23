import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { sendPurchaseEvent } from "@/lib/facebook/capi";
import { prisma } from "@/lib/prisma";

/**
 * Envia um evento Purchase de teste real para a Conversions API do pixel
 * escolhido. Se `testEventCode` for informado, aparece na aba "Testar eventos"
 * do Gerenciador de Eventos da Meta.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { pixelConfigId?: string; testEventCode?: string };
  if (!body.pixelConfigId) return Response.json({ error: "Pixel não informado." }, { status: 400 });

  const pixel = await prisma.pixelConfig.findFirst({
    where: { id: body.pixelConfigId, userId: session.user.id },
    select: { pixelId: true, accessToken: true },
  });
  if (!pixel) return Response.json({ error: "Pixel não encontrado." }, { status: 404 });
  if (!pixel.accessToken) return Response.json({ error: "Pixel sem token da Conversions API." }, { status: 400 });

  const result = await sendPurchaseEvent({
    pixelId: pixel.pixelId,
    accessToken: pixel.accessToken,
    value: 1,
    currency: "BRL",
    eventId: "test-" + Date.now(),
    email: session.user.email,
    testEventCode: body.testEventCode,
  });

  if (!result.ok) return Response.json({ error: result.error ?? "Falha ao enviar." }, { status: 502 });
  return Response.json({ ok: true, testEventCode: body.testEventCode ?? null });
}
