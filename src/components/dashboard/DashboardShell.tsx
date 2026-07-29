"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

import type { DashboardPrefsDTO } from "@/lib/actions/dashboardPrefs";
import type { ExpenseDTO } from "@/lib/actions/expenses";
import type { AdProfileDTO } from "@/lib/actions/facebook";
import type { NotificationDTO, NotificationSettingsDTO } from "@/lib/actions/notifications";
import type { PixelConfigDTO } from "@/lib/actions/pixels";
import type { ApiCredentialDTO } from "@/lib/actions/apiCredentials";
import type { RuleDTO } from "@/lib/actions/rules";
import type { WebhookRowDTO } from "@/lib/actions/webhooks";
import type { WorkspaceDTO } from "@/lib/actions/workspaces";
import { sx } from "@/lib/sx";
import { EditDashboardDrawer } from "./EditDashboardDrawer";
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
  initialRules,
  initialNotifSettings,
  initialNotifications,
  initialExpenses,
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
  initialRules?: RuleDTO[];
  initialNotifSettings?: NotificationSettingsDTO;
  initialNotifications?: NotificationDTO[];
  initialExpenses?: ExpenseDTO[];
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
    initialRules,
    initialNotifSettings,
    initialNotifications,
    initialExpenses,
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

      <div style={sx(`min-height:100vh;display:flex;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body);${banco?.avisar ? "padding-top:26px" : ""}`)}>
        <Sidebar user={user} />
        <div style={sx("flex:1;min-width:0;padding:var(--space-8);display:flex;flex-direction:column;gap:var(--space-6);overflow:auto")}>
          <Header />
          <div key={pathname} className="page-enter" style={sx("display:flex;flex-direction:column;gap:var(--space-6)")}>
            {children}
          </div>
        </div>
        <EditDashboardDrawer v={v} />
      </div>
    </TraffikProvider>
  );
}
