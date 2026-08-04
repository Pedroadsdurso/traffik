/**
 * # Espaçamento das tentativas depois de falhas seguidas
 *
 * ## Por que existe
 *
 * Uma conta cujo token perdeu permissão acumulou **50 tentativas** em poucas
 * horas (04/08/2026) — uma a cada 20 s, contra um erro que não passa sozinho.
 * Erro de permissão não se resolve tentando de novo; ele se resolve quando um
 * humano mexe em alguma coisa.
 *
 * ## ⚠️ O motivo mais forte NÃO é economizar chamada
 *
 * O rate limit da Graph API é **por APP, não por usuário**. Uma conta em
 * repetição queima cota que é de todo mundo — com N clientes, um único token
 * quebrado degrada a sincronização dos outros. É o mesmo raciocínio que já está
 * na fila de riscos do CLAUDE.md.
 *
 * ## A escala
 *
 * | Falhas seguidas | Espera | Por quê |
 * |---|---|---|
 * | 0–2 | nenhuma | pode ser rede, timeout, blip da Meta — insistir é certo |
 * | 3–9 | 5 min | já não parece transitório |
 * | 10–29 | 30 min | é problema de configuração ou permissão |
 * | 30+ | 2 h | alguém precisa agir; tentar mais rápido não muda nada |
 *
 * O teto de 2 h é deliberado: quando a causa for resolvida (token reconectado,
 * restrição da Meta liberada), a volta é detectada **sozinha** dentro de duas
 * horas, sem ninguém clicar em nada.
 *
 * > ### ⛔ O botão "Sincronizar" IGNORA o backoff — e isso é essencial
 * > Quem acabou de arrumar a permissão precisa poder conferir na hora. Uma
 * > espera de 2 h aplicada ao clique manual transformaria a correção em "não
 * > funcionou", e a pessoa mexeria de novo no que já estava certo.
 * >
 * > Ver `deveTentar` × o caminho manual em `/api/sync/facebook`.
 *
 * > ### ⚠️ Estar em espera NÃO esconde a conta nem o erro
 * > A linha continua na tela com a explicação e o contador. O que muda é só a
 * > frequência das tentativas. Uma conta que some da tela por estar em backoff
 * > seria a falha silenciosa que este arquivo inteiro existe para evitar.
 */

/** Degraus da escala. O primeiro que couber manda. */
const DEGRAUS: { aPartirDe: number; esperaMs: number }[] = [
  { aPartirDe: 30, esperaMs: 2 * 60 * 60_000 },
  { aPartirDe: 10, esperaMs: 30 * 60_000 },
  { aPartirDe: 3, esperaMs: 5 * 60_000 },
];

/** Quanto esperar depois de `falhas` seguidas. `0` = tentar sempre. */
export function esperaDeBackoff(falhas: number): number {
  for (const d of DEGRAUS) if (falhas >= d.aPartirDe) return d.esperaMs;
  return 0;
}

/**
 * Já pode tentar de novo?
 *
 * ⚠️ `lastSyncErrorAt` nulo com `falhas > 0` devolve `true`. Contador sem data
 * é estado inconsistente (linha antiga, migração), e na dúvida **tentar** é o
 * lado seguro: o outro lado seria uma conta que nunca mais sincroniza por causa
 * de um dado incompleto.
 */
export function deveTentar(
  falhas: number,
  ultimaFalhaEm: Date | null | undefined,
  agora: Date = new Date(),
): boolean {
  const espera = esperaDeBackoff(falhas);
  if (espera === 0) return true;
  if (!ultimaFalhaEm) return true;
  return agora.getTime() - ultimaFalhaEm.getTime() >= espera;
}

/** Quando será a próxima tentativa. `null` = já pode agora. */
export function proximaTentativa(
  falhas: number,
  ultimaFalhaEm: Date | null | undefined,
  agora: Date = new Date(),
): Date | null {
  if (deveTentar(falhas, ultimaFalhaEm, agora)) return null;
  return new Date(ultimaFalhaEm!.getTime() + esperaDeBackoff(falhas));
}

/** Texto curto para a tela: "nova tentativa em ~28 min". */
export function rotuloDaEspera(
  falhas: number,
  ultimaFalhaEm: Date | null | undefined,
  agora: Date = new Date(),
): string | null {
  const quando = proximaTentativa(falhas, ultimaFalhaEm, agora);
  if (!quando) return null;
  const min = Math.max(1, Math.round((quando.getTime() - agora.getTime()) / 60_000));
  if (min < 60) return `nova tentativa em ~${min} min`;
  const h = Math.round(min / 60);
  return `nova tentativa em ~${h} h`;
}
