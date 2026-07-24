import { sx } from "@/lib/sx";
import type { TraffikView } from "../../useTraffikState";

export function AnunciosView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);max-width:760px")}>
      {v.fbConnected && (
        <div style={sx("display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap")}>
          <button className="btn btn-primary" type="button" onClick={v.runSync} disabled={v.syncBusy}>
            {v.syncBusy ? "Sincronizando…" : "Sincronizar agora"}
          </button>
          {v.syncResult && <span className="text-muted" style={sx("font-size:13px")}>{v.syncResult}</span>}
        </div>
      )}

      {!v.fbConnected && (
        <div className="card elev-sm">
          <div className="card-title">Conectar conta do Facebook Ads</div>
          <p className="card-body">Conecte via Marketing API para puxar campanhas, gasto e métricas automaticamente. Pediremos as permissões <code>ads_read</code> e <code>ads_management</code>.</p>
          <a className="btn btn-primary btn-block" href={v.connectHref}>Conectar com Facebook</a>
        </div>
      )}

      {v.adProfiles.map((p) => (
        <div className="card" key={p.id} style={sx("gap:var(--space-2)")}>
          <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
            <button
              type="button"
              onClick={p.toggleExpanded}
              style={sx("display:flex;align-items:center;gap:10px;background:none;border:none;color:inherit;cursor:pointer;padding:0;text-align:left")}
            >
              <span style={sx("display:inline-flex;transition:transform .15s;transform:rotate(" + (p.expanded ? "90" : "0") + "deg)")}>
                <svg viewBox="0 0 256 256" width="12" height="12" fill="currentColor"><path d="M96 60 L176 128 L96 196 Z" /></svg>
              </span>
              {p.pictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.pictureUrl} alt="" width={30} height={30} style={sx("border-radius:50%")} />
              ) : (
                <span style={sx("width:30px;height:30px;border-radius:50%;background:var(--color-accent-800);color:var(--color-accent-100);display:grid;place-items:center;font-size:12px")}>{p.name.charAt(0)}</span>
              )}
              <span>
                <span className="card-title" style={sx("font-size:15px")}>{p.name} ({p.accountCount})</span>
                {p.email && <span className="card-meta" style={sx("display:block")}>{p.email}</span>}
              </span>
            </button>
            <button className="btn btn-ghost" type="button" onClick={p.disconnect} style={sx("font-size:13px")}>Desconectar</button>
          </div>

          {p.expanded && (
            <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:var(--space-2)")}>
              {p.accounts.length === 0 ? (
                <div className="text-muted" style={sx("font-size:13px;padding:var(--space-2)")}>Nenhuma conta de anúncio neste perfil.</div>
              ) : (
                p.accounts.map((ac) => (
                  <div key={ac.id} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--color-bg)")}>
                    <div style={sx("min-width:0")}>
                      <div style={sx("font-size:14px;display:flex;align-items:center;gap:8px")}>
                        {ac.name}
                        <span className={ac.statusTag}>{ac.statusLabel}</span>
                      </div>
                      <div className="card-meta">act_{ac.fbAccountId} · {ac.currency}</div>
                    </div>
                    <div style={sx("display:flex;align-items:center;gap:10px;flex-shrink:0")}>
                      <span className="text-muted" style={sx("font-size:12px")}>Rastrear</span>
                      <button className="sw" role="switch" aria-checked={ac.trackingOn} onClick={ac.toggleTracking} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}

      {v.fbConnected && (
        <a className="btn btn-secondary" href={v.connectHref} style={sx("width:fit-content")}>+ Adicionar perfil</a>
      )}
    </div>
  );
}
