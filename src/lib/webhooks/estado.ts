/**
 * O ESTADO DE UM WEBHOOK — e o que ele significa para quem colou a URL.
 *
 * > ### 🔴 O ARTEFATO DESTA TELA É COLADO POR UMA TERCEIRA PARTE QUE NÃO VEMOS
 * >
 * > A URL do webhook vai para o painel do gateway do cliente. Ela é a forma mais
 * > cara do **artefato válido de contexto errado**: a URL de outra área é um
 * > endereço perfeitamente funcional, que aceita o payload, responde 200 e
 * > credita a venda **na operação errada**. Não há log, não há alerta, não há
 * > 4xx — o sintoma aparece como *venda faltando* numa área e *venda a mais* em
 * > outra, dois números plausíveis em telas diferentes, sem nada que os ligue.
 *
 * Módulo **puro**: sem banco, sem rede, sem DOM. A tela e o teste leem daqui.
 *
 * ## ⛔ ESTE ARQUIVO NÃO DECIDE NADA — ele TRADUZ o que o servidor já decidiu
 *
 * Quem recusa a venda é `gateways/receber.ts` + `gateways/autenticar.ts`. Aqui
 * só se lê a mesma configuração e se diz, em português, o que vai acontecer com
 * a próxima venda. Se a ordem abaixo divergir da ordem do servidor, é ESTA que
 * está errada — por isso ela é escrita espelhando aquela, e o motivo de cada
 * degrau está na linha.
 */

import type { WebhookRowDTO } from "@/lib/actions/webhooks";
import { gatewayDoWebhook } from "@/lib/gateways/registro";
// A régua de "parou de receber" é UMA. `inventario.ts` (a Visão geral) já a
// tinha, e duas implementações da mesma contagem divergem sempre — aqui a tela
// diria "mudo há 30 dias" enquanto a Visão geral ainda chamaria de conectada.
import { DIAS_INATIVA } from "@/lib/integracoes/inventario";
import { DIAS_LOG_FALHA, DIAS_LOG_SUCESSO } from "./retencao";

export { DIAS_INATIVA, DIAS_LOG_FALHA, DIAS_LOG_SUCESSO };

export type EstadoDoWebhook = "desligado" | "recusando" | "esperando" | "mudo" | "recebendo";

export interface LeituraDoEstado {
  estado: EstadoDoWebhook;
  /** O que o selo diz. Curto — o resto é a frase. */
  rotulo: string;
  tom: "success" | "warning" | "danger" | "neutral";
  /**
   * O que acontece com a PRÓXIMA venda enviada para este endereço.
   *
   * ⚠️ É sobre o futuro, não sobre o passado: "recebeu 43 vendas" e "a próxima
   * será recusada" são as duas verdadeiras ao mesmo tempo quando alguém apaga a
   * chave. Um selo que só contasse o histórico esconderia exatamente isso.
   */
  frase: string;
  /** `null` quando não há nada a fazer. */
  acao: string | null;
  /** Dias desde o último evento. `null` = nunca recebeu nada. */
  diasSemEvento: number | null;
}

/**
 * Dias inteiros entre o último evento e agora. `null` quando nunca houve um.
 *
 * ⚠️ Diferença de INSTANTES, não de dias de calendário — a regra do projeto
 * proíbe agregação pelo dia do processo, e a saída certa quando não se quer o
 * dia é não usar dia nenhum.
 */
export function diasSemEvento(lastEventAt: Date | string | null, agora: Date): number | null {
  if (!lastEventAt) return null;
  const t = lastEventAt instanceof Date ? lastEventAt.getTime() : new Date(lastEventAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((agora.getTime() - t) / 86_400_000));
}

