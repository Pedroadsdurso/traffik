"use client";

import * as React from "react";
import { brl0 } from "@/lib/format";

/**
 * SerieTemporal — barras verticais para "quanto em cada momento".
 *
 * 🔴 ELE ABSORVE TRÊS BLOCOS: Vendas por dia, Vendas por horário e Lucro por
 * horário. A granularidade não é prop dele — quem monta os pontos já resolveu
 * isso —, e é por isso que os três couberam sem inchar a assinatura.
 *
 * ⛔ NÃO ABSORVEU o `LineChart` do Receita × Gasto, e a decisão é deliberada:
 * aquele tem DUAS séries, linha de break-even, seletor de granularidade e
 * tooltip por ponto. Fundir os dois exigiria umas seis props novas para atender
 * um caso que o outro não tem — e forçar abstração para ganhar um número é
 * exatamente como nascem componentes com dez props. **Dois componentes com
 * responsabilidades distintas são mais baratos que um com um `modo`.**
 *
 * ### O negativo é opcional, e isso não é detalhe
 *
 * Receita nunca é negativa; lucro é. Com `permitirNegativo` o eixo ganha uma
 * linha de zero e a barra cresce para baixo — sem ele, um lucro negativo seria
 * desenhado como barra positiva minúscula, que é o oposto do que aconteceu.
 */

export interface PontoSerieTemporal {
  rotulo: string;
  valor: number;
  /** Segundo número, só no tooltip. Ex.: a contagem de vendas do dia. */
  apoio?: number;
}

export function SerieTemporal({
  pontos,
  rotuloValor,
  rotuloApoio,
  permitirNegativo = false,
  formatar = brl0,
}: {
  pontos: PontoSerieTemporal[];
  rotuloValor: string;
  rotuloApoio?: string;
  permitirNegativo?: boolean;
  formatar?: (n: number) => string;
}) {
  if (pontos.length === 0) {
    return (
      <p className="text-caption text-text-muted" style={{ margin: 0 }}>
        Nada para mostrar neste período.
      </p>
    );
  }

  const valores = pontos.map((p) => p.valor);
  const max = Math.max(...valores, 0);
  const min = permitirNegativo ? Math.min(...valores, 0) : 0;
  /* `|| 1` evita dividir por zero quando tudo é zero. Nesse caso toda barra fica
     no piso, que é a leitura certa: observamos, não houve movimento. */
  const amplitude = max - min || 1;
  const zeroPct = permitirNegativo ? ((max - 0) / amplitude) * 100 : 100;

  return (
    <div className="tk-serie" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* ⛔ `gap: 0` AQUI DE PROPÓSITO. A folga entre barras é 40% do PASSO
          (`06` §4), e ela é feita por dentro do slot — `left/right: 20%` na
          barra. Com `gap` no contêiner a folga seria fixa em pixels: com 7 dias
          as barras ficariam gordas e a folga sumiria, com 90 dias o contrário.
          A proporção só se mantém se a folga escalar junto com o passo. */}
      <div style={{ position: "relative", height: 120, display: "flex", alignItems: "flex-end", gap: 0 }}>
        {permitirNegativo && (
          /* A linha de zero. Sem ela, uma barra para baixo não tem referência e
             o desenho não diz onde o lucro deixou de existir. */
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: 0, right: 0, top: `${zeroPct}%`, borderTop: "1px dashed var(--tk-border)" }}
          />
        )}
        {pontos.map((p, i) => {
          const negativo = p.valor < 0;
          const alturaPct = (Math.abs(p.valor) / amplitude) * 100;
          const titulo = [
            p.rotulo,
            `${rotuloValor}: ${formatar(p.valor)}`,
            p.apoio != null && rotuloApoio ? `${p.apoio} ${rotuloApoio}` : null,
          ]
            .filter(Boolean)
            .join("\n");

          return (
            <div
              key={i}
              title={titulo}
              aria-label={titulo}
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: permitirNegativo ? "flex-start" : "flex-end",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: permitirNegativo ? "absolute" : "relative",
                  ...(permitirNegativo
                    ? negativo
                      ? { top: `${zeroPct}%` }
                      : { bottom: `${100 - zeroPct}%` }
                    : null),
                  // 60% de barra, 40% de folga — 20% de cada lado do passo.
                  left: "20%",
                  right: "20%",
                  height: `${Math.max(alturaPct, p.valor === 0 ? 0 : 1.5)}%`,
                  /* Raio no TOPO, e na base quando a barra desce do zero (`06`
                     §4). O canto que encosta na linha de base fica vivo: barra
                     arredondada nos quatro cantos flutua, e uma série temporal
                     precisa parecer apoiada no eixo.
                     `borderRadius` com 6px maior que metade da altura degenera
                     sozinho no navegador, então a barra baixinha vira cápsula
                     sem precisar de conta — que é o "raio total se a barra for
                     fina" do mesmo parágrafo. */
                  borderRadius: negativo ? "0 0 6px 6px" : "6px 6px 0 0",
                  /* 🔴 Prejuízo em vermelho, e não é enfeite: numa série de
                     lucro a cor é o que faz o dia ruim saltar antes de a pessoa
                     ler o eixo. É a mesma regra do `corFinanceira` — só o
                     negativo ganha cor. */
                  background: negativo ? "var(--tk-danger)" : "var(--tk-primary)",
                }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 2 }}>
        {pontos.map((p, i) => (
          /* Rótulo a cada N pontos: 24 ou 30 rótulos de 11px lado a lado viram
             uma régua ilegível. Quem precisa do valor exato tem o tooltip. */
          <span
            key={i}
            className="text-caption text-text-muted"
            style={{ flex: 1, minWidth: 0, textAlign: "center", overflow: "hidden", whiteSpace: "nowrap" }}
          >
            {i % Math.ceil(pontos.length / 8) === 0 ? p.rotulo : ""}
          </span>
        ))}
      </div>

      <span className="text-caption text-text-muted">{rotuloValor}</span>
    </div>
  );
}
