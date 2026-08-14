/**
 * A DERIVAÇÃO POR VIEWPORT — F2 (`docs/design/07-GRADE-E-BLOCOS.md`, §5).
 *
 * 🔴 **UM LAYOUT SALVO, QUATRO DERIVAÇÕES DETERMINÍSTICAS.** O usuário arruma a
 * grade de 12 colunas uma vez; telas menores recebem uma TRANSFORMAÇÃO dela.
 *
 * ```
 * ≥ 1280px → 12 colunas   (o layout salvo, sem transformação nenhuma)
 * 960–1279 →  8 colunas
 * 640–959  →  4 colunas
 * < 640    →  1 coluna
 * ```
 *
 * ### ⛔ NÃO SE SALVAM QUATRO LAYOUTS — só o de 12
 *
 * O grid antigo tinha um salvo por breakpoint (`desktop`/`mobile`), e o de
 * `mobile` **nunca foi editável**: era uma segunda verdade sobre o arranjo do
 * usuário que ele não tinha como consertar. Aqui há uma verdade e uma função
 * pura por cima dela — se a derivação estiver errada, conserta-se a função, e
 * ninguém precisa remontar nada.
 *
 * ⚠️ É a mesma disciplina do `docs:estado` e da `/design-system`: **documentação
 * que LÊ o valor não envelhece; a que o AFIRMA, sim.** O layout de 8 colunas não
 * é afirmado em lugar nenhum — ele é lido do de 12.
 *
 * ### 🔴 POR QUE O VIEWPORT, E NÃO A LARGURA DO CONTÊINER
 *
 * Esta base prefere medir o contêiner, com razão — "a grade é MEDIDA, não
 * calculada de um breakpoint" está escrito no `DashboardScreen`, e vale para a
 * conversão px→coluna da alça. **Aqui é o contrário, e o motivo é o catálogo.**
 *
 * Os `colMin` de todo bloco foram calculados contra uma referência declarada:
 * *"uma janela de 1440px com o rail aberto: coluna ≈ 82px"*. Nessa janela o
 * contêiner mede ~1160px. Se a derivação lesse o CONTÊINER com os limiares
 * acima, 1160 cairia na faixa de 8 colunas — e a tela de referência do catálogo
 * inteiro passaria a ser derivada. Todo `colMin` do arquivo estaria descrevendo
 * uma largura que a grade não usa mais.
 *
 * ⚠️ O limiar e o instrumento vêm em par: trocar um sem o outro é o erro do
 * `getBoundingClientRect` clipado — o número continua saindo, medindo outra
 * coisa.
 */

import { COLUNAS_GRADE, metaDoBloco } from "../catalogo";
import type { BlocoGrade } from "./migrar";

/** As quatro contagens de coluna, da maior para a menor. */
export const COLUNAS_POR_FAIXA = [
  { minLargura: 1280, colunas: 12 },
  { minLargura: 960, colunas: 8 },
  { minLargura: 640, colunas: 4 },
  { minLargura: 0, colunas: 1 },
] as const;

/**
 * Quantas colunas uma janela desta largura recebe.
 *
 * ⚠️ A varredura é da MAIOR para a menor e para na primeira que couber. Escrever
 * as faixas como intervalos fechados (`>= 960 && < 1280`) daria dois números por
 * faixa, e um buraco entre eles seria uma largura sem resposta — a classe de
 * defeito que só aparece num monitor exótico.
 */
export function colunasParaLargura(largura: number): number {
  if (!Number.isFinite(largura)) return COLUNAS_GRADE;
  for (const f of COLUNAS_POR_FAIXA) {
    if (largura >= f.minLargura) return f.colunas;
  }
  return 1;
}

/**
 * A largura derivada de UM bloco.
 *
 * ```
 * w2 = clamp( ceil(w × C / 12), min(colMin, C), C )
 * ```
 *
 * 🔴 As três partes fazem coisas diferentes, e nenhuma é decorativa:
 *
 * | | |
 * |---|---|
 * | `ceil` | um bloco de 8/12 numa grade de 4 vira 3, não 2. **Arredondar para baixo encolhe todo mundo**, e a soma da linha deixa de fechar — o oposto do que a proporção deveria preservar |
 * | `min(colMin, C)` | numa grade de 1 coluna, um bloco de `colMin: 5` teria de ocupar 5 de 1. O mínimo do catálogo **não pode vencer a grade**: quem manda é o menor dos dois |
 * | `C` no teto | nenhum bloco passa da grade. Sem isto o CSS o deixaria transbordar em silêncio |
 *
 * ⛔ **`h` é PRESERVADO.** A derivação é sobre largura; a densidade do conteúdo
 * é assunto da container query (F3), que já responde sobre a caixa real. Encolher
 * a altura aqui seria uma terceira mecânica decidindo altura — exatamente o que a
 * F1 tirou da tela.
 */
export function larguraDerivada(col: number, colMin: number, colunas: number): number {
  const proporcional = Math.ceil((col * colunas) / COLUNAS_GRADE);
  return Math.max(Math.min(colMin, colunas), Math.min(colunas, proporcional));
}

/**
 * Deriva a lista inteira para `colunas`.
 *
 * ⚠️ **A ORDEM É PRESERVADA, e ela é a leitura em Z do layout de 12** — a mesma
 * lista, na mesma sequência. Reordenar por "o que cabe melhor" faria o bloco que
 * o usuário pôs em primeiro aparecer em quinto no celular, e ele não teria como
 * saber por quê.
 *
 * 🔬 `derivar(salvo, 12) === salvo` é a asserção §7.4 do `07`, e ela é o que
 * garante que a tela grande não passe por transformação nenhuma: com `C = 12` o
 * `ceil` é identidade e os dois clamps são inertes.
 */
export function derivarLayout(blocos: readonly BlocoGrade[], colunas: number): BlocoGrade[] {
  if (colunas === COLUNAS_GRADE) return [...blocos];
  return blocos.map((b) => {
    const meta = metaDoBloco(b.id);
    /* Bloco fora do catálogo não deveria chegar aqui (a migração o descarta),
       e mesmo assim ele não pode quebrar a derivação: sem mínimo conhecido, a
       grade cheia é a resposta que não transborda. */
    const colMin = meta?.colMin ?? colunas;
    return { ...b, col: larguraDerivada(b.col, colMin, colunas) };
  });
}
