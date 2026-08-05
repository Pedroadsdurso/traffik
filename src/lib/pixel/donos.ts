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
 * Nos dois casos a Trackhub para de enviar aquele evento à Meta. A diferença é de
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

export type DonoDoEvento = "traffik" | "navegador" | "gateway" | "ninguem";

/** Mapa `evento → dono`, como fica em `PixelConfig.eventOwners`. */
export type MapaDeDonos = Partial<Record<EventoDoPixel, DonoDoEvento>>;

const DONOS_VALIDOS: readonly string[] = ["traffik", "navegador", "gateway", "ninguem"];

/**
 * ## 🔴 `PageView` é o único evento cujo padrão NÃO é a Trackhub
 *
 * O código-base da Meta que o usuário cola na página termina em
 * `fbq('track', 'PageView')`. Esse disparo:
 *
 * 1. acontece em **todo** carregamento, sem ninguém pedir;
 * 2. vai **sem `event_id`** — e não há como fazê-lo ir com um, porque o código
 *    é da Meta e não nosso;
 * 3. portanto **não casa com a nossa CAPI de jeito nenhum**.
 *
 * Medido em 31/07/2026: uma visita, dois PageView na Meta. E o espelho no `fbq`
 * **não resolve** — ele criaria um segundo evento de navegador que deduplica com
 * a nossa CAPI, deixando o automático sozinho do mesmo jeito. Continuaria 2.
 *
 * Como nenhum dos dois lados consegue ceder, quem cede somos nós: com um pixel
 * nativo na página, o dono natural do PageView é ele.
 *
 * > ⚠️ **Isto MUDA o comportamento de quem já tem pixel cadastrado**, e é o
 * > objetivo: hoje essas contas contam visita em dobro. Quem não tiver pixel
 * > nativo na página escolhe "Trackhub" na gaveta e volta ao envio server-side.
 *
 * ⚠️ Os demais eventos continuam em `traffik`. Neles não existe segundo emissor
 * automático — `Lead`, `AddToCart`, `InitiateCheckout` e `Purchase` só saem do
 * navegador se alguém chamar `fbq('track', …)` explicitamente. Rebaixar o padrão
 * deles perderia conversão em silêncio, que é o erro caro.
 */
const PADRAO_DO_EVENTO: Record<EventoDoPixel, DonoDoEvento> = {
  PageView: "navegador",
  Lead: "traffik",
  AddToCart: "traffik",
  InitiateCheckout: "traffik",
  Purchase: "traffik",
};

/**
 * Lê o Json cru do banco, descartando o que não reconhece.
 *
 * ⚠️ Valor desconhecido cai no **padrão do evento** (`PADRAO_DO_EVENTO`), nunca
 * numa decisão nova. Para tudo que não é `PageView` esse padrão é ENVIAR: deixar
 * de mandar por causa de um dado corrompido, ou de um evento novo que o mapa não
 * conhece, é falha silenciosa — o evento some da Meta e nada na tela denuncia. É
 * o oposto da regra de autenticação (onde a dúvida vira bloqueio), e de
 * propósito: aqui o risco não é permissão indevida, é perder conversão.
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

/** Dono de um evento. Ausente, desconhecido ou mapa nulo → padrão do evento. */
export function donoDoEvento(bruto: unknown, evento: string): DonoDoEvento {
  const mapa = lerDonos(bruto);
  return mapa[evento as EventoDoPixel] ?? padraoDoEvento(evento);
}

/** Padrão de um evento. Evento desconhecido → `traffik` (ver `lerDonos`). */
export function padraoDoEvento(evento: string): DonoDoEvento {
  return PADRAO_DO_EVENTO[evento as EventoDoPixel] ?? "traffik";
}

/**
 * A Trackhub envia este evento para a Meta?
 *
 * É o único predicado que os três caminhos de envio consultam — o do script no
 * navegador, o de `/api/pixel/event` e o do `dispatchPixel` do Purchase. Um
 * `if` escrito à mão em qualquer um deles divergiria dos outros no dia em que a
 * regra mudasse.
 */
export function traffikEnvia(bruto: unknown, evento: string): boolean {
  return donoDoEvento(bruto, evento) === "traffik";
}

/**
 * Rótulo para a tela.
 *
 * ⚠️ "Meu gateway" cobria mal o caso do `PageView`: ali o outro emissor não é o
 * checkout do gateway, é o **pixel que o próprio usuário instalou na própria
 * página**. Um rótulo que aponta para o lugar errado manda o usuário procurar o
 * problema onde ele não está.
 */
export const ROTULO_DONO: Record<DonoDoEvento, string> = {
  traffik: "Trackhub",
  navegador: "O pixel da sua página",
  gateway: "O checkout do gateway",
  ninguem: "Ninguém",
};

/** Uma linha explicando a consequência de cada escolha. */
export const EXPLICACAO_DONO: Record<DonoDoEvento, string> = {
  traffik: "Enviamos pelo servidor. Chega mesmo com bloqueador de anúncios.",
  navegador: "O código do Facebook que já está na sua página envia. Nós só registramos.",
  gateway: "O checkout do seu gateway envia. Nós só registramos.",
  ninguem: "Este evento não vai para a Meta. Continua contando aqui.",
};

/*
 * ## ⛔ `NOTA_DO_EVENTO` foi REMOVIDA (31/07/2026) — não a recrie
 *
 * Era um aviso por evento, e só o `PageView` tinha um. Ele dizia:
 *
 * > "Escolha Trackhub só se você NÃO tiver o pixel do Facebook na página."
 *
 * Duas coisas aconteceram com ele, e as duas mandam apagar em vez de reescrever:
 *
 * 1. **A gaveta reformada parou de renderizá-lo** e ninguém removeu a constante
 *    — exportada, documentada e **importada por nenhum arquivo**. Mais um caso
 *    do PROCEDIMENTO OBRIGATÓRIO: código inerte que compila.
 * 2. Pior, o texto ficou **contra** a reforma. Aquela frase pedia para o usuário
 *    trocar o dono do PageView na mão, e é exatamente esse caminho que deixa o
 *    script instalado defasado em silêncio (o `ALHEIOS` é assado na geração).
 *    Hoje quem responde isso é a PERGUNTA do preset, que muda os donos **e** o
 *    comportamento do script de uma vez.
 *
 * Se um evento voltar a precisar de nota, ela pertence ao lado do controle que
 * o usuário deve mexer — a pergunta —, nunca ao lado do que ele não deve.
 */
