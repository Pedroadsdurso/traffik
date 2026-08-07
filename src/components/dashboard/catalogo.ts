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
 * ⛔ NÃO EXISTE LISTA DE PASSOS DE LARGURA. Um bloco aceita **qualquer inteiro**
 * do mínimo dele até 12.
 *
 * Havia `[3, 4, 6, 8, 12]` aqui, e o dono recusou com a razão certa: cinco
 * presets são uma lista curada, e lista curada não dá sensação de liberdade —
 * dá sensação de formulário com cinco opções. O que impede o layout de quebrar é
 * o ENCAIXE em coluna inteira e o mínimo por bloco, não a escassez de opções.
 *
 * ⚠️ E a regra do desempate morreu junto: entre inteiros consecutivos não há
 * empate. Ela era consequência da lista, não uma decisão de produto — e enquanto
 * existiu produziu um controle inerte (as setas da alça).
 */

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
  /**
   * 🔴 A ALTURA VEM DO CONTEÚDO. Só os blocos marcados aqui ganham alça de
   * altura, e mesmo eles têm o conteúdo como piso.
   *
   * Altura declarada por bloco foi a causa do painel esburacado: um bloco vazio
   * reservava as 6 linhas que teria COM dado só para escrever "Sem dado neste
   * período", ao lado de outro de 3 — e os testadores veem estado vazio o tempo
   * todo. Reservar espaço para um dado que não existe é a versão de layout de
   * afirmar o que não se mediu.
   *
   * ⚠️ É `true` só onde a altura MUDA a leitura: série temporal ganha resolução
   * vertical, lista rolável mostra mais linhas. Tabela de três linhas não ganha
   * nada — ali a altura extra é ar.
   */
  alturaAjustavel?: boolean;
  /** Piso em linhas, só para os ajustáveis. O conteúdo ainda pode passar dele. */
  linhasMin?: number;
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
  },
  {
    id: "fontes",
    titulo: "Fontes de tráfego",
    descricao: "De qual canal veio o faturamento",
    zona: "paineis",
    colMin: 4,
    colPadrao: 4,
  },
  {
    id: "produtos",
    titulo: "Produtos",
    descricao: "Quais produtos faturaram mais",
    zona: "paineis",
    colMin: 4,
    colPadrao: 4,
  },
  {
    id: "pagamentos",
    titulo: "Formas de pagamento",
    descricao: "Como os compradores pagaram",
    zona: "paineis",
    colMin: 4,
    colPadrao: 4,
  },
  {
    id: "vendas-por-dia",
    alturaAjustavel: true,
    linhasMin: 4,
    titulo: "Vendas por dia",
    descricao: "Quantas vendas e quanto faturou em cada dia",
    zona: "paineis",
    colMin: 6,
    colPadrao: 6,
  },
  {
    id: "vendas-por-hora",
    alturaAjustavel: true,
    linhasMin: 4,
    titulo: "Vendas por horário",
    descricao: "As 24 horas do período filtrado",
    zona: "paineis",
    colMin: 6,
    colPadrao: 6,
  },
  {
    id: "lucro-por-hora",
    alturaAjustavel: true,
    linhasMin: 4,
    titulo: "Lucro por horário",
    descricao: "Receita menos a fatia de custo daquela hora",
    zona: "paineis",
    colMin: 6,
    colPadrao: 6,
  },
  {
    id: "aprovacao",
    titulo: "Taxa de aprovação",
    descricao: "Quanto de cada forma de pagamento é aprovado",
    zona: "paineis",
    colMin: 4,
    colPadrao: 4,
  },
  {
    id: "atividade",
    alturaAjustavel: true,
    linhasMin: 4,
    titulo: "Atividade recente",
    descricao: "Os últimos eventos de venda e rastreamento",
    zona: "paineis",
    colMin: 4,
    colPadrao: 4,
  },
] as const satisfies readonly MetaBloco[];

/** Os ids válidos, derivados da lista. É o que o `Record` dos renders exige. */
export type IdBloco = (typeof CATALOGO_META)[number]["id"];

export function metaDoBloco(id: string): MetaBloco | undefined {
  return CATALOGO_META.find((b) => b.id === id);
}

/** Toda largura inteira do mínimo do bloco até a grade cheia. */
export function passosDoBloco(meta: MetaBloco): number[] {
  const larguras: number[] = [];
  for (let c = meta.colMin; c <= COLUNAS_GRADE; c++) larguras.push(c);
  return larguras;
}

/**
 * Encaixa uma largura CRUA (a que o arrasto produziu) na coluna inteira mais
 * próxima, entre o mínimo do bloco e a grade cheia.
 *
 * ⛔ Arredondar, e não truncar: truncar faria o bloco só encolher enquanto o
 * ponteiro sobe, e a metade de cada coluna ficaria inalcançável — o gesto
 * pareceria travar antes de chegar no tamanho pedido.
 */
export function encaixarColunas(bruto: number, meta: MetaBloco): number {
  if (!Number.isFinite(bruto)) return meta.colPadrao;
  return Math.max(meta.colMin, Math.min(COLUNAS_GRADE, Math.round(bruto)));
}

/**
 * Uma coluna para a direita ou para a esquerda, com o mínimo e o teto aplicados.
 *
 * 🔴 ELE EXISTIU PORQUE AS SETAS DA ALÇA NÃO FAZIAM NADA — visto na tela em
 * 07/08/2026, com o Funil em 4 colunas e `ArrowRight` duas vezes sem mover um
 * pixel. A causa era a lista curada de larguras: o teclado somava `+1` e o
 * encaixe devolvia o preset mais próximo de 5, que pelo desempate era o próprio
 * 4. De qualquer preset, uma seta voltava para ele.
 *
 * ⚠️ Com **todas as colunas inteiras** a função virou quase trivial — e FICA
 * assim mesmo. Ela é o ponto único onde "andar um passo" é definido, e é o que
 * garante o clamp do mínimo também para o teclado. Sem ela, o `+1` voltaria a
 * ser escrito na tela e o mínimo do bloco ficaria a cargo de quem lembrasse.
 */
export function proximoPasso(meta: MetaBloco, col: number, direcao: number): number {
  return encaixarColunas(encaixarColunas(col, meta) + Math.sign(direcao), meta);
}


/**
 * Altura em linhas, para os blocos que declaram alça de altura.
 *
 * ⛔ Bloco sem `alturaAjustavel` devolve `undefined`: ele NÃO tem altura no
 * layout, e gravar uma seria dado morto que o próximo leitor aplicaria por
 * engano. `undefined` é o que faz a grade usar a altura do conteúdo.
 */
export function encaixarLinhas(bruto: number | undefined, meta: MetaBloco): number | undefined {
  if (!meta.alturaAjustavel) return undefined;
  const piso = meta.linhasMin ?? 3;
  if (bruto === undefined || !Number.isFinite(bruto)) return piso;
  return Math.max(piso, Math.min(24, Math.round(bruto)));
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
