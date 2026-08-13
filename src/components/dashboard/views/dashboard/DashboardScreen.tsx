"use client";

import * as React from "react";

import { nomeDaFonte } from "@/lib/fontes";

import { useRegistrarFaixaDeFiltros } from "@/components/tk/AppShell";
import { Card } from "@/components/tk/Card";
import { EmptyState } from "@/components/tk/EmptyState";
import { KpiHero, MetricStrip, type DadosKpi } from "@/components/tk/Kpi";
import { RENDERS, vazioDoBloco } from "../../catalogoRender";
import { useDadosDosBlocos } from "../../dadosDosBlocos";
import {
  ALTURA_CELULA,
  CATALOGO_META,
  COLUNAS_GRADE,
  celulasDePx,
  metaDoBloco,
  proximoPasso,
} from "../../catalogo";
import { useLayoutDashboard } from "../../layout/useLayoutDashboard";
import { useArrasto, type Carga } from "../../layout/useArrasto";
import { avisoDeSobra, linhasDaGrade } from "../../layout/grade";
import { MAX_FAIXA } from "../../layout/migrar";
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
 * Aqui a hierarquia é o produto:
 *
 *   4 KPIs HERO      Faturamento · Gasto · ROAS · Lucro, com sparkline e delta
 *   FAIXA COMPACTA   os outros sete, uma linha, sem card e sem sparkline
 *   PAINÉIS          TUDO o mais, na grade de 12 colunas, pelo layout do usuário
 *
 * ⛔ Cinco cards iguais aqui e a tela volta a ser a grade de doze. A quantidade
 * de heros é fixa de propósito.
 *
 * ### 🔴 A TERCEIRA ZONA ABSORVEU O JSX FIXO — 07/08/2026
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
 * ⚠️ Sobrou pouca coisa fixa nesta tela, e é de propósito: filtros, os dois
 * blocos de métrica e a moldura de edição. Se um bloco novo aparecer aqui em
 * JSX solto, é regressão — o lugar dele é o catálogo.
 *
 * ⚠️ ESTA TELA NÃO USA `.tk-tema`. Ela consome `--tk-*` e os primitivos de
 * `components/tk/` direto — a ponte existe só para as telas ainda não refeitas.
 */

/* ⛔ AS CONSTANTES `HERO` e `FAIXA` SUMIRAM DAQUI. Elas viraram o layout PADRÃO
   em `layout/migrar.ts`, e a tela agora lê o layout — que pode ser o do usuário.

   ⚠️ A regra de "exatamente 4 heros" não afrouxou: ela migrou para a MIGRAÇÃO,
   que completa o hero até 4 quando o salvo tem menos. Um hero com 3 quebra a
   fileira, e o estado não pode nascer nem do banco. */

/* A grade da zona 3 tem SEIS colunas, não doze: com seis, 1/3 são 2 e 1/2 são 3
   — inteiros exatos. Com doze, um terço daria 4 e a conta ainda fecharia, mas a
   grade aceitaria larguras que o catálogo não oferece, e alguém acabaria usando. */
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
const GRADE: React.CSSProperties = {
  display: "grid",
  gap: "var(--tk-gap-grid)",
  gridTemplateColumns: `repeat(${COLUNAS_GRADE}, minmax(0, 1fr))`,
  gridAutoRows: "var(--tk-row)",
};

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
 * 🔴 KPIs QUE SÃO RAZÃO ENTRE POPULAÇÕES DIFERENTES DECLARAM A BASE.
 *
 * O ROAS do Dashboard divide **toda** a receita aprovada (`metrics.ts:668`,
 * sem filtro de origem: orgânico, Google, TikTok, Meta) pelo `spend` do
 * `DailyAdMetric`, que é **só da Meta**. Medido no dev em 07/08/2026: a tela
 * mostra **3,54x** enquanto o ROAS real da Meta é **0,71x** — inflação de 5×,
 * cruzando o 1,0x que separa "se paga" de "dá prejuízo".
 *
 * ⛔ **A CONTA NÃO FOI ALTERADA, por decisão do dono.** O redesign não muda
 * funcionalidade nem lógica — ver o topo do `CLAUDE.md`. O que a tela ganhou é
 * a declaração da base, do mesmo jeito que o funil declara a cobertura de
 * rastreamento: o usuário não pode ler um número sem saber o que ele mede.
 *
 * 🔜 Reabrir quando existir a segunda plataforma de anúncio. Hoje "gasto" e
 * "Meta" são sinônimos nesta base, e é isso que torna o erro invisível.
 *
 * ⚠️ O ROAS **por campanha** (`ads/overview.ts`) não tem este defeito — lá as
 * duas pontas são da mesma campanha. Não unifique os dois.
 */
