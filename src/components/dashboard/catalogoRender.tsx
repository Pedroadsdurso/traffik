"use client";

import * as React from "react";

import { AlertList } from "@/components/tk/AlertList";
import { Aprovacao } from "@/components/tk/Aprovacao";
import { BreakdownPanel } from "@/components/tk/BreakdownPanel";
import { AlternadorPais, CountryPanel } from "@/components/tk/CountryPanel";
import { DonutChart } from "@/components/tk/DonutChart";
import { FeedVendas } from "@/components/tk/FeedVendas";
import {
  FitaFunil,
  type CoberturaFita,
  type EtapaEntradaFita,
  type ExclusaoFita,
} from "@/components/tk/FitaFunil";
import { Heatmap, type CelulaHeat } from "@/components/tk/Heatmap";
import { LineChart } from "@/components/tk/LineChart";
import { Segmented } from "@/components/tk/Segmented";
import { SerieTemporal, type PontoSerieTemporal } from "@/components/tk/SerieTemporal";
import { StatusFooter } from "@/components/tk/StatusFooter";
import { TabelaCampanhas } from "@/components/tk/TabelaCampanhas";

import { brl0 } from "@/lib/format";
import { corFinanceira } from "@/lib/financeiro";

import type { IdBloco } from "./catalogo";
import { ROTULO_HEAT, type CtxBlocos } from "./dadosDosBlocos";
import type { TraffikView } from "./useTraffikState";

/**
 * O RENDER de cada bloco do catálogo.
 *
 * 🔴 **`Record<IdBloco, …>` é a regra "nada entra sem renderizar", aplicada pelo
 * COMPILADOR.** Acrescentar um bloco em `catalogo.ts` sem trazer o render aqui
 * quebra o `tsc` — não depende de ninguém lembrar.
 *
 * ⛔ E não escreva `render: () => null` para calar o compilador. O ponto inteiro
 * é que o usuário não descubra sozinho que escolheu um bloco vazio; um `null`
 * aqui é a mesma mentira com sintaxe diferente.
 */

/**
 * O que o bloco mostra QUANDO NÃO HÁ DADO.
 *
 * ### 🔴🔴 ELE PASSOU A SER OBRIGATÓRIO — 07/08/2026, e é o conserto de um bug
 *
 * Antes, `temDado === false` fazia o bloco **sumir da grade**: o
 * `DashboardScreen` filtrava a lista de painéis antes de desenhar. O comentário
 * que defendia isso dizia *"um painel corretamente vazio na tela do usuário
 * parece defeito"* — e estava errado pelo motivo oposto ao que imaginava.
 *
 * **Sumir não é colapsar.** Quando um bloco sai da grade, os vizinhos sobem, a
 * linha se refaz e o arranjo que o usuário montou vira outro. Ele não vê "um
 * bloco vazio": ele vê a tela dele embaralhada, sem nada dizendo por quê.
 *
 * E o estado sem dado é o estado NORMAL desta ferramenta — os testadores rodam
 * sem venda na maior parte do tempo. O layout não pode depender da janela de
 * tempo ter movimento.
 *
 * ⚠️ O que colapsa é a **altura**, e só ela: `celulaDaGrade` não aplica o piso
 * de altura escolhido pelo usuário no estado vazio. A posição e a largura são
 * dele; a altura era sobre o bloco COM dado.
 *
 * ⛔ `causa` e `acao` não são enfeite — é a regra do `EmptyState`: "nenhuma
 * venda" diz o que já dava para ver. O que muda a tela é saber DE ONDE aquele
 * número deveria vir e o que fazer para ele existir.
 */
export interface BlocoVazio {
  titulo: string;
  causa: React.ReactNode;
  acao?: { texto: string; href: string };
}

interface BaseBloco {
  /** O controle do cabeçalho do card (`06` §14.1). Vai para o slot `acao`. */
  acao?: (v: TraffikView, c: CtxBlocos) => React.ReactNode;
  render: (v: TraffikView, c: CtxBlocos) => React.ReactNode;
}

/** O caso comum: pode não haver dado, e então há um estado vazio para mostrar. */
interface BlocoComVazio extends BaseBloco {
  /** `false` quando o dado não existe NESTE período. O bloco COLAPSA, não some. */
  temDado: (v: TraffikView, c: CtxBlocos) => boolean;
  vazio: BlocoVazio;
}

