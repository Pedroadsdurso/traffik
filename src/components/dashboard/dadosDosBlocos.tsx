"use client";

import * as React from "react";

import { bandeiraDe, centroide, nomePais } from "@/lib/countries";
import { nomeDaFonte } from "@/lib/fontes";
import { brl } from "@/lib/format";
import { montarAlertas } from "@/lib/dashboard/alertas";
import { useTheme } from "@/components/theme/ThemeProvider";

import type { Alerta } from "@/components/tk/AlertList";
import type { LinhaPais } from "@/components/tk/CountryPanel";
import { useVisaoPais, type VisaoPais } from "@/components/tk/CountryPanel";
import type { FatiaDonut } from "@/components/tk/DonutChart";
import type { PontoSerie } from "@/components/tk/LineChart";
import type { BlocoEstado } from "@/components/tk/StatusFooter";

import { Icone } from "./ui/Icone";
import type { TraffikView } from "./useTraffikState";

/**
 * O CONTEXTO DOS BLOCOS — tudo que um render precisa além do `TraffikView`.
 *
 * 🔴 POR QUE ESTA CAMADA EXISTE, E POR QUE ELA NÃO É "UM HOOK A MAIS"
 *
 * Quando os quatro estruturais entraram na zona Painéis (07/08/2026), o JSX
 * fixo do `DashboardScreen` teve de virar entrada de catálogo — e aí apareceu o
 * problema: **os blocos com estado não cabem numa função `(v) => ReactNode`.**
 *
 * Três deles têm um controle no cabeçalho do card (§14.1) que pilota o corpo:
 * `Diário|Semanal`, `Receita|Vendas|Lucro`, `Ranking|Globo`, `Rosca|Lista`. O
 * controle mora no slot `acao` do `Card`, o corpo mora dentro dele, e os dois
 * leem o mesmo estado. Um `useState` dentro do render seria um hook chamado
 * dentro de um `Record` — condicional, na ordem em que a grade desenhar.
 *
 * ⛔ E não é para cada bloco virar um componente com estado próprio: o `acao` e
 * o corpo são renderizados em pontos DIFERENTES da árvore (o cabeçalho e o
 * corpo do card), então não há um componente que contenha os dois sem duplicar
 * o `Card`.
 *
 * A saída é a que o `useVisaoPais` já usava antes de tudo isto: **o estado é do
 * chamador, o controle é um componente exportado à parte.** Aqui esse padrão
 * virou um objeto só, para não crescerem oito `useState` soltos na tela.
 *
 * ⚠️ As DERIVAÇÕES caras (alertas, série aparada, países, rodapé) vêm junto pelo
 * mesmo motivo prático: elas são `useMemo`, e `useMemo` também não roda dentro
 * de um `Record`.
 */

export type MetricaHeat = "revenue" | "sales" | "profit";
export const ROTULO_HEAT: Record<MetricaHeat, string> = {
  revenue: "Receita",
  sales: "Vendas",
  profit: "Lucro",
};

export type VisaoFontes = "rosca" | "lista";

/** Cor de canal — permitida DENTRO da plotagem e da legenda dela, nunca em selo. */
export function corDoCanal(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes("meta") || n.includes("face") || n.includes("insta")) return "var(--tk-channel-meta)";
  if (n.includes("google") || n.includes("youtube")) return "var(--tk-channel-google)";
  if (n.includes("tiktok")) return "var(--tk-channel-tiktok)";
  return "var(--tk-channel-outros)";
}

export type CtxBlocos = ReturnType<typeof useDadosDosBlocos>;

