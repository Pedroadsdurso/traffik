/**
 * # Telefone em E.164 para a Conversions API
 *
 * ## Por que existe
 *
 * O `capi.ts` fazia `phone.replace(/\D/g, "")` e mandava para o hash. Isso tira
 * pontuação mas **não acrescenta o código do país**: um número brasileiro que
 * chega como `(11) 98765-4321` virava `11987654321`, enquanto a Meta espera
 * `5511987654321`. O SHA-256 dos dois é completamente diferente, então o evento
 * chegava com um telefone que **nunca casava com ninguém**.
 *
 * Não é um problema de privacidade — é de **qualidade de correspondência**, que
 * é o que alimenta otimização de campanha e público semelhante. Um sinal a menos
 * por venda.
 *
 * ## As regras de desambiguação
 *
 * O Brasil é o caso difícil porque o DDI (`55`) colide com um DDD válido (55, de
 * Santa Maria/RS). A decisão é pelo COMPRIMENTO, que não é ambíguo:
 *
 * | Dígitos | Leitura | Exemplo |
 * |---|---|---|
 * | 10 | DDD + fixo de 8 | `1132165498` → `551132165498` |
 * | 11 | DDD + celular de 9 | `11987654321` → `5511987654321` |
 * | 12–13 começando em 55 | já tem DDI | `5511987654321` → intacto |
 *
 * ⚠️ `55987654321` (11 dígitos) é lido como **DDD 55 + celular**, não como DDI
 * 55 + número de 9 dígitos — porque este último não existe: número nacional
 * brasileiro tem no mínimo 10 dígitos.
 *
 * ## ⚠️ Não foi validado contra payload real da Kirvano
 *
 * O banco de desenvolvimento não tem `WebhookLog` nem `Sale.buyerPhone` gravado,
 * então os formatos abaixo vêm da especificação brasileira, não de amostra. **Ao
 * receber a primeira venda real, confira o formato** e acrescente ao teste.
 */

/** DDI dos países que o produto encontra na prática. Brasil é o padrão. */
const DDI: Record<string, string> = {
  BR: "55",
  PT: "351",
  US: "1",
  CA: "1",
  AR: "54",
  CL: "56",
  CO: "57",
  MX: "52",
  ES: "34",
  UY: "598",
  PY: "595",
  GB: "44",
};

/**
 * Normaliza um telefone para E.164 **sem o `+`** — que é o formato que a Meta
 * pede antes do hash.
 *
 * @param bruto  O que veio do gateway.
 * @param pais   ISO-2 da venda, quando conhecido. Decide o DDI de um número
 *               nacional. Sem ele, assume Brasil.
 */
export function normalizarTelefoneE164(
  bruto: string | null | undefined,
  pais?: string | null,
): string | undefined {
  if (!bruto) return undefined;
  const texto = String(bruto).trim();
  if (!texto) return undefined;

  // Um `+` inicial declara que o número JÁ é internacional. É a informação mais
  // confiável que existe aqui — nada de adivinhar por cima dela.
  const jaInternacional = texto.startsWith("+") || texto.startsWith("00");
  let d = texto.replace(/\D/g, "");
  if (texto.startsWith("00")) d = d.slice(2); // prefixo internacional discado

  if (!d) return undefined;

  // Lixo: curto demais para ser telefone, ou longo demais para caber em E.164.
  if (d.length < 8 || d.length > 15) return undefined;

  if (jaInternacional) return d;

  const ddi = DDI[(pais ?? "BR").toUpperCase()] ?? "55";

  // Já começa com o DDI e tem comprimento de número internacional? Está pronto.
  // ⚠️ O `d.length > 11` é o que impede `55987654321` (DDD 55) de ser confundido
  // com um número que já tivesse DDI.
  if (d.startsWith(ddi) && d.length > (ddi === "55" ? 11 : ddi.length + 8)) return d;

  // Brasil: 10 (fixo) ou 11 (celular) dígitos são número NACIONAL, com DDD.
  if (ddi === "55") {
    if (d.length === 10 || d.length === 11) return ddi + d;
    // Fora dessas medidas não dá para afirmar o que é. Devolve como veio: um
    // palpite errado gera hash errado do mesmo jeito, e sem inventar dígito.
    return d;
  }

  return d.startsWith(ddi) ? d : ddi + d;
}
