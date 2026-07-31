/**
 * # Status de VEICULAÇÃO — `status` × `effective_status`
 *
 * A Meta expõe **dois** campos, e a diferença entre eles é a informação que o
 * usuário procura:
 *
 * | Campo | Responde |
 * |---|---|
 * | `status` | o que foi **configurado** (ACTIVE, PAUSED, ARCHIVED, DELETED) |
 * | `effective_status` | se está **realmente veiculando** |
 *
 * Uma campanha `ACTIVE` pode não entregar nada: o conjunto está pausado, o
 * anúncio foi reprovado, a conta está sem forma de pagamento, ou ela ainda não
 * chegou na data de início. Sem o segundo campo, a ferramenta mostra "ativa" e
 * o usuário fica procurando o gasto que nunca vem.
 *
 * ## Por que a tradução mora AQUI, e não na view
 *
 * Mesma razão de `lib/ads/status.ts` e de `corFinanceira`: rótulo e cor
 * decididos na tela são rótulo e cor que divergem quando aparece a segunda
 * tela. O `AdsTable` mostra, a sonda (`npm run ads:sonda`) confere contra a
 * resposta crua, e os dois leem esta tabela.
 *
 * ## ⚠️ Valor desconhecido NÃO é erro — é exibido cru
 *
 * A Meta acrescenta valores sem aviso. Um `default` que chutasse "não está
 * veiculando" transformaria um valor novo em diagnóstico falso; um que
 * chutasse "veiculando" esconderia um problema real. Valor fora da tabela
 * aparece **como veio**, marcado como não traduzido — é o que faz a lacuna
 * pedir correção em vez de passar batido.
 *
 * ⚠️ **Nulo é "não informado", nunca "parado".** Antes do primeiro sync com o
 * código que pede o campo, TODA linha do banco tem `effectiveStatus` nulo.
 */

/** Tom do selo. A cor sai daqui, nunca de um ternário na view. */
export type TomVeiculacao = "ok" | "pausado" | "atencao" | "erro" | "apagado" | "indefinido";

export interface Veiculacao {
  /** O valor cru que a Meta devolveu (ou `null`). */
  cru: string | null;
  /** Rótulo curto, em linguagem de operação — não o valor da API. */
  rotulo: string;
  /** Uma frase dizendo o que está acontecendo e, quando cabe, o que fazer. */
  detalhe: string;
  tom: TomVeiculacao;
  cor: string;
  /**
   * 🔴 Configurado como ATIVO e **não** veiculando.
   *
   * É o caso que o usuário pediu para ficar evidente: a linha diz "ativa", o
   * toggle está ligado, e não entra impressão nenhuma.
   */
  divergente: boolean;
  /** O valor veio da Meta mas não está nesta tabela. */
  desconhecido: boolean;
}

const COR: Record<TomVeiculacao, string> = {
  ok: "var(--color-success, #4ade80)",
  pausado: "var(--color-neutral-500, #9397ab)",
  atencao: "var(--color-warning, #fbbf24)",
  erro: "var(--color-danger, #f87171)",
  apagado: "var(--color-neutral-600, #75798c)",
  indefinido: "var(--color-neutral-600, #75798c)",
};

/**
 * Os valores de `effective_status` documentados pela Marketing API.
 *
 * Nem todos aparecem em todos os níveis: `ADSET_PAUSED` só faz sentido no
 * anúncio, `CAMPAIGN_PAUSED` no anúncio e no conjunto, e os de revisão
 * (`DISAPPROVED`, `PENDING_REVIEW`, `PREAPPROVED`) são do anúncio — é ele que
 * passa por análise. Mapear tudo num só lugar é de propósito: a Meta já mudou
 * de ideia sobre em qual nível cada valor aparece, e uma tabela por nível
 * divergiria em silêncio.
 *
 * ⚠️ Esta lista veio da DOCUMENTAÇÃO. O que a sua conta devolve de verdade é o
 * que a `npm run ads:sonda` mostra — ela lista os valores observados e avisa
 * quando aparece um que não está aqui.
 */
