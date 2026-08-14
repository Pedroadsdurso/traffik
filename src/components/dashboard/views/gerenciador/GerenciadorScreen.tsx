"use client";

import * as React from "react";

import { combinaStatus, estaArquivado } from "@/lib/ads/status";
import { calcularInsights, type LinhaParaInsight } from "@/lib/ads/insights";
import { derivar, div, somar } from "@/lib/ads/metrics";
import { rotuloDoObjetivo } from "@/lib/ads/objetivos";
import type { AdsOverview, CampaignRow } from "@/lib/ads/overview";
import { brl, multFmt, plural } from "@/lib/format";

import { useRegistrarFaixaDeFiltros } from "@/components/tk/AppShell";
import { Abas } from "@/components/tk/Abas";
import { BarraSelecao, type Acao, type Nivel } from "@/components/tk/BarraSelecao";
import { Button } from "@/components/tk/Button";
import { Card } from "@/components/tk/Card";
import { DonutChart } from "@/components/tk/DonutChart";
import { EmptyState } from "@/components/tk/EmptyState";
import { Input } from "@/components/tk/Input";
import { BlocoMetrica, type DadosKpi } from "@/components/tk/Kpi";
import { ModalNovaCampanha } from "@/components/tk/ModalNovaCampanha";
import { PainelInsights } from "@/components/tk/PainelInsights";
import { Paginacao, type PorPagina } from "@/components/tk/Paginacao";
import { Select } from "@/components/tk/Select";
import {
  CONJUNTOS_DE_COLUNAS,
  TabelaAds,
  valorDaColuna,
  type ChaveColunaAds,
  type ConjuntoDeColunas,
  type LinhaAds,
} from "@/components/tk/TabelaAds";

import { FiltroPeriodo } from "../../ui/FiltroPeriodo";
import { Select as SelectLegado } from "../../ui/Select";
import { Icone } from "../../ui/Icone";
import type { TraffikView } from "../../useTraffikState";

/**
 * # Gerenciador de Anúncios — reescrito do zero em 07/08/2026
 *
 * `AdsManagerView` (490), `AdsTable` (447), `AdsActionBar` (298) e
 * `NovaCampanhaModal` (125) foram **deletados**, não editados — regra zero do
 * `03`. A lógica de dados, as rotas e o cálculo continuam onde estavam.
 *
 * ## O que mudou de ESTRUTURA (o que sobrevive ao teste do cinza)
 *
 * | Antes | Agora |
 * |---|---|
 * | 4 cards-aba de NÍVEL (Contas/Campanhas/Conjuntos/Anúncios) | **expansão inline** ▸ campanha → conjunto → anúncio, e `Agrupar por` para listar um nível direto |
 * | nenhuma métrica no topo | **5 KPIs hero com sparkline** + rosca de status |
 * | 19 colunas sempre, cabeçalho de 10px | **conjuntos nomeados** de 6 a 7 colunas + 3 congeladas |
 * | barra de ações sempre visível, quase sempre desabilitada | **barra que aparece com a seleção** |
 * | a tela não dizia nada | **painel de Insights** — ela diz o que achou |
 * | lista inteira de uma vez | **paginação** com N por página |
 *
 * ## 🕳️ E a distinção que ela existe para fazer
 *
 * `R$ 0,00` deixou de ser a resposta para "nunca sincronizou". Ver
 * `lib/ads/apresentacao.ts` — a regra vale para toda coluna da Meta, não só
 * para o Gasto, porque `div(0, 5)` produzia um CPA de R$ 0,00 igualmente falso.
 *
 * ⛔ **Nenhuma conta foi alterada.** `computeAdsOverview` ganhou uma série
 * diária (campo novo, aditivo) para o sparkline; `sumAds`, `derivar` e `somar`
 * estão intocados.
 */

/** O nível que a tabela lista. São os mesmos quatro valores do hook. */
type NivelTabela = "campaigns" | "adsets" | "ads" | "accounts";

const NIVEL_DA_ABA: Record<NivelTabela, Nivel | null> = {
  campaigns: "campaign",
  adsets: "adset",
  ads: "ad",
  // Conta não é entidade que a Meta pausa — não há ação em massa para ela.
  accounts: null,
};

const SUBSTANTIVO: Record<NivelTabela, { um: string; varios: string }> = {
  campaigns: { um: "campanha", varios: "campanhas" },
  adsets: { um: "conjunto", varios: "conjuntos" },
  ads: { um: "anúncio", varios: "anúncios" },
  accounts: { um: "conta", varios: "contas" },
};

/**
 * 🔧 A ABA É O FILTRO DE STATUS, e não existe um `Status: Todos ⌄` ao lado.
 *
 * A imagem 4 tem os dois — abas de status E um select de status na fileira de
 * filtros. Dois controles para o mesmo estado é a receita para eles
 * discordarem: o usuário troca um, o outro continua dizendo outra coisa, e a
 * lista obedece a um dos dois sem dizer qual.
 */
const ABAS_STATUS = [
  { id: "todos", rotulo: "Todas" },
  { id: "ativo", rotulo: "Ativas" },
  { id: "pausado", rotulo: "Pausadas" },
  { id: "arquivado", rotulo: "Arquivadas" },
] as const;

const CHAVE_COLUNAS = "tk:gerenciador:colunas";

