/**
 * ONDE A GRADE QUEBRA A LINHA — e quantas colunas sobraram nela.
 *
 * 🔴 POR QUE ISTO EXISTE
 *
 * Quando as larguras de uma linha não somam 12, sobra espaço no fim dela. Isso é
 * **escolha do usuário**, não defeito — mas na tela as duas coisas são idênticas,
 * e o dono foi explícito: *"hoje o buraco parece defeito, não escolha"*. O aviso
 * de `N colunas livres` é o que separa uma da outra.
 *
 * ⛔ E ele é TEXTO, não uma área pontilhada. Área pontilhada no fim da linha é
 * lida como alvo de soltura, e ali não se solta nada — o arrasto insere na
 * ORDEM da lista, não numa coordenada. Seria affordance mentindo, que é o mesmo
 * defeito do cursor de ponteiro sobre o globo que não responde.
 *
 * ### ⚠️ ISTO É UMA SIMULAÇÃO DO EMPACOTAMENTO DO CSS GRID, e o limite importa
 *
 * O CSS não conta onde quebrou a linha, então esta função refaz a conta. É a
 * segunda implementação de uma regra que o navegador já aplica — e a regra desta
 * base diz que duas implementações divergem.
 *
 * O que torna aceitável aqui:
 *
 *   1. o empacotamento é trivial e especificado: sem `dense`, itens na ordem,
 *      cada um cabe ou desce inteiro;
 *   2. nenhum item pode ser maior que a grade — o `encaixarColunas` garante;
 *   3. **a divergência seria VISÍVEL**: o aviso é um item DA GRADE, então se a
 *      conta errar ele aparece na linha errada, na cara de quem estiver
 *      editando. Não é uma guarda que falha em silêncio.
 *
 * ⛔ Se um dia `grid-auto-flow: dense` entrar, esta função para de descrever a
 * realidade — e aí ela tem de morrer junto, não ser remendada. O `dense` está
 * recusado com motivo escrito no `DashboardScreen`.
 */

/** As colunas da grade. Duplicada do catálogo de propósito: este arquivo é puro. */
const COLUNAS = 12;

export interface LinhaDaGrade {
  /** Índices dos painéis nesta linha, na ordem em que aparecem. */
  indices: number[];
  /** Soma das larguras. Nunca passa de `COLUNAS`. */
  usadas: number;
  /** O que sobrou no fim. `0` quando a linha fecha exatamente. */
  livres: number;
}

/**
 * Agrupa as larguras em linhas, como o CSS Grid faria.
 *
 * ⚠️ Largura inválida (zero, negativa, maior que a grade) é tratada como a grade
 * cheia em vez de ser descartada. Descartar faria o painel sumir do aviso e
 * aparecer na tela — o aviso mentiria sobre uma linha que existe.
 */
export function linhasDaGrade(larguras: number[]): LinhaDaGrade[] {
  const linhas: LinhaDaGrade[] = [];
  let atual: LinhaDaGrade | null = null;

  larguras.forEach((bruta, i) => {
    const col = !Number.isFinite(bruta) || bruta <= 0 || bruta > COLUNAS ? COLUNAS : Math.floor(bruta);
    if (!atual || atual.usadas + col > COLUNAS) {
      atual = { indices: [], usadas: 0, livres: 0 };
      linhas.push(atual);
    }
    atual.indices.push(i);
    atual.usadas += col;
    atual.livres = COLUNAS - atual.usadas;
  });

  return linhas;
}

/**
 * A frase do aviso, ou `null` quando a linha fecha.
 *
 * ⚠️ `null` e não string vazia: quem chama tem de decidir não renderizar nada,
 * e um `""` renderizado vira um item de grade invisível que ainda ocupa coluna.
 */
export function avisoDeSobra(livres: number): string | null {
  if (livres <= 0) return null;
  return livres === 1 ? "1 coluna livre" : `${livres} colunas livres`;
}
