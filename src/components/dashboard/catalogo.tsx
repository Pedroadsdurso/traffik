"use client";

import * as React from "react";

import { Aprovacao } from "@/components/tk/Aprovacao";
import { BreakdownPanel } from "@/components/tk/BreakdownPanel";
import { FeedVendas } from "@/components/tk/FeedVendas";
import { Funil } from "@/components/tk/Funil";
import { SerieTemporal } from "@/components/tk/SerieTemporal";
import type { TraffikView } from "./useTraffikState";

/**
 * O CATÁLOGO — a lista única do que o Dashboard sabe desenhar.
 *
 * 🔴 REGRA DE ENTRADA, E ELA NÃO TEM EXCEÇÃO: **nada entra aqui sem renderizar
 * de verdade.** Um catálogo que oferece bloco vazio é o pior controle inerte da
 * base — pior que botão que não faz nada, porque o usuário ESCOLHE o bloco,
 * espera, e é ele quem descobre que não existe. O botão inerte frustra; o
 * catálogo inerte faz o usuário duvidar do próprio entendimento.
 *
 * Por isso `/dashboard/blocos` existe: ela desenha o catálogo INTEIRO com dado
 * real, e é a prova de que a regra está sendo cumprida. Ela some quando o modo
 * de edição chegar.
 *
 * ### As LARGURAS nascem aqui, e é de propósito
 *
 * Cada painel declara as larguras que ele aceita. **O modo de edição oferece as
 * DELE, não um valor qualquer** — é isso que separa "escolher entre opções" de
 * "redimensionamento livre", e é o que impede o Dashboard de voltar a ser uma
 * grade de doze caixas iguais.
 *
 * ⛔ Um catálogo sem essa informação obrigaria o modo de edição a voltar aqui
 * para acrescentá-la. Ela nasce junto.
 */

/** Onde o bloco pode viver. **Não há arrasto entre zonas** — ver o modo de edição. */
export type Zona = "hero" | "faixa" | "paineis";

/**
 * As frações de linha que um painel aceita.
 *
 * ⚠️ Um painel pode aceitar mais de uma; o usuário escolhe **entre as dele**.
 * Um globo não cabe em 1/3, uma lista de 5 linhas não precisa de linha cheia.
 */
export type Largura = "um-terco" | "metade" | "cheia";

export interface BlocoCatalogo {
  id: string;
  titulo: string;
  /** Uma linha dizendo o que o bloco responde. Vai para o painel de escolha. */
  descricao: string;
  zona: Zona;
  /** Só para `zona: "paineis"`. Hero e faixa têm largura fixa por definição. */
  larguras?: Largura[];
  /** A largura inicial quando o bloco entra. Tem de estar em `larguras`. */
  larguraPadrao?: Largura;
  /**
   * `false` quando o dado não existe NESTE período — o bloco some do Dashboard
   * em vez de desenhar uma caixa vazia. No catálogo ele continua listado, com
   * o aviso, senão o usuário procura um bloco que sumiu.
   */
  temDado: (v: TraffikView) => boolean;
  render: (v: TraffikView) => React.ReactNode;
}

/* ── Os painéis ────────────────────────────────────────────────────────────
   ⚠️ Hero e faixa NÃO estão aqui: eles são listas de MÉTRICA, não de bloco, e
   o catálogo delas é o `metricCards` do hook. Misturar os dois faria o painel
   de escolha oferecer "Faturamento" e "Vendas por país" na mesma lista, que são
   coisas de naturezas diferentes. */
