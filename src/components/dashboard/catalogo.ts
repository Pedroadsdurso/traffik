/**
 * O CATÁLOGO — metadados dos blocos do Dashboard. **Sem JSX, de propósito.**
 *
 * 🔴 REGRA DE ENTRADA, E ELA É APLICADA PELO COMPILADOR: nada entra aqui sem
 * ter um render em `catalogoRender.tsx`. O `Record<IdBloco, …>` de lá exige uma
 * entrada para CADA id declarado aqui — acrescentar um bloco só nos metadados
 * quebra o `tsc`.
 *
 * Isso é mais forte do que a versão anterior, em que metadados e render moravam
 * juntos e nada impedia um `render: () => null`. **Um catálogo que oferece bloco
 * vazio é o pior controle inerte da base**: o usuário ESCOLHE, espera, e é ele
 * quem descobre que não há nada. O botão inerte frustra; o catálogo inerte faz
 * o usuário duvidar do próprio entendimento.
 *
 * ⚠️ A separação nasceu de uma necessidade concreta, e vale registrar porque é
 * um bom motivo: a MIGRAÇÃO de layout precisa das medidas, é pura, e é testada
 * com `node --experimental-strip-types`, que não lê `.tsx`. Metadado que só um
 * componente pode ler é metadado que nenhum teste alcança.
 *
 * ### Os LIMITES nascem aqui
 *
 * Cada painel declara o mínimo em que ainda é legível. **O redimensionamento é
 * livre acima desse piso e trava nele** — é o que separa "arrastar até quebrar"
 * de "arrastar até o limite do bloco", e é a única parte do gesto que o produto
 * tem opinião sobre.
 */

/**
 * Onde o bloco pode viver.
 *
 * ⚠️ Uma métrica vive em `hero` ou `faixa`; um painel, em `paineis`. O arrasto
 * **acende o destino compatível e apaga o resto** — a rejeição aparece antes de
 * soltar, não depois.
 */
export type Zona = "hero" | "faixa" | "paineis";

/**
 * ⛔ AS LARGURAS DECLARADAS (`um-terco | metade | cheia`) SAÍRAM em 07/08/2026,
 * por decisão do dono. No lugar entrou uma grade de 12 colunas com
 * REDIMENSIONAMENTO POR ENCAIXE.
 *
 * A diferença não é de granularidade, é de gesto: escolher entre três rótulos é
 * um formulário; arrastar o canto e ver o bloco encaixar é manipulação direta.
 * O encaixe é o que dá liberdade sem quebrar — pixel livre produziria linhas de
 * 11,3 colunas e um layout que nunca fecha.
 */
export const PASSOS_COL = [3, 4, 6, 8, 12] as const;

/** Colunas da grade. Doze porque é o único número que divide por 2, 3, 4 e 6. */
export const COLUNAS_GRADE = 12;

/**
 * Altura de UMA linha da grade, em px.
 *
 * ⚠️ Ela não é o `--tk-gap-grid`: o gap separa blocos, esta é a unidade em que a
 * altura deles é medida. 44px dá passos perceptíveis sem exigir dez arrastos
 * para dobrar um bloco de tamanho.
 */
export const ALTURA_LINHA = 44;

export interface MetaBloco {
  id: string;
  titulo: string;
  /** Uma linha dizendo o que o bloco responde. Vai para o painel de escolha. */
  descricao: string;
  zona: Zona;
  /**
   * 🔴 O MÍNIMO DE COLUNAS É UMA AFIRMAÇÃO SOBRE O BLOCO, não um palpite: abaixo
   * dele o conteúdo **deixa de ser legível**, e travar ali é honesto. Um heatmap
   * de 24×7 não cabe em 3 colunas, e deixar o usuário chegar lá produziria um
   * bloco quebrado que ele mesmo escolheu.
   *
   * ⚠️ ELES ESTÃO CONSERVADORES DE PROPÓSITO (C2, 07/08/2026): cada bloco declara
   * só as larguras em que ele **já funciona hoje**, sem container query. O C3
   * acrescenta as consultas de container e **aí** os mínimos descem para o real.
   * A regra "bloco que quebra numa largura que ele declara é bug" fica cumprida
   * nas duas entregas — porque esta simplesmente não oferece a largura estreita.
   */
  colMin: number;
  colPadrao: number;
  linhasMin: number;
  linhasPadrao: number;
}

