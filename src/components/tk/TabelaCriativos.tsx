"use client";

/**
 * A tabela densa de Criativos — o outro lado do alternador grade/tabela.
 *
 * ⚠️ **É o MESMO conjunto da grade**, filtrado e ordenado pelos mesmos
 * controles. Duas consultas dariam duas respostas para a mesma pergunta, que é
 * o defeito de "duas implementações da mesma conta divergem sempre". Aqui a
 * tela passa a lista já pronta e a tabela só desenha.
 *
 * §8 do `06`: linhas sem borda entre si (`.tk-linha` cuida do hover), números à
 * direita em fonte tabular, cabeçalho único.
 */
import * as React from "react";

import {
  PilulaTendencia,
  SeloVeiculacao,
  rotuloBrl,
  rotuloPct,
  rotuloRoas,
} from "@/components/tk/CardCriativo";
import { PreviaCriativo } from "@/components/tk/PreviaCriativo";
import { Tooltip } from "@/components/tk/Tooltip";
import type { CreativeRow } from "@/lib/ads/creatives";

/**
 * ⚠️ A última linha de cada ajuda declara a PROCEDÊNCIA, como o Gerenciador faz.
 * Numa ferramenta que junta dois sistemas de medição, saber de onde o número
 * veio é parte do número.
 */
const COLUNAS: { chave: string; rotulo: string; ajuda: string; direita?: boolean }[] = [
  { chave: "criativo", rotulo: "Criativo", ajuda: "Título do criativo e a campanha em que ele roda.\n\nVem do Facebook." },
  { chave: "estado", rotulo: "Estado", ajuda: "Se a Meta está entregando este anúncio agora.\n\nVem do Facebook." },
  { chave: "gasto", rotulo: "Gasto", ajuda: "Investido no período.\n\nVem do Facebook.", direita: true },
  { chave: "imp", rotulo: "Impressões", ajuda: "Quantas vezes o anúncio foi exibido.\n\nVem do Facebook.", direita: true },
  { chave: "ctr", rotulo: "CTR", ajuda: "Cliques dividido por impressões.\n\nCalculado a partir de dois campos do Facebook.", direita: true },
  { chave: "cpc", rotulo: "CPC", ajuda: "Gasto dividido por cliques.\n\nCalculado a partir de dois campos do Facebook.", direita: true },
  { chave: "vendas", rotulo: "Vendas", ajuda: "Pedidos aprovados atribuídos a este criativo pelo utm_content.\n\nVem do gateway.", direita: true },
  { chave: "cpa", rotulo: "CPA", ajuda: "Gasto dividido por vendas.\n\nCalculado a partir dos dois: gasto do Facebook, vendas do gateway.", direita: true },
  { chave: "roas", rotulo: "ROAS", ajuda: "Receita atribuída dividida pelo gasto.\n\nCalculado a partir dos dois: receita do gateway, gasto do Facebook.", direita: true },
];

/**
 * ⚠️ As colunas numéricas são `fr` com piso, não px fixo.
 *
 * Com elas em px, **toda a folga da tela larga caía na coluna `Criativo`** — e
 * numa janela de 1568px isso deixava ~400px de vazio entre o nome e o `Estado`,
 * com os números espremidos na borda direita. O olho lê as duas metades da linha
 * como coisas separadas.
 *
 * ⚠️ E é a mesma família de *medida que precisa manter proporção não nasce em
 * pixel* (`06`): a largura de coluna precisa PARECER equilibrada em qualquer
 * viewport, então ela sai de uma fração — e o `minmax` guarda o piso para a
 * tabela não se esmagar antes de o `overflow-x` assumir.
 */
const GRADE =
  "minmax(230px,2.2fr) minmax(140px,1.2fr) repeat(7, minmax(70px,0.72fr))";

export function TabelaCriativos({ linhas }: { linhas: CreativeRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 940 }}>
        <div
          className="text-micro text-text-muted"
          style={{
            display: "grid",
            gridTemplateColumns: GRADE,
            gap: 12,
            padding: "0 8px 8px",
            borderBottom: "1px solid var(--tk-border)",
            alignItems: "end",
          }}
        >
          {COLUNAS.map((col) => (
            <Tooltip key={col.chave} texto={<span style={{ whiteSpace: "pre-line" }}>{col.ajuda}</span>}>
              <span style={{ textAlign: col.direita ? "right" : "left", cursor: "help" }}>{col.rotulo} ⓘ</span>
            </Tooltip>
          ))}
        </div>

        {linhas.map((c) => {
          const cpa = c.sales > 0 ? c.spend / c.sales : null;
          const num = (v: string) => (
            <span className="text-label text-text" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {v}
            </span>
          );
          return (
            <div
              key={c.id}
              className="tk-linha"
              style={{
                display: "grid",
                gridTemplateColumns: GRADE,
                gap: 12,
                alignItems: "center",
                minHeight: 56,
                padding: "0 8px",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{ width: 56, flex: "none" }}>
                  <PreviaCriativo nome={c.name} url={c.thumbnailUrl} altura={40} compacta />
                </div>
                <div style={{ minWidth: 0 }}>
                  {/* §14.4 — nome e campanha na MESMA célula. */}
                  <div className="text-label text-text" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.name}>
                    {c.name}
                  </div>
                  <div className="text-caption text-text-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.campaign}>
                    {c.campaign}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
                <SeloVeiculacao c={c} />
                <PilulaTendencia c={c} />
              </div>

              {num(rotuloBrl(c.spend))}
              {num(c.impressions.toLocaleString("pt-BR"))}
              {num(rotuloPct(c.ctr))}
              {num(rotuloBrl(c.cpc))}
              {num(c.sales.toLocaleString("pt-BR"))}
              {num(rotuloBrl(cpa))}
              <span
                className="text-label"
                style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--tk-primary)" }}
              >
                {rotuloRoas(c.roas)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
