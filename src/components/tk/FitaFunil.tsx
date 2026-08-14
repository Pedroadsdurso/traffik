"use client";

import * as React from "react";
import { calcularFluxo, caminhoDaFita, segmentosDaFita } from "@/lib/funil/fita";

/**
 * FUNIL DE CONVERSÃO — só a fita, e a perda em número.
 *
 * Referência literal: `docs/design/referencias/16-funil-referencia.png`.
 *
 * ### 🔴 A PERDA NÃO É DESENHADA — o fundo é FUNDO, não quantidade
 *
 * Cinco versões desenharam a perda como faixa cinza colada no fluxo. Com 97% de
 * queda isso pinta 97% do bloco de cinza e deixa o fluxo como um fio dentro da
 * massa — a figura fica pesada, e a ausência vira o sujeito visual. A
 * referência não tem uma única faixa de perda: ela respira porque só a fita
 * existe.
 *
 * A perda mora na **pílula da guia** (`−1.185 · 97,1%`), com precisão total.
 *
 * ### Os elementos, e onde cada um mora
 *
 * | | |
 * |---|---|
 * | nome da etapa | acima, pequeno, no centro da etapa |
 * | pílula de taxa | SOBRE a fita, centrada — o elemento mais visível |
 * | pílula de perda | ABAIXO da fita, ancorada na GUIA da transição |
 * | número absoluto | embaixo, grande e em negrito |
 * | guia vertical | ENTRE as etapas, não sobre elas |
 *
 * ⚠️ **As guias ficam entre as etapas.** Conferido na referência: guias em
 * x≈270/530/790/1048 e centros em ≈140/400/660/920/1180. Pôr a guia sobre a
 * etapa faria a pílula de perda apontar para uma etapa em vez de para a
 * transição — e perda é o que acontece ENTRE duas.
 *
 * ### 🔴 A COR NÃO SEGUE A REFERÊNCIA NA PONTA
 *
 * A referência vai de azul a ROSA. Aqui o rosa está perto demais do vermelho de
 * prejuízo, e a ponta direita é a VENDA — o objetivo. Pintar de quase-vermelho
 * afirmaria que chegar lá é ruim. A rampa vai do azul de marca a um violeta
 * mais claro da mesma família, e nunca encosta em verde nem em vermelho.
 *
 * ⚠️ Isto é um gradiente ao longo do COMPRIMENTO, e ele não codifica grandeza
 * nenhuma — codifica percurso, que é o que a figura é. Foi um gradiente de
 * OPACIDADE que quebrou a versão anterior, porque opacidade lê como
 * intensidade e ela subia enquanto a massa descia. Matiz ao longo de x não tem
 * esse problema: ninguém lê "mais violeta" como "mais quantidade".
 */

const MARGEM_X = 12;
/** Espaço acima da fita: os nomes das etapas E a pílula que não coube. */
const TOPO = 26 + 22 + 10;
/** Espaço abaixo da fita: pílula de perda, número absoluto e a composição. */
const RODAPE = 58 + 20;
/** Piso da altura da FAIXA (a fita em si), sem o topo e o rodapé. */
const FAIXA_MIN = 150;
/** Altura aproximada da cápsula: 2 × padding + a linha do `text-caption`. */
const ALTURA_PILULA = 22;
/** Quanto a pílula que saiu fica acima da fita — é o tamanho do traço. */
const FOLGA_PILULA = 10;

export interface EtapaEntradaFita {
  label: string;
  /** O valor cru. A fita mede com ele. */
  valor: number;
  /** Já formatado com separador de milhar — a tela não formata de novo. */
  valorFmt: string;
  /** De onde o número vem ("Meta Ads", "Gateway — status APROVADA"). */
  fonte?: string;
  /** Texto do `title` — o que a etapa conta, e por que difere de fontes vizinhas. */
  ajuda?: string;
  /** Linha sob o número absoluto: "11 do navegador". */
  composicao?: string;
  /**
   * 🔬 O QUE ESTA ETAPA MEDE — e é daqui que sai o rótulo da queda até ela.
   *
   * | valor | a queda até esta etapa significa |
   * |---|---|
   * | `comportamento` (padrão) | gente que **saiu**: abandono, recusa, desistência |
   * | `deteccao` | gente que o instrumento **não viu** — o comportamento pode ter acontecido |
   *
   * ## 🔴 Por que é um campo, e não um caso especial dos ICs
   *
   * A etapa de ICs vale só os checkouts que o navegador detectou, então a queda
   * `Sessões → ICs` inclui 24 sessões que **fizeram checkout** e o snippet não
   * viu. Chamar isso de perda é o mesmo erro de categoria que a fita tinha um
   * nível acima: forma e rótulo afirmando abandono onde houve cegueira do
   * instrumento — e é ele que manda o gestor otimizar a oferta quando o
   * problema é a instalação.
   *
   * ⛔ Corrigir só o texto desta etapa deixaria a próxima etapa de detecção
   * nascer com o rótulo errado. Declarando na FONTE, ela herda sozinha.
   */
  mede?: "comportamento" | "deteccao";
  /**
   * ✂️ A FONTE MUDA ANTES DESTA ETAPA — e a fita se PARTE aqui.
   *
   * O texto é o rótulo curto do corte (`"o gateway assume"`), e ele é
   * obrigatório: um vão sem rótulo é indistinguível de um bug de layout.
   *
   * ## O que o corte garante, e nada mais garante
   *
   * | | |
   * |---|---|
   * | a fita **não atravessa** | nenhum segmento engorda ao trocar de instrumento |
   * | a taxa fica `null` | não existe conversão entre medições de sistemas diferentes |
   * | não há pílula de perda | a diferença não é gente que sumiu, é discordância |
   *
   * ⛔ **Não use isto para "etapa que cresceu".** Crescer dentro do mesmo
   * instrumento é dado real e a fita deve mostrar. O corte é sobre a
   * PROCEDÊNCIA — só entra quando as duas etapas têm donos diferentes.
   */
  fonteMuda?: string;
  /**
   * A etapa aparece com NOME e NÚMERO, mas fica fora da geometria da fita.
   *
   * 🔴 O caso: `Cliques`. Ver `CoberturaFita` — a perda dele para `Sessões` é
   * instrumentação, não comportamento, e a escala dele esmagava o resto.
   */
  foraDaFita?: boolean;
  /**
   * 🔴 O TRECHO QUE SAI DESTA ETAPA NÃO FOI MEDIDO.
   *
   * Preenchido quando o valor desta etapa é DERIVADO da seguinte, e não de uma
   * fonte independente. O caso real: `ICs` cujo `Click.checkoutAt` foi todo
   * escrito pelo webhook do gateway — toda venda produz um IC, então a etapa
   * repete "Vendas iniciadas" e a conversão entre as duas seria 100% por
   * construção.
   *
   * ⛔ **A etapa NUNCA some por causa disto.** Etapa que desaparece muda a
   * forma do funil em silêncio, e a forma é o que a pessoa compara entre
   * períodos. É a mesma distinção do heatmap (célula não observada ≠ célula com
   * zero) e do denominador zero (`—` ≠ `0,00x`).
   *
   * A fita ATRAVESSA o trecho normalmente. Quem diz que ele não foi medido são
   * a guia tracejada e o marcador no rótulo — ver `guiasNaoMedidas`.
   */
  trechoNaoMedido?: string;
}

