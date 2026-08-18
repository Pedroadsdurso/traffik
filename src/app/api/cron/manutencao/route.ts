import type { NextRequest } from "next/server";

import { cronAutorizado, naoAutorizado } from "@/lib/cronAuth";
import { registrarExecucao } from "@/lib/cronBatimento";
import { prisma } from "@/lib/prisma";
import { PREFIXO_IP_ANONIMO, RETENCAO_DIAS, anonimizarIp } from "@/lib/geo/anonimizarIp";
// ⛔ Os prazos NÃO moram mais aqui: a tela de Webhooks explica ao usuário por
// que uma entrega antiga sumiu da lista, e precisa do MESMO número. Duas cópias
// divergiriam em silêncio — a purga apagando em 30 dias e a tela prometendo 90.
import { DIAS_LOG_FALHA, DIAS_LOG_SUCESSO } from "@/lib/webhooks/retencao";
/**
 * ⛔ O LIMIAR DO TOKEN E A DERIVAÇÃO DELE VÊM DE `token.ts`, e isto é a MESMA
 * correção que a linha acima já fizera para os prazos de log — só que aqui ela
 * levou mais tempo para acontecer, e o custo apareceu.
 *
 * 🔴 **Havia um `AVISO_TOKEN_DIAS = 14` local**, enquanto a tela pinta atenção
 * a partir de `DIAS_ATENCAO = 30`. E o cabeçalho de `token.ts` afirmava, por
 * escrito, que os dois eram *"o mesmo limiar, de propósito"* — a segunda fonte
 * não só divergia: ela divergia com a documentação jurando o contrário.
 *
 * ### ✅ ALINHADO EM 30, e a regra que decidiu é a de desempate do dono
 *
 * *"O que não corta informação do usuário vence."* Baixar a tela para 14
 * apagaria o aviso entre o 15º e o 30º dia — informação que hoje existe.
 * Subir o cron para 30 não apaga nada.
 *
 * ⚠️ **A consequência é volume**, e ela fica registrada: a janela de aviso vai
 * de ≤14 para ≤30 notificações por perfil (o `jaAvisado` abaixo limita a uma
 * por dia). O nag para no instante em que o usuário reconecta.
 */
import { DIAS_ATENCAO, detalheDoToken, estadoDoToken, rotuloDoToken, tokenPedeAtencao } from "@/lib/integracoes/token";

export const maxDuration = 60;

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
    /* ⛔ O PREFIXO VEM DA CONSTANTE, nunca de um literal aqui.
       Ele era `"iph.v1."` escrito na mão, e a cópia concordava com a origem —
       o que faz duplicata sobreviver. Subindo para `v2`, este `where` pararia
       de excluir as linhas já anonimizadas: elas entrariam na seleção, o
       `anonimizarIp` as devolveria intactas, e o teto de 5.000 seria consumido
       por no-ops. A purga rodaria saudável, com `ok: true` no batimento, e a
       fila de IPs em claro **nunca andaria**. */
    where: { ip: { not: null }, timestamp: { lt: corteIp }, NOT: { ip: { startsWith: PREFIXO_IP_ANONIMO } } },
    select: { id: true, ip: true },
    // Teto por execução: o cron é diário e a primeira passada pode ter um
    // histórico grande. Melhor 5 mil por dia do que uma transação gigante que
    // estoura o `maxDuration` e não anonimiza nada.
    take: 5000,
  });
  for (const c of aAnonimizar) {
    await prisma.click.update({ where: { id: c.id }, data: { ip: anonimizarIp(c.ip!) } });
  }

  /* ── Tokens vencendo, já vencidos, ou de DATA DESCONHECIDA ──────────────
     🔴 O `where` era `{ tokenExpiresAt: { not: null, lt: limite } }`, e aquele
     `not: null` excluía da notificação exatamente o grupo que o `token.ts`
     chama de **"o mais perigoso da base"**: os perfis conectados antes de a
     coluna existir — os mais antigos, logo os mais prováveis de já estarem
     vencidos.

     ⛔ O efeito era o pior arranjo possível: só a TELA os mostrava, e o
     cabeçalho do `token.ts` diz, sobre a tela, que *"o usuário pode nunca
     abri-la"*. O aviso existia e não alcançava ninguém.

     ⚠️ A consulta é um pré-filtro GROSSO de propósito: quem decide é
     `tokenPedeAtencao`, logo abaixo. Um `where` um pouco mais largo que o
     necessário é inofensivo; um mais estreito perde linha em silêncio — que é
     o que acabou de acontecer aqui. */
  const limite = new Date(agora.getTime() + DIAS_ATENCAO * 864e5);
  const perfis = await prisma.adProfile.findMany({
    where: { OR: [{ tokenExpiresAt: null }, { tokenExpiresAt: { lt: limite } }] },
    select: { id: true, name: true, userId: true, tokenExpiresAt: true },
  });

  let avisos = 0;
  let emRisco = 0;
  for (const p of perfis) {
    /* ⛔ A DERIVAÇÃO NÃO É FEITA AQUI. `estadoDoToken` é a fonte única, e é a
       MESMA que a tela de Integrações e o Dashboard usam — sem isso, "vencido"
       teria três definições em três lugares.

       ⚠️ E o `p.tokenExpiresAt! < agora` que estava nesta linha não sobrevive à
       inclusão dos nulos: o `!` era uma promessa que o `where` fazia e deixou
       de fazer. */
    const estado = estadoDoToken(p.tokenExpiresAt, agora);
    if (!tokenPedeAtencao(estado)) continue;
    emRisco++;
    const vencido = estado.tipo !== "expira";
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
        /* ⛔ O TEXTO SAI DE `token.ts`, não é escrito aqui.
           A tela e a notificação passam a dizer a MESMA frase para o mesmo
           estado — que é a propriedade que o cabeçalho daquele módulo exige e
           que este arquivo vinha quebrando.

           ✅ E isso mata de graça um defeito de FUSO: a versão anterior
           formatava a data com `toLocaleDateString("pt-BR")` **no fuso do
           processo**, que na Vercel é UTC. Um token vencendo às 02h UTC era
           anunciado com a data do dia seguinte para quem está em Brasília. A
           frase de `rotuloDoToken` é relativa ("Expira em N dias") e não tem
           como escorregar de dia. */
        title: `${vencido ? "🔴" : "🟡"} ${rotuloDoToken(estado)} — ${p.name}`,
        content: `${p.name}: ${detalheDoToken(estado) ?? "Reconecte em Integrações › Anúncios."}`,
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
    /* ⛔ O DENOMINADOR É QUEM PASSOU NA GUARDA, não quem a consulta trouxe.
       `perfis.length` era o pré-filtro grosso, e reportar ele superestimaria o
       risco — um número plausível e maior que o real, que é a pior forma de
       errar num relatório de operação. */
    perfisEmRisco: emRisco,
    perfisConsultados: perfis.length,
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
