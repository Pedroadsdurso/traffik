/**
 * Retenção do log de webhooks — DIFERENCIADA por status.
 *
 * ⚠️ Era 90 dias para tudo. O log de SUCESSO é redundante: o payload já está
 * duplicado em `Sale.rawPayload`, então apagá-lo não perde nada. O log de FALHA
 * é a **única cópia** — e é justamente o que se depura quando um gateway "manda
 * e não chega", conversa que com o suporte deles leva semanas.
 *
 * `RECEBIDO` que nunca fechou significa que o processamento estourou no meio:
 * tratado como falha, pelo mesmo motivo.
 *
 * > ### 🔴 POR QUE ISTO É UM ARQUIVO PRÓPRIO, E É UM **MOVE**
 * >
 * > Os dois números moravam dentro de `api/cron/manutencao/route.ts`, que
 * > importa o `prisma` e o `cronAuth`. A tela de Webhooks precisa do MESMO
 * > número — ela é quem explica ao usuário por que uma entrega antiga não
 * > aparece mais na lista — e uma cópia diverge no primeiro commit que mudar a
 * > retenção: a purga apagaria em 30 dias enquanto a tela seguiria prometendo
 * > 90, sem nada acusar.
 * >
 * > ⚠️ **Nem uma vírgula do que a purga faz mudou.** A rota passou a importar
 * > daqui os mesmos valores que declarava.
 */

/** Log de venda PROCESSADA: apagado depois disto. */
export const DIAS_LOG_SUCESSO = 30;

/** Log de falha (`REJEITADO`, `ERRO`, `RECEBIDO` que nunca fechou). */
export const DIAS_LOG_FALHA = 90;
