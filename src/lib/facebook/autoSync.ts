import { syncUser, syncUserMetrics, type SyncSummary } from "@/lib/facebook/sync";
import { prisma } from "@/lib/prisma";

/**
 * Sincronização automática do Facebook, disparada pelo próprio polling da UI.
 *
 * ## O problema que isto resolve
 *
 * O polling da tela (5s no Dashboard, 8s no Gerenciador) sempre existiu, mas ele
 * lê o NOSSO banco. Quem trazia dado novo do Facebook era o `syncUser`, e ele só
 * rodava no botão "Sincronizar métricas" e no cron do GitHub Actions a cada 15
 * min — best-effort, atrasa 5–20 min em pico e **é desativado sozinho após 60
 * dias sem commits**. Na prática o gasto só aparecia depois do clique manual.
 *
 * ## Dois ritmos, porque as chamadas não custam a mesma coisa
 *
 * O ciclo COMPLETO lê campanhas + conjuntos + anúncios + insights: **4 chamadas
 * por conta**. As métricas sozinhas são **1**. Estrutura muda raramente (criar
 * campanha é ato humano); o gasto muda o tempo todo. Repetir as 4 chamadas a
 * cada poucos segundos só para ver o gasto subir estouraria o rate limit da Meta
 * sem entregar nada a mais — então são dois relógios:
 *
 * | Ciclo | Intervalo | Custo (5 contas) | O que traz |
 * |---|---|---|---|
 * | Métricas | 20s | 5 chamadas | gasto, impressões, cliques, CTR/CPC/CPM |
 * | Completo | 3 min | ~20 chamadas + 1 por perfil | campanhas/conjuntos/anúncios novos, contas novas da BM |
 *
 * A carga média fica em ~15 chamadas/min — parecida com o que era com o ciclo
 * único de 90s, mas com o gasto 4,5× mais fresco.
 *
 * ## Por que NÃO dá para ser instantâneo
 *
 * A Meta **não empurra** gasto para nós: não existe webhook de insights na
 * Marketing API, então o dado só chega se formos buscar. E os próprios números
 * da Meta têm atraso de consolidação de alguns minutos. Reduzir o intervalo
 * abaixo disto gasta rate limit sem trazer número mais novo.
 *
 * ## A trava é do BANCO, não do processo
 *
 * Em serverless não há estado compartilhado entre instâncias, e o polling bate a
 * cada poucos segundos — de várias abas, às vezes de vários dispositivos. Uma
 * trava em memória deixaria N sincronizações concorrentes disparando contra a
 * Graph API.
 *
 * A reserva é um `updateMany` condicional: o `WHERE` só deixa passar quando o
 * lock está livre. Quem consegue atualizar a linha ganhou a vez; quem recebe
 * `count: 0` desiste em silêncio. Mesmo padrão do upsert monotônico de vendas —
 * quem decide o vencedor é o banco.
 */

/** Intervalo do ciclo barato (só métricas). */
const METRICAS_MS = 20_000;

/** Intervalo do ciclo completo (estrutura + contas novas da BM). */
const COMPLETO_MS = 180_000;

/** Reserva órfã (instância morta no meio) é liberada depois disto. */
const LOCK_EXPIRA_MS = 10 * 60_000;

/**
 * Janela de dias nas sincronizações automáticas: só o dia corrente e o anterior
 * (a Meta ainda consolida ontem). Os 30 dias completos seguem no cron e no botão
 * manual — puxar 30 dias a cada 20s multiplicaria as chamadas sem ganho.
 */
const DIAS_AUTO = 2;

export interface EstadoSync {
  lastSyncedAt: Date | null;
  sincronizando: boolean;
}

/**
 * O que a chamada REALMENTE fez.
 *
 * Existe porque a função era `void` e quem a chamava não tinha como reportar
 * nada — a rota de cron respondia `accounts: 0` fixo, o que fazia uma
 * sincronização bem-sucedida parecer que não achou conta nenhuma. Um cron que
 * mente sobre o próprio resultado é pior do que um cron que falha: o erro fica
 * invisível justamente onde se vai olhar para diagnosticar.
 */
export type ResultadoAutoSync =
  /** Ainda não venceu o intervalo, ou outra instância pegou a vez. */
  | { modo: "pulado"; motivo: "intervalo" | "reservado-por-outro" }
  | { modo: "metricas" | "completo"; summary: SyncSummary }
  | { modo: "erro"; erro: string };

type Modo = "metricas" | "completo";

/**
 * Tenta reservar a vez e diz QUAL ciclo rodar. `null` = ainda não é hora, ou
 * outra requisição já pegou.
 */
