/**
 * curva.ts — o traçado suave das séries temporais. **Fonte única.**
 *
 * ⛔ NÃO ESCREVA OUTRO SUAVIZADOR. Dois desenhos da mesma série divergem sempre,
 * e aqui a divergência seria invisível: as duas curvas passam pelos mesmos
 * pontos e só discordam ENTRE eles, que é exatamente onde ninguém confere. O
 * `Sparkline` e o `LineChart` importam esta função.
 *
 * ## Por que monotônica, e não Catmull-Rom
 *
 * O `06` §3 pede "monotônica suavizada, nunca polilinha de vértices duros". O
 * adjetivo não é enfeite — é o que separa uma curva utilizável de uma que mente.
 *
 * A suavização ingênua (Catmull-Rom, ou qualquer tangente por diferença
 * central) faz a curva **ultrapassar** os pontos que a geraram. Numa série de
 * faturamento `[0, 0, 4200, 0]` a curva desceria ABAIXO DE ZERO entre o terceiro
 * e o quarto dia, desenhando um prejuízo que não existe em dado nenhum. Numa
 * ferramenta de atribuição isso é a mesma família do arco no globo: decoração se
 * passando por dado.
 *
 * Fritsch–Carlson zera a tangente em todo ponto de virada e limita as demais a
 * 3× a inclinação vizinha. O resultado tem a garantia que o nome diz: **entre
 * dois pontos consecutivos a curva nunca sai do intervalo entre eles.** É a
 * propriedade que o `teste:curva` verifica, e é por isso que ele amostra a
 * Bézier em vez de comparar a string do caminho.
 */

export type Ponto = readonly [number, number];

/**
 * Tangentes de Fritsch–Carlson.
 *
 * ⚠️ `dx <= 0` devolve inclinação zero em vez de dividir. Os eixos x desta base
 * são índices crescentes, então não deveria acontecer — mas "não deveria" é como
 * se descreve um `Infinity` antes de ele aparecer no `<path>` e degenerar o
 * desenho num retângulo cheio, que já foi o defeito do sparkline do ROAS.
 */
function tangentes(pts: readonly Ponto[]): number[] {
  const n = pts.length;
  const dx: number[] = [];
  const m: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const d = pts[i + 1]![0] - pts[i]![0];
    dx.push(d);
    m.push(d > 0 ? (pts[i + 1]![1] - pts[i]![1]) / d : 0);
  }

  const t: number[] = new Array(n).fill(0);
  t[0] = m[0] ?? 0;
  t[n - 1] = m[n - 2] ?? 0;

  for (let i = 1; i < n - 1; i++) {
    const a = m[i - 1]!;
    const b = m[i]!;
    // Ponto de virada (ou trecho plano): tangente ZERO. É o que impede a curva
    // de continuar subindo depois de um pico e depois voltar.
    if (a * b <= 0) {
      t[i] = 0;
      continue;
    }
    // Média harmônica ponderada pelos passos — a forma de Fritsch–Carlson que
    // já sai dentro do limite de monotonicidade sem precisar de recorte extra.
    const w1 = 2 * dx[i]! + dx[i - 1]!;
    const w2 = dx[i]! + 2 * dx[i - 1]!;
    t[i] = (w1 + w2) / (w1 / a + w2 / b);
  }

  return t;
}

/**
 * Caminho SVG suave passando por todos os pontos, sem ultrapassá-los.
 *
 * Menos de 3 pontos não tem curva a suavizar: 2 viram um segmento reto e 1 vira
 * só o `M`. Devolver "" para lista vazia é de propósito — `<path d="">` não
 * desenha nada, que é o desenho correto para série ausente.
 */
export function caminhoSuave(pontos: readonly Ponto[]): string {
  const n = pontos.length;
  if (n === 0) return "";

  const f = (v: number) => v.toFixed(2);
  const inicio = `M${f(pontos[0]![0])},${f(pontos[0]![1])}`;
  if (n === 1) return inicio;
  if (n === 2) return `${inicio} L${f(pontos[1]![0])},${f(pontos[1]![1])}`;

  const t = tangentes(pontos);
  let d = inicio;

  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pontos[i]!;
    const [x1, y1] = pontos[i + 1]!;
    // Os controles ficam a UM TERÇO do passo. É a conversão padrão de Hermite
    // para Bézier cúbica: mais que isso e a curva volta a poder ultrapassar.
    const h = (x1 - x0) / 3;
    d +=
      ` C${f(x0 + h)},${f(y0 + t[i]! * h)}` +
      ` ${f(x1 - h)},${f(y1 - t[i + 1]! * h)}` +
      ` ${f(x1)},${f(y1)}`;
  }

  return d;
}

/**
 * Fecha um caminho de linha contra uma base, para virar área preenchida.
 *
 * ⛔ Recebe o caminho JÁ PRONTO em vez de recalcular a curva. Recalcular seria a
 * segunda implementação da mesma conta — e a área desalinhada da linha por meio
 * pixel é o tipo de defeito que se atribui ao antialiasing por meses.
 */
export function fecharArea(caminho: string, xInicio: number, xFim: number, base: number): string {
  if (!caminho) return "";
  const f = (v: number) => v.toFixed(2);
  return `${caminho} L${f(xFim)},${f(base)} L${f(xInicio)},${f(base)} Z`;
}
