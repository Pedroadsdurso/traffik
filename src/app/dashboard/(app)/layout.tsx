import type { ReactNode } from "react";

import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { listApiCredentials } from "@/lib/actions/apiCredentials";
import { loadDashboardPrefs } from "@/lib/actions/dashboardPrefs";
import { listExpenses } from "@/lib/actions/expenses";
import { listAdProfiles } from "@/lib/actions/facebook";
import { getNotificationSettings, listNotifications } from "@/lib/actions/notifications";
import { listPixels } from "@/lib/actions/pixels";
import { getMyTimezone } from "@/lib/actions/profile";
import { listRules } from "@/lib/actions/rules";
import { listWebhooks } from "@/lib/actions/webhooks";
import { getLastWorkspaceId, listWorkspaces } from "@/lib/actions/workspaces";
import { getAppUrl } from "@/lib/appUrl";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Tudo em paralelo: o layout é o caminho crítico de todo carregamento de
  // página, então nenhuma dessas leituras pode virar uma cadeia sequencial.
  const [webhooks, apiCredentials, prefs, profiles, pixels, rules, notifSettings, notifications, expenses, timezone, workspaces, lastWorkspaceId] =
    await Promise.all([
      listWebhooks(),
      listApiCredentials(),
      loadDashboardPrefs(),
      listAdProfiles(),
      listPixels(),
      listRules(),
      getNotificationSettings(),
      listNotifications(),
      listExpenses(),
      getMyTimezone(),
      listWorkspaces(),
      getLastWorkspaceId(),
    ]);

  return (
    <DashboardShell
      user={{ name: session?.user?.name, email: session?.user?.email }}
      trackingId={session?.user?.id}
      appUrl={getAppUrl()}
      initialWebhooks={webhooks}
      initialApiCredentials={apiCredentials}
      dashboardPrefs={prefs}
      initialProfiles={profiles}
      initialPixels={pixels}
      initialRules={rules}
      initialNotifSettings={notifSettings}
      initialNotifications={notifications.items}
      initialExpenses={expenses}
      timezone={timezone}
      workspaces={workspaces}
      lastWorkspaceId={lastWorkspaceId}
    >
      {children}
    </DashboardShell>
  );
}
