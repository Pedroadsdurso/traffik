"use client";

import Image from "next/image";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTheme } from "@/components/theme/ThemeProvider";
import { logoutAction } from "@/lib/actions/session";
import { sx } from "@/lib/sx";
import { Icone, type NomeIcone } from "./ui/Icone";
import { useTraffik } from "./TraffikContext";
import { WorkspaceSelect } from "./ui/WorkspaceSelect";

export type SidebarUser = { name?: string | null; email?: string | null };

interface NavItem {
  href: string;
  label: string;
  /**
   * ⚠️ Nome no mapa de `ui/Icone`, **não um `path` de SVG**. Antes era a string
   * de desenho (`"M40 40 h72…"`), o que fazia cada item da navegação carregar o
   * próprio ícone à mão, fora de qualquer padronização de tamanho e traço.
   */
  icon: NomeIcone;
  exact?: boolean;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Análise",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "painel", exact: true },
      { href: "/dashboard/gerenciador", label: "Gerenciador de Anúncios", icon: "gerenciador" },
      { href: "/dashboard/criativos", label: "Criativos", icon: "criativos" },
    ],
  },
  {
    group: "Automação",
    items: [
      { href: "/dashboard/regras", label: "Regras", icon: "regras" },
      { href: "/dashboard/notificacoes", label: "Notificações", icon: "sino" },
    ],
  },
  {
    group: "Configurações",
    items: [
      { href: "/dashboard/integracoes", label: "Integrações", icon: "integracoes" },
      { href: "/dashboard/taxas", label: "Taxas e Despesas", icon: "taxas" },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function Sidebar({ user }: { user?: SidebarUser }) {
  const v = useTraffik();
  const { theme } = useTheme();
  const pathname = usePathname();

  return (
    <div
      style={sx(
        "width:236px;flex-shrink:0;background:var(--color-surface);border-right:1px solid var(--color-divider);padding:var(--space-6) var(--space-4);display:flex;flex-direction:column;gap:var(--space-4);position:sticky;top:0;height:100vh;overflow:auto",
      )}
    >
      {/* Wordmark ocupando a largura útil da sidebar, como referência de marca. */}
      <Image
        src={theme === "light" ? "/logos/traffik-escuro.webp" : "/logos/traffik-claro.webp"}
        alt={v.brandName}
        width={904}
        height={230}
        priority
        style={{ width: "100%", maxWidth: 184, height: "auto", objectFit: "contain" }}
      />

      {/* Seletor de Área de Trabalho — sempre visível, logo abaixo da marca.
          É o controle que muda o contexto de TODA a ferramenta, então precisa
          estar acima da navegação, não perdido dentro de uma página. */}
      <WorkspaceSelect areas={v.workspaces} ativa={v.workspaceAtiva} onTrocar={v.trocarWorkspace} />

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
                  <Icone nome={n.icon} tamanho={18} />
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
              <Icone nome="sair" tamanho={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
