import { addDaysToKey, dayKeyInTz, DEFAULT_TIMEZONE, partsInTz } from "./timezone";

/**
 * # Períodos: UMA definição, usada pelo cliente e pelo servidor
 *
 * ## Por que existe
 *
 * "Últimos 7 dias" estava escrito em **três** lugares com três implementações:
 * `resolveRange` em `dashboard/metrics.ts`, `rangeStart` em `ads/overview.ts` e
 * outro `rangeStart` em `ads/creatives.ts` — este último com o comentário "mesma
 * janela do gerenciador", que é a confissão de que eram cópias. Três cópias de
 * uma regra de data divergem: basta alguém corrigir uma borda num arquivo.
 *
 * Pior: os dois `rangeStart` devolviam **só o início** e filtravam "do início até
 * agora". Isso funciona para "últimos N dias", mas está **errado para qualquer
 * janela que termina no passado** — escolher "Mês passado" no Gerenciador traria
 * o mês passado *mais o mês atual*. Aqui a janela sempre tem as duas pontas.
 *
 * ## ⚠️ Chave de dia é STRING, de propósito
 *
 * A janela é devolvida como `"2026-07-25"`, não como `Date`. Comparar strings
 * elimina a classe inteira de bugs de "instante que representa um dia" — é a
 * mesma decisão de `lib/timezone.ts`. Quem precisa de instante converte com
 * `dayStart()` / `dayEnd()`, que aplicam o fuso do usuário.
 *
 * ## ⚠️ Aritmética de mês também é por STRING
 *
 * Nada de `new Date(ano, mes - 1, 1)`: o construtor de `Date` trabalha no fuso do
 * **processo**, que na Vercel é UTC — a origem do bug de dia/hora documentado no
 * CLAUDE.md. O primeiro dia do mês sai de `partsInTz`, e o último dia do mês
 * anterior é `primeiroDoMes - 1 dia` em chave.
 */

/** Períodos oferecidos na interface. `custom` usa `from`/`to`. */
export type PeriodoNome =
  | "hoje"
  | "ontem"
  | "7d"
  | "30d"
  | "mesAtual"
  | "mesPassado"
  | "custom";

export interface JanelaChaves {
  /** Primeiro dia da janela, inclusive. */
  startKey: string;
  /** Último dia da janela, inclusive. */
  endKey: string;
}

/** Rótulos, na ordem em que aparecem no seletor. */
export const PERIODOS: { value: PeriodoNome; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "mesAtual", label: "Este mês" },
  { value: "mesPassado", label: "Mês passado" },
  { value: "custom", label: "Personalizado" },
];

const ROTULOS = new Map(PERIODOS.map((p) => [p.value, p.label]));

export function rotuloDoPeriodo(p: PeriodoNome): string {
  return ROTULOS.get(p) ?? "Período";
}

/** `true` quando o período é um nome conhecido (não um valor forjado). */
export function ehPeriodoValido(v: unknown): v is PeriodoNome {
  return typeof v === "string" && ROTULOS.has(v as PeriodoNome);
}

/** Primeiro dia do mês corrente NO FUSO DO USUÁRIO, em chave. */
function primeiroDoMes(tz: string, agora: Date): string {
  const p = partsInTz(agora, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-01`;
}

/**
 * Janela de dias de um período, nas duas pontas, no fuso do usuário.
 *
 * ⚠️ Um `custom` sem `from` cai em "últimos 7 dias" em vez de estourar: o
 * `period` chega pela querystring e pode vir adulterado ou incompleto, e um
 * painel de métricas não deve quebrar por causa disso.
 *
 * ⚠️ **O relógio é injetável (`agora`)**, e não é luxo de teste: sem isso a única
 * forma de exercitar a virada de ano, o mês bissexto e a diferença entre o fuso
 * do processo e o do usuário seria esperar a data chegar. Trocar `Date.now` de
 * fora não funciona — `new Date()` lê o relógio interno direto.
 */
export function janelaDoPeriodo(
  periodo: PeriodoNome,
  tz: string = DEFAULT_TIMEZONE,
  custom?: { from?: string | null; to?: string | null },
  agora: Date = new Date(),
): JanelaChaves {
  const hoje = dayKeyInTz(agora, tz);

  switch (periodo) {
    case "hoje":
      return { startKey: hoje, endKey: hoje };

    case "ontem": {
      const ontem = addDaysToKey(hoje, -1);
      return { startKey: ontem, endKey: ontem };
    }

    case "30d":
      // N dias de CALENDÁRIO terminando hoje — hoje INCLUSO, por isso `-(N-1)`.
      return { startKey: addDaysToKey(hoje, -29), endKey: hoje };

    case "mesAtual":
      return { startKey: primeiroDoMes(tz, agora), endKey: hoje };

    case "mesPassado": {
      // Dia anterior ao dia 1 deste mês = último dia do mês passado. Daí o
      // primeiro dia do mês passado é a mesma chave com o dia trocado por 01.
      const fim = addDaysToKey(primeiroDoMes(tz, agora), -1);
      return { startKey: `${fim.slice(0, 7)}-01`, endKey: fim };
    }

    case "custom":
      if (custom?.from) {
        const startKey = custom.from;
        // `to` ausente = janela de um dia só. Antes isto virava duração ZERO e o
        // painel vinha vazio.
        const endKey = custom.to ?? custom.from;
        // Invertido pelo usuário (clicou o fim antes do início): ordena em vez
        // de devolver uma janela negativa, que não traria linha nenhuma.
        return startKey <= endKey ? { startKey, endKey } : { startKey: endKey, endKey: startKey };
      }
      return { startKey: addDaysToKey(hoje, -6), endKey: hoje };

    case "7d":
    default:
      return { startKey: addDaysToKey(hoje, -6), endKey: hoje };
  }
}

/**
 * A janela IMEDIATAMENTE ANTERIOR, do mesmo tamanho — base dos deltas
 * ("vs. período anterior").
 *
 * ⚠️ Não é `start - (end - start)`. Aquela conta caía no meio de um dia e fazia
 * "Hoje" comparar contra um pedaço de ontem **mais** um pedaço de anteontem.
 * Aqui são N dias de calendário imediatamente antes do primeiro dia da janela.
 */
export function janelaAnterior(j: JanelaChaves): JanelaChaves {
  const dias = diasDaJanela(j);
  return {
    startKey: addDaysToKey(j.startKey, -dias),
    endKey: addDaysToKey(j.startKey, -1),
  };
}

/** Quantidade de dias de calendário da janela, contando as duas pontas. */
export function diasDaJanela(j: JanelaChaves): number {
  const ms = Date.parse(`${j.endKey}T00:00:00Z`) - Date.parse(`${j.startKey}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}
