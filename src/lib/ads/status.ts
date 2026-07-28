/**
 * Filtro de status do Gerenciador — **função pura, uma só fonte**.
 *
 * Existia duplicada: uma cópia no servidor (`overview.ts`) e outra no cliente
 * (`AdsManagerView.tsx`). As duas tinham o mesmo defeito e, pior, a do cliente
 * refiltrava o que o servidor já tinha filtrado — corrigir só um lado não
 * mudava nada na tela. Por isso mora aqui, sem dependência de banco, para os
 * dois importarem o MESMO comportamento.
 *
 * ⚠️ **"Todos os status" NÃO inclui arquivados, de propósito.**
 *
 * No Gerenciador do Facebook, "excluir" uma campanha na prática a **arquiva**:
 * some da tela de lá, mas continua na API. A sincronização passou a trazer
 * arquivadas porque sem elas o gasto histórico se perdia (as arestas
 * `/campaigns` e `/ads` escondem arquivados por padrão, e sem o `Ad` local
 * nenhuma linha de insight tinha onde encostar). O efeito colateral foi a
 * listagem encher de campanha que o usuário já tinha apagado.
 *
 * A separação: o **dado** fica no banco (o gasto do Dashboard segue completo,
 * porque ele soma `DailyAdMetric` direto, sem passar por este filtro) e a
 * **listagem** esconde arquivados salvo quando pedidos explicitamente.
 */
export type FiltroStatus = "todos" | "ativo" | "pausado" | "arquivado";

/** Arquivado ou excluído — o que o usuário considera "apagado". */
export function estaArquivado(status: string): boolean {
  return status === "ARCHIVED" || status === "DELETED";
}

export function combinaStatus(status: string, filtro: string): boolean {
  if (filtro === "arquivado") return estaArquivado(status);
  if (filtro === "ativo") return status === "ACTIVE";
  // Antes era `status !== "ACTIVE"`, que varria arquivados junto com pausados.
  if (filtro === "pausado") return status === "PAUSED";
  return !estaArquivado(status);
}
