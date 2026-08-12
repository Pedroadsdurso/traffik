/**
 * A LISTA DE EVENTOS do pixel — vocabulário, janela e estados vazios.
 *
 * > ### 🔴 POR QUE ESTA LISTA EXISTE
 * >
 * > É o único lugar do produto onde o usuário vê se o pixel dele **está
 * > disparando**. Sem ela, quem responde essa pergunta é o Gerenciador de
 * > Eventos da Meta — **um sistema que não é o nosso** —, e a denúncia chega de
 * > fora e tarde.
 *
 * Módulo **puro**: sem banco, sem rede, sem DOM. A server action e a tela leem
 * daqui, pela mesma razão de `espelho.ts` — arquivo `"use server"` transforma
 * todo export em endpoint, e constante exportada de lá quebra o build.
 *
 * ## ⚠️ A JANELA NÃO É PURGA — ela é o que impede a dívida de PIORAR
 *
 * `PixelEvent` tem o mesmo desenho do `WebhookLog`: **sem retenção e sem
 * purga** (dívida técnica nº 4). Mostrar a tabela numa tela não cria o
 * problema; uma listagem sem janela e sem paginação **transformaria** a dívida
 * numa consulta que piora sozinha com o tempo.
 *
 * ⛔ Por isso a janela é obrigatória e vem desta lista fechada — inclusive no
 * servidor, que **não confia no valor que o cliente mandou**. A retenção
 * continua devendo, e continua na lista de dívidas.
 *
 * ## 🕐 A janela é um INSTANTE, não um dia de calendário
 *
 * "Últimos 7 dias" aqui é `agora − 7 × 24h`, e comparado com `timestamp`, que é
 * um instante absoluto. Não passa por fuso nenhum de propósito: a regra do
 * projeto proíbe agregação pelo DIA do processo, e a saída certa quando não se
 * quer o dia é não usar dia nenhum.
 */

import { EVENTOS_DO_PIXEL, type EventoDoPixel } from "./donos";

/* ───────────────────────────── A janela ───────────────────────────── */

export const JANELAS = [
  { dias: 1, rotulo: "24 horas" },
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
] as const;

export type DiasDeJanela = (typeof JANELAS)[number]["dias"];

/**
 * 7 dias.
 *
 * ⚠️ Não é escolha estética: é o menor intervalo que ainda mostra um fim de
 * semana inteiro. Com 24h, um pixel de operação que só anuncia em dias úteis
 * abriria vazio na segunda de manhã — e "vazio" nesta tela se lê como
 * "quebrado".
 */
export const JANELA_PADRAO: DiasDeJanela = 7;

/** A janela pedida, ou o padrão. ⛔ Nunca devolve valor fora da lista. */
export function janelaValida(dias: unknown): DiasDeJanela {
  return JANELAS.some((j) => j.dias === dias) ? (dias as DiasDeJanela) : JANELA_PADRAO;
}

export function inicioDaJanela(dias: DiasDeJanela, agora: Date): Date {
  return new Date(agora.getTime() - dias * 86_400_000);
}

/** O filtro por tipo, validado contra o vocabulário. `null` = todos. */
export function eventoValido(evento: unknown): EventoDoPixel | null {
  return EVENTOS_DO_PIXEL.includes(evento as EventoDoPixel) ? (evento as EventoDoPixel) : null;
}

/* ─────────────────────── O estado vazio, que é três ─────────────────────── */

/**
 * 🕳️ AUSÊNCIA DE OBSERVAÇÃO ≠ OBSERVAÇÃO DE ZERO — a distinção central deste
 * projeto, aplicada a uma lista.
 *
 * Uma lista vazia tem três causas, e elas pedem AÇÕES OPOSTAS do usuário:
 *
 * | Motivo | O que o usuário deve fazer |
 * |---|---|
 * | `sem-nenhum` | conferir a instalação — nada chegou nunca |
 * | `fora-da-janela` | ampliar o período; a instalação já funcionou |
 * | `filtro` | tirar o filtro; há eventos, só não deste tipo |
 *
 * Colapsar os três num "nenhum evento encontrado" manda quem tem o script
 * instalado ir reinstalar, e deixa quem não tem achando que é só o período.
 */
export type MotivoDoVazio = "sem-nenhum" | "fora-da-janela" | "filtro";

export function motivoDoVazio(dados: {
  /** Quantas linhas a página trouxe. */
  linhas: number;
  /** Já chegou ALGUM evento deste pixel, em qualquer tempo e de qualquer tipo? */
  houveAlgumDia: boolean;
  /** Há filtro de tipo aplicado? */
  filtrado: boolean;
}): MotivoDoVazio | null {
  if (dados.linhas > 0) return null;
  // A ausência TOTAL vence as outras duas: mandar ampliar o período um pixel
  // que nunca recebeu nada é mandar procurar onde não há o que achar.
  if (!dados.houveAlgumDia) return "sem-nenhum";
  return dados.filtrado ? "filtro" : "fora-da-janela";
}

/**
 * ⚠️ `sem-nenhum` NÃO afirma "o script não está instalado".
 *
 * As três causas possíveis são indistinguíveis daqui: script ausente, script
 * instalado e quebrado, ou site sem tráfego nenhum no período. É a mesma
 * ambiguidade que `conferirSnippet` documenta em `sem-dados`, e a cópia diz as
 * três em vez de escolher a mais provável.
 */
export const TEXTO_DO_VAZIO: Record<MotivoDoVazio, { titulo: string; causa: string }> = {
  "sem-nenhum": {
    titulo: "Nenhum evento chegou deste pixel",
    causa:
      "Pode ser script não instalado, script instalado com erro, ou site sem visitas. Daqui não dá para distinguir os três — confira o código no site e abra uma página de teste.",
  },
  "fora-da-janela": {
    titulo: "Nenhum evento no período",
    causa: "Este pixel já enviou eventos antes. Amplie o período para ver os mais antigos.",
  },
  filtro: {
    titulo: "Nenhum evento deste tipo no período",
    causa: "Há eventos de outros tipos na mesma janela. Tire o filtro para vê-los.",
  },
};

/* ──────────────────────────── O ambiente ──────────────────────────── */

/**
 * O selo de ambiente — desenhado **só** quando o evento NÃO veio de produção.
 *
 * ⚠️ `null` significa "produção, ou não sabemos", e é o padrão de propósito
 * (ver o schema). Um selo "produção" em toda linha afirmaria o que a coluna não
 * garante, e ainda apagaria o contraste com as três marcações que importam.
 */
export const ROTULO_DO_AMBIENTE: Record<string, string> = {
  preview: "prévia",
  local: "local",
  tunel: "túnel",
};

export function seloDeAmbiente(ambiente: string | null): string | null {
  return ambiente ? (ROTULO_DO_AMBIENTE[ambiente] ?? ambiente) : null;
}