/**
 * O bloco que **não tem estado vazio alcançável**, e diz por quê.
 *
 * 🔴 ELE EXISTE PARA NÃO ESCREVERMOS UM `vazio` QUE NUNCA APARECE. `Alertas` e
 * `Estado do sistema` respondem perguntas que não dependem de haver venda —
 * "algo exige ação?" e "a ferramenta está funcionando?" têm resposta com o
 * período inteiro zerado, e os dois componentes já desenham essa resposta (o
 * `AlertList` inclusive com tom verde, porque "nada exige ação" é boa notícia).
 *
 * ⛔ A alternativa era `temDado: () => true` com um `vazio` decorativo ao lado.
 * Isso é a família da **proteção morta**: um estado vazio escrito, revisado e
 * inalcançável — pior que não ter, porque quem lê o catálogo acredita que
 * aquele caso está coberto e para de olhar. Guarda que não pode disparar não é
 * guarda; é comentário com sintaxe de código.
 *
 * ⚠️ `porQue` é uma FRASE, não uma flag booleana. Uma flag registra a decisão
 * sem registrar o motivo, e o motivo é o que permite reavaliar quando o bloco
 * mudar. É a lição da cicatriz que virou anatomia.
 */
interface BlocoSempreCheio extends BaseBloco {
  sempreCheio: true;
  porQue: string;
}

export type RenderBloco = BlocoComVazio | BlocoSempreCheio;

/**
 * O estado vazio a mostrar, ou `null` quando há o que desenhar.
 *
 * ⛔ **Ponto único.** A tela chamava `temDado` em dois lugares (o filtro da
 * grade e o corpo do item de edição), e foi assim que "colapsar" virou "sumir"
 * em um deles e não no outro.
 */
export function vazioDoBloco(r: RenderBloco, v: TraffikView, c: CtxBlocos): BlocoVazio | null {
  if ("sempreCheio" in r) return null;
  return r.temDado(v, c) ? null : r.vazio;
}

/* ── ⛔ TODO OBJETO DE PROPS LEVA ANOTAÇÃO DE TIPO NO PONTO EM QUE NASCE ───────
   Não é estilo. É o que faz o compilador recusar um campo que ninguém lê.

   🔴 O caso (07/08/2026): `perdaLabel` foi montado aqui e o componente nem
   tinha esse campo. `tsc`, `lint` e `build` passaram os três, e a etiqueta
   simplesmente não apareceu na tela. A "checagem de propriedade excedente" do
   TypeScript só vale para OBJETO LITERAL atribuído diretamente — o nosso vinha
   do retorno de uma função, e ali ela não alcança.

   ⚠️ E o buraco é maior do que parecia. MEDIDO: um `zzzCampoInventado` num
   `.map()` escrito DIRETO na prop JSX **também passa** — a inferência do
   genérico do `map` desliga a checagem do mesmo jeito. O arquivo inteiro estava
   exposto, não só o funil.

   A correção é a mesma que já fechou esta família no `RENDERS`
   (`Record<IdBloco, …>`): tirar a regra da vigilância e pôr no tipo. Aqui é uma
   anotação por ponto de construção:

       etapas.map((e): EtapaEntradaFita => ({ … }))
       const f = (v: TraffikView): ExclusaoFita[] => { … }

   ⛔ Ao acrescentar um `.map()` que monta props, ANOTE o retorno do callback.
   Sem isso, o campo com nome errado morre na tela em vez de morrer no build. */

/* ── Causas que se repetem ──────────────────────────────────────────────────
   ⚠️ Constante, e não a frase escrita cinco vezes: quando a explicação de "de
   onde vem uma venda" mudar, ela muda num lugar. Frase de produto repetida é a
   mesma família da `gridTemplateColumns` duplicada. */
const CAUSA_VENDA = (
  <>
    A venda chega pelo <strong>webhook do gateway</strong>. Sem nenhuma no período, não há o
    que somar.
  </>
);
const CAUSA_UTM = (
  <>
    A origem vem do <strong>clique rastreado</strong>. Sem os códigos de UTM instalados, a venda
    entra sem procedência.
  </>
);
const IR_WEBHOOKS = { texto: "Conferir webhooks", href: "/dashboard/integracoes/webhooks" };
const IR_UTMS = { texto: "Ver códigos de UTM", href: "/dashboard/integracoes/utms" };
const IR_ANUNCIOS = { texto: "Conferir integrações", href: "/dashboard/integracoes/anuncios" };

