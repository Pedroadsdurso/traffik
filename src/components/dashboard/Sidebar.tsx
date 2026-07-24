"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/lib/actions/session";
import { sx } from "@/lib/sx";
import { NavIcon } from "./Icon";
import { useTraffik } from "./TraffikContext";

export type SidebarUser = { name?: string | null; email?: string | null };

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Análise",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "M40 40 h72 v72 h-72 Z M144 40 h72 v72 h-72 Z M40 144 h72 v72 h-72 Z M144 144 h72 v72 h-72 Z", exact: true },
      { href: "/dashboard/gerenciador", label: "Gerenciador de Anúncios", icon: "M128 40 a88 88 0 100 176 a88 88 0 100 -176 M128 80 a48 48 0 100 96 a48 48 0 100 -96" },
      { href: "/dashboard/criativos", label: "Criativos", icon: "M32 56 h192 v144 h-192 Z M32 176 L92 128 L140 160 L176 120 L224 164" },
    ],
  },
  {
    group: "Automação",
    items: [
      { href: "/dashboard/regras", label: "Regras", icon: "M144 24 L48 144 h64 l-16 88 96 -128 h-64 Z" },
      { href: "/dashboard/notificacoes", label: "Notificações", icon: "M128 32 a56 56 0 00-56 56 c0 46 -24 58 -24 72 h160 c0 -14 -24 -26 -24 -72 a56 56 0 00-56 -56 Z M104 216 a24 24 0 0048 0" },
    ],
  },
  {
    group: "Configurações",
    items: [
      { href: "/dashboard/integracoes", label: "Integrações", icon: "M96 72 a56 56 0 100 112 a56 56 0 100 -112 M160 72 a56 56 0 100 112 a56 56 0 100 -112" },
      { href: "/dashboard/taxas", label: "Taxas e Despesas", icon: "M72 184 L184 72 M80 56 a24 24 0 100 48 a24 24 0 100 -48 M176 152 a24 24 0 100 48 a24 24 0 100 -48" },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function Sidebar({ user }: { user?: SidebarUser }) {
  const v = useTraffik();
  const pathname = usePathname();

  return (
    <div
      style={sx(
        "width:236px;flex-shrink:0;background:var(--color-surface);border-right:1px solid var(--color-divider);padding:var(--space-6) var(--space-4);display:flex;flex-direction:column;gap:var(--space-4);position:sticky;top:0;height:100vh;overflow:auto",
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
        {NAV.map((grp) => (
          <div key={grp.group}>
            <div style={sx("font-size:10px;text-transform:uppercase;letter-spacing:.1em;opacity:.4;padding:var(--space-2) var(--space-3) 2px")}>{grp.group}</div>
            {grp.items.map((n) => {
              const active = isActive(pathname, n);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="nav-item"
                  style={sx(
                    `display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border-radius:var(--radius-md);cursor:pointer;font-size:14px;text-decoration:none;${
                      active ? "background: var(--color-accent-800); color: var(--color-accent-100);" : "color: var(--color-text); opacity: .85;"
                    }`,
                  )}
                >
                  <NavIcon path={n.icon} />
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
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
