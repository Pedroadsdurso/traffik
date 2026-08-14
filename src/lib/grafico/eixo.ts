/**
 * O EIXO Y — fonte ÚNICA para `LineChart` e `SerieTemporal`.
 *
 * 🔴 POR QUE ELE EXISTE (C3 do `07`, 13/08/2026)
 *
 * Até aqui o `LineChart` tinha eixo Y e o `SerieTemporal` não. A distinção que
 * justificava isso — *"barra é volume, linha é série"* — é **interna**: ela
 * descreve como nós organizamos os componentes, não o que o leitor vê. E o que
 * o leitor vê são dois gráficos lado a lado no mesmo painel, um com escala e
 * outro sem.
 *
 * ⛔ **Ausência de escala não se lê como "este gráfico não precisa de escala".
 * Lê-se como GRÁFICO QUEBRADO** — foi literalmente assim que o C3 foi descrito
 * quando alguém olhou a tela: *"lê como erro de renderização"*.
 *
 * ### ⛔ OS NÚMEROS MORAM AQUI, E SÓ AQUI
 *
 * Antes deste arquivo, o `56` e o `160` eram literais dentro do `LineChart`.
 * Copiá-los para o `SerieTemporal` teria criado a segunda fonte — e duas
 * implementações da mesma conta divergem sempre, que é regra desta base com
 * consequência medida. Quem quiser mudar a densidade do eixo muda aqui, e os
 * dois gráficos andam juntos por construção.
 */

/**
 * Largura reservada à coluna de rótulos do eixo, em px.
 *
 * ⚠️ **Medido, não estimado:** o rótulo mais largo que o eixo produz nesta base
 * é `R$ 15.000`, e ele mede **51,2px** na tela (medição de 13/08/2026, no
 * `receita-gasto`). 56 é esse valor com a folga que impede o texto de encostar
 * na primeira barra.
 */
export const LARGURA_EIXO = 56;

/**
 * Altura, em px, que UM intervalo de tick precisa para não colar no vizinho.
 * É o divisor de `floor(altura / ALTURA_POR_TICK)`.
 */
export const ALTURA_POR_TICK = 56;

/**
 * Altura de UM rótulo de eixo, em px. **Medido** em 13/08/2026 na tela, no
 * `lucro-por-hora`: `text-caption` renderiza a **16,0px** de caixa, e o valor
 * não muda com a altura do bloco (conferido em 9 alturas, de 80 a 200px).
 */
export const ALTURA_ROTULO = 16;

/**
 * Abaixo desta altura de PLOTAGEM o eixo **desaparece inteiro**.
 *
 * 🔴 E o desaparecimento é a resposta certa, não uma economia: com um tick só
 * não existe ESCALA — uma linha horizontal sozinha não declara intervalo, e o
 * gráfico passa a mostrar forma sem grandeza, que é pior que não mostrar nada.
 * Ou cabem os dois extremos, que já definem o intervalo, ou não cabe eixo.
 *
 * ### 🔬 O NÚMERO É DERIVADO, E ELE SUBSTITUI O `160` DA §4 DO `07`
 *
 * Com o mínimo de `2` intervalos são **3** rótulos, centrados em 0%, 50% e 100%
 * da plotagem. Os centros ficam a `plot / 2` um do outro, então eles se tocam
 * quando `plot / 2 < ALTURA_ROTULO` — ou seja, o piso é **duas alturas de
 * rótulo**.
 *
 * ✅ **Medido, e a medição bate:** plotagem de 36px → **0 colisões**; de 20px →
 * **2 colisões**. O cruzamento cai dentro do intervalo, em 32.
 *
 * ⛔ **A §4 do `07` dizia `160`, e esse número foi APAGADO de lá.** Ele era
 * estimativa (a §3/§4 inteira é, e o próprio `07` diz isso), e a medição mostrou
 * que ele reintroduzia o defeito que o C3 existe para consertar: no tamanho
 * PADRÃO do catálogo — 3 células, card de 272px — a plotagem mede **132px**, e
 * com o piso em 160 `vendas-por-dia` e `vendas-por-hora` ficavam **sem eixo
 * justamente no tamanho em que vivem**. Um limiar que esconde o eixo no caso
 * comum não é um limiar conservador: é o defeito com outro nome.
 */
