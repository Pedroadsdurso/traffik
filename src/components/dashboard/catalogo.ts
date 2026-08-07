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
   * 🔴 BLOCO ESTRUTURAL É O QUE NÃO PODE SER **OCULTADO**. Nada além disso.
   *
   * Preenchido = o bloco aparece no modo de edição **sem o ✕**, com o selo
   * `Fixo` e esta frase na tooltip. Ele continua na zona Painéis como qualquer
   * outro: tem alça, muda de largura, muda de posição, é arrastável.
   *
   * ### ⛔ A DEFINIÇÃO ANTERIOR ESTAVA ERRADA, e o dono a corrigiu em 07/08/2026
   *
   * Havia uma lista `ESTRUTURAIS_META` **fora** do catálogo, e os quatro blocos
   * dela viviam em JSX fixo no `DashboardScreen`, numa zona própria chamada
   * "Sempre visíveis". Na prática *"não removível"* tinha virado *"não
   * redimensionável"* — e são coisas diferentes. O sintoma: `Vendas por país`
   * ocupava a largura inteira da tela e não havia como mexer.
   *
   * ⚠️ O que "estrutural" garante hoje, e o que ele NÃO garante:
   *
   * | Garante | Não garante |
   * |---|---|
   * | está sempre na lista de painéis (a migração o repõe se sumir do salvo) | posição |
   * | não tem ✕ | largura |
   * | | altura |
   *
   * A reposição é o que faz a garantia valer: sem ela, "não pode ser ocultado"
   * dependeria de nenhum layout salvo ter perdido o bloco — que é a mesma
   * classe de promessa que o `?? 0` faz sobre um número.
   */
  estrutural?: string;
  /**
   * 🔴 O MÍNIMO DE COLUNAS É UMA AFIRMAÇÃO SOBRE O BLOCO, não um palpite: abaixo
   * dele o conteúdo **deixa de ser legível**, e travar ali é honesto. Um heatmap
   * de 24×7 não cabe em 3 colunas, e deixar o usuário chegar lá produziria um
   * bloco quebrado que ele mesmo escolheu.
   *
   * ### ⛔ MÍNIMO É "ABAIXO DISSO O BLOCO MENTE OU FICA ILEGÍVEL"
   *
   * Não é "abaixo disso fica apertado" — apertado é PREFERÊNCIA, e a preferência
   * é do usuário. Regra do dono, 07/08/2026, depois de a auditoria achar que
   * vários números aqui eram conforto disfarçado de limite.
   *
   * **Cada número abaixo tem a conta que o produziu escrita na linha do bloco**,
   * em largura ÚTIL (dentro do card, já descontado `--tk-pad-card` dos dois
   * lados). A referência é uma janela de 1440px com o rail aberto: coluna ≈ 82px,
   * e `N` colunas dão `N × 82 + (N−1) × 16 − 40` de largura útil.
   *
   * | col | útil |
   * |---|---|
   * | 3 | ~237px |
   * | 4 | ~318px |
   * | 5 | ~400px |
   * | 6 | ~482px |
   *
   * ⚠️ **A conta é uma ESTIMATIVA de referência, não uma medição por bloco.** A
   * largura real muda com a janela, com o rail recolhido e com a densidade. É
   * por isso que abaixo do mínimo o bloco não pode simplesmente "ficar feio": ou
   * há container query que o simplifica, ou o mínimo está alto demais.
   *
   * ⛔ Mínimo sem container query que o sustente é promessa vazia — "bloco que
   * quebra numa largura que ele DECLARA é bug".
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
  /* ── OS QUATRO ESTRUTURAIS ────────────────────────────────────────────────
     Eles vêm PRIMEIRO na lista porque a ordem daqui é a do layout padrão de
     conta nova, e a leitura da tela começa por eles. ⚠️ Não é uma segunda
     categoria: o que os separa é uma string a mais (`estrutural`). */
  {
    id: "receita-gasto",
    alturaAjustavel: true,
    linhasMin: 5,
    titulo: "Receita vs. gasto",
    descricao: "As duas séries no tempo, com a linha de break-even",
    zona: "paineis",
    /* 4 → ~318px. Cabe o cabeçalho (título ~120px + `Diário|Semanal` ~130px) e
       uma linha com ~5 rótulos de eixo. Abaixo disso o eixo vira uma régua de
       datas cortadas, e a série deixa de dizer QUANDO. */
    colMin: 4,
    colPadrao: 8,
    estrutural: "É a leitura central do painel — sem ela a tela não responde nada.",
  },
  {
    id: "alertas",
    alturaAjustavel: true,
    linhasMin: 4,
    titulo: "Alertas",
    descricao: "O que exige ação agora",
    zona: "paineis",
    /* 3 → ~237px. A linha é círculo de 28px (§13) + texto: sobram ~200px para o
       título do alerta, que quebra em duas linhas sem perder nada. Lista de
       texto é o formato que menos sofre com largura. */
    colMin: 3,
    colPadrao: 4,
    estrutural: "Alerta que dá para esconder é alerta que ninguém vê.",
  },
  {
    id: "paises",
    alturaAjustavel: true,
    linhasMin: 5,
    titulo: "Vendas por país",
    descricao: "De onde vem o faturamento",
    zona: "paineis",
    /* 🔴 4, E ANTES ERA A TELA INTEIRA — este é o bloco que motivou a correção
       da definição de "estrutural".

       O mínimo é o do RANKING, não o do globo: abaixo de 640px úteis (~8 col) a
       container query já tira o globo e sobra a lista, que é quem responde "qual
       país e quanto". A lista precisa de bandeira 20 + nome ~100 + vendas 30 +
       receita 88 + folgas 30 ≈ 270px, e 4 colunas dão 318. */
    colMin: 4,
    colPadrao: 6,
    estrutural: "De onde vem o dinheiro é leitura de operação, não enfeite.",
  },
  {
    id: "rodape",
    titulo: "Estado do sistema",
    descricao: "Integrações, regras, taxas e última atualização",
    zona: "paineis",
    /* 3 → ~237px. O `StatusFooter` já é `auto-fit minmax(200px, 1fr)`: ele
       reflui para uma coluna sozinho. 200px é o piso do próprio componente. */
    colMin: 3,
    colPadrao: 12,
    estrutural: "Diz se a ferramenta está funcionando. Não é sobre dinheiro.",
  },

  /* ── OS OPCIONAIS ─────────────────────────────────────────────────────── */
  {
    id: "funil",
    alturaAjustavel: true,
    linhasMin: 4,
    titulo: "Funil",
    /* ⚠️ O subtítulo LISTA as etapas, então ele envelhece junto com elas. Ele
       omitia `Sessões` desde que a etapa entrou — dois textos vizinhos
       descrevendo o mesmo dado, e o errado era o que prometia a coisa mais
       simples do que ela é. */
    descricao: "Cliques → sessões → checkouts → vendas iniciadas e aprovadas",
    zona: "paineis",
    /* 🔴 4 é o mínimo do CABEÇALHO, não o da fita — e a distinção custou caro.
       A container query esconde `.tk-fita-desenho` abaixo de 360px úteis, e 4
       colunas dão ~318px numa janela de 1440. **No padrão antigo (`colPadrao:
       4`) a fita nunca aparecia nessa janela** — o bloco era três números e um
       vazio, que é a razão de ele "continuar ruim" há três tentativas.
       O padrão subiu para 6 (~482px), que é onde a fita existe. */
    colMin: 4,
    colPadrao: 6,
  },
  {
    id: "fontes",
    titulo: "Origem do faturamento",
    /* 🔴 ABSORVEU O BLOCO "CANAIS" (07/08/2026). Os dois liam `v.sources` — o
       MESMO array, a mesma dimensão (`utm_source` do clique) — e desenhavam
       rosca e lista da mesma coisa. Não é uma junção de coisas parecidas: era
       um dado só, exibido duas vezes na mesma tela. */
    descricao: "De qual canal veio o faturamento",
    zona: "paineis",
    /* 3 → ~237px. Sem coluna de contagem: nome ~90 + receita 78 + % 44 + folgas
       ~25 = 237. E o `%` sai por container query abaixo de 320px úteis, o que dá
       folga real. A rosca é quadrada e cabe em qualquer largura. */
    colMin: 3,
    colPadrao: 4,
  },
  {
    id: "produtos",
    titulo: "Produtos",
    descricao: "Quais produtos faturaram mais",
    zona: "paineis",
    /* 3 → ~237px, com o `%` já fora pela container query: nome ~90 + vendas 54
       + receita 78 + folgas 20 = 242. É o limite exato, e é por isso que o `%`
       precisa sair antes — coluna de APOIO sai, a que responde fica. */
    colMin: 3,
    colPadrao: 4,
  },
  {
    id: "pagamentos",
    titulo: "Formas de pagamento",
    descricao: "Como os compradores pagaram",
    zona: "paineis",
    colMin: 3, // mesma conta de `produtos` — mesmo componente, mesmas colunas
    colPadrao: 4,
  },
  {
    id: "posicionamento",
    titulo: "Vendas por posicionamento",
    /* 🔴 ELE EXISTIA NO `blocks.ts` ANTIGO e não entrou no catálogo novo. O dado
       nunca sumiu: `computeDashboard` devolve `byPlacement` e o hook o expõe
       como `v.placements` desde sempre — eram **6 leitores e nenhuma tela**, que
       é o mesmo padrão do `Sale.apiCredentialId`. */
    descricao: "Feed, Stories, Reels — onde o anúncio converteu",
    zona: "paineis",
    colMin: 3, // mesma conta de `produtos`
    colPadrao: 4,
  },
  {
    id: "vendas-por-dia",
    alturaAjustavel: true,
    linhasMin: 4,
    titulo: "Vendas por dia",
    descricao: "Quantas vendas e quanto faturou em cada dia",
    zona: "paineis",
    /* 4 → ~318px. Com 30 dias dá ~10px por passo, que ainda desenha barra com
       folga. Abaixo disso as barras ficam mais finas que o raio de 6px do §4 e
       o gráfico vira uma serrilha. */
    colMin: 4,
    colPadrao: 6,
  },
  {
    id: "vendas-por-hora",
    alturaAjustavel: true,
    linhasMin: 4,
    titulo: "Vendas por horário",
    descricao: "As 24 horas do período filtrado",
    zona: "paineis",
    colMin: 4, // 24 barras em ~318px = 13px de passo
    colPadrao: 6,
  },
  {
    id: "lucro-por-hora",
    alturaAjustavel: true,
    linhasMin: 4,
    titulo: "Lucro por horário",
    descricao: "Receita menos a fatia de custo daquela hora",
    zona: "paineis",
    colMin: 4, // idem `vendas-por-hora`
    colPadrao: 6,
  },
  {
    id: "aprovacao",
    titulo: "Taxa de aprovação",
    descricao: "Quanto de cada forma de pagamento é aprovado",
    zona: "paineis",
    /* 3 → ~237px. São medidores radiais lado a lado; o componente já é
       `auto-fit`, então com três formas ele quebra em duas linhas em vez de
       espremer. Medidor não tem texto longo — encolhe bem. */
    colMin: 3,
    colPadrao: 4,
  },
  {
    id: "atividade",
    alturaAjustavel: true,
    linhasMin: 4,
    titulo: "Atividade recente",
    descricao: "Os últimos eventos de venda e rastreamento",
    zona: "paineis",
    /* 3 → ~237px, com a origem já fora pela container query abaixo de 320px. */
    colMin: 3,
    colPadrao: 4,
  },
  {
    id: "top-campanhas",
    alturaAjustavel: true,
    linhasMin: 4,
    titulo: "Top campanhas",
    descricao: "As que mais faturaram no período",
    zona: "paineis",
    /* 🔴 ERA LARGURA CHEIA E NÃO PRECISAVA — quatro colunas de número e duas
       linhas ocupando 12 colunas.

       4 → ~318px, e o que sustenta é a ordem de sacrifício das colunas: nome
       (~120) + Receita (78) + ROAS (78) + folgas (20) = 296. `Vendas` e `Gasto`
       saem por container query, nessa ordem — são apoio; Receita é a resposta e
       ROAS é o julgamento. */
    colMin: 4,
    colPadrao: 6,
  },
  {
    id: "heatmap",
    alturaAjustavel: true,
    linhasMin: 4,
    titulo: "Quando compram",
    descricao: "Média por hora, por dia da semana",
    zona: "paineis",
    /* 🔴 5 → ~400px, e o número desceu de "largura cheia" porque **a célula
       deixou de ser 18px fixos**. Ela agora é fluida entre 11 e 30px, derivada
       da largura do bloco — a régua é 24 células + 24 folgas de 3px + o rótulo
       do dia (~36px).

       Com célula de 11px: 24×11 + 24×3 + 36 = 372px. Com 12px: 396px. O piso de
       11px é onde a folga de 3px passa a ser um quarto do passo e a grade lê
       como listra em vez de mapa. 5 colunas dão 400 — o primeiro degrau que
       cabe com folga. */
    colMin: 5,
    colPadrao: 8,
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
 * Os quatro que não podem ser ocultados, DERIVADOS do catálogo.
 *
 * ⛔ Era uma lista `ESTRUTURAIS_META` escrita à mão, paralela ao catálogo, com
 * `id`, `titulo` e `motivo` repetidos. Segunda fonte para a mesma pergunta:
 * mudar o título de um bloco em um lugar e não no outro dava dois nomes para o
 * mesmo painel — um na tela, outro no modo de edição.
 *
 * ⚠️ **Só o `estrutural` decide.** Não existe lista de ids em lugar nenhum;
 * marcar um bloco é acrescentar a frase, e desmarcar é apagá-la.
 */
/* ⚠️ O `as readonly MetaBloco[]` não é preguiça: o `as const` faz de
   `CATALOGO_META` uma tupla de tipos LITERAIS, e `estrutural` só existe em
   quatro deles. Sem o alargamento, ler a propriedade num membro que não a tem é
   erro de tipo — mesmo sendo `?` na interface. */
export const ESTRUTURAIS = (CATALOGO_META as readonly MetaBloco[]).filter((b) => b.estrutural);

/**
 * Garante que os estruturais estejam presentes numa lista de painéis, **sem
 * mexer na ordem, na largura nem na altura dos que já estão**.
 *
 * 🔴 É AQUI QUE "NÃO PODE SER OCULTADO" DEIXA DE SER UMA PROMESSA. A ausência do
 * ✕ na tela cobre o usuário de hoje; ela não cobre um layout gravado por uma
 * versão anterior (que não tinha estes blocos na zona), editado à mão, ou de uma
 * conta cujo `paineis` foi truncado. Sem a reposição, "estrutural" valeria
 * enquanto ninguém tivesse um salvo antigo — que é exatamente o tipo de garantia
 * que este projeto já pagou para não fazer de novo.
 *
 * ⚠️ Os que faltam entram **no fim**, com o `colPadrao` deles. Inseri-los na
 * posição "certa" exigiria adivinhar uma intenção que o salvo não tem, e mudaria
 * de lugar os blocos que o usuário arrastou.
 */
export function reporEstruturais(paineis: readonly { id: string; col: number; linhas?: number }[]) {
  const lista = [...paineis];
  for (const b of ESTRUTURAIS) {
    if (lista.some((p) => p.id === b.id)) continue;
    lista.push({ id: b.id, col: b.colPadrao, linhas: encaixarLinhas(undefined, b) });
  }
  return lista;
}
