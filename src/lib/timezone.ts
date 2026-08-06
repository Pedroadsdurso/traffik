/**
 * Fuso horário de referência — o ponto ÚNICO de conversão entre o instante
 * gravado no banco (sempre UTC) e o "dia"/"hora" que o usuário enxerga.
 *
 * ## Por que este arquivo existe
 *
 * O banco guarda `DateTime` em UTC, o que está certo. O erro estava do outro
 * lado: as agregações usavam `new Date().getHours()`, `setHours(0,0,0,0)` e
 * `getFullYear/getMonth/getDate`, que respondem no fuso do **processo Node**.
 * Em desenvolvimento (Windows, Brasil) esse fuso é `America/Sao_Paulo` e tudo
 * parecia certo; na Vercel o processo roda em **UTC**, e aí:
 *
 * - "Hoje" começava à meia-noite UTC = **21h do dia anterior** em Brasília, então
 *   o dia virava 3h mais cedo e as vendas das 21h–24h caíam no dia seguinte;
 * - `getHours()` devolvia a hora UTC, então uma venda das 17h aparecia às 20h.
 *
 * A regra daqui em diante: **nenhum código de agregação chama método local de
 * `Date`**. Tudo passa por estas funções, que recebem o fuso do usuário.
 */

/** Fuso padrão quando o usuário não configurou nada. */
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** Opções oferecidas na UI. Acrescentar aqui basta — nada mais depende da lista. */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "America/Noronha", label: "Fernando de Noronha (GMT-2)" },
  { value: "America/New_York", label: "Nova York (GMT-5/-4)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8/-7)" },
  { value: "Europe/Lisbon", label: "Lisboa (GMT+0/+1)" },
  { value: "Europe/London", label: "Londres (GMT+0/+1)" },
  { value: "UTC", label: "UTC (GMT+0)" },
];

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** `Intl.DateTimeFormat` é caro de construir; um por fuso basta. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      // `h23` evita o "24" que o `hour12:false` devolve à meia-noite.
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
  hour: number; // 0–23
  minute: number;
  second: number;
}

/** Decompõe um instante nos componentes do relógio de parede daquele fuso. */
export function partsInTz(d: Date, tz: string = DEFAULT_TIMEZONE): ZonedParts {
  const p = formatterFor(tz).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Deslocamento do fuso naquele instante, em ms (Brasília = -10800000). */
export function tzOffsetMs(d: Date, tz: string = DEFAULT_TIMEZONE): number {
  const p = partsInTz(d, tz);
  const comoSeFosseUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, d.getUTCMilliseconds());
  return comoSeFosseUtc - d.getTime();
}

/**
 * Dois fusos discordam sobre ONDE O DIA COMEÇA?
 *
 * Existe para responder a pergunta do card de fuso: "o fuso configurado na conta
 * bate com o do aparelho de quem está olhando?". E responde pelo que importa —
 * o deslocamento —, não pelo nome.
 *
 * > ### ⛔ Comparar NOME produz alarme falso, e alarme falso se aprende a ignorar
 * > `America/Sao_Paulo` e `America/Bahia` são strings diferentes e o **mesmo**
 * > deslocamento: o dia começa no mesmo instante, então nenhum número da
 * > ferramenta muda e não há o que avisar. Só a diferença de offset move a
 * > fronteira do dia — que é a causa raiz de toda a seção "Fuso horário" do
 * > CLAUDE.md.
 *
 * ⚠️ **Sonda mais de um instante, por causa do horário de verão.** Dois fusos
 * podem coincidir hoje e divergir em três meses — `America/Sao_Paulo` e
 * `Europe/Lisbon` chegam a compartilhar offset em parte do ano. Comparar só
 * "agora" deixaria a divergência aparecer sozinha meses depois, que é exatamente
 * o tipo de erro sistemático e silencioso que este módulo existe para acabar.
 *
 * Fuso ilegível devolve `false`: quem trata dado corrompido é `getUserTimezone`,
 * e um alarme aqui em cima de um `Intl` que falhou não diria nada útil.
 */
export function fusosDiscordam(a: string, b: string, agora: Date = new Date()): boolean {
  if (a === b) return false;
  if (!isValidTimezone(a) || !isValidTimezone(b)) return false;
  // ~Trimestral ao longo de um ano: pega as duas viradas de DST de qualquer
  // hemisfério, sem varrer 365 dias por um aviso de tela.
  const DIA = 86_400_000;
  for (const passo of [0, 91, 182, 273]) {
    const t = new Date(agora.getTime() + passo * DIA);
    if (tzOffsetMs(t, a) !== tzOffsetMs(t, b)) return true;
  }
  return false;
}

