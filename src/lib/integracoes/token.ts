/**
 * Estado do token da Marketing API — a falha mais cara que esta ferramenta tem.
 *
 * 🔴 POR QUE ISTO É UM ARQUIVO PRÓPRIO, E PURO
 *
 * Um token de Marketing API vencendo em silêncio para a sincronização inteira:
 * o gasto congela, o ROAS passa a mentir por omissão, e as regras de automação
 * decidem com dado velho. Nada na TELA avisava — só uma notificação criada pelo
 * `/api/cron/manutencao`, que o usuário pode nunca abrir.
 *
 * A derivação vive aqui, sozinha e sem dependência de React ou de Prisma, por
 * dois motivos:
 *
 *  1. **O Dashboard vai precisar da mesma resposta.** O item "token expirando"
 *     está na fila do `metrics.ts`. Duas implementações da mesma conta divergem
 *     sempre — é a regra que este projeto já pagou várias vezes, mais
 *     recentemente com os dois `div` de contratos opostos.
 *  2. É testável sem banco e sem navegador.
 *
 * ⛔ NÃO reimplemente "faltam N dias" numa tela. Importe `estadoDoToken`.
 */

/** Os três estados possíveis. `null` é um deles, e é o mais perigoso. */
export type EstadoToken =
  | { tipo: "vencido"; diasDesde: number }
  | { tipo: "expira"; dias: number }
  | { tipo: "desconhecido" };

/**
 * A partir de quantos dias restantes a tela deve tratar como ATENÇÃO.
 *
 * 30 é o mesmo limiar do `/api/cron/manutencao`, de propósito: a tela e a
 * notificação têm de concordar sobre o que é urgente. Se divergirem, o usuário
 * recebe um e-mail dizendo "expira em breve" e abre uma tela que diz que está
 * tudo bem — e passa a não confiar em nenhum dos dois.
 */
export const DIAS_ATENCAO = 30;

const DIA_MS = 86_400_000;

/**
 * ⚠️ `expiraEm` NULO NÃO É "NÃO EXPIRA".
 *
 * É "não sabemos quando expira", e são dois grupos: perfis conectados antes de
 * a coluna `tokenExpiresAt` existir, e tokens que a Meta devolveu sem `expires_in`.
 * **O primeiro grupo é o mais perigoso da base** — é o mais antigo, logo o mais
 * provável de já estar vencido, e é exatamente o que um "—" discreto na tela
 * faria parecer inofensivo.
 *
 * Por isso `desconhecido` é um estado próprio, com texto próprio, e não um caso
 * do `expira`. Colapsar os dois é a mesma doença de tratar denominador zero
 * como zero: uma ausência de dado virando uma afirmação sobre o dado.
 */
export function estadoDoToken(expiraEm: Date | string | null | undefined, agora = new Date()): EstadoToken {
  if (expiraEm == null) return { tipo: "desconhecido" };
  const alvo = expiraEm instanceof Date ? expiraEm : new Date(expiraEm);
  if (Number.isNaN(alvo.getTime())) return { tipo: "desconhecido" };

  const delta = alvo.getTime() - agora.getTime();
  if (delta <= 0) return { tipo: "vencido", diasDesde: Math.floor(-delta / DIA_MS) };
  /* `ceil`: faltando 0,3 dia ainda é "1 dia", não "0 dias". Um contador que
     chega a zero antes de vencer diz que já venceu, e manda reconectar um
     token que ainda funciona. */
  return { tipo: "expira", dias: Math.ceil(delta / DIA_MS) };
}

/** `true` quando a tela deve pintar em cor de atenção. Desconhecido CONTA. */
export function tokenPedeAtencao(e: EstadoToken): boolean {
  return e.tipo !== "expira" || e.dias <= DIAS_ATENCAO;
}

/**
 * O texto, em uma linha, na voz do usuário.
 *
 * ⚠️ "Data desconhecida" e não "—": o traço diz "não se aplica", e aqui se
 * aplica muito. O texto tem de fazer a pessoa reconectar.
 */
export function rotuloDoToken(e: EstadoToken): string {
  if (e.tipo === "desconhecido") return "Data de expiração desconhecida";
  if (e.tipo === "vencido") {
    if (e.diasDesde === 0) return "Token expirado hoje";
    return e.diasDesde === 1 ? "Token expirado ontem" : `Token expirado há ${e.diasDesde} dias`;
  }
  return e.dias === 1 ? "Expira amanhã" : `Expira em ${e.dias} dias`;
}

/** A explicação — só aparece quando pede atenção, senão é ruído. */
export function detalheDoToken(e: EstadoToken): string | null {
  if (e.tipo === "desconhecido") {
    return "Este perfil foi conectado antes de guardarmos a data. Pode já estar vencido — reconecte para ter certeza.";
  }
  if (e.tipo === "vencido") return "A sincronização com a Meta está parada. Reconecte o perfil.";
  if (e.dias <= DIAS_ATENCAO) return "Reconecte antes de vencer para a sincronização não parar.";
  return null;
}