export const CH_MINIMO_EIXO = ALTURA_ROTULO * 2;

/**
 * Quantos INTERVALOS o eixo Y deve ter. `0` significa "não desenhe eixo".
 *
 * @param ch      altura do contêiner do gráfico (a caixa medida, não a do slot)
 * @param altPlot altura útil da plotagem, já descontado o padding do desenho
 * @param obrigatorio o gráfico tem valor NEGATIVO
 *
 * ### ⛔ COM VALOR NEGATIVO O EIXO NUNCA SOME
 *
 * Numa série só positiva, o leitor sabe onde é o zero: é o chão do desenho. Numa
 * série com negativo o chão não é o zero, e sem eixo **não há como saber quanto
 * de uma barra está abaixo dele**. A linha de zero tracejada mostra ONDE, e só o
 * eixo mostra QUANTO — as duas coisas são necessárias, e é por isso que a
 * obrigatoriedade vence o limiar de altura.
 */
export function intervalosDoEixoY(ch: number, altPlot: number, obrigatorio = false): number {
  if (ch < CH_MINIMO_EIXO) return obrigatorio ? 2 : 0;
  return Math.max(2, Math.floor(altPlot / ALTURA_POR_TICK));
}

/**
 * Arredonda o topo (e o piso, quando há negativo) para a régua não sair com
 * `37.412` na ponta.
 *
 * ⚠️ O passo é meia ordem de grandeza do maior valor absoluto. Ele é o mesmo que
 * o `LineChart` já usava — trazido para cá para os dois arredondarem igual, e
 * não "parecido".
 */
/**
 * Largura do rótulo do eixo X, em px. **Medido** em 13/08/2026 no
 * `vendas-por-dia`: os rótulos (`07-15`, `08-04`, …) medem de **29 a 36px** de
 * `scrollWidth`. 36 é o maior, e é o que tem de caber.
 */
export const LARGURA_ROTULO_X = 36;

/**
 * De quantos em quantos pontos desenhar um rótulo no eixo X.
 *
 * 🔴 **ESTE É O C2 DO `07`, e a causa não era densidade.** O componente já
 * mostrava 8 rótulos no máximo — mas cada um vivia numa célula de `1 / n` da
 * fileira, com `overflow: hidden`. Um rótulo de 36px **não cabe** numa célula de
 * 7px por menos rótulos que se desenhe: reduzir a densidade nunca ia resolver.
 *
 * A saída são as duas metades juntas: a célula deixa de cortar (`overflow:
 * visible`, e ela transborda para as vizinhas, que estão VAZIAS por construção)
 * e o passo passa a garantir que N células cabem um rótulo.
 *
 * @param larguraPlot largura MEDIDA da área de barras (sem a gaveta do eixo Y)
 * @param n           quantos pontos a série tem
 */
export function passoDoRotuloX(larguraPlot: number, n: number, folga = 2): number {
  if (n <= 1 || larguraPlot <= 0) return 1;
  const celula = larguraPlot / n;
  return Math.max(1, Math.ceil((LARGURA_ROTULO_X + folga) / celula));
}

export function escalaArredondada(min: number, max: number): { min: number; max: number } {
  const bruto = Math.max(Math.abs(min), Math.abs(max), 1);
  const passo = Math.pow(10, Math.floor(Math.log10(bruto))) / 2;
  return {
    min: min < 0 ? Math.floor(min / passo) * passo : 0,
    max: Math.ceil(max / passo) * passo,
  };
}
