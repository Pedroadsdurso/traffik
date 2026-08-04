/**
 * # `account_status` da Meta, traduzido
 *
 * ## O problema que isto resolve
 *
 * A ferramenta listava uma conta **desabilitada no Facebook** como se fosse
 * normal, deixava ligar o rastreamento nela, e ficava dois dias tentando
 * sincronizar em silêncio. O usuário só descobriu porque alguém foi investigar.
 *
 * O dado sempre esteve na mão: `getAdAccounts` já pede `account_status` na
 * mesma chamada. Ele era colapsado em `ACTIVE | PAUSED | UNKNOWN` e o motivo
 * real se perdia.
 *
 * ## ⚠️ A mensagem da Meta é IMPRECISA, e é por isso que o status importa
 *
 * Conta desabilitada deixa de conceder permissão pela API, e a Graph responde:
 *
 * > `(#200) Ad account owner has NOT grant ads_management or ads_read permission`
 *
 * Ou seja: ela diz **permissão** quando a causa é **conta desabilitada**. Quem
 * lê isso vai pedir acesso ao dono — e não é disso que se trata. Cruzar o erro
 * com o `account_status` é o que permite dizer a causa certa; ver
 * `explicarErroDeConta` em `erroMeta.ts`.
 */

/** O que a tela precisa saber sobre o estado de uma conta de anúncio. */
export interface EstadoDaConta {
  /** Constante da Meta, para log e depuração. */
  chave: string;
  /** Rótulo curto, em português, para a listagem. */
  rotulo: string;
  /**
   * A conta consegue ser sincronizada?
   *
   * ⚠️ Isto NÃO é "está gastando". Uma conta em período de carência ou com
   * pagamento pendente continua legível pela API — o que ela não faz é
   * entregar. Bloquear a sincronização dela esconderia gasto histórico real.
   */
  sincroniza: boolean;
  /** O que o usuário faz a respeito. `null` quando não há nada a fazer. */
  acao: string | null;
  tom: "ok" | "aviso" | "erro";
}

const DESCONHECIDO = (codigo: number | null): EstadoDaConta => ({
  chave: codigo == null ? "NAO_INFORMADO" : `DESCONHECIDO_${codigo}`,
  // ⛔ Valor novo da Meta aparece CRU, nunca vira chute. Um `default` dizendo
  // "ativa" esconderia conta quebrada; dizendo "com problema" produziria alarme
  // falso. Mesma regra de `lib/ads/veiculacao.ts`.
  rotulo: codigo == null ? "Status não informado" : `Status ${codigo} (desconhecido)`,
  // Na dúvida, SINCRONIZA. O contrário faria um código novo da Meta parar de
  // trazer gasto de uma conta que funciona — falha silenciosa e cara.
  sincroniza: true,
  acao: codigo == null ? null : "Código novo da Meta. Se a conta não sincronizar, avise o suporte.",
  tom: codigo == null ? "aviso" : "aviso",
});

/**
 * Os valores documentados de `account_status`.
 *
 * ⚠️ `201` e `202` (`ANY_ACTIVE` / `ANY_CLOSED`) são **agregados de consulta**,
 * não estados de uma conta — a Meta os usa em filtros. Se aparecerem numa conta
 * concreta, tratamos como o estado correspondente em vez de "desconhecido".
 */
const POR_CODIGO: Record<number, EstadoDaConta> = {
  1: { chave: "ACTIVE", rotulo: "Ativa", sincroniza: true, acao: null, tom: "ok" },
  2: {
    chave: "DISABLED",
    rotulo: "Desabilitada",
    sincroniza: false,
    acao: "O Facebook desabilitou esta conta. Abra o Gerenciador de Anúncios para ver o motivo e pedir revisão.",
    tom: "erro",
  },
  3: {
    chave: "UNSETTLED",
    rotulo: "Pagamento pendente",
    sincroniza: true,
    acao: "Há fatura em aberto. Regularize o pagamento no Gerenciador de Anúncios para voltar a veicular.",
    tom: "aviso",
  },
  7: {
    chave: "PENDING_RISK_REVIEW",
    rotulo: "Em análise de risco",
    sincroniza: true,
    acao: "O Facebook está revisando a conta. Costuma levar até 24h; não é preciso fazer nada.",
    tom: "aviso",
  },
  8: {
    chave: "PENDING_SETTLEMENT",
    rotulo: "Aguardando cobrança",
    sincroniza: true,
    acao: "A Meta está processando a cobrança. Não é preciso fazer nada.",
    tom: "aviso",
  },
  9: {
    chave: "IN_GRACE_PERIOD",
    rotulo: "Período de carência",
    sincroniza: true,
    acao: "A conta está no prazo extra para acertar o pagamento. Regularize antes que ela seja desabilitada.",
    tom: "aviso",
  },
  100: {
    chave: "PENDING_CLOSURE",
    rotulo: "Encerramento solicitado",
    sincroniza: false,
    acao: "Esta conta está sendo encerrada. Se não foi você, abra o Gerenciador de Anúncios agora.",
    tom: "erro",
  },
  101: {
    chave: "CLOSED",
    rotulo: "Encerrada",
    sincroniza: false,
    acao: "Conta encerrada no Facebook. O histórico já sincronizado continua aqui, mas não entra dado novo.",
    tom: "erro",
  },
  201: { chave: "ANY_ACTIVE", rotulo: "Ativa", sincroniza: true, acao: null, tom: "ok" },
  202: {
    chave: "ANY_CLOSED",
    rotulo: "Encerrada",
    sincroniza: false,
    acao: "Conta encerrada no Facebook. O histórico já sincronizado continua aqui, mas não entra dado novo.",
    tom: "erro",
  },
};

/**
 * Traduz o `account_status`. `null` = a conta foi sincronizada antes desta
 * coluna existir, e aí não afirmamos nada.
 *
 * ⚠️ **`null` NÃO é "com problema".** Antes do primeiro sync com este código
 * toda conta tem a coluna nula; se nulo alarmasse, a tela inteira apareceria em
 * vermelho no dia do deploy. Mesma lição do `effectiveStatus`.
 */
export function estadoDaConta(codigo: number | null | undefined): EstadoDaConta {
  if (codigo == null) return DESCONHECIDO(null);
  return POR_CODIGO[codigo] ?? DESCONHECIDO(codigo);
}

/**
 * A conta está num estado em que faz sentido ligar o rastreamento?
 *
 * ⚠️ Devolve `true` para status desconhecido e para `null`, de propósito: a
 * dúvida não pode virar bloqueio aqui. Bloquear é o oposto da regra de
 * autenticação — lá a dúvida vira recusa porque o risco é permissão indevida;
 * aqui o risco é impedir alguém de rastrear uma conta que funciona.
 */
export function podeRastrear(codigo: number | null | undefined): boolean {
  return estadoDaConta(codigo).sincroniza;
}
