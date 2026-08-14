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

/* ⛔ `Zona` FOI APAGADA — F5, 12/08/2026. Ela dizia que um bloco só podia viver
   num de três lugares (`hero` | `faixa` | `paineis`), e as três zonas deixaram
   de existir: há **uma grade**, e KPI hero, métrica compacta e painel são o
   mesmo objeto, diferindo por `colMin`/`colPadrao`/`hMin`/`hPadrao`.

   ⚠️ O tipo não foi mantido "por compatibilidade" nem renomeado: enquanto ele
   existisse, o arrasto teria uma regra de compatibilidade para aplicar, e a
   próxima pessoa a ler o arquivo encontraria a categoria que a F5 dissolveu
   ainda descrita como se valesse. Proibição que muda é apagada. */

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

import { chaveDoId, idDaMetrica, METRICAS, type IdMetrica, type MetaMetrica } from "./metricas";

/** Colunas da grade. Doze porque é o único número que divide por 2, 3, 4 e 6. */
export const COLUNAS_GRADE = 12;

/**
 * 🔴 A CÉLULA DA GRADE — 80px de altura, 16px de gap, passo de 96.
 *
 * A F1 (`docs/design/07`) inverteu de onde vem a altura: ela era do CONTEÚDO
 * (`linhas` virava `minHeight`, um PISO) e passou a ser do LAYOUT (`h` vira
 * `grid-row: span h`, uma altura EXATA). O `--tk-row` do `globals.css` tem de
 * valer `ALTURA_CELULA` — são o mesmo número em dois arquivos, e é a única cópia
 * que sobrou. Há asserção sobre isso em `npm run test:grade`.
 */
export const ALTURA_CELULA = 80;
export const GAP_GRADE = 16;
/** Célula + gap. É o divisor de TODA conversão px → células. */
export const PASSO_CELULA = ALTURA_CELULA + GAP_GRADE;
/** Teto de altura, em células. 12 × 96 já passa de qualquer viewport útil. */
export const ALTURA_MAX = 12;

/**
 * 🔴 A UNIDADE ANTIGA, e ela existe SÓ para a migração ler o campo `linhas`.
 *
 * ⛔ Não use isto para desenhar nada. `linhas` está gravado em unidade de 44px e
 * a grade nova é de 96 — **comparar os dois números crus dobra a altura**:
 * `linhas: 8` significa 352px hoje, e 8 células significariam 752px. É a parte
 * da migração que importa, e o motivo importa mais que a fórmula: sem ele, a
 * próxima mudança desta constante repete o erro com a fórmula ainda "certa".
 */
export const ALTURA_LINHA_ANTIGA = 44;

/** Altura em px de um slot de `h` células, com os gaps internos. */
export function pxDeCelulas(h: number): number {
  return h * ALTURA_CELULA + (h - 1) * GAP_GRADE;
}

/**
 * Quantas células cobrem uma altura em px.
 *
 * ⚠️ O `+ GAP_GRADE` no numerador não é folga: uma altura de `n` células mede
 * `n × 80 + (n−1) × 16`, e somar um gap ao medido é o que faz a divisão por 96
 * fechar exata. Sem ele, 192px (3 células menos os gaps) daria 2.
 */
export function celulasDePx(px: number): number {
  if (!Number.isFinite(px) || px <= 0) return 1;
  return Math.max(1, Math.ceil((px + GAP_GRADE) / PASSO_CELULA));
}

