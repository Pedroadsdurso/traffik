"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/tk/Badge";
import { Greeting } from "@/components/tk/Greeting";
import type { SidebarUser } from "./Sidebar";
import { useTheme } from "@/components/theme/ThemeProvider";
import { sx } from "@/lib/sx";
import { Icone } from "./ui/Icone";
import { useTraffik } from "./TraffikContext";

const TITLES: [test: (p: string) => boolean, title: string, subtitle: string][] = [
  [(p) => p.startsWith("/dashboard/gerenciador"), "Gerenciador de Anúncios", "Administre campanhas, conjuntos e anúncios do Facebook Ads"],
  [(p) => p.startsWith("/dashboard/criativos"), "Ranking de Criativos", "Os anúncios com melhor performance hoje"],
  [(p) => p.startsWith("/dashboard/regras"), "Regras de Automação", "Automatize pausas, escalas e alertas por condição"],
  [(p) => p.startsWith("/dashboard/notificacoes"), "Notificações", "Alertas de venda e relatórios programados"],
  [(p) => p.startsWith("/dashboard/taxas"), "Taxas e Despesas", "Configure custos para um cálculo de lucro preciso"],
  [(p) => p.startsWith("/dashboard/integracoes"), "Integrações", "Contas, webhooks, UTMs, pixel e testes de integração"],
  [(p) => p.startsWith("/dashboard/areas"), "Áreas de Trabalho", "Separe operações diferentes sem misturar os números"],
];

function titleFor(pathname: string): [string, string] {
  for (const [test, title, subtitle] of TITLES) if (test(pathname)) return [title, subtitle];
  return ["Dashboard", "Visão geral do tráfego, vendas e retorno em tempo real"];
}

export function Header({ user }: { user?: SidebarUser }) {
  const v = useTraffik();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [title, subtitle] = titleFor(pathname);

  return (
    <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4)")}>
      {/* A saudação é EXCLUSIVA do Dashboard. As outras telas mantêm o título
          próprio: "Bom dia, Pedro" em cima de Taxas e Despesas não diz onde a
          pessoa está, e o título é a única coisa que diz. */}
      {pathname === "/dashboard" ? (
        <Greeting nome={user?.name} email={user?.email} subtitulo={subtitle} />
      ) : (
      <div style={sx("min-width:0")}>
        {/* `.text-display` (28/34) no lugar do `h1` de 42px do sistema antigo.
            Num painel denso o título não é o herói da tela — o número é. */}
        <h1 className="text-display text-text" style={sx("margin:0")}>{title}</h1>
        <p className="text-body text-text-secondary" style={sx("margin:2px 0 0")}>{subtitle}</p>

        {/* ⛔ NÃO reintroduzir um selo de área aqui. O seletor da sidebar já diz
            em qual área o usuário está, e ele fica visível em toda tela — o selo
            repetia essa informação em cima de cada página sem acrescentar nada.
            Removido a pedido do usuário em 29/07/2026. */}
      </div>
      )}
      <div style={sx("display:flex;align-items:center;gap:12px;flex-shrink:0")}>
        <button
          className="btn btn-secondary btn-icon"
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Alternar para Tema Claro" : "Alternar para Tema Escuro"}
          title={theme === "dark" ? "Tema Claro" : "Tema Escuro"}
        >
          <Icone nome={theme === "dark" ? "temaClaro" : "temaEscuro"} tamanho={18} />
        </button>

        <div style={sx("position:relative")}>
          <button className="btn btn-secondary btn-icon" type="button" onClick={v.toggleNotifOpen} aria-label="Notificações" style={sx("position:relative")}>
            <Icone nome="sino" tamanho={18} />
            {v.notifUnread > 0 && (
              <span className="bg-danger"
                style={sx("position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:var(--tk-radius-pill);color:#fff;font-size:10px;font-weight:600;display:grid;place-items:center")}>
                {v.notifUnread > 9 ? "9+" : v.notifUnread}
              </span>
            )}
          </button>

          {v.notifOpen && (
            <>
              <div style={sx("position:fixed;inset:0;z-index:30")} onClick={v.closeNotif} />
              <div className="bg-surface border border-border"
                style={sx("position:absolute;top:calc(100% + 8px);right:0;z-index:40;width:340px;max-height:440px;overflow:auto;border-radius:var(--tk-radius-painel);box-shadow:var(--tk-shadow-overlay);padding:var(--space-3)")}>
                <div style={sx("display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2)")}>
                  <span className="text-title text-text">Notificações</span>
                  {v.notifUnread > 0 && (
                    <button className="btn btn-ghost" type="button" onClick={v.markAllRead} style={sx("font-size:12px")}>Marcar todas como lidas</button>
                  )}
                </div>
                {v.notifItems.length === 0 ? (
                  <div
                    className="text-muted"
                    style={sx("font-size:12.5px;line-height:1.5;padding:var(--space-3) var(--space-2);text-align:center")}
                  >
                    Nenhuma notificação ainda. Elas chegam aqui quando uma venda entra, uma regra
                    age sozinha ou o relatório do dia fica pronto — você escolhe quais em{" "}
                    <Link href="/dashboard/notificacoes" onClick={v.closeNotif}>Notificações</Link>.
                  </div>
                ) : (
                  v.notifItems.map((n) => (
                    <div key={n.id} style={sx(`display:flex;gap:10px;padding:var(--space-2) var(--space-3);border-radius:var(--tk-radius-controle);${n.read ? "" : "background:var(--tk-surface-hover);"}`)}>
                      <Icone nome={n.icone.nome} tamanho={16} cor={n.icone.cor} />
                      <div style={sx("min-width:0;flex:1")}>
                        <div style={sx("font-size:13px")}>{n.title}</div>
                        <div className="text-muted" style={sx("font-size:12px")}>{n.content}</div>
                        <div className="text-muted" style={sx("font-size:11px;margin-top:2px")}>{n.timeLabel}</div>
                      </div>
                      {!n.read && <span className="bg-primary" style={sx("width:7px;height:7px;border-radius:var(--tk-radius-pill);flex:none;margin-top:6px")} />}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        {/* "Ao vivo" é dado ACONTECENDO — o único lugar do sistema onde o ciano
            (`accent`) é a cor certa, e um dos seis itens da lista fechada do
            glow. O ponto solto que existia antes virou o ponto do próprio selo:
            eram duas coisas dizendo a mesma coisa, lado a lado. */}
        <Badge tom="accent" aoVivo ponto>Ao vivo</Badge>
      </div>
    </div>
  );
}
