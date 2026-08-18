import { estadoDoToken, rotuloDoToken, detalheDoToken, tokenPedeAtencao, type EstadoToken } from "@/lib/integracoes/token";

/**
 * A LINGUAGEM DA VITRINE DE PERFIS — pura, para poder ser asserida.
 *
 * ## 🔑 Por que o recorte por área vira TEXTO aqui
 *
 * `AdProfile` **não tem `workspaceId`**: o escopo entra nas CONTAS, e o perfil
 * aparece com um **subconjunto** das contas dele. Isso é informação, não
 * defeito — e a tela precisa DIZER, senão o usuário conta 3 onde sabe que há 8
 * e conclui que perdeu contas.
 *
 * ⛔ Numa lista achatada as contas de outra área **somem**, e ninguém sabe que
 * existem. É o segundo motivo de a vitrine ser a forma certa.
 */

/** `3 de 8 contas nesta área` — e `null` quando não há recorte a declarar. */
export function frasedoRecorte(nestaArea: number, total: number): string | null {
  /* ⛔ Sem recorte, NÃO fabrique a frase: "8 de 8" é ruído que se aprende a
     ignorar, e aí a que diz "3 de 8" chega no meio de dez iguais. */
  if (total <= 0 || nestaArea >= total) return null;
  return `${nestaArea} de ${total} ${total === 1 ? "conta" : "contas"} nesta área`;
}

/**
 * ⚠️ Quantos perfis o usuário tem que NÃO aparecem nesta área.
 *
 * 🔴 A tela precisa dizer isto, senão quem conectou um perfil e não o vê procura
 * um bug que não existe. É a distinção central: **ausente ≠ inexistente**.
 */
export function frasedoOculto(visiveis: number, conectados: number): string | null {
  const ocultos = conectados - visiveis;
  if (ocultos <= 0) return null;
  return ocultos === 1
    ? "1 perfil conectado não tem conta nesta área e não aparece aqui."
    : `${ocultos} perfis conectados não têm conta nesta área e não aparecem aqui.`;
}

export type TomDoToken = "ok" | "atencao" | "perigo";

export interface SeloDoToken {
  rotulo: string;
  detalhe: string | null;
  tom: TomDoToken;
  /** `true` quando o selo pede que o usuário reconecte agora. */
  pedeAcao: boolean;
}

/**
 * O SELO DO TOKEN, em PRIMEIRO PLANO no card — não numa aba.
 *
 * ## 🔑 Reconectar é a ação mais importante da tela, e o selo é o gatilho dela
 *
 * Uma tela que tem o botão e não diz QUANDO usá-lo faz a ação principal existir
 * sem o motivo. Por isso o selo fica junto do nome.
 *
 * ⛔ **A conta é do `lib/integracoes/token.ts`**, que é puro e é o MESMO que
 * alimenta o alerta do Dashboard (`token-<id>`) e o painel de Saúde da Visão
 * geral. Uma segunda implementação faria duas telas discordarem sobre o mesmo
 * token — e o `DIAS_ATENCAO` divergiria no primeiro ajuste.
 *
 * ⚠️ **`desconhecido` é `perigo`, não `atencao`.** São os perfis conectados
 * ANTES de a coluna existir — os mais antigos, logo os mais prováveis de já
 * estarem vencidos. Pintá-lo de amarelo diria "provavelmente está bem", e não
 * sabemos: *não medido* não é *medido e ok*.
 */
export function seloDoToken(expiraEm: Date | string | null | undefined, agora = new Date()): SeloDoToken {
  const e: EstadoToken = estadoDoToken(expiraEm, agora);
  const pedeAcao = tokenPedeAtencao(e);
  /* ⛔ QUEM DECIDE "É URGENTE?" É `tokenPedeAtencao`, não um `dias <= 30` aqui.
     A primeira versão desta linha pintava de ATENÇÃO qualquer `expira` — e um
     token que vence em 400 dias virava amarelo. Era uma segunda implementação
     do limiar, escrita no mesmo commit que diz que a fonte é única, e foi a
     asserção do lado bom (`válido e longe é ok`) que a pegou. */
  const tom: TomDoToken =
    e.tipo === "vencido" || e.tipo === "desconhecido" ? "perigo" : pedeAcao ? "atencao" : "ok";
  return { rotulo: rotuloDoToken(e), detalhe: detalheDoToken(e), tom, pedeAcao };
}
