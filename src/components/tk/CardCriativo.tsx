"use client";

/**
 * O card da grade/carrossel de Criativos: pré-visualização, nome, campanha e as
 * três métricas do rodapé (`ROAS · CTR · CPA`), como a imagem 9 pede.
 *
 * ⚠️ **CPA, e não CPC.** A referência escreve `CPA` no rodapé do card, e é a
 * pergunta certa: quanto custou cada VENDA. `CPC` fica nos KPIs de topo, onde
 * mede eficiência de mídia. São perguntas diferentes e as duas cabem — o que
 * não cabe é trocar uma pela outra e manter o rótulo.
 */
import * as React from "react";

import { Badge } from "@/components/tk/Badge";
import { PreviaCriativo } from "@/components/tk/PreviaCriativo";
import { Tooltip } from "@/components/tk/Tooltip";
import { veiculando, tendenciaDoCriativo } from "@/lib/ads/criativos";
import type { CreativeRow } from "@/lib/ads/creatives";

/** `null` vira `—`. ⛔ Nunca `0` — ver a distinção central no `CLAUDE.md`. */
export const TRACO = "—";

export function rotuloRoas(v: number | null): string {
  return v === null ? TRACO : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "x";
}
export function rotuloPct(v: number | null): string {
  return v === null ? TRACO : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}
export function rotuloBrl(v: number | null): string {
  return v === null ? TRACO : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * O selo de veiculação.
 *
 * > ### ⏭️⏮️ ELE FALA DO FUTURO — "vai entregar?", não "já entregou?"
 * >
 * > Por isso lê `effectiveStatus`, e não o contador de vendas nem o `status`
 * > configurado. Um criativo `ACTIVE` dentro de campanha pausada tem histórico
 * > bom e **não entrega mais** — derivar o selo do histórico o pintaria de verde.
 * >
 * > É a regra que a tela de Webhooks produziu, aplicada aqui inteira.
 */
export function SeloVeiculacao({ c }: { c: Pick<CreativeRow, "effectiveStatus" | "status"> }) {
  const v = veiculando(c);
  if (v === null) {
    return (
      <Tooltip texto="Este anúncio ainda não foi sincronizado com a Meta, então não sabemos se ele está entregando. Não é o mesmo que estar parado.">
        <Badge tom="neutral" ponto>não sincronizado</Badge>
      </Tooltip>
    );
  }
  if (v) return <Badge tom="success" ponto>entregando</Badge>;
  return (
    <Tooltip texto={`A Meta reporta "${c.effectiveStatus}". O que você configurou foi "${c.status}" — quando os dois discordam, quem manda na entrega é o efetivo.`}>
      <Badge tom="neutral" ponto>{rotuloEfetivo(c.effectiveStatus)}</Badge>
    </Tooltip>
  );
}

/**
 * ⚠️ O vocabulário é o do USUÁRIO de tráfego, não o `SCREAMING_CASE` da Graph
 * API. `PENDING_BILLING_INFO` não é jargão de programador (que a regra manda
 * simplificar) nem de tráfego (que ela manda preservar) — é identificador de
 * outra empresa, e ninguém o lê em português.
 */
export function rotuloEfetivo(e: string | null): string {
  const mapa: Record<string, string> = {
    PAUSED: "pausado",
    ADSET_PAUSED: "conjunto pausado",
    CAMPAIGN_PAUSED: "campanha pausada",
    ARCHIVED: "arquivado",
    DELETED: "excluído",
    DISAPPROVED: "reprovado",
    PENDING_REVIEW: "em análise",
    PENDING_BILLING_INFO: "cobrança pendente",
    IN_PROCESS: "processando",
    WITH_ISSUES: "com problema",
  };
  return e === null ? "não sincronizado" : (mapa[e] ?? e.toLowerCase().replace(/_/g, " "));
}

/** A pílula de tendência — só aparece quando há as duas metades para comparar. */
export function PilulaTendencia({ c }: { c: CreativeRow }) {
  const { tendencia, variacao } = tendenciaDoCriativo(c);
  if (tendencia === "sem-comparacao" || tendencia === "estavel" || variacao === null) return null;
  const queda = tendencia === "queda";
  return (
    <Tooltip
      texto={`O CTR ${queda ? "caiu" : "subiu"} ${Math.abs(Math.round(variacao * 100))}% entre a primeira e a segunda metade do período. Cliques e impressões vêm os dois da Meta, então a comparação é do mesmo instrumento.`}
    >
      {/* ⚠️ Cor semântica aqui é legítima: queda de desempenho É a grandeza
          semântica ("isto está piorando"), não um volume que subiu. A regra
          proíbe pintar receita de verde, não pintar deterioração de vermelho. */}
      <Badge tom={queda ? "danger" : "success"}>
        {queda ? "↓" : "↑"} {Math.abs(Math.round(variacao * 100))}% CTR
      </Badge>
    </Tooltip>
  );
}

export function CardCriativo({ c }: { c: CreativeRow }) {
  /* CPA: gasto por VENDA. `null` quando não houve venda — dividir por zero
     venda daria "custo infinito", e o contrato desta base é indefinido. */
  const cpa = c.sales > 0 ? c.spend / c.sales : null;

  return (
    <article
      className="tk-card-criativo"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "var(--tk-pad-card)",
        background: "var(--tk-surface)",
        border: "1px solid var(--tk-border)",
        borderRadius: "var(--tk-radius-card)",
        boxShadow: "var(--tk-shadow-card)",
        minWidth: 0,
      }}
    >
      <PreviaCriativo nome={c.name} url={c.thumbnailUrl} formato={c.format} altura={148} />

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <SeloVeiculacao c={c} />
        <Badge tom="neutral">{c.format}</Badge>
        <PilulaTendencia c={c} />
      </div>

      <div style={{ minWidth: 0 }}>
        {/* §14.4 — sub-rótulo na mesma célula: qualifica sem gastar linha. */}
        <div
          className="text-label text-text"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          title={c.name}
        >
          {c.name}
        </div>
        <div className="text-caption text-text-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.campaign}>
          {c.campaign}
        </div>
      </div>

      {/* O rodapé de três métricas da imagem 9. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          paddingTop: 10,
          borderTop: "1px solid var(--tk-border)",
        }}
      >
        {[
          { r: "ROAS", v: rotuloRoas(c.roas), destaque: true },
          { r: "CTR", v: rotuloPct(c.ctr), destaque: false },
          { r: "CPA", v: rotuloBrl(cpa), destaque: false },
        ].map((m) => (
          <div key={m.r} style={{ minWidth: 0 }}>
            <div className="text-micro text-text-muted">{m.r}</div>
            <div
              className="text-label"
              style={{
                fontVariantNumeric: "tabular-nums",
                /* ⛔ Destaque (azul de marca), NUNCA verde: ROAS é resultado de
                   mídia, mas a cor semântica desta base significa lucro. Ver
                   "COR SEMÂNTICA É PARA A GRANDEZA SEMÂNTICA". */
                color: m.destaque ? "var(--tk-primary)" : "var(--tk-text)",
              }}
            >
              {m.v}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