export const CATALOGO: BlocoCatalogo[] = [
  {
    id: "funil",
    titulo: "Funil",
    descricao: "Cliques → checkouts → vendas, com a taxa de cada passo",
    zona: "paineis",
    larguras: ["um-terco", "metade"],
    larguraPadrao: "um-terco",
    temDado: (v) => v.funnel.some((e) => e.count !== "0"),
    render: (v) => <Funil etapas={v.funnel} />,
  },
  {
    id: "fontes",
    titulo: "Fontes de tráfego",
    descricao: "De qual canal veio o faturamento",
    zona: "paineis",
    larguras: ["um-terco", "metade"],
    larguraPadrao: "um-terco",
    temDado: (v) => v.sources.length > 0,
    render: (v) => <BreakdownPanel linhas={v.sources} rotuloDimensao="Fonte" />,
  },
  {
    id: "produtos",
    titulo: "Produtos",
    descricao: "Quais produtos faturaram mais",
    zona: "paineis",
    larguras: ["um-terco", "metade"],
    larguraPadrao: "um-terco",
    temDado: (v) => v.products.length > 0,
    /* ⚠️ Produtos é o único dos três com CONTAGEM de vendas — por isso a
       coluna extra é opcional no `BreakdownPanel` em vez de haver um
       componente próprio. Um terceiro componente por uma coluna seria o
       começo dos três-quase-iguais que a consolidação desfez. */
    render: (v) => <BreakdownPanel linhas={v.products} rotuloDimensao="Produto" mostrarVendas />,
  },
  {
    id: "pagamentos",
    titulo: "Formas de pagamento",
    descricao: "Como os compradores pagaram",
    zona: "paineis",
    larguras: ["um-terco", "metade"],
    larguraPadrao: "um-terco",
    temDado: (v) => v.payments.length > 0,
    render: (v) => <BreakdownPanel linhas={v.payments} rotuloDimensao="Forma" mostrarVendas />,
  },
  {
    id: "vendas-por-dia",
    titulo: "Vendas por dia",
    descricao: "Quantas vendas e quanto faturou em cada dia",
    zona: "paineis",
    larguras: ["metade", "cheia"],
    larguraPadrao: "metade",
    temDado: (v) => v.byDay.length > 0,
    render: (v) => (
      <SerieTemporal
        pontos={v.byDay.map((d) => ({ rotulo: d.date.slice(5), valor: d.revenue, apoio: d.sales }))}
        rotuloValor="Receita"
        rotuloApoio="vendas"
      />
    ),
  },
  {
    id: "vendas-por-hora",
    titulo: "Vendas por horário",
    descricao: "As 24 horas do período filtrado",
    zona: "paineis",
    larguras: ["metade", "cheia"],
    larguraPadrao: "metade",
    temDado: (v) => v.byHour.some((h) => h.sales > 0 || h.revenue > 0),
    render: (v) => (
      <SerieTemporal
        pontos={v.byHour.map((h) => ({ rotulo: `${h.hour}h`, valor: h.revenue, apoio: h.sales }))}
        rotuloValor="Receita"
        rotuloApoio="vendas"
      />
    ),
  },
  {
    id: "lucro-por-hora",
    titulo: "Lucro por horário",
    descricao: "Receita menos a fatia de custo daquela hora",
    zona: "paineis",
    larguras: ["metade", "cheia"],
    larguraPadrao: "metade",
    temDado: (v) => v.byHour.some((h) => h.profit !== 0),
    /* ⚠️ O `profit` do `byHour` distribui o custo em proporção à receita da
       hora — não há informação de hora numa despesa. Está dito no rótulo. */
    render: (v) => (
      <SerieTemporal
        pontos={v.byHour.map((h) => ({ rotulo: `${h.hour}h`, valor: h.profit }))}
        rotuloValor="Lucro (custo rateado pela receita da hora)"
        permitirNegativo
      />
    ),
  },
  {
    id: "aprovacao",
    titulo: "Taxa de aprovação",
    descricao: "Quanto de cada forma de pagamento é aprovado",
    zona: "paineis",
    larguras: ["um-terco", "metade"],
    larguraPadrao: "um-terco",
    temDado: (v) => v.approval.length > 0,
    render: (v) => <Aprovacao linhas={v.approval} />,
  },
  {
    id: "atividade",
    titulo: "Atividade recente",
    descricao: "Os últimos eventos de venda e rastreamento",
    zona: "paineis",
    larguras: ["um-terco", "metade"],
    larguraPadrao: "um-terco",
    temDado: (v) => v.feed.length > 0,
    render: (v) => <FeedVendas itens={v.feed} />,
  },
];

/**
 * ⛔ "ALERTAS" NÃO ESTÁ NO CATÁLOGO, e a ausência é decisão: os alertas são
 * DERIVADOS na tela (`DashboardScreen`), cruzando token, erro de conta e ROI —
 * não são um campo do hook. Colocá-lo aqui exigiria mover a derivação para o
 * hook, que é outro trabalho.
 *
 * Ele continua fixo no Dashboard. Quando o modo de edição chegar, ou a
 * derivação sobe para o hook e ele entra, ou ele fica como bloco não removível
 * — e a segunda é defensável: alerta que o usuário pode esconder é alerta que
 * ninguém vê.
 */
export function blocoPorId(id: string): BlocoCatalogo | undefined {
  return CATALOGO.find((b) => b.id === id);
}
