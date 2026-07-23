import { logoutAction } from "@/lib/actions/session";
import { sx } from "@/lib/sx";
import { NavIcon } from "./Icon";
import type { TraffikView } from "./useTraffikState";

export type SidebarUser = { name?: string | null; email?: string | null };

type NavGroupItem = TraffikView["navAnalise"][number];

function NavGroup({ title, items }: { title: string; items: NavGroupItem[] }) {
  return (
    <>
      <div style={sx("font-size:10px;text-transform:uppercase;letter-spacing:.1em;opacity:.4;padding:var(--space-2) var(--space-3) 2px")}>{title}</div>
      {items.map((n) => (
        <div
          key={n.key}
          onClick={n.go}
          className="nav-item"
          style={sx(
            `display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border-radius:var(--radius-md);cursor:pointer;font-size:14px;${
              n.active ? "background: var(--color-accent-800); color: var(--color-accent-100);" : "color: var(--color-text); opacity: .85;"
            }`
          )}
        >
          <NavIcon path={n.icon} />
          <span>{n.label}</span>
        </div>
      ))}
    </>
  );
}

export function Sidebar({ v, user }: { v: TraffikView; user?: SidebarUser }) {
  return (
    <div
      style={sx(
        "width:236px;flex-shrink:0;background:var(--color-surface);border-right:1px solid var(--color-divider);padding:var(--space-6) var(--space-4);display:flex;flex-direction:column;gap:var(--space-4);position:sticky;top:0;height:100vh;overflow:auto"
      )}
    >
      <div style={sx("display:flex;align-items:center;gap:var(--space-3)")}>
        <div style={sx("width:34px;height:34px;border-radius:var(--radius-md);border:1px solid var(--color-accent);color:var(--color-accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-heading);font-weight:600;font-size:15px")}>
          {v.brandInitial}
        </div>
        <div>
          <div style={sx("font-family:var(--font-heading);font-weight:500;font-size:16px;line-height:1.1")}>{v.brandName}</div>
          <div style={sx("font-size:11px;color:var(--color-text);opacity:.55")}>Analytics de tráfego</div>
        </div>
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:2px;margin-top:var(--space-2)")}>
        <NavGroup title="Análise" items={v.navAnalise} />
        <NavGroup title="Automação" items={v.navAuto} />
        <NavGroup title="Configurações" items={v.navConfig} />
      </div>

      <div style={sx("margin-top:auto;padding:var(--space-3);border-radius:var(--radius-md);background:var(--color-bg);display:flex;flex-direction:column;gap:6px")}>
        <div style={sx("font-size:11px;opacity:.55;text-transform:uppercase;letter-spacing:.08em")}>Conta de anúncios</div>
        {v.fbConnected ? (
          <span className="tag tag-accent" style={sx("width:fit-content")}>Conectado · {v.activeAccountCount}</span>
        ) : (
          <span className="tag tag-neutral" style={sx("width:fit-content")}>Não conectado</span>
        )}
      </div>

      {user && (
        <div style={sx("padding-top:var(--space-3);border-top:1px solid var(--color-divider);display:flex;align-items:center;gap:var(--space-3)")}>
          <div style={sx("width:30px;height:30px;flex:none;border-radius:50%;background:var(--color-accent-800);color:var(--color-accent-100);display:grid;place-items:center;font-size:12px;font-family:var(--font-heading)")}>
            {(user.name || user.email || "?").charAt(0).toUpperCase()}
          </div>
          <div style={sx("min-width:0;flex:1")}>
            <div style={sx("font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{user.name ?? "Sem nome"}</div>
            <div style={sx("font-size:11px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{user.email}</div>
          </div>
          <form action={logoutAction}>
            <button className="btn btn-ghost" type="submit" title="Sair" aria-label="Sair" style={sx("padding:4px")}>
              <svg viewBox="0 0 256 256" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round">
                <path d="M112 216H48a8 8 0 01-8-8V48a8 8 0 018-8h64" />
                <path d="M176 176l40-48-40-48" />
                <path d="M216 128H104" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