const pct1 = (t: number) => `${(t * 100).toFixed(1).replace(".", ",")}%`;

/**
 * 🕳️ A ETAPA NÃO MEDIDA NÃO ESTRANGULA A FITA — ela é INTERPOLADA.
 *
 * Com `ICs = 0` entre `Sessões = 22` e `Vendas iniciadas = 22`, a fita fechava
 * em nada e reabria: **gravata-borboleta**, que se lê como "todo mundo sumiu e
 * voltou". E é uma leitura impossível — 22 vendas não saem de 0 checkouts.
 *
 * Aqui a espessura daquele ponto vem dos vizinhos MEDIDOS mais próximos, então
 * a fita atravessa o trecho. O que declara a ausência são os três sinais que já
 * existem e não dependem da geometria: guia tracejada, `*` no rótulo com o
 * motivo no `title`, e a pílula de taxa de passo SUPRIMIDA.
 *
 * ⛔ **O VALOR EXIBIDO NÃO MUDA.** `valorFmt` continua sendo o que se mediu; o
 * que é interpolado é só a ESPESSURA. Trocar o número exibido por uma
 * estimativa seria a tela afirmando o que não mediu — o defeito que este bloco
 * inteiro existe para não cometer.
 *
 * ⚠️ Interpolação LINEAR entre os vizinhos medidos, não "copia o anterior": com
 * dois buracos seguidos, copiar produziria um degrau plano e depois uma queda
 * brusca — uma forma que ninguém mediu. A reta entre os dois extremos medidos é
 * a única curva que não inventa inflexão.
 *
 * ⚠️ Só interpola quem é não medido **E** vale zero. Uma etapa não medida com
 * valor positivo (o caso do `AVISO_SEM_PIXEL`: ICs derivados do gateway) tem um
 * número de verdade, e a geometria dele é legítima.
 */
export function interpolarNaoMedidas(
  etapas: Pick<EtapaEntradaFita, "valor" | "trechoNaoMedido">[],
): number[] {
  const brutos = etapas.map((e) => e.valor);
  const medido = etapas.map((e) => !(e.trechoNaoMedido && e.valor === 0));
  return brutos.map((v, i) => {
    if (medido[i]) return v;
    let a = i - 1;
    while (a >= 0 && !medido[a]) a--;
    let b = i + 1;
    while (b < brutos.length && !medido[b]) b++;
    /* Sem vizinho medido de um dos lados não há entre o que interpolar: usa o
       que existe, e sem nenhum, o valor cru. */
    if (a < 0 && b >= brutos.length) return v;
    if (a < 0) return brutos[b]!;
    if (b >= brutos.length) return brutos[a]!;
    return brutos[a]! + (brutos[b]! - brutos[a]!) * ((i - a) / (b - a));
  });
}

/**
 * Uma linha do canto: o que foi TIRADO do cálculo.
 *
 * 🔴 Declarar o que saiu é a disciplina deste projeto, e a referência faz o
 * mesmo ("119 acessos de robô removidos"). Sem isto, "removemos os robôs" é uma
 * afirmação que o usuário teria de aceitar no escuro — ele não consegue julgar
 * se o filtro exagera ou se falha.
 *
 * ⚠️ Só aparece quando há o que declarar. Uma linha fixa dizendo "0 removidos"
 * seria ruído em todo período limpo, e o que importa é o caso em que houve
 * remoção.
 */
/**
 * A COBERTURA DE RASTREAMENTO, no vão antes da fita (a coluna de `Cliques`).
 *
 * 🔴 Ela existe porque `Cliques → Sessões` NÃO É COMPORTAMENTO DO COMPRADOR —
 * é falha de instrumentação nossa. Com 97,1% de perda ali, pôr as duas
 * naturezas na mesma escala fazia a instrumentação quebrada engolir a figura
 * do comportamento: a fita despencava nos primeiros 15% da largura e virava um
 * fio reto no resto do bloco.
 *
 * Separada, ela ganha nos dois lados — a perda de rastreamento fica MAIS
 * visível com número grande e cor de atenção do que como pílula sob um blob, e
 * o funil volta a ser um funil.
 */
export interface CoberturaFita {
  /**
   * A fração rastreada, de 0 a 1. Desenha a barra. `null` = indefinido.
   *
   * 🔴 **NUMERADOR E DENOMINADOR SÃO OS DOIS DA META.** O numerador é
   * `visitasDaMeta`, não o total de sessões. Com o total, tráfego de `google`,
   * `organico` e `tiktok` entrava num numerador cujo denominador só cobre a
   * Meta — medido no dev, **20 de 57 sessões (35%)**. A razão perdia o
   * intervalo `[0,1]` e virava discordância entre instrumentos com cara de
   * taxa.
   */
  fracao: number | null;
  /** Só o número, para o display grande: `"2,9%"`. */
  pct: string;
  /** `"1.185 cliques perdidos"`. Ausente quando não se perdeu ninguém. */
  perdidos?: string;
  /** As causas — bloqueador, redirect que come a UTM, snippet ausente. */
  ajuda?: string;
  /**
   * 🔢 A SEGUNDA LINHA — CONTAGEM, nunca razão.
   *
   * `"20 sessões de outras origens"`. Elas não têm denominador nenhum aqui: não
   * existe "cliques do Google" nesta base, então qualquer percentual sobre elas
   * seria inventado. Ausente quando todo o tráfego veio da Meta.
   */
  outrasOrigens?: string;
  /**
   * ⚠️ A JANELA, declarada só quando as duas pontas NÃO se cobrem.
   *
   * `"cliques de 30/07 a 12/08 · sessões de 04/08 a 07/08"`. Sem isso a razão
   * cai por dias em que ninguém poderia ter sido rastreado, e a tela não dá
   * nenhum sinal de que a comparação é torta.
   *
   * ⛔ Recortar o denominador para casar as janelas seria pior: inventaria uma
   * cobertura melhor que a medida. Declarar é o que o produto já faz com o ROAS
   * que mistura populações.
   */
  janela?: string;
}

/**
 * Abaixo desta cobertura o número ganha COR DE ATENÇÃO.
 *
 * ## Por que 25%, e não 50 ou 70
 *
 * O denominador é `DailyAdMetric.clicks`, que é o **`clicks` da Meta** — TODOS
 * os cliques no anúncio, não só os que abrem a página: reação, comentário,
 * compartilhamento, toque no nome da página, expandir imagem, "ver mais". Em
 * campanha de Feed o clique de link costuma ser só **40–70%** do total.
 *
 * Sobre os que de fato abrem a página ainda incidem bloqueador, ITP do Safari e
 * quem sai antes de o script rodar — outros 10–25%.
 *
 * Multiplicando os dois piores casos plausíveis de uma conta **saudável**:
 * `0,40 × 0,75 ≈ 30%`. Um limiar em 50% ou 70% pintaria de vermelho instalação
 * correta, e alarme que grita sem motivo é alarme que se aprende a ignorar —
 * a regra do projeto para o motor de regras vale aqui igual.
 *
 * **25% fica abaixo do que os dois mecanismos conhecidos explicam juntos.**
 * Cruzar para baixo dele significa que sobrou algo que eles não explicam, que é
 * exatamente o que um alerta deve dizer. Os 2,9% do dev passam longe.
 *
 * > ### 🔴 O LIMIAR É UM CURATIVO — o defeito está no DENOMINADOR
 * > `clicks` e a nossa tabela `Click` medem coisas diferentes: a razão entre
 * > eles não mede uma conversão, mede a **concordância entre dois
 * > instrumentos**. O conserto real é sincronizar `link_clicks` (ou
 * > `outbound_clicks`) no `sync.ts` e usar ESSE como denominador.
 * >
 * > ⚠️ **No dia em que isso acontecer, este número precisa SUBIR** — some a
 * > diluição de 40–70% e o piso saudável vai para ~75%. Um limiar de 25% sobre
 * > `link_clicks` deixaria de alarmar instalação de fato quebrada.
 */