const BASE_DECLARADA: Record<string, string | undefined> = {
  roas: "receita de todos os canais ÷ gasto da Meta",
};

export function DashboardScreen({ v }: { v: TraffikView }) {
  /* ── O CONTEXTO DOS BLOCOS ────────────────────────────────────────────────
     Estado de lente e derivações caras, num objeto só. Ele existe porque um
     render dentro de um `Record` não pode chamar hook — o porquê inteiro está
     no cabeçalho de `dadosDosBlocos.tsx`. */
  /* ⚠️ `ctx`, e não `c`: `c` é o nome da CARGA nos callbacks de soltura logo
     abaixo, e o sombreamento passaria despercebido — `soltarNosPaineis(c, i)`
     compilaria com o contexto no lugar da carga se os tipos coincidissem. */
  const ctx = useDadosDosBlocos(v);
  const { inicioAparado } = ctx;

  /* ── KPIs ─────────────────────────────────────────────────────────────────
     `metricCards` e `sparklines` continuam vindo do hook — a camada de dados
     não foi tocada. O que mudou é só quais aparecem grandes. */
  const kpi = React.useCallback(
    (chave: string): DadosKpi | null => {
      const k = v.metricCards[chave as keyof typeof v.metricCards];
      if (!k) return null;
      return {
        chave,
        rotulo: k.label,
        valor: k.value,
        delta: k.delta ?? null,
        invertido: k.invertido,
        trendLabel: k.trendLabel,
        cor: k.cor,
        base: BASE_DECLARADA[chave],
        /* Mesma janela do gráfico. ⚠️ A série do sparkline tem um bucket por
           rótulo do gráfico — é o mesmo `buckets` do servidor —, então o índice
           vale para as duas sem conversão. */
        serie: (v.sparklines[chave] ?? []).slice(inicioAparado),
      };
    },
    [v, inicioAparado],
  );

  /* 🔴 O LAYOUT SALVO É RESPEITADO, E AGORA É EDITÁVEL. Quem customizou no grid
     antigo vê o arranjo dele migrado; quem nunca customizou vê o padrão.

     ⛔ TODAS as regras de zona moram no hook — hero com 4, teto da faixa,
     largura só entre as declaradas. A tela desenha três listas parecidas, e se
     as regras estivessem aqui a terceira acabaria sem a validação da primeira. */
  const ed = useLayoutDashboard(v.workspaceAtiva);
  const { layout, editando } = ed;
  const heros = layout.hero.map(kpi).filter((k): k is DadosKpi => k !== null);
  const faixa = layout.faixa.map(kpi).filter((k): k is DadosKpi => k !== null);

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

  /* ── O que cada zona faz com o que foi solto ──────────────────────────────
     ⚠️ Estas funções são a TRADUÇÃO do gesto para a operação do hook; a REGRA
     continua lá. É por isso que soltar um hero no Resumo vira `trocarHero`: o
     hero não pode ficar com 3, e a troca é a única leitura do gesto que respeita
     isso sem recusar o que o usuário pediu. */
  const soltarNoHero = React.useCallback(
    (c: Carga, indice: number) => {
      if (c.tipo !== "metrica") return;
      if (c.origem === "hero") ed.moverMetrica("hero", c.indice, indice);
      else ed.trocarHero(c.chave, indice);
    },
    [ed],
  );

  const soltarNaFaixa = React.useCallback(
    (c: Carga, indice: number) => {
      if (c.tipo !== "metrica") return;
      if (c.origem === "faixa") ed.moverMetrica("faixa", c.indice, indice);
      else if (c.origem === "hero") {
        /* Hero → Resumo é uma TROCA: quem estava no Resumo sobe para a vaga que
           o hero abriria. Tirar sem repor deixaria Principais com 3. */
        const entra = layout.faixa[indice];
        if (entra) ed.trocarHero(entra, c.indice);
      } else ed.inserirFaixa(c.chave, indice);
    },
    [ed, layout.faixa],
  );

  const soltarNosPaineis = React.useCallback(
    (c: Carga, indice: number) => {
      if (c.tipo !== "painel") return;
      if (c.origem === "paineis") ed.moverPainel(c.indice, indice);
      else ed.inserirPainel(c.id, indice);
    },
    [ed],
  );

  const soltarNoCatalogo = React.useCallback(
    (c: Carga) => {
      if (c.tipo === "painel") ed.removerPainel(c.id);
      else if (c.origem === "faixa") ed.removerFaixa(c.chave);
    },
    [ed],
  );

  /* ── O que ainda não está no painel ───────────────────────────────────────
     ⚠️ A lista de métricas sai de `metricCards`, que é o catálogo REAL do hook —
     não de uma lista escrita aqui. Uma segunda lista ofereceria a métrica que
     alguém acrescentou lá e esqueceu de espelhar aqui, ou o contrário: oferecer
     uma que não existe mais e não desenha nada.

     ⛔ TUDO O QUE APARECE AQUI TEM DESTINO. Métrica vai para Principais ou
     Resumo; painel vai para Painéis. Não existe item listado sem zona que o
     receba — opção sem destino é a versão de catálogo do botão inerte. */
  const rotuloMetrica = React.useCallback(
    (chave: string) => v.metricCards[chave as keyof typeof v.metricCards]?.label ?? chave,
    [v],
  );
  const metricasDisponiveis = Object.keys(v.metricCards)
    .filter((c) => !layout.hero.includes(c) && !layout.faixa.includes(c))
    .map((chave) => ({ chave, rotulo: rotuloMetrica(chave) }));
  const paineisDisponiveis = CATALOGO_META.filter((b) => !layout.paineis.some((p) => p.id === b.id)).map((b) => ({
    id: b.id,
    titulo: b.titulo,
    descricao: b.descricao,
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

      {/* ── 4 KPIs hero ─────────────────────────────────────────────────────── */}
      {editando ? (
        <ZonaEdicao
          titulo="Principais"
          regra="sempre 4"
          arrastando={arr.arrastando}
          aceita={arr.carga?.tipo === "metrica"}
        >
          <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {heros.map((k, i) => (
              <ItemEdicao
                key={k.chave}
                titulo={k.rotulo}
                /* O card já escreve "Faturamento" logo abaixo — repetir no
                   cabeçalho da moldura é a mesma palavra duas vezes em 40px. */
                tituloVisivel={false}
                /* ⛔ SEM ✕ NO HERO, e não é esquecimento: remover deixaria a zona
                   com 3, que é o estado que a regra proíbe. Aqui só se TROCA. */
                aoMover={(dir) => ed.moverMetrica("hero", i, i + dir)}
                podeAntes={i > 0}
                podeDepois={i < heros.length - 1}
                arrastando={arr.carga?.tipo === "metrica" && arr.carga.origem === "hero" && arr.carga.indice === i}
                alvo={arr.ehAlvo({ tipo: "zona", zona: "hero", indice: i })}
                /* 🔴 A PRÉVIA DE QUEM SAI. Soltar um quinto KPI aqui troca pelo
                   que está debaixo do cursor; sem dizer qual, o usuário descobre
                   depois de ter acontecido. */
                avisoAlvo={arr.carga?.tipo === "metrica" && arr.carga.origem !== "hero" ? `sai: ${k.rotulo}` : undefined}
                aoIniciarArrasto={() =>
                  arr.comecar({ tipo: "metrica", chave: k.chave, rotulo: k.rotulo, origem: "hero", indice: i })
                }
                aoTerminarArrasto={arr.terminar}
                destino={arr.destino({ tipo: "zona", zona: "hero", indice: i }, (c) => soltarNoHero(c, i))}
              >
                <KpiHero dados={k} carregando={carregando} />
              </ItemEdicao>
            ))}
          </div>
        </ZonaEdicao>
      ) : (
        /* ⚠️ `.tk-medida` em cada card, e não na fileira: a fileira é
           `auto-fit`, então a largura de UM card não é a dela dividida por
           quatro — com o rail recolhido cabem quatro, com ele aberto e a janela
           estreita cabem dois, e o card dobra de tamanho sem a fileira mudar.
           Medir a fileira daria a mesma faixa para os quatro, sempre. */
        <div className="tk-hero" style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {heros.map((k) => (
            <div key={k.chave} className="tk-medida" style={{ minWidth: 0, display: "flex" }}>
              <KpiHero dados={k} carregando={carregando} />
            </div>
          ))}
        </div>
      )}

      {/* ── Faixa compacta ──────────────────────────────────────────────────── */}
      {editando ? (
        <ZonaEdicao
          titulo="Resumo"
          regra="até 8"
          contador={`${layout.faixa.length} de ${MAX_FAIXA}`}
          arrastando={arr.arrastando}
          aceita={arr.carga?.tipo === "metrica"}
          destino={arr.destino({ tipo: "zona", zona: "faixa", indice: layout.faixa.length }, (c) =>
            soltarNaFaixa(c, layout.faixa.length),
          )}
        >
          {faixa.length === 0 ? (
            <p className="text-caption text-text-muted" style={{ margin: 0 }}>
              O resumo está vazio. Arraste métricas para cá — ou salve assim, se a faixa não te serve.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
              {faixa.map((k, i) => (
                <ItemEdicao
                  key={k.chave}
                  titulo={k.rotulo}
                  aoRemover={() => ed.removerFaixa(k.chave)}
                  aoMover={(dir) => ed.moverMetrica("faixa", i, i + dir)}
                  podeAntes={i > 0}
                  podeDepois={i < faixa.length - 1}
                  arrastando={arr.carga?.tipo === "metrica" && arr.carga.origem === "faixa" && arr.carga.indice === i}
                  alvo={arr.ehAlvo({ tipo: "zona", zona: "faixa", indice: i })}
                  avisoAlvo={arr.carga?.tipo === "metrica" && arr.carga.origem === "hero" ? `sobe: ${k.rotulo}` : undefined}
                  aoIniciarArrasto={() =>
                    arr.comecar({ tipo: "metrica", chave: k.chave, rotulo: k.rotulo, origem: "faixa", indice: i })
                  }
                  aoTerminarArrasto={arr.terminar}
                  destino={arr.destino({ tipo: "zona", zona: "faixa", indice: i }, (c) => soltarNaFaixa(c, i))}
                >
                  {/* O valor, e não só o nome: escolher "ARPU" sem ver que ele
                      está em R$ 0,00 neste período é escolher às cegas. */}
                  <span className="text-metric-md" style={{ color: k.cor ?? "var(--tk-text)" }}>
                    {carregando ? "—" : k.valor}
                  </span>
                </ItemEdicao>
              ))}
            </div>
          )}
        </ZonaEdicao>
      ) : (
        <MetricStrip itens={faixa} carregando={carregando} />
      )}


      {/* ── ZONA 3 — os painéis do layout ───────────────────────────────────
          🔴🔴 TODOS OS PAINÉIS DO LAYOUT APARECEM, COM DADO OU SEM.

          Este comentário dizia o contrário — *"SÓ os que TÊM DADO no período
          aparecem"* — e era o bug mais caro desta tela. O bloco sem dado saía da
          grade, os vizinhos subiam, a linha se refazia, e o arranjo que o
          usuário montou virava outro. Ele não via "um bloco vazio": via a tela
          embaralhada, sem nada dizendo por quê.

          E o argumento que sustentava a filtragem ("um painel corretamente vazio
          parece defeito") tinha o sinal trocado: quem parece defeito é a grade
          que se reorganiza sozinha. Sem dado é o estado NORMAL desta ferramenta
          — os testadores rodam assim a maior parte do tempo.

          ⚠️ O que colapsa é a ALTURA, e só ela: `celulaDaGrade` não aplica o
          piso escolhido pelo usuário no estado vazio. Posição e largura são
          dele.

          ⚠️ A largura vem do LAYOUT, e o layout só carrega larguras que o bloco
          declarou — a migração garante isso. A tela não valida de novo: duas
          validações da mesma regra divergem, e a de cá não tem como avisar. */}
      {editando ? (
        <ZonaEdicao
          titulo="Painéis"
          regra="arraste o canto para redimensionar"
          arrastando={arr.arrastando}
          aceita={arr.carga?.tipo === "painel"}
          destino={arr.destino({ tipo: "zona", zona: "paineis", indice: layout.paineis.length }, (c) =>
            soltarNosPaineis(c, layout.paineis.length),
          )}
        >
          {layout.paineis.length === 0 ? (
            <p className="text-caption text-text-muted" style={{ margin: 0 }}>
              Nenhum painel. Arraste um da lista ao lado — ou salve assim: a escolha de não ter nenhum é respeitada.
            </p>
          ) : (
            /* 🔴 A GRADE DE 12 COLUNAS. `grid-auto-rows` na altura da linha e
               `span` em colunas e linhas: quem cabe na mesma fileira fica, e o
               que não couber desce. Quem acomoda é o CSS, não uma conta nossa —
               reimplementar empacotamento em JS seria a terceira fonte de
               verdade sobre onde cada bloco está.

               ⛔ NÃO use `grid-auto-flow: dense`. Ele preenche buracos com
               blocos de MAIS ADIANTE na lista, e aí a ordem que o usuário
               arrastou deixa de ser a ordem que ele vê. */
            <div ref={gradeRef} style={GRADE}>
              {/* 🔴 O AVISO DE SOBRA é o que separa "você escolheu assim" de
                  "quebrou". Sem ele, uma linha que não soma 12 é indistinguível de
                  defeito — e agora que todas as colunas existem, fechar a linha
                  é só arrastar. O texto diz quanto falta. */}
              {linhasDaGrade(layout.paineis.map((p) => p.col)).flatMap((linha) => [
                ...linha.indices.map((i) => {
                const p = layout.paineis[i]!;
                const r = RENDERS[p.id as keyof typeof RENDERS];
                const meta = metaDoBloco(p.id);
                if (!r || !meta) return null;
                const vazio = vazioDoBloco(r, v, ctx);
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
                      /* 🔴 SEM ✕ NO ESTRUTURAL, com o selo `Fixo` e o motivo do
                         CATÁLOGO. Um ✕ apagado é um controle que existe e não
                         funciona; a ausência dele é uma afirmação sobre o
                         produto. ⚠️ A guarda de verdade está no hook — a
                         ausência do botão não fecha o caminho do arrasto. */
                      fixo={meta.estrutural}
                      aoRemover={meta.estrutural ? undefined : () => ed.removerPainel(p.id)}
                      aoMover={(dir) => ed.moverPainel(i, i + dir)}
                      podeAntes={i > 0}
                      podeDepois={i < layout.paineis.length - 1}
                      arrastando={arr.carga?.tipo === "painel" && arr.carga.origem === "paineis" && arr.carga.indice === i}
                      alvo={arr.ehAlvo({ tipo: "zona", zona: "paineis", indice: i })}
                      aoIniciarArrasto={() =>
                        arr.comecar({ tipo: "painel", id: p.id, rotulo: meta.titulo, origem: "paineis", indice: i })
                      }
                      aoTerminarArrasto={arr.terminar}
                      destino={arr.destino({ tipo: "zona", zona: "paineis", indice: i }, (c) => soltarNosPaineis(c, i))}
                      redimensionar={{
                        aoArrastar: (larguraPx, alturaPx) => {
                          const g = paraGrade(larguraPx, alturaPx);
                          ed.redimensionar(p.id, g.col, g.h);
                        },
                        /* O teclado anda em PASSO, não em pixel: é o que ele sabe
                           expressar. O encaixe do hook recebe `col + dCol` e
                           devolve o passo permitido mais próximo — então uma seta
                           pode pular de 4 para 6 quando não há 5. Isso é o
                           correto: o intermediário não existe na grade. */
                        /* 🔴 `proximoPasso`, NÃO `p.col + dCol`. A soma direta
                           não movia NADA: `4 + 1 = 5`, e o encaixe devolvia 4 de
                           volta pelo desempate para baixo. As setas existiam e
                           eram inertes — visto na tela, não no build, e com
                           `tsc`/`lint`/`build` verdes. O teclado anda por ÍNDICE
                           na lista de passos do bloco; a alça anda em pixel. As
                           duas entradas falam línguas diferentes. */
                        /* 🔴 AS SETAS VERTICAIS DEIXARAM DE SER INERTES PARA A
                           MAIORIA DOS BLOCOS. Antes, `encaixarLinhas` devolvia
                           `undefined` para quem não fosse `alturaAjustavel` — 6
                           dos 16 —, e ↑/↓ na alça daqueles blocos não fazia
                           nada. Todo bloco tem altura agora.

                           ⚠️ O `?? meta.hPadrao` cobre o bloco ainda não
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
                      {/* ⚠️ O MESMO ESTADO VAZIO DE FORA DA EDIÇÃO. Antes eram
                          dois textos diferentes — aqui uma frase curta, lá o
                          bloco sumindo — e a divergência era o bug: o usuário
                          via o painel na edição e não via depois de salvar.

                          ⛔ Sem `compacto`: o `EmptyState` completo é o mesmo
                          que ele vai ver na tela de verdade, e a edição existe
                          para mostrar o resultado, não uma aproximação. */}
                      {vazio ? <EmptyState {...vazio} /> : r.render(v, ctx)}
                    </ItemEdicao>
                  </div>
                );
                }),
                /* ⛔ TEXTO, e não área pontilhada. Pontilhado no fim da linha é
                   lido como alvo de soltura, e ali não se solta nada: o arrasto
                   insere na ORDEM da lista, não numa coordenada. Seria
                   affordance mentindo — o mesmo defeito do cursor de ponteiro
                   sobre o globo que não respondia.

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
          )}
        </ZonaEdicao>
      ) : null}

      {/* ⛔ A ZONA "SEMPRE VISÍVEIS" FOI REMOVIDA — 07/08/2026.

          Ela listava os quatro estruturais em molduras VAZIAS, fora de qualquer
          grade, porque o conteúdo deles estava em JSX fixo noutro ponto da tela.
          Era a materialização do erro de definição: "não removível" tinha virado
          "fora do layout".

          Hoje eles estão na zona Painéis, com conteúdo, alça e selo `Fixo`. Não
          existe mais um lugar onde procurá-los — eles estão onde sempre
          estiveram na tela. */}

      {/* 🔴🔴 O SÍTIO DO BUG DO ITEM 9 — a linha que filtrava era esta.

          Era `layout.paineis.filter(… temDado(v))`. Um bloco sem dado no período
          não entrava na lista, e a grade se refazia sem ele: os vizinhos subiam
          de linha, a largura relativa mudava, e o arranjo salvo virava outro
          arranjo. Sem nada na tela dizendo por quê.

          ⛔ NÃO REINTRODUZA UM FILTRO AQUI. A lista desenhada é `layout.paineis`
          inteira; quem responde "tem dado?" é o `vazioDoBloco`, e a resposta
          muda o CONTEÚDO da célula, nunca a existência dela.

          ⚠️ `layout.paineis.length === 0` continua devolvendo `null`, e é outra
          coisa: é o usuário ter removido todos os opcionais. Com os estruturais
          repostos pela migração isso só acontece num layout corrompido — mas
          `null` para lista vazia é honesto de qualquer jeito. */}
      {!editando && layout.paineis.length > 0 && (
        <div style={GRADE}>
          {layout.paineis.map((p, i) => {
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
                {/* `preencher` + `distribuir`: os blocos de uma linha esticam
                    até a altura do MAIOR (é o `stretch` do grid), e o menor
                    distribui o conteúdo em vez de deixar o vazio embaixo. */}
                <Card
                  preencher
                  distribuir
                  /* A célula da grade já tem `containerType: inline-size` — é o
                     contêiner que a escala mede. Ver o ⛔ da prop no `Card`. */
                  escala
                  titulo={meta.titulo}
                  descricao={meta.descricao}
                  /* ⚠️ O CONTROLE SOME NO ESTADO VAZIO, e o título fica. Um
                     `Diário|Semanal` sobre uma caixa sem série é um controle que
                     não controla nada — a família que este projeto persegue.
                     O título continua porque é ele que diz QUAL bloco está
                     vazio; sem ele o usuário vê uma caixa anônima. */
                  acao={vazio === null ? r.acao?.(v, ctx) : undefined}
                >
                  {vazio ? (
                    <VazioMedido id={p.id} medir={colapso.medir}>
                      <EmptyState {...vazio} />
                    </VazioMedido>
                  ) : (
                    r.render(v, ctx)
                  )}
                </Card>
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
            metricas={metricasDisponiveis}
            paineis={paineisDisponiveis}
            faixaCheia={ed.faixaCheia}
            arrastando={arr.arrastando}
            ehAlvo={arr.ehAlvo({ tipo: "catalogo" })}
            destino={arr.destino({ tipo: "catalogo" }, soltarNoCatalogo)}
            aoArrastarMetrica={(chave, rotulo) =>
              arr.comecar({ tipo: "metrica", chave, rotulo, origem: "catalogo", indice: -1 })
            }
            aoArrastarPainel={(id, titulo) =>
              arr.comecar({ tipo: "painel", id, rotulo: titulo, origem: "catalogo", indice: -1 })
            }
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
