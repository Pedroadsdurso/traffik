import { auth } from "@/auth";
import { TraffikApp } from "@/components/dashboard/TraffikApp";
import { loadDashboardPrefs } from "@/lib/actions/dashboardPrefs";
import { listAdProfiles } from "@/lib/actions/facebook";
import { listWebhooks } from "@/lib/actions/webhooks";
import { getAppUrl } from "@/lib/appUrl";

export default async function DashboardPage() {
  const session = await auth();
  const [webhooks, prefs, profiles] = await Promise.all([
    listWebhooks(),
    loadDashboardPrefs(),
    listAdProfiles(),
  ]);
  return (
    <TraffikApp
      user={{ name: session?.user?.name, email: session?.user?.email }}
      trackingId={session?.user?.id}
      appUrl={getAppUrl()}
      initialWebhooks={webhooks}
      dashboardPrefs={prefs}
      initialProfiles={profiles}
    />
  );
}
