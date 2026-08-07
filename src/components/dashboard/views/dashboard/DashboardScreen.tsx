"use client";

import * as React from "react";

import { bandeiraDe, centroide, nomePais } from "@/lib/countries";
import { nomeDaFonte } from "@/lib/fontes";
import { brl, brl0 } from "@/lib/format";
import { corFinanceira } from "@/lib/financeiro";
import { useTheme } from "@/components/theme/ThemeProvider";
// A conta do token é UMA só nesta base — a mesma que Integrações usa.
import { detalheDoToken, estadoDoToken, rotuloDoToken, tokenPedeAtencao } from "@/lib/integracoes/token";

import { AlertList, type Alerta } from "@/components/tk/AlertList";
import { useRegistrarFaixaDeFiltros } from "@/components/tk/AppShell";
import { Card } from "@/components/tk/Card";
import { AlternadorPais, CountryPanel, useVisaoPais, type LinhaPais } from "@/components/tk/CountryPanel";
import { DonutChart, type FatiaDonut } from "@/components/tk/DonutChart";
import { EmptyState } from "@/components/tk/EmptyState";
import { KpiHero, MetricStrip, type DadosKpi } from "@/components/tk/Kpi";
import { LineChart, type PontoSerie } from "@/components/tk/LineChart";
import { RENDERS } from "../../catalogoRender";
import { ALTURA_LINHA, CATALOGO_META, COLUNAS_GRADE, ESTRUTURAIS_META, metaDoBloco, proximoPasso } from "../../catalogo";
import { useLayoutDashboard } from "../../layout/useLayoutDashboard";
import { useArrasto, type Carga } from "../../layout/useArrasto";
import { avisoDeSobra, linhasDaGrade } from "../../layout/grade";
import { MAX_FAIXA } from "../../layout/migrar";
import { BarraEdicao } from "@/components/tk/BarraEdicao";
import { CatalogoLateral } from "@/components/tk/CatalogoLateral";
import { ItemEdicao } from "@/components/tk/ItemEdicao";
import { ZonaEdicao } from "@/components/tk/ZonaEdicao";
import { Heatmap } from "@/components/tk/Heatmap";
import { Segmented } from "@/components/tk/Segmented";
import { StatusFooter, type BlocoEstado } from "@/components/tk/StatusFooter";
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
 *   RECEITA × GASTO  linha com pontos e break-even
 *   CANAIS           donut com legenda em coluna
 *   ALERTAS          a ÚNICA coisa da tela que exige ação
 *   PAÍSES           ranking ou globo, na metade inferior
 *   RODAPÉ           estado do sistema, não dinheiro
 *
 * ⛔ Cinco cards iguais aqui e a tela volta a ser a grade de doze. A quantidade
 * de heros é fixa de propósito.
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
 * 🔴 A GRADE — doze colunas, e a ALTURA VEM DO CONTEÚDO.
 *
 * `gridAutoRows: "auto"` é a correção do painel esburacado dos prints de
 * 07/08/2026. Com linha de altura fixa e `grid-row: span N`, um bloco VAZIO
 * reservava as 6 linhas que teria com dado só para escrever "Sem dado neste
 * período" — ao lado de outro de 3. E estado vazio é o que os testadores mais
 * veem.
 *
 * ⚠️ `alignItems` fica no PADRÃO (`stretch`), de propósito: é ele que faz os
 * blocos de uma mesma linha terminarem na mesma altura, alinhados pelo maior. O
 * menor recebe `distribuir` e centra o conteúdo na sobra, em vez de deixá-la
 * embaixo.
 *
 * ⛔ E sem `grid-auto-flow: dense`. Ele preenche buracos com blocos de MAIS
 * ADIANTE na lista, e a ordem que o usuário arrastou deixaria de ser a ordem que
 * ele vê. Se sobrar buraco depois da altura por conteúdo, a conversa é outra —
 * mas o buraco de agora não era ele.
 */
const GRADE: React.CSSProperties = {
  display: "grid",
  gap: "var(--tk-gap-grid)",
  gridTemplateColumns: `repeat(${COLUNAS_GRADE}, minmax(0, 1fr))`,
  gridAutoRows: "auto",
};

