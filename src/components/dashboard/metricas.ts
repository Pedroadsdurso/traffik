/**
 * AS MÉTRICAS COMO METADADO — rótulo, descrição e o peso com que cada uma nasce.
 *
 * 🔴 ELE EXISTE PORQUE A F5 ACABOU COM AS ZONAS (12/08/2026).
 *
 * Até aqui, "métrica" e "painel" eram coisas de naturezas diferentes: painel
 * vivia no `CATALOGO_META` com largura e mínimo próprios; métrica vivia numa
 * lista de STRINGS (`hero`, `faixa`) cujo único metadado — o rótulo — estava
 * dentro do `useTraffikState`. Com a grade única as duas viram o mesmo objeto, e
 * a métrica passa a precisar do mesmo cartão de identidade que o painel sempre
 * teve.
 *
 * ⛔ **O RÓTULO NÃO PODE SER COPIADO PARA CÁ.** Ele já existe no hook, que é
 * quem desenha o número, e duas listas de nome para a mesma métrica divergem no
 * primeiro commit que renomear uma — com o catálogo lateral oferecendo
 * "Faturamento" e o card mostrando outra coisa. Então a direção é a inversa:
 * **o hook lê daqui**. É a mesma jogada do `scriptDoPixel`, e o mesmo motivo:
 * uma conta, um lugar.
 *
 * ⚠️ Este arquivo é PURO de propósito — sem React, sem Prisma. O catálogo e a
 * migração são testados com `--experimental-strip-types`, que não lê `.tsx`, e
 * metadado que só um componente pode ler é metadado que nenhum teste alcança.
 */

import type { MetricKey } from "./types";

export interface MetaMetrica {
  chave: MetricKey;
  /** O nome na tela. **Fonte única** — o `useTraffikState` importa daqui. */
  rotulo: string;
  /** Uma linha dizendo o que ela responde. Vai para o catálogo lateral. */
  descricao: string;
  /**
   * 🔴 NASCE COM DUAS CÉLULAS DE ALTURA — a leitura "hero" do `06`.
   *
   * ⛔ Não é uma segunda categoria de bloco, e a distinção morreu com as zonas:
   * KPI hero e métrica compacta são **o mesmo objeto**, e o que os separa é o
   * `hPadrao` do catálogo (2 × 1) e, na tela, a ALTURA do slot. Um `destaque`
   * arrastado para uma célula de altura 1 desenha compacto; uma métrica comum
   * esticada para duas desenha o sparkline. Ninguém precisa saber disso.
   *
   * ⚠️ Os quatro marcados são os que o layout padrão põe na primeira fileira, e
   * é só isso que a marca decide: **o padrão de conta nova**. Ela não trava
   * nada, não aparece na tela e não impede o usuário de escolher outra coisa.
   */
  destaque?: true;
}

/**
 * 🔴 A ORDEM AQUI É A DO CATÁLOGO LATERAL, e ela é de leitura: dinheiro que
 * entrou → o que sobrou → o que custou → eficiência → volume → pendências.
 *
 * ⛔ Ela **não** é o layout padrão. Quem decide o arranjo de conta nova é
 * `PADRAO_DA_GRADE`, em `layout/migrar.ts`, e a separação existe porque derivar
 * o padrão desta ordem foi exatamente o defeito que o arranjo explícito
 * consertou: a tela vira a soma de decisões locais e nenhuma fileira fecha 12.
 */
