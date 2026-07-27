"use client";

import { geoOrthographic, geoPath, geoCircle } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";

import { PAIS, nomePais } from "@/lib/countries";
import { brl } from "@/lib/format";
import { sx } from "@/lib/sx";
import { WORLD_LAND } from "@/lib/worldGeo";
import { ChartTooltip } from "./chartKit";

export interface PaisVenda {
  code: string;
  sales: number;
  revenue: number;
}

const SIZE = 300; // lado do viewBox (o globo é sempre quadrado)
const MARGEM = 6;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;

/** Raio da esfera em unidades do viewBox para um dado zoom. */
function raio(zoom: number): number {
  return (SIZE / 2 - MARGEM) * zoom;
}

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * Globo em **projeção ortográfica** (`d3.geoOrthographic`) — dá o efeito de
 * esfera girável sem WebGL.
 *
 * WebGL/three.js foi descartado de propósito: seria um canvas dentro de um bloco
 * redimensionável do grid, com contexto próprio para gerenciar e risco de
 * quebrar em máquinas sem aceleração. O d3 desenha SVG comum, participa do
 * layout normalmente e não tem contexto para perder.
 *
 * Reprojetar a cada frame é barato porque a geometria é `land-110m` já
 * simplificada (~125 polígonos) — ver `scripts/gen-world-paths.mjs`.
 */