/**
 * Relógio de parede no fuso → instante UTC.
 *
 * Duas passadas por causa do horário de verão: o offset é estimado no instante
 * "chutado" e pode não ser o offset real do instante resultante quando a data
 * cai em cima da virada. O Brasil não tem mais DST, mas os fusos da lista têm.
 */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
  tz: string = DEFAULT_TIMEZONE,
): Date {
  const chute = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const off1 = tzOffsetMs(new Date(chute), tz);
  const off2 = tzOffsetMs(new Date(chute - off1), tz);
  return new Date(chute - off2);
}

// ── Chaves de dia (`YYYY-MM-DD`) ────────────────────────────────────────────
//
// A chave de dia é a unidade de agrupamento de todo o produto. Ela é uma
// STRING de propósito: comparar strings elimina a classe inteira de bugs de
// "instante que representa um dia".

/** O dia em que esse instante caiu, visto do fuso do usuário. */
export function dayKeyInTz(d: Date, tz: string = DEFAULT_TIMEZONE): string {
  const p = partsInTz(d, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** A hora (0–23) em que esse instante caiu, vista do fuso do usuário. */
export function hourInTz(d: Date, tz: string = DEFAULT_TIMEZONE): number {
  return partsInTz(d, tz).hour;
}

/**
 * Dia da semana de uma chave `YYYY-MM-DD`. 0 = domingo … 6 = sábado.
 *
 * ⛔ RECEBE A CHAVE, NÃO UM `Date` — e isso é a correção inteira. A chave já é a
 * data-calendário NO FUSO DO USUÁRIO (`dayKeyInTz` a produziu), então o dia da
 * semana dela é determinístico e não tem fuso nenhum a errar. Um
 * `data.getDay()` responderia no fuso do PROCESSO, que na Vercel é UTC: uma
 * venda de sábado 21h em Brasília viraria domingo.
 *
 * O `Date.UTC` aqui não é o fuso do dado; é só a forma de perguntar "que dia da
 * semana cai nesta data do calendário", sem que nenhuma conversão aconteça.
 */
export function weekdayDaChave(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/** Instante UTC da meia-noite daquele dia no fuso do usuário. */
export function dayStart(dayKey: string, tz: string = DEFAULT_TIMEZONE): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return zonedToUtc(y!, m!, d!, 0, 0, 0, 0, tz);
}

/** Último instante do dia (23:59:59.999) no fuso do usuário. */
export function dayEnd(dayKey: string, tz: string = DEFAULT_TIMEZONE): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return zonedToUtc(y!, m!, d!, 23, 59, 59, 999, tz);
}

/** Meia-noite do dia em que o instante caiu, no fuso do usuário. */
export function startOfDayInTz(d: Date, tz: string = DEFAULT_TIMEZONE): Date {
  return dayStart(dayKeyInTz(d, tz), tz);
}

/** Aritmética de calendário em cima da chave, sem passar por `Date` local. */
export function addDaysToKey(dayKey: string, n: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const base = new Date(Date.UTC(y!, m! - 1, d!));
  base.setUTCDate(base.getUTCDate() + n);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}`;
}

/** Quantos dias de calendário separam duas chaves (`b - a`). */
export function daysBetweenKeys(a: string, b: string): number {
  const p = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.round((p(b) - p(a)) / 864e5);
}

/** Hoje, no fuso do usuário. */
export function todayKey(tz: string = DEFAULT_TIMEZONE): string {
  return dayKeyInTz(new Date(), tz);
}

/** Lista inclusiva de chaves de `de` até `ate`. */
export function dayKeyRange(de: string, ate: string, max = 400): string[] {
  const out: string[] = [];
  let k = de;
  while (k <= ate && out.length < max) {
    out.push(k);
    k = addDaysToKey(k, 1);
  }
  return out;
}

// ── Colunas `@db.Date` ──────────────────────────────────────────────────────
//
// `DailyAdMetric.date` é `@db.Date`: um dia de CALENDÁRIO, gravado como
// meia-noite UTC (a Meta manda `"2026-07-25"` e o Prisma trunca a hora). Ele
// **não é um instante** e por isso não pode ser comparado com o início de um
// bucket no fuso do usuário — a meia-noite UTC do dia 25 é anterior à
// meia-noite de Brasília do dia 25, e a linha cairia no bucket do dia 24.
// Métrica diária se compara por chave de dia, nunca por `getTime()`.

/** A chave de dia de uma coluna `@db.Date` (lida em UTC, que é como foi gravada). */
export function dateColumnKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Valor para comparar contra uma coluna `@db.Date` num `where`. */
export function keyToDateColumn(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}