const MAPA: Record<string, { rotulo: string; detalhe: string; tom: TomVeiculacao }> = {
  ACTIVE: {
    rotulo: "Veiculando",
    detalhe: "Entregando normalmente.",
    tom: "ok",
  },
  PAUSED: {
    rotulo: "Pausado",
    detalhe: "Pausado por você, aqui mesmo.",
    tom: "pausado",
  },
  ADSET_PAUSED: {
    rotulo: "Conjunto pausado",
    detalhe: "O anúncio está ativo, mas o conjunto acima dele está pausado — nada é entregue. Ative o conjunto na aba Conjuntos.",
    tom: "atencao",
  },
  CAMPAIGN_PAUSED: {
    rotulo: "Campanha pausada",
    detalhe: "Está ativo, mas a campanha acima está pausada — nada é entregue. Ative a campanha na aba Campanhas.",
    tom: "atencao",
  },
  DISAPPROVED: {
    rotulo: "Reprovado",
    detalhe: "A Meta reprovou o anúncio por política. Ele não entrega até ser editado e reenviado para análise.",
    tom: "erro",
  },
  PENDING_REVIEW: {
    rotulo: "Em análise",
    detalhe: "A Meta ainda está revisando. Costuma levar até 24h; até lá não entrega.",
    tom: "atencao",
  },
  PREAPPROVED: {
    rotulo: "Aprovado provisoriamente",
    detalhe: "Liberado para começar, mas a revisão final ainda pode reprovar.",
    tom: "atencao",
  },
  PENDING_BILLING_INFO: {
    rotulo: "Falta pagamento",
    detalhe: "A conta de anúncio está sem forma de pagamento válida. Nada entrega até resolver isso no Gerenciador de Anúncios.",
    tom: "erro",
  },
  IN_PROCESS: {
    rotulo: "Preparando",
    detalhe: "A Meta ainda está processando — agendamento que não começou, ou alteração recente sendo aplicada.",
    tom: "atencao",
  },
  WITH_ISSUES: {
    rotulo: "Com problema",
    detalhe: "A Meta sinalizou um problema que impede a entrega. Abra no Gerenciador de Anúncios para ver qual.",
    tom: "erro",
  },
  // ── Apagados ────────────────────────────────────────────────────────────
  // "Excluir" no Gerenciador da Meta apenas ARQUIVA. `DELETED` é outra coisa,
  // e é irreversível — a Meta não devolve esses objetos nas arestas de
  // listagem, então quem tem essa linha aqui é histórico nosso.
  ARCHIVED: {
    rotulo: "Arquivado",
    detalhe: 'Arquivado no Facebook — é o que acontece ao clicar em "excluir" lá. Não entrega, mas o histórico de gasto continua contando no Dashboard.',
    tom: "apagado",
  },
  DELETED: {
    rotulo: "Excluído",
    detalhe: "Excluído de verdade na Meta, sem desfazer. O gasto que já tinha acontecido continua no histórico.",
    tom: "apagado",
  },
};

const NAO_INFORMADO: Veiculacao = {
  cru: null,
  rotulo: "—",
  // ⚠️ NÃO dizer "não está veiculando". Nulo é ausência de informação, e a
  // causa mais provável é sincronização que ainda não rodou com este código.
  detalhe: "A Meta ainda não informou a veiculação desta linha. O próximo ciclo de sincronização preenche.",
  tom: "indefinido",
  cor: COR.indefinido,
  divergente: false,
  desconhecido: false,
};

/**
 * Traduz o par (`status` configurado, `effective_status`) para o selo da tela.
 *
 * ⚠️ **A divergência é calculada, não vem da Meta.** Ela é `configurado ACTIVE`
 * **e** `veiculação ≠ ACTIVE` — e só ela responde "por que minha campanha
 * ativa não está rodando".
 */
export function veiculacao(status: string, effectiveStatus: string | null | undefined): Veiculacao {
  const cru = effectiveStatus?.trim() || null;

  /**
   * ⚠️ **Quando o status configurado já é conclusivo, ele responde sozinho.**
   *
   * `PAUSED`, `ARCHIVED` e `DELETED` não têm ambiguidade: a entidade em si está
   * parada, não há o que o `effective_status` possa acrescentar. Só `ACTIVE`
   * (e `UNKNOWN`) precisam do campo da Meta para saber se entregam de verdade.
   *
   * Isto NÃO é conveniência de tela — é o que faz a aba "Arquivados" distinguir
   * arquivado de excluído. A Meta **não devolve objetos DELETED** em nenhuma
   * aresta de listagem, então essas linhas nunca vão receber
   * `effectiveStatus`. Sem este ramo, "Excluído" apareceria como "—" para
   * sempre.
   *
   * Também é o que dá uma tela útil ANTES do primeiro sync com o código novo:
   * o "—" fica só onde ele é a resposta honesta (linha ativa cuja entrega a
   * Meta ainda não informou).
   */
  if (!cru && status !== "ACTIVE" && MAPA[status]) {
    const conclusivo = MAPA[status]!;
    return {
      cru: null,
      rotulo: conclusivo.rotulo,
      detalhe: conclusivo.detalhe,
      tom: conclusivo.tom,
      cor: COR[conclusivo.tom],
      divergente: false,
      desconhecido: false,
    };
  }
  if (!cru) return NAO_INFORMADO;

  const conhecido = MAPA[cru];
  if (!conhecido) {
    return {
      cru,
      // Valor cru na tela, de propósito: é o que permite acrescentá-lo ao MAPA
      // sem precisar reproduzir o caso. Traduzir por chute seria pior.
      rotulo: cru,
      detalhe: "A Meta devolveu um estado que a Traffik ainda não traduz. O valor aparece como veio.",
      tom: "indefinido",
      cor: COR.indefinido,
      divergente: status === "ACTIVE",
      desconhecido: true,
    };
  }

  return {
    cru,
    rotulo: conhecido.rotulo,
    detalhe: conhecido.detalhe,
    tom: conhecido.tom,
    cor: COR[conhecido.tom],
    divergente: status === "ACTIVE" && cru !== "ACTIVE",
    desconhecido: false,
  };
}

/**
 * Quantas linhas estão configuradas como ativas e **não** entregam.
 *
 * Existe para a tela poder dizer isso de uma vez, em cima da tabela: um selo
 * âmbar por linha se perde numa lista de 40, e o usuário que está procurando
 * "por que não gastou nada" não vai rolar até achar.
 */
export function contarDivergentes(
  linhas: { status: string; effectiveStatus?: string | null }[],
): number {
  return linhas.filter((l) => veiculacao(l.status, l.effectiveStatus).divergente).length;
}
