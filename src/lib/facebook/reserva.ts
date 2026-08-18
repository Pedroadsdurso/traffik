import { prisma } from "@/lib/prisma";

/**
 * A RESERVA DE SINCRONIZAÇÃO — o lock de `AdProfile.syncLockedAt`.
 *
 * ## 🔴 POR QUE ESTE MÓDULO EXISTE, e ele nasceu de uma medição
 *
 * O lock morava dentro do `autoSync.ts`, e por isso **só o `autoSync` o usava**.
 * Medido em 17/08/2026: `syncUser`/`syncUserMetrics`/`syncSingleAccount` têm
 * **6 chamadas, e apenas 2 reservavam** — as duas do próprio `autoSync`.
 *
 * | # | chamador | reservava? |
 * |---|---|---|
 * | 1–2 | `autoSync` | ✅ |
 * | 3 | `cron/sync-facebook?full=1` | 🔴 não |
 * | 4 | `api/sync/facebook` (botão do painel) | 🔴 não |
 * | 5 | `api/sync/facebook` (uma conta) | 🔴 não |
 * | 6 | `auth/facebook/callback` | 🔴 não |
 *
 * > ## O lock não protegia `syncUser`: protegia o `autoSync`. Quem chamasse a função direto passava por fora, e nada acusava.
 *
 * ⛔ Ele saiu do `autoSync` para cá **sem mudar de comportamento** — é MOVE, e o
 * `autoSync` continua o único que decide MODO (completo × métricas). O que veio
 * junto foi só o primitivo do lock, que `sync.ts` não podia importar de lá sem
 * ciclo (`autoSync` importa `sync`).
 *
 * ## ⛔ O QUE ESTA RESERVA **NÃO** RESOLVE — e os dois valem escrito
 *
 * | | |
 * |---|---|
 * | **rate limit** | ela serializa por **PERFIL**; o limite da Meta é por **TOKEN**. Duas contas do mesmo token, ou dois usuários, seguem concorrendo na Graph |
 * | **repetição** | reserva impede CONCORRÊNCIA; **debounce** impede a mesma pessoa disparar dez vezes. Cliques espaçados passam todos, e cada um é um sync de 30 dias |
 *
 * ⚠️ E ela nunca foi proteção contra corrida de ESCRITA: `npm run sonda:upsert`
 * mediu 2, 5 e 10 `upsert` simultâneos do mesmo `Ad` — **0 falhas, 1 linha**. O
 * que a reserva evita é **desperdício de quota da Graph**.
 */

/** ⚠️ 10 min é o limiar de ABANDONO, não a duração normal: a reserva é liberada no fim do ciclo e costuma durar segundos. */
export const LOCK_EXPIRA_MS = 10 * 60_000;

/**
 * Tenta tomar a reserva dos perfis do usuário. `null` = não conseguiu.
 *
 * ⛔ **Quem decide o vencedor é o BANCO.** O `updateMany` repete a condição do
 * lock no `where`, então entre o `findMany` e ele outra instância pode ter
 * reservado — e `count: 0` significa que perdemos a corrida. **Perder é o
 * resultado correto, não um erro.**
 *
 * ⚠️ Nunca `create` + `catch` para isto: a perdedora leria a linha da vencedora
 * antes do commit, e o erro real ficaria escondido no `catch`.
 */
export async function tentarReservar(userId: string, agora = new Date()): Promise<string[] | null> {
  const abandonado = new Date(agora.getTime() - LOCK_EXPIRA_MS);

  const candidatos = await prisma.adProfile.findMany({
    where: { userId, OR: [{ syncLockedAt: null }, { syncLockedAt: { lt: abandonado } }] },
    select: { id: true, syncLockedAt: true },
  });
  if (candidatos.length === 0) return null;

  const reservados: string[] = [];
  for (const c of candidatos) {
    const r = await prisma.adProfile.updateMany({
      where: { id: c.id, OR: [{ syncLockedAt: null }, { syncLockedAt: c.syncLockedAt }] },
      data: { syncLockedAt: agora },
    });
    if (r.count > 0) reservados.push(c.id);
  }
  return reservados.length > 0 ? reservados : null;
}

/**
 * Devolve a reserva.
 *
 * ⛔ **Chame no `finally`.** Sem isso, um erro no meio do ciclo deixa o perfil
 * travado até o limiar de abandono — e o usuário fica 10 minutos sem sincronizar
 * por causa de uma falha que durou um segundo.
 */
export async function liberarReserva(perfis: string[]): Promise<void> {
  if (perfis.length === 0) return;
  await prisma.adProfile.updateMany({ where: { id: { in: perfis } }, data: { syncLockedAt: null } });
}

/**
 * O que o chamador quer que a função de sync faça a respeito da reserva.
 *
 * ## ⛔ É OBRIGATÓRIO, SEM VALOR PADRÃO — e é essa a correção
 *
 * A regra "reserve antes de sincronizar" dependia de alguém lembrar, e **4 de 6
 * esqueceram**. Um parâmetro sem default faz o COMPILADOR cobrar: chamador novo
 * não passa no `tsc` sem decidir.
 *
 * ⚠️ As duas saídas óbvias foram recusadas, e o motivo fica escrito para não
 * serem retentadas:
 *
 * | saída | por que não |
 * |---|---|
 * | reservar SEMPRE, por dentro | o botão do painel passaria a não fazer nada às vezes, **em silêncio** — controle inerte com outro nome |
 * | cada chamador reservar antes | é o que existia, e produziu os 4 de 6 |
 */
export type Reserva =
  /**
   * Toma a reserva antes de rodar. Se não conseguir, **não roda** e devolve
   * `reservaNegada: true` — que é informação verdadeira ("já está
   * sincronizando"), não falha.
   */
  | "exigir"
  /**
   * Roda sem tentar reservar. ⛔ Só com motivo escrito na chamada: ou o
   * chamador **já reserva** (o `autoSync`), ou não há o que disputar (a
   * primeira conexão, em que o perfil acabou de nascer).
   */
  | "ignorar";
