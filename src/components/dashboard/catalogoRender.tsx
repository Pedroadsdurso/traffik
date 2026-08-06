"use client";

import * as React from "react";

import { Aprovacao } from "@/components/tk/Aprovacao";
import { BreakdownPanel } from "@/components/tk/BreakdownPanel";
import { FeedVendas } from "@/components/tk/FeedVendas";
import { Funil } from "@/components/tk/Funil";
import { SerieTemporal } from "@/components/tk/SerieTemporal";
import type { IdBloco } from "./catalogo";
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

export interface RenderBloco {
  /**
   * `false` quando o dado não existe NESTE período — o bloco some do Dashboard
   * em vez de desenhar caixa vazia. No catálogo ele continua listado, com o
   * aviso, senão o usuário procura um bloco que sumiu.
   */
  temDado: (v: TraffikView) => boolean;
  render: (v: TraffikView) => React.ReactNode;
}

export const RENDERS: Record<IdBloco, RenderBloco> = {
  funil: {
    temDado: (v) => v.funnel.some((e) => e.count !== "0"),
    render: (v) => <Funil etapas={v.funnel} />,
  },
  fontes: {
    temDado: (v) => v.sources.length > 0,
    render: (v) => <BreakdownPanel linhas={v.sources} rotuloDimensao="Fonte" />,
  },
  produtos: {
    temDado: (v) => v.products.length > 0,
    /* ⚠️ Produtos e Pagamentos têm CONTAGEM; Fontes não. Por isso `mostrarVendas`
       é prop e não há um terceiro componente — uma booleana por uma coluna é
       mais barato que o começo dos três-quase-iguais que a consolidação desfez. */
    render: (v) => <BreakdownPanel linhas={v.products} rotuloDimensao="Produto" mostrarVendas />,
  },
  pagamentos: {
    temDado: (v) => v.payments.length > 0,
    render: (v) => <BreakdownPanel linhas={v.payments} rotuloDimensao="Forma" mostrarVendas />,
  },
  "vendas-por-dia": {
    temDado: (v) => v.byDay.length > 0,
    render: (v) => (
      <SerieTemporal
        pontos={v.byDay.map((d) => ({ rotulo: d.date.slice(5), valor: d.revenue, apoio: d.sales }))}
        rotuloValor="Receita"
        rotuloApoio="vendas"
      />
    ),
  },
  "vendas-por-hora": {
    temDado: (v) => v.byHour.some((h) => h.sales > 0 || h.revenue > 0),
    render: (v) => (
      <SerieTemporal
        pontos={v.byHour.map((h) => ({ rotulo: `${h.hour}h`, valor: h.revenue, apoio: h.sales }))}
        rotuloValor="Receita"
        rotuloApoio="vendas"
      />
    ),
  },
  "lucro-por-hora": {
    temDado: (v) => v.byHour.some((h) => h.profit !== 0),
    /* ⚠️ O `profit` do `byHour` distribui o custo em proporção à receita da hora
       — não há informação de hora numa despesa. Está dito no rótulo, porque um
       lucro por hora sem essa ressalva se lê como medição direta. */
    render: (v) => (
      <SerieTemporal
        pontos={v.byHour.map((h) => ({ rotulo: `${h.hour}h`, valor: h.profit }))}
        rotuloValor="Lucro (custo rateado pela receita da hora)"
        permitirNegativo
      />
    ),
  },
  aprovacao: {
    temDado: (v) => v.approval.length > 0,
    render: (v) => <Aprovacao linhas={v.approval} />,
  },
  atividade: {
    temDado: (v) => v.feed.length > 0,
    render: (v) => <FeedVendas itens={v.feed} />,
  },
};

/* ⛔ O `CATALOGO` (metadado + render juntos) foi DELETADO com a rota
   `/dashboard/blocos`, que era o único consumidor. Quem precisa dos dois hoje é
   o modo de edição, e ele já tem os dois separados: `CATALOGO_META` para a lista
   de escolha e `RENDERS` para desenhar. Um terceiro objeto que junta os dois
   seria uma cópia que envelhece sozinha. */
