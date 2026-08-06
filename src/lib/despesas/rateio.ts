/**
 * RATEIO DE DESPESA RECORRENTE — a fonte ÚNICA.
 *
 * 🔴 O QUE ESTAVA ERRADO, E POR QUANTO TEMPO
 *
 * `financeiro.ts` fazia `recorrentes += e.amount` — o valor **cheio**, em
 * qualquer janela. E o tipo, 219 linhas acima, dizia *"Despesas recorrentes
 * rateadas no período"*. O comentário mentia e ninguém viu.
 *
 * Pior: **o campo `recurrence` não era lido por cálculo nenhum.** Ele tem cinco
 * valores no schema e os cinco eram tratados igual:
 *
 * | Cadastro | O que o usuário espera | O que o Lucro fazia |
 * |---|---|---|
 * | R$ 500 MENSAL | R$ 500 por mês | R$ 500 em toda janela |
 * | R$ 6.000 ANUAL | ~R$ 500/mês | 🔴 **R$ 6.000 em toda janela** |
 * | R$ 50 DIARIA | R$ 50 × dias | 🔴 R$ 50, uma vez só |
 *
 * Com o Dashboard filtrado em "Hoje", uma despesa anual derrubava o Lucro em
 * seis mil reais. Testadores estavam lendo prejuízo que não existia.
 *
 * ⛔ ESTA FUNÇÃO É A ÚNICA QUE RATEIA. Havia TRÊS tratamentos da mesma despesa
 * — inteira no Lucro, proporcional à receita no lucro por horário, e o
 * break-even ia virar o quarto. Os três agora chamam daqui.
 */

import { dayKeyRange } from "@/lib/timezone";
import type { ExpenseRecurrence } from "@/generated/prisma/enums";

/** Dias do mês de uma chave `YYYY-MM-DD`. */
function diasDoMes(key: string): number {
  const [a, m] = key.split("-").map(Number);
  return new Date(Date.UTC(a!, m!, 0)).getUTCDate();
}

/** Dias do ano de uma chave `YYYY-MM-DD` — 366 em bissexto. */
function diasDoAno(key: string): number {
  const a = Number(key.slice(0, 4));
  return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0 ? 366 : 365;
}

/**
 * Quantas "ocorrências" da despesa cabem na janela.
 *
 * ⛔ **`MENSAL` e `ANUAL` somam DIA A DIA, com o divisor do mês (ou ano) DAQUELE
 * dia** — nada de 30 fixo, nada de média. Uma janela 30/07–01/08 tem dois dias
 * de julho (÷31) e um de agosto (÷31); em fevereiro os dias valem ÷28 ou ÷29.
 * Um divisor médio erraria nos dois meses ao mesmo tempo, e erraria mais quanto
 * mais curta a janela — que é justamente onde o defeito dói.
 *
 * ⚠️ **`UNICA` devolve 0: ela fica FORA do cálculo.** Não é esquecimento — o
 * schema **não guarda data de ocorrência**. `Expense` tem `createdAt`, que é
 * quando a linha foi criada, não quando a despesa aconteceu; usá-lo inventaria
 * semântica e quebraria o caso comum de cadastrar hoje algo que ocorreu antes.
 * Sem data, "única" não tem *quando*, e contá-la em toda janela (o que se fazia)
 * é pior que omiti-la.
 *
 * ⛔ Mas ela não pode sumir em silêncio: quem chama tem de contar quantas ficaram
 * de fora e dizer isso na tela onde o número seria diferente por causa delas.
 * Ver `contarUnicasAtivas`.
 */
export function fatorDeRateio(recorrencia: ExpenseRecurrence, startKey: string, endKey: string): number {
  const dias = dayKeyRange(startKey, endKey);
  if (dias.length === 0) return 0;

  switch (recorrencia) {
    case "DIARIA":
      return dias.length;
    case "SEMANAL":
      return dias.length / 7;
    case "MENSAL":
      return dias.reduce((s, k) => s + 1 / diasDoMes(k), 0);
    case "ANUAL":
      return dias.reduce((s, k) => s + 1 / diasDoAno(k), 0);
    case "UNICA":
    default:
      return 0;
  }
}

/** O valor da despesa já rateado para a janela. */
export function ratearDespesa(
  amount: number,
  recorrencia: ExpenseRecurrence,
  janela: { startKey: string; endKey: string },
): number {
  return amount * fatorDeRateio(recorrencia, janela.startKey, janela.endKey);
}

/**
 * Quantas despesas ÚNICAS ativas existem — o número que a tela precisa dizer.
 *
 * 🔴 Custo que sumiu do cálculo sem avisar na tela onde o lucro aparece é o
 * mesmo erro que este arquivo existe para consertar, só que na direção oposta.
 */
export function contarUnicasAtivas(
  despesas: { type: string; recurrence: ExpenseRecurrence; active?: boolean }[],
): number {
  return despesas.filter((d) => d.type === "DESPESA_RECORRENTE" && d.recurrence === "UNICA" && d.active !== false).length;
}
