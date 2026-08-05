import { prisma } from "@/lib/prisma";
import { DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/timezone";

/**
 * Fuso de referência de um usuário, a partir do id.
 *
 * Fica FORA de `actions/profile.ts` de propósito: aquele módulo é `"use server"`
 * e importa o `@/auth`, o que (a) transformaria este helper num endpoint de
 * server action exposto ao cliente e (b) arrastaria o NextAuth para dentro de
 * `metrics.ts`, `sync.ts` e do motor de regras — que rodam em cron, sem request
 * nenhum. Aqui é só uma leitura do banco.
 *
 * Nunca lança e nunca devolve vazio: um fuso ilegível não pode derrubar o
 * dashboard, só cair no padrão.
 *
 * ---
 *
 * ## 🔴 O FALLBACK SILENCIOSO É UMA BOMBA-RELÓGIO, e o gatilho é previsível
 *
 * `catch { return DEFAULT_TIMEZONE }` colapsava **três situações diferentes**
 * numa resposta só, e duas delas são defeito:
 *
 * | Situação | É esperado? | Antes |
 * |---|---|---|
 * | Coluna nula/vazia | ✅ sim — é o padrão | silêncio |
 * | String inválida gravada | 🔴 não — dado corrompido | silêncio |
 * | Leitura do banco falhou | 🔴 não — falha transitória | silêncio |
 *
 * Hoje o efeito é invisível porque todo mundo está no Brasil e o padrão
 * coincide com a resposta certa. **Com o primeiro usuário fora do fuso do
 * Brasil isso deixa de ser fallback e vira erro em TUDO**, de uma vez: o fuso
 * decide onde o dia começa, então ele não afeta um número — afeta a janela do
 * período, `byHour`, `byDay`, os buckets do gráfico, a janela de comparação dos
 * deltas, o `time_range` mandado à Meta, o limite diário do motor de regras e a
 * hora do relatório. É a seção "Fuso horário — causa raiz" inteira,
 * reintroduzida por um `catch`.
 *
 * E é **sistemático, não intermitente**: quem está em Lisboa vê todo dia
 * começando 4h cedo, sempre, sem nada na tela denunciando.
 *
 * ⚠️ O conserto **não é lançar** — derrubar o dashboard por causa do fuso seria
 * pior. É o mesmo padrão do `lastSyncError`: **registrar que o fallback foi
 * usado**, distinguindo o caso normal dos dois defeituosos. O contrato de
 * "nunca lança, nunca devolve vazio" não mudou.
 */
export async function getUserTimezone(userId: string): Promise<string> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const tz = u?.timezone?.trim();
    // Coluna nula/vazia é o caso NORMAL — o padrão é a resposta certa, e um
    // aviso aqui apareceria para todo usuário que nunca abriu a tela de Taxas.
    // Aviso que aparece sempre vira ruído que se aprende a ignorar.
    if (!tz) return DEFAULT_TIMEZONE;

    if (!isValidTimezone(tz)) {
      // 🔴 Dado corrompido: alguém gravou uma string que o Intl não reconhece.
      // O usuário vê os dias começando no fuso errado e a tela diz que o fuso
      // dele é o que está gravado.
      console.error(
        `[userTimezone] fuso invalido gravado para o usuario ${userId}: ${JSON.stringify(tz)} — ` +
          `usando ${DEFAULT_TIMEZONE}. Todo agrupamento por dia/hora deste usuario esta no fuso errado.`,
      );
      return DEFAULT_TIMEZONE;
    }
    return tz;
  } catch (e) {
    // 🔴 Falha de leitura. Transitória ou não, o período inteiro deste
    // carregamento foi agrupado num fuso que pode não ser o do usuário.
    console.error(
      `[userTimezone] falha ao ler o fuso do usuario ${userId} — usando ${DEFAULT_TIMEZONE}. ` +
        `Se este usuario nao esta em ${DEFAULT_TIMEZONE}, os numeros deste carregamento estao ` +
        `agrupados no dia errado.`,
      e,
    );
    return DEFAULT_TIMEZONE;
  }
}