/* ⛔ `PERDA_DO_FUNIL` foi DELETADA em 07/08/2026, e o motivo é o da regra dos
   textos órfãos: ela descrevia um comportamento que MUDOU. Eram as frases
   ("saíram sem iniciar checkout") que rotulavam as FAIXAS DE PERDA da fita — e
   as faixas deixaram de existir quando a perda virou pílula numérica.

   Mantê-la como constante órfã convidaria a "reaproveitar" um verbo para um
   desenho que não tem mais onde escrevê-lo. Quem diz quanto se perdeu agora é
   `−1.185 · 97,1%`, na guia da transição. */


/**
 * 🔴 AS CINCO ETAPAS DO FUNIL. Nenhuma é filtrada — e o `.filter()` que existia
 * aqui saiu em 07/08/2026.
 *
 * Ele escondia "Visita na página" sob uma premissa minha que estava errada: eu
 * disse que o dado não existia porque `PixelEventType` não tem `PAGE_VIEW`. O
 * enum de fato não tem, mas `funnel.visitas` nunca dependeu dele — é
 * `w.clicks.length`, a tabela `Click`.
 *
 * ⛔ **O rótulo virou "Sessões", e é divergência DELIBERADA da referência.** O
 * `pixel.js` grava uma linha por SESSÃO (`sessionStorage`), não por página
 * aberta: quem navega por cinco páginas conta um. A referência conta pageview;
 * nós contamos sessão, e o nome segue o dado. Registrado no `04`.
 */
const ETAPAS_DO_FUNIL = (v: TraffikView) => v.funnelStages;

/**
 * 🔴 O TRECHO `ICs → Vendas Inic.` QUANDO NÃO HOUVE PIXEL.
 *
 * `Click.checkoutAt` tem dois escritores, e um é o webhook do gateway — então
 * **toda venda produz um IC**. Numa conta sem o pixel instalado,
 * `ICs === Vendas Iniciadas` por construção, e a fita desenha 100% de conversão
 * no trecho do meio.
 *
 * Essa é a mentira mais lisonjeira que este bloco conseguiria contar: o gestor
 * lê "meu checkout converte tudo" quando a etapa está apenas repetindo a
 * seguinte. É a distinção do denominador zero — `0,00x` × `—` — aplicada a
 * etapa de funil.
 *
 * ⛔ A etapa NÃO some quando isso acontece. Etapa que desaparece muda a forma
 * do funil em silêncio, e a forma é o que a pessoa compara entre períodos.
 */
const AVISO_SEM_PIXEL =
  "Nenhum Initiate Checkout veio do navegador neste período: todos foram " +
  "deduzidos das vendas. Sem o pixel na página de checkout esta etapa apenas " +
  "repete “Vendas iniciadas”, e a conversão entre as duas não foi medida.";

/**
 * ⚠️ A perda `Cliques → Sessões` é PERDA DE RASTREAMENTO, não abandono. A etapa
 * 1 é `DailyAdMetric.clicks` (a Meta) e a 2 é a nossa tabela `Click`: quem
 * clicou no anúncio e não virou sessão nossa não "desistiu" — ele não foi
 * VISTO. Bloqueador, redirect que come UTM, snippet ausente.
 *
 * Chamar isso de abandono manda o gestor otimizar a oferta quando o problema é
 * a instalação. Por isso ela saiu da fita: quem a mostra é a faixa de
 * cobertura, com peso próprio. Ver `COBERTURA_DO_FUNIL`.
 */
const PERDA_DE_RASTREAMENTO_AJUDA =
  "Clicaram no anúncio e não chegaram a virar uma sessão rastreada. Não é " +
  "abandono: é o rastreamento que não os viu — bloqueador de anúncio, redirect " +
  "que descarta a UTM, ou o snippet ausente na página de destino.";