/**
 * O estado de um webhook, na ordem em que o SERVIDOR decide.
 *
 * | # | servidor | aqui |
 * |---|---|---|
 * | 1 | `!active` → **403** | `desligado` |
 * | 2 | `!secret && auth.exigir` → **401** | `recusando` |
 * | 3 | passou | `esperando` · `mudo` · `recebendo`, pelo histórico |
 *
 * ⛔ A ordem não é estética. Um webhook desligado E sem chave está nas duas
 * situações, e ligá-lo não resolveria nada — mas é o interruptor que a pessoa
 * controla diretamente, e é o primeiro `if` do servidor. Inverter faria a tela
 * pedir a chave de um webhook que continuaria recusando por estar desligado.
 */
export function estadoDoWebhook(w: WebhookRowDTO, agora: Date): LeituraDoEstado {
  const def = gatewayDoWebhook(w.platform);
  const exigeChave = def.auth.tipo === "segredo" && def.auth.exigir;
  const dias = diasSemEvento(w.lastEventAt, agora);

  if (!w.active) {
    return {
      estado: "desligado",
      rotulo: "desligado",
      tom: "neutral",
      frase: "As vendas enviadas para este endereço são recusadas enquanto ele estiver desligado.",
      acao: "Ligue o webhook para voltar a receber.",
      diasSemEvento: dias,
    };
  }

  /**
   * 🔴 O ESTADO QUE A TELA ANTIGA NÃO TINHA — e ele é mudo por natureza.
   *
   * `autenticar()` recusa com **401** quando o gateway exige chave e não há
   * nenhuma cadastrada, e a mensagem dele manda o usuário *"editar o webhook na
   * aba Integrações › Webhooks"* — esta tela. Ela mostrava um selo verde de
   * "Ativado" no mesmo webhook.
   *
   * O usuário não tem como descobrir sozinho: quem vê o 401 é o painel do
   * gateway, que é de outra empresa. Do lado de cá o sintoma é *nenhuma venda
   * chegando*, que é indistinguível de *ninguém comprou*.
   */
  if (exigeChave && !w.hasSecret) {
    return {
      estado: "recusando",
      rotulo: "recusando vendas",
      tom: "danger",
      frase: `Sem a chave de segurança da ${def.nome}, toda venda enviada para este endereço é recusada.`,
      acao: `Gere a chave no painel da ${def.nome} e informe aqui.`,
      diasSemEvento: dias,
    };
  }

  /**
   * ⚠️ "Nunca recebeu" NÃO é erro, e pintá-lo de vermelho treinaria a pessoa a
   * ignorar vermelho. Webhook recém-criado está esperando a primeira venda — é
   * o estado normal de quem acabou de configurar. Mesma decisão da Visão geral.
   */
  if (w.eventCount === 0 || dias === null) {
    return {
      estado: "esperando",
      rotulo: "esperando a primeira venda",
      tom: "neutral",
      frase: "Está configurado e pronto. Nenhuma venda chegou por aqui ainda.",
      acao: null,
      diasSemEvento: dias,
    };
  }

  if (dias >= DIAS_INATIVA) {
    return {
      estado: "mudo",
      rotulo: `sem vendas há ${dias} dias`,
      tom: "warning",
      /* ⚠️ A frase declara a AMBIGUIDADE em vez de escolher um lado. Silêncio
         de 30 dias é indistinguível de operação pausada, e afirmar "está
         quebrado" numa oferta encerrada é alarme falso — que custa a confiança
         no aviso que um dia estiver certo. */
      frase: `A última venda chegou há ${dias} dias. Pode ser a oferta parada, ou a URL removida do painel da ${def.nome}.`,
      acao: `Confira se o endereço abaixo ainda está no painel da ${def.nome}.`,
      diasSemEvento: dias,
    };
  }

  return {
    estado: "recebendo",
    rotulo: "recebendo",
    tom: "success",
    frase:
      dias === 0
        ? "A última venda chegou hoje."
        : `A última venda chegou há ${dias} ${dias === 1 ? "dia" : "dias"}.`,
    acao: null,
    diasSemEvento: dias,
  };
}