/* ⚠️ Hero e faixa NÃO estão aqui: são listas de MÉTRICA, não de bloco, e o
   catálogo delas é o `metricCards` do hook. Misturar os dois faria o painel de
   escolha oferecer "Faturamento" e "Vendas por país" na mesma lista. */
export const CATALOGO_META = [
  {
    id: "funil",
    titulo: "Funil",
    descricao: "Cliques → checkouts → vendas, com a taxa de cada passo",
    zona: "paineis",
    colMin: 4,
    colPadrao: 4,
    linhasMin: 4,
    linhasPadrao: 5,
  },
  {
    id: "fontes",
    titulo: "Fontes de tráfego",
    descricao: "De qual canal veio o faturamento",
    zona: "paineis",
    colMin: 4,
    colPadrao: 4,
    linhasMin: 4,
    linhasPadrao: 6,
  },
  {
    id: "produtos",
    titulo: "Produtos",
    descricao: "Quais produtos faturaram mais",
    zona: "paineis",
    colMin: 4,
    colPadrao: 4,
    linhasMin: 4,
    linhasPadrao: 6,
  },
  {
    id: "pagamentos",
    titulo: "Formas de pagamento",
    descricao: "Como os compradores pagaram",
    zona: "paineis",
    colMin: 4,
    colPadrao: 4,
    linhasMin: 4,
    linhasPadrao: 6,
  },
  {
    id: "vendas-por-dia",
    titulo: "Vendas por dia",
    descricao: "Quantas vendas e quanto faturou em cada dia",
    zona: "paineis",
    colMin: 6,
    colPadrao: 6,
    linhasMin: 4,
    linhasPadrao: 6,
  },
  {
    id: "vendas-por-hora",
    titulo: "Vendas por horário",
    descricao: "As 24 horas do período filtrado",
    zona: "paineis",
    colMin: 6,
    colPadrao: 6,
    linhasMin: 4,
    linhasPadrao: 6,
  },
  {
    id: "lucro-por-hora",
    titulo: "Lucro por horário",
    descricao: "Receita menos a fatia de custo daquela hora",
    zona: "paineis",
    colMin: 6,
    colPadrao: 6,
    linhasMin: 4,
    linhasPadrao: 6,
  },
  {
    id: "aprovacao",
    titulo: "Taxa de aprovação",
    descricao: "Quanto de cada forma de pagamento é aprovado",
    zona: "paineis",
    colMin: 4,
    colPadrao: 4,
    linhasMin: 3,
    linhasPadrao: 5,
  },
  {
    id: "atividade",
    titulo: "Atividade recente",
    descricao: "Os últimos eventos de venda e rastreamento",
    zona: "paineis",
    colMin: 4,
    colPadrao: 4,
    linhasMin: 4,
    linhasPadrao: 7,
  },
] as const satisfies readonly MetaBloco[];

/** Os ids válidos, derivados da lista. É o que o `Record` dos renders exige. */
export type IdBloco = (typeof CATALOGO_META)[number]["id"];

export function metaDoBloco(id: string): MetaBloco | undefined {
  return CATALOGO_META.find((b) => b.id === id);
}

/**
 * Os passos de coluna que ESTE bloco aceita — os da grade que não violam o
 * mínimo dele, mais o próprio mínimo quando ele não é um passo.
 *
 * ⚠️ O mínimo entra na lista mesmo fora de `PASSOS_COL`. Um bloco de `colMin: 5`
 * teria como menor passo o 6, e o 5 que ele declarou aceitar seria inalcançável
 * — um limite que o produto anuncia e não entrega.
 */
export function passosDoBloco(meta: MetaBloco): number[] {
  const passos = PASSOS_COL.filter((c) => c >= meta.colMin);
  const lista = passos.includes(meta.colMin as (typeof PASSOS_COL)[number])
    ? [...passos]
    : [meta.colMin, ...passos];
  return lista.filter((c) => c <= COLUNAS_GRADE).sort((a, b) => a - b);
}