export interface MetaBloco {
  id: string;
  titulo: string;
  /** Uma linha dizendo o que o bloco responde. Vai para o painel de escolha. */
  descricao: string;
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
   * 🔴 A ALTURA PASSOU A SER PROPRIEDADE DO LAYOUT — F1, 12/08/2026.
   *
   * ⛔ **`alturaAjustavel` e `linhasMin` SAÍRAM, e não foram renomeados.** Eles
   * diziam que só alguns blocos tinham altura e que o conteúdo era o piso dela.
   * As duas afirmações deixaram de valer: **todo** bloco declara `h` em células,
   * e é o slot que manda. Manter os nomes antigos ao lado dos novos deixaria
   * legível a regra que caiu — que é como uma proibição envelhecida vira ordem
   * de reverter.
   *
   * O argumento que sustentava o piso ("um bloco VAZIO reservava as 6 linhas que
   * teria com dado") continua valendo, e quem responde por ele agora é a
   * **condição F0**: bloco sem dado colapsa para
   * `min(h, celulasDePx(altura do vazio DAQUELE bloco))`, na renderização, sem
   * tocar no `h` salvo.
   *
   * ### ⚠️ `hMin` E `hPadrao` SÃO IGUAIS HOJE, DE PROPÓSITO — e isso tem preço
   *
   * Os dois saem da **medição F0b** (§11 do `07`): a altura que o bloco de fato
   * ocupava na grade em `auto`, no maior entre 1280 e 2260. Decisão do dono:
   * *"`hMin` provisório = h migrado, e só baixa com a F3 do bloco"*.
   *
   * O preço é real e fica escrito: **enquanto forem iguais, o bloco não encolhe
   * abaixo do padrão** — a alça só cresce. Isso é honesto agora (o conteúdo não
   * cabe em menos) e deixa de ser no dia em que a F3 daquele bloco entregar a
   * versão compacta. **Baixar `hMin` sem a F3 é prometer uma largura em que o
   * bloco não se lê**, que é o mesmo defeito do `colMin` sem container query.
   *
   * ⛔ Não derive um do outro nem colapse os dois num campo só: eles vão divergir
   * bloco a bloco, e o commit que baixa um sem o outro precisa ser visível.
   */
  hMin: number;
  hPadrao: number;
}

/* 🔴 ESTE COMENTÁRIO DIZIA O CONTRÁRIO, E A F5 O DERRUBOU (12/08/2026).
   Ele afirmava: *"Hero e faixa NÃO estão aqui: são listas de MÉTRICA, não de
   bloco. Misturar os dois faria o painel de escolha oferecer 'Faturamento' e
   'Vendas por país' na mesma lista."*

   É exatamente o que o painel de escolha faz agora, e é o pedido: **uma grade
   só, um catálogo só, sem vaga reservada.** A premissa que sustentava a
   separação era que métrica e painel tinham naturezas diferentes — e não têm:
   os dois ocupam um retângulo da grade, os dois declaram mínimo e padrão, os
   dois são arrastáveis. O que os separava eram os TETOS (4 heros, 8 na faixa),
   e os tetos caíram.

   ⚠️ A lista abaixo é só a metade dos PAINÉIS. O `CATALOGO_META`, logo depois,
   é a união dela com as métricas — e é ele que a tela e o arrasto consomem. */
const PAINEIS_META = [
  /* ── OS QUATRO ESTRUTURAIS ────────────────────────────────────────────────
     Eles vêm PRIMEIRO na lista porque a ordem daqui é a do layout padrão de
     conta nova, e a leitura da tela começa por eles. ⚠️ Não é uma segunda
     categoria: o que os separa é uma string a mais (`estrutural`). */
  {
    id: "receita-gasto",
    hMin: 3,
    hPadrao: 3,
    titulo: "Receita vs. gasto",
    descricao: "As duas séries no tempo, com a linha de break-even",
    /* 4 → ~318px. Cabe o cabeçalho (título ~120px + `Diário|Semanal` ~130px) e
       uma linha com ~5 rótulos de eixo. Abaixo disso o eixo vira uma régua de
       datas cortadas, e a série deixa de dizer QUANDO. */
    colMin: 4,
    colPadrao: 8,
    estrutural: "É a leitura central do painel — sem ela a tela não responde nada.",
  },
  {
    id: "alertas",
    hMin: 4,
    hPadrao: 4,
    titulo: "Alertas",
    descricao: "O que exige ação agora",
    /* 3 → ~237px. A linha é círculo de 28px (§13) + texto: sobram ~200px para o
       título do alerta, que quebra em duas linhas sem perder nada. Lista de
       texto é o formato que menos sofre com largura. */
    colMin: 3,
    colPadrao: 4,
    estrutural: "Alerta que dá para esconder é alerta que ninguém vê.",
  },
  {
    id: "paises",
    hMin: 4,
    hPadrao: 4,
    titulo: "Vendas por país",
    descricao: "De onde vem o faturamento",
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
    hMin: 3,
    hPadrao: 3,
    titulo: "Estado do sistema",
    descricao: "Integrações, regras, taxas e última atualização",
    /* 3 → ~237px. O `StatusFooter` já é `auto-fit minmax(200px, 1fr)`: ele
       reflui para uma coluna sozinho. 200px é o piso do próprio componente. */
    colMin: 3,
    colPadrao: 12,
    estrutural: "Diz se a ferramenta está funcionando. Não é sobre dinheiro.",
  },

  /* ── OS OPCIONAIS ─────────────────────────────────────────────────────── */
  {
    id: "funil",
    hMin: 5,
    hPadrao: 5,
    titulo: "Funil",
    /* ⚠️ O subtítulo LISTA as etapas, então ele envelhece junto com elas. Ele
       omitia `Sessões` desde que a etapa entrou — dois textos vizinhos
       descrevendo o mesmo dado, e o errado era o que prometia a coisa mais
       simples do que ela é. */
    descricao: "Cliques → sessões → checkouts → vendas iniciadas e aprovadas",
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
    hMin: 3,
    hPadrao: 3,
    titulo: "Origem do faturamento",
    /* 🔴 ABSORVEU O BLOCO "CANAIS" (07/08/2026). Os dois liam `v.sources` — o
       MESMO array, a mesma dimensão (`utm_source` do clique) — e desenhavam
       rosca e lista da mesma coisa. Não é uma junção de coisas parecidas: era
       um dado só, exibido duas vezes na mesma tela. */
    descricao: "De qual canal veio o faturamento",
    /* 3 → ~237px. Sem coluna de contagem: nome ~90 + receita 78 + % 44 + folgas
       ~25 = 237. E o `%` sai por container query abaixo de 320px úteis, o que dá
       folga real. A rosca é quadrada e cabe em qualquer largura. */
    colMin: 3,
    colPadrao: 4,
  },
  {
    id: "produtos",
    hMin: 3,
    hPadrao: 3,
    titulo: "Produtos",
    descricao: "Quais produtos faturaram mais",
    /* 3 → ~237px, com o `%` já fora pela container query: nome ~90 + vendas 54
       + receita 78 + folgas 20 = 242. É o limite exato, e é por isso que o `%`
       precisa sair antes — coluna de APOIO sai, a que responde fica. */
    colMin: 3,
    colPadrao: 4,
  },
  {
    id: "pagamentos",
    hMin: 3,
    hPadrao: 3,
    titulo: "Formas de pagamento",
    descricao: "Como os compradores pagaram",
    colMin: 3, // mesma conta de `produtos` — mesmo componente, mesmas colunas
    colPadrao: 4,
  },
  {
    id: "posicionamento",
    hMin: 3,
    hPadrao: 3,
    titulo: "Vendas por posicionamento",
    /* 🔴 ELE EXISTIA NO `blocks.ts` ANTIGO e não entrou no catálogo novo. O dado
       nunca sumiu: `computeDashboard` devolve `byPlacement` e o hook o expõe
       como `v.placements` desde sempre — eram **6 leitores e nenhuma tela**, que
       é o mesmo padrão do `Sale.apiCredentialId`. */
    descricao: "Feed, Stories, Reels — onde o anúncio converteu",
    colMin: 3, // mesma conta de `produtos`
    colPadrao: 4,
  },
  {
    id: "vendas-por-dia",
    hMin: 3,
    hPadrao: 3,
    titulo: "Vendas por dia",
    descricao: "Quantas vendas e quanto faturou em cada dia",
    /* 4 → ~318px. Com 30 dias dá ~10px por passo, que ainda desenha barra com
       folga. Abaixo disso as barras ficam mais finas que o raio de 6px do §4 e
       o gráfico vira uma serrilha. */
    colMin: 4,
    colPadrao: 6,
  },
  {
    id: "vendas-por-hora",
    hMin: 3,
    hPadrao: 3,
    titulo: "Vendas por horário",
    descricao: "As 24 horas do período filtrado",
    colMin: 4, // 24 barras em ~318px = 13px de passo
    colPadrao: 6,
  },
  {
    id: "lucro-por-hora",
    hMin: 3,
    hPadrao: 3,
    titulo: "Lucro por horário",
    descricao: "Receita menos a fatia de custo daquela hora",
    colMin: 4, // idem `vendas-por-hora`
    colPadrao: 6,
  },
  {
    id: "aprovacao",
    hMin: 3,
    hPadrao: 3,
    titulo: "Taxa de aprovação",
    descricao: "Quanto de cada forma de pagamento é aprovado",
    /* 3 → ~237px. São medidores radiais lado a lado; o componente já é
       `auto-fit`, então com três formas ele quebra em duas linhas em vez de
       espremer. Medidor não tem texto longo — encolhe bem. */
    colMin: 3,
    colPadrao: 4,
  },
  {
    id: "atividade",
    hMin: 4,
    hPadrao: 4,
    titulo: "Atividade recente",
    descricao: "Os últimos eventos de venda e rastreamento",
    /* 3 → ~237px, com a origem já fora pela container query abaixo de 320px. */
    colMin: 3,
    colPadrao: 4,
  },
  {
    id: "top-campanhas",
    hMin: 4,
    hPadrao: 4,
    titulo: "Top campanhas",
    descricao: "As que mais faturaram no período",
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
    hMin: 5,
    hPadrao: 5,
    titulo: "Quando compram",
    descricao: "Média por hora, por dia da semana",
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

/* ══ AS MÉTRICAS COMO BLOCO — F5, 12/08/2026 ════════════════════════════════
   🔴 ELAS SÃO DERIVADAS, NÃO ESCRITAS. Quinze entradas copiadas à mão aqui
   seriam quinze lugares para o próximo commit esquecer — e o esquecimento é
   mudo: a métrica sai do catálogo lateral e o usuário conclui que ela não
   existe mais. Derivar de `METRICAS` faz a lista não poder divergir de si mesma.

   ⚠️ **O `render` também é derivado da MESMA lista** (`catalogoRender.tsx`), e é
   isso que preserva a regra de entrada do topo deste arquivo: um id de métrica
   não consegue existir aqui sem existir lá, porque os dois saem do mesmo `map`.
   O `Record<IdBloco, …>` continua cobrando a metade escrita à mão — os painéis.
   Há asserção de cobertura sobre os DOIS em `npm run test:blocos-vazios`.

   ### ⛔ POR QUE `colMin: 2`, e não o `wMin: 1` da §3 do `07`

   Uma coluna dá ~42px úteis numa janela de 1440 com o rail aberto. Não cabe
   "Faturamento" nem "R$ 12.345,00": o bloco quebraria numa largura que ele
   próprio DECLARA, que é a definição de mínimo mentiroso deste catálogo. Duas
   colunas dão ~140px, que é o `minWidth: 132` que a faixa de Resumo usava — o
   número medido de onde a leitura compacta ainda funciona.

   ### As duas leituras, e o que decide qual aparece

   | `hPadrao` | Como desenha |
   |---|---|
   | 2 (destaque) | rótulo, número grande, pílula, sparkline, legenda |
   | 1 | rótulo, número, pílula — e nada mais cabe em 80px |

   ⛔ Não é um campo `variante`. Quem decide é a ALTURA DO SLOT, por container
   query: esticar uma métrica comum para 2 células dá o sparkline, e encolher um
   destaque para 1 dá a leitura compacta. Um campo separado seria uma segunda
   verdade sobre o mesmo retângulo, e ela divergiria no primeiro arrasto. */
/* ⚠️ O alargamento para `readonly MetaMetrica[]` é o mesmo caso do `ESTRUTURAIS`
   de antes da F5: o `as const` faz de `METRICAS` uma tupla de tipos LITERAIS, e
   `destaque` só existe em quatro membros. Sem ele, ler a propriedade num membro
   que não a tem é erro de tipo — mesmo sendo `?` na interface. */
const METRICAS_META: readonly MetaBloco[] = (METRICAS as readonly MetaMetrica[]).map((m) => ({
  id: idDaMetrica(m.chave),
  titulo: m.rotulo,
  descricao: m.descricao,
  colMin: 2,
  colPadrao: 3,
  /* ⚠️ `hMin: 1` é o único mínimo de altura honesto de toda a base: a leitura
     compacta CABE em uma célula, e há container query que a produz. É o
     contraste com os painéis, cujo `hMin` é a medição F0b justamente porque
     eles ainda não têm versão compacta — ver o campo `hMin` acima. */
  hMin: 1,
  hPadrao: m.destaque ? 2 : 1,
}));

/**
 * 🔴 O CATÁLOGO INTEIRO — painéis e métricas na MESMA lista, sem vaga reservada.
 *
 * A ordem é painéis primeiro porque é a ordem em que este arquivo sempre foi
 * lido; ela **não** decide o layout padrão (quem decide é `PADRAO_DA_GRADE`, em
 * `layout/migrar.ts`) nem a ordem do catálogo lateral, que separa os dois grupos
 * por uma razão de escolha, não de estrutura.
 */
export const CATALOGO_META: readonly MetaBloco[] = [...PAINEIS_META, ...METRICAS_META];

/** Os ids de painel — a metade escrita à mão, e a que o `Record` dos renders cobra. */
export type IdPainel = (typeof PAINEIS_META)[number]["id"];
/** Todo id de bloco: painel ou métrica. */
export type IdBloco = IdPainel | IdMetrica;

/** `true` quando o bloco é uma métrica. Quem responde é o prefixo do id. */
export function ehBlocoDeMetrica(id: string): boolean {
  return chaveDoId(id) !== undefined;
}

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
 * Encaixa uma altura CRUA (a que o arrasto produziu) em células inteiras, entre
 * o `hMin` do bloco e o teto.
 *
 * ⛔ **Devolve SEMPRE um número.** A versão anterior (`encaixarLinhas`) devolvia
 * `undefined` para a maioria dos blocos, e esse `undefined` era o que fazia a
 * grade cair na altura do conteúdo. Isso acabou: todo bloco tem altura.
 *
 * ⚠️ `undefined` continua existindo no LAYOUT, e significa outra coisa agora:
 * *"este bloco ainda não foi migrado"* — ver `PainelGrade.h`. É estado de
 * transição, não a ausência de alça.
 */
export function encaixarAltura(bruto: number | undefined, meta: MetaBloco): number {
  if (bruto === undefined || !Number.isFinite(bruto)) return meta.hPadrao;
  return Math.max(meta.hMin, Math.min(ALTURA_MAX, Math.round(bruto)));
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
/* ⚠️ O `as readonly MetaBloco[]` que havia aqui saiu junto com a F5: o
   `CATALOGO_META` deixou de ser tupla literal (ele é a união de duas listas) e
   já chega alargado. Manter o `as` seria um cast que não converte nada — e cast
   inútil é o tipo de coisa que a próxima pessoa lê como "aqui tem uma sutileza"
   e preserva por medo. */
export const ESTRUTURAIS = CATALOGO_META.filter((b) => b.estrutural);

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
export function reporEstruturais(paineis: readonly { id: string; col: number; h?: number }[]) {
  const lista = [...paineis];
  for (const b of ESTRUTURAIS) {
    if (lista.some((p) => p.id === b.id)) continue;
    /* ⚠️ O reposto nasce com `hPadrao` — ele nunca existiu no salvo, então não
       há altura de usuário para preservar nem migração pendente para esperar. */
    lista.push({ id: b.id, col: b.colPadrao, h: b.hPadrao });
  }
  return lista;
}
