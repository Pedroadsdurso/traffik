/**
 * # Quem envia cada evento para a Meta
 *
 * ## O problema que isto resolve
 *
 * Com o pixel nativo do gateway na mesma jornada, o MESMO evento chega à Meta
 * por dois caminhos independentes. Ela só junta os dois quando eles trazem o
 * **mesmo `event_id`** — e isso exige que a MESMA parte dispare os dois lados.
 *
 * Com o gateway, é impossível: o `eid` dele é um UUID gerado no navegador dele
 * (`InitiateCheckout-ff7d1800-…`) e **não aparece em campo nenhum do webhook** —
 * verificado em 167 payloads reais de produção, onde `sale_id` e `checkout_id`
 * são códigos de 8 caracteres, não UUIDs. Não há como reconstruí-lo.
 *
 * Medido em produção em 31/07/2026: **1 venda real, o Gerenciador de Anúncios
 * marcando 2.**
 *
 * > ### ⛔ A ausência de duplicata vem de PARTIÇÃO, não de coordenação
 * > Cada evento tem **um dono**. Ninguém manda o mesmo evento duas vezes porque
 * > só um lado o manda — e isso é estrutural, não disciplina. Mesmo critério do
 * > `Sale.platform` e da precedência de áreas.
 *
 * ## ⚠️ "gateway" e "ninguem" fazem a MESMA coisa do nosso lado
 *
 * Nos dois casos a Traffik para de enviar aquele evento à Meta. A diferença é de
 * **intenção declarada**, e ela existe porque muda o que a ferramenta diz ao
 * usuário: "gateway" significa "alguém mais envia" e merece o aviso sobre CAPI
 * própria; "ninguem" significa "este evento não vai para a Meta, e está certo".
 *
 * Sem a distinção, um diagnóstico futuro não teria como perguntar "você marcou
 * que o gateway envia Purchase — ele tem API de Conversões mesmo?".
 *
 * ## ⚠️ Deixar de enviar à Meta NÃO é deixar de registrar
 *
 * O evento continua sendo gravado em `PixelEvent` em qualquer dos três casos. O
 * funil, o Dashboard e o Gerenciador seguem contando — o dono decide apenas
 * quem fala com a Meta. Sem essa separação, escolher "gateway" para o
 * InitiateCheckout apagaria uma etapa inteira do funil como efeito colateral
 * invisível de uma decisão sobre pixel.
 */

/** Eventos que a ferramenta sabe enviar. `PageView` não tem regra própria. */
export const EVENTOS_DO_PIXEL = [
  "PageView",
  "Lead",
  "AddToCart",
  "InitiateCheckout",
  "Purchase",
] as const;

export type EventoDoPixel = (typeof EVENTOS_DO_PIXEL)[number];

export type DonoDoEvento = "traffik" | "gateway" | "ninguem";

/** Mapa `evento → dono`, como fica em `PixelConfig.eventOwners`. */
export type MapaDeDonos = Partial<Record<EventoDoPixel, DonoDoEvento>>;

const DONOS_VALIDOS: readonly string[] = ["traffik", "gateway", "ninguem"];

/**
 * Lê o Json cru do banco, descartando o que não reconhece.
 *
 * ⚠️ Valor desconhecido vira **`traffik`**, nunca "não envia". O padrão de toda
 * ausência aqui é ENVIAR: deixar de mandar por causa de um dado corrompido, ou
 * de um evento novo que o mapa não conhece, é falha silenciosa — o evento some
 * da Meta e nada na tela denuncia. É o oposto da regra de autenticação (onde a
 * dúvida vira bloqueio), e de propósito: aqui o risco não é permissão indevida,
 * é perder conversão.
 */
export function lerDonos(bruto: unknown): MapaDeDonos {
  const out: MapaDeDonos = {};
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return out;
  for (const evento of EVENTOS_DO_PIXEL) {
    const v = (bruto as Record<string, unknown>)[evento];
    if (typeof v === "string" && DONOS_VALIDOS.includes(v)) out[evento] = v as DonoDoEvento;
  }
  return out;
}

/** Dono de um evento. Ausente, desconhecido ou mapa nulo → `traffik`. */
export function donoDoEvento(bruto: unknown, evento: string): DonoDoEvento {
  const mapa = lerDonos(bruto);
  return mapa[evento as EventoDoPixel] ?? "traffik";
}

/**
 * A Traffik envia este evento para a Meta?
 *
 * É o único predicado que os três caminhos de envio consultam — o do script no
 * navegador, o de `/api/pixel/event` e o do `dispatchPixel` do Purchase. Um
 * `if` escrito à mão em qualquer um deles divergiria dos outros no dia em que a
 * regra mudasse.
 */
export function traffikEnvia(bruto: unknown, evento: string): boolean {
  return donoDoEvento(bruto, evento) === "traffik";
}

/** Rótulo para a tela. */
export const ROTULO_DONO: Record<DonoDoEvento, string> = {
  traffik: "Traffik",
  gateway: "Meu gateway",
  ninguem: "Ninguém",
};