/**
 * Encaixa uma largura CRUA (a que o arrasto produziu) no passo mais próximo.
 *
 * ⛔ Mais próximo, e não "o maior que cabe": arredondar sempre para baixo faria o
 * bloco só encolher enquanto o ponteiro sobe, e o gesto pareceria travado. O
 * encaixe tem de poder ir nos dois sentidos.
 */
export function encaixarColunas(bruto: number, meta: MetaBloco): number {
  const opcoes = passosDoBloco(meta);
  let melhor = opcoes[0]!;
  for (const c of opcoes) if (Math.abs(c - bruto) < Math.abs(melhor - bruto)) melhor = c;
  return melhor;
}

/**
 * O passo SEGUINTE (ou anterior) na lista do bloco.
 *
 * 🔴 ELE EXISTE PORQUE AS SETAS DA ALÇA NÃO FAZIAM NADA — visto na tela em
 * 07/08/2026, com o Funil em 4 colunas e `ArrowRight` duas vezes sem mover um
 * pixel. A causa era a composição de duas regras corretas: o teclado somava
 * `+1` coluna, e o encaixe devolvia o passo mais próximo de 5 — que, pelo
 * desempate para baixo, é o próprio 4. **De qualquer passo, uma seta voltava
 * para ele.**
 *
 * ⛔ Não conserte isto afrouxando o desempate: ele é o que impede o bloco de
 * crescer sozinho no arrasto. O teclado é discreto por natureza e tem de andar
 * por ÍNDICE na lista de passos, não por unidade de coluna. As duas entradas
 * falam línguas diferentes, e essa é a tradução.
 */
export function proximoPasso(meta: MetaBloco, col: number, direcao: number): number {
  const opcoes = passosDoBloco(meta);
  const atual = opcoes.indexOf(encaixarColunas(col, meta));
  const i = Math.max(0, Math.min(opcoes.length - 1, atual + Math.sign(direcao)));
  return opcoes[i]!;
}

/** Altura em linhas: passo de 1, piso no mínimo do bloco, teto para não fugir. */
export function encaixarLinhas(bruto: number, meta: MetaBloco): number {
  return Math.max(meta.linhasMin, Math.min(24, Math.round(bruto)));
}

/**
 * ⛔ BLOCOS ESTRUTURAIS — a categoria que NÃO entra no catálogo, por decisão de
 * produto. Não é omissão, e a lista existe para não rediscutirmos caso a caso.
 *
 * ⚠️ A regra: **bloco cuja ausência faz o usuário tomar decisão errada, ou
 * deixar de saber que o sistema falhou, é estrutural.** Não é sobre importância
 * — é sobre o que a ausência CAUSA.
 *
 * ### 🔴 O `motivo` é DADO, e não prosa neste comentário
 *
 * Ele era uma tabela em Markdown aqui em cima, legível só por quem abrisse o
 * arquivo. **O modo de edição precisa dizer ao usuário por que aquele bloco não
 * tem ✕**, e a alternativa era escrever a frase de novo na tela — segunda cópia
 * da mesma decisão, que diverge no primeiro dia em que alguém mudar uma delas.
 *
 * ⛔ O bloco estrutural aparece no modo de edição **sem o ✕**, não desabilitado.
 * Um ✕ apagado é um controle que existe e não funciona; a ausência dele, com o
 * motivo ao alcance, é uma afirmação sobre o produto.
 */
export interface MetaEstrutural {
  id: string;
  titulo: string;
  /** Uma frase curta, na voz do usuário. Vai para a tooltip do selo "Fixo". */
  motivo: string;
}

export const ESTRUTURAIS_META = [
  {
    id: "alertas",
    titulo: "Alertas",
    motivo: "Alerta que dá para esconder é alerta que ninguém vê.",
  },
  {
    id: "receita-gasto",
    titulo: "Receita vs. gasto",
    motivo: "É a leitura central do painel — sem ela a tela não responde nada.",
  },
  {
    id: "paises",
    titulo: "Vendas por país",
    motivo: "O globo não cabe em nenhuma das larguras de painel.",
  },
  {
    id: "rodape",
    titulo: "Estado do sistema",
    motivo: "Diz se a ferramenta está funcionando. Não é sobre dinheiro.",
  },
] as const satisfies readonly MetaEstrutural[];

export const IDS_ESTRUTURAIS = ESTRUTURAIS_META.map((b) => b.id);
