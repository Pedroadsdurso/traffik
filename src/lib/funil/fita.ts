/**
 * A GEOMETRIA DA FITA DO FUNIL — pura, sem React e sem SVG.
 *
 * Referência literal: `docs/design/referencias/16-funil-referencia.png`.
 *
 * ## 🔴 A PERDA NÃO É DESENHADA — ela é NÚMERO
 *
 * As cinco versões anteriores desenhavam a perda como faixa cinza encostada no
 * fluxo. Com um funil de 97% de queda isso dá **97% da área do bloco pintada de
 * cinza**, com o fluxo virando um fio dentro dela. A figura fica pesada, e o
 * cinza — que é ausência — vira o sujeito visual.
 *
 * Aqui o fundo é fundo. Só a fita é desenhada, e a perda aparece como pílula
 * (`−1.185 · 97,1%`) na guia da transição. Quem responde "quanto se perdeu" é o
 * número, com precisão total; quem responde "para onde isto vai" é a forma.
 *
 * ## 🔴 ESPESSURA FIEL, COM PISO DE 3px — e os 10px foram REVERTIDOS
 *
 * Houve uma versão de 07/08/2026 com piso de 10px, e o argumento era que a
 * pílula não cabe sobre uma fita de 4px. **O dono recusou, e estava certo:**
 * 35/1220 é 2,9%, que num topo de 132px dá 3,8px. Um piso de 10px desenha isso
 * como ~7,6% — quase o triplo. É a mesma mentira que fez a raiz quadrada ser
 * rejeitada, com outro nome.
 *
 * ⛔ **A legibilidade da etiqueta não se paga com a espessura da fita.** Se
 * pagasse, o bloco deixaria de responder "quanto sobrou", que é a única
 * pergunta que ele existe para responder. O conflito se resolve do outro lado:
 * a pílula que não couber SAI de cima da fita e é ancorada fora, com um traço
 * curto ligando — ver `FitaFunil`.
 *
 * O piso de 3px continua, e o papel dele é o de sempre: uma etapa NÃO VAZIA não
 * pode sumir da tela. Com faixa de 132px ele só entra abaixo de ~2,3%.
 */

/**
 * Espessura mínima, em px, de uma etapa **não vazia**.
 *
 * ⚠️ ELE NÃO FABRICA DADO, e a distinção é a mesma que condenou o `|| 1` do
 * `srcTotal`: aquele **inventava um denominador** e produzia um percentual
 * sobre uma unidade que não existe. Este garante que uma etapa medida não suma
 * da tela — e o valor exato está escrito embaixo dela, em número.
 *
 * ⛔ 3px, não 10. Ver a nota de reversão no topo do arquivo antes de subir.
 */
export const PISO_ESPESSURA = 3;

export interface EtapaFita {
  /** O valor cru da etapa. */
  valor: number;
  /** Espessura em px, já com o piso aplicado. `0` só quando o valor é `0`. */
  espessura: number;
  /**
   * Centro X da etapa, em px.
   *
   * ⚠️ É o CENTRO de uma faixa, não uma guia. As guias ficam ENTRE as etapas —
   * ver `guias`. A referência põe o nome, a pílula e o número absoluto todos
   * neste x, e a pílula de perda na guia ao lado.
   */
  x: number;
  /**
   * Conversão em relação à etapa ANTERIOR, de 0 a 1. `null` na primeira (não há
   * de onde cair) e quando a anterior é zero.
   *
   * ⛔ `null` é INDEFINIDO, não zero — é a mesma regra do `div()` do projeto.
   */
  taxa: number | null;
  /**
   * Fração do MAIOR valor do funil, de 0 a 1. É o que a pílula sobre a fita
   * mostra.
   *
   * ⚠️ Fração do máximo, **não** conversão da etapa anterior — conferido na
   * referência: `444/861 = 51,6%`, `165/861 = 19,2%`, `12/861 = 1,4%`. As duas
   * coincidem quando o funil só cai, e divergem no instante em que uma etapa
   * cresce (que é o caso da própria referência, 444 → 861).
   */
  fracao: number | null;
}

/**
 * Uma perda entre duas etapas. **Dado, não geometria** — ela não tem espessura
 * nem caminho, porque não é desenhada.
 */
export interface PerdaFita {
  /** Índice da etapa de onde a perda sai. */
  de: number;
  /** Quantos se perderam entre `de` e `de + 1`. Sempre positivo. */
  valor: number;
  /**
   * A perda como fração da etapa de origem, de 0 a 1. `null` se a origem é
   * zero — não se divide por ausência.
   */
  pct: number | null;
  /** X da guia entre as duas etapas: é onde a pílula se ancora. */
  x: number;
}

export interface Fluxo {
  etapas: EtapaFita[];
  perdas: PerdaFita[];
  /** X de cada guia vertical. Há `n - 1` delas, uma entre cada par de etapas. */
  guias: number[];
  /** Altura total disponível para a fita, em px. */
  faixa: number;
}

