/**
 * Vocabulário dos estados do espelho no pixel nativo (`PixelEvent.espelho`).
 *
 * Módulo **puro**: a server action de diagnóstico e a tela leem daqui. Ele não
 * pode morar em `actions/diagnostics.ts` porque aquele arquivo é `"use server"`
 * — lá todo export vira endpoint, e um array exportado quebra o build.
 *
 * Rótulo e tom decididos aqui, não na view: é a mesma razão de
 * `lib/ads/veiculacao.ts` e de `corFinanceira`. Um `switch` na tela diverge no
 * dia em que aparece a segunda tela.
 */

export type TomDoEspelho = "bom" | "atencao" | "ruim" | "neutro";

export interface EstadoDoEspelho {
  estado: string;
  rotulo: string;
  tom: TomDoEspelho;
  /** O que aquilo significa, em consequência. */
  ajuda: string;
}

/**
 * ⚠️ `nulo` NÃO é falha, e a distinção é o que dá valor ao resto.
 *
 * Ele cobre dois casos legítimos: evento de um script anterior à coluna, e
 * evento criado pelo SERVIDOR (o `InitiateCheckout` que nasce do webhook do
 * gateway — esse nunca passa por navegador nenhum). Sem separá-lo, todo o
 * histórico apareceria como espelho quebrado e o número que importa (`sem-fbq`)
 * se perderia no meio.
 */
export const ESTADOS_DO_ESPELHO: readonly EstadoDoEspelho[] = [
  {
    estado: "ok",
    rotulo: "saiu junto",
    tom: "bom",
    ajuda: "O pixel da página já estava carregado e recebeu o mesmo identificador que mandamos pelo servidor.",
  },
  {
    estado: "adiado-ok",
    rotulo: "saiu depois de esperar",
    tom: "bom",
    ajuda:
      "O pixel do Facebook ainda não tinha carregado e o evento esperou por ele. Funcionou, mas colar o nosso script DEPOIS do código do Facebook evita a espera.",
  },
  {
    estado: "adiado",
    rotulo: "aguardando o pixel da página",
    tom: "atencao",
    ajuda:
      "O evento entrou na fila e a página foi fechada antes de sabermos o desfecho. Um punhado é normal; muitos indicam que o pixel do Facebook demora a carregar.",
  },
  {
    estado: "sem-fbq",
    rotulo: "o pixel da página nunca apareceu",
    tom: "ruim",
    ajuda:
      "Esperamos 10s e o código do Facebook não carregou nessa página. Esses eventos foram só pelo servidor, sem par no navegador — a Meta pode contá-los em dobro. Confira se o código do Facebook está na página e cole o script da Trackhub depois dele.",
  },
  {
    estado: "erro",
    rotulo: "erro ao espelhar",
    tom: "ruim",
    ajuda: "O pixel do Facebook existia mas recusou o evento. Costuma ser conflito com outro script da página.",
  },
  {
    estado: "sem-nativo",
    rotulo: "sem pixel na página",
    tom: "neutro",
    ajuda:
      "Você respondeu que não tem o código do Facebook nesta página, então não há o que espelhar — o evento vai só pelo nosso servidor, que é o caminho certo nesse caso. Não é falha.",
  },
  {
    estado: "alheio",
    rotulo: "outro dono envia",
    tom: "neutro",
    ajuda:
      "Este evento está configurado para ser enviado pelo pixel da sua página ou pelo checkout do gateway, então não espelhamos. É o padrão do PageView.",
  },
  {
    estado: "nulo",
    rotulo: "não informado",
    tom: "neutro",
    ajuda:
      "Evento de um script anterior a este diagnóstico, ou criado pelo servidor a partir do webhook do gateway — esse não passa por navegador nenhum. Não significa falha.",
  },
];

const PORCHAVE = new Map(ESTADOS_DO_ESPELHO.map((e) => [e.estado, e]));

/** Estado desconhecido cai em `nulo` — nunca some da contagem. */
export function estadoDoEspelho(chave: string): EstadoDoEspelho {
  return PORCHAVE.get(chave) ?? PORCHAVE.get("nulo")!;
}

/** Índice para ordenar; desconhecido vai para o fim. */
export function ordemDoEspelho(chave: string): number {
  const i = ESTADOS_DO_ESPELHO.findIndex((e) => e.estado === chave);
  return i < 0 ? 99 : i;
}
