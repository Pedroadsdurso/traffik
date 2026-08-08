"use client";

import * as React from "react";

import type { Insight, TomInsight } from "@/lib/ads/insights";
import { Icone, type NomeIcone } from "@/components/dashboard/ui/Icone";

/**
 * PainelInsights — a tela dizendo o que ela achou.
 *
 * Quem calcula é `lib/ads/insights.ts`, e a separação não é cerimônia: a regra
 * de quem entra no ranking (veiculando **e** medida) é o que impede o painel de
 * recomendar campanha parada, e regra em componente não tem teste.
 *
 * 🔧 **Sem o "Ver todos" da imagem 4.** Ele levaria a uma tela de insights que
 * não existe — e link para lugar nenhum é a versão navegável do controle
 * inerte. Ele volta no dia em que a tela existir.
 */

/* ⚠️ O ícone é escolhido AQUI, pela chave, e não vem do `lib`. Nome de ícone é
   vocabulário de tela; um `lib` que devolvesse "trofeu" amarraria a regra de
   negócio ao conjunto de ícones instalado. */
const ICONE: Record<Insight["chave"], NomeIcone> = {
  "melhor-roas": "destaque",
  "mais-conversoes": "carrinho",
  "menor-cpa": "dinheiro",
  atencao: "aviso",
  "parada-boa": "bloqueado",
};

/* `06` §13 — CÍRCULO tingido pela severidade, porque ele classifica uma LINHA
   ("que tipo de coisa é esta?"). Quadrado seria para ilustrar um bloco, e é
   sempre neutro. Trocar um pelo outro faz o ícone parecer selo de estado. */
const TINTA: Record<TomInsight, string> = {
  success: "bg-tint-success text-on-tint-success",
  primary: "bg-tint-primary text-on-tint-primary",
  warning: "bg-tint-warning text-on-tint-warning",
  neutral: "bg-tint-neutral text-on-tint-neutral",
};

export function PainelInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Nenhuma campanha veiculando <strong>e</strong> com métrica no período — não há o que comparar.
        O Insights volta assim que a Meta reportar entrega.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {insights.map((i) => (
        <div
          key={i.chave}
          className="tk-linha"
          style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px", borderRadius: 8 }}
        >
          <span
            aria-hidden="true"
            className={TINTA[i.tom]}
            style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: "var(--tk-radius-pill)", flex: "none" }}
          >
            <Icone nome={ICONE[i.chave]} tamanho={15} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="text-caption text-text-muted">{i.titulo}</div>
            {/* O nome da campanha é o que se lê primeiro — ele é a resposta.
                Sem campanha (o cartão de conjunto), o detalhe sobe para cá. */}
            {i.campanha ? (
              <>
                <div className="text-label text-text" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {i.campanha}
                </div>
                <div className="text-caption text-text-secondary">{i.detalhe}</div>
              </>
            ) : (
              <div className="text-label text-text" style={{ lineHeight: 1.4 }}>{i.detalhe}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
