"use client";

import * as React from "react";

import { nomeDaFonte } from "@/lib/fontes";

import { useRegistrarFaixaDeFiltros } from "@/components/tk/AppShell";
import { Card } from "@/components/tk/Card";
import { EmptyState } from "@/components/tk/EmptyState";
import { RENDERS, vazioDoBloco, type RenderBloco } from "../../catalogoRender";
import { useDadosDosBlocos, type CtxBlocos } from "../../dadosDosBlocos";
import {
  ALTURA_CELULA,
  CATALOGO_META,
  COLUNAS_GRADE,
  celulasDePx,
  ehBlocoDeMetrica,
  metaDoBloco,
  proximoPasso,
} from "../../catalogo";
import { useLayoutDashboard } from "../../layout/useLayoutDashboard";
import { useArrasto, type Carga } from "../../layout/useArrasto";
import { avisoDeSobra, linhasDaGrade } from "../../layout/grade";
import { colunasParaLargura, derivarLayout } from "../../layout/derivar";
import { BarraEdicao } from "@/components/tk/BarraEdicao";
import { CatalogoLateral } from "@/components/tk/CatalogoLateral";
import { ItemEdicao } from "@/components/tk/ItemEdicao";
import { ZonaEdicao } from "@/components/tk/ZonaEdicao";
import { Button } from "@/components/tk/Button";
import { Badge } from "@/components/tk/Badge";

import { FiltroPeriodo } from "../../ui/FiltroPeriodo";
import { Select } from "../../ui/Select";
import { Icone } from "../../ui/Icone";
import { BannerPendencias } from "../../ui/BannerPendencias";
import type { TraffikView } from "../../useTraffikState";

/**
 * Dashboard — reescrito do zero em 06/08/2026.
 *
 * 🔴 O QUE MUDOU, E POR QUE NÃO FOI UMA TROCA DE CORES
 *
 * O Dashboard antigo eram DOZE `MetricCard` idênticos em duas fileiras de seis,
 * mais funil e globo dividindo a dobra. Doze números do mesmo tamanho não
 * respondem pergunta nenhuma: a tela listava tudo e deixava a pessoa procurar.
 *
 * Aqui a hierarquia é o produto.
 *
 * ### 🔴🔴 AS TRÊS ZONAS ACABARAM — F5, 12/08/2026
 *
 * Este cabeçalho descrevia três estruturas:
 *
 *     4 KPIs HERO      Faturamento · Gasto · ROAS · Lucro, com sparkline
 *     FAIXA COMPACTA   os outros sete, uma linha, sem card
 *     PAINÉIS          TUDO o mais, na grade de 12 colunas
 *
 * e dizia, em ⛔: *"cinco cards iguais aqui e a tela volta a ser a grade de doze;
 * a quantidade de heros é fixa de propósito"*.
 *
 * **Os dois tetos caíram.** Eles eram a queixa 1 do `07`: onze métricas
 * disputando oito vagas, e o resto sumindo — e nenhum dos dois números tinha
 * razão de produto. Eles existiam porque os três grupos eram três componentes
 * diferentes. Hoje há **uma grade**, e KPI hero, métrica compacta e painel são o
 * mesmo objeto, diferindo por `colMin`/`colPadrao`/`hMin`/`hPadrao`.
 *
 * ⛔ **A hierarquia não morreu — ela mudou de dono, e isso é o contrário de
 * afrouxar.** O argumento antigo continua inteiro: doze números do mesmo tamanho
 * não respondem pergunta nenhuma. O que decide o peso agora é a ALTURA DO SLOT,
 * e o layout padrão continua dando duas células aos quatro principais e uma ao
 * resto. A diferença é que ela virou uma propriedade do arranjo — visível,
 * editável e do usuário — em vez de um número escrito num componente.
 *
 * ### 🔴 A ZONA DE PAINÉIS ABSORVEU O JSX FIXO — 07/08/2026
 *
 * `Receita × gasto`, `Canais`, `Alertas`, `Top campanhas`, `Quando compram`,
 * `Vendas por país` e o rodapé eram markup cravado aqui, fora da grade, com
 * largura decidida no código. A tela tinha **dois sistemas de layout** — um que
 * o usuário controlava e outro que ele não via.
 *
 * O sintoma foi `Vendas por país` ocupando a tela de ponta a ponta sem alça:
 * "estrutural" tinha virado "imexível", quando a decisão sempre foi só "não
 * pode ser ocultado". Hoje os sete estão no catálogo, e o que os quatro fixos
 * têm de diferente é uma coisa: **não têm ✕**.
 *
 * ⚠️ Sobrou pouca coisa fixa nesta tela, e a F5 tirou o que sobrava de bloco:
 * filtros e a moldura de edição. **Não há mais JSX de bloco algum aqui** — os
 * dois de métrica eram os últimos. Se um bloco novo aparecer nesta tela em JSX
 * solto, é regressão: o lugar dele é o catálogo.
 *
 * ⚠️ ESTA TELA NÃO USA `.tk-tema`. Ela consome `--tk-*` e os primitivos de
 * `components/tk/` direto — a ponte existe só para as telas ainda não refeitas.
 */

