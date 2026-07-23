import { auth } from "@/auth";
import { TraffikApp } from "@/components/dashboard/TraffikApp";
import { loadDashboardPrefs } from "@/lib/actions/dashboardPrefs";
import { listAdProfiles } from "@/lib/actions/facebook";
import { listPixels } from "@/lib/actions/pixels";
import { listRules } from "@/lib/actions/rules";
import { listWebhooks } from "@/lib/actions/webhooks";
import { getAppUrl } from "@/lib/appUrl";

export default async function DashboardPage() {
  const session = await auth();
  const [webhooks, prefs, profiles, pixels, rules] = await Promise.all([
    listWebhooks(),
    loadDashboardPrefs(),
    listAdProfiles(),
    listPixels(),
    listRules(),
  ]);
  return (
    <TraffikApp
      user={{ name: session?.user?.name, email: session?.user?.email }}
      trackingId={session?.user?.id}
      appUrl={getAppUrl()}
      initialWebhooks={webhooks}
      dashboardPrefs={prefs}
      initialProfiles={profiles}
      initialPixels={pixels}
      initialRules={rules}
    />
  );
}
