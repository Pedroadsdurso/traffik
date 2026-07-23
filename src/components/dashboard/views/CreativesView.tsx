import { sx } from "@/lib/sx";
import { ImageSlot } from "../ImageSlot";
import type { TraffikView } from "../useTraffikState";

export function CreativesView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      <div style={sx("display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap")}>
        <div style={sx("display:flex;flex-direction:column;gap:3px")}>
          <span style={sx("font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.5")}>Período</span>
          <select className="input" style={sx("width:auto")} value={v.creativesPeriod} onChange={v.onCreativesPeriod}>
            <option value="hoje">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
        </div>
        <div style={sx("display:flex;flex-direction:column;gap:3px")}>
          <span style={sx("font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.5")}>Ordenar por</span>
          <select className="input" style={sx("width:auto")} value={v.creativesSort} onChange={v.onCreativesSort}>
            <option value="roas">ROAS</option>
            <option value="ctr">CTR</option>
            <option value="spend">Gasto</option>
            <option value="sales">Vendas</option>
          </select>
        </div>
      </div>

      {v.creatives.length === 0 ? (
        <div className="card text-muted" style={sx("font-size:13px")}>
          {v.creativesLoading ? "Carregando criativos…" : "Nenhum criativo sincronizado. Sincronize suas contas em Facebook Ads."}
        </div>
      ) : (
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-4)")}>
          {v.creatives.map((cr) => (
            <div className="card" style={sx("padding:0;overflow:hidden")} key={cr.id}>
              <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "var(--color-bg)" }}>
                {cr.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cr.thumbnailUrl} alt={cr.name} style={sx("width:100%;height:100%;object-fit:cover")} />
                ) : (
                  <ImageSlot label={cr.name} />
                )}
                {cr.best && (
                  <span style={sx("position:absolute;top:8px;left:8px;display:flex;align-items:center;gap:5px;background:var(--color-accent-800);color:var(--color-accent-100);font-size:11px;padding:4px 9px;border-radius:12px;pointer-events:none")}>
                    <svg viewBox="0 0 256 256" width="11" height="11" fill="currentColor" stroke="none">
                      <path d="M128 24 L156 100 L236 104 L172 152 L196 228 L128 182 L60 228 L84 152 L20 104 L100 100 Z" />
                    </svg>
                    Melhor do dia
                  </span>
                )}
                <span style={sx("position:absolute;top:8px;right:8px")} className="tag tag-neutral">{cr.format}</span>
              </div>
              <div style={sx("padding:var(--space-3);display:flex;flex-direction:column;gap:6px")}>
                <div style={sx("font-family:var(--font-heading);font-size:14px;line-height:1.3;max-height:2.6em;overflow:hidden")}>{cr.name}</div>
                <span className="tag tag-outline" style={sx("width:fit-content;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{cr.campaign}</span>
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
      )}
    </div>
  );
}
