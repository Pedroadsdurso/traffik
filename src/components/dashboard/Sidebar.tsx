"use client";

import Image from "next/image";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTheme } from "@/components/theme/ThemeProvider";
import { logoutAction } from "@/lib/actions/session";
import { sx } from "@/lib/sx";
import { Badge } from "@/components/tk/Badge";
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
      /* `background-alt`, e não `surface`: o rail é a moldura, e a escada de
         elevação do sistema põe a moldura um degrau ABAIXO do card. Com
         `surface` o rail ficava da mesma cor dos cards e a tela virava um bloco
         só. */
      className="bg-background-alt border-r border-border"
      style={sx(
        "width:232px;flex-shrink:0;padding:var(--space-6) var(--space-3);display:flex;flex-direction:column;gap:var(--space-4);position:sticky;top:0;height:100vh;overflow:auto",
      )}
    >
      {/* 🔴 O wordmark estava em `/logos/trackhub-*.webp`, que ainda desenha
          "Traffik" na cor do design ANTIGO. O ativo certo — "track hub", na
          rampa azul do sistema novo — já existia em `/marca/`, gerado por
          `npm run marca:gerar` e commitado, **e não era consumido por
          ninguém**. Sétimo caso do padrão "pronto não é exercido" desta base, e
          o mais visível de todos: era a primeira coisa da tela.

          ⚠️ A CONVENÇÃO DE NOME INVERTEU. Em `/logos/` o sufixo era a cor das
          LETRAS (`claro` = letras claras, para fundo escuro). Em `/marca/` ele é
          o TEMA a que o ativo serve (`claro` = para o tema claro, com letras
          escuras). Trocar um pelo outro dá logotipo invisível — letra escura
          sobre fundo quase preto. */}
      <Image
        src={theme === "light" ? "/marca/wordmark-claro.webp" : "/marca/wordmark-escuro.webp"}
        alt={v.brandName}
        width={764}
        height={192}
        priority
        style={{ width: "100%", maxWidth: 168, height: "auto", objectFit: "contain" }}
      />

      {/* Seletor de Área de Trabalho — sempre visível, logo abaixo da marca.
          É o controle que muda o contexto de TODA a ferramenta, então precisa
          estar acima da navegação, não perdido dentro de uma página. */}
      <WorkspaceSelect areas={v.workspaces} ativa={v.workspaceAtiva} onTrocar={v.trocarWorkspace} />

      <div style={sx("display:flex;flex-direction:column;gap:2px;margin-top:var(--space-2)")}>
        {NAV.map((grp) => (
          <div key={grp.group}>
            <div className="text-micro text-text-muted" style={sx("padding:var(--space-3) var(--space-3) 4px")}>
              {grp.group}
            </div>
            {grp.items.map((n) => {
              const active = isActive(pathname, n);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  /* Item ativo: fundo tingido + BARRA à esquerda. A barra existe
                     porque o tingimento sozinho é fraco demais no tema claro —
                     e porque cor sozinha não pode ser o único sinal de estado
                     (WCAG 1.4.1). O `aria-current` é o que diz isso a quem não
                     vê nenhum dos dois. */
                  aria-current={active ? "page" : undefined}
                  className={`nav-item text-label ${active ? "bg-tint-primary text-primary" : "text-text-secondary"}`}
                  style={sx(
                    "position:relative;display:flex;align-items:center;gap:var(--space-3);padding:8px var(--space-3);" +
                      "border-radius:var(--tk-radius-controle);cursor:pointer;text-decoration:none;" +
                      (active
                        ? "box-shadow:inset 2px 0 0 0 var(--tk-primary);"
                        : ""),
                  )}
                >
                  <Icone nome={n.icon} tamanho={17} />
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div
        className="bg-surface border border-border"
        style={sx("margin-top:auto;padding:var(--space-3);border-radius:var(--tk-radius-card);display:flex;flex-direction:column;gap:8px")}
      >
        <div className="text-micro text-text-muted">Conta de anúncios</div>
        {/* Selo tingido do sistema: `success` quando conectado (é um estado bom,
            não um enfeite azul), `neutral` quando não. */}
        {v.fbConnected ? (
          <Badge tom="success" ponto>Conectado · {v.activeAccountCount}</Badge>
        ) : (
          <Badge tom="neutral">Não conectado</Badge>
        )}
      </div>

      {user && (
        <div className="border-t border-border" style={sx("padding-top:var(--space-3);display:flex;align-items:center;gap:var(--space-3)")}>
          <div
            className="bg-tint-primary text-on-tint-primary text-label"
            style={sx("width:30px;height:30px;flex:none;border-radius:var(--tk-radius-pill);display:grid;place-items:center")}
          >
            {(user.name || user.email || "?").charAt(0).toUpperCase()}
          </div>
          <div style={sx("min-width:0;flex:1")}>
            <div className="text-label text-text" style={sx("white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{user.name ?? "Sem nome"}</div>
            <div className="text-caption text-text-muted" style={sx("white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{user.email}</div>
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
