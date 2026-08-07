/**
 * A GEOMETRIA DA FITA DO FUNIL — pura, sem React e sem SVG.
 *
 * 🔴 ESPESSURA FIEL, e a decisão é do dono (07/08/2026) contra a preferência
 * inicial dele. O argumento que a virou:
 *
 * A raiz quadrada — que esta base já usa no heatmap e nas colunas do globo —
 * comprime a escala. Ali isso é legítimo: o leitor pergunta *"qual célula é
 * maior?"*, e a raiz muda o quanto uma célula **grita** preservando a ordem.
 *
 * Na fita a pergunta é outra: *"que fração sobrevive?"*. E a razão entre
 * espessuras **É** a resposta. Comprimi-la não comprime a escala — responde
 * outra coisa. Com o funil real do dono (1.220 → 35 → 27), `√(35/1220) = 0,169`
 * desenharia o checkout com a espessura de uma etapa de **17%**, seis vezes a
 * conversão que existe.
 *
 * E os modos de falha não empatam:
 *
 * | | Como falha |
 * |---|---|
 * | **fiel** | a fita vira um fio — e "quase ninguém passa" é a conclusão CERTA |
 * | raiz | a fita parece moderada, e só a pílula corrige — número plausível e errado |
 *
 * ⛔ Não troque por raiz, log ou qualquer compressão sem reabrir este parágrafo.
 */

/**
 * Espessura mínima, em px, de uma etapa **não vazia**.
 *
 * ⚠️ ELE NÃO FABRICA DADO, e a distinção é a mesma que condenou o `|| 1` do
 * `srcTotal`: **aquele inventava um denominador** — com todas as fontes zeradas,
 * `x.total / 1` saía `0%`, um percentual calculado sobre uma unidade que não
 * existe. **Este garante que uma etapa não-vazia não suma da tela.** Um afirma o
 * que não foi medido; o outro preserva a visibilidade do que foi.
 *
 * Com o piso em 3px e a faixa em 140px, ele só entra abaixo de ~2,1% — então no
 * funil de 2,9% do dono **ele não dispara**. O caso que o faz disparar está em
 * `npm run test:fita`, porque guarda que nunca disparou não é guarda.
 */
export const PISO_ESPESSURA = 3;

export interface EtapaFita {
  /** O valor cru da etapa. */
  valor: number;
  /** Espessura em px, já com o piso aplicado. `0` só quando o valor é `0`. */
  espessura: number;
  /** Centro X da guia desta etapa, em px. */
  x: number;
  /**
   * Conversão em relação à etapa ANTERIOR, de 0 a 1. `null` na primeira (não há
   * de onde cair) e quando a anterior é zero.
   *
   * ⛔ `null` é INDEFINIDO, não zero — é a mesma regra do `div()` do projeto.
   * "0%" afirma que todo mundo caiu fora; sem etapa anterior não houve queda.
   */
  taxa: number | null;
}

/**
 * Calcula as espessuras e as posições das guias.
 *
 * ⚠️ A escala é sobre o MAIOR valor, não sobre o primeiro. Numa fita as duas
 * coincidem quase sempre, mas fontes independentes podem fazer uma etapa crescer
 * (o `checkouts` vem do pixel, os `cliques` vêm da Meta) — e com o primeiro no
 * denominador a fita estouraria a faixa em silêncio.
 */
export function calcularFita(
  valores: number[],
  opcoes: { largura: number; faixa: number; margem?: number; piso?: number },
): EtapaFita[] {
  const { largura, faixa } = opcoes;
  const margem = opcoes.margem ?? 0;
  const piso = opcoes.piso ?? PISO_ESPESSURA;

  const finitos = valores.map((n) => (Number.isFinite(n) && n > 0 ? n : 0));
  const maior = Math.max(0, ...finitos);
  const util = Math.max(0, largura - margem * 2);
  const passo = valores.length > 1 ? util / (valores.length - 1) : 0;

  return finitos.map((valor, i) => {
    const bruta = maior > 0 ? (valor / maior) * faixa : 0;
    return {
      valor,
      /* ⛔ `valor > 0` antes do piso: etapa ZERO desenha espessura zero, e é o
         desenho certo. Aplicar o piso ali daria a uma etapa vazia a mesma
         espessura de uma quase vazia — colapsando "ninguém passou" com "quase
         ninguém passou", que é a distinção central deste projeto. */
      espessura: valor > 0 ? Math.max(piso, bruta) : 0,
      x: margem + passo * i,
      taxa: i === 0 || finitos[i - 1]! <= 0 ? null : valor / finitos[i - 1]!,
    };
  });
}

/**
 * O contorno da fita, como um `d` de `<path>` fechado.
 *
 * A borda de cima vai da esquerda para a direita e a de baixo volta, espelhada
 * na linha do centro. Entre etapas é uma cúbica com os controles no MEIO do vão
 * — é a curva que faz parecer fluxo em vez de gráfico de área.
 *
 * ⚠️ Controle no meio do vão (e não a 1/3) é o que dá a tangente horizontal em
 * cada guia. Sem isso a fita chega torta na etapa e o estreitamento parece
 * começar antes de onde começa.
 */
export function caminhoDaFita(etapas: EtapaFita[], centroY: number): string {
  if (etapas.length === 0) return "";

  const y = (e: EtapaFita, lado: 1 | -1) => centroY + (lado * e.espessura) / 2;
  const partes: string[] = [];

  const traco = (lado: 1 | -1, ordem: EtapaFita[]) => {
    ordem.forEach((e, i) => {
      if (i === 0) {
        partes.push(`${partes.length === 0 ? "M" : "L"}${e.x},${y(e, lado)}`);
        return;
      }
      const ant = ordem[i - 1]!;
      const meio = (ant.x + e.x) / 2;
      partes.push(`C${meio},${y(ant, lado)} ${meio},${y(e, lado)} ${e.x},${y(e, lado)}`);
    });
  };

  traco(-1, etapas);
  traco(1, [...etapas].reverse());
  partes.push("Z");
  return partes.join(" ");
}