export function CountryMap({ dados }: { dados: PaisVenda[] }) {
  const [modo, setModo] = useState<"globo" | "ranking">("globo");
  const [rot, setRot] = useState<[number, number]>([-50, -12]); // começa no Atlântico Sul
  const [zoom, setZoom] = useState(1);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; code: string } | null>(null);

  const arrasto = useRef<{ x: number; y: number; rot: [number, number] } | null>(null);
  const interagindo = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const totalRev = dados.reduce((a, d) => a + d.revenue, 0);
  const maxVendas = Math.max(1, ...dados.map((d) => d.sales));

  // Rotação automática — pausa enquanto o mouse está no globo.
  useEffect(() => {
    if (modo !== "globo") return;
    let raf = 0;
    let ultimo = performance.now();
    const passo = (agora: number) => {
      const dt = agora - ultimo;
      ultimo = agora;
      if (!interagindo.current) {
        // ~4°/s: perceptível sem distrair.
        setRot(([l, p]) => [l + (dt / 1000) * 4, p]);
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [modo]);

  const { caminhoTerra, esfera, marcadores } = useMemo(() => {
    const proj = geoOrthographic()
      .scale(raio(zoom))
      .translate([SIZE / 2, SIZE / 2])
      .rotate([rot[0], rot[1], 0]);
    const path = geoPath(proj);

    const marc = dados
      .map((d) => {
        const p = PAIS[d.code];
        if (!p) return null;
        const xy = proj([p.lng, p.lat]);
        if (!xy) return null;
        // O ponto pode estar no lado oculto da esfera: `geoCircle` minúsculo
        // devolve path vazio quando o centro não é visível.
        const visivel = Boolean(geoPath(proj)(geoCircle().center([p.lng, p.lat]).radius(0.5)()));
        return { ...d, x: xy[0], y: xy[1], visivel, r: 3 + (d.sales / maxVendas) * 5 };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null && m.visivel);

    return {
      caminhoTerra: path(WORLD_LAND as Parameters<typeof path>[0]) ?? "",
      esfera: path({ type: "Sphere" } as Parameters<typeof path>[0]) ?? "",
      marcadores: marc,
    };
  }, [rot, zoom, dados, maxVendas]);

  const marcado = dados.find((d) => d.code === tip?.code);

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);flex:1;min-height:0")}>
      <div style={sx("display:flex;gap:4px;align-self:flex-end")}>
        {(["ranking", "globo"] as const).map((m) => (
          <button key={m} type="button" className={modo === m ? "btn btn-primary" : "btn btn-ghost"}
            style={sx("padding:2px 10px;font-size:11.5px")} onClick={() => setModo(m)}>
            {m === "ranking" ? "Ranking" : "Globo"}
          </button>
        ))}
      </div>

      {modo === "ranking" ? (
        <div style={sx("display:flex;flex-direction:column;gap:9px;overflow:auto;flex:1;padding:2px")}>
          {dados.length === 0 ? (
            <div className="text-muted" style={sx("font-size:13px;display:grid;place-items:center;flex:1")}>
              Nenhuma venda com país identificado.
            </div>
          ) : (
            dados.map((d, i) => {
              const pct = totalRev ? (d.revenue / totalRev) * 100 : 0;
              return (
                <div key={d.code} style={sx("display:flex;flex-direction:column;gap:4px")}>
                  <div style={sx("display:flex;justify-content:space-between;font-size:12.5px;gap:8px")}>
                    <span>
                      <span className="text-muted" style={sx("margin-right:6px")}>{i + 1}.</span>
                      {nomePais(d.code)} <span className="text-muted">· {d.sales} venda(s)</span>
                    </span>
                    <span style={sx("font-variant-numeric:tabular-nums;white-space:nowrap")}>
                      {brl(d.revenue)} · {pct.toFixed(1).replace(".", ",")}%
                    </span>
                  </div>
                  <div style={sx("height:6px;border-radius:3px;background:var(--color-neutral-800);overflow:hidden")}>
                    <div style={sx(`height:100%;border-radius:3px;background:linear-gradient(90deg,#a78bfa,#6d5fe0);width:${pct}%;transition:width 400ms var(--ease-out)`)} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div
          ref={boxRef}
          style={sx("position:relative;flex:1;min-height:200px;display:grid;place-items:center;overflow:hidden;border-radius:var(--radius-md);background:radial-gradient(circle at 50% 40%, #141a33 0%, #0b0e1a 70%)")}
          onMouseEnter={() => (interagindo.current = true)}
          onMouseLeave={() => {
            interagindo.current = false;
            arrasto.current = null;
            setTip(null);
            setAtivo(null);
          }}
        >
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{ width: "auto", height: "100%", maxWidth: "100%", aspectRatio: "1", cursor: arrasto.current ? "grabbing" : "grab" }}
            onMouseDown={(e) => (arrasto.current = { x: e.clientX, y: e.clientY, rot })}
            onMouseUp={() => (arrasto.current = null)}
            onMouseMove={(e) => {
              const a = arrasto.current;
              if (!a) return;
              // 0.35°/px dá uma rotação que acompanha o mouse sem "escapar".
              setRot([a.rot[0] + (e.clientX - a.x) * 0.35, Math.max(-88, Math.min(88, a.rot[1] - (e.clientY - a.y) * 0.35))]);
            }}
            onWheel={(e) => {
              e.preventDefault();
              setZoom((zAtual) => clampZoom(zAtual - e.deltaY * 0.0018));
            }}
          >
            <defs>
              {/* Iluminação: claro no centro, escuro na borda → sensação de volume. */}
              <radialGradient id="globo-luz" cx="38%" cy="32%" r="72%">
                <stop offset="0%" stopColor="#2b3a6b" />
                <stop offset="55%" stopColor="#18224a" />
                <stop offset="100%" stopColor="#0a1029" />
              </radialGradient>
              <radialGradient id="globo-brilho" cx="50%" cy="50%" r="50%">
                <stop offset="88%" stopColor="#7c6ce0" stopOpacity={0} />
                <stop offset="100%" stopColor="#7c6ce0" stopOpacity={0.35} />
              </radialGradient>
              <filter id="glow-ponto" x="-140%" y="-140%" width="380%" height="380%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Oceano */}
            <path d={esfera} fill="url(#globo-luz)" />
            {/* Continentes */}
            <path d={caminhoTerra} fill="#38477e" stroke="#5b6bb5" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
            {/* Halo da borda: reforça a curvatura */}
            <path d={esfera} fill="url(#globo-brilho)" />
            <path d={esfera} fill="none" stroke="#6d5fe0" strokeWidth={0.7} opacity={0.5} vectorEffect="non-scaling-stroke" />

            {marcadores.map((m) => {
              const on = ativo === m.code;
              return (
                <g key={m.code} style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => {
                    setAtivo(m.code);
                    const box = boxRef.current?.getBoundingClientRect();
                    if (box) setTip({ x: e.clientX - box.left, y: e.clientY - box.top, code: m.code });
                  }}
                  onMouseLeave={() => { setAtivo(null); setTip(null); }}
                >
                  <circle cx={m.x} cy={m.y} r={m.r * 2.4} fill="#8b7ff0" opacity={on ? 0.5 : 0.25}>
                    <animate attributeName="opacity" values={`${on ? 0.5 : 0.25};0.06;${on ? 0.5 : 0.25}`}
                      dur="2.6s" repeatCount="indefinite" />
                    <animate attributeName="r" values={`${m.r * 1.7};${m.r * 3};${m.r * 1.7}`}
                      dur="2.6s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={m.x} cy={m.y} r={on ? m.r * 1.25 : m.r} fill="#e5e0ff"
                    filter="url(#glow-ponto)" style={{ transition: "r 200ms var(--ease-out)" }} />
                </g>
              );
            })}
          </svg>

          {/* Estado vazio: o globo continua girando, a mensagem só se sobrepõe. */}
          {dados.length === 0 && (
            <div style={sx("position:absolute;inset:auto 0 14px 0;text-align:center;pointer-events:none;padding:0 var(--space-4)")}>
              <div style={sx("font-size:12.5px;opacity:.8")}>Nenhuma venda com país identificado</div>
              <div className="text-muted" style={sx("font-size:11px;margin-top:2px")}>
                O país vem do gateway ou do clique rastreado.
              </div>
            </div>
          )}

          <div style={sx("position:absolute;bottom:8px;right:8px;display:flex;gap:4px")}>
            <button type="button" className="btn btn-secondary" style={sx("padding:1px 8px;font-size:13px")}
              onClick={() => setZoom((z) => clampZoom(z + 0.4))}
              disabled={zoom >= ZOOM_MAX}
              aria-label="Aproximar">+</button>
            <button type="button" className="btn btn-secondary" style={sx("padding:1px 8px;font-size:13px")}
              onClick={() => setZoom((z) => clampZoom(z - 0.4))}
              disabled={zoom <= ZOOM_MIN}
              aria-label="Afastar">−</button>
            <button type="button" className="btn btn-secondary" style={sx("padding:1px 8px;font-size:11px")}
              onClick={() => { setZoom(1); setRot([-50, -12]); }}>Reset</button>
          </div>

          {tip && marcado && (
            <ChartTooltip
              x={tip.x}
              y={tip.y}
              ancorarDireita={tip.x > (boxRef.current?.clientWidth ?? 0) * 0.6}
              titulo={`${PAIS[marcado.code]?.bandeira ?? "🌐"}  ${nomePais(marcado.code)}`}
              linhas={[
                { cor: "#8b7ff0", label: "Vendas", valor: String(marcado.sales) },
                { cor: "#a78bfa", label: "Faturamento", valor: brl(marcado.revenue) },
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
}
