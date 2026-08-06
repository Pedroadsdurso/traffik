"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

import type { DashboardPrefsDTO } from "@/lib/actions/dashboardPrefs";
import type { ExpenseDTO } from "@/lib/actions/expenses";
import type { AdProfileDTO } from "@/lib/actions/facebook";
import type { NotificationDTO, NotificationSettingsDTO } from "@/lib/actions/notifications";
import type { PixelConfigDTO } from "@/lib/actions/pixels";
import type { RuleDTO } from "@/lib/actions/rules";
import type { ApiCredentialDTO } from "@/lib/actions/apiCredentials";
import type { WebhookRowDTO } from "@/lib/actions/webhooks";
import type { WorkspaceDTO } from "@/lib/actions/workspaces";
import { sx } from "@/lib/sx";
import { Header } from "./Header";
import { Sidebar, type SidebarUser } from "./Sidebar";
import { TraffikProvider } from "./TraffikContext";
import { useTraffikState } from "./useTraffikState";

export function DashboardShell({
  user,
  trackingId,
  appUrl,
  banco,
  initialWebhooks,
  initialApiCredentials,
  dashboardPrefs,
  initialProfiles,
  initialPixels,
  initialNotifSettings,
  initialNotifications,
  initialExpenses,
  initialRules,
  timezone,
  workspaces,
  lastWorkspaceId,
  children,
}: {
  user?: SidebarUser;
  trackingId?: string;
  appUrl?: string;
  /** Qual banco o servidor está usando — ver `lib/dbEnv.ts`. */
  banco?: { ref: string | null; rotulo: string; producao: boolean; avisar: boolean };
  initialWebhooks?: WebhookRowDTO[];
  initialApiCredentials?: ApiCredentialDTO[];
  dashboardPrefs?: DashboardPrefsDTO | null;
  initialProfiles?: AdProfileDTO[];
  initialPixels?: PixelConfigDTO[];
  initialNotifSettings?: NotificationSettingsDTO;
  initialNotifications?: NotificationDTO[];
  initialExpenses?: ExpenseDTO[];
  /** Regras de automação — o rodapé de estado do Dashboard as conta. */
  initialRules?: RuleDTO[];
  /** Fuso de referência do usuário — ver `src/lib/timezone.ts`. */
  timezone?: string;
  workspaces?: WorkspaceDTO[];
  /** Área lembrada do último acesso. Sem preferência, vem a PRINCIPAL. */
  lastWorkspaceId?: string | null;
  children: ReactNode;
}) {
  // A `key` pelo pathname remonta o nó a cada rota, disparando a animação de
  // entrada de novo — sem isso o React reaproveita o nó e nada anima.
  const pathname = usePathname();

  const v = useTraffikState({
    trackingId,
    appUrl,
    initialWebhooks,
    initialApiCredentials,
    dashboardPrefs,
    initialProfiles,
    initialPixels,
    initialNotifSettings,
    initialNotifications,
    initialExpenses,
    initialRules,
    timezone,
    workspaces,
    lastWorkspaceId,
  });

  return (
    <TraffikProvider value={v}>
      {/* Faixa de ambiente. Aparece quando o banco NÃO é a produção — inclusive
          quando é desconhecido. Nasceu de um teste em localhost que apagou
          configuração real: naquele dia nada na tela dizia em qual banco a
          pessoa estava. */}
      {banco?.avisar && (
        <div
          role="status"
          style={sx(
            "position:fixed;top:0;left:0;right:0;z-index:200;display:flex;align-items:center;justify-content:center;gap:10px;" +
              "padding:5px 12px;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;" +
              "background:repeating-linear-gradient(45deg,#f59e0b,#f59e0b 12px,#b45309 12px,#b45309 24px);color:#1c1300",
          )}
        >
          <span>⚠ {banco.rotulo}</span>
          {banco.ref && <span style={sx("opacity:.75;font-weight:600;letter-spacing:.04em")}>{banco.ref}</span>}
          <span style={sx("opacity:.75;font-weight:600;letter-spacing:.04em;text-transform:none")}>
            os dados desta tela são falsos
          </span>
        </div>
      )}

      {/* `tk-tema` é a ponte para o sistema novo — ver a nota no globals.css.
          Ela fica AQUI, na raiz do shell, e não na página: a moldura (rail +
          cabeçalho) é o que se vê primeiro, e moldura antiga em volta de tela
          nova tem costura pior do que o contrário. */}
      <div
        className="tk-tema"
        style={sx(`min-height:100vh;display:flex;${banco?.avisar ? "padding-top:26px" : ""}`)}
      >
        <Sidebar user={user} />
        <div style={sx("flex:1;min-width:0;padding:var(--space-6) var(--space-8);display:flex;flex-direction:column;gap:var(--space-6);overflow:auto")}>
          <Header user={user} />
          <div key={pathname} className="page-enter" style={sx("display:flex;flex-direction:column;gap:var(--space-6)")}>
            {children}
          </div>
        </div>
      </div>
    </TraffikProvider>
  );
}