/**
 * 🔴 A GRADE — doze colunas, e a ALTURA VEM DO LAYOUT (F1, 12/08/2026).
 *
 * ⛔ **Este comentário dizia o CONTRÁRIO até hoje** ("a altura vem do conteúdo",
 * com `gridAutoRows: auto` e `linhas` virando `minHeight`). O sintoma que
 * motivou aquela decisão era real — um bloco VAZIO reservava as 6 linhas que
 * teria com dado só para escrever "Sem dado neste período" — mas a conclusão
 * era errada, e o `minHeight` trocou um problema por três: sem controle
 * vertical, conteúdo que nunca aprende a caber (o card sempre cedia), e o
 * `stretch` como terceira mecânica decidindo altura.
 *
 * Hoje a linha vale `--tk-row` (80px) e cada bloco declara `h` em células. Quem
 * responde pelo bloco vazio é a **condição F0**: colapso para
 * `min(h, células do estado vazio)` na renderização, com o `h` salvo intacto.
 * O raciocínio inteiro está em `docs/design/07-GRADE-E-BLOCOS.md`, §2 e §9.
 *
 * ⚠️ `alignItems` fica no PADRÃO (`stretch`): com `span`, todo item já tem a
 * altura exata do próprio slot, e o `stretch` é o que faz o card preencher a
 * célula em vez de flutuar no topo dela.
 *
 * ⛔ E sem `grid-auto-flow: dense`. Ele preenche buracos com blocos de MAIS
 * ADIANTE na lista, e a ordem que o usuário arrastou deixaria de ser a ordem que
 * ele vê.
 */
/* ⚠️ A contagem de colunas é PARÂMETRO desde a F2: a mesma grade desenha 12, 8,
   4 ou 1 conforme o viewport, e quem decide é `colunasParaLargura`. O layout
   salvo continua sendo só o de 12 — ver `layout/derivar.ts`. */
