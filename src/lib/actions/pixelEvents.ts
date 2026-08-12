"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { conferirSnippet, type SnippetCheckDTO } from "@/lib/actions/pixels";
import { janelaValida, eventoValido, inicioDaJanela, type DiasDeJanela } from "@/lib/pixel/eventos";

/**
 * Os eventos que ESTE pixel recebeu — paginados e dentro de uma janela.
 *
 * > ### ⛔ POR QUE A JANELA É DO SERVIDOR, E NÃO UM ENFEITE DA TELA
 * >
 * > `PixelEvent` não tem retenção nem purga (dívida nº 4). A tela nova torna a
 * > dívida VISÍVEL, o que foi aceito — mas ela não pode AGRAVAR: uma listagem
 * > sem janela e sem paginação vira, com o tempo, uma consulta que varre a
 * > tabela inteira a cada abertura.
 * >
 * > Por isso a validação é aqui, não no componente: `janelaValida` recusa
 * > qualquer valor fora da lista fechada, e `porPagina` é limitado a 100.
 * > Server action é endpoint — o valor que chega é o que o cliente mandou.
 *
 * ## 🔎 A consulta usa o índice `[userId, event, timestamp]`
 *
 * É o único índice que serve: **não existe índice por `pixelConfigId`**
 * (conferido no `schema.prisma`). Então o `where` começa por `userId`, aplica o
 * `event` quando há filtro, corta pelo `timestamp`, e o `pixelConfigId` entra
 * como filtro dentro do recorte — nunca como o critério de varredura.
 *
 * ⚠️ Criar o índice por `pixelConfigId` é migration, e migration não entra num
 * commit de tela. Fica anotado: se a lista ficar lenta, é ali que se mexe.
 */

export type OrigemDoEvento = "navegador" | "gateway";

export interface EventoDoPixelDTO {
  id: string;
  /** `PageView` · `Lead` · `AddToCart` · `InitiateCheckout` · `Purchase`. */
  evento: string;
  /** ISO. A tela desenha com `<Desde>` — nunca com `elapsed()` cru. */
  quando: string;
  /**
   * O estado do espelho no `fbq`, como o script reportou.
   *
   * ⚠️ `null` NÃO é falha: é evento de script anterior à coluna, ou criado pelo
   * servidor. `lib/pixel/espelho.ts` tem o vocabulário e trata o nulo.
   */
  espelho: string | null;
  /** O identificador de dedup. É ele que prova que a CAPI e o navegador casam. */
  eventId: string | null;
  url: string | null;
  /** `preview` · `local` · `tunel`; `null` = produção, ou não sabemos. */
  ambiente: string | null;
  /**
   * Quem gravou este evento.
   *
   * 🔎 **Medido em 11/08/2026:** o evento criado pelo webhook do gateway
   * (`webhook/checkoutEvent.ts:151`) **não grava `pixelConfigId`** — conferido
   * no código e no banco de dev (0 linhas com `gw:` e configuração). Uma lista
   * por pixel é, portanto, do NAVEGADOR por construção.
   *
   * O campo fica assim mesmo, derivado do prefixo `gw:`, porque a alternativa
   * seria a tela AFIRMAR "navegador" sem ter olhado. Se um dia o webhook passar
   * a carimbar o pixel, a coluna já responde certo.
   */
  origem: OrigemDoEvento;
}

export interface PaginaDeEventos {
  linhas: EventoDoPixelDTO[];
  /** Quantos existem NO FILTRO — não quantos vieram nesta página. */
  total: number;
  /**
   * Já chegou algum evento deste pixel, em qualquer tempo e de qualquer tipo?
   *
   * 🕳️ É o que separa "nada chegou nunca" de "nada no período" — duas listas
   * vazias idênticas na tela que pedem ações OPOSTAS do usuário.
   */
  houveAlgumDia: boolean;
  /** A janela que foi realmente usada, depois da validação. */
  janelaDias: DiasDeJanela;
}

