import type { NextRequest } from "next/server";

import { cronAutorizado, naoAutorizado } from "@/lib/cronAuth";
import { registrarExecucao } from "@/lib/cronBatimento";

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
async function executar(req: NextRequest) {
  if (!cronAutorizado(req)) return naoAutorizado();

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

    // ⚠️ Guarda de idempotência — SEM ela esta rota não pode ser chamada mais de
    // uma vez por hora. `generateReportNotification` cria uma Notification
    // incondicionalmente, então um cron de 1 minuto geraria **60 relatórios**
    // durante a hora das 08h. Como o gatilho externo passou a ser configurável
    // pelo usuário, a rota não pode depender de quem chama para estar correta.
    //
    // A janela é a hora cheia do fuso DAQUELE usuário — é o mesmo relógio que
    // decidiu disparar o relatório.
    const inicioDaHora = new Date(agora.getTime() - (agora.getTime() % 3_600_000));
    const jaEnviado = await prisma.notification.findFirst({
      where: { userId: s.userId, type: "RELATORIO", timestamp: { gte: inicioDaHora } },
      select: { id: true },
    });
    if (jaEnviado) continue;

    try {
      await generateReportNotification(s.userId, s.reportPattern);
      generated++;
    } catch {
      /* segue para o próximo */
    }
  }
  return Response.json({ ok: true, generated, avaliados: settings.length, horas: [...horasAvaliadas] });
}

/**
 * Envolve a rotina para registrar o BATIMENTO.
 *
 * Agendador externo avisa quando a execucao falha; nenhum avisa quando ele
 * proprio para. Quem detecta a ausencia e o servidor — ver `lib/cronBatimento.ts`.
 *
 * ⚠️ Registra nos DOIS caminhos, e com `ok` diferente: silencio (nunca rodou) e
 * falha (rodou e quebrou) sao sinais distintos, e a tela os separa. Registrar so
 * o sucesso faria uma rotina que falha sempre parecer uma rotina que parou.
 *
 * ⚠️ 401 NAO conta como execucao: chamada sem o segredo nao e o agendador
 * trabalhando, e marcar batimento ali esconderia justamente o caso em que o
 * `CRON_SECRET` foi trocado e o agendador parou de ser aceito.
 */
export async function GET(req: NextRequest) {
  const t0 = Date.now();
  try {
    const res = await executar(req);
    if (res.status !== 401) {
      await registrarExecucao("reports", { ok: res.ok, duracaoMs: Date.now() - t0 });
    }
    return res;
  } catch (e) {
    await registrarExecucao("reports", {
      ok: false,
      duracaoMs: Date.now() - t0,
      erro: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
