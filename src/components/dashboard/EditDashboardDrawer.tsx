import { sx } from "@/lib/sx";
import type { TraffikView } from "./useTraffikState";

export function EditDashboardDrawer({ v }: { v: TraffikView }) {
  if (!v.editDashOpen) return null;
  return (
    <>
      <div style={sx("position:fixed;inset:0;z-index:40;background:color-mix(in srgb, var(--color-neutral-900) 55%, transparent)")} onClick={v.closeEditDash} />
      <div
        style={sx(
          "position:fixed;top:0;right:0;bottom:0;z-index:50;width:340px;background:var(--color-surface);border-left:1px solid var(--color-divider);box-shadow:var(--shadow-lg);padding:var(--space-6);display:flex;flex-direction:column;gap:var(--space-3);overflow:auto;animation:drawer-in .2s ease"
        )}
      >
        <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
          <div>
            <div className="card-title">Editar dashboard</div>
            <div className="text-muted" style={sx("font-size:12px")}>Escolha e reordene os cards de métrica</div>
          </div>
          <button className="btn btn-ghost btn-icon" type="button" onClick={v.closeEditDash} aria-label="Fechar">
            <svg viewBox="0 0 256 256" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={18} strokeLinecap="round">
              <line x1="64" y1="64" x2="192" y2="192" />
              <line x1="192" y1="64" x2="64" y2="192" />
            </svg>
          </button>
        </div>
        <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:var(--space-2)")}>
          {v.metricList.map((m) => (
            <div key={m.key} style={sx("display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--color-bg)")}>
              <button className="sw" role="switch" aria-checked={m.on} onClick={m.toggle} />
              <span style={sx(`flex:1;font-size:14px;${m.on ? "" : "opacity:.45"}`)}>{m.label}</span>
              <button className="btn btn-ghost btn-icon" style={sx("width:26px;height:26px")} type="button" onClick={m.moveUp} aria-label="Subir">
                <svg viewBox="0 0 256 256" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={20} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="64,160 128,96 192,160" />
                </svg>
              </button>
              <button className="btn btn-ghost btn-icon" style={sx("width:26px;height:26px")} type="button" onClick={m.moveDown} aria-label="Descer">
                <svg viewBox="0 0 256 256" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={20} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="64,96 128,160 192,96" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