export const LIMIAR_ATENCAO_COBERTURA = 0.25;

export interface ExclusaoFita {
  /** Já formatado e por extenso: "119 acessos de robô removidos". */
  texto: string;
}

export function FitaFunil({
  etapas,
  exclusoes = [],
  cobertura,
}: {
  etapas: EtapaEntradaFita[];
  exclusoes?: ExclusaoFita[];
  cobertura?: CoberturaFita;
}) {
  const caixaRef = React.useRef<HTMLDivElement | null>(null);
  const [desenho, setDesenho] = React.useState<HTMLDivElement | null>(null);
  const [largura, setLargura] = React.useState(0);
  const [alturaDisp, setAlturaDisp] = React.useState(0);

  /**
   * 🔴 O ESTADO DE FALHA DERIVA DE A MEDIÇÃO DESISTIR — não de "o componente
   * montou".
   *
   * A primeira versão usava um `montado` ligado por `useEffect(() => setX(true))`
   * só para saber que estava no cliente. Duas coisas erradas com isso:
   *
   * 1. **Ela respondia a pergunta errada.** "Montei" não é "não consegui medir";
   *    entre os dois há os ~0,5s do laço, em que largura zero é o normal — e
   *    nesse intervalo a tela afirmaria um defeito que ainda não existe.
   * 2. `setState` síncrono no corpo de um efeito dispara render em cascata, e o
   *    lint desta base recusa (`react-hooks/set-state-in-effect`).
   *
   * Agora quem acende é o próprio teto de 30 quadros, de dentro do `rAF` — que é
   * exatamente o instante em que a afirmação *"não consegui medir"* passa a ser
   * verdadeira. No servidor o laço nunca corre, então `desistiu` é `false` e
   * nada é declarado: largura zero ali é o normal, não um defeito.
   *
   * ⚠️ DECLARADO AQUI EM CIMA, antes do efeito que o usa. A ordem inversa
   * passou no `tsc` e foi a `no-use-before-define` que acusou — a mesma regra
   * que fechou as duas TDZ do `overview.ts`.
   */
  const [desistiu, setDesistiu] = React.useState(false);

  /**
   * ⚠️ A largura é MEDIDA, não derivada de breakpoint: o mesmo bloco pode ter 4
   * ou 12 colunas, e a espessura da fita é em px.
   *
   * ### 🔴 A MEDIÇÃO SÍNCRONA NÃO É REDUNDANTE COM O OBSERVER — 13/08/2026
   *
   * Esta effect era só `new ResizeObserver(...)`, e havia uma montagem em que
   * **ele nunca entregava nada**: `largura` ficava em `0` PARA SEMPRE, e como
   * toda a geometria e todos os rótulos moram atrás de `largura > 0`, o bloco
   * ficava com `<svg>` presente e vazio — nem fita, nem estado vazio.
   *
   * Medido na tela: `.tk-fita` com **1246×368** de caixa real e `largura` em 0.
   * Não saía com o dado chegando, **nem rolando o bloco para a viewport, nem
   * redimensionando o contêiner de verdade** — o que prova que o observer não
   * estava ligado naquela montagem, e não que ele estava atrasado.
   *
   * O caminho que reproduz é o NORMAL do usuário: o Dashboard abre em `Hoje`,
   * `Hoje` sem clique renderiza o `EmptyState`, e a troca para um período com
   * dado monta a fita. Quem abre o painel de manhã caía nisso todo dia.
   *
   * ⛔ **Não troque isto de volta por só o observer.** A leitura no commit é o
   * que torna a largura uma propriedade da ESTRUTURA (o elemento tem caixa,
   * logo tem largura) em vez de depender de um callback disparar — que é a
   * distinção *proteção por ESTRUTURA × por TIMING* que esta base já pagou.
   *
   * ⚠️ `getBoundingClientRect().width` nos DOIS caminhos, de propósito. O
   * `contentRect` do observer é a caixa de CONTEÚDO; misturar as duas medidas
   * faria a largura oscilar no primeiro `padding` que alguém puser na
   * `.tk-fita`, e o defeito seria de um pixel — invisível e permanente.
   */
  React.useLayoutEffect(() => {
    let vivo = true;
    let quadros = 0;
    let observado: Element | null = null;

    /* ⚠️ DECLARADO ANTES do `medir`, e não é estilo: `medir` lê `ro` no corpo,
       e a ordem inversa só funcionava porque `medir` nunca corre durante a
       avaliação do efeito. Isso é "não quebra" por circunstância, não "não pode
       quebrar" — a família que a `no-use-before-define` foi ligada para fechar,
       depois de duas TDZ derrubarem a `/api/ads` com 500 de corpo vazio.
       O `() => medir()` acima é legal: declaração de função é içada. */
    const ro = new ResizeObserver(() => medir());

    /* 🔴 LÊ `caixaRef.current` A CADA QUADRO, NUNCA UM NÓ CAPTURADO.
       Esta effect já teve `caixa` (um nó guardado em estado) no lugar do ref, e
       ela ficava presa num nó que **nunca ganha largura**: medido, 30 quadros de
       re-leitura seguiram devolvendo 0 enquanto o `.tk-fita` vivo no DOM media
       1246px. Ou seja, o nó observado não era o nó desenhado.
       `ref.current` acompanha a troca; um nó capturado no closure, não. */
    function medir() {
      if (!vivo) return;
      const el = caixaRef.current;
      if (el) {
        if (el !== observado) {
          if (observado) ro.unobserve(observado);
          ro.observe(el);
          observado = el;
        }
        const w = el.getBoundingClientRect().width;
        if (w > 0) {
          setLargura(w);
          return;
        }
      }
      /* ⚠️ Teto de 30 quadros (~0,5s). Laço sem teto vira CPU queimando para
         sempre num bloco que legitimamente pode ter largura 0 (contêiner
         escondido). Passado o teto quem fala é o estado de falha declarado
         abaixo — nunca o silêncio. */
      if (quadros++ < 30) requestAnimationFrame(medir);
      /* 🔴 O TETO ESTOUROU: aqui a medição DESISTIU, e é só aqui que o estado de
         falha pode ser declarado. Ver a nota do `desistiu` logo abaixo. */
      else setDesistiu(true);
    }

    medir();
    return () => {
      vivo = false;
      ro.disconnect();
    };
  }, []);


  /* 🔴 A ALTURA TAMBÉM É MEDIDA. A altura de um card não vem de container query
     nenhuma: ela vem do irmão mais alto da linha da grade, e não existe consulta
     sobre a altura de um irmão. Sem medir, um card esticado pelo vizinho deixa
     ar embaixo — e na referência a fita ocupa quase tudo. */
  /* ⚠️ Mesma correção da largura, e pelo mesmo motivo — ver o bloco acima. Este
     observer tem o modo de falha idêntico; ele só não foi o que apareceu porque
     a `faixaAlt` tem piso (`FAIXA_MIN`) e degrada para uma fita fina em vez de
     sumir. Um defeito que degrada é mais difícil de ver, não menos provável. */
  React.useLayoutEffect(() => {
    if (!desenho) return;
    const medir = () => setAlturaDisp(desenho.getBoundingClientRect().height);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(desenho);
    return () => ro.disconnect();
  }, [desenho]);

  const faixaAlt = Math.max(FAIXA_MIN, Math.round(alturaDisp) - TOPO - RODAPE);
  const alturaSvg = TOPO + faixaAlt + RODAPE;
  const centroY = TOPO + faixaAlt / 2;

  /**
   * 🕳️ A ETAPA NÃO MEDIDA NÃO ESTRANGULA A FITA — ela é INTERPOLADA.
   *
   * Com `ICs = 0` entre `Sessões = 22` e `Vendas iniciadas = 22`, a fita fechava
   * em nada e reabria: **gravata-borboleta**, que se lê como "todo mundo sumiu e
   * voltou". E é uma leitura impossível — 22 vendas não saem de 0 checkouts.
   *
   * Aqui a espessura daquele ponto vem dos vizinhos MEDIDOS mais próximos, então
   * a fita atravessa o trecho. O que declara a ausência são os três sinais que
   * já existem e não dependem da geometria: guia tracejada, `*` no rótulo com o
   * motivo no `title`, e a pílula de taxa de passo SUPRIMIDA.
   *
   * ⛔ **O VALOR EXIBIDO NÃO MUDA.** `valorFmt` continua sendo o que se mediu; o
   * que é interpolado é só a ESPESSURA. Trocar o número exibido por uma
   * estimativa seria a tela afirmando o que não mediu — o defeito que este
   * bloco inteiro existe para não cometer.
   *
   * ⚠️ Interpolação LINEAR entre os vizinhos medidos, não "copia o anterior":
   * com dois buracos seguidos, copiar produziria um degrau plano e depois uma
   * queda brusca, que desenha uma forma que ninguém mediu. A reta entre os dois
   * extremos medidos é a única curva que não inventa inflexão.
   */
  const valoresParaGeometria = React.useMemo(() => interpolarNaoMedidas(etapas), [etapas]);

  const fluxo = React.useMemo(
    () =>
      calcularFluxo(valoresParaGeometria, {
        largura,
        faixa: faixaAlt,
        margem: MARGEM_X,
        naFita: etapas.map((e) => !e.foraDaFita),
        corte: etapas.map((e) => e.fonteMuda != null),
      }),
    [valoresParaGeometria, etapas, largura, faixaAlt],
  );

  if (etapas.length === 0) {
    return (
      <p className="text-caption text-text-muted" style={{ margin: 0 }}>
        Sem dados de funil no período.
      </p>
    );
  }

  /**
   * 🔴 A GUARDA DE MEDIÇÃO DEIXOU DE SER SILENCIOSA — 13/08/2026.
   *
   * Tudo que desenha mora atrás de `largura > 0`. Enquanto isso era só o
   * primeiro quadro, o custo era um piscar; quando a medição NÃO CHEGAVA, o
   * mesmo `&&` produzia um card com título e **nada dentro, sem dizer por quê**.
   *
   * ⛔ A regra que fica: *guarda de "ainda não medi" não pode ser a mesma coisa
   * que "não há o que mostrar"*. Se a medição falhar, o bloco AFIRMA a falha —
   * ele nunca fica oco.
   *
   * ⚠️ `desistiu` é o que separa os dois casos, e ele é mais preciso que o
   * `montado` que estava aqui: no servidor o laço nunca corre, então nada é
   * declarado (e não há divergência de hidratação); no cliente ele só acende
   * depois de o teto de 30 quadros estourar, que é o instante em que *"não
   * consegui medir"* passa a ser verdade. Com `montado`, os ~0,5s do laço
   * contavam como falha — a tela afirmaria defeito enquanto ainda media.
   *
   * ⚠️ Com a leitura síncrona no `useLayoutEffect`, este ramo passou a ser rede
   * — não caminho. Se ele aparecer na tela de alguém, a medição falhou por um
   * motivo novo, e é para ele ser visto.
   */
  if (desistiu && largura === 0) {
    return (
      <p className="text-caption text-text-muted" style={{ margin: 0 }}>
        Não foi possível medir o espaço do bloco para desenhar o funil. Os números do período
        continuam corretos nos outros blocos — recarregue a página para ver a figura.
      </p>
    );
  }

  const xFim = Math.max(1, largura);

  /* Os trechos cuja conversão não foi MEDIDA: a etapa `i` declarou que o valor
     dela é derivado da seguinte. O trecho vai do centro dela ao centro da
     próxima — é exatamente o pedaço da fita cuja inclinação seria lida como
     conversão. */
  /* ⚠️ SEM filtro de largura aqui. Houve uma versão com `.filter(t => t.x1 >
     t.x0)`, e ela matava a PÍLULA junto com o retângulo: no servidor `largura`
     é 0, todos os x são 0, e o rótulo "não medido" sumia do markup. São duas
     coisas diferentes — a geometria precisa de largura, o rótulo não. O guarda
     ficou só no `<rect>`, que é quem degenera. */
  /* Só quem participa da geometria. */
  const etapasDaFita = fluxo.etapas.filter((e) => e.naFita);
  /* Os trechos CONTÍGUOS de mesma fonte — um `<path>` para cada. Sem corte
     nenhum devolve uma lista de um item, que é a fita inteira de antes. */
  const segmentos = segmentosDaFita(fluxo);
  /* ⚠️ `inicioDaFita` (o centro da 1ª etapa) VIVEU AQUI e foi DELETADO em
     07/08/2026 — resto da renomeação que separou "centro da etapa" de "borda da
     área". Ficou atribuído e sem leitor: o consumidor passou a ser
     `inicioDaPlotagem`, logo abaixo.

     ⛔ Não o traga de volta "por simetria". Foi a coexistência dos dois nomes
     para o mesmo conceito que produziu o único bug de AMBIGUIDADE DE NOME desta
     base — os dois são `number`, os dois são x válido, e a conta errada
     compilava. */

  /**
   * 🔴 A FITA NASCE NA BORDA DA ÁREA DE PLOTAGEM, não no centro de `Sessões`.
   *
   * Nascer no centro da primeira etapa desenhava uma PAREDE VERTICAL à
   * esquerda: a fita aparecia do nada com a espessura cheia. A referência
   * (`16-funil-referencia.png`) entra pela borda e sai pela borda — é o que faz
   * ela parecer desenhada em vez de montada.
   *
   * A borda aqui é o limite entre a coluna de `Cliques` (que não tem fita, e
   * onde mora a cobertura) e a coluna de `Sessões`: `margem + util/n`. Com
   * todas as etapas na fita ela cai em `margem`, que é o comportamento certo.
   */
  const larguraUtil = Math.max(0, largura - MARGEM_X * 2);
  const nEtapas = fluxo.etapas.length;
  const foraAntesDaFita = fluxo.etapas.findIndex((e) => e.naFita);
  const inicioDaPlotagem =
    nEtapas > 0 && foraAntesDaFita > 0
      ? MARGEM_X + (larguraUtil * foraAntesDaFita) / nEtapas
      : MARGEM_X;

  /* ⚠️ `null` NÃO é baixa cobertura — é cobertura indefinida (não houve clique).
     Tingir de atenção o que não foi medido afirmaria falha onde não houve
     tráfego, que é a mesma troca de "não sei" por "sei que é ruim". */
  const baixaCobertura =
    cobertura?.fracao != null && cobertura.fracao < LIMIAR_ATENCAO_COBERTURA;

  /* A faixa de cobertura só faz sentido quando existe o vão antes da fita — e
     quem responde isso é o DADO, não a largura medida. Ver o comentário na
     faixa. */
  const haEtapaForaDaFita = etapas.some((e) => e.foraDaFita);

  /**
   * 🔴 O NÃO MEDIDO DEIXOU DE SER UM BLOCO HACHURADO (07/08/2026).
   *
   * A hachura era honesta e **partia a fita ao meio**: ocupava um terço da
   * figura com textura pesada, e a fita virava três objetos soltos — retângulo
   * chapado, bloco hachurado, fita. A referência é UMA fita contínua de ponta a
   * ponta, e era essa continuidade que estava faltando.
   *
   * ⛔ A INFORMAÇÃO NÃO SAIU — só a forma. Ela passou a viver em dois lugares
   * discretos, e os dois continuam sendo sinal redundante (WCAG 1.4.1: nunca só
   * a cor, nunca só a textura):
   *
   * 1. a **guia daquele trecho fica TRACEJADA** em vez de sólida;
   * 2. o **rótulo da etapa ganha um marcador** (`*`) com o motivo no `title`.
   *
   * A fita atravessa o trecho normalmente, e é isso que se queria.
   *
   * ⚠️ A pílula de taxa de passo daquele trecho continua SUPRIMIDA — ver a
   * pílula de passo. É ela que impediria o `100,0%` lisonjeiro, e nada aqui
   * mexe nisso.
   */
  const guiasNaoMedidas = new Set(
    fluxo.etapas
      .map((_, i) => (etapas[i]?.trechoNaoMedido ? i : -1))
      .filter((i) => i >= 0),
  );

  /* A pílula é HTML, não `<text>` do SVG: cápsula com raio, padding e peso de
     fonte são três coisas que o SVG faria à mão. Como o `viewBox` é 1:1 com a
     altura renderizada (ver abaixo), as coordenadas valem nos dois. */
  const pilula = (fundo: string, cor: string): React.CSSProperties => ({
    position: "absolute",
    transform: "translate(-50%, -50%)",
    background: fundo,
    color: cor,
    borderRadius: 999,
    padding: "3px 10px",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    fontVariantNumeric: "tabular-nums",
  });

  return (
    /* ⚠️ `flex: 1` + `minHeight: 0` NA RAIZ, e não só no desenho. Medido em
       07/08/2026: o desenho crescia dentro de uma `.tk-fita` que era `flex: 0 1
       auto` e parava nos 234px do próprio mínimo, dentro de um pai com 421
       disponíveis. O `flex: 1` do filho não serve de nada enquanto o pai não
       cresce — e o sintoma era ~60px de ar em cima e ~65 embaixo.
       `minHeight: 0` é o que deixa a coluna encolher abaixo do conteúdo em vez
       de estourar o card. */
    <div
      ref={caixaRef}
      className="tk-fita"
      style={{ minWidth: 0, minHeight: 0, flex: 1, display: "flex", flexDirection: "column" }}
    >
      {/* ── Versão COMPACTA: só ela sobra abaixo de 360px ────────────────────
          A fita some por container query (o desenho fica ilegível e ainda
          ocuparia 200px de altura). Isto tem a mesma informação sem a forma.
          ⚠️ `.tk-fita-compacto` é escondido enquanto o desenho aparece — os
          dois nunca convivem, senão os números apareceriam duplicados. */}
      <div className="tk-fita-compacto" style={{ display: "none", flexDirection: "column", gap: 6 }}>
        {etapas.map((e, i) => (
          <div key={e.label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span className="text-caption text-text-secondary">{e.label}</span>
            <span className="text-caption" style={{ fontVariantNumeric: "tabular-nums" }}>
              <strong style={{ color: "var(--tk-text)" }}>{e.valorFmt}</strong>
              {fluxo.etapas[i]?.fracao != null && (
                <span className="text-text-muted"> · {pct1(fluxo.etapas[i]!.fracao!)}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* ── O que saiu do cálculo, no canto superior direito ─────────────────
          Discreto de propósito: é procedência, não resultado. Quem lê o bloco
          quer o funil; quem desconfia do funil quer isto, e vai procurar. */}
      {exclusoes.length > 0 && (
        <div
          className="text-caption text-text-muted"
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, marginBottom: 2 }}
        >
          {exclusoes.map((x) => (
            <span key={x.texto}>{x.texto}</span>
          ))}
        </div>
      )}

      <div
        ref={setDesenho}
        className="tk-fita-desenho"
        /* `flex: 1` + piso: a fita OCUPA a altura sobrando do card em vez de ter
           altura própria. Se o vizinho de linha esticou o card, ela estica. */
        style={{ position: "relative", flex: 1, minHeight: FAIXA_MIN + TOPO + RODAPE }}
      >
        {/* ⛔ `viewBox` 1:1 COM A ALTURA RENDERIZADA. Nada de esticar por
            `preserveAspectRatio`: nomes, pílulas e números são HTML posicionado
            nas mesmas coordenadas, e qualquer escala entre os dois os desalinha
            em silêncio. A fita cresce porque a GEOMETRIA foi recalculada com a
            altura medida, não porque o desenho foi esticado. */}
        <svg
          width="100%"
          height={alturaSvg}
          viewBox={`0 0 ${xFim} ${alturaSvg}`}
          role="img"
          aria-label={
            `Funil: ${etapas
              .map((e, i) => {
                const f = fluxo.etapas[i]?.fracao;
                return `${e.label} ${e.valorFmt}${f != null ? ` (${pct1(f)} do maior)` : ""}`;
              })
              .join(", ")}` +
            (fluxo.perdas.length
              ? `. Perdas: ${fluxo.perdas
                  .map(
                    (p) =>
                      `${p.valor.toLocaleString("pt-BR")} entre ${etapas[p.de]?.label} e ${etapas[p.de + 1]?.label}${p.pct != null ? ` (${pct1(p.pct)})` : ""}`,
                  )
                  .join(", ")}`
              : "")
          }
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id="tk-fita-rampa" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--tk-fluxo)" />
              <stop offset="100%" stopColor="var(--tk-fluxo-fim)" />
            </linearGradient>
          </defs>

          {/* As guias primeiro: a fita passa POR CIMA delas.

              🔴 A guia do trecho NÃO MEDIDO é TRACEJADA. É o que sobrou da
              hachura, e a troca foi de propósito — ver `guiasNaoMedidas`. */}
          {largura > 0 &&
            fluxo.guias.map((x, i) => (
              <line
                key={`guia-${i}`}
                x1={x}
                x2={x}
                y1={TOPO - 14}
                y2={TOPO + faixaAlt + 26}
                stroke={guiasNaoMedidas.has(i) ? "var(--tk-text-muted)" : "var(--tk-border)"}
                strokeWidth="1"
                strokeDasharray={guiasNaoMedidas.has(i) ? "3 4" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            ))}

          {/* 🔴 UM `<path>` POR SEGMENTO — a fita se PARTE onde a fonte muda.
              Antes era um caminho só, e ele atravessava a junção `ICs → Vendas
              Inic.` ENGORDANDO (38 → 57): a silhueta afirmava ganho de massa
              onde só houve troca de instrumento. Ver `segmentosDaFita`.

              ⚠️ Cada segmento estende até a borda do PRÓPRIO segmento, não da
              área toda: `x0` da área só no primeiro, `x1` da área só no último.
              Nas pontas internas a fita termina no centro da etapa, que é onde
              a medição daquele dono acaba. */}
          {largura > 0 &&
            segmentos.map((seg, i) => (
              <path
                key={`fita-${i}`}
                d={caminhoDaFita(seg, centroY, {
                  x0: i === 0 ? inicioDaPlotagem : seg[0]!.x,
                  x1: i === segmentos.length - 1 ? xFim : seg[seg.length - 1]!.x,
                })}
                fill="url(#tk-fita-rampa)"
              />
            ))}
        </svg>

        {/* ── A CAMADA DOS RÓTULOS ─────────────────────────────────────────────
            🔴 Ela renderiza SEMPRE e fica OCULTA até a primeira medida, em vez
            de não existir enquanto `largura === 0`.

            Duas razões, e as duas são melhorias de verdade:

            1. O `ResizeObserver` só corre no cliente, depois da pintura. Com
               `largura > 0 &&`, o primeiro quadro não tinha rótulo nenhum e
               eles apareciam de repente. Com `visibility`, o espaço já está
               reservado e nada salta.
            2. O markup do SERVIDOR passa a conter os textos. Sem isso não há
               como assertar "a pílula diz não medido" sem um DOM completo — e
               esta base não tem jsdom. A alternativa seria uma prop só de
               teste, que é pior: código de produção que existe para o teste.

            ⚠️ `visibility: hidden` e não `display: none`: o primeiro mantém a
            caixa, o segundo faria o layout pular quando os rótulos entrassem. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            visibility: largura > 0 ? "visible" : "hidden",
            pointerEvents: "none",
          }}
        >

        {/* ── A COBERTURA DE RASTREAMENTO, NO VÃO ANTES DA FITA ───────────────
            🔴 Ela mora ENTRE `Cliques` e o começo da fita, e isso é o desenho,
            não o aproveitamento de um buraco. Aquele vão é literalmente onde a
            perda de rastreamento acontece: à esquerda o que a Meta contou, à
            direita o que o nosso script viu. Pôr o número lá liga a perda à
            GEOMETRIA em vez de deixá-la solta num rodapé.

            ⛔ Ela tinha nascido como faixa fina de largura total acima da fita,
            com o número em texto apagado. Era a hierarquia ao contrário: o
            número mais grave da tela em `caption` secundário, enquanto um
            `100,0%` que não afirma nada levava pílula preta em negrito. Peso
            proporcional ao que se diz — e o que se diz aqui é "eu não estou
            enxergando 97% do meu tráfego".

            ⚠️ A condição é sobre o DADO (existe etapa fora da fita?), nunca
            sobre a LARGURA MEDIDA. `inicioDaFita > 0` pareceria equivalente e
            não é: no servidor a largura é 0, todos os x são 0, e a faixa sumiria
            do markup inicial — o mesmo buraco que o comentário da camada de
            rótulos descreve. A geometria precisa de medida; o texto, não. */}
        {cobertura && haEtapaForaDaFita && (
          <div
            title={cobertura.ajuda}
            style={{
              position: "absolute",
              left: MARGEM_X,
              /* ⚠️ Contra `inicioDaPlotagem`, NUNCA contra `inicioDaFita`. O
                 segundo é o CENTRO de `Sessões`, e usá-lo fazia a barra correr
                 por baixo da fita — a coluna da cobertura invadia meia coluna
                 da fita. Os dois são "onde a fita começa" em frases diferentes:
                 um é o centro da etapa, o outro é a borda da área. */
              width: Math.max(0, inicioDaPlotagem - MARGEM_X * 2),
              top: centroY,
              transform: "translateY(-50%)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              pointerEvents: "auto",
              cursor: cobertura.ajuda ? "help" : undefined,
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                /* ⛔ A cor de atenção é da COBERTURA, não do valor. Ela não diz
                   "prejuízo" — diz "esta medição não é confiável". Ver
                   `LIMIAR_ATENCAO_COBERTURA` para o porquê de 25%. */
                color: baixaCobertura ? "var(--tk-warning)" : "var(--tk-text)",
              }}
            >
              {cobertura.pct}
            </div>
            {/* 🔴 A RAZÃO DIZ DE QUAL POPULAÇÃO ELA FALA — "da Meta", explícito.
                Sem essas duas palavras o número parece cobrir o tráfego inteiro,
                e ele cobre só o pedaço que tem denominador. */}
            <div className="text-caption text-text-secondary" style={{ lineHeight: 1.3 }}>
              dos cliques da Meta rastreados
              {cobertura.perdidos && (
                <>
                  <br />
                  {cobertura.perdidos}
                </>
              )}
            </div>
            {/* O trilho é o total de cliques; o preenchido é o que virou sessão.
                ⚠️ SEM PISO. Com 2,9% ele é um talinho — e é essa a informação.
                Um piso aqui mentiria sobre exatamente o número em causa. */}
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: "var(--tk-surface-hover)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(1, cobertura.fracao ?? 0)) * 100}%`,
                  height: "100%",
                  background: baixaCobertura ? "var(--tk-warning)" : "var(--tk-fluxo)",
                }}
              />
            </div>

            {/* ── A SEGUNDA LINHA: CONTAGEM, e ela não tem barra ───────────────
                🔴 Ela é deliberadamente OUTRA grandeza. Estas sessões não têm
                denominador nesta base — não existe "cliques do Google" aqui —,
                então qualquer percentual sobre elas seria inventado. Dar-lhes
                trilho as faria parecer parte da mesma razão, que é exatamente a
                mistura que a linha de cima deixou de fazer.

                ⛔ Não a some ao numerador "para o número ficar melhor". Foi
                essa soma que fazia a cobertura falar de uma população que o
                denominador não cobre. */}
            {cobertura.outrasOrigens && (
              <div
                className="text-caption text-text-muted"
                style={{ lineHeight: 1.3 }}
                title={
                  "Sessões que não vieram de anúncio da Meta. Elas são rastreadas " +
                  "normalmente e contam no funil — mas ficam fora da razão acima, " +
                  "porque o denominador dela (cliques no anúncio) só existe para a Meta."
                }
              >
                {cobertura.outrasOrigens}
              </div>
            )}

            {/* ⚠️ A JANELA, só quando as duas pontas NÃO se cobrem. Silêncio
                aqui faria a razão cair por dias em que ninguém poderia ter sido
                rastreado, sem nada na tela dizendo que a comparação é torta. */}
            {cobertura.janela && (
              <div
                className="text-caption text-text-muted"
                style={{ lineHeight: 1.3, fontStyle: "italic" }}
                title={
                  "As duas medições não cobrem o mesmo intervalo de dias. A razão " +
                  "acima compara o que existe de cada lado — ela não foi recortada " +
                  "para casar as janelas, porque isso mostraria uma cobertura melhor " +
                  "do que a medida."
                }
              >
                {cobertura.janela}
              </div>
            )}
          </div>
        )}

        {/* ── Nome da etapa, ACIMA ─────────────────────────────────────────── */}
        {fluxo.etapas.map((e, i) => (
            <div
              key={`nome-${etapas[i]!.label}`}
              className="text-caption text-text-secondary"
              title={etapas[i]!.ajuda ?? etapas[i]!.fonte}
              style={{
                position: "absolute",
                left: e.x,
                top: 4,
                cursor: etapas[i]!.ajuda ? "help" : undefined,
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                fontWeight: 600,
              }}
            >
              {etapas[i]!.label}
              {/* 🔴 O MARCADOR DO NÃO MEDIDO — o segundo dos dois portadores da
                  informação, junto da guia tracejada. Redundante de propósito:
                  a guia sozinha seria "só a forma", e o WCAG 1.4.1 já custou
                  caro nesta base.

                  ⚠️ O texto "não medido" fica AQUI, visível, e não só no
                  `title`: `title` não aparece no toque e não sai em leitor de
                  tela em vários navegadores. O `*` é o chamariz; a palavra é a
                  informação; o `title` é a explicação. */}
              {etapas[i]!.trechoNaoMedido && (
                <span
                  title={etapas[i]!.trechoNaoMedido}
                  style={{
                    marginLeft: 5,
                    color: "var(--tk-text-muted)",
                    fontWeight: 500,
                    cursor: "help",
                    pointerEvents: "auto",
                  }}
                >
                  * não medido
                </span>
              )}
            </div>
          ))}

        {/* ── Pílula da TAXA DE PASSO, sobre o TRECHO ─────────────────────────
            🔴 TAXA DE PASSO, e não fração do máximo. A versão anterior mostrava
            `100,0% · 2,9% · 2,9% · 2,0%` — três quase iguais, e a única
            transição interessante do período (Vendas Inic. → Vendas Apr., 71,4%)
            não aparecia em lugar nenhum.

            O motivo é a regra do CANAL REDUNDANTE: fração do máximo é
            exatamente o que a ESPESSURA já diz. Um canal que varia junto com
            uma grandeza que a forma mostra ou concorda ou mente — aqui
            concordava, e ocupava o lugar da informação que faltava.

            A taxa de passo responde a pergunta do gestor — *"de quem chegou
            aqui, quantos passaram?"* — e é o que a fita não consegue dizer
            sozinha: ela mostra o tamanho, não a razão entre dois tamanhos.

            ⚠️ Ela mora na GUIA, não no centro da etapa, porque é uma
            propriedade do TRECHO — a pílula de perda mora embaixo da mesma guia.

            🔴 E ela mora SOBRE A FITA quando cabe, como na referência. Flutuando
            acima com um traço, ela lia como anotação da BORDA; dentro da massa,
            lê como rótulo do fluxo — que é o que ela é. Só sai para fora quando
            a fita é fina demais para contê-la.

            ⛔ Quando não couber, quem cede é a PÍLULA — nunca o piso da fita.
            Ver a nota de reversão dos 10px em `lib/funil/fita.ts`. */}
        {fluxo.etapas.map((e, i) => {
          if (i === 0 || !e.naFita || !fluxo.etapas[i - 1]?.naFita) return null;
          const guia = fluxo.guias[i - 1];
          if (guia == null) return null;
          const naoMedido = !!etapas[i - 1]?.trechoNaoMedido;
          if (naoMedido) return null; // quem fala nesse trecho é o marcador do rótulo
          /* `taxa` é `null` quando a etapa anterior é ZERO: não se divide por
             ausência, e "0%" ali afirmaria que todo mundo caiu fora. */
          if (e.taxa == null) return null;
          /* 🔴 ACIMA DE 1 NÃO É CONVERSÃO — É DISCORDÂNCIA ENTRE INSTRUMENTOS.
             Uma taxa de conversão pressupõe numerador SUBCONJUNTO do
             denominador; quando ela passa de 100% essa premissa está
             quebrada, e o número não tem intervalo válido. O caso real e
             medido: `ICs` sai da tabela `Click` (nosso script) e `Vendas
             Inic.` sai do gateway — 57 vendas contra 38 ICs dá 150%, que
             lido como conversão diz "mais gente comprou do que chegou".
             ⛔ Não é para corrigir o número nem esconder a pílula: é para
             a pílula parar de afirmar taxa e passar a nomear a causa. */
          const acimaDeUm = e.taxa > 1;
          /* Na guia a fita já está entre as duas espessuras; a MENOR é o que
             garante que a cápsula cabe nos dois lados da transição. */
          const naGuia = Math.min(e.espessura, fluxo.etapas[i - 1]!.espessura);
          const cabe = naGuia >= ALTURA_PILULA + 8;
          const cima = centroY - Math.max(e.espessura, fluxo.etapas[i - 1]!.espessura) / 2;
          return (
            <React.Fragment key={`passo-${etapas[i]!.label}`}>
              {!cabe && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: guia,
                    top: cima - FOLGA_PILULA,
                    width: 1,
                    height: FOLGA_PILULA,
                    /* ⚠️ Cor da FITA, não da cápsula: `--tk-pilula` é #090D14 no
                       escuro, mais escuro que o card (1,15:1) — o traço existia
                       no DOM e era invisível na tela. */
                    background: "var(--tk-fluxo)",
                    pointerEvents: "none",
                  }}
                />
              )}
              <div
                className="text-caption"
                title={
                  acimaDeUm
                    ? `${etapas[i]!.label} (${etapas[i]!.fonte ?? "fonte não declarada"}) tem mais do que ` +
                      `${etapas[i - 1]!.label} (${etapas[i - 1]!.fonte ?? "fonte não declarada"}). ` +
                      "As duas etapas não saem do mesmo instrumento, então a razão entre elas " +
                      "não é taxa de conversão — ela mede o quanto as duas medições discordam."
                    : `De ${etapas[i - 1]!.label} para ${etapas[i]!.label}`
                }
                style={{
                  /* ⚠️ `--tk-tint-warning` / `--tk-on-tint-warning`, e os nomes
                     foram CONFERIDOS no `globals.css`. Escrevi
                     `--tk-warning-tint` na primeira versão: não existe, compila,
                     passa no lint e cai no fallback — cor errada e nada acusa.
                     Token é casamento de string com o CSS. */
                  ...pilula(
                    acimaDeUm ? "var(--tk-tint-warning)" : "var(--tk-pilula)",
                    acimaDeUm ? "var(--tk-on-tint-warning)" : "var(--tk-on-pilula)",
                  ),
                  left: guia,
                  top: cabe ? centroY : cima - FOLGA_PILULA - ALTURA_PILULA / 2,
                  fontWeight: 700,
                }}
              >
                {acimaDeUm ? "fontes diferentes" : pct1(e.taxa)}
              </div>
            </React.Fragment>
          );
        })}

        {/* ── Pílula da PERDA, ABAIXO da fita, na GUIA ─────────────────────────
            🔴 É AQUI que a perda existe: em número, não em área. Ancorada na
            guia porque perda acontece ENTRE duas etapas — ancorá-la num centro
            de etapa a atribuiria a uma delas. */}
        {fluxo.perdas.map((p) => {
          /**
           * 🔴 O RÓTULO VEM DO QUE A ETAPA DE DESTINO MEDE — não de um caso
           * especial desta etapa.
           *
           * | destino mede | a queda é | como se escreve |
           * |---|---|---|
           * | `comportamento` | gente que SAIU | `−43` — o menos afirma saída |
           * | `deteccao` | gente que o instrumento NÃO VIU | `43 não detectados` |
           *
           * ⛔ O sinal de menos sai junto no caso de detecção, e não é detalhe:
           * `−43` afirma que 43 pessoas deixaram o funil. Das 43 aqui, **24
           * fizeram checkout** — o snippet é que não viu. Chamar isso de perda
           * manda o gestor otimizar a oferta quando o problema é a instalação,
           * que é o mesmo erro de categoria que tirou `Cliques` da fita.
           *
           * ⚠️ Derivado de `mede`, então uma etapa de detecção NOVA herda o
           * rótulo certo sem ninguém lembrar de tratá-la.
           */
          const deteccao = etapas[p.de + 1]?.mede === "deteccao";
          return (
            <div
              key={`perda-${p.de}`}
              className="text-caption"
              title={
                deteccao
                  ? "Sessões que não chegaram a esta etapa PELA MEDIÇÃO. Parte delas " +
                    "pode ter feito checkout sem o nosso script ver — aqui não há " +
                    "como distinguir quem desistiu de quem não foi detectado."
                  : `Saíram entre ${etapas[p.de]?.label} e ${etapas[p.de + 1]?.label}`
              }
              style={{
                ...pilula("var(--tk-pilula)", "var(--tk-on-pilula)"),
                left: p.x,
                top: TOPO + faixaAlt + 12,
                cursor: "help",
              }}
            >
              {deteccao ? "" : "−"}
              {p.valor.toLocaleString("pt-BR")}
              {deteccao && " não detectados"}
              {p.pct != null && <span style={{ opacity: 0.72 }}> · {pct1(p.pct)}</span>}
            </div>
          );
        })}

        {/* ── ✂️ A MARCA DO CORTE — o vão é DELIBERADO, e diz por quê ─────────
            🔴 Vão sem rótulo é indistinguível de bug de layout. Quem olha um
            buraco no meio de um gráfico conclui que algo não carregou — e essa
            leitura é pior que a fita atravessando, porque ela põe em dúvida o
            resto do bloco.

            Aqui o vão AFIRMA: duas hastes tracejadas fechando cada ponta e um
            rótulo curto dizendo de quem a medição passa a ser.

            ⚠️ O rótulo é curto de propósito (`o gateway assume`). A explicação
            longa mora no `title`; o que a silhueta precisa é de uma palavra que
            impeça a leitura "faltou dado". */}
        {fluxo.etapas.map((e, i) => {
          const rotulo = etapas[i]?.fonteMuda;
          if (!rotulo || !fluxo.cortes[i]) return null;
          const guia = fluxo.guias[i - 1];
          if (guia == null) return null;
          return (
            <div
              key={`corte-${etapas[i]!.label}`}
              title={
                `A medição troca de dono aqui: ${etapas[i - 1]?.fonte ?? "a etapa anterior"} de um lado, ` +
                `${etapas[i]?.fonte ?? "esta etapa"} do outro. A fita se parte porque a razão entre as duas ` +
                "não é conversão — ela mede o quanto os dois sistemas discordam."
              }
              style={{
                position: "absolute",
                left: guia,
                top: centroY,
                transform: "translate(-50%, -50%)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                pointerEvents: "auto",
                cursor: "help",
                whiteSpace: "nowrap",
              }}
            >
              <span
                className="text-caption"
                style={{
                  ...pilula("var(--tk-surface)", "var(--tk-text-secondary)"),
                  position: "static",
                  transform: "none",
                  left: undefined,
                  top: undefined,
                  border: "1px dashed var(--tk-border)",
                  fontWeight: 600,
                }}
              >
                ✂ {rotulo}
              </span>
            </div>
          );
        })}

        {/* ⛔ A PÍLULA DE ENTRADA LATERAL VIVIA AQUI E FOI REMOVIDA em 13/08/2026.

            Ela funcionava enquanto o nó valia 38: a leitura era binária — 38 com
            jornada, 35 sem. Quando o nó passou a valer 14 (só o navegador), os 35
            deixaram de ser complemento do número exibido e viraram complemento de
            um 38 que não está escrito em lugar nenhum da tela.

            🔴 O leitor precisava compor 14 + 24 + 35 = 73 com as TRÊS populações
            penduradas no mesmo nó em três lugares: o número, a linha declarativa
            embaixo e a pílula acima. Três ancoragens para um nó é pior que o
            problema que a separação consertou.

            ✅ Hoje as três moram na LINHA DECLARATIVA (`composicao`), num texto só
            que fecha o total. Ver `ETAPAS_PARA_FITA` no `catalogoRender`. */}

        {/* ── Número absoluto, EMBAIXO, grande e em negrito ────────────────── */}
        {fluxo.etapas.map((e, i) => (
            <div
              key={`abs-${etapas[i]!.label}`}
              className="text-metric-md"
              style={{
                position: "absolute",
                left: e.x,
                top: TOPO + faixaAlt + 34,
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                color: "var(--tk-text)",
                fontVariantNumeric: "tabular-nums",
                fontSize: "var(--tk-b-fita-num, 22px)",
                lineHeight: 1.1,
              }}
            >
              {etapas[i]!.valorFmt}
            </div>
          ))}

        {/* ── A COMPOSIÇÃO, sob o número ───────────────────────────────────────
            "35 ICs · 11 do navegador". Só aparece quando a etapa tem parcelas de
            origens diferentes e o usuário precisa saber a proporção — é o que
            transforma "confie no número" em "veja de onde ele vem". */}
        {fluxo.etapas.map((e, i) =>
            !etapas[i]!.composicao ? null : (
              <div
                key={`comp-${etapas[i]!.label}`}
                className="text-caption text-text-muted"
                style={{
                  position: "absolute",
                  left: e.x,
                  top: TOPO + faixaAlt + 34 + 26,
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {etapas[i]!.composicao}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
