"use client";

import { sx } from "@/lib/sx";

export interface EtapaFunil {
  label: string;
  value: number;
}

/**
 * Funil trapezoidal (Bloco 5): cada etapa é um trapézio cuja largura de topo é
 * a da etapa anterior e a de base é proporcional ao próprio valor — é isso que
 * dá o estreitamento contínuo, em vez de barras soltas.
 *
 * Desenhado como um único SVG com `polygon` por etapa. A animação vem da
 * transição de `points`, que o browser interpola quando o número de vértices
 * não muda (sempre 4).
 */
export function Funnel({ etapas }: { etapas: EtapaFunil[] }) {
  // Base é o MAIOR estágio, não o primeiro: quando o Facebook ainda não foi
  // sincronizado, "cliques no anúncio" é 0 e o funil ficaria invisível mesmo
  // havendo checkouts e vendas. Com o máximo, o funil sempre se lê.
  const base = Math.max(0, ...etapas.map((e) => e.value));
  if (etapas.length === 0 || base <= 0) {
    return (
      <div className="text-muted" style={sx("font-size:13px;padding:var(--space-2) 0")}>
        Sem tráfego no período — o funil aparece quando houver cliques.
      </div>
    );
  }

  const W = 600;
  const ALT = 46; // altura de cada trapézio
  const GAP = 6;
  const H = etapas.length * (ALT + GAP);

  // Largura proporcional, com um piso para etapas zeradas continuarem visíveis.
  const larguras = etapas.map((e) => Math.max(0.06, e.value / base));

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);flex:1;margin-top:var(--space-2)")}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Funil de conversão">
        {etapas.map((e, i) => {
          const wTopo = larguras[i]! * W;
          const wBase = (larguras[i + 1] ?? larguras[i]!) * W;
          const y = i * (ALT + GAP);
          const x1 = (W - wTopo) / 2;
          const x2 = (W - wBase) / 2;
          const pontos = `${x1},${y} ${x1 + wTopo},${y} ${x2 + wBase},${y + ALT} ${x2},${y + ALT}`;
          // Opacidade decrescente reforça a leitura de "afunilando".
          const op = 0.9 - i * 0.12;
          return (
            <polygon
              key={e.label}
              points={pontos}
              fill="var(--color-accent)"
              opacity={Math.max(0.3, op)}
              style={{ transition: "all 320ms cubic-bezier(0.22,0.61,0.36,1)" }}
            >
              <title>{`${e.label}: ${e.value}`}</title>
            </polygon>
          );
        })}
      </svg>

      {/* Rótulos fora do SVG: texto dentro de viewBox esticado fica ilegível. */}
      <div style={sx("display:flex;flex-direction:column;gap:2px")}>
        {etapas.map((e, i) => {
          const anterior = i > 0 ? etapas[i - 1]!.value : null;
          const taxa = anterior && anterior > 0 ? (e.value / anterior) * 100 : null;
          return (
            <div key={e.label} style={sx("display:flex;align-items:center;gap:8px;font-size:12px;padding:2px 0")}>
              <span style={sx("width:9px;height:9px;border-radius:2px;flex:none;background:var(--color-accent);opacity:" + Math.max(0.3, 0.9 - i * 0.12))} />
              <span style={sx("flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{e.label}</span>
              <strong style={sx("font-variant-numeric:tabular-nums")}>{e.value}</strong>
              {taxa !== null && (
                <span className="tag tag-outline" style={sx("font-size:10px;min-width:56px;justify-content:center")}>
                  {taxa.toFixed(1).replace(".", ",")}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