export async function listarEventosDoPixel(params: {
  pixelConfigId: string;
  /** `null`/inválido = todos os tipos. */
  evento?: string | null;
  janelaDias?: number;
  pagina?: number;
  porPagina?: number;
}): Promise<PaginaDeEventos> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Não autenticado.");

  // A posse do pixel é verificada ANTES de qualquer leitura de evento: o id vem
  // do cliente, e `userId` no `where` dos eventos protegeria o dado mas devolveria
  // uma lista vazia plausível para o id de outra pessoa. 404 é a resposta honesta.
  const px = await prisma.pixelConfig.findFirst({
    where: { id: params.pixelConfigId, userId },
    select: { id: true },
  });
  if (!px) throw new Error("Pixel não encontrado.");

  const janelaDias = janelaValida(params.janelaDias);
  const evento = eventoValido(params.evento);
  const pagina = Math.max(1, Math.floor(params.pagina ?? 1));
  const porPagina = Math.min(100, Math.max(10, Math.floor(params.porPagina ?? 25)));

  const where = {
    userId,
    ...(evento ? { event: evento } : {}),
    timestamp: { gte: inicioDaJanela(janelaDias, new Date()) },
    pixelConfigId: params.pixelConfigId,
  };

  const [total, linhas, algum] = await Promise.all([
    prisma.pixelEvent.count({ where }),
    prisma.pixelEvent.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      // ⛔ `select` explícito: coluna fora dele chega `undefined` e nada acusa.
      select: {
        id: true,
        event: true,
        eventId: true,
        espelho: true,
        url: true,
        ambiente: true,
        timestamp: true,
      },
    }),
    // Sem janela e sem filtro de tipo, e só UMA linha: é existência, não contagem.
    prisma.pixelEvent.findFirst({
      where: { userId, pixelConfigId: params.pixelConfigId },
      select: { id: true },
    }),
  ]);

  return {
    total,
    houveAlgumDia: Boolean(algum),
    janelaDias,
    linhas: linhas.map((e) => ({
      id: e.id,
      evento: e.event,
      quando: e.timestamp.toISOString(),
      espelho: e.espelho,
      eventId: e.eventId,
      url: e.url,
      ambiente: e.ambiente,
      origem: e.eventId?.startsWith("gw:") ? "gateway" : "navegador",
    })),
  };
}

/**
 * O diagnóstico de VÁRIOS pixels, numa ida só ao servidor.
 *
 * A tela desenha um selo por pixel na lista. Uma chamada por pixel seria N
 * requisições para desenhar uma coluna — aqui as N conferências acontecem do
 * lado onde custam consulta, e não ida e volta pela rede.
 *
 * ⛔ Ela **não reimplementa** `conferirSnippet`: chama a mesma função. Duas
 * implementações da mesma conta divergem sempre, e quando divergem num
 * diagnóstico o resultado é a lista dizendo "conferido" e o detalhe dizendo
 * "divergente" sobre o mesmo pixel.
 *
 * ⚠️ Pixel que falhar (excluído no meio do caminho, por exemplo) sai FORA do
 * mapa em vez de entrar com um estado inventado. A tela desenha esqueleto para
 * quem não tem resposta, que é o estado honesto de "ainda não sei".
 *
 * ⚠️ Teto de 25 ids por chamada: a lista da tela é a de uma área, e sem limite
 * um id repetido 500 vezes viraria 1.500 consultas numa requisição.
 */
export async function diagnosticoDosPixels(ids: string[]): Promise<Record<string, SnippetCheckDTO>> {
  const unicos = Array.from(new Set(ids.filter((i) => typeof i === "string" && i))).slice(0, 25);
  const pares = await Promise.all(
    unicos.map(async (id) => {
      try {
        return [id, await conferirSnippet(id)] as const;
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(pares.filter((p): p is [string, SnippetCheckDTO] => p !== null));
}