export const METRICAS = [
  { chave: "faturamento", rotulo: "Faturamento", descricao: "Tudo que entrou, sem descontar nada", destaque: true },
  { chave: "gasto", rotulo: "Gasto total", descricao: "Quanto os anúncios consumiram no período", destaque: true },
  { chave: "roas", rotulo: "ROAS", descricao: "Quantas vezes o gasto voltou em receita", destaque: true },
  { chave: "lucroLiquido", rotulo: "Lucro", descricao: "O que sobra depois de anúncios e despesas", destaque: true },

  { chave: "liquido", rotulo: "Faturamento líquido", descricao: "Bruto menos gateway, coprodução, imposto e custo" },
  { chave: "margem", rotulo: "Margem de lucro", descricao: "Que fatia do faturamento virou lucro" },
  { chave: "roi", rotulo: "ROI", descricao: "O retorno sobre o que foi investido" },
  { chave: "cpa", rotulo: "CPA", descricao: "Quanto custou cada venda" },
  { chave: "ticket", rotulo: "Ticket médio", descricao: "Quanto vale a venda média" },
  { chave: "arpu", rotulo: "ARPU", descricao: "Receita média por comprador" },
  { chave: "ctr", rotulo: "CTR", descricao: "Que fração de quem viu o anúncio clicou" },
  { chave: "vendas", rotulo: "Vendas", descricao: "Quantas vendas aprovadas no período" },
  { chave: "pendentes", rotulo: "Vendas pendentes", descricao: "Quanto dinheiro está aguardando pagamento" },
  { chave: "reembolsadas", rotulo: "Reembolsadas", descricao: "Quantas vendas foram devolvidas" },
  { chave: "chargeback", rotulo: "Taxa de chargeback", descricao: "Que fatia dos eventos de venda foi contestada" },
] as const satisfies readonly MetaMetrica[];

/** As chaves, derivadas da lista. É o que o `Record` do hook precisa cobrir. */
export type ChaveDeMetrica = (typeof METRICAS)[number]["chave"];

/**
 * 🔑 O PREFIXO QUE SEPARA MÉTRICA DE PAINEL NUM ESPAÇO DE ID SÓ.
 *
 * ⛔ Ele não é decoração: com a grade única, `faturamento` e `funil` passam a
 * viver na MESMA lista salva, e um id de métrica que colidisse com um id de
 * painel faria a leitura desenhar o bloco errado — em silêncio, porque as duas
 * coisas são strings válidas. O prefixo torna a colisão impossível em vez de
 * improvável.
 *
 * ⚠️ **`kpi:` era o prefixo do grid de 2026-07**, e ele NÃO foi reaproveitado:
 * aquele id significava "um KPI hero do grid antigo", que é justamente a
 * categoria que a F5 dissolveu. Reusá-lo faria um envelope v1 e um v5 usarem o
 * mesmo literal para coisas com contratos diferentes — o erro do `inicioDaFita`,
 * na camada de persistência.
 */
export const PREFIXO_METRICA = "metrica:";

export type IdMetrica = `${typeof PREFIXO_METRICA}${ChaveDeMetrica}`;

export function idDaMetrica(chave: ChaveDeMetrica): IdMetrica {
  return `${PREFIXO_METRICA}${chave}`;
}

/** A chave de um id de bloco, ou `undefined` quando o bloco não é métrica. */
export function chaveDoId(id: string): ChaveDeMetrica | undefined {
  if (!id.startsWith(PREFIXO_METRICA)) return undefined;
  const chave = id.slice(PREFIXO_METRICA.length);
  return METRICAS.some((m) => m.chave === chave) ? (chave as ChaveDeMetrica) : undefined;
}

export function metaDaMetrica(chave: string): MetaMetrica | undefined {
  return (METRICAS as readonly MetaMetrica[]).find((m) => m.chave === chave);
}

/**
 * Os rótulos por chave — o formato que o `useTraffikState` consome.
 *
 * ⚠️ Derivado da lista, nunca escrito duas vezes. Uma métrica nova no `METRICAS`
 * aparece aqui sozinha; se ela ficasse de fora, o `Record<MetricKey, …>` do hook
 * é que reprovaria — no compilador, não na tela.
 */
export const ROTULO_DA_METRICA = Object.fromEntries(
  METRICAS.map((m) => [m.chave, m.rotulo]),
) as Record<ChaveDeMetrica, string>;
