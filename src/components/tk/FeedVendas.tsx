"use client";

import * as React from "react";

/**
 * Atividade recente — os últimos eventos de venda e rastreamento.
 *
 * ⚠️ **NÃO CONFUNDIR com o "Atividade recente" de Integrações.** Aquele é a
 * união de `WebhookLog` + notificação + falha de sincronização, e responde "o
 * que aconteceu com as minhas conexões". Este é o feed de EVENTOS DE NEGÓCIO —
 * clique, checkout, venda, reembolso. Mesmo título, telas diferentes, dados
 * diferentes; por isso são dois componentes e não um com prop de fonte.
 *
 * ⚠️ `timeLabel` vem PRONTO do hook e é seguro **por timing**, não por
 * estrutura: `dashData` nasce `null` e a lista está vazia na passagem do
 * servidor. Se um dia o Dashboard receber `initialDashData`, este componente
 * passa a precisar de `<Desde>` — está anotado no hook, no ponto que quebraria.
 */

export interface ItemFeed {
  id: string;
  typeLabel: string;
  cor: string;
  valueLabel: string;
  timeLabel: string;
  source?: string | null;
  campaign?: string | null;
}

export function FeedVendas({ itens, limite = 12 }: { itens: ItemFeed[]; limite?: number }) {
  if (itens.length === 0) {
    return (
      <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.45 }}>
        Nenhum evento no período. Cliques e vendas aparecem aqui assim que chegarem.
      </p>
    );
  }

  return (
    <div className="tk-feed" style={{ display: "flex", flexDirection: "column" }}>
      {itens.slice(0, limite).map((f, i) => (
        <div
          key={f.id}
          className="tk-linha"
          style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "7px 8px", borderRadius: 8 }}
        >
          {/* 🔴 A cor do evento vem com PONTO, e o tipo vem por EXTENSO ao lado.
              Nove tipos distinguidos só por cor seriam nove cores que ninguém
              memoriza — e para quem não distingue cores, nenhuma informação.
              A cor acelera; o texto é quem informa. */}
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, background: f.cor, flex: "none" }} />
          <span className="text-caption text-text" style={{ flex: "none" }}>{f.typeLabel}</span>
          <span
            className="text-caption text-text-muted tk-feed-origem"
            style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {f.campaign || f.source || ""}
          </span>
          <span className="text-caption text-text" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {f.valueLabel}
          </span>
          <span className="text-caption text-text-muted" style={{ whiteSpace: "nowrap" }}>{f.timeLabel}</span>
        </div>
      ))}
      {itens.length > limite && (
        <p className="text-caption text-text-muted" style={{ margin: "8px 0 0" }}>
          Mostrando {limite} de {itens.length} eventos.
        </p>
      )}
    </div>
  );
}