export function useDadosDosBlocos(v: TraffikView) {
  const { theme } = useTheme();

  /* ── Estado de LENTE dos cabeçalhos ─────────────────────────────────────── */
  const [granularidade, setGranularidade] = React.useState<"diario" | "semanal">("diario");
  const [metricaHeat, setMetricaHeat] = React.useState<MetricaHeat>("revenue");
  const [visaoFontes, setVisaoFontes] = React.useState<VisaoFontes>("rosca");

  /* `Date.now()` no corpo do componente é impuro: o lint recusa, e com razão — o
     número mudaria entre dois renders sem o estado ter mudado. Fica num
     inicializador PREGUIÇOSO, que roda uma vez só. Consequência aceita: o "em
     execução" e o "expira em N dias" são do momento em que a tela montou. */
  const [agora] = React.useState(() => Date.now());

  /* ── O APARO É UM SÓ, E OS DOIS DESENHOS OBEDECEM A ELE ───────────────────
     🔴 Estavam divergindo na tela: o gráfico grande mostrava 04/08–06/08 e
     avisava "27 dias sem movimento omitidos", enquanto os sparklines dos heros
     mostravam os 30 dias inteiros. Dois componentes lado a lado exibindo
     PERÍODOS diferentes, sem nada avisando.

     O índice é calculado UMA vez e vale para os dois. */
  const inicioAparado = React.useMemo(() => {
    const { revenue, spend } = v.chartSerie;
    const i = v.chartSerie.labels.findIndex((_, n) => (revenue[n] ?? 0) > 0 || (spend[n] ?? 0) > 0);
    return i > 0 ? i : 0;
  }, [v.chartSerie]);

  /* ── Receita × gasto ─────────────────────────────────────────────────────── */
  const pontos: PontoSerie[] = React.useMemo(() => {
    const { labels, revenue, spend } = v.chartSerie;
    const base = labels.map((rotulo, i) => ({ rotulo, a: revenue[i] ?? 0, b: spend[i] ?? 0 }));
    /* 🔴 26 dias de linha zerada desperdiçavam 85% da largura. O eixo começa no
       PRIMEIRO dia com movimento — e quantos dias ficaram de fora é dito abaixo
       do gráfico, porque cortar em silêncio faria a janela parecer menor do que
       o filtro diz. Só apara o começo: buraco no MEIO da série é informação. */
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

  /* ── Origem do faturamento (rosca e lista leem o MESMO `v.sources`) ──────── */
  const fatias: FatiaDonut[] = React.useMemo(
    () => v.sources.map((s) => ({ nome: nomeDaFonte(s.name), valor: s.total, cor: corDoCanal(s.name) })),
    [v.sources],
  );
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
  // `semPais` é o faturamento cuja venda não trouxe país — aparece explicitamente.
  const semPais = v.byCountry.reduce((s, c) => s + (c.code ? 0 : c.sales), 0);
  const { visao: visaoPais, setVisao: setVisaoPais } = useVisaoPais(paises.length);

  /* ── Alertas — DERIVADOS do que já existe, sem dado novo ─────────────────── */
  const alertas: Alerta[] = React.useMemo(
    /* ⛔ O CORPO SAIU DAQUI EM 14/08/2026 — `lib/dashboard/alertas.ts`.
       Enquanto ele morava neste `useMemo`, NENHUM dos cinco alertas tinha
       asserção: um construtor dentro de componente é inalcançável por teste.
       O move foi verbatim, e `test:alertas` exercita os cinco ids originais. */
    () =>
      montarAlertas({
        fbConnected: v.fbConnected,
        perfisCrus: v.perfisCrus,
        adProfiles: v.adProfiles,
        roi: v.metricCards.roi,
        chartSerie: v.chartSerie,
        agora,
        brl,
        /* 🔴 LIGADO EM 14/08/2026 — o campo existia no DTO e ninguém o lia, que
           é a definição de dado morto. `donosCorrompidos` enumera os
           `eventOwners` ilegíveis, e sem este alerta a escolha do usuário sobre
           QUEM envia o evento à Meta se perdia em silêncio: a corrupção cai no
           padrão, o envio é RELIGADO, e a Meta volta a contar em dobro. */
        pixels: v.pixels,
      }),
    [v.fbConnected, v.adProfiles, v.perfisCrus, v.metricCards.roi, v.chartSerie, v.pixels, agora],
  );

  /* ── Rodapé de estado ────────────────────────────────────────────────────── */
  const rodape: BlocoEstado[] = React.useMemo(() => {
    const contasComErro = (v.adProfiles ?? []).flatMap((p) => p.accounts ?? []).filter((c) => c.erroSync).length;
    const regras = v.rules ?? [];
    const regrasAtivas = regras.filter((r) => r.active).length;
    const regrasRodando = regras.filter(
      (r) => r.active && r.lastRunAt && agora - new Date(r.lastRunAt).getTime() < 15 * 60 * 1000,
    ).length;

    /* Despesas RECORRENTES do mês. Taxa percentual (gateway, imposto,
       coprodução) não entra: ela não tem valor em reais fora de uma venda, e
       somá-la produziria um número que não existe. Elas aparecem como contagem
       na segunda linha. */
    const despesaMensal = (v.despesaRows ?? []).reduce((soma, d) => soma + d.value, 0);
    const taxasPercentuais = (v.taxExpenses?.length ?? 0) + (v.gatewayExpenses?.length ?? 0);

    return [
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
        valor: brl(despesaMensal),
        alerta:
          taxasPercentuais > 0
            ? {
                texto: `+ ${taxasPercentuais} ${taxasPercentuais === 1 ? "taxa percentual" : "taxas percentuais"}`,
                tom: "success",
              }
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
  }, [v.adProfiles, v.rules, v.despesaRows, v.taxExpenses, v.gatewayExpenses, v.activeAccountCount, v.syncLabel, v.syncManualBusy, v.dashLoading, agora]);

  return {
    tema: (theme === "light" ? "light" : "dark") as "light" | "dark",
    carregando: v.dashLoading,
    agora,
    granularidade,
    setGranularidade,
    metricaHeat,
    setMetricaHeat,
    visaoFontes,
    setVisaoFontes,
    visaoPais,
    setVisaoPais: setVisaoPais as (v: VisaoPais) => void,
    inicioAparado,
    pontos,
    temSerie,
    diasAparados,
    fatias,
    totalCanais,
    paises,
    semPais,
    alertas,
    rodape,
  };
}
