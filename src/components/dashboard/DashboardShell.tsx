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
  children,
}: {
  user?: SidebarUser;
  trackingId?: string;
  appUrl?: string;
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
  });

  return (
    <TraffikProvider value={v}>
      <div style={sx("min-height:100vh;display:flex;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)")}>
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