const ETAPAS_PARA_FITA = (v: TraffikView): EtapaEntradaFita[] => {
  const etapas = ETAPAS_DO_FUNIL(v);
  const ics = etapas.find((e) => e.chaveInfo === "checkouts");
  const semPixel = ics != null && ics.value > 0 && (ics.doNavegador ?? 0) === 0;
  return etapas.map((e): EtapaEntradaFita => ({
    label: e.curto,
    valor: e.value,
    valorFmt: e.value.toLocaleString("pt-BR"),
    fonte: e.fonte,
    ajuda: e.ajuda,
    /* A composição só aparece quando há DUAS origens de verdade. Com tudo do
       gateway quem fala é a hachura; com tudo do navegador não há o que
       decompor. */
    composicao:
      e.chaveInfo === "checkouts" && (e.doNavegador ?? 0) > 0 && (e.doNavegador ?? 0) < e.value
        ? `${e.value.toLocaleString("pt-BR")} ICs · ${(e.doNavegador ?? 0).toLocaleString("pt-BR")} do navegador`
        : undefined,
    trechoNaoMedido: e.chaveInfo === "checkouts" && semPixel ? AVISO_SEM_PIXEL : undefined,
    /* 🔴 `Cliques` sai da GEOMETRIA da fita, mas continua sendo etapa: nome em
       cima, número embaixo. A perda dele para `Sessões` é instrumentação, não
       comportamento — quem a mostra é a faixa de cobertura. Ver `CoberturaFita`.

       ⚠️ Por isso `perdaLabel` também saiu: a pílula de perda daquele trecho
       deixou de existir, e um rótulo para uma pílula que não é mais desenhada
       seria texto órfão descrevendo comportamento que mudou. */
    foraDaFita: e.chaveInfo === "cliques",
  }));
};

/**
 * O que foi TIRADO do cálculo, declarado na tela.
 *
 * ⚠️ Os dois acessores (`bots`, `ambientesDeTeste`) existiam no hook desde o
 * Bloco 5 com **ZERO consumidores** — mais um caso de "passa no build com a
 * coisa desligada". O dado sempre esteve certo: os robôs já saíam das métricas.
 * O que faltava era o produto DIZER isso.
 */
/**
 * A cobertura de rastreamento: que fração dos cliques do anúncio virou sessão
 * nossa. É a pergunta de INSTRUMENTAÇÃO, e ela saiu da fita em 07/08/2026.
 *
 * ⚠️ `null` quando não houve clique nenhum — não se divide por ausência, e
 * "0% rastreado" afirmaria falha onde não houve tráfego.
 */
const COBERTURA_DO_FUNIL = (v: TraffikView): CoberturaFita | undefined => {
  const etapas = ETAPAS_DO_FUNIL(v);
  const cliques = etapas.find((e) => e.chaveInfo === "cliques")?.value ?? 0;
  const sessoes = etapas.find((e) => e.chaveInfo === "visitas")?.value ?? 0;
  if (cliques <= 0) return undefined;
  const fracao = sessoes / cliques;
  const perdidos = Math.max(0, cliques - sessoes);
  return {
    fracao,
    pct: `${(fracao * 100).toFixed(1).replace(".", ",")}%`,
    /* Ausente, não `"0 perdidos"`: cobertura cheia é o estado bom, e anunciar
       uma perda de zero transforma a boa notícia em linha de relatório. */
    perdidos:
      perdidos > 0
        ? `${perdidos.toLocaleString("pt-BR")} ${perdidos === 1 ? "clique perdido" : "cliques perdidos"}`
        : undefined,
    ajuda: PERDA_DE_RASTREAMENTO_AJUDA,
  };
};

const EXCLUSOES_DO_FUNIL = (v: TraffikView): ExclusaoFita[] => {
  const fora: ExclusaoFita[] = [];
  const robos = v.bots.reduce((s, b) => s + b.total, 0);
  if (robos > 0) {
    fora.push({
      texto: `${robos.toLocaleString("pt-BR")} ${robos === 1 ? "acesso de robô removido" : "acessos de robô removidos"}`,
    });
  }
  const teste = v.ambientesDeTeste.reduce((s, a) => s + a.total, 0);
  if (teste > 0) {
    fora.push({
      texto: `${teste.toLocaleString("pt-BR")} ${teste === 1 ? "evento de teste fora do funil" : "eventos de teste fora do funil"}`,
    });
  }
  return fora;
};

