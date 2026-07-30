import type { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";

/**
 * Leitura tolerante de campos de payload — as peças que TODO parser usa.
 *
 * Vinha de `webhook/normalizeSale.ts`, onde convivia com o parser genérico. Está
 * separado porque um parser novo precisa destas funções sem precisar do parser
 * genérico junto: `pick`/`toNumber` são infraestrutura, "onde a Hotmart guarda o
 * valor" é conhecimento de gateway.
 *
 * ⚠️ O comportamento destas funções é congelado por `npm run test:gateways`,
 * contra 167 payloads reais de produção. Mudar qualquer uma delas muda a leitura
 * de TODOS os gateways de uma vez.
 */

export type Json = Record<string, unknown>;

export function isObj(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Lê a primeira chave presente, aceitando caminhos aninhados "a.b.c". */
export function pick(obj: Json, keys: string[]): unknown {
  for (const key of keys) {
    if (key.includes(".")) {
      let cur: unknown = obj;
      for (const part of key.split(".")) {
        if (!isObj(cur)) {
          cur = undefined;
          break;
        }
        cur = cur[part];
      }
      if (cur !== undefined && cur !== null && cur !== "") return cur;
    } else if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return undefined;
}

export function toStr(v: unknown, max = 512): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

/** Converte "1.234,56" | "1,234.56" | "R$ 197,00" | centavos em número. */
export function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  let s = v.replace(/[^\d.,-]/g, "");
  if (s.includes(",") && s.includes(".")) {
    // O último separador é o decimal.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Número **ou `null`** — a versão que respeita a REGRA 1 do contrato.
 *
 * ⚠️ `toNumber` devolve `0` para o que não souber ler, e isso é certo para o
 * valor da venda (uma venda sem valor legível é R$ 0,00). Para taxa e comissão é
 * **errado**: `0` afirma que o gateway não cobrou, quando ele só não informou —
 * e o líquido apareceria maior que a realidade, plausível e falso.
 */
export function toNumeroOuNulo(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = toNumber(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Status textual → nosso estado. É o **último** fallback de qualquer gateway:
 * quando o evento não está no mapa da plataforma, ainda dá para ler o campo de
 * situação.
 */
export function statusPeloTexto(raw: unknown): SaleStatus {
  const s = String(raw ?? "").toLowerCase();
  if (/reembol|refund|estorn/.test(s)) return "REEMBOLSADA";
  if (/chargeback|contest/.test(s)) return "CHARGEBACK";
  if (/cancel|recus|refus|declin|expir/.test(s)) return "CANCELADA";
  if (/aprov|approv|paid|pago|complet|authorized|active/.test(s)) return "APROVADA";
  return "PENDENTE";
}

export function mapPayment(raw: unknown): PaymentMethod {
  const s = String(raw ?? "").toLowerCase();
  if (/pix/.test(s)) return "PIX";
  if (/cart|card|credit|debit/.test(s)) return "CARTAO";
  if (/boleto|bank_slip|slip/.test(s)) return "BOLETO";
  return "OUTRO";
}

/**
 * Normaliza o campo `data` de um payload para uma LISTA.
 *
 * A Cakto manda objeto no disparo individual e array no agrupado — e um parser
 * que assuma objeto quebra no modo agrupado **em silêncio**, processando só o
 * primeiro item ou nenhum. Outros gateways têm o mesmo padrão, então o helper
 * mora aqui e não no parser da Cakto.
 */
export function comoLista(v: unknown): Json[] {
  if (Array.isArray(v)) return v.filter(isObj);
  if (isObj(v)) return [v];
  return [];
}

/**
 * Extrai o `fbclid` de um cookie `_fbc` da Meta.
 *
 * Formato: `fb.<subdomínios>.<timestamp>.<fbclid>` — o fbclid é o que sobra
 * depois do terceiro ponto, e pode conter pontos ele mesmo, então NÃO se pode
 * usar `split(".")[3]`.
 */
export function fbclidDoFbc(fbc: string | null): string | null {
  if (!fbc) return null;
  const m = /^fb\.[^.]*\.[^.]*\.(.+)$/.exec(fbc.trim());
  return m?.[1] ?? null;
}
