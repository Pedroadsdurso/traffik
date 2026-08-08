import { div } from "./metrics";
import type { Medicao } from "./overview";

/**
 * # Insights — a tela dizendo o que ela achou
 *
 * O painel que o `03` pede e que hoje não existe: *"melhor campanha, maior
 * volume de conversões, menor custo por conversão, e N campanhas com ROAS
 * abaixo de 1,5x"*. É a tela dizendo o que ela achou, em vez de esperar você
 * achar.
 *
 * ## ⛔ ELE LÊ `effectiveStatus`, NUNCA `status` — e isso gasta dinheiro
 *
 * `status` é o que o usuário CONFIGUROU; `effectiveStatus` é o que a Meta está
 * de fato ENTREGANDO. No banco de dev, `Retargeting 7d` tem **o melhor ROAS da
 * tela (11,10x)** com `status: ACTIVE` e `effectiveStatus: CAMPAIGN_PAUSED`.
 * Um painel filtrando por `status` recomendaria **escalar a campanha que não
 * entrega** — exatamente a única que ele não deve recomendar.
 *
 * A regra do CLAUDE.md: **decisão** (recomendar, alertar, ranquear) lê o
 * EFETIVO; **exibição do que o usuário escolheu** (o toggle) lê o configurado.
 *
 * ⚠️ O filtro `Ativas` da tabela lê o CONFIGURADO, e continua assim — é o que o
 * Gerenciador da Meta faz e é anterior à branch. Os dois convivem de propósito:
 * a tabela LISTA, o Insights RECOMENDA. Quem um dia "unificar" para eliminar a
 * divergência reintroduz o defeito no lado em que ele custa dinheiro.
 *
 * ## E ele lê `medicao === "medida"`
 *
 * Uma campanha nunca sincronizada tem `spend: 0` porque não existe linha, não
 * porque foi barata. Sem este filtro ela ganharia **todos** os rankings de
 * custo de uma vez: menor CPA, menor CPC, melhor ROAS — todos com denominador
 * que ninguém observou.
 */

/** O que uma linha precisa ter para entrar na análise. */
export interface LinhaParaInsight {
  id: string;
  nome: string;
  status: string;
  effectiveStatus: string | null;
  medicao: Medicao;
  spend: number;
  revenue: number;
  results: number;
}

export type TomInsight = "success" | "primary" | "warning" | "neutral";

export interface Insight {
  /** Identifica o cartão. O ícone é escolhido por ela, na camada de tela. */
  chave: "melhor-roas" | "mais-conversoes" | "menor-cpa" | "atencao" | "parada-boa";
  titulo: string;
  /** O nome da campanha, quando o cartão aponta para uma. */
  campanha?: string;
  /** A linha de baixo — o número que sustenta a afirmação. */
  detalhe: string;
  tom: TomInsight;
}

/**
 * O ROAS abaixo do qual a campanha entra no cartão de atenção.
 *
 * ⚠️ **1,5x é o número da referência, e é um LIMIAR DE MARGEM, não de
 * equilíbrio.** O equilíbrio do ROAS é 1,0x (cada real de anúncio devolveu um
 * real); 1,5x é onde ainda sobra alguma coisa depois de taxa, imposto e produto
 * — que o ROAS de mídia não desconta. Ver `corFinanceira`, que usa 1,0x porque
 * responde outra pergunta (deu prejuízo?), não esta (vale a pena?).
 */
export const ROAS_DE_ATENCAO = 1.5;

const fmtRoas = (n: number) => `${n.toFixed(2).replace(".", ",")}x`;
const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** A melhor linha por um critério, ignorando quem não tem o número. */
function melhorPor<T>(linhas: T[], valor: (l: T) => number | null, maior: boolean): [T, number] | null {
  let campea: [T, number] | null = null;
  for (const l of linhas) {
    const v = valor(l);
    if (v === null) continue;
    if (!campea || (maior ? v > campea[1] : v < campea[1])) campea = [l, v];
  }
  return campea;
}

/**
 * Os cartões do painel, na ordem em que aparecem.
 *
 * ⚠️ Um cartão que não tem o que dizer **não vira um cartão vazio** — ele sai da
 * lista. "Menor custo por conversão: —" ocupa a mesma altura e não afirma nada.
 * O painel inteiro sumindo é o estado vazio, e quem o desenha é a tela.
 */