/**
 * A célula de um painel na grade.
 *
 * ⚠️ `linhas` vira `minHeight`, NÃO `grid-row: span`. A diferença é a que
 * importa: `span` é uma altura FIXA e o conteúdo maior vaza ou é cortado;
 * `minHeight` é um PISO, e o bloco cresce quando precisa. É o que permite ter
 * alça de altura sem voltar a reservar espaço para dado que não existe.
 *
 * ⚠️ E ele só vale com DADO — ver o comentário dentro da função.
 */
function celulaDaGrade(col: number, linhas: number | undefined, temDado: boolean): React.CSSProperties {
  return {
    gridColumn: `span ${col}`,
    minWidth: 0,
    /* ⚠️ A CÉLULA É O CONTAINER das consultas dos blocos. Sem isto, o
       `@container` de dentro deles procuraria um ancestral com
       `container-type` e cairia na raiz — respondendo sobre a JANELA, que é
       exatamente o que a container query existe para não fazer. */
    containerType: "inline-size",
    /* ⛔ O PISO DE ALTURA NÃO VALE NO ESTADO VAZIO. Um bloco que diz "Sem dado
       neste período" ocupando as 4 linhas que teria COM dado é exatamente o
       esburacado que a altura por conteúdo veio resolver — e estado vazio é o que
       os testadores mais veem. A altura escolhida pelo usuário é sobre o BLOCO
       COM DADO; aplicá-la ao vazio reserva espaço para o que não existe. */
    ...(linhas && temDado ? { minHeight: linhas * ALTURA_LINHA } : null),
  };
}

type MetricaHeat = "revenue" | "sales" | "profit";
const ROTULO_HEAT: Record<MetricaHeat, string> = { revenue: "Receita", sales: "Vendas", profit: "Lucro" };

/** Cor de canal — permitida DENTRO da plotagem e da legenda dela, nunca em selo. */
function corDoCanal(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes("meta") || n.includes("face") || n.includes("insta")) return "var(--tk-channel-meta)";
  if (n.includes("google") || n.includes("youtube")) return "var(--tk-channel-google)";
  if (n.includes("tiktok")) return "var(--tk-channel-tiktok)";
  return "var(--tk-channel-outros)";
}