/**
 * Calcula espessuras, centros e guias.
 *
 * ⚠️ A escala é sobre o MAIOR valor, não sobre o primeiro. Fontes independentes
 * podem fazer uma etapa crescer (os `cliques` vêm da Meta, os `checkouts` vêm do
 * pixel) — e com o primeiro no denominador a fita estouraria a faixa em
 * silêncio. A referência é exatamente esse caso: 444 cliques e 861 visitas.
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
  const n = finitos.length;

  return finitos.map((valor, i) => {
    /* Centro da faixa da etapa, não a borda: com `n` etapas o eixo se divide em
       `n` colunas iguais e cada etapa mora no meio da sua. É o que deixa espaço
       para a guia cair exatamente entre duas. */
    const x = margem + (n > 0 ? ((i + 0.5) * util) / n : 0);
    const bruta = maior > 0 ? (valor / maior) * faixa : 0;
    return {
      valor,
      espessura: valor > 0 ? Math.max(piso, bruta) : 0,
      x,
      taxa: null,
      fracao: maior > 0 ? valor / maior : null,
    };
  });
}

/** Onde cai a guia entre a etapa `i` e a `i + 1`. */
function guiaEntre(largura: number, margem: number, n: number, i: number): number {
  const util = Math.max(0, largura - margem * 2);
  return margem + ((i + 1) * util) / n;
}

export function calcularFluxo(
  valores: number[],
  opcoes: { largura: number; faixa: number; margem?: number; piso?: number },
): Fluxo {
  const margem = opcoes.margem ?? 0;
  const etapas = calcularFita(valores, opcoes);
  const n = etapas.length;

  for (let i = 1; i < n; i++) {
    const ant = etapas[i - 1]!;
    etapas[i]!.taxa = ant.valor > 0 ? etapas[i]!.valor / ant.valor : null;
  }

  const guias: number[] = [];
  for (let i = 0; i < n - 1; i++) guias.push(guiaEntre(opcoes.largura, margem, n, i));

  const perdas: PerdaFita[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = etapas[i]!;
    const b = etapas[i + 1]!;
    /* Etapa que CRESCE não é perda, e a referência confirma que isto é o
       comportamento certo: entre Cliques (444) e Vis. Página (861) ela não
       desenha pílula nenhuma. */
    if (a.valor <= b.valor) continue;
    perdas.push({
      de: i,
      valor: a.valor - b.valor,
      pct: a.valor > 0 ? (a.valor - b.valor) / a.valor : null,
      x: guias[i]!,
    });
  }

  return { etapas, perdas, guias, faixa: opcoes.faixa };
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
 *
 * 🔴 CENTRADA, e é o que resolveu o vetor de leitura (07/08/2026). Ancorada no
 * topo, a borda de baixo SÓ PODE SUBIR conforme a fita afina — e linha que sobe
 * lê como crescimento, o oposto do que um funil diz. Centrada, a borda de cima
 * desce e a de baixo sobe: a figura CONVERGE, e convergência lê como
 * estreitamento em qualquer direção de leitura.
 *
 * ⚠️ `x0` e `x1` estendem a fita até as bordas do desenho, com a espessura da
 * primeira e da última etapa. Sem isso ela começaria e terminaria no ar, no
 * meio da primeira e da última coluna.
 */
export function caminhoDaFita(
  etapas: EtapaFita[],
  centroY: number,
  extremos?: { x0: number; x1: number },
): string {
  if (etapas.length === 0) return "";

  const primeiro = etapas[0]!;
  const ultimo = etapas[etapas.length - 1]!;
  const pontos: EtapaFita[] = [
    ...(extremos ? [{ ...primeiro, x: extremos.x0 }] : []),
    ...etapas,
    ...(extremos ? [{ ...ultimo, x: extremos.x1 }] : []),
  ];

  const y = (e: EtapaFita, lado: 1 | -1) => centroY + (lado * e.espessura) / 2;
  const partes: string[] = [];

  const traco = (lado: 1 | -1, ordem: EtapaFita[]) => {
    ordem.forEach((e, i) => {
      if (i === 0) {
        partes.push(`${partes.length === 0 ? "M" : "L"}${e.x.toFixed(2)},${y(e, lado).toFixed(2)}`);
        return;
      }
      const ant = ordem[i - 1]!;
      const meio = (ant.x + e.x) / 2;
      partes.push(
        `C${meio.toFixed(2)},${y(ant, lado).toFixed(2)} ${meio.toFixed(2)},${y(e, lado).toFixed(2)} ${e.x.toFixed(2)},${y(e, lado).toFixed(2)}`,
      );
    });
  };

  traco(-1, pontos);
  traco(1, [...pontos].reverse());
  partes.push("Z");
  return partes.join(" ");
}
