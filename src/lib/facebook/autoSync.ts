import { syncUser } from "@/lib/facebook/sync";
import { prisma } from "@/lib/prisma";

/**
 * Sincronização automática do Facebook, disparada pelo próprio polling da UI.
 *
 * ## O problema que isto resolve
 *
 * O polling da tela (5s no Dashboard, 8s no Gerenciador) sempre existiu, mas ele
 * lê o NOSSO banco. Quem traz dado novo do Facebook para o banco é o `syncUser`,
 * e ele só rodava em duas situações: no botão "Sincronizar métricas" e no cron
 * do GitHub Actions a cada 15 min — que é *best-effort*, costuma atrasar 5–20
 * min em horário de pico e **é desativado sozinho após 60 dias sem commits**.
 * Na prática o gasto só aparecia depois do clique manual.
 *
 * Agora qualquer requisição do painel reserva uma sincronização quando o dado
 * está velho, e ela roda em segundo plano (`after()` na rota) sem segurar a
 * resposta. O ciclo fica: polling → dado velho → sincroniza → próximo polling
 * já mostra o número novo. O botão continua existindo para forçar.
 *
 * ## A trava é do BANCO, não do processo
 *
 * Em serverless não há estado compartilhado entre instâncias, e o polling bate
 * a cada poucos segundos — de várias abas, às vezes de vários dispositivos. Uma
 * trava em memória deixaria N sincronizações concorrentes disparando contra a
 * Graph API e batendo em rate limit.
 *
 * A reserva é um `updateMany` condicional: o `WHERE` só deixa passar quando o
 * lock está velho o bastante. Quem consegue atualizar a linha ganhou a vez;
 * quem recebe `count: 0` desiste em silêncio. É o mesmo padrão do upsert
 * monotônico de vendas — quem decide o vencedor é o banco.
 */

/** Intervalo mínimo entre sincronizações automáticas. */
const INTERVALO_MS = 90_000;

/**
 * Se uma sincronização travar (instância morta no meio), o lock ficaria preso
 * para sempre. Depois disto a reserva é considerada abandonada e liberada.
 */
const LOCK_EXPIRA_MS = 10 * 60_000;

/**
 * Janela curta nas sincronizações automáticas: elas rodam a cada 90s e só
 * precisam do dia corrente e do anterior (a Meta ainda consolida o dia de
 * ontem). Os 30 dias completos continuam vindo do cron e do botão manual —
 * puxar 30 dias a cada 90s multiplicaria as chamadas à Graph sem ganho.
 */
const DIAS_AUTO = 2;

export interface EstadoSync {
  /** Última sincronização concluída com sucesso. */
  lastSyncedAt: Date | null;
  /** `true` quando há uma sincronização reservada e ainda em andamento. */
  sincronizando: boolean;
}

/**
 * Tenta reservar a vez. Devolve os perfis reservados (vazio = não é hora, ou
 * outra requisição já pegou).
 */
async function reservar(userId: string): Promise<string[]> {
  const agora = new Date();
  const devido = new Date(agora.getTime() - INTERVALO_MS);
  const abandonado = new Date(agora.getTime() - LOCK_EXPIRA_MS);

  const candidatos = await prisma.adProfile.findMany({
    where: {
      userId,
      // Já passou do intervalo desde a última sincronização bem-sucedida...
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: devido } }],
      // ...e ninguém está com a reserva (ou a reserva ficou órfã).
      AND: [{ OR: [{ syncLockedAt: null }, { syncLockedAt: { lt: abandonado } }] }],
    },
    select: { id: true, syncLockedAt: true },
  });

  const reservados: string[] = [];
  for (const c of candidatos) {
    // O `where` repete a condição do lock: entre o `findMany` e este update,
    // outra instância pode ter reservado. `count: 0` significa que perdemos a
    // corrida — e perder é o resultado correto, não um erro.
    const r = await prisma.adProfile.updateMany({
      where: {
        id: c.id,
        OR: [{ syncLockedAt: null }, { syncLockedAt: c.syncLockedAt }],
      },
      data: { syncLockedAt: agora },
    });
    if (r.count > 0) reservados.push(c.id);
  }
  return reservados;
}

/**
 * Sincroniza se estiver na hora. Seguro para chamar em toda requisição do
 * painel: quase todas saem no primeiro `if` sem tocar na Graph API.
 *
 * **Nunca lança.** É chamada de dentro do `after()` das rotas, onde uma exceção
 * não teria quem a tratasse e viraria ruído de log a cada 90s.
 */
export async function autoSyncSeNecessario(userId: string): Promise<void> {
  try {
    const reservados = await reservar(userId);
    if (reservados.length === 0) return;

    try {
      await syncUser(userId, DIAS_AUTO);
      // `lastSyncedAt` só avança quando deu certo — é o que a UI mostra como
      // "atualizado há X", e marcar uma tentativa falha como sucesso faria a
      // tela mentir sobre a idade do dado.
      await prisma.adProfile.updateMany({
        where: { id: { in: reservados } },
        data: { lastSyncedAt: new Date(), syncLockedAt: null },
      });
    } catch {
      // Libera a reserva para a próxima tentativa não esperar o lock expirar.
      await prisma.adProfile.updateMany({
        where: { id: { in: reservados } },
        data: { syncLockedAt: null },
      });
    }
  } catch {
    /* sincronizar é oportunista: nunca pode derrubar a requisição do painel */
  }
}

/** Estado para a UI mostrar a idade do dado. */
export async function estadoSync(userId: string): Promise<EstadoSync> {
  const perfis = await prisma.adProfile.findMany({
    where: { userId },
    select: { lastSyncedAt: true, syncLockedAt: true },
  });
  if (perfis.length === 0) return { lastSyncedAt: null, sincronizando: false };

  // O mais ANTIGO manda: com dois perfis, o dado só está fresco de verdade
  // quando os dois estão. Mostrar o mais recente esconderia um perfil parado.
  const datas = perfis.map((p) => p.lastSyncedAt);
  const lastSyncedAt = datas.includes(null)
    ? null
    : new Date(Math.min(...datas.map((d) => d!.getTime())));

  const limite = Date.now() - LOCK_EXPIRA_MS;
  const sincronizando = perfis.some((p) => p.syncLockedAt != null && p.syncLockedAt.getTime() > limite);

  return { lastSyncedAt, sincronizando };
}
