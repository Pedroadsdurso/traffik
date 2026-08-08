import type { Medicao } from "./overview";

/**
 * # 🕳️ O QUE A TABELA TEM PERMISSÃO DE AFIRMAR SOBRE UMA LINHA
 *
 * A distinção central deste projeto — **ausência de observação ≠ observação de
 * zero** — aplicada à célula. Aqui ela é uma função pura, e não um ternário
 * espalhado por dezenove colunas.
 *
 * ## O caso que produziu o arquivo
 *
 * `R$ 0,00` na coluna Gasto de uma campanha que **nunca sincronizou** é a tela
 * afirmando "a Meta cobrou zero" sobre algo que ninguém mediu. Quem lê conclui
 * que a campanha está de graça; o que houve foi não existir linha nenhuma de
 * `DailyAdMetric` para ela.
 *
 * ⛔ **E o CPA é pior que o Gasto.** `div(0, 5)` devolve `0` — denominador
 * positivo, resultado legítimo —, então uma campanha sem medição com cinco
 * vendas atribuídas mostraria **`R$ 0,00` por venda**. O `div()` está certo: o
 * defeito não é da conta, é de exibir uma conta cujo numerador não foi
 * observado.
 *
 * ## A regra, em uma linha
 *
 * **Sem medição, some tudo o que veio da Meta — e tudo o que foi calculado a
 * partir dela. O que o nosso rastreamento mediu continua.**
 *
 * | Fonte | Colunas | Sem medição |
 * |---|---|---|
 * | `meta` | Gasto, Impressões, Cliques, Orçamento… | **`—`** |
 * | `misto` | CPA, ROAS, ROI, Lucro, CPC, CPM, CPI, CTR | **`—`** |
 * | `nosso` | Vendas, Faturamento, IC, Cliq. atr., Vend. inic. | o valor |
 *
 * ⚠️ **CTR é `meta`, não é derivada nossa**: cliques ÷ impressões, as duas do
 * mesmo `DailyAdMetric`. Sem a linha, nenhuma das duas existe.
 *
 * ⛔ **NENHUM CÁLCULO MUDA AQUI.** `sumAds` continua reduzindo a partir de
 * `{ spend: 0 }`, `derivar()` continua devolvendo o que devolvia, e o total do
 * rodapé continua somando o que sempre somou. O que esta função decide é o que a
 * célula IMPRIME — mesma solução da linha de base do ROAS: conta intocada, tela
 * honesta.
 */

/** De onde vem o número de uma coluna. Ver a tabela acima. */
export type FonteDaColuna = "meta" | "nosso" | "misto";

/**
 * A linha sustenta uma afirmação sobre esta coluna?
 *
 * `medida` é a única que sustenta tudo — e ali `spend: 0` é uma medição de
 * verdade ("a Meta reportou zero"), que continua imprimindo `R$ 0,00`. É a
 * terceira coluna da tabela dos três estados, e o motivo de eles serem três.
 */
export function podeAfirmar(fonte: FonteDaColuna, medicao: Medicao): boolean {
  return medicao === "medida" || fonte === "nosso";
}

/**
 * Por que a célula está vazia — vai no `title` do `—`.
 *
 * ⚠️ As duas ausências pedem AÇÕES DIFERENTES, e é por isso que o texto não é
 * um só: na primeira o usuário tem o que conferir (a integração), na segunda
 * não há o que fazer. Um "sem dados" genérico devolveria a mesma resposta para
 * as duas perguntas.
 */
export const MOTIVO_SEM_MEDICAO: Record<Exclude<Medicao, "medida">, string> = {
  "nunca-sincronizada":
    "A Trackhub nunca recebeu métrica desta linha. Confira a conexão em Integrações › Anúncios — enquanto não sincronizar, os números da Meta não existem aqui.",
  "sem-veiculacao":
    "Ela sincroniza normalmente e não teve veiculação neste período. Não há o que corrigir — troque o período para ver os dias em que rodou.",
};

/**
 * O selo `não sincronizado` da linha.
 *
 * ⚠️ Só a PRIMEIRA ausência ganha selo. "Não veiculou no período" é o estado
 * normal de metade das campanhas de qualquer conta — marcá-lo encheria a tabela
 * de um aviso que não pede ação. O `—` da célula, com o `title`, já responde.
 */
export function precisaDeSelo(medicao: Medicao): boolean {
  return medicao === "nunca-sincronizada";
}
