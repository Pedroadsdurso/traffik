import type { NextRequest } from "next/server";

import { generateReportNotification } from "@/lib/reports/generate";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIMEZONE, hourInTz } from "@/lib/timezone";

export const maxDuration = 60;

/**
 * Cron de hora em hora: gera os relatórios programados cujo horário bate com a
 * hora atual **no fuso de cada usuário**. Protegido por CRON_SECRET.
 *
 * Antes o fuso era fixo em `America/Sao_Paulo` para todo mundo. Isso estava
 * certo enquanto o fuso era implícito, mas agora que cada usuário tem o seu, o
 * "relatório das 08h" de quem está em Manaus chegaria às 07h. A hora passou a
 * ser resolvida por usuário, e a lista é filtrada por "tem ALGUM relatório
 * ligado" em vez de por um campo escolhido antes de saber de quem é.
 *
 * Usa `hourInTz` (`hourCycle: "h23"`) e não um `Intl` montado à mão: com
 * `hour12: false` o `Intl` devolve **24** à meia-noite, que não casaria com
 * nenhum campo.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const settings = await prisma.notificationSettings.findMany({
    where: { OR: [{ report08: true }, { report12: true }, { report18: true }, { report23: true }] },
    select: {
      userId: true,
      reportPattern: true,
      report08: true,
      report12: true,
      report18: true,
      report23: true,
      user: { select: { timezone: true } },
    },
  });

  const agora = new Date();
  let generated = 0;
  const horasAvaliadas = new Set<number>();

  for (const s of settings) {
    const hora = hourInTz(agora, s.user?.timezone || DEFAULT_TIMEZONE);
    horasAvaliadas.add(hora);
    const ligado =
      (hora === 8 && s.report08) ||
      (hora === 12 && s.report12) ||
      (hora === 18 && s.report18) ||
      (hora === 23 && s.report23);
    if (!ligado) continue;
    try {
      await generateReportNotification(s.userId, s.reportPattern);
      generated++;
    } catch {
      /* segue para o próximo */
    }
  }
  return Response.json({ ok: true, generated, avaliados: settings.length, horas: [...horasAvaliadas] });
}
