import type { NextRequest } from "next/server";

import { generateReportNotification } from "@/lib/reports/generate";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/**
 * Vercel Cron (de hora em hora): gera os relatórios programados cujo horário
 * bate com a hora atual em America/Sao_Paulo. Protegido por CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Hora atual no fuso de Brasília.
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()),
  );

  const field = { 8: "report08", 12: "report12", 18: "report18", 23: "report23" }[hour];
  if (!field) return Response.json({ ok: true, skipped: `hora ${hour} sem relatório` });

  const settings = await prisma.notificationSettings.findMany({
    where: { [field]: true },
    select: { userId: true, reportPattern: true },
  });

  let generated = 0;
  for (const s of settings) {
    try {
      await generateReportNotification(s.userId, s.reportPattern);
      generated++;
    } catch {
      /* segue para o próximo */
    }
  }
  return Response.json({ ok: true, hour, generated });
}