async function reservar(userId: string): Promise<{ perfis: string[]; modo: Modo } | null> {
  const agora = new Date();
  const abandonado = new Date(agora.getTime() - LOCK_EXPIRA_MS);
  const devidoCompleto = new Date(agora.getTime() - COMPLETO_MS);
  const devidoMetricas = new Date(agora.getTime() - METRICAS_MS);

  const candidatos = await prisma.adProfile.findMany({
    where: {
      userId,
      OR: [{ syncLockedAt: null }, { syncLockedAt: { lt: abandonado } }],
    },
    select: { id: true, syncLockedAt: true, lastSyncedAt: true, lastMetricsAt: true },
  });
  if (candidatos.length === 0) return null;

  // Estrutura vencida em QUALQUER perfil promove o ciclo inteiro a completo:
  // rodar meio completo e meio métricas deixaria a vitrine de contas
  // desatualizada em um dos perfis sem motivo.
  const precisaCompleto = candidatos.some(
    (c) => c.lastSyncedAt === null || c.lastSyncedAt < devidoCompleto,
  );
  const precisaMetricas = candidatos.some(
    (c) => c.lastMetricsAt === null || c.lastMetricsAt < devidoMetricas,
  );
  if (!precisaCompleto && !precisaMetricas) return null;

  const reservados: string[] = [];
  for (const c of candidatos) {
    // Repete a condição do lock: entre o `findMany` e este update outra
    // instância pode ter reservado. `count: 0` = perdemos a corrida, e perder é
    // o resultado correto, não um erro.
    const r = await prisma.adProfile.updateMany({
      where: { id: c.id, OR: [{ syncLockedAt: null }, { syncLockedAt: c.syncLockedAt }] },
      data: { syncLockedAt: agora },
    });
    if (r.count > 0) reservados.push(c.id);
  }
  if (reservados.length === 0) return null;
  return { perfis: reservados, modo: precisaCompleto ? "completo" : "metricas" };
}

/**
 * Sincroniza se estiver na hora. Seguro para chamar em toda requisição do
 * painel: quase todas saem sem tocar na Graph API.
 *
 * **Nunca lança** — é chamada de dentro do `after()` das rotas, onde uma exceção
 * não teria quem a tratasse e viraria ruído de log a cada poucos segundos.
 */
export async function autoSyncSeNecessario(userId: string): Promise<ResultadoAutoSync> {
  try {
    const reserva = await reservar(userId);
    if (!reserva) return { modo: "pulado", motivo: "intervalo" };

    try {
      if (reserva.modo === "completo") {
        const summary = await syncUser(userId, DIAS_AUTO);
        // O completo também traz métricas, então zera os dois relógios.
        await prisma.adProfile.updateMany({
          where: { id: { in: reserva.perfis } },
          data: { lastSyncedAt: new Date(), lastMetricsAt: new Date(), syncLockedAt: null },
        });
        return { modo: "completo", summary };
      }

      const summary = await syncUserMetrics(userId, DIAS_AUTO);
      // `lastSyncedAt` NÃO avança aqui: a estrutura não foi revisada, e marcar
      // como completa adiaria a descoberta de contas novas.
      await prisma.adProfile.updateMany({
        where: { id: { in: reserva.perfis } },
        data: { lastMetricsAt: new Date(), syncLockedAt: null },
      });
      return { modo: "metricas", summary };
    } catch (e) {
      // Libera a reserva para a próxima tentativa não esperar o lock expirar.
      await prisma.adProfile.updateMany({
        where: { id: { in: reserva.perfis } },
        data: { syncLockedAt: null },
      });
      return { modo: "erro", erro: e instanceof Error ? e.message : String(e) };
    }
  } catch (e) {
    // Sincronizar é oportunista: nunca pode derrubar a requisição do painel.
    return { modo: "erro", erro: e instanceof Error ? e.message : String(e) };
  }
}

/** Estado para a UI mostrar a idade do dado. */
export async function estadoSync(userId: string): Promise<EstadoSync> {
  const perfis = await prisma.adProfile.findMany({
    where: { userId },
    select: { lastSyncedAt: true, lastMetricsAt: true, syncLockedAt: true },
  });
  if (perfis.length === 0) return { lastSyncedAt: null, sincronizando: false };

  // A idade que interessa ao usuário é a das MÉTRICAS — é o número que ele fica
  // olhando subir. E o mais ANTIGO manda: com dois perfis, o dado só está
  // fresco de verdade quando os dois estão.
  const datas = perfis.map((p) => p.lastMetricsAt ?? p.lastSyncedAt);
  const lastSyncedAt = datas.includes(null)
    ? null
    : new Date(Math.min(...datas.map((d) => d!.getTime())));

  const limite = Date.now() - LOCK_EXPIRA_MS;
  const sincronizando = perfis.some((p) => p.syncLockedAt != null && p.syncLockedAt.getTime() > limite);

  return { lastSyncedAt, sincronizando };
}