export function calcularInsights(linhas: LinhaParaInsight[]): Insight[] {
  /* ⛔ VEICULANDO **e** MEDIDA. Ver os dois blocos do cabeçalho: o primeiro
     impede recomendar o que não entrega; o segundo, ranquear o que ninguém
     mediu. */
  const elegiveis = linhas.filter((l) => l.effectiveStatus === "ACTIVE" && l.medicao === "medida");
  const cartoes: Insight[] = [];

  const roas = (l: LinhaParaInsight) => div(l.revenue, l.spend);
  const melhorRoas = melhorPor(elegiveis, roas, true);
  if (melhorRoas) {
    cartoes.push({
      chave: "melhor-roas",
      titulo: "Melhor campanha",
      campanha: melhorRoas[0].nome,
      detalhe: `ROAS de ${fmtRoas(melhorRoas[1])}`,
      tom: "success",
    });
  }

  const maisConversoes = melhorPor(elegiveis, (l) => (l.results > 0 ? l.results : null), true);
  if (maisConversoes) {
    cartoes.push({
      chave: "mais-conversoes",
      titulo: "Maior volume de conversões",
      campanha: maisConversoes[0].nome,
      detalhe: `${maisConversoes[1].toLocaleString("pt-BR")} ${maisConversoes[1] === 1 ? "venda" : "vendas"}`,
      tom: "primary",
    });
  }

  /* `div` devolve `null` sem conversão, então quem não vendeu não disputa o
     "menor custo" — que era o jeito de uma campanha sem venda nenhuma ganhar
     com CPA zero. */
  const menorCpa = melhorPor(elegiveis, (l) => div(l.spend, l.results), false);
  if (menorCpa) {
    cartoes.push({
      chave: "menor-cpa",
      titulo: "Menor custo por conversão",
      campanha: menorCpa[0].nome,
      detalhe: `${fmtBrl(menorCpa[1])} por venda`,
      tom: "primary",
    });
  }

  /* ⚠️ O cartão de atenção fica MESMO COM ZERO, e vira uma afirmação positiva.
     Ele é o único que fala do conjunto, e sumir quando está tudo bem faria o
     painel encolher justamente no dia em que a resposta é boa — o usuário não
     saberia se ninguém está abaixo do limiar ou se a análise não rodou. */
  if (elegiveis.length > 0) {
    const abaixo = elegiveis.filter((l) => {
      const r = roas(l);
      return r !== null && r < ROAS_DE_ATENCAO;
    }).length;
    cartoes.push({
      chave: "atencao",
      titulo: abaixo > 0 ? "Atenção necessária" : "Nada abaixo do limiar",
      detalhe:
        abaixo > 0
          ? `${abaixo} ${abaixo === 1 ? "campanha" : "campanhas"} com ROAS abaixo de ${fmtRoas(ROAS_DE_ATENCAO)}`
          : `Todas as veiculando estão acima de ${fmtRoas(ROAS_DE_ATENCAO)}`,
      tom: abaixo > 0 ? "warning" : "neutral",
    });
  }

  /**
   * ## O 5º cartão — condicional, e a condição é o que o torna um insight
   *
   * A melhor campanha da tela está PARADA. Ele só entra quando o ROAS dela
   * supera o melhor entre as que veiculam — senão seria só "eis uma campanha
   * pausada", que a tabela já lista e ninguém precisa de cartão para ver.
   *
   * ⚠️ Ele lê `medicao === "medida"` também: uma pausada que nunca sincronizou
   * tem ROAS indefinido, não excelente.
   */
  const paradas = linhas.filter((l) => l.effectiveStatus !== "ACTIVE" && l.medicao === "medida");
  const melhorParada = melhorPor(paradas, roas, true);
  if (melhorParada && melhorParada[1] > (melhorRoas?.[1] ?? 0)) {
    cartoes.push({
      chave: "parada-boa",
      titulo: "A melhor da tela não está entregando",
      campanha: melhorParada[0].nome,
      detalhe: `ROAS de ${fmtRoas(melhorParada[1])}, e ela não veicula`,
      tom: "warning",
    });
  }

  return cartoes;
}