export const RENDERS: Record<IdBloco, RenderBloco> = {
  /* ── OS QUATRO ESTRUTURAIS ────────────────────────────────────────────────
     ⚠️ Eles vieram do JSX fixo do `DashboardScreen`. **Nenhum ganhou um render
     novo**: o corpo é o mesmo, agora com `temDado` e `vazio` como todos os
     outros — que é o que "estrutural significa só não-ocultável" quer dizer na
     prática. Um bloco fixo sem estado vazio seria a única caixa da tela capaz
     de ficar branca. */
  "receita-gasto": {
    temDado: (_v, c) => c.temSerie,
    vazio: {
      titulo: "Sem receita nem gasto no período",
      causa:
        "A linha aparece quando entra uma venda rastreada ou quando a conta de anúncio sincroniza o gasto do dia.",
      acao: IR_ANUNCIOS,
    },
    acao: (_v, c) => (
      <Segmented
        rotuloAcessivel="Granularidade do gráfico"
        valor={c.granularidade}
        aoTrocar={c.setGranularidade}
        opcoes={[
          { valor: "diario", rotulo: "Diário" },
          { valor: "semanal", rotulo: "Semanal" },
        ]}
      />
    ),
    render: (v, c) => (
      <>
        <LineChart
          pontos={c.pontos}
          rotuloA="Receita"
          rotuloB="Gasto"
          /* ✅ O break-even EXISTE e é NÚMERO. Ele nasce colado ao `lucro` em
             `financeiro.ts`, consumindo os MESMOS custos fixos que o card de
             Lucro subtrai — senão a linha marcaria equilíbrio num ponto em que
             o card ao lado diz prejuízo. */
          breakEven={v.finance.breakEven}
          semBreakEven={
            v.finance.breakEven == null && (v.metricCards.faturamento?.value ?? "") !== ""
              ? "Break-even indisponível: sem faturamento no período não dá para medir a taxa efetiva."
              : null
          }
          unicasFora={v.finance.unicasForaDoCalculo}
          formatar={brl0}
        />
        {c.diasAparados > 0 ? (
          <p className="text-caption text-text-muted" style={{ margin: "6px 0 0" }}>
            {c.diasAparados} {c.diasAparados === 1 ? "dia sem movimento omitido" : "dias sem movimento omitidos"} no
            início do período.
          </p>
        ) : null}
      </>
    ),
  },

  alertas: {
    sempreCheio: true,
    porQue:
      "Lista vazia é a resposta BOA, não ausência de dado — e o AlertList já a desenha, com tom de tudo-certo. Um EmptyState cinza faria a melhor notícia da tela parecer falha de carregamento.",
    render: (_v, c) => <AlertList alertas={c.alertas} />,
  },

  paises: {
    temDado: (_v, c) => c.paises.length > 0,
    vazio: {
      titulo: "Nenhuma venda com país no período",
      causa: (
        <>
          O país vem do <strong>gateway</strong> ou do <strong>clique rastreado</strong>. Se há
          vendas mas nenhuma com país, a integração não está devolvendo essa informação.
        </>
      ),
      acao: { texto: "Conferir integrações", href: "/dashboard/integracoes" },
    },
    acao: (_v, c) => <AlternadorPais visao={c.visaoPais} aoTrocar={c.setVisaoPais} />,
    render: (_v, c) => (
      <CountryPanel
        linhas={c.paises}
        semPais={c.semPais}
        formatar={brl0}
        tema={c.tema}
        visao={c.visaoPais}
        /* ⚠️ 420 continua sendo a altura do GLOBO, não do bloco. Abaixo de 640px
           úteis a container query o esconde e a altura some junto — ver a nota
           dentro do `CountryPanel`. */
        altura={420}
      />
    ),
  },

  rodape: {
    sempreCheio: true,
    porQue:
      "Ele responde 'a ferramenta está funcionando?', não 'quanto vendi'. É o único bloco da tela que não fala de dinheiro, e por isso os quatro indicadores existem com o período inteiro zerado.",
    render: (_v, c) => <StatusFooter blocos={c.rodape} />,
  },

  /* ── OS OPCIONAIS ─────────────────────────────────────────────────────── */
  funil: {
    temDado: (v) => ETAPAS_DO_FUNIL(v).some((e) => e.value > 0),
    vazio: {
      titulo: "Nenhum clique rastreado no período",
      causa: (
        <>
          O funil começa no <strong>clique</strong>. Sem o script de rastreamento na página, não há
          primeira etapa — e sem ela não há taxa nenhuma para calcular.
        </>
      ),
      acao: IR_UTMS,
    },
    render: (v) => (
      <FitaFunil
        etapas={ETAPAS_PARA_FITA(v)}
        exclusoes={EXCLUSOES_DO_FUNIL(v)}
        cobertura={COBERTURA_DO_FUNIL(v)}
      />
    ),
  },

  fontes: {
    /* 🔴 O BLOCO "CANAIS" FOI ABSORVIDO AQUI (07/08/2026), e a checagem que
       autorizou a junção foi a que o dono pediu: **os dois liam `v.sources`** —
       o mesmo array, produzido pelo mesmo `d.sources` do servidor, agrupado
       pela mesma dimensão (`utm_source` do clique). Não eram duas coisas
       parecidas; era uma coisa desenhada duas vezes na mesma tela.

       ⚠️ `c.fatias` é `v.sources` com o nome traduzido e a cor de canal
       aplicada — não é uma segunda fonte. A rosca e a lista mostram as MESMAS
       linhas, na mesma ordem, com o mesmo total. */
    temDado: (v) => v.sources.length > 0,
    vazio: {
      titulo: "Nenhuma venda com origem no período",
      causa: CAUSA_UTM,
      acao: IR_UTMS,
    },
    acao: (_v, c) => (
      <Segmented
        rotuloAcessivel="Visão da origem do faturamento"
        valor={c.visaoFontes}
        aoTrocar={c.setVisaoFontes}
        opcoes={[
          { valor: "rosca", rotulo: "Rosca" },
          { valor: "lista", rotulo: "Lista" },
        ]}
      />
    ),
    render: (v, c) =>
      c.visaoFontes === "rosca" ? (
        <DonutChart fatias={c.fatias} totalLabel={brl0(c.totalCanais)} formatar={brl0} />
      ) : (
        <BreakdownPanel linhas={v.sources} rotuloDimensao="Fonte" />
      ),
  },

  produtos: {
    temDado: (v) => v.products.length > 0,
    vazio: { titulo: "Nenhuma venda no período", causa: CAUSA_VENDA, acao: IR_WEBHOOKS },
    /* ⚠️ Produtos e Pagamentos têm CONTAGEM; Fontes não. Por isso `mostrarVendas`
       é prop e não há um terceiro componente — uma booleana por uma coluna é
       mais barato que o começo dos três-quase-iguais que a consolidação desfez. */
    render: (v) => <BreakdownPanel linhas={v.products} rotuloDimensao="Produto" mostrarVendas />,
  },

  pagamentos: {
    temDado: (v) => v.payments.length > 0,
    vazio: {
      titulo: "Nenhuma venda no período",
      causa: (
        <>
          A forma de pagamento vem do <strong>webhook do gateway</strong>, no mesmo payload da
          venda.
        </>
      ),
      acao: IR_WEBHOOKS,
    },
    render: (v) => <BreakdownPanel linhas={v.payments} rotuloDimensao="Forma" mostrarVendas />,
  },

  posicionamento: {
    /* 🔴 O BLOCO VOLTOU, E O DADO NUNCA TINHA SUMIDO. `computeDashboard`
       devolve `byPlacement`, o hook o expõe como `v.placements`, e a migração
       descartava `chart:posicionamento` porque "não existe mais no produto".
       Era o padrão do `Sale.apiCredentialId` invertido: cadeia inteira montada,
       zero consumidores na tela. */
    temDado: (v) => v.placements.length > 0,
    vazio: {
      titulo: "Nenhuma venda com posicionamento",
      causa: (
        <>
          O posicionamento vem do <strong>{"{{placement}}"}</strong> na URL do anúncio, e chega
          pelo <strong>utm_term</strong> do clique. Sem esse parâmetro na campanha, a venda entra
          sem lugar.
        </>
      ),
      acao: IR_UTMS,
    },
    render: (v) => (
      <>
        {/* ⚠️ Sem `pctLabel` — e o `BreakdownPanel` esconde a coluna de %, em vez
            de imprimir uma coluna de traços. O denominador honesto aqui seria o
            faturamento COM posicionamento conhecido, que não é o total; a linha
            abaixo é quem diz o que ficou de fora. */}
        <BreakdownPanel linhas={v.placements} rotuloDimensao="Posicionamento" mostrarVendas />
        {v.placementSemDados > 0 && (
          /* 🔴 ATRIBUIÇÃO INCOMPLETA APARECE. Esta tabela nunca soma o
             faturamento total — venda sem clique, sem UTM ou com `{{placement}}`
             cru fica de fora. Sem a linha do resto, o usuário compara com o KPI,
             vê que não fecha e conclui que um dos dois está errado. */
          <p className="text-caption text-text-muted" style={{ margin: "8px 0 0" }}>
            <strong className="text-warning">{brl0(v.placementSemDados)}</strong> de faturamento sem
            posicionamento identificado — não entram nesta tabela.
          </p>
        )}
      </>
    ),
  },

  "vendas-por-dia": {
    /* 🔴 `.some(movimento)`, NÃO `.length > 0` — visto na tela em 07/08/2026,
       no print do estado vazio. `byDay` traz UM BALDE POR DIA da janela, zerado
       ou não: com o filtro em "Hoje" ele tem comprimento 1 e receita 0, então o
       bloco se declarava com dado e desenhava um eixo vazio com o rótulo
       "08-07" e nada acima.

       ⚠️ É o mesmo erro que o bloco inteiro existe para corrigir, uma camada
       abaixo: "existe um balde" não é "houve venda". Confundir a EXISTÊNCIA da
       série com a existência de OBSERVAÇÃO é a distinção central do projeto —
       e aqui ela produzia a única caixa da tela sem explicação, no meio de doze
       que explicavam. */
    temDado: (v) => v.byDay.some((d) => d.revenue > 0 || d.sales > 0),
    vazio: { titulo: "Nenhuma venda no período", causa: CAUSA_VENDA, acao: IR_WEBHOOKS },
    render: (v) => (
      <SerieTemporal
        pontos={v.byDay.map((d): PontoSerieTemporal => ({ rotulo: d.date.slice(5), valor: d.revenue, apoio: d.sales }))}
        rotuloValor="Receita"
        rotuloApoio="vendas"
      />
    ),
  },

  "vendas-por-hora": {
    temDado: (v) => v.byHour.some((h) => h.sales > 0 || h.revenue > 0),
    vazio: { titulo: "Nenhuma venda no período", causa: CAUSA_VENDA, acao: IR_WEBHOOKS },
    render: (v) => (
      <SerieTemporal
        pontos={v.byHour.map((h): PontoSerieTemporal => ({ rotulo: `${h.hour}h`, valor: h.revenue, apoio: h.sales }))}
        rotuloValor="Receita"
        rotuloApoio="vendas"
      />
    ),
  },

  "lucro-por-hora": {
    temDado: (v) => v.byHour.some((h) => h.profit !== 0),
    vazio: {
      titulo: "Sem receita nem custo para distribuir",
      causa:
        "O lucro por hora rateia o custo do período em proporção à receita de cada hora. Sem venda, não há proporção — e sem custo, não há o que ratear.",
      acao: IR_WEBHOOKS,
    },
    /* ⚠️ O `profit` do `byHour` distribui o custo em proporção à receita da hora
       — não há informação de hora numa despesa. Está dito no rótulo, porque um
       lucro por hora sem essa ressalva se lê como medição direta. */
    render: (v) => (
      <SerieTemporal
        pontos={v.byHour.map((h): PontoSerieTemporal => ({ rotulo: `${h.hour}h`, valor: h.profit }))}
        rotuloValor="Lucro (custo rateado pela receita da hora)"
        permitirNegativo
      />
    ),
  },

  aprovacao: {
    temDado: (v) => v.approval.length > 0,
    vazio: {
      titulo: "Nenhum pagamento para avaliar",
      causa: (
        <>
          A taxa compara <strong>aprovadas</strong> com <strong>recusadas</strong> de cada forma.
          Sem tentativa nenhuma no período, não há razão para calcular.
        </>
      ),
      acao: IR_WEBHOOKS,
    },
    render: (v) => <Aprovacao linhas={v.approval} />,
  },

  atividade: {
    temDado: (v) => v.feed.length > 0,
    vazio: {
      titulo: "Nenhum evento no período",
      causa:
        "Aqui entram vendas e cliques rastreados, na ordem em que chegaram. É o primeiro lugar em que uma integração recém-ligada dá sinal de vida.",
      acao: IR_WEBHOOKS,
    },
    render: (v) => <FeedVendas itens={v.feed} />,
  },

  "top-campanhas": {
    temDado: (v) => v.topCampaigns.length > 0,
    vazio: {
      titulo: "Nenhuma campanha com faturamento",
      causa: (
        <>
          A venda é ligada à campanha pelo <strong>utm_campaign</strong> do clique. Enquanto os
          códigos não baterem com os nomes da conta, a receita não encontra a campanha.
        </>
      ),
      acao: IR_UTMS,
    },
    /* ⛔ ELE OBEDECE O FILTRO DE PERÍODO DE CIMA. O dado vem de
       `computeDashboard`, não de `adsData` — que roda numa janela fixa de 7
       dias. Dois blocos na mesma tela mostrando períodos diferentes sem avisar
       foi o defeito que o aparo do sparkline consertou. */
    render: (v) => (
      <TabelaCampanhas linhas={v.topCampaigns} formatar={brl0} corDoRoas={(r) => corFinanceira(r, "roas")} />
    ),
  },

  heatmap: {
    temDado: (v) => v.heatmap.celulas.length > 0,
    vazio: {
      titulo: "Sem histórico para montar o mapa",
      causa:
        "O mapa precisa de pelo menos um dia observado na janela do filtro. Ele fica mais útil a partir de duas semanas, quando cada célula passa a ser média e não retrato.",
      acao: IR_WEBHOOKS,
    },
    /* ⛔ SEM "GASTO" NO SELETOR, e é impossível — não é escolha de escopo.
       `DailyAdMetric` é diária e a Meta não reporta gasto por hora; um valor por
       hora seria o total do dia lançado às 00h, um pico de madrugada que nunca
       houve. É o mesmo motivo pelo qual a linha de gasto desaparece na
       granularidade horária (`gastoNaSerie`). */
    acao: (_v, c) => (
      <Segmented
        rotuloAcessivel="Métrica do mapa de horários"
        valor={c.metricaHeat}
        aoTrocar={c.setMetricaHeat}
        opcoes={[
          { valor: "revenue", rotulo: "Receita" },
          { valor: "sales", rotulo: "Vendas" },
          { valor: "profit", rotulo: "Lucro" },
        ]}
      />
    ),
    render: (v, c) => (
      <>
        <Heatmap
          celulas={v.heatmap.celulas.map((linha) =>
            linha.map((cel): CelulaHeat => ({ valor: cel[c.metricaHeat], observacoes: cel.observacoes })),
          )}
          formatar={c.metricaHeat === "sales" ? (n) => String(Math.round(n * 10) / 10) : brl0}
          rotuloMetrica={ROTULO_HEAT[c.metricaHeat]}
        />
        {/* 🔴 RETRATO × PADRÃO. As duas palavras carregam a diferença melhor que
            qualquer número: com uma observação por célula o mapa é honesto e não
            é tendência. Sem dizer isso, o usuário lê ruído de uma semana como
            comportamento do público — e decide mídia com base nisso. */}
        <p className="text-caption text-text-muted" style={{ margin: "10px 0 0", lineHeight: 1.45 }}>
          {/* ⚠️ A frase da hachura só aparece se HOUVER hachura. Numa janela de
              30 dias todos os sete dias da semana foram observados, e explicar
              uma convenção que não está na tela ensina o leitor a não confiar no
              que o rodapé diz. */}
          {v.heatmap.maxObservacoes <= 1
            ? "Janela curta: cada célula é uma observação. É um retrato, não um padrão."
            : `Média de até ${v.heatmap.maxObservacoes} semanas.${
                v.heatmap.celulas.some((l) => l.some((cel) => cel.observacoes === 0))
                  ? " Células hachuradas não foram observadas nesta janela."
                  : ""
              }`}
        </p>
      </>
    ),
  },
};

/* ⛔ O `CATALOGO` (metadado + render juntos) foi DELETADO com a rota
   `/dashboard/blocos`, que era o único consumidor. Quem precisa dos dois hoje é
   o modo de edição, e ele já tem os dois separados: `CATALOGO_META` para a lista
   de escolha e `RENDERS` para desenhar. Um terceiro objeto que junta os dois
   seria uma cópia que envelhece sozinha. */
