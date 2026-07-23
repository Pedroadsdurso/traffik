import { auth } from "@/auth";
import { TraffikApp } from "@/components/dashboard/TraffikApp";
import { loadDashboardPrefs } from "@/lib/actions/dashboardPrefs";
import { listWebhooks } from "@/lib/actions/webhooks";
import { getAppUrl } from "@/lib/appUrl";

export default async function DashboardPage() {
  const session = await auth();
  const [webhooks, prefs] = await Promise.all([listWebhooks(), loadDashboardPrefs()]);
  return (
    <TraffikApp
      user={{ name: session?.user?.name, email: session?.user?.email }}
      trackingId={session?.user?.id}
      appUrl={getAppUrl()}
      initialWebhooks={webhooks}
      dashboardPrefs={prefs}
    />
  );
}
