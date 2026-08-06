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
import { CATALOGO_META, ESTRUTURAIS_META, metaDoBloco, type Largura, type Zona } from "../../catalogo";
import { useLayoutDashboard } from "../../layout/useLayoutDashboard";
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
const COLUNAS: Record<Largura, number> = { "um-terco": 2, metade: 3, cheia: 6 };

/** O rótulo curto de cada largura, no seletor do modo de edição. */
const ROTULO_LARGURA: Record<Largura, string> = { "um-terco": "⅓", metade: "½", cheia: "cheia" };

/** Onde um item estava quando o arrasto começou. */
type Posicao = { zona: Zona; indice: number };

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
     🔴 A RECUSA ENTRE ZONAS APARECE DURANTE O GESTO, NÃO NA SOLTURA.

     O mecanismo é o `preventDefault` do `dragover`: **só o item da MESMA zona o
     chama**. Sem ele o navegador põe `dropEffect: "none"` e desenha o cursor de
     proibido enquanto o ponteiro passa — e a `ZonaEdicao` de destino pinta o
     contorno de perigo junto, com a frase do porquê.

     ⚠️ Recusar depois de soltar faria o usuário executar o gesto inteiro para
     descobrir que ele não era possível, e ainda não diria o que fazer. */
  const [origem, setOrigem] = React.useState<Posicao | null>(null);
  const [sobre, setSobre] = React.useState<Posicao | null>(null);

  const propsArrasto = React.useCallback(
    (zona: Zona, indice: number, mover: (de: number, para: number) => void) => ({
      arrastando: origem?.zona === zona && origem.indice === indice,
      alvo: origem?.zona === zona && sobre?.zona === zona && sobre.indice === indice,
      aoIniciarArrasto: () => setOrigem({ zona, indice }),
      aoTerminarArrasto: () => {
        setOrigem(null);
        setSobre(null);
      },
      aoPassarPorCima: (e: React.DragEvent) => {
        // ⛔ Zona estrangeira: sai SEM `preventDefault`. É o que produz o 🚫.
        if (!origem || origem.zona !== zona) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setSobre({ zona, indice });
      },
      aoSoltar: (e: React.DragEvent) => {
        if (!origem || origem.zona !== zona) return;
        e.preventDefault();
        mover(origem.indice, indice);
        setOrigem(null);
        setSobre(null);
      },
    }),
    [origem, sobre],
  );

  /* ── O que ainda não está no painel ───────────────────────────────────────
     ⚠️ A lista de métricas sai de `metricCards`, que é o catálogo REAL do hook —
     não de uma lista escrita aqui. Uma segunda lista ofereceria a métrica que
     alguém acrescentou lá e esqueceu de espelhar aqui, ou o contrário: oferecer
     uma que não existe mais e não desenha nada. */
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
        <ZonaEdicao titulo="Principais" regra="sempre 4" recusaSe={origem != null && origem.zona !== "hero"}>
          <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {heros.map((k, i) => (
              <ItemEdicao
                key={k.chave}
                titulo={k.rotulo}
                /* O card já escreve "Faturamento" logo abaixo — repetir no
                   cabeçalho da moldura é a mesma palavra duas vezes em 40px. */
                tituloVisivel={false}
                /* ⛔ SEM ✕ NO HERO, e não é esquecimento: remover deixaria a zona
                   com 3, que é o estado que a regra proíbe. Aqui só se TROCA, e
                   quem faz a pergunta é o catálogo lateral. */
                aoMover={(dir) => ed.moverMetrica("hero", i, i + dir)}
                podeAntes={i > 0}
                podeDepois={i < heros.length - 1}
                {...propsArrasto("hero", i, (de, para) => ed.moverMetrica("hero", de, para))}
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
          recusaSe={origem != null && origem.zona !== "faixa"}
        >
          {faixa.length === 0 ? (
            <p className="text-caption text-text-muted" style={{ margin: 0 }}>
              O resumo está vazio. Escolha métricas ao lado — ou deixe assim, se a faixa não te serve.
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
                  {...propsArrasto("faixa", i, (de, para) => ed.moverMetrica("faixa", de, para))}
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
          <div style={{ display: "flex", flexDirection: "column" }}>
            {v.topCampaigns.map((c, i) => (
              <div
                key={c.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,2fr) repeat(4, minmax(0,86px))",
                  gap: 10,
                  alignItems: "baseline",
                  padding: "9px 0",
                  borderTop: i ? "1px solid var(--tk-border)" : undefined,
                }}
              >
                <span className="text-label text-text" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.nome}
                </span>
                <ColunaCamp rotulo="Receita" valor={brl0(c.receita)} />
                <ColunaCamp rotulo="Gasto" valor={brl0(c.gasto)} />
                <ColunaCamp rotulo="Vendas" valor={String(c.vendas)} />
                {/* 🔴 "—" quando nao houve gasto. `0,00x` diria "gastou e nao
                    voltou nada", que e uma acusacao diferente de "nao gastou". */}
                <ColunaCamp
                  rotulo="ROAS"
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
          regra="reordene, redimensione e oculte"
          recusaSe={origem != null && origem.zona !== "paineis"}
        >
          {layout.paineis.length === 0 ? (
            <p className="text-caption text-text-muted" style={{ margin: 0 }}>
              Nenhum painel. Escolha ao lado — ou salve assim: a escolha de não ter nenhum é respeitada.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
              {layout.paineis.map((p, i) => {
                const r = RENDERS[p.id as keyof typeof RENDERS];
                const meta = metaDoBloco(p.id);
                if (!r || !meta) return null;
                return (
                  <div key={p.id} style={{ gridColumn: `span ${COLUNAS[p.largura]}`, minWidth: 0 }}>
                    <ItemEdicao
                      titulo={meta.titulo}
                      aoRemover={() => ed.removerPainel(p.id)}
                      aoMover={(dir) => ed.moverPainel(i, i + dir)}
                      podeAntes={i > 0}
                      podeDepois={i < layout.paineis.length - 1}
                      larguras={{
                        atual: p.largura,
                        opcoes: meta.larguras.map((l) => ({ valor: l, rotulo: ROTULO_LARGURA[l] })),
                        aoTrocar: (valor) => ed.trocarLargura(p.id, valor as Largura),
                      }}
                      {...propsArrasto("paineis", i, ed.moverPainel)}
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
              })}
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
          <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
            {visiveis.map((p) => {
              const r = RENDERS[p.id as keyof typeof RENDERS];
              const meta = metaDoBloco(p.id);
              if (!r || !meta) return null;
              return (
                <div key={p.id} style={{ gridColumn: `span ${COLUNAS[p.largura]}`, minWidth: 0 }}>
                  <Card titulo={meta.titulo} descricao={meta.descricao}>
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
            heroAtual={layout.hero.map((chave) => ({ chave, rotulo: rotuloMetrica(chave) }))}
            faixaCheia={ed.faixaCheia}
            aoAdicionarFaixa={ed.addFaixa}
            aoTrocarHero={ed.trocarHero}
            paineis={paineisDisponiveis}
            aoAdicionarPainel={ed.addPainel}
          />
        </div>
      ) : (
        conteudo
      )}
    </div>
  );
}

/** Uma coluna do Top campanhas: rótulo miúdo em cima, número embaixo. */
function ColunaCamp({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <span style={{ textAlign: "right", minWidth: 0 }}>
      <span className="text-caption text-text-muted" style={{ display: "block" }}>{rotulo}</span>
      <span className="text-label" style={{ display: "block", color: cor ?? "var(--tk-text)", fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </span>
    </span>
  );
}