const grade = (colunas: number): React.CSSProperties => ({
  display: "grid",
  gap: "var(--tk-gap-grid)",
  gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`,
  gridAutoRows: "var(--tk-row)",
});

/**
 * A célula de um painel na grade.
 *
 * ### 🔴 NÃO EXISTE "grid-row: auto" NUMA GRADE DE LINHA FIXA — medido na tela
 *
 * A primeira versão desta função deixava o bloco NÃO MIGRADO em `grid-row: auto`,
 * lendo "os dois modos convivem" como dois modos de DESENHO. Na tela, os 16
 * painéis viraram caixas de 80px com o conteúdo derramando por cima do vizinho:
 * com `grid-auto-rows: var(--tk-row)`, um item auto-posicionado ocupa **UMA**
 * linha, não a altura do conteúdo dele. `grid-auto-rows` dimensiona a linha; ele
 * não descreve o item.
 *
 * ⛔ E o conserto não é `minmax(var(--tk-row), auto)`: isso devolveria a altura
 * ao conteúdo em TODA linha, inclusive nos blocos migrados — a F1 inteira.
 *
 * **Os dois modos convivem na PERSISTÊNCIA, não no desenho.** O que distingue
 * `h: undefined` é *"a altura do usuário ainda não foi convertida"*, e isso
 * importa para o que se GRAVA. Para desenhar, o bloco não migrado usa o
 * `hPadrao` — que É a medição F0b, ou seja, a altura que ele tinha em `auto`.
 * Somada ao colapso do vazio, a renderização é idêntica à de antes da F1.
 *
 * ⚠️ O caso que fica diferente: quem tinha `linhas` MAIOR que a medição vê o
 * bloco no tamanho do catálogo até a migração gravar. É transitório (a migração
 * roda na mesma abertura, quando todos os blocos têm dado) e nunca perde a
 * escolha — o `linhas` continua no envelope.
 *
 * @param h        altura em CÉLULAS. `undefined` = ainda não migrado.
 * @param hPadrao  a medição F0b do bloco, usada enquanto não há `h`.
 * @param hColapso o teto imposto pela condição F0 quando o bloco está vazio.
 */
function celulaDaGrade(col: number, h: number | undefined, hPadrao: number, hColapso?: number): React.CSSProperties {
  /* `min`, e não substituição: um bloco cujo estado vazio precise de MAIS
     células que o `h` salvo não pode CRESCER — crescer no vazio é a definição do
     esburacado. O `funil` é o caso: ele mede 5 vazio e tem `h` 5, então
     `min(5, 5) = 5` e ele **não colapsa** — corretamente. O defeito ali é o
     CONTEÚDO do vazio dele, e é item nomeado da F3. */
  const base = h ?? hPadrao;
  const efetivo = hColapso === undefined ? base : Math.min(base, hColapso);

  return {
    gridColumn: `span ${col}`,
    gridRow: `span ${efetivo}`,
    /* ⛔ OS DOIS SÃO OBRIGATÓRIOS. Sem `minWidth: 0` o conteúdo empurra a coluna;
       sem `minHeight: 0` ele empurra a LINHA, e o `span` volta a ser um PISO em
       vez de altura — que é exatamente o modelo do qual a F1 acabou de sair. */
    minWidth: 0,
    minHeight: 0,
    /* 🔴 `size`, e não `inline-size` — é o que habilita `cqh`, as consultas de
       ALTURA da §4 do `07`.

       `container-type: size` implica `contain: size`: o conteúdo deixa de
       contribuir para o tamanho do próprio elemento. Isso só é seguro porque
       TODA célula tem altura definida agora (`span`). Foi uma tentativa de
       manter células em `auto` que produziu o defeito acima — e ali o `size`
       teria colapsado o bloco a zero.

       ⚠️ A CÉLULA é o contêiner das consultas dos blocos. Sem contêiner nenhum,
       o `@container` de dentro deles cairia na raiz e passaria a responder sobre
       a JANELA — que é o que a container query existe para não fazer. */
    containerType: "size",
  };
}

/**
 * 🔴 A CONDIÇÃO F0 — bloco sem dado COLAPSA; ele não some e não reescreve nada.
 *
 * ```
 * hVazio = min( h salvo , ceil((altura natural do card vazio + 16) / 96) )
 * ```
 *
 * ⛔ **NENHUM LIMIAR FIXO.** Três já foram reprovados pela medição nesta grade
 * (`h = 1`, a tabela de `hMin` da §3, e um "2 células" meu) — a seção do
 * `CLAUDE.md` conta os três. O número sai da medição do PRÓPRIO bloco, sempre.
 *
 * ### Como a altura natural é lida com o card já preso a um slot
 *
 * O card está esticado pelo `span`, então `card.height` não diz nada. O que diz
 * é o **cromo**: `card.height − corpo.height`, onde `corpo` é o div `flex: 1`
 * que absorve toda a folga (`[data-tk-corpo]`). Essa diferença é padding + gap +
 * cabeçalho, e ela **independe de quanto o card foi esticado**. Somando a altura
 * intrínseca do estado vazio, sai a altura que o card teria em `auto`.
 *
 * ⛔ O `h` SALVO NÃO É TOCADO. Isto é override de RENDERIZAÇÃO. Gravar o colapso
 * faria um período sem dado reescrever o layout do usuário em silêncio, e o
 * bloco não recuperaria o tamanho escolhido quando o dado voltasse — a distinção
 * central deste projeto (ausência de observação ≠ observação de zero), na camada
 * de persistência de layout.
 */
function useColapsoDoVazio() {
  const [celulas, setCelulas] = React.useState<Record<string, number>>({});

  const medir = React.useCallback((id: string, vazio: HTMLElement | null) => {
    const corpo = vazio?.closest<HTMLElement>("[data-tk-corpo]");
    const card = corpo?.parentElement;
    if (!vazio || !corpo || !card) return;

    const cromo = card.getBoundingClientRect().height - corpo.getBoundingClientRect().height;
    const n = celulasDePx(cromo + vazio.getBoundingClientRect().height);
    /* ⚠️ O estado guarda CÉLULAS, não pixels, e é isso que impede o laço: a
       altura natural não depende do span, mas o observer dispara com frações
       idênticas — comparar o INTEIRO faz o `setState` acontecer só quando o
       bloco de fato muda de tamanho. */
    setCelulas((m) => (m[id] === n ? m : { ...m, [id]: n }));
  }, []);

  return { celulas, medir };
}

/**
 * O estado vazio, MEDIDO. O `ref` fica num wrapper porque o `EmptyState` não
 * expõe um.
 *
 * ⚠️ Ele observa o PRÓPRIO vazio, não o card: a altura do vazio é intrínseca
 * (ele não cresce — o `distribuir` do card o centra na folga), então a medida é
 * estável mesmo enquanto o span muda em volta dela. É o que garante que o
 * colapso não vire um laço de "encolhe, remede, cresce".
 */
function VazioMedido({
  id,
  medir,
  children,
}: {
  id: string;
  medir: (id: string, el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const remedir = () => medir(id, el);
    remedir();
    const obs = new ResizeObserver(remedir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [id, medir]);

  return <div ref={ref}>{children}</div>;
}

/**
 * 🔴 QUANTAS COLUNAS A GRADE TEM AGORA — F2, a derivação por viewport.
 *
 * ⛔ **NO MODO DE EDIÇÃO ELE DEVOLVE 12, SEMPRE.** A edição opera sobre o layout
 * SALVO, que é de 12 colunas; a derivação é uma transformação de leitura. Se a
 * grade de edição fosse derivada, a alça mediria contra 4 colunas e o
 * `redimensionar` gravaria "4" num campo que significa doze avos — o arranjo do
 * usuário seria corrompido pelo tamanho da janela dele.
 *
 * ⚠️ Sim, isso deixa a edição apertada numa tela estreita. É o preço certo: o
 * modo de edição já exige uma coluna lateral de 300px, e um arranjo de 12
 * colunas editado em 4 seria um editor que mostra outra coisa do que grava.
 *
 * ### A hidratação
 *
 * Ele nasce em 12 no servidor E no primeiro render do cliente, e só então o
 * efeito mede. Ler `window` durante o render daria HTML do servidor diferente do
 * primeiro render do cliente — o mismatch que já derrubou a navegação de
 * Integrações. A troca acontece depois da hidratação, num segundo quadro.
 */
function useColunasDaGrade(editando: boolean): number {
  const [colunas, setColunas] = React.useState(COLUNAS_GRADE);

  React.useEffect(() => {
    const medir = () => setColunas(colunasParaLargura(window.innerWidth));
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  return editando ? COLUNAS_GRADE : colunas;
}

/**
 * 🔑 O CONTEÚDO DE UM BLOCO — o estado vazio ou o render. **Um ponto só.**
 *
 * ⛔ Ele existe porque a tela desenha a mesma lista em DOIS modos (edição e
 * normal), e foi ter dois caminhos de desenho que deixou "colapsar" virar
 * "sumir" em um deles e não no outro, em 07/08/2026. O que difere entre os dois
 * é a MOLDURA — a moldura de edição ou o `Card` —, e não o que vai dentro dela.
 *
 * ⚠️ O `medir` só chega no modo normal: ele alimenta a condição F0, e no modo de
 * edição o colapso não roda de propósito (o usuário está dimensionando o bloco).
 * Sem ele o estado vazio desenha igual, só não é medido.
 */
function conteudoDoBloco(
  id: string,
  r: RenderBloco,
  v: TraffikView,
  ctx: CtxBlocos,
  medir?: (id: string, el: HTMLElement | null) => void,
): React.ReactNode {
  const vazio = vazioDoBloco(r, v, ctx);
  if (!vazio) return r.render(v, ctx);
  /* ⛔ Sem `compacto`: o `EmptyState` completo é o mesmo que o usuário vai ver na
     tela de verdade, e a edição existe para mostrar o resultado, não uma
     aproximação. */
  if (!medir) return <EmptyState {...vazio} />;
  return (
    <VazioMedido id={id} medir={medir}>
      <EmptyState {...vazio} />
    </VazioMedido>
  );
}

/* ⛔ `BASE_DECLARADA` SAIU DAQUI — F5, 12/08/2026.

   Ela dizia qual população está em cima e qual embaixo no ROAS do Dashboard, e
   morava aqui porque era a tela que montava o hero e a faixa. As duas deixaram
   de existir: quem monta o `DadosKpi` de uma métrica agora é o render dela, em
   `catalogoRender.tsx`, e a declaração foi junto — para o lado do único
   consumidor, não para um arquivo de constantes.

   ⚠️ A conta segue INTOCADA, e o motivo está escrito lá. */

export function DashboardScreen({ v }: { v: TraffikView }) {
  /* ── O CONTEXTO DOS BLOCOS ────────────────────────────────────────────────
     Estado de lente e derivações caras, num objeto só. Ele existe porque um
     render dentro de um `Record` não pode chamar hook — o porquê inteiro está
     no cabeçalho de `dadosDosBlocos.tsx`. */
  /* ⚠️ `ctx`, e não `c`: `c` é o nome da CARGA nos callbacks de soltura logo
     abaixo, e o sombreamento passaria despercebido — `soltarNosPaineis(c, i)`
     compilaria com o contexto no lugar da carga se os tipos coincidissem. */
  /* ⚠️ O `inicioAparado` era desestruturado aqui para o `kpi()` da tela cortar a
     série do sparkline. Ele saiu com a F5: quem monta o `DadosKpi` de uma
     métrica agora é o render dela, e ele lê o mesmo campo do `ctx` que já
     recebe. Um acessor a mais aqui seria a segunda leitura do mesmo valor. */
  const ctx = useDadosDosBlocos(v);

  /* 🔴 O LAYOUT SALVO É RESPEITADO, E É EDITÁVEL. Quem customizou no grid
     antigo vê o arranjo dele migrado; quem nunca customizou vê o padrão.

     ⛔ TODAS as regras moram no hook — mínimo de cada bloco, teto de altura,
     recusa de remover um estrutural. A tela desenha; ela não valida de novo.

     ⚠️ **Não há mais três listas.** O `hero` e o `faixa` sumiram do estado da
     tela junto com as zonas: `layout.blocos` é a única, e as métricas estão
     dentro dela como qualquer painel. */
  const ed = useLayoutDashboard(v.workspaceAtiva);
  const { layout, editando } = ed;

  /* 🔴 A DERIVAÇÃO (F2) — uma transformação de LEITURA sobre o layout salvo.

     ⚠️ `blocos` é o que a tela DESENHA; `layout.blocos` é o que ela GRAVA. Toda
     operação do hook (mover, inserir, redimensionar) continua falando com o
     segundo, e por índice — que a derivação preserva, porque ela mapeia a lista
     sem reordenar. Se um dia ela filtrar ou reordenar, os índices deixam de
     casar e o arrasto passa a mover o bloco errado, em silêncio. */
  const colunas = useColunasDaGrade(editando);
  const blocos = React.useMemo(() => derivarLayout(layout.blocos, colunas), [layout.blocos, colunas]);
  const GRADE = React.useMemo(() => grade(colunas), [colunas]);

  /* A condição F0 — ver `useColapsoDoVazio`. Só o desenho, nunca o salvo. */
  const colapso = useColapsoDoVazio();

  /* ── A MIGRAÇÃO DE ALTURA, uma vez, ao abrir ──────────────────────────────
     🔴 A ELEGIBILIDADE (camada 1) MORA AQUI porque é aqui que "tem dado?" tem
     resposta: quem sabe é `vazioDoBloco`, que precisa de `v` e de `ctx`. O hook
     de layout não os tem, e passá-los para lá só para isto faria o layout
     depender do estado do dashboard inteiro.

     ⛔ **Não migrar enquanto carrega.** Durante o `dashLoading` todo bloco
     parece vazio, e migrar ali marcaria como "sem dado" a tela inteira — a
     migração não aconteceria nunca, para ninguém. É o mesmo erro de ler o
     `minHeight` renderizado em vez do envelope persistido, uma camada acima. */
  React.useEffect(() => {
    if (v.dashLoading) return;
    void ed.migrarAltura((id) => {
      const r = RENDERS[id as keyof typeof RENDERS];
      return !!r && vazioDoBloco(r, v, ctx) === null;
    });
  }, [ed, v, ctx]);

  /* ── ARRASTO ──────────────────────────────────────────────────────────────
     🔴 O DESTINO VÁLIDO ACENDE NO INÍCIO DO GESTO; O INCOMPATÍVEL APAGA.

     Substituiu o clique-para-adicionar da entrega C, por decisão do dono: duas
     mecânicas diferentes para a mesma intenção, e nenhuma delas visível antes do
     clique. Agora é um gesto só, e a regra aparece ANTES da soltura — quem
     decide o que aceita é o `useArrasto`, uma fonte para as três zonas.

     ⛔ A recusa nunca é pós-soltura: o destino incompatível devolve `null` em vez
     de handlers, e sem `preventDefault` no `dragover` o navegador desenha o
     cursor de proibido no meio do gesto. */
  const arr = useArrasto();

  /* ⚠️ A grade é MEDIDA, não calculada de um breakpoint. A conversão px→coluna
     precisa da largura real do container, e ela muda com o rail recolhido, com a
     coluna do catálogo aberta e com o zoom do navegador. */
  const gradeRef = React.useRef<HTMLDivElement>(null);

  /**
   * Converte o tamanho em px que a alça reportou para colunas e linhas CRUAS.
   *
   * ⛔ Cruas de propósito: quem encaixa no passo e aplica o mínimo do bloco é o
   * hook. Encaixar aqui criaria a segunda implementação da regra, e a daqui não
   * teria como saber o `colMin` de cada bloco sem ir buscá-lo — que é o começo
   * de duas verdades.
   */
  const paraGrade = React.useCallback((larguraPx: number, alturaPx: number) => {
    const el = gradeRef.current;
    if (!el) return { col: 1, h: 1 };
    const gap = parseFloat(getComputedStyle(el).columnGap || "16") || 16;
    const larguraCol = (el.getBoundingClientRect().width - gap * (COLUNAS_GRADE - 1)) / COLUNAS_GRADE;
    return {
      col: (larguraPx + gap) / (larguraCol + gap),
      /* ⚠️ O gap do denominador é o MEDIDO, não o 16 da conversão da migração:
         aqui o número descreve a tela de agora (a densidade pode ser outra), e
         lá ele descreve a unidade em que o `linhas` foi GRAVADO. São dois 16
         diferentes, e colapsá-los faria a alça mentir no `comfortable`. */
      h: (alturaPx + gap) / (ALTURA_CELULA + gap),
    };
  }, []);

  /* ── O que a grade faz com o que foi solto ──────────────────────────
     ⚠️ Estas funções são a TRADUÇÃO do gesto para a operação do hook; a REGRA
     continua lá.

     ⛔ **Eram quatro, e viraram duas.** `soltarNoHero` e `soltarNaFaixa` existiam
     para aplicar tetos — soltar um quinto KPI no hero virava TROCA porque a zona
     não podia ficar com 3, e hero→faixa era uma troca em sentido inverso. Sem
     teto não há troca: soltar é mover, e mover é mover. */
  const soltarNaGrade = React.useCallback(
    (c: Carga, indice: number) => {
      if (c.origem === "grade") ed.moverBloco(c.indice, indice);
      else ed.inserirBloco(c.id, indice);
    },
    [ed],
  );

  const soltarNoCatalogo = React.useCallback((c: Carga) => ed.removerBloco(c.id), [ed]);

  /* ── O que ainda não está na grade ─────────────────────────────────
     🔑 UMA LISTA, tirada do CATÁLOGO. Antes eram duas consultas a duas fontes
     diferentes — as métricas saíam de `v.metricCards` (o registro do hook) e os
     painéis do `CATALOGO_META`. Com a F5 as métricas estão no catálogo, e a
     pergunta virou uma só: *"o que existe e não está no layout?"*.

     ⛔ TUDO O QUE APARECE AQUI TEM DESTINO — e agora o destino é o mesmo para
     todos. Opção sem destino é a versão de catálogo do botão inerte. */
  const disponiveis = CATALOGO_META.filter((b) => !layout.blocos.some((p) => p.id === b.id)).map((b) => ({
    id: b.id,
    titulo: b.titulo,
    descricao: b.descricao,
    metrica: ehBlocoDeMetrica(b.id),
  }));

  const carregando = v.dashLoading;
  const filtrosVisiveis = useRegistrarFaixaDeFiltros();

  const conteudo = (
    <>
      <BannerPendencias workspaceId={v.workspaceAtiva} />

      {/* ── Filtros ─────────────────────────────────────────────────────────────
          A faixa é REGISTRADA no shell (`useRegistrarFaixaDeFiltros`), e é esse
          registro que faz o botão `Filtros` aparecer no header. Sem ele, o botão
          não existiria; sem o `filtrosVisiveis` aqui, ele existiria e não
          controlaria nada. As duas pontas do mesmo contrato. */}
      {filtrosVisiveis && (
      <div
        className="bg-surface border border-border"
        style={{
          borderRadius: "var(--tk-radius-card)",
          padding: "var(--tk-pad-card)",
          display: "flex",
          gap: "var(--tk-gap-grid)",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <FiltroPeriodo
            periodo={v.dashPeriod}
            from={v.dashFrom}
            to={v.dashTo}
            timezone={v.timezone}
            onChange={v.setDashPeriod}
          />
          <Select
            label="Conta de anúncio"
            value={v.dashAccount}
            onChange={v.setDashAccount}
            minWidth={170}
            options={[{ value: "todas", label: "Todas as contas" }, ...v.filterAccounts.map((a) => ({ value: a.id, label: a.name }))]}
          />
          <Select
            label="Produto"
            value={v.dashProduct}
            onChange={v.setDashProduct}
            minWidth={160}
            options={[{ value: "todos", label: "Todos os produtos" }, ...v.filterProducts.map((p) => ({ value: p, label: p }))]}
          />
          <Select
            label="Fonte de tráfego"
            value={v.dashSource}
            onChange={v.setDashSource}
            minWidth={160}
            /* ⚠️ O `value` é o utm_source CRU — é ele que o servidor usa no
               `where`. Só o rótulo é traduzido. */
            options={[{ value: "todas", label: "Todas as fontes" }, ...v.filterSources.map((s) => ({ value: s, label: nomeDaFonte(s) }))]}
          />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {v.syncManualMsg && (
            <span onClick={v.limparSyncMsg} title="Clique para dispensar" style={{ cursor: "pointer" }}>
              <Badge tom="neutral">{v.syncManualMsg}</Badge>
            </span>
          )}
          {/* 🔴 UM DE CADA VEZ. O selo dizia "Tudo já está atualizado." e o
              rótulo, ao lado, "Atualizado 7s atrás" — a mesma afirmação duas
              vezes, e a segunda com mais informação (ela diz QUANDO).

              O selo vence enquanto está na tela porque é o transitório: ele
              responde ao clique que a pessoa acabou de dar, e é o único dos
              dois que sabe dizer que a sincronização FALHOU. Dispensado ou
              expirado, o rótulo volta.

              ⚠️ Não é filtro por texto. Casar a string da mensagem quebraria
              no dia em que a rota mudasse uma palavra, e quebraria em silêncio
              — voltando a duplicar sem ninguém notar. */}
          {v.syncLabel && !v.syncManualMsg && !v.syncManualBusy && !carregando && (
            <span className="text-caption text-text-muted" style={{ whiteSpace: "nowrap" }}>{v.syncLabel}</span>
          )}
          <Button
            variante="secundario"
            onClick={v.refreshDashboard}
            carregando={v.syncManualBusy || carregando}
            iconeInicio={<Icone nome="atualizar" tamanho={14} />}
            title="Sincroniza com o Facebook e recarrega os dados"
          >
            {v.syncManualBusy ? "Sincronizando…" : carregando ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>
      </div>
      )}

      {/* ══ A GRADE — UMA SÓ, e é a F5 inteira ═══════════════════════════════
          🔴🔴 TODOS OS BLOCOS DO LAYOUT APARECEM, COM DADO OU SEM.

          Um comentário aqui já disse o contrário — *"SÓ os que TÊM DADO no
          período aparecem"* — e era o bug mais caro desta tela. O bloco sem dado
          saía da grade, os vizinhos subiam, a linha se refazia, e o arranjo que
          o usuário montou virava outro. Ele não via "um bloco vazio": via a tela
          embaralhada, sem nada dizendo por quê.

          ⛔ NÃO REINTRODUZA UM FILTRO AQUI. A lista desenhada é `layout.blocos`
          inteira; quem responde "tem dado?" é o `vazioDoBloco`, e a resposta
          muda o CONTEÚDO da célula, nunca a existência dela.

          ⚠️ O que colapsa é a ALTURA, e só ela: posição e largura são do usuário.

          ### 🔴 UM `map` PARA OS DOIS MODOS, e a duplicação que morreu com ele

          Havia DOIS blocos de JSX quase iguais — um dentro do modo de edição,
          outro fora — mais dois de métrica, quatro no total. Foi ter dois
          caminhos de desenho que deixou "colapsar" virar "sumir" em um deles e
          não no outro, em 07/08/2026. Hoje é uma função: o que muda entre os
          modos é a MOLDURA, e ela é um parâmetro. */}
      {layout.blocos.length === 0 ? (
        editando ? (
          <ZonaEdicao titulo="Painel" regra="arraste um bloco da lista ao lado" arrastando={arr.arrastando} aceita
            destino={arr.destino({ tipo: "grade", indice: 0 }, (c) => soltarNaGrade(c, 0))}>
            <p className="text-caption text-text-muted" style={{ margin: 0 }}>
              Nenhum bloco. Arraste um da lista ao lado — ou salve assim: a escolha de não ter nenhum é respeitada.
            </p>
          </ZonaEdicao>
        ) : null
      ) : editando ? (
        <ZonaEdicao
          titulo="Painel"
          /* ⚠️ A regra fala do GESTO, não de quantidade. As duas zonas que
             falavam de quantidade ("sempre 4", "até 8") sumiram com os tetos. */
          regra="arraste para mover · o canto redimensiona"
          arrastando={arr.arrastando}
          aceita
          destino={arr.destino({ tipo: "grade", indice: layout.blocos.length }, (c) =>
            soltarNaGrade(c, layout.blocos.length),
          )}
        >
          <div ref={gradeRef} style={GRADE}>
            {/* 🔴 O AVISO DE SOBRA é o que separa "você escolheu assim" de
                "quebrou". Sem ele, uma linha que não soma 12 é indistinguível de
                defeito — e agora que todas as colunas existem, fechar a linha
                é só arrastar. O texto diz quanto falta. */}
            {linhasDaGrade(blocos.map((p) => p.col)).flatMap((linha) => [
              ...linha.indices.map((i) => {
                const p = blocos[i]!;
                const r = RENDERS[p.id as keyof typeof RENDERS];
                const meta = metaDoBloco(p.id);
                if (!r || !meta) return null;
                return (
                  <div
                    key={p.id}
                    /* ⚠️ SEM colapso do vazio no modo de edição, e é deliberado:
                       ali o usuário está DIMENSIONANDO o bloco, e um slot que
                       encolhe sozinho porque o período não tem dado esconderia
                       dele o tamanho que ele acabou de escolher. */
                    style={celulaDaGrade(p.col, p.h, meta.hPadrao)}
                  >
                    <ItemEdicao
                      titulo={meta.titulo}
                      /* O bloco de métrica já escreve o próprio rótulo logo
                         abaixo — repetir no cabeçalho da moldura é a mesma
                         palavra duas vezes em 40px. */
                      tituloVisivel={!r.semCard}
                      /* 🔑 O bloco que desenha a própria superfície não leva o
                         padding da moldura: dois paddings somavam 40px de casca
                         dupla, e num slot de UMA célula isso é metade do que
                         existe. Medido na passada visual — ver `corpoDoItem`. */
                      semPadding={r.semCard}
                      /* 🔴 SEM ✕ NO ESTRUTURAL, com o selo `Fixo` e o motivo do
                         CATÁLOGO. Um ✕ apagado é um controle que existe e não
                         funciona; a ausência dele é uma afirmação sobre o
                         produto. ⚠️ A guarda de verdade está no hook — a
                         ausência do botão não fecha o caminho do arrasto. */
                      fixo={meta.estrutural}
                      aoRemover={meta.estrutural ? undefined : () => ed.removerBloco(p.id)}
                      aoMover={(dir) => ed.moverBloco(i, i + dir)}
                      podeAntes={i > 0}
                      podeDepois={i < layout.blocos.length - 1}
                      arrastando={arr.carga?.origem === "grade" && arr.carga.indice === i}
                      alvo={arr.ehAlvo({ tipo: "grade", indice: i })}
                      aoIniciarArrasto={() =>
                        arr.comecar({ id: p.id, rotulo: meta.titulo, origem: "grade", indice: i })
                      }
                      aoTerminarArrasto={arr.terminar}
                      destino={arr.destino({ tipo: "grade", indice: i }, (c) => soltarNaGrade(c, i))}
                      redimensionar={{
                        aoArrastar: (larguraPx, alturaPx) => {
                          const g = paraGrade(larguraPx, alturaPx);
                          ed.redimensionar(p.id, g.col, g.h);
                        },
                        /* O teclado anda em PASSO, não em pixel: é o que ele sabe
                           expressar. */
                        /* 🔴 `proximoPasso`, NÃO `p.col + dCol`. A soma direta
                           não movia NADA quando as larguras eram uma lista
                           curada: `4 + 1 = 5`, e o encaixe devolvia 4 de volta
                           pelo desempate. As setas existiam e eram inertes —
                           visto na tela, não no build, e com `tsc`/`lint`/`build`
                           verdes. */
                        /* ⚠️ O `?? meta.hPadrao` cobre o bloco ainda não
                           migrado: sem `h`, a primeira seta parte do padrão em
                           vez de partir de `0` e ser puxada para o `hMin` — o
                           que faria a seta para BAIXO aumentar o bloco. */
                        aoTeclado: (dCol, dLinhas) =>
                          ed.redimensionar(
                            p.id,
                            dCol ? proximoPasso(meta, p.col, dCol) : p.col,
                            (p.h ?? meta.hPadrao) + dLinhas,
                          ),
                      }}
                    >
                      {conteudoDoBloco(p.id, r, v, ctx)}
                    </ItemEdicao>
                  </div>
                );
              }),
              /* ⛔ TEXTO, e não área pontilhada. Pontilhado no fim da linha é
                 lido como alvo de soltura, e ali não se solta nada: o arrasto
                 insere na ORDEM da lista, não numa coordenada. Seria
                 affordance mentindo.

                 ⚠️ Ele é um ITEM DA GRADE, e isso é de propósito: se a simulação
                 de `linhasDaGrade` errar, o aviso aparece na linha errada, à
                 vista de quem edita. Guarda que falha em silêncio não é guarda. */
              avisoDeSobra(linha.livres) ? (
                <span
                  key={`sobra-${linha.indices[0]}`}
                  className="text-caption text-text-muted"
                  style={{
                    gridColumn: `span ${linha.livres}`,
                    alignSelf: "center",
                    textAlign: "right",
                    paddingRight: 2,
                    minWidth: 0,
                  }}
                >
                  {avisoDeSobra(linha.livres)}
                </span>
              ) : null,
            ])}
          </div>
        </ZonaEdicao>
      ) : (
        <div style={GRADE}>
          {blocos.map((p, i) => {
            const r = RENDERS[p.id as keyof typeof RENDERS];
            const meta = metaDoBloco(p.id);
            if (!r || !meta) return null;
            const vazio = vazioDoBloco(r, v, ctx);
            return (
              <div
                key={p.id}
                /* Entrada escalonada (`06` §11). ⛔ SÓ FORA DO MODO DE EDIÇÃO:
                   ali os blocos entram e saem a cada arrasto, e reanimar cada
                   mudança transformaria a edição num piscar constante. */
                className="tk-bloco-entra"
                style={{
                  ...celulaDaGrade(p.col, p.h, meta.hPadrao, vazio ? colapso.celulas[p.id] : undefined),
                  ["--tk-i" as string]: i,
                }}
              >
                {/* 🔑 A MOLDURA É O QUE MUDA ENTRE UM BLOCO E OUTRO, e a
                    pergunta é sobre MOLDURA — não sobre categoria. Um bloco que
                    desenha a própria superfície (a métrica) entra cru; o resto
                    entra num `Card`. Perguntar "é métrica?" aqui seria a zona
                    voltando com outro nome. */}
                {r.semCard ? (
                  r.render(v, ctx)
                ) : (
                  /* `preencher` + `distribuir`: os blocos de uma linha esticam
                     até a altura do slot, e o menor distribui o conteúdo em vez
                     de deixar o vazio embaixo. */
                  <Card
                    preencher
                    distribuir
                    /* A célula da grade já tem `containerType: size` — é o
                       contêiner que a escala mede. Ver o ⛔ da prop no `Card`. */
                    escala
                    titulo={meta.titulo}
                    descricao={meta.descricao}
                    /* ⚠️ O CONTROLE SOME NO ESTADO VAZIO, e o título fica. Um
                       `Diário|Semanal` sobre uma caixa sem série é um controle que
                       não controla nada. O título continua porque é ele que diz
                       QUAL bloco está vazio. */
                    acao={vazio === null ? r.acao?.(v, ctx) : undefined}
                  >
                    {conteudoDoBloco(p.id, r, v, ctx, colapso.medir)}
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const coluna = { display: "flex", flexDirection: "column" as const, gap: "var(--tk-gap-grid)", minWidth: 0 };

  return (
    <div style={coluna}>
      <BarraEdicao
        editando={editando}
        salvando={ed.salvando}
        aoEditar={ed.abrirEdicao}
        aoSalvar={ed.salvar}
        aoCancelar={ed.cancelar}
        aoRedefinir={ed.redefinir}
      />

      {editando ? (
        /* ⚠️ `alignItems: start` é o que deixa o `position: sticky` da coluna
           lateral funcionar: com o alongamento padrão do grid, o item tem a
           altura da linha inteira e nunca há o que grudar. */
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: "var(--tk-gap-grid)", alignItems: "start" }}>
          <div style={coluna}>{conteudo}</div>
          <CatalogoLateral
            blocos={disponiveis}
            arrastando={arr.arrastando}
            ehAlvo={arr.ehAlvo({ tipo: "catalogo" })}
            destino={arr.destino({ tipo: "catalogo" }, soltarNoCatalogo)}
            aoArrastar={(id, titulo) => arr.comecar({ id, rotulo: titulo, origem: "catalogo", indice: -1 })}
            aoTerminarArrasto={arr.terminar}
          />
        </div>
      ) : (
        conteudo
      )}
    </div>
  );
}

/* ⛔ `COLUNAS_CAMPANHA` e `CelulaCamp` saíram daqui — a tabela virou
   `components/tk/TabelaCampanhas.tsx`, e a grade das colunas virou `.tk-camp-linha`
   no `globals.css`.

   O motivo é a container query: as colunas de apoio precisam sumir quando o
   bloco encolhe, e uma constante em JS não sabe a largura do bloco. A ORDEM em
   que elas somem está documentada no cabeçalho do componente. */
