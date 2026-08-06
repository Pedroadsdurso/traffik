import type { ReactNode } from "react";

import { auth } from "@/auth";
import { AppShell } from "@/components/tk/AppShell";
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
import { bancoAtual } from "@/lib/dbEnv";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Tudo em paralelo: o layout é o caminho crítico de todo carregamento de
  // página, então nenhuma dessas leituras pode virar uma cadeia sequencial.
  const [webhooks, apiCredentials, prefs, profiles, pixels, notifSettings, notifications, expenses, timezone, workspaces, lastWorkspaceId, rules] =
    await Promise.all([
      listWebhooks(),
      listApiCredentials(),
      loadDashboardPrefs(),
      listAdProfiles(),
      listPixels(),
      getNotificationSettings(),
      listNotifications(),
      listExpenses(),
      getMyTimezone(),
      listWorkspaces(),
      getLastWorkspaceId(),
      /* 🔁 RELIGADO em 06/08/2026. O `listRules()` rodava aqui em todo pageview
         para preencher um `State.rules` que ninguém lia, e saiu na faxina de
         05/08 por isso. Agora ele tem consumidor de verdade: o rodapé de estado
         do Dashboard ("Regras ativas · N em execução"). */
      listRules(),
    ]);

  return (
    <AppShell
      user={{ name: session?.user?.name, email: session?.user?.email }}
      trackingId={session?.user?.id}
      appUrl={getAppUrl()}
      banco={bancoAtual()}
      initialWebhooks={webhooks}
      initialApiCredentials={apiCredentials}
      dashboardPrefs={prefs}
      initialProfiles={profiles}
      initialPixels={pixels}
      initialNotifSettings={notifSettings}
      initialNotifications={notifications.items}
      initialExpenses={expenses}
      initialRules={rules}
      timezone={timezone}
      workspaces={workspaces}
      lastWorkspaceId={lastWorkspaceId}
    >
      {children}
    </AppShell>
  );
}
