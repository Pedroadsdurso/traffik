"use client";

import type { ReactNode } from "react";

import type { DashboardPrefsDTO } from "@/lib/actions/dashboardPrefs";
import type { ExpenseDTO } from "@/lib/actions/expenses";
import type { AdProfileDTO } from "@/lib/actions/facebook";
import type { NotificationDTO, NotificationSettingsDTO } from "@/lib/actions/notifications";
import type { PixelConfigDTO } from "@/lib/actions/pixels";
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
  dashboardPrefs,
  initialProfiles,
  initialPixels,
  initialRules,
  initialNotifSettings,
  initialNotifications,
  initialExpenses,
  children,
}: {
  user?: SidebarUser;
  trackingId?: string;
  appUrl?: string;
  initialWebhooks?: WebhookRowDTO[];
  dashboardPrefs?: DashboardPrefsDTO | null;
  initialProfiles?: AdProfileDTO[];
  initialPixels?: PixelConfigDTO[];
  initialRules?: RuleDTO[];
  initialNotifSettings?: NotificationSettingsDTO;
  initialNotifications?: NotificationDTO[];
  initialExpenses?: ExpenseDTO[];
  children: ReactNode;
}) {
  const v = useTraffikState({
    trackingId,
    appUrl,
    initialWebhooks,
    dashboardPrefs,
    initialProfiles,
    initialPixels,
    initialRules,
    initialNotifSettings,
    initialNotifications,
    initialExpenses,
  });

  return (
    <TraffikProvider value={v}>
      <div style={sx("min-height:100vh;display:flex;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)")}>
        <Sidebar user={user} />
        <div style={sx("flex:1;min-width:0;padding:var(--space-8);display:flex;flex-direction:column;gap:var(--space-6);overflow:auto")}>
          <Header />
          {children}
        </div>
        <EditDashboardDrawer v={v} />
      </div>
    </TraffikProvider>
  );
}
