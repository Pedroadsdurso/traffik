"use client";

import { geoOrthographic, geoPath, geoCircle } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";

import { useTheme } from "@/components/theme/ThemeProvider";
import { PAIS, nomePais } from "@/lib/countries";
import { brl, plural } from "@/lib/format";
import { sx } from "@/lib/sx";
import { WORLD_LAND } from "@/lib/worldGeo";
import { ChartTooltip } from "./chartKit";
import { useTamanho } from "./useTamanho";

export interface PaisVenda {
  code: string;
  sales: number;
  revenue: number;
}

const SIZE = 300; // lado do viewBox (o globo é sempre quadrado)
const MARGEM = 6;
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.04; // Máximo que garante 100% de visibilidade esférica sem clipping nas bordas

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
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [modo, setModo] = useState<"globo" | "ranking">("globo");
  const [rot, setRot] = useState<[number, number]>([-50, -12]); // começa no Atlântico Sul
  const [zoom, setZoom] = useState(1);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; code: string } | null>(null);

  const arrasto = useRef<{ x: number; y: number; rot: [number, number] } | null>(null);
  /**
   * 🐛 O cursor "grabbing" NUNCA aparecia: ele era lido de `arrasto.current`
   * durante o render, e mudar um ref não redispara render. Precisa ser estado.
   */
  const [arrastando, setArrastando] = useState(false);
  const touchState = useRef<{ dist?: number; x?: number; y?: number; rot?: [number, number] } | null>(null);
  const interagindo = useRef(false);
  /**
   * Um ref só, que serve às duas coisas: origem das coordenadas do tooltip (lido
   * em evento) e largura medida (lida no render). Eram `boxRef` + leitura de
   * `boxRef.current.clientWidth` no render, que devolve o valor do frame anterior
   * e não redispara render quando muda.
   */
  const { ref: boxRef, no: boxNo, largura } = useTamanho<HTMLDivElement>();

  const rotRef = useRef(rot);
  useEffect(() => {
    rotRef.current = rot;
  }, [rot]);

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
  }, [modo, boxNo]);

  // Previne a rolagem da página inteira no wheel / touch e aplica zoom direcionado ao cursor / pinch
  useEffect(() => {
    const el = boxNo;
    if (!el || modo !== "globo") return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const svg = el.querySelector("svg");
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * SIZE;
      const cy = ((e.clientY - rect.top) / rect.height) * SIZE;

      setZoom((zAtual) => {
        const delta = -e.deltaY * 0.0015;
        const novo = clampZoom(zAtual + delta);
        if (novo === zAtual) return zAtual;

        // Ao aproximar o zoom, orienta suavemente a esfera para a coordenada do cursor
        if (novo > zAtual) {
          const projAtual = geoOrthographic()
            .scale(raio(zAtual))
            .translate([SIZE / 2, SIZE / 2])
            .rotate([rotRef.current[0], rotRef.current[1], 0]);

          if (projAtual.invert) {
            const coords = projAtual.invert([cx, cy]);
            if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
              const [targetLng, targetLat] = coords;
              const currentRot = rotRef.current;
              const factor = Math.min(0.5, (novo - zAtual) * 2.5);

              let dLng = -targetLng - currentRot[0];
              dLng = ((((dLng + 180) % 360) + 360) % 360) - 180;
              const targetRotLat = Math.max(-88, Math.min(88, -targetLat));
              const dLat = targetRotLat - currentRot[1];

              setRot([
                currentRot[0] + dLng * factor,
                Math.max(-88, Math.min(88, currentRot[1] + dLat * factor)),
              ]);
            }
          }
        }

        return novo;
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
      }

      if (e.touches.length === 1 && touchState.current?.x != null && touchState.current?.y != null && touchState.current?.rot) {
        const t = e.touches[0];
        const dx = t.clientX - touchState.current.x;
        const dy = t.clientY - touchState.current.y;
        const initialRot = touchState.current.rot;
        setRot([
          initialRot[0] + dx * 0.35,
          Math.max(-88, Math.min(88, initialRot[1] - dy * 0.35)),
        ]);
      } else if (e.touches.length === 2 && touchState.current?.dist) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const factor = dist / touchState.current.dist;
        setZoom((z) => clampZoom(z * factor));
        touchState.current.dist = dist;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      interagindo.current = true;
      if (e.touches.length === 1) {
        touchState.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          rot: [...rotRef.current],
        };
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        touchState.current = { dist, rot: [...rotRef.current] };
      }
    };

    const handleTouchEnd = () => {
      touchState.current = null;
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
    // Depende do NÓ: o efeito precisa reanexar os gestos quando o elemento
    // aparece (o mapa pode montar depois, vindo do estado vazio).
  }, [modo, boxNo]);

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
                      {nomePais(d.code)} <span className="text-muted">· {plural(d.sales, "venda", "vendas")}</span>
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
          style={sx(`position:relative;flex:1;min-height:200px;display:grid;place-items:center;overflow:hidden;border-radius:var(--radius-md);background:${isLight ? "radial-gradient(circle at 50% 40%, #e0e7ff 0%, #c7d2fe 70%)" : "radial-gradient(circle at 50% 40%, #141a33 0%, #0b0e1a 70%)"}`)}
          onMouseEnter={() => (interagindo.current = true)}
          onMouseLeave={() => {
            interagindo.current = false;
            arrasto.current = null;
            setArrastando(false);
            setTip(null);
            setAtivo(null);
          }}
        >
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{ width: "auto", height: "100%", maxWidth: "100%", aspectRatio: "1", cursor: arrastando ? "grabbing" : "grab" }}
            onMouseDown={(e) => { arrasto.current = { x: e.clientX, y: e.clientY, rot }; setArrastando(true); }}
            onMouseUp={() => { arrasto.current = null; setArrastando(false); }}
            onMouseMove={(e) => {
              const a = arrasto.current;
              if (!a) return;
              // 0.35°/px dá uma rotação que acompanha o mouse sem "escapar".
              setRot([a.rot[0] + (e.clientX - a.x) * 0.35, Math.max(-88, Math.min(88, a.rot[1] - (e.clientY - a.y) * 0.35))]);
            }}
          >
            <defs>
              {/* Iluminação: claro no centro, escuro na borda → sensação de volume. */}
              <radialGradient id="globo-luz" cx="38%" cy="32%" r="72%">
                <stop offset="0%" stopColor={isLight ? "#93c5fd" : "#2b3a6b"} />
                <stop offset="55%" stopColor={isLight ? "#60a5fa" : "#18224a"} />
                <stop offset="100%" stopColor={isLight ? "#2563eb" : "#0a1029"} />
              </radialGradient>
              <radialGradient id="globo-brilho" cx="50%" cy="50%" r="50%">
                <stop offset="88%" stopColor={isLight ? "#4f46e5" : "#7c6ce0"} stopOpacity={0} />
                <stop offset="100%" stopColor={isLight ? "#4f46e5" : "#7c6ce0"} stopOpacity={isLight ? 0.25 : 0.35} />
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
            <path d={caminhoTerra} fill={isLight ? "#4338ca" : "#38477e"} stroke={isLight ? "#312e81" : "#5b6bb5"} strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
            {/* Halo da borda: reforça a curvatura */}
            <path d={esfera} fill="url(#globo-brilho)" />
            <path d={esfera} fill="none" stroke={isLight ? "#4338ca" : "#6d5fe0"} strokeWidth={0.7} opacity={0.5} vectorEffect="non-scaling-stroke" />

            {marcadores.map((m) => {
              const on = ativo === m.code;
              return (
                <g key={m.code} style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => {
                    setAtivo(m.code);
                    const box = boxNo?.getBoundingClientRect();
                    if (box) setTip({ x: e.clientX - box.left, y: e.clientY - box.top, code: m.code });
                  }}
                  onMouseLeave={() => { setAtivo(null); setTip(null); }}
                >
                  <circle cx={m.x} cy={m.y} r={m.r * 2.4} fill={isLight ? "#4f46e5" : "#8b7ff0"} opacity={on ? 0.5 : 0.25}>
                    <animate attributeName="opacity" values={`${on ? 0.5 : 0.25};0.06;${on ? 0.5 : 0.25}`}
                      dur="2.6s" repeatCount="indefinite" />
                    <animate attributeName="r" values={`${m.r * 1.7};${m.r * 3};${m.r * 1.7}`}
                      dur="2.6s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={m.x} cy={m.y} r={on ? m.r * 1.25 : m.r} fill={isLight ? "#e0e7ff" : "#e5e0ff"}
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
              onClick={() => setZoom((z) => clampZoom(z + 0.1))}
              disabled={zoom >= ZOOM_MAX}
              aria-label="Aproximar">+</button>
            <button type="button" className="btn btn-secondary" style={sx("padding:1px 8px;font-size:13px")}
              onClick={() => setZoom((z) => clampZoom(z - 0.1))}
              disabled={zoom <= ZOOM_MIN}
              aria-label="Afastar">−</button>
            <button type="button" className="btn btn-secondary" style={sx("padding:1px 8px;font-size:11px")}
              onClick={() => { setZoom(1); setRot([-50, -12]); }}>Reset</button>
          </div>

          {tip && marcado && (
            <ChartTooltip
              x={tip.x}
              y={tip.y}
              ancorarDireita={largura > 0 && tip.x > largura * 0.6}
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
