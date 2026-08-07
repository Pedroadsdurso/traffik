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

/* ═══════════════════════════════════════════════════════════════════════════
   FLUXO COM PERDAS EXPLÍCITAS — a massa se conserva da esquerda para a direita
   ═══════════════════════════════════════════════════════════════════════════

   🔴 A FITA SOZINHA ESCONDIA A PERGUNTA. Ela afinava de 1.220 para 27, e os
   1.193 que sumiram **simplesmente não estavam em lugar nenhum do desenho**. O
   estreitamento diz QUE se perdeu; não diz QUANTO nem ONDE, e é isso que um
   funil existe para responder.

   Aqui quem sai vira **faixa própria, rotulada**. Em qualquer x vertical:

       fluxo que continua  +  todas as perdas até ali  =  a faixa inteira

   ⛔ A CONSERVAÇÃO É A PROPRIEDADE, e é ela que o `test:fluxo` verifica — não
   as coordenadas. Um teste de coordenada passa igual com uma faixa de perda
   desenhada com a espessura errada; a soma não.

   ### Por que as perdas empilham para BAIXO sem overlap

   A faixa de uma perda ocupa exatamente o intervalo entre a espessura do fluxo
   ANTES e DEPOIS dela: `[esp(i+1), esp(i)]`. Como `esp` só decresce, o intervalo
   da perda seguinte fica inteiro ACIMA do da anterior — elas se encaixam sem
   cálculo de empilhamento e sem poder se sobrepor. A altura total nunca muda. */

export interface PerdaFita {
  /** Índice da etapa de onde a perda sai. */
  de: number;
  /** Quantos se perderam entre `de` e `de + 1`. */
  valor: number;
  /** Deslocamento do topo da faixa até o TOPO da perda (= espessura do fluxo depois). */
  topo: number;
  /** Deslocamento até a BASE da perda (= espessura do fluxo antes). */
  base: number;
  x0: number;
  x1: number;
}

export interface Fluxo {
  etapas: EtapaFita[];
  perdas: PerdaFita[];
  /** Altura total da faixa, em px. Constante em todo x. */
  faixa: number;
}

/**
 * ⛔ O PISO MEXE NA ESPESSURA DO FLUXO, NUNCA NA DA PERDA — e a primeira versão
 * fazia o contrário, o que quebrava a conservação.
 *
 * As faixas não são independentes: cada perda é a DIFERENÇA entre a espessura do
 * fluxo antes e depois dela. Engrossar uma perda direto soma altura por cima do
 * total, e o desenho passa a prometer uma conservação que não vale. A primeira
 * tentativa compensava descontando "da maior perda" — e o teste aleatório achou
 * o caso em que isso não existe: com **uma perda só**, ela é a maior, e descontar
 * dela desfaz o piso que acabou de ser aplicado. `[967, 959]` somava 131,92.
 *
 * A correção é mexer na sequência que GERA as faixas: garantir, andando para a
 * frente, que cada etapa seja pelo menos `piso` mais fina que a anterior sempre
 * que houver perda entre elas. A soma continua sendo `esp[0]` por construção,
 * porque as faixas são diferenças da mesma sequência — não há o que compensar.
 *
 * ⚠️ Isso afina o FLUXO em alguns px. É a troca certa: no funil real o fluxo
 * final tem 2,9px e a perda 126px — 3px a menos na perda seriam imperceptíveis,
 * mas 3px a menos no fluxo o fariam sumir, e o fluxo é o que sobrevive.
 * Por isso o piso do fluxo (`calcularFita`) é respeitado como limite inferior.
 */
export function calcularFluxo(
  valores: number[],
  opcoes: { largura: number; faixa: number; margem?: number; piso?: number },
): Fluxo {
  const piso = opcoes.piso ?? PISO_ESPESSURA;
  const etapas = calcularFita(valores, opcoes);
  const faixa = opcoes.faixa;

  /* Abre espaço para cada perda afinando a etapa SEGUINTE. Andando para a
     frente: `esp[k+1]` nunca fica a menos de `piso` de `esp[k]` quando há
     perda entre as duas. */
  for (let i = 0; i < etapas.length - 1; i++) {
    const a = etapas[i]!;
    const b = etapas[i + 1]!;
    if (a.valor <= b.valor) continue;
    const teto = a.espessura - piso;
    // `b.valor > 0` mantém o piso do próprio fluxo: etapa não-vazia não some.
    const chao = b.valor > 0 ? Math.min(piso, Math.max(0, teto)) : 0;
    b.espessura = Math.max(chao, Math.min(b.espessura, teto));
  }

  const perdas: PerdaFita[] = [];
  for (let i = 0; i < etapas.length - 1; i++) {
    const a = etapas[i]!;
    const b = etapas[i + 1]!;
    // Etapa que CRESCE não é perda. Pode acontecer: cliques vêm da Meta e
    // checkouts vêm do pixel, e as duas fontes não se conversam.
    if (a.valor <= b.valor) continue;
    perdas.push({ de: i, valor: a.valor - b.valor, topo: b.espessura, base: a.espessura, x0: a.x, x1: b.x });
  }

  return { etapas, perdas, faixa };
}

/**
 * A faixa de UMA perda: nasce com espessura zero na guia de onde ela sai e
 * abre até a espessura cheia na guia seguinte, seguindo a MESMA curva da borda
 * de baixo do fluxo — é o que faz parecer que ela se descolou dele.
 *
 * Depois da guia seguinte ela segue reta até o fim do desenho, para caber o
 * rótulo sem o traço morrer no meio da frase.
 */
export function caminhoPerda(p: PerdaFita, yTopo: number, xFim: number): string {
  const meio = (p.x0 + p.x1) / 2;
  const topoY = yTopo + p.topo;
  const baseY = yTopo + p.base;
  // Sobe pela borda de baixo do fluxo (curva), segue reta, e fecha pela base.
  return (
    `M${p.x0.toFixed(2)},${baseY.toFixed(2)} ` +
    `C${meio.toFixed(2)},${baseY.toFixed(2)} ${meio.toFixed(2)},${topoY.toFixed(2)} ${p.x1.toFixed(2)},${topoY.toFixed(2)} ` +
    `L${xFim.toFixed(2)},${topoY.toFixed(2)} ` +
    `L${xFim.toFixed(2)},${baseY.toFixed(2)} Z`
  );
}

/**
 * O fluxo que CONTINUA: borda de cima reta no topo da faixa, borda de baixo
 * acompanhando a espessura de cada etapa.
 */
export function caminhoFluxo(etapas: EtapaFita[], yTopo: number): string {
  if (etapas.length === 0) return "";
  const ultimo = etapas[etapas.length - 1]!;
  const partes = [`M${etapas[0]!.x.toFixed(2)},${yTopo.toFixed(2)}`];
  partes.push(`L${ultimo.x.toFixed(2)},${yTopo.toFixed(2)}`);
  // Volta pela borda de baixo, da direita para a esquerda.
  const inverso = [...etapas].reverse();
  inverso.forEach((e, i) => {
    const y = yTopo + e.espessura;
    if (i === 0) {
      partes.push(`L${e.x.toFixed(2)},${y.toFixed(2)}`);
      return;
    }
    const ant = inverso[i - 1]!;
    const meio = (ant.x + e.x) / 2;
    partes.push(
      `C${meio.toFixed(2)},${(yTopo + ant.espessura).toFixed(2)} ${meio.toFixed(2)},${y.toFixed(2)} ${e.x.toFixed(2)},${y.toFixed(2)}`,
    );
  });
  partes.push("Z");
  return partes.join(" ");
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
