import type { NextRequest } from "next/server";

import { cronAutorizado, naoAutorizado } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/** Retenção do log de webhooks. É dado de depuração, não de negócio. */
const DIAS_WEBHOOK_LOG = 90;

/** A partir de quantos dias do vencimento do token avisar o usuário. */
const AVISO_TOKEN_DIAS = 14;

/**
 * Manutenção diária: retenção de logs + aviso de token do Facebook vencendo.
 *
 * Cobre duas lacunas que não tinham NADA rodando por elas:
 *
 * 1. **`WebhookLog` crescia para sempre** (dívida técnica #4 do CLAUDE.md).
 *    É o payload cru de cada webhook recebido, útil para depurar "meu gateway
 *    mandou e não chegou" — e sem valor depois de alguns meses.
 *
 * 2. **O token do Facebook expira e ninguém avisa.** `AdProfile.tokenExpiresAt`
 *    era gravado no OAuth e nunca mais lido. Quando vence, a sincronização
 *    passa a falhar em silêncio (o erro morre em `summary.errors`, que ninguém
 *    olha) e o usuário só descobre pelo gasto congelado. Agora vira uma
 *    notificação SISTEMA — não há refresh automático de token implementado, a
 *    reconexão é manual.
 *
 * > ⚠️ **`PixelEvent` e `Click` NÃO são purgados de propósito.** São dado
 * > analítico: alimentam o funil, a coluna IC e o histórico do dashboard.
 * > Apagá-los reescreveria relatórios de períodos passados. Se um dia virar
 * > problema de volume, o caminho é agregação, não exclusão.
 */
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return naoAutorizado();

  const agora = new Date();
  const corte = new Date(agora.getTime() - DIAS_WEBHOOK_LOG * 864e5);

  const purgados = await prisma.webhookLog.deleteMany({ where: { createdAt: { lt: corte } } });

  // Tokens vencendo ou já vencidos.
  const limite = new Date(agora.getTime() + AVISO_TOKEN_DIAS * 864e5);
  const perfis = await prisma.adProfile.findMany({
    where: { tokenExpiresAt: { not: null, lt: limite } },
    select: { id: true, name: true, userId: true, tokenExpiresAt: true },
  });

  let avisos = 0;
  for (const p of perfis) {
    const vencido = p.tokenExpiresAt! < agora;
    // Um aviso por perfil por dia — sem isto, um cron diário viraria uma
    // notificação nova a cada execução até o usuário reconectar.
    const inicioDoDia = new Date(agora.getTime() - (agora.getTime() % 864e5));
    const jaAvisado = await prisma.notification.findFirst({
      where: { userId: p.userId, type: "SISTEMA", timestamp: { gte: inicioDoDia }, title: { contains: p.name } },
      select: { id: true },
    });
    if (jaAvisado) continue;

    await prisma.notification.create({
      data: {
        userId: p.userId,
        type: "SISTEMA",
        title: vencido ? `🔴 Token expirado — ${p.name}` : `🟡 Token expirando — ${p.name}`,
        content: vencido
          ? `A conexão com o Facebook do perfil ${p.name} expirou. A sincronização parou: reconecte em Integrações › Anúncios.`
          : `A conexão do perfil ${p.name} expira em ${p.tokenExpiresAt!.toLocaleDateString("pt-BR")}. Reconecte para não interromper a sincronização.`,
      },
    });
    avisos++;
  }

  return Response.json({
    ok: true,
    webhookLogsPurgados: purgados.count,
    retencaoDias: DIAS_WEBHOOK_LOG,
    tokensAvisados: avisos,
    perfisEmRisco: perfis.length,
  });
}
