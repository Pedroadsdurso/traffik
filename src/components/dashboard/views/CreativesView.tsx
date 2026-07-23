import { sx } from "@/lib/sx";
import { ImageSlot } from "../ImageSlot";
import type { TraffikView } from "../useTraffikState";

export function CreativesView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-4)")}>
      {v.creatives.map((cr) => (
        <div className="card" style={sx("padding:0;overflow:hidden")} key={cr.id}>
          <div style={{ position: "relative", width: "100%", aspectRatio: "16/9" }}>
            <ImageSlot label={cr.name} />
            {cr.best && (
              <span style={sx("position:absolute;top:8px;left:8px;display:flex;align-items:center;gap:5px;background:var(--color-accent-800);color:var(--color-accent-100);font-size:11px;padding:4px 9px;border-radius:12px;pointer-events:none")}>
                <svg viewBox="0 0 256 256" width="11" height="11" fill="currentColor" stroke="none">
                  <path d="M128 24 L156 100 L236 104 L172 152 L196 228 L128 182 L60 228 L84 152 L20 104 L100 100 Z" />
                </svg>
                Melhor do dia
              </span>
            )}
          </div>
          <div style={sx("padding:var(--space-3);display:flex;flex-direction:column;gap:6px")}>
            <div style={sx("font-family:var(--font-heading);font-size:14px;line-height:1.3")}>{cr.name}</div>
            <span className="tag tag-outline" style={sx("width:fit-content")}>{cr.campaign}</span>
            <div style={sx("display:grid;grid-template-columns:repeat(4,1fr);gap:6px;font-size:11px;margin-top:4px")}>
              <div><div className="text-muted">CTR</div><div style={sx("font-variant-numeric:tabular-nums")}>{cr.ctrLabel}</div></div>
              <div><div className="text-muted">ROAS</div><div style={sx("color:var(--color-accent-300);font-variant-numeric:tabular-nums")}>{cr.roasLabel}</div></div>
              <div><div className="text-muted">Gasto</div><div style={sx("font-variant-numeric:tabular-nums")}>{cr.spendLabel}</div></div>
              <div><div className="text-muted">Vendas</div><div style={sx("font-variant-numeric:tabular-nums")}>{cr.sales}</div></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