/* ───────────────── Os quatro desfechos do WebhookLog ───────────────── */

/**
 * ⚠️ São QUATRO, não "ok/erro". `RECEBIDO` é um payload que **chegou e não
 * terminou de ser processado** — colapsá-lo em "ok" afirmaria que a venda
 * entrou, e colapsá-lo em "erro" afirmaria que não. As duas seriam invenção.
 */
export const DESFECHO_DA_ENTREGA = {
  PROCESSADO: {
    rotulo: "venda registrada",
    tom: "success" as const,
    ajuda: "O payload foi lido e a venda entrou na sua conta.",
  },
  RECEBIDO: {
    rotulo: "em processamento",
    tom: "neutral" as const,
    ajuda: "Chegou e foi guardado, mas o processamento não registrou desfecho. Costuma ser um envio interrompido.",
  },
  REJEITADO: {
    rotulo: "recusado",
    tom: "warning" as const,
    ajuda: "A Trackhub recusou o envio — normalmente chave de segurança errada ou webhook desligado.",
  },
  ERRO: {
    rotulo: "erro ao processar",
    tom: "danger" as const,
    ajuda: "O payload chegou e algo estourou ao lê-lo. É problema nosso, não do gateway.",
  },
};

/**
 * O motivo de a lista de entregas estar vazia — e são DOIS, com ações opostas.
 *
 * > ### 🔴 "NENHUMA ENTREGA" E "AS ENTREGAS FORAM APAGADAS" NÃO SÃO A MESMA
 * > ### AFIRMAÇÃO
 * >
 * > É a distinção central deste projeto — ausência de observação ≠ observação
 * > de zero — na camada de LOG. Um webhook que recebeu 43 vendas há seis meses
 * > mostra a lista vazia porque a purga diária (`api/cron/manutencao`) já
 * > apagou aquelas linhas. Dizer "nenhuma entrega ainda" ali faria a tela
 * > afirmar que o webhook nunca funcionou — sobre o webhook que mais funcionou.
 * >
 * > O que separa os dois é `eventCount`, que a purga **não** zera.
 *
 * ⛔ Houve uma terceira entrada aqui, `sem-dono`, e ela foi REMOVIDA por ser
 * inalcançável. O fato que a motivava é real e está medido — `WebhookLog.userId`
 * é NULO em toda linha cujo token não foi reconhecido (dev, 11/08/2026: 41 de
 * 41) —, mas linha sem `userId` não pertence a usuário nenhum, então nenhuma
 * tela pode mostrá-la sem mostrar o dado de outra pessoa. Um estado vazio
 * escrito, revisado e impossível de alcançar é proteção morta: ele faz quem lê
 * este arquivo acreditar que o caso está coberto.
 */
export type MotivoDoVazio = "nunca-recebeu" | "purgado";

export function motivoDoVazio(w: { eventCount: number; lastEventAt: Date | string | null }): MotivoDoVazio {
  /* Nunca chegou nada: a lista vazia é a resposta correta e completa. */
  if (w.eventCount === 0 && !w.lastEventAt) return "nunca-recebeu";
  /* O contador diz que chegou e a listagem não achou. `eventCount` sobrevive à
     purga; o log, não. */
  return "purgado";
}

export const TEXTO_DO_VAZIO: Record<MotivoDoVazio, { titulo: string; causa: string }> = {
  "nunca-recebeu": {
    titulo: "Nenhuma entrega ainda",
    causa:
      "Assim que a primeira venda for enviada para este endereço, ela aparece aqui — inclusive se for recusada.",
  },
  purgado: {
    titulo: "As entregas deste webhook já saíram do histórico",
    causa:
      `Ele já recebeu vendas, mas guardamos o registro por ${DIAS_LOG_SUCESSO} dias quando a venda entra e ` +
      `por ${DIAS_LOG_FALHA} dias quando ela é recusada. As vendas em si continuam na sua conta — o que sai é o registro do envio.`,
  },
};