export function GerenciadorScreen({ v }: { v: TraffikView }) {
  const raw: AdsOverview | null = v.adsRaw;
  const nivel = v.adsSub as NivelTabela;
  const nivelDeAcao = NIVEL_DA_ABA[nivel];

  const [objetivo, setObjetivo] = React.useState("todos");
  const [ordem, setOrdem] = React.useState<{ chave: ChaveColunaAds; dir: "asc" | "desc" } | null>({
    chave: "gasto",
    dir: "desc",
  });
  const [pagina, setPagina] = React.useState(1);
  const [porPagina, setPorPagina] = React.useState<PorPagina>(10);
  const [fixadas, setFixadas] = React.useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = React.useState(false);
  const [resultado, setResultado] = React.useState<string | null>(null);

  /**
   * 🔗 A SELEÇÃO CARREGA O NÍVEL DELA.
   *
   * A rota de ações em massa recebe UM `nivel` — não existe operação que pause
   * uma campanha e um anúncio na mesma chamada. Com a expansão inline, linhas de
   * níveis diferentes convivem na tela, então marcar uma de outro nível TROCA a
   * seleção em vez de misturar. O contrário deixaria a barra prometendo uma ação
   * que a rota recusaria — e a recusa chegaria depois do clique de confirmar.
   */
  const [selecao, setSelecao] = React.useState<{ nivel: Nivel; ids: Set<string> }>({
    nivel: "campaign",
    ids: new Set(),
  });

  /**
   * O conjunto de colunas, lembrado no navegador.
   *
   * 🔧 `localStorage`, e não o banco: é o mesmo precedente do rail recolhido, e
   * a escolha é de leitura, não de conta. Persistir no servidor exigiria coluna,
   * migration e server action — trabalho que o `03` pede ("persistida por
   * usuário") e que não vale bloquear a tela. Fica registrado no `04`.
   */
  const [conjunto, setConjunto] = React.useState<ConjuntoDeColunas>("performance");
  /* Lido DEPOIS de montar, e não no `useState`: o servidor não tem
     `localStorage`, e ler ali produziria HTML diferente do cliente. Mesmo
     padrão (e mesma exceção de lint) do rail recolhido. */
  React.useEffect(() => {
    const salvo = localStorage.getItem(CHAVE_COLUNAS);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `localStorage` não existe no SSR; ler no `useState` faria o HTML do servidor divergir do cliente
    if (salvo && CONJUNTOS_DE_COLUNAS.some((c) => c.id === salvo)) setConjunto(salvo as ConjuntoDeColunas);
  }, []);
  const trocarConjunto = (id: ConjuntoDeColunas) => {
    setConjunto(id);
    localStorage.setItem(CHAVE_COLUNAS, id);
  };
  const colunas = (CONJUNTOS_DE_COLUNAS.find((c) => c.id === conjunto) ?? CONJUNTOS_DE_COLUNAS[0]!).colunas;

  /* ── O RECORTE ────────────────────────────────────────────────────────────
     ⚠️ UMA função, usada pela tabela, pelos KPIs, pela rosca, pelo Insights, pela
     contagem das abas e pela exportação. Ela já divergiu uma vez nesta base
     (a aba dizia "12 campanhas" com a tabela vazia), e agora são seis
     consumidores em vez de dois. */
  const busca = v.adsSearch.trim().toLowerCase();
  const passaBusca = React.useCallback((nome: string) => !busca || nome.toLowerCase().includes(busca), [busca]);
  const passaObjetivo = React.useCallback(
    (obj: string | null) => objetivo === "todos" || obj === objetivo,
    [objetivo],
  );

  /** As campanhas do filtro — a população dos KPIs, da rosca e do Insights. */
  const campanhasDoFiltro = React.useMemo(
    () =>
      (raw?.campaigns ?? []).filter(
        (c) => combinaStatus(c.status, v.adsStatus) && passaBusca(c.name) && passaObjetivo(c.objective),
      ),
    [raw, v.adsStatus, passaBusca, passaObjetivo],
  );

  /* ── KPIs ────────────────────────────────────────────────────────────────
     🔴 ELES SOMAM AS CAMPANHAS DO FILTRO, NÃO A PÁGINA. Na imagem 4 o KPI diz
     R$ 51.618,14 enquanto a tabela mostra 7 de 40 linhas — o topo descreve o
     Gerenciador, o rodapé da tabela descreve o que está à vista. As duas frases
     são verdadeiras e dizem coisas diferentes; por isso a paginação escreve
     "Mostrando 1 a 10 de 40" em vez de deixar a conta por fazer.

     ⚠️ E eles são de CAMPANHA em qualquer agrupamento. Trocar para "Anúncio" não
     muda o gasto da conta; mudaria só a receita, porque a atribuição por
     `utm_content` alcança menos vendas que a por `utm_campaign`. Um KPI que
     encolhe ao trocar de agrupamento pareceria perda de dado. */
  const totalKpi = React.useMemo(() => somar(campanhasDoFiltro), [campanhasDoFiltro]);
  const mKpi = derivar(totalKpi);

  /** A série somada das MESMAS campanhas. Ver `SerieDaCampanha`. */
  const series = React.useMemo(() => {
    const n = raw?.dias.length ?? 0;
    const zero = () => new Array<number>(n).fill(0);
    const spend = zero();
    const revenue = zero();
    const results = zero();
    for (const c of campanhasDoFiltro) {
      for (let i = 0; i < n; i++) {
        spend[i] += c.serie.spend[i] ?? 0;
        revenue[i] += c.serie.revenue[i] ?? 0;
        results[i] += c.serie.results[i] ?? 0;
      }
    }
    return {
      spend,
      revenue,
      results,
      lucro: revenue.map((r, i) => r - (spend[i] ?? 0)),
      /* `div` devolve `null` no dia sem gasto, e o `Sparkline` INTERROMPE a
         linha ali — em vez de ligar por cima e inventar um ROAS para um dia que
         não teve investimento. */
      roas: revenue.map((r, i) => div(r, spend[i] ?? 0)),
    };
  }, [campanhasDoFiltro, raw]);

  const kpis: DadosKpi[] = [
    { chave: "gasto", rotulo: "Gasto", valor: brl(totalKpi.spend), delta: null, serie: series.spend },
    {
      chave: "receita", rotulo: "Receita", valor: brl(totalKpi.revenue), delta: null, serie: series.revenue,
      /* 🔴 A BASE. O faturamento aqui é só o que os UTMs conseguiram atribuir a
         uma campanha — venda sem UTM existe e não aparece nesta tela. O
         Dashboard, que é no nível da conta, mostra um número maior. */
      base: "só as vendas atribuídas a campanhas",
    },
    {
      chave: "lucro", rotulo: "Lucro de mídia", valor: brl(mKpi.lucro), delta: null, serie: series.lucro,
      cor: mKpi.lucro < 0 ? "var(--tk-danger)" : null,
      base: "faturamento − gasto, sem taxas nem impostos",
    },
    {
      /* 🔧 A imagem 4 chama esta coluna de `ROI` — mas o número dela é
         receita ÷ gasto (128.430 ÷ 51.618 = 2,48x), que nesta ferramenta se
         chama **ROAS**. Mantido o nome nativo do usuário: o `ROI de mídia` é
         outra conta ((receita − gasto) ÷ gasto) e continua na tabela. Dois
         números diferentes com o mesmo nome é o defeito que o `AdsTable` já
         tinha resolvido uma vez. */
      chave: "roas", rotulo: "ROAS", valor: multFmt(mKpi.roas), delta: null, serie: series.roas,
      cor: mKpi.roas != null && mKpi.roas < 1 ? "var(--tk-danger)" : null,
    },
    { chave: "conversoes", rotulo: "Conversões", valor: totalKpi.results.toLocaleString("pt-BR"), delta: null, serie: series.results },
  ];

  /* ── A ROSCA DE STATUS ───────────────────────────────────────────────────
     ⚠️ Ela IGNORA a aba de status, de propósito: dentro da aba "Ativas" ela
     mostraria 100% de ativas, sempre — um gráfico que só sabe repetir o filtro.
     Ela responde "como está a conta", e a aba responde "o que estou olhando".
     Os outros filtros (busca, objetivo) valem, senão ela falaria de campanhas
     que não estão em lugar nenhum da tela. */
  const paraRosca = (raw?.campaigns ?? []).filter((c) => passaBusca(c.name) && passaObjetivo(c.objective));
  const contar = (teste: (c: CampaignRow) => boolean) => paraRosca.filter(teste).length;
  const fatias = [
    { nome: "Ativas", valor: contar((c) => c.status === "ACTIVE"), cor: "var(--tk-success)" },
    { nome: "Pausadas", valor: contar((c) => c.status === "PAUSED"), cor: "var(--tk-warning)" },
    { nome: "Arquivadas", valor: contar((c) => estaArquivado(c.status)), cor: "var(--tk-text-muted)" },
    /* 🔧 A fatia condicional que o `04` pede no lugar de "Rascunhos" — nós não
       temos esse conceito (`EntityStatus` não o tem, e `veiculacao.ts` não mapeia
       nenhum `effective_status` de rascunho). `UNKNOWN` é o status que o sync
       ainda não escreveu, e a fatia SOME quando não há nenhuma: em produção ele
       é raro, e `0 sem status` seria ruído permanente. */
    { nome: "Sem status", valor: contar((c) => c.status === "UNKNOWN"), cor: "var(--tk-category)" },
  ].filter((f) => f.valor > 0);

  /* ⚠️ Contagem SEPARADA da rosca, e não uma quinta fatia: "nunca sincronizou" é
     uma medição (não existe `DailyAdMetric` nenhuma), e status é configuração.
     Uma campanha pode estar ATIVA e nunca ter sincronizado — as duas fatias a
     contariam, e a rosca deixaria de somar 100%. */
  const nuncaSincronizadas = contar((c) => c.medicao === "nunca-sincronizada");

  /* ── AS LINHAS DA TABELA ─────────────────────────────────────────────────
     A hierarquia é montada aqui e a expansão é da tabela: ela recebe a árvore
     pronta e decide o que está aberto. */
  const paraLinha = React.useCallback(
    (
      base: {
        id: string; fbId: string; name: string; status: string; effectiveStatus?: string | null;
        medicao: CampaignRow["medicao"]; spend: number; impressions: number; clicks: number;
        results: number; revenue: number; ic: number; cliquesAtribuidos: number; vendasIniciadas: number;
      },
      extra: Partial<LinhaAds>,
    ): LinhaAds => ({
      id: base.id, fbId: base.fbId, nome: base.name, status: base.status,
      effectiveStatus: base.effectiveStatus, medicao: base.medicao,
      spend: base.spend, impressions: base.impressions, clicks: base.clicks,
      results: base.results, revenue: base.revenue,
      ic: base.ic, cliquesAtribuidos: base.cliquesAtribuidos, vendasIniciadas: base.vendasIniciadas,
      ...extra,
    }),
    [],
  );

  const linhasDoNivel: LinhaAds[] = React.useMemo(() => {
    if (!raw) return [];

    const anunciosDoConjunto = (adSetId: string): LinhaAds[] =>
      raw.ads
        .filter((a) => a.adSetId === adSetId)
        .map((a) => paraLinha(a, { sub: "Anúncio", orcamentoEditavel: false }));

    const conjuntosDaCampanha = (campaignId: string, campanhaCbo: boolean): LinhaAds[] =>
      raw.adSets
        .filter((s) => s.campaignId === campaignId)
        .map((s) =>
          paraLinha(s, {
            sub: "Conjunto",
            orcamento: s.dailyBudget,
            bidCap: s.bidAmount,
            // Conjunto só edita orçamento quando a campanha-mãe é ABO.
            orcamentoEditavel: !campanhaCbo,
            filhas: anunciosDoConjunto(s.id),
          }),
        );

    if (nivel === "campaigns") {
      return campanhasDoFiltro.map((c) =>
        paraLinha(c, {
          /* `06` §14.4 — sub-rótulo na célula. 🔧 Só o objetivo: a referência põe
             `Vendas | Google Ads`, e "Meta Ads" apareceria em toda linha de toda
             conta, porque a ferramenta é mono-plataforma. */
          sub: rotuloDoObjetivo(c.objective),
          orcamento: c.dailyBudget,
          // CBO edita na campanha; ABO não (o orçamento vive nos conjuntos).
          orcamentoEditavel: c.dailyBudget != null,
          /* ⚠️ As filhas NÃO passam pelo filtro de status: expandir é navegar na
             hierarquia, não filtrar de novo. Um conjunto pausado dentro de uma
             campanha ativa é exatamente o que se quer ver ao abrir a linha. */
          filhas: conjuntosDaCampanha(c.id, c.dailyBudget != null),
        }),
      );
    }

    if (nivel === "adsets") {
      return raw.adSets
        .filter((s) => combinaStatus(s.status, v.adsStatus) && passaBusca(s.name) && passaObjetivo(s.objective))
        .map((s) =>
          paraLinha(s, {
            sub: s.campaignName,
            orcamento: s.dailyBudget,
            bidCap: s.bidAmount,
            orcamentoEditavel: raw.campaigns.find((c) => c.id === s.campaignId)?.dailyBudget == null,
            filhas: anunciosDoConjunto(s.id),
          }),
        );
    }

    if (nivel === "ads") {
      return raw.ads
        .filter((a) => combinaStatus(a.status, v.adsStatus) && passaBusca(a.name) && passaObjetivo(a.objective))
        .map((a) => paraLinha(a, { sub: a.campaignName, orcamentoEditavel: false }));
    }

    // ── Contas ──────────────────────────────────────────────────────────────
    return raw.accounts
      .filter((ac) => passaBusca(ac.name))
      .map((ac) => {
        const campanhas = raw.campaigns.filter((c) => c.accountId === ac.id);
        const soma = somar(campanhas);
        /* A medição da conta é a MELHOR entre as campanhas dela: se alguma
           sincronizou, a soma da conta foi observada. Só quando NENHUMA
           sincronizou é que a conta inteira é uma ausência. */
        const medicao = campanhas.some((c) => c.medicao === "medida")
          ? ("medida" as const)
          : campanhas.some((c) => c.medicao === "sem-veiculacao")
            ? ("sem-veiculacao" as const)
            : ("nunca-sincronizada" as const);
        return {
          id: ac.id,
          fbId: ac.fbAccountId,
          nome: ac.name,
          sub: `${ac.fbAccountId} · ${plural(campanhas.length, "campanha", "campanhas")}`,
          /* ⚠️ Aqui o toggle é "a Trackhub sincroniza esta conta", não
             pausar/ativar na Meta — por isso `status` sai de `tracking`. E a
             conta NÃO leva `effectiveStatus`: a célula de Veiculação mostra "—"
             seco, sem falar em sincronização pendente, que ali seria mentira. */
          status: ac.tracking ? "ACTIVE" : "PAUSED",
          medicao,
          spend: soma.spend,
          impressions: soma.impressions,
          clicks: soma.clicks,
          results: soma.results,
          revenue: soma.revenue,
          ic: soma.ic ?? 0,
          cliquesAtribuidos: soma.cliquesAtribuidos ?? 0,
          vendasIniciadas: soma.vendasIniciadas ?? 0,
          filhas: campanhas.map((c) => paraLinha(c, { sub: rotuloDoObjetivo(c.objective) })),
        } satisfies LinhaAds;
      });
  }, [raw, nivel, campanhasDoFiltro, v.adsStatus, passaBusca, passaObjetivo, paraLinha]);

  /* ── Ordenação ───────────────────────────────────────────────────────────
     ⛔ Ela roda ANTES da paginação e usa `valorDaColuna`, a mesma função que a
     célula imprime. Uma conta própria aqui poderia ordenar por um ROAS que
     discorda do ROAS ao lado.

     ⚠️ Sem medição vai para o FIM nos dois sentidos: `null` não é "o menor".
     Numa ordenação por CPA crescente, tratá-lo como zero poria as campanhas que
     ninguém mediu no topo do ranking de "mais baratas". */
  const ordenadas = React.useMemo(() => {
    const lista = [...linhasDoNivel];
    lista.sort((a, b) => {
      const fa = fixadas.has(a.id) ? 1 : 0;
      const fb = fixadas.has(b.id) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      if (!ordem) return 0;
      const va = valorDaColuna(a, ordem.chave);
      const vb = valorDaColuna(b, ordem.chave);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return ordem.dir === "desc" ? vb - va : va - vb;
    });
    return lista;
  }, [linhasDoNivel, ordem, fixadas]);

  const paginaValida = Math.min(pagina, Math.max(1, Math.ceil(ordenadas.length / porPagina)));
  const daPagina = ordenadas.slice((paginaValida - 1) * porPagina, paginaValida * porPagina);

  /**
   * Trocar de filtro ou de nível volta para a primeira página: continuar na
   * página 4 de uma lista que agora tem 2 mostra uma tabela vazia com um "6"
   * aceso na paginação.
   *
   * ⚠️ Isto era um `useEffect` com as dependências dos filtros, e o lint recusa
   * — com razão: o efeito rodava DEPOIS de um render com a página inválida, e a
   * correção era um segundo render. Aqui o reset acontece **no mesmo evento** que
   * troca o filtro, que é onde ele conceitualmente pertence.
   *
   * ⛔ Todo controle que muda o conjunto de linhas passa por aqui. Um que não
   * passe volta a deixar a página fora do intervalo — e o `paginaValida` abaixo
   * esconderia o defeito mostrando a última página em vez da primeira.
   */
  const trocandoFiltro = <T,>(aplicar: (v: T) => void) => (valor: T) => {
    setPagina(1);
    aplicar(valor);
  };

  /* ── Insights ────────────────────────────────────────────────────────────
     Sempre sobre CAMPANHAS, em qualquer agrupamento: recomendar "escale o
     anúncio X" exigiria um julgamento sobre criativo que esta tela não faz. */
  const insights = React.useMemo<LinhaParaInsight[]>(
    () =>
      campanhasDoFiltro.map((c) => ({
        id: c.id, nome: c.name, status: c.status, effectiveStatus: c.effectiveStatus,
        medicao: c.medicao, spend: c.spend, revenue: c.revenue, results: c.results,
      })),
    [campanhasDoFiltro],
  );

  // ── Seleção ───────────────────────────────────────────────────────────────
  const selecionadasAqui = nivelDeAcao === selecao.nivel ? selecao.ids : new Set<string>();

  function alternarSelecao(id: string) {
    if (!nivelDeAcao) return;
    setSelecao((s) => {
      const mesmoNivel = s.nivel === nivelDeAcao;
      const ids = new Set(mesmoNivel ? s.ids : []);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      return { nivel: nivelDeAcao, ids };
    });
  }

  function alternarTodas() {
    if (!nivelDeAcao) return;
    setSelecao((s) => {
      const todas = daPagina.every((l) => s.nivel === nivelDeAcao && s.ids.has(l.id));
      return { nivel: nivelDeAcao, ids: todas ? new Set() : new Set(daPagina.map((l) => l.id)) };
    });
  }

  const alvos = ordenadas
    .filter((l) => selecionadasAqui.has(l.id))
    .map((l) => ({ id: l.id, nome: l.nome, cbo: nivel === "campaigns" ? l.orcamento != null : undefined }));

  // ── Ações que escrevem no Facebook ────────────────────────────────────────
  async function executar(acao: Acao, valor?: number, ativar?: boolean) {
    if (!nivelDeAcao) return;
    setOcupado(true);
    setResultado(null);
    try {
      const res = await fetch("/api/ads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nivel: nivelDeAcao, acao, ids: [...selecionadasAqui], valor, ativar }),
      });
      const data = (await res.json()) as {
        error?: string; sucessos?: number;
        resultados?: { nome: string; ok: boolean; erro?: string }[];
      };
      if (data.error) {
        setResultado(`✗ ${data.error}`);
        return;
      }
      const falhas = data.resultados?.filter((r) => !r.ok) ?? [];
      const s = SUBSTANTIVO[nivel];
      setResultado(
        falhas.length === 0
          ? `✓ ${plural(data.sucessos ?? 0, `${s.um} atualizad${s.um.endsWith("a") ? "a" : "o"}`, `${s.varios} atualizad${s.um.endsWith("a") ? "a" : "o"}s`)} no Facebook.`
          : `${data.sucessos} ok · ${plural(falhas.length, "falhou", "falharam")}: ${falhas.map((f) => `${f.nome} (${f.erro})`).join("; ")}`,
      );
      setSelecao((sel) => ({ ...sel, ids: new Set() }));
      v.refreshAds();
    } catch (e) {
      setResultado(`✗ ${e instanceof Error ? e.message : "Falha de rede."}`);
    } finally {
      setOcupado(false);
    }
  }

  /** Edição inline do orçamento — mesma rota das ações em massa, com 1 id. */
  async function salvarOrcamento(id: string, valor: number) {
    if (!nivelDeAcao) return;
    const res = await fetch("/api/ads/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nivel: nivelDeAcao, acao: "budget", ids: [id], valor }),
    });
    const data = (await res.json()) as { error?: string; resultados?: { ok: boolean; erro?: string }[] };
    const falha = data.error ?? data.resultados?.find((r) => !r.ok)?.erro;
    setResultado(falha ? `✗ ${falha}` : "✓ Orçamento atualizado no Facebook.");
    v.refreshAds();
  }

  function fixar() {
    setFixadas((f) => {
      const n = new Set(f);
      for (const id of selecionadasAqui) {
        if (n.has(id)) n.delete(id);
        else n.add(id);
      }
      return n;
    });
  }

  function copiarId() {
    const ids = ordenadas.filter((l) => selecionadasAqui.has(l.id)).map((l) => l.fbId);
    void navigator.clipboard.writeText(ids.join("\n"));
    setResultado(`✓ ${plural(ids.length, "ID copiado", "IDs copiados")}`);
  }

  function abrirNoFacebook() {
    const l = ordenadas.find((x) => selecionadasAqui.has(x.id));
    if (!l || !raw) return;
    const contaId =
      raw.campaigns.find((c) => c.id === l.id)?.accountId ??
      raw.adSets.find((a) => a.id === l.id)?.accountId ??
      raw.ads.find((a) => a.id === l.id)?.accountId ??
      null;
    const conta = raw.accounts.find((a) => a.id === contaId);
    const act = conta ? `act_${conta.fbAccountId.replace(/^act_/, "")}` : "";
    const base = "https://adsmanager.facebook.com/adsmanager/manage";
    const url =
      nivel === "campaigns"
        ? `${base}/campaigns?act=${act}&selected_campaign_ids=${l.fbId}`
        : nivel === "adsets"
          ? `${base}/adsets?act=${act}&selected_adset_ids=${l.fbId}`
          : `${base}/ads?act=${act}&selected_ad_ids=${l.fbId}`;
    window.open(url, "_blank", "noopener");
  }

  /**
   * Exportação.
   *
   * ⛔ Ela usa `valorDaColuna`, a MESMA função da célula — inclusive a regra de
   * medição, que vira **célula vazia** no arquivo. Um `0` ali seria a planilha
   * afirmando o que a tela se recusa a afirmar, e planilha é justamente onde o
   * número vai ser somado sem ninguém reler a tela.
   */
  function exportar() {
    const cols = colunas.filter((c) => c !== "veiculacao");
    const cab = ["Nome", "ID do Facebook", "Status", ...cols];
    const linhas = ordenadas.map((l) => [
      l.nome,
      l.fbId,
      l.status,
      ...cols.map((c) => {
        const n = valorDaColuna(l, c);
        return n === null ? "" : String(n).replace(".", ",");
      }),
    ]);
    const csv = [cab, ...linhas]
      .map((linha) => linha.map((campo) => `"${String(campo).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    // BOM: sem ele o Excel em pt-BR abre "Promoção" como "PromoÃ§Ã£o".
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trackhub-${SUBSTANTIVO[nivel].varios}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * O estado vazio.
   *
   * 🔴 Ele era MUDO: "Nenhuma campanha neste período", sempre. Com uma conta
   * cujos objetos foram todos arquivados no Facebook, a tabela ficava vazia e
   * **nada dizia que havia 12 itens escondidos pelo filtro** — porque "Todas"
   * exclui arquivadas de propósito. O usuário concluía que o sync falhou.
   */
  const vazio = (() => {
    if (nivel === "accounts") {
      return (
        <EmptyState
          titulo="Nenhuma conta conectada"
          causa="Conecte um perfil do Facebook para o Gerenciador ter o que listar."
          acao={{ texto: "Ir para Integrações › Anúncios", href: "/dashboard/integracoes/anuncios" }}
        />
      );
    }
    const s = SUBSTANTIVO[nivel];
    const todas: { name: string; status: string }[] =
      nivel === "adsets" ? (raw?.adSets ?? []) : nivel === "ads" ? (raw?.ads ?? []) : (raw?.campaigns ?? []);
    const escondidas = todas.filter((r) => estaArquivado(r.status) && passaBusca(r.name)).length;

    if (escondidas > 0 && v.adsStatus !== "arquivado") {
      return (
        <EmptyState
          titulo={`Nenhum${s.um.endsWith("a") ? "a" : ""} ${s.um} ativ${s.um.endsWith("a") ? "a" : "o"} neste período`}
          causa={`${plural(escondidas, `${s.um} arquivad${s.um.endsWith("a") ? "a" : "o"}`, `${s.varios} arquivad${s.um.endsWith("a") ? "a" : "o"}s`)} não ${escondidas === 1 ? "aparece" : "aparecem"} com este filtro — no Facebook, "excluir" apenas arquiva.`}
          acao={{ texto: "Ver arquivadas", aoClicar: () => trocandoFiltro(v.setAdsStatus)("arquivado") }}
        />
      );
    }
    if (busca) {
      return (
        <EmptyState
          titulo={`Nada com esse nome`}
          causa={`Nenhum${s.um.endsWith("a") ? "a" : ""} ${s.um} do período casa com "${v.adsSearch.trim()}".`}
          acao={{ texto: "Limpar a busca", aoClicar: () => trocandoFiltro(v.onAdsSearch)({ target: { value: "" } } as React.ChangeEvent<HTMLInputElement>) }}
        />
      );
    }
    if (objetivo !== "todos") {
      return (
        <EmptyState
          titulo="Nenhuma campanha com este objetivo"
          causa={`O período não tem campanha de ${rotuloDoObjetivo(objetivo)}.`}
          acao={{ texto: "Ver todos os objetivos", aoClicar: () => trocandoFiltro(setObjetivo)("todos") }}
        />
      );
    }
    return (
      <EmptyState
        titulo={`Nenhum${s.um.endsWith("a") ? "a" : ""} ${s.um} neste período`}
        causa="Troque o intervalo de datas ou a conta de anúncio."
      />
    );
  })();

  /** Os objetivos que EXISTEM na conta — lista escrita à mão ofereceria filtro que não filtra nada. */
  const objetivosDisponiveis = React.useMemo(() => {
    const vistos = new Set<string>();
    for (const c of raw?.campaigns ?? []) if (c.objective) vistos.add(c.objective);
    return [...vistos].sort();
  }, [raw]);

  const filtrosVisiveis = useRegistrarFaixaDeFiltros();
  const carregando = v.adsLoading;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)", minWidth: 0 }}>
      {/* ── Filtros ──────────────────────────────────────────────────────────
          A faixa é REGISTRADA no shell, e é esse registro que faz o botão
          `Filtros` aparecer no header. As duas pontas do mesmo contrato. */}
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
              periodo={v.adsPeriod}
              from={v.adsFrom}
              to={v.adsTo}
              timezone={v.timezone}
              onChange={v.setAdsPeriod}
            />
            <SelectLegado
              label="Conta de anúncio"
              value={v.adsAccount}
              onChange={v.setAdsAccount}
              minWidth={180}
              options={[
                { value: "todas", label: "Todas as contas" },
                ...v.adsAccountOptions.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {v.syncLabel && !carregando && (
              <span className="text-caption text-text-muted" style={{ whiteSpace: "nowrap" }}>
                {v.syncLabel}
              </span>
            )}
            <Button
              variante="secundario"
              onClick={v.refreshAds}
              carregando={carregando}
              iconeInicio={<Icone nome="atualizar" tamanho={14} />}
              title="Recarrega os dados do Gerenciador"
            >
              {carregando ? "Atualizando…" : "Atualizar"}
            </Button>
          </div>
        </div>
      )}

      {/* ── 5 KPIs + rosca de status ─────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gap: "var(--tk-gap-grid)",
          gridTemplateColumns: "minmax(0, 3fr) minmax(280px, 1fr)",
          alignItems: "stretch",
        }}
        className="tk-ger-topo"
      >
        <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
          {kpis.map((k) => (
            <div key={k.chave} className="tk-medida" style={{ minWidth: 0, display: "flex" }}>
              <BlocoMetrica dados={k} carregando={carregando} />
            </div>
          ))}
        </div>

        <div className="tk-medida" style={{ minWidth: 0, display: "flex" }}>
          <Card titulo="Status das campanhas" preencher distribuir escala style={{ flex: 1 }}>
            {fatias.length === 0 ? (
              <EmptyState titulo="Nenhuma campanha" causa="Sem campanha no filtro atual." compacto />
            ) : (
              <>
                <DonutChart
                  fatias={fatias}
                  totalLabel={String(paraRosca.length)}
                  formatar={(n) => `${n}`}
                />
                {/* Ver o ⚠️ de `nuncaSincronizadas`: contagem separada, porque
                    ela não parte a rosca — ela atravessa as fatias. */}
                {nuncaSincronizadas > 0 && (
                  <p className="text-caption text-text-muted" style={{ margin: "10px 0 0", lineHeight: 1.5 }}>
                    {plural(nuncaSincronizadas, "campanha nunca sincronizou", "campanhas nunca sincronizaram")} —
                    os números da Meta não existem para {nuncaSincronizadas === 1 ? "ela" : "elas"}.
                  </p>
                )}
              </>
            )}
          </Card>
        </div>
      </div>

      {/* ── A tabela e o Insights ────────────────────────────────────────── */}
      <div className="tk-ger-corpo" style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 300px)", alignItems: "start" }}>
        <Card semPadding>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "var(--tk-pad-card)" }}>
            {/* Abas de status + ações da seção */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <Abas
                  abas={ABAS_STATUS.map((a) => ({ id: a.id, rotulo: a.rotulo }))}
                  ativa={v.adsStatus as (typeof ABAS_STATUS)[number]["id"]}
                  aoTrocar={trocandoFiltro((id: string) => v.setAdsStatus(id))}
                  rotuloAcessivel="Filtrar por status"
                />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Button variante="secundario" onClick={exportar} iconeInicio={<Icone nome="relatorio" tamanho={14} />}>
                  Exportar
                </Button>
                {/* Criar campanha é ação do nível CAMPANHA — a rota cria só a
                    campanha, sem conjunto e sem anúncio, e pausada. */}
                <Button variante="primario" onClick={v.openNewCampaign} iconeInicio={<Icone nome="novo" tamanho={14} />}>
                  Nova campanha
                </Button>
              </div>
            </div>

            {/* Busca + agrupamento + objetivo + colunas */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ width: 240 }}>
                <Input
                  value={v.adsSearch}
                  onChange={trocandoFiltro(v.onAdsSearch)}
                  placeholder={`Buscar ${SUBSTANTIVO[nivel].um}…`}
                  aria-label={`Buscar ${SUBSTANTIVO[nivel].um}`}
                  iconeInicio={<Icone nome="bussola" tamanho={15} />}
                />
              </div>
              <div style={{ width: 190 }}>
                {/* 🔧 O `Agrupar por` da imagem 4 é o SELETOR DE NÍVEL aqui. O
                    `03` proíbe navegar a hierarquia por troca de aba — a
                    hierarquia é a expansão inline —, mas listar um nível direto
                    continua sendo necessário: "me mostre todos os anúncios da
                    conta por gasto" não se responde abrindo campanha a campanha. */}
                <Select
                  rotulo="Agrupar por"
                  opcoes={[
                    { valor: "campaigns", rotulo: "Campanha" },
                    { valor: "adsets", rotulo: "Conjunto" },
                    { valor: "ads", rotulo: "Anúncio" },
                    { valor: "accounts", rotulo: "Conta" },
                  ]}
                  valor={nivel}
                  aoEscolher={trocandoFiltro((n: string) => v.setAdsSub(n as NivelTabela))}
                />
              </div>
              {objetivosDisponiveis.length > 1 && (
                <div style={{ width: 180 }}>
                  <Select
                    rotulo="Objetivo"
                    opcoes={[
                      { valor: "todos", rotulo: "Todos os objetivos" },
                      ...objetivosDisponiveis.map((o) => ({ valor: o, rotulo: rotuloDoObjetivo(o) })),
                    ]}
                    valor={objetivo}
                    aoEscolher={trocandoFiltro(setObjetivo)}
                  />
                </div>
              )}
              <div style={{ width: 200, marginLeft: "auto" }}>
                <Select
                  rotulo="Colunas"
                  opcoes={CONJUNTOS_DE_COLUNAS.map((c) => ({ valor: c.id, rotulo: c.rotulo, apoio: c.pergunta }))}
                  valor={conjunto}
                  aoEscolher={(id) => trocarConjunto(id as ConjuntoDeColunas)}
                />
              </div>
            </div>

            {/* ⛔ A BARRA DE SELEÇÃO NÃO MORA AQUI — ver o bloco flutuante
                depois da tabela, e o comentário lá diz por quê. */}
            {/* Sem seleção, o resultado da última ação continua visível — é onde
                mora o nome do que falhou. */}
            {resultado && selecionadasAqui.size === 0 && (
              <p className="text-caption text-text-secondary" style={{ margin: 0 }}>{resultado}</p>
            )}
          </div>

          {/* ── A tabela, com a barra de seleção FLUTUANDO por cima ──────────
              🐛 A barra ficava no fluxo, acima da tabela. Ao aparecer com a
              primeira marcação ela empurrava tudo abaixo dela **36px** — uma
              altura de linha exata. Quem marcava a linha 1 e mirava o checkbox
              da linha 2 acertava a linha 1 de novo, porque a tabela tinha
              descido no intervalo entre o olho e o clique. Medido na tela em
              08/08/2026; nenhuma ferramenta desta base pergunta se algo se
              moveu.

              ⛔ RESERVAR A ALTURA seria o outro conserto, e é pior aqui: a
              barra existe em ~1% das visitas (é o motivo de ela não ser fixa,
              ver o cabeçalho de `BarraSelecao`), então o vão vazio seria o
              estado normal da tela — o mesmo defeito do controle inerte, agora
              gasto em espaço.

              A camada é `absolute` sobre a região da tabela e não recebe
              ponteiro; só a barra dentro dela recebe. E a barra é `sticky`
              para continuar alcançável numa tabela longa: sem isso, marcar uma
              linha no topo de 50 deixaria as ações fora da tela. */}
          <div style={{ position: "relative" }}>
            <TabelaAds
            linhas={daPagina}
            colunas={colunas}
            selecionadas={selecionadasAqui}
            aoSelecionar={alternarSelecao}
            aoSelecionarTodas={alternarTodas}
            aoAlternarStatus={(id) => {
              /* 🐛 Os dois ramos são ações DIFERENTES, e é por isso que não dá
                 para unificar: nas outras abas o toggle pausa/ativa NO FACEBOOK;
                 em Contas ele liga/desliga o RASTREAMENTO na Trackhub. Um
                 `if (nivel)` sozinho já fez o toggle de Contas ser um no-op
                 silencioso nesta base. */
              if (nivelDeAcao) v.toggleAdsEntity(nivelDeAcao, id);
              else void v.toggleAdsAccountTracking(id);
            }}
            aoSalvarOrcamento={salvarOrcamento}
            ordem={ordem}
            aoOrdenar={(chave) =>
              setOrdem((o) =>
                o?.chave === chave ? { chave, dir: o.dir === "desc" ? "asc" : "desc" } : { chave, dir: "desc" },
              )
            }
            fixadas={fixadas}
            carregando={carregando}
            vazio={vazio}
          />

          {ordenadas.length > 0 && (
            <div style={{ padding: "12px var(--tk-pad-card) var(--tk-pad-card)" }}>
              <Paginacao
                total={ordenadas.length}
                pagina={paginaValida}
                porPagina={porPagina}
                aoTrocarPagina={setPagina}
                aoTrocarPorPagina={trocandoFiltro(setPorPagina)}
                substantivo={SUBSTANTIVO[nivel].varios}
              />
            </div>
          )}

            {/* A barra só existe com seleção — ver o cabeçalho dela. */}
            {nivelDeAcao && selecionadasAqui.size > 0 && (
              <div
                data-camada-selecao
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "flex-end",
                  /* Sem isto a camada engoliria o clique da tabela inteira —
                     inclusive o dos checkboxes que a alimentam. */
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    position: "sticky",
                    bottom: 12,
                    width: "100%",
                    padding: "0 var(--tk-pad-card) 12px",
                    pointerEvents: "auto",
                  }}
                >
                  <BarraSelecao
                    flutuante
                    nivel={nivelDeAcao}
                    selecionados={alvos}
                    ocupado={ocupado}
                    resultado={resultado}
                    aoExecutar={executar}
                    aoLimpar={() => setSelecao((s) => ({ ...s, ids: new Set() }))}
                    aoFixar={fixar}
                    aoCopiarId={copiarId}
                    aoAbrirNoFacebook={abrirNoFacebook}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card titulo="Insights" descricao="Só campanhas que estão entregando">
          <PainelInsights insights={calcularInsights(insights)} />
        </Card>
      </div>

      {v.newCampaignOpen && (
        <ModalNovaCampanha
          contas={(raw?.accounts ?? []).map((a) => ({ id: a.id, name: a.name }))}
          conta={v.newCampaignAccount}
          aoTrocarConta={v.setNewCampaignAccount}
          nome={v.newCampaignName}
          aoTrocarNome={v.setNewCampaignName}
          objetivo={v.newCampaignObjective}
          aoTrocarObjetivo={v.setNewCampaignObjective}
          orcamento={v.newCampaignBudget}
          aoTrocarOrcamento={v.setNewCampaignBudget}
          ocupado={v.newCampaignBusy}
          aoCriar={v.createCampaign}
          aoFechar={v.closeNewCampaign}
        />
      )}
    </div>
  );
}
