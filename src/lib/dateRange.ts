/**
 * Utilitários de data do seletor de período (Bloco 3).
 *
 * Ficam fora do componente porque são lógica pura — e porque `toISO` é o ponto
 * clássico de erro: `Date.toISOString()` converte para UTC e, no Brasil (UTC-3),
 * **a partir das 21h local já devolve o dia seguinte**. Quem usasse
 * `toISOString()` teria o filtro "Hoje" apontando para amanhã toda noite.
 * Verificado: 21:00 de 24/07 → `toISOString()` dá `2026-07-25`.
 */

import { DEFAULT_TIMEZONE, partsInTz } from "@/lib/timezone";

export interface DateRange {
  /** ISO `YYYY-MM-DD`. */
  from: string;
  to: string;
}

/**
 * "Hoje" **no fuso do usuário**, devolvido como `Date` local com os mesmos
 * ano/mês/dia.
 *
 * O calendário roda no navegador, então o "hoje" dele era o do FUSO DO
 * NAVEGADOR. Um usuário em Lisboa filtrando uma conta configurada em Brasília
 * pedia um dia que o servidor agregava como outro. Convertendo só a data (e
 * mantendo o `Date` local), toda a aritmética de calendário daqui — que é
 * puramente Y/M/D e nunca vira instante — continua valendo sem mudança.
 */
export function hojeNoFuso(tz: string = DEFAULT_TIMEZONE): Date {
  const p = partsInTz(new Date(), tz);
  return new Date(p.year, p.month - 1, p.day);
}

/** Data **local** em ISO `YYYY-MM-DD` — nunca use `toISOString()` para isto. */
export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function somaDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** `01/07 – 24/07`, ou só `24/07` quando é um dia só. */
export function formatarIntervalo(r: DateRange): string {
  const f = (s: string) => {
    const d = fromISO(s);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  return r.from === r.to ? f(r.from) : `${f(r.from)} – ${f(r.to)}`;
}

/** Atalhos da lateral do calendário, calculados na hora do clique. */
export function atalhosDePeriodo(hoje = new Date()): { label: string; range: () => DateRange }[] {
  return [
    { label: "Hoje", range: () => ({ from: toISO(hoje), to: toISO(hoje) }) },
    { label: "Ontem", range: () => ({ from: toISO(somaDias(hoje, -1)), to: toISO(somaDias(hoje, -1)) }) },
    { label: "Últimos 7 dias", range: () => ({ from: toISO(somaDias(hoje, -6)), to: toISO(hoje) }) },
    { label: "Últimos 30 dias", range: () => ({ from: toISO(somaDias(hoje, -29)), to: toISO(hoje) }) },
    {
      label: "Este mês",
      range: () => ({ from: toISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), to: toISO(hoje) }),
    },
    {
      label: "Mês passado",
      range: () => ({
        from: toISO(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
        // dia 0 do mês atual = último dia do mês passado
        to: toISO(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
      }),
    },
  ];
}

/** Células do mês começando no domingo. `null` = espaço antes do dia 1. */
export function gradeDoMes(ano: number, mes: number): (Date | null)[] {
  const primeiro = new Date(ano, mes, 1);
  const dias = new Date(ano, mes + 1, 0).getDate();
  const out: (Date | null)[] = Array.from({ length: primeiro.getDay() }, () => null);
  for (let d = 1; d <= dias; d++) out.push(new Date(ano, mes, d));
  return out;
}