export function DashboardScreen({ v }: { v: TraffikView }) {
  const { theme } = useTheme();
  const [granularidade, setGranularidade] = React.useState<"diario" | "semanal">("diario");
  const [metricaHeat, setMetricaHeat] = React.useState<MetricaHeat>("revenue");

  /* ── KPIs ─────────────────────────────────────────────────────────────────
     `metricCards` e `sparklines` continuam vindo do hook — a camada de dados
     não foi tocada. O que mudou é só quais aparecem grandes. */
  /* ── O APARO É UM SÓ, E OS DOIS DESENHOS OBEDECEM A ELE ───────────────────
     🔴 Estavam divergindo na tela: o gráfico grande mostrava 04/08–06/08 e
     avisava "27 dias sem movimento omitidos", enquanto os sparklines dos heros
     mostravam os 30 dias inteiros. Dois componentes lado a lado exibindo
     PERÍODOS diferentes, sem nada avisando — quem olhasse os dois via duas
     histórias do mesmo dado.

     O índice é calculado UMA vez, aqui, e vale para os dois. Duas decisões de
     recorte separadas divergiriam de novo no primeiro que alguém mexesse. */
  const inicioAparado = React.useMemo(() => {
    const { revenue, spend } = v.chartSerie;
    const i = v.chartSerie.labels.findIndex((_, n) => (revenue[n] ?? 0) > 0 || (spend[n] ?? 0) > 0);
    return i > 0 ? i : 0;
  }, [v.chartSerie]);

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
    if (!el) return { col: 1, linhas: 1 };
    const gap = parseFloat(getComputedStyle(el).columnGap || "16") || 16;
    const larguraCol = (el.getBoundingClientRect().width - gap * (COLUNAS_GRADE - 1)) / COLUNAS_GRADE;
    return {
      col: (larguraPx + gap) / (larguraCol + gap),
      linhas: (alturaPx + gap) / (ALTURA_LINHA + gap),
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

  /* ── Receita × gasto ─────────────────────────────────────────────────────── */
  const pontos: PontoSerie[] = React.useMemo(() => {
    const { labels, revenue, spend } = v.chartSerie;
    const base = labels.map((rotulo, i) => ({ rotulo, a: revenue[i] ?? 0, b: spend[i] ?? 0 }));
    /* 🔴 26 dias de linha zerada desperdiçavam 85% da largura. O eixo começa no
       PRIMEIRO dia com movimento — e quantos dias ficaram de fora é dito abaixo
       do gráfico, porque cortar em silêncio faria a janela parecer menor do que
       o filtro diz. Só apara o começo: buraco no MEIO da série é informação.

       O índice vem de `inicioAparado`, compartilhado com os sparklines. */
    const aparada = base.slice(inicioAparado);
    if (granularidade === "diario") return aparada;
    // Semanal: agrupa de 7 em 7 e rotula pelo primeiro dia do bloco.
    const semanas: PontoSerie[] = [];
    for (let i = 0; i < aparada.length; i += 7) {
      const bloco = aparada.slice(i, i + 7);
      semanas.push({
        rotulo: bloco[0]!.rotulo,
        a: bloco.reduce((s, p) => s + p.a, 0),
        b: bloco.reduce((s, p) => s + p.b, 0),
      });
    }
    return semanas;
  }, [v.chartSerie, granularidade, inicioAparado]);

  const temSerie = pontos.some((p) => p.a > 0 || p.b > 0);
  const diasAparados = Math.max(0, v.chartSerie.labels.length - (granularidade === "diario" ? pontos.length : 0));

  /* ── Canais ──────────────────────────────────────────────────────────────── */
  const fatias: FatiaDonut[] = v.sources.map((s) => ({
    nome: nomeDaFonte(s.name),
    valor: s.total,
    cor: corDoCanal(s.name),
  }));
  const totalCanais = fatias.reduce((s, f) => s + f.valor, 0);

  /* ── Países ──────────────────────────────────────────────────────────────── */
  const paises: LinhaPais[] = React.useMemo(
    () =>
      v.byCountry
        .filter((c) => c.code)
        .map((c) => {
          const pos = centroide(c.code);
          return {
            code: c.code,
            nome: nomePais(c.code) ?? c.code,
            bandeira: bandeiraDe(c.code) ?? "🏳️",
            vendas: c.sales,
            receita: c.revenue,
            lat: pos?.lat ?? null,
            lng: pos?.lng ?? null,
          };
        }),
    [v.byCountry],
  );
  // `estimadas` marca a venda cujo país veio de estimativa, não do gateway.
  const semPais = v.byCountry.reduce((s, c) => s + (c.code ? 0 : c.sales), 0);
  const { visao: visaoPais, setVisao: setVisaoPais } = useVisaoPais(paises.length);

  /* `Date.now()` no corpo do componente é impuro: o lint recusa, e com razão —
     o número mudaria entre dois renders sem o estado ter mudado. Fica num
     inicializador PREGUIÇOSO, que roda uma vez só. Consequência aceita: o "em
     execução" e o "expira em N dias" são do momento em que a tela montou, e se
     atualizam no próximo carregamento — não é um relógio ao vivo.

     ⚠️ DECLARADO AQUI, e não junto de `regrasRodando` lá embaixo: o bloco de
     alertas usa este valor, e `const` num corpo de componente tem zona morta —
     usá-lo antes da linha de declaração é `ReferenceError` em tempo de
     execução, não erro de compilação. O `tsc` não pega. */
  const [agora] = React.useState(() => Date.now());

  /* ── Alertas — DERIVADOS do que já existe, sem dado novo ─────────────────── */
  const alertas: Alerta[] = React.useMemo(() => {
    const lista: Alerta[] = [];

    if (!v.fbConnected) {
      lista.push({
        id: "sem-conta",
        severidade: "warning",
        titulo: "Nenhuma conta de anúncio conectada",
        detalhe: "Sem ela não há gasto, ROAS nem ROI.",
        href: "/dashboard/integracoes/anuncios",
      });
    }

    /* ── TOKEN DA META EXPIRANDO ───────────────────────────────────────────
       🔴 É a falha mais cara que esta ferramenta tem, e ela é MUDA: o token
       vence, a sincronização para, o gasto congela — e o ROAS passa a mentir
       por omissão enquanto o motor de regras decide com dado velho. Nada no
       Dashboard avisava.

       ⛔ A conta NÃO é feita aqui. `lib/integracoes/token.ts` é a fonte única,
       e a tela de Integrações usa exatamente as mesmas funções. Reimplementar
       "faltam N dias" numa segunda tela é como nasceram os dois `div` de
       contratos opostos.

       ⚠️ `desconhecido` ENTRA na lista, e é o caso mais perigoso: são os perfis
       conectados antes de a coluna existir — os mais antigos, logo os mais
       prováveis de já estarem vencidos. Um alerta que só aparece quando a data
       é conhecida cala justamente onde deveria falar. */
    for (const p of v.perfisCrus) {
      const t = estadoDoToken(p.tokenExpiresAt, new Date(agora));
      if (!tokenPedeAtencao(t)) continue;
      lista.push({
        id: `token-${p.id}`,
        severidade: t.tipo === "expira" ? "warning" : "danger",
        titulo: `${p.name}: ${rotuloDoToken(t)}`,
        detalhe: detalheDoToken(t) ?? undefined,
        href: "/dashboard/integracoes",
      });
    }

    /* `erroSync` já vem TRADUZIDO pelo `erroMeta.ts` — mensagem em linguagem de
       consequência, ação sugerida e um `tom` que diz se é erro ou aviso. Usar o
       tom dele em vez de marcar tudo como crítico é o que impede o painel de
       encher de vermelho por rate limit, que passa sozinho. */
    for (const p of v.adProfiles ?? []) {
      for (const c of p.accounts ?? []) {
        if (!c.erroSync) continue;
        lista.push({
          id: `conta-${c.id}`,
          severidade: c.erroSync.tom === "erro" ? "danger" : "warning",
          titulo: `${c.name}: ${c.erroSync.mensagem}`,
          detalhe: c.erroSync.acao ?? undefined,
          href: "/dashboard/integracoes/anuncios",
        });
      }
    }

    const roi = v.metricCards.roi;
    if (roi?.delta != null && roi.delta < -20) {
      lista.push({
        id: "roi-caiu",
        severidade: "warning",
        titulo: "ROI caiu mais de 20% no período",
        detalhe: `Agora em ${roi.value}.`,
      });
    }

    /* Gasto sem conversão: há gasto na série e nenhuma venda. É o alerta que
       mais custa dinheiro, e ele só é possível porque as duas séries vivem no
       mesmo objeto. */
    const gastoTotal = v.chartSerie.spend.reduce((s, n) => s + n, 0);
    const receitaTotal = v.chartSerie.revenue.reduce((s, n) => s + n, 0);
    if (gastoTotal > 0 && receitaTotal === 0) {
      lista.push({
        id: "gasto-sem-conversao",
        severidade: "danger",
        titulo: "Gasto sem nenhuma conversão",
        detalhe: `${brl(gastoTotal)} investidos e nenhuma venda atribuída no período.`,
      });
    }

    return lista;
  }, [v.fbConnected, v.adProfiles, v.perfisCrus, v.metricCards.roi, v.chartSerie, agora]);

  /* ── Rodapé de estado ────────────────────────────────────────────────────── */
  const contasComErro = (v.adProfiles ?? []).flatMap((p) => p.accounts ?? []).filter((c) => c.erroSync).length;
  const regras = v.rules ?? [];
  const regrasAtivas = regras.filter((r) => r.active).length;
  const regrasRodando = regras.filter(
    (r) => r.active && r.lastRunAt && agora - new Date(r.lastRunAt).getTime() < 15 * 60 * 1000,
  ).length;

  /* Despesas RECORRENTES do mês. Taxa percentual (gateway, imposto, coprodução)
     não entra: ela não tem valor em reais fora de uma venda, e somá-la produziria
     um número que não existe. Elas aparecem como contagem na segunda linha. */
  const despesaMensal = (v.despesaRows ?? []).reduce((soma, d) => soma + d.value, 0);
  const taxasPercentuais = (v.taxExpenses?.length ?? 0) + (v.gatewayExpenses?.length ?? 0);

  const rodape: BlocoEstado[] = [
    {
      chave: "integracoes",
      rotulo: "Integrações",
      valor: `${v.activeAccountCount ?? 0} conectadas`,
      alerta: contasComErro > 0 ? { texto: `${contasComErro} com erro`, tom: "danger" } : null,
      icone: <Icone nome="integracoes" tamanho={17} />,
      href: "/dashboard/integracoes/anuncios",
    },
    {
      chave: "regras",
      rotulo: "Regras ativas",
      valor: String(regrasAtivas),
      /* "Em execução" = rodou nos últimos 15 minutos, que é o intervalo do
         agendador. O motor é serverless: não existe processo rodando para
         perguntar, então o sinal honesto é o `lastRunAt` recente. */
      alerta:
        regrasRodando > 0
          ? { texto: `${regrasRodando} em execução`, tom: "success" }
          : regrasAtivas === 0
            ? { texto: "nenhuma automação ligada", tom: "warning" }
            : null,
      icone: <Icone nome="regras" tamanho={17} />,
      href: "/dashboard/regras",
    },
    {
      chave: "taxas",
      rotulo: "Taxas e Despesas (mês)",
      /* Soma das despesas RECORRENTES mensais com valor FIXO — é o que "do mês"
         significa. Taxa percentual (gateway, imposto, coprodução) não tem valor
         em reais fora de uma venda, então não entra nesta soma: somá-la daria um
         número que não existe. */
      valor: brl(despesaMensal),
      alerta:
        taxasPercentuais > 0
          ? { texto: `+ ${taxasPercentuais} ${taxasPercentuais === 1 ? "taxa percentual" : "taxas percentuais"}`, tom: "success" }
          : null,
      icone: <Icone nome="taxas" tamanho={17} />,
      href: "/dashboard/taxas",
    },
    {
      chave: "sync",
      rotulo: "Última atualização",
      valor: v.syncLabel ?? "—",
      alerta: v.syncManualBusy || v.dashLoading ? { texto: "sincronizando…", tom: "success" } : null,
      icone: <Icone nome="atualizar" tamanho={17} />,
    },
  ];

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
        <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {heros.map((k) => (
            <KpiHero key={k.chave} dados={k} carregando={carregando} />
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

      {/* ── Receita × gasto · Canais · Alertas ──────────────────────────────── */}
      <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "minmax(0,2fr) minmax(0,1.1fr) minmax(0,1fr)" }}>
        <Card
          preencher
          titulo="Receita vs. gasto"
          descricao={v.chartPeriodLabel}
          acao={
            <Segmented
              rotuloAcessivel="Granularidade do gráfico"
              valor={granularidade}
              aoTrocar={setGranularidade}
              opcoes={[
                { valor: "diario", rotulo: "Diário" },
                { valor: "semanal", rotulo: "Semanal" },
              ]}
            />
          }
        >
          {temSerie ? (
            <LineChart
              pontos={pontos}
              rotuloA="Receita"
              rotuloB="Gasto"
              /* ✅ O break-even agora EXISTE e é NÚMERO. Ele nasce colado ao
                 `lucro` em `financeiro.ts`, consumindo os MESMOS custos fixos
                 que o card de Lucro subtrai — senão a linha marcaria equilíbrio
                 num ponto em que o card ao lado diz prejuízo. */
              breakEven={v.finance.breakEven}
              semBreakEven={
                v.finance.breakEven == null && (v.metricCards.faturamento?.value ?? "") !== ""
                  ? "Break-even indisponível: sem faturamento no período não dá para medir a taxa efetiva."
                  : null
              }
              unicasFora={v.finance.unicasForaDoCalculo}
              formatar={brl0}
            />
          ) : null}
          {temSerie && diasAparados > 0 ? (
            <p className="text-caption text-text-muted" style={{ margin: "6px 0 0" }}>
              {diasAparados} {diasAparados === 1 ? "dia sem movimento omitido" : "dias sem movimento omitidos"} no
              início do período.
            </p>
          ) : null}
          {!temSerie && (
            <EmptyState
              titulo="Sem receita nem gasto no período"
              causa="A linha aparece quando entra uma venda rastreada ou quando a conta de anúncio sincroniza o gasto do dia."
              acao={{ texto: "Conferir integrações", href: "/dashboard/integracoes/anuncios" }}
            />
          )}
        </Card>

        <Card preencher distribuir titulo="Canais" descricao="Distribuição por receita">
          {totalCanais > 0 ? (
            <DonutChart fatias={fatias} totalLabel={brl0(totalCanais)} formatar={brl0} />
          ) : (
            <EmptyState
              titulo="Nenhuma venda por canal"
              causa={
                <>
                  O canal vem do <strong>utm_source</strong> do clique. Sem os códigos instalados, a
                  venda entra sem origem.
                </>
              }
              acao={{ texto: "Ver códigos de UTM", href: "/dashboard/integracoes/utms" }}
            />
          )}
        </Card>

        <Card
          preencher
          distribuir
          titulo="Alertas"
          descricao="O que exige ação"
          acao={alertas.length > 0 ? <Badge tom={alertas.some((a) => a.severidade === "danger") ? "danger" : "warning"}>{alertas.length}</Badge> : undefined}
        >
          <AlertList alertas={alertas} />
        </Card>
      </div>

      {/* ── Top campanhas ───────────────────────────────────────────────────
          ⛔ ELE OBEDECE O FILTRO DE PERIODO DE CIMA. O dado vem de
          `computeDashboard`, nao de `adsData` — que roda numa janela fixa de 7
          dias. Dois blocos na mesma tela mostrando periodos diferentes sem
          avisar foi o defeito que o aparo do sparkline consertou; este nasce
          com a janela certa em vez de precisar de aviso. */}
      {v.topCampaigns.length > 0 && (
        <Card titulo="Top campanhas" descricao="As que mais faturaram no período">
          {/* 🎨 O CABECALHO APARECE UMA VEZ, e antes ele se repetia em TODA
              linha — "Receita / Gasto / Vendas / ROAS" quatro vezes por
              campanha, cinco campanhas, vinte rotulos para quatro colunas.

              Era o que mais fazia o bloco parecer prototipo ao lado da imagem 1,
              onde a tabela tem cabecalho unico. E nao era so estetica: rotulo
              repetido em toda linha faz o olho reler a estrutura a cada item em
              vez de varrer a coluna.

              ⛔ O cabecalho e o corpo compartilham a MESMA `gridTemplateColumns`,
              pela constante abaixo. Duas listas de coluna escritas a mao
              divergem no primeiro ajuste, e a divergencia aparece como coluna
              desalinhada — que se atribui a arredondamento por semanas. */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              className="text-caption text-text-muted"
              style={{
                display: "grid",
                gridTemplateColumns: COLUNAS_CAMPANHA,
                gap: 10,
                padding: "0 8px 6px",
                borderBottom: "1px solid var(--tk-border)",
                marginBottom: 2,
              }}
            >
              <span style={{ minWidth: 0 }}>Campanha</span>
              <span style={{ textAlign: "right" }}>Receita</span>
              <span style={{ textAlign: "right" }}>Gasto</span>
              <span style={{ textAlign: "right" }}>Vendas</span>
              <span style={{ textAlign: "right" }}>ROAS</span>
            </div>

            {v.topCampaigns.map((c) => (
              <div
                key={c.id}
                className="tk-linha-campanha"
                style={{
                  display: "grid",
                  gridTemplateColumns: COLUNAS_CAMPANHA,
                  gap: 10,
                  alignItems: "center",
                  minHeight: 40,
                  padding: "0 8px",
                  borderRadius: 8,
                }}
              >
                <span className="text-label text-text" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.nome}
                </span>
                <CelulaCamp valor={brl0(c.receita)} />
                <CelulaCamp valor={brl0(c.gasto)} />
                <CelulaCamp valor={String(c.vendas)} />
                {/* 🔴 "—" quando nao houve gasto. `0,00x` diria "gastou e nao
                    voltou nada", que e uma acusacao diferente de "nao gastou". */}
                <CelulaCamp
                  valor={c.roas == null ? "—" : `${c.roas.toFixed(2).replace(".", ",")}x`}
                  cor={c.roas == null ? undefined : corFinanceira(c.roas, "roas")}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Quando compram ──────────────────────────────────────────────────
          ⛔ SEM "GASTO" NO SELETOR, e é impossível — não é escolha de escopo.
          `DailyAdMetric` é diária e a Meta não reporta gasto por hora; um valor
          por hora seria o total do dia lançado às 00h, um pico de madrugada que
          nunca houve. É o mesmo motivo pelo qual a linha de gasto desaparece na
          granularidade horária (`gastoNaSerie`). */}
      {v.heatmap.celulas.length > 0 && (
        <Card
          titulo="Quando compram"
          descricao="Média por hora, por dia da semana"
          acao={
            <Segmented
              rotuloAcessivel="Métrica do mapa de horários"
              valor={metricaHeat}
              aoTrocar={setMetricaHeat}
              opcoes={[
                { valor: "revenue", rotulo: "Receita" },
                { valor: "sales", rotulo: "Vendas" },
                { valor: "profit", rotulo: "Lucro" },
              ]}
            />
          }
        >
          <Heatmap
            celulas={v.heatmap.celulas.map((linha) =>
              linha.map((c) => ({ valor: c[metricaHeat], observacoes: c.observacoes })),
            )}
            formatar={metricaHeat === "sales" ? (n) => String(Math.round(n * 10) / 10) : brl0}
            rotuloMetrica={ROTULO_HEAT[metricaHeat]}
          />
          {/* 🔴 RETRATO × PADRÃO. As duas palavras carregam a diferença melhor
              que qualquer número: com uma observação por célula o mapa é
              honesto e não é tendência. Sem dizer isso, o usuário lê ruído de
              uma semana como comportamento do público — e decide mídia com
              base nisso. */}
          <p className="text-caption text-text-muted" style={{ margin: "10px 0 0", lineHeight: 1.45 }}>
            {/* ⚠️ A frase da hachura só aparece se HOUVER hachura. Numa janela
                de 30 dias todos os sete dias da semana foram observados, e
                explicar uma convenção que não está na tela ensina o leitor a
                não confiar no que o rodapé diz. */}
            {v.heatmap.maxObservacoes <= 1
              ? "Janela curta: cada célula é uma observação. É um retrato, não um padrão."
              : `Média de até ${v.heatmap.maxObservacoes} semanas.${
                  v.heatmap.celulas.some((l) => l.some((c) => c.observacoes === 0))
                    ? " Células hachuradas não foram observadas nesta janela."
                    : ""
                }`}
          </p>
        </Card>
      )}

      {/* ── ZONA 3 — os painéis do layout ───────────────────────────────────
          ⛔ SÓ os que TÊM DADO no período aparecem. Um painel corretamente vazio
          na tela do usuário parece defeito; o catálogo continua listando todos,
          com o aviso, para ele não procurar um bloco que sumiu.

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
                return (
                  <div
                    key={p.id}
                    style={celulaDaGrade(p.col, p.linhas, r.temDado(v))}
                  >
                    <ItemEdicao
                      titulo={meta.titulo}
                      aoRemover={() => ed.removerPainel(p.id)}
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
                          ed.redimensionar(p.id, g.col, g.linhas);
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
                        aoTeclado: (dCol, dLinhas) =>
                          ed.redimensionar(
                            p.id,
                            dCol ? proximoPasso(meta, p.col, dCol) : p.col,
                            /* ⚠️ Bloco sem `alturaAjustavel` ignora `dLinhas` —
                               `encaixarLinhas` devolve `undefined` para ele. A
                               seta não faz nada ali, e é honesto: aquele bloco
                               tem a altura do conteúdo, por decisão. */
                            dLinhas ? (p.linhas ?? 0) + dLinhas : p.linhas,
                          ),
                      }}
                    >
                      {/* 🔴 NO MODO DE EDIÇÃO O PAINEL SEM DADO CONTINUA NA TELA,
                          com a frase. Fora dele ele some — mas sumir enquanto se
                          edita faria o usuário achar que o removeu, e ele
                          tentaria adicionar de novo um bloco que já está lá. */}
                      {r.temDado(v) ? (
                        r.render(v)
                      ) : (
                        <p className="text-caption text-text-muted" style={{ margin: 0 }}>
                          Sem dado neste período. Ele aparece no painel quando houver.
                        </p>
                      )}
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

      {/* ── Sempre visíveis ─────────────────────────────────────────────────
          ⛔ Eles NÃO estão numa zona: não se movem, não se redimensionam e não
          saem. Aparecem aqui, no modo de edição, porque a alternativa é o
          usuário procurar por que "Alertas" não está em lista nenhuma — e
          concluir que a ferramenta perdeu o bloco dele.

          O motivo de cada um vem do CATÁLOGO, não escrito nesta tela. */}
      {editando && (
        <ZonaEdicao titulo="Sempre visíveis" regra="não podem ser ocultados">
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {ESTRUTURAIS_META.map((b) => (
              <ItemEdicao key={b.id} titulo={b.titulo} fixo={b.motivo} />
            ))}
          </div>
        </ZonaEdicao>
      )}

      {(() => {
        if (editando) return null;
        const visiveis = layout.paineis.filter((p) => RENDERS[p.id as keyof typeof RENDERS]?.temDado(v));
        if (visiveis.length === 0) return null;
        return (
          <div style={GRADE}>
            {visiveis.map((p) => {
              const r = RENDERS[p.id as keyof typeof RENDERS];
              const meta = metaDoBloco(p.id);
              if (!r || !meta) return null;
              return (
                <div key={p.id} style={celulaDaGrade(p.col, p.linhas, r.temDado(v))}>
                  {/* `preencher` + `distribuir`: os blocos de uma linha esticam
                      até a altura do MAIOR (é o `stretch` do grid), e o menor
                      distribui o conteúdo em vez de deixar o vazio embaixo. */}
                  <Card preencher distribuir titulo={meta.titulo} descricao={meta.descricao}>
                    {r.render(v)}
                  </Card>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Países ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "minmax(0,1fr)" }}>
        <Card
          titulo="Vendas por país"
          descricao="De onde vem o faturamento"
          acao={paises.length > 0 ? <AlternadorPais visao={visaoPais} aoTrocar={setVisaoPais} /> : undefined}
        >
          <CountryPanel
            linhas={paises}
            semPais={semPais}
            formatar={brl0}
            tema={theme === "light" ? "light" : "dark"}
            visao={visaoPais}
            altura={420}
          />
        </Card>
      </div>

      {/* ── Rodapé de estado ────────────────────────────────────────────────── */}
      <StatusFooter blocos={rodape} />
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

/**
 * ⛔ UMA constante para as colunas do Top campanhas — o cabeçalho e o corpo
 * leem daqui. Duas listas escritas à mão divergem no primeiro ajuste.
 */
const COLUNAS_CAMPANHA = "minmax(0,2fr) repeat(4, minmax(0,86px))";

/** Uma célula numérica do Top campanhas. O rótulo agora vive no cabeçalho. */
function CelulaCamp({ valor, cor }: { valor: string; cor?: string }) {
  return (
    <span
      className="text-label"
      style={{ textAlign: "right", minWidth: 0, color: cor ?? "var(--tk-text)", fontVariantNumeric: "tabular-nums" }}
    >
      {valor}
    </span>
  );
}
