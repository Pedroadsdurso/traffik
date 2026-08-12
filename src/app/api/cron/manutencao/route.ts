import type { NextRequest } from "next/server";

import { cronAutorizado, naoAutorizado } from "@/lib/cronAuth";
import { registrarExecucao } from "@/lib/cronBatimento";
import { prisma } from "@/lib/prisma";
import { RETENCAO_DIAS, anonimizarIp } from "@/lib/geo/anonimizarIp";
// ⛔ Os prazos NÃO moram mais aqui: a tela de Webhooks explica ao usuário por
// que uma entrega antiga sumiu da lista, e precisa do MESMO número. Duas cópias
// divergiriam em silêncio — a purga apagando em 30 dias e a tela prometendo 90.
import { DIAS_LOG_FALHA, DIAS_LOG_SUCESSO } from "@/lib/webhooks/retencao";

export const maxDuration = 60;

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
async function executar(req: NextRequest) {
  if (!cronAutorizado(req)) return naoAutorizado();

  const agora = new Date();

  const purgadosSucesso = await prisma.webhookLog.deleteMany({
    where: { status: "PROCESSADO", createdAt: { lt: new Date(agora.getTime() - DIAS_LOG_SUCESSO * 864e5) } },
  });
  const purgadosFalha = await prisma.webhookLog.deleteMany({
    where: {
      status: { in: ["REJEITADO", "ERRO", "RECEBIDO"] },
      createdAt: { lt: new Date(agora.getTime() - DIAS_LOG_FALHA * 864e5) },
    },
  });

  // ── Anonimização progressiva do IP dos cliques ──────────────────────────
  // Passada a retenção, o IP em claro não serve mais para nada: o match por IP
  // tem janela de 12h e a atribuição da Meta é de 7 dias. Ver
  // `lib/geo/anonimizarIp.ts` para por que isto é progressivo e não de uma vez.
  const corteIp = new Date(agora.getTime() - RETENCAO_DIAS * 864e5);
  const aAnonimizar = await prisma.click.findMany({
    where: { ip: { not: null }, timestamp: { lt: corteIp }, NOT: { ip: { startsWith: "iph.v1." } } },
    select: { id: true, ip: true },
    // Teto por execução: o cron é diário e a primeira passada pode ter um
    // histórico grande. Melhor 5 mil por dia do que uma transação gigante que
    // estoura o `maxDuration` e não anonimiza nada.
    take: 5000,
  });
  for (const c of aAnonimizar) {
    await prisma.click.update({ where: { id: c.id }, data: { ip: anonimizarIp(c.ip!) } });
  }

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
    webhookLogsPurgados: { sucesso: purgadosSucesso.count, falha: purgadosFalha.count },
    retencaoLogDias: { sucesso: DIAS_LOG_SUCESSO, falha: DIAS_LOG_FALHA },
    ipsAnonimizados: aAnonimizar.length,
    // `true` = havia mais que o teto e a próxima execução continua. Sem este
    // campo, uma primeira passada parcial pareceria uma passada completa.
    ipsRestantes: aAnonimizar.length === 5000,
    retencaoIpDias: RETENCAO_DIAS,
    tokensAvisados: avisos,
    perfisEmRisco: perfis.length,
  });
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
      await registrarExecucao("manutencao", { ok: res.ok, duracaoMs: Date.now() - t0 });
    }
    return res;
  } catch (e) {
    await registrarExecucao("manutencao", {
      ok: false,
      duracaoMs: Date.now() - t0,
      erro: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
