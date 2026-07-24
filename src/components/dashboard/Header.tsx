"use client";

import { usePathname } from "next/navigation";

import { sx } from "@/lib/sx";
import { useTraffik } from "./TraffikContext";

const TITLES: [test: (p: string) => boolean, title: string, subtitle: string][] = [
  [(p) => p.startsWith("/dashboard/gerenciador"), "Gerenciador de Anúncios", "Administre campanhas, conjuntos e anúncios do Facebook Ads"],
  [(p) => p.startsWith("/dashboard/criativos"), "Ranking de Criativos", "Os anúncios com melhor performance hoje"],
  [(p) => p.startsWith("/dashboard/regras"), "Regras de Automação", "Automatize pausas, escalas e alertas por condição"],
  [(p) => p.startsWith("/dashboard/notificacoes"), "Notificações", "Alertas de venda e relatórios programados"],
  [(p) => p.startsWith("/dashboard/taxas"), "Taxas e Despesas", "Configure custos para um cálculo de lucro preciso"],
  [(p) => p.startsWith("/dashboard/integracoes"), "Integrações", "Contas, webhooks, UTMs, pixel e testes de integração"],
];

function titleFor(pathname: string): [string, string] {
  for (const [test, title, subtitle] of TITLES) if (test(pathname)) return [title, subtitle];
  return ["Dashboard", "Visão geral do tráfego, vendas e retorno em tempo real"];
}

export function Header() {
  const v = useTraffik();
  const pathname = usePathname();
  const [title, subtitle] = titleFor(pathname);

  return (
    <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4)")}>
      <div>
        <h1 style={sx("margin:0")}>{title}</h1>
        <p style={sx("margin:0;opacity:.65;font-size:14px")}>{subtitle}</p>
      </div>
      <div style={sx("display:flex;align-items:center;gap:12px;flex-shrink:0")}>
        <div style={sx("position:relative")}>
          <button className="btn btn-secondary btn-icon" type="button" onClick={v.toggleNotifOpen} aria-label="Notificações" style={sx("position:relative")}>
            <svg viewBox="0 0 256 256" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round">
              <path d="M128 32 a56 56 0 00-56 56 c0 46 -24 58 -24 72 h160 c0 -14 -24 -26 -24 -72 a56 56 0 00-56 -56 Z" />
              <path d="M104 216 a24 24 0 0048 0" />
            </svg>
            {v.notifUnread > 0 && (
              <span style={sx("position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--color-accent);color:var(--color-bg);font-size:10px;font-weight:700;display:grid;place-items:center")}>
                {v.notifUnread > 9 ? "9+" : v.notifUnread}
              </span>
            )}
          </button>

          {v.notifOpen && (
            <>
              <div style={sx("position:fixed;inset:0;z-index:30")} onClick={v.closeNotif} />
              <div style={sx("position:absolute;top:calc(100% + 8px);right:0;z-index:40;width:340px;max-height:440px;overflow:auto;background:var(--color-surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:var(--space-3)")}>
                <div style={sx("display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2)")}>
                  <span className="card-title" style={sx("font-size:15px")}>Notificações</span>
                  {v.notifUnread > 0 && (
                    <button className="btn btn-ghost" type="button" onClick={v.markAllRead} style={sx("font-size:12px")}>Marcar todas como lidas</button>
                  )}
                </div>
                {v.notifItems.length === 0 ? (
                  <div className="text-muted" style={sx("font-size:13px;padding:var(--space-3) 0;text-align:center")}>Nenhuma notificação ainda.</div>
                ) : (
                  v.notifItems.map((n) => (
                    <div key={n.id} style={sx(`display:flex;gap:10px;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);${n.read ? "" : "background:var(--color-bg);"}`)}>
                      <span style={sx("font-size:16px;flex:none")}>{n.icon}</span>
                      <div style={sx("min-width:0;flex:1")}>
                        <div style={sx("font-size:13px")}>{n.title}</div>
                        <div className="text-muted" style={sx("font-size:12px")}>{n.content}</div>
                        <div className="text-muted" style={sx("font-size:11px;margin-top:2px")}>{n.timeLabel}</div>
                      </div>
                      {!n.read && <span style={sx("width:7px;height:7px;border-radius:50%;background:var(--color-accent);flex:none;margin-top:6px")} />}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <span style={sx("width:7px;height:7px;border-radius:50%;background:var(--color-accent);animation:pulse-dot 1.6s ease-in-out infinite")} />
        <span className="tag tag-outline">Ao vivo</span>
      </div>
    </div>
  );
}
