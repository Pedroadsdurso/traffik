import { sx } from "@/lib/sx";
import type { TraffikView } from "../../useTraffikState";

type Profile = TraffikView["adProfiles"][number];

function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} style={sx(`border-radius:50%;object-fit:cover;flex:none`)} />;
  }
  return (
    <span style={sx(`width:${size}px;height:${size}px;flex:none;border-radius:50%;background:var(--color-accent-800);color:var(--color-accent-100);display:grid;place-items:center;font-family:var(--font-heading);font-size:${Math.round(size / 2.4)}px`)}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Card compacto (tile da vitrine) — clica para expandir. */
function ProfileTile({ p }: { p: Profile }) {
  return (
    <button
      type="button"
      onClick={p.toggleExpanded}
      className="card"
      style={sx("align-items:center;text-align:center;gap:var(--space-2);padding:var(--space-4);cursor:pointer;border:none")}
    >
      <Avatar url={p.pictureUrl} name={p.name} size={56} />
      <div className="card-title" style={sx("font-size:15px;line-height:1.2")}>{p.name}</div>
      <div className="card-meta">{p.accountCount} {p.accountCount === 1 ? "conta" : "contas"}</div>
      {p.trackedCount > 0 && <span className="tag tag-accent" style={sx("font-size:10px")}>{p.trackedCount} rastreando</span>}
      <span className="text-muted" style={sx("font-size:11px;margin-top:2px")}>Clique para ver contas</span>
    </button>
  );
}

/** Painel expandido (largura total) com a lista de contas do perfil. */
function ProfilePanel({ p }: { p: Profile }) {
  return (
    <div className="card" style={sx("grid-column:1/-1;gap:var(--space-3)")}>
      <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap")}>
        <button
          type="button"
          onClick={p.toggleExpanded}
          style={sx("display:flex;align-items:center;gap:10px;background:none;border:none;color:inherit;cursor:pointer;padding:0;text-align:left")}
        >
          <span style={sx("display:inline-flex;transform:rotate(90deg)")}>
            <svg viewBox="0 0 256 256" width="12" height="12" fill="currentColor"><path d="M96 60 L176 128 L96 196 Z" /></svg>
          </span>
          <Avatar url={p.pictureUrl} name={p.name} size={34} />
          <span>
            <span className="card-title" style={sx("font-size:15px")}>{p.name} ({p.accountCount})</span>
            {p.email && <span className="card-meta" style={sx("display:block")}>{p.email}</span>}
          </span>
        </button>
        <div style={sx("display:flex;align-items:center;gap:var(--space-3)")}>
          <div style={sx("display:flex;align-items:center;gap:8px")}>
            <span className="text-muted" style={sx("font-size:12px")}>Ativar todas</span>
            <button className="sw" role="switch" aria-checked={p.allTracked} onClick={p.setAllTracking} />
          </div>
          <button className="btn btn-ghost" type="button" onClick={p.disconnect} style={sx("font-size:13px")}>Desconectar</button>
        </div>
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:6px")}>
        {p.accounts.length === 0 ? (
          <div className="text-muted" style={sx("font-size:13px;padding:var(--space-2)")}>Nenhuma conta de anúncio neste perfil.</div>
        ) : (
          p.accounts.map((ac) => (
            <div key={ac.id} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--color-bg);flex-wrap:wrap")}>
              <div style={sx("min-width:0")}>
                <div style={sx("font-size:14px;display:flex;align-items:center;gap:8px")}>
                  {ac.name}
                  <span className={ac.statusTag}>{ac.statusLabel}</span>
                </div>
                <div className="card-meta">act_{ac.fbAccountId} · {ac.currency}</div>
              </div>
              <div style={sx("display:flex;align-items:center;gap:12px;flex-shrink:0")}>
                {ac.syncMsg && <span className="text-muted" style={sx("font-size:11px")}>{ac.syncMsg}</span>}
                <button className="btn btn-secondary" type="button" onClick={ac.sync} disabled={ac.syncBusy} style={sx("font-size:12px;padding:5px 9px")}>
                  {ac.syncBusy ? "Sincronizando…" : "Sincronizar"}
                </button>
                <div style={sx("display:flex;align-items:center;gap:8px")}>
                  <span className="text-muted" style={sx("font-size:12px")}>Rastrear</span>
                  <button className="sw" role="switch" aria-checked={ac.trackingOn} onClick={ac.toggleTracking} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function AnunciosView({ v }: { v: TraffikView }) {
  if (!v.fbConnected) {
    return (
      <div style={sx("max-width:420px")}>
        <div className="card elev-sm" style={sx("align-items:center;text-align:center;gap:var(--space-3);padding:var(--space-6)")}>
          <span style={sx("width:56px;height:56px;border-radius:var(--radius-lg);background:var(--color-accent-800);color:var(--color-accent-100);display:grid;place-items:center")}>
            <svg viewBox="0 0 256 256" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round">
              <path d="M96 72 a56 56 0 100 112 a56 56 0 100 -112 M160 72 a56 56 0 100 112 a56 56 0 100 -112" />
            </svg>
          </span>
          <div className="card-title">Conectar Facebook Ads</div>
          <p className="card-body" style={sx("text-align:center")}>Conecte via Marketing API para puxar campanhas, gasto e métricas. Pediremos as permissões <code>ads_read</code> e <code>ads_management</code>.</p>
          <a className="btn btn-primary btn-block" href={v.connectHref}>Conectar</a>
        </div>
      </div>
    );
  }

  const expanded = v.adProfiles.filter((p) => p.expanded);
  const collapsed = v.adProfiles.filter((p) => !p.expanded);

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
      <div style={sx("display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap")}>
        <button className="btn btn-primary" type="button" onClick={v.runSync} disabled={v.syncBusy}>
          {v.syncBusy ? "Sincronizando…" : "Sincronizar tudo"}
        </button>
        {v.syncResult && <span className="text-muted" style={sx("font-size:13px")}>{v.syncResult}</span>}
      </div>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-4);align-items:start")}>
        {/* Perfis expandidos ocupam a linha inteira */}
        {expanded.map((p) => <ProfilePanel key={p.id} p={p} />)}
        {/* Perfis recolhidos como tiles da vitrine */}
        {collapsed.map((p) => <ProfileTile key={p.id} p={p} />)}
        {/* Tile de adicionar perfil */}
        <a
          href={v.connectHref}
          className="card"
          style={sx("align-items:center;justify-content:center;gap:8px;padding:var(--space-4);min-height:160px;cursor:pointer;text-decoration:none;color:var(--color-accent);border:1px dashed var(--color-accent)")}
        >
          <span style={sx("font-size:28px;line-height:1")}>+</span>
          <span style={sx("font-size:13px")}>Adicionar perfil</span>
        </a>
      </div>
    </div>
  );
}
