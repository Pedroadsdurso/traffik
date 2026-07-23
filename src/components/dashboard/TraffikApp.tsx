"use client";

import type { DashboardPrefsDTO } from "@/lib/actions/dashboardPrefs";
import type { AdProfileDTO } from "@/lib/actions/facebook";
import type { PixelConfigDTO } from "@/lib/actions/pixels";
import type { RuleDTO } from "@/lib/actions/rules";
import type { WebhookRowDTO } from "@/lib/actions/webhooks";
import { sx } from "@/lib/sx";
import { EditDashboardDrawer } from "./EditDashboardDrawer";
import { Sidebar, type SidebarUser } from "./Sidebar";
import { useTraffikState } from "./useTraffikState";
import { AdsManagerView } from "./views/AdsManagerView";
import { CreativesView } from "./views/CreativesView";
import { DashboardView } from "./views/DashboardView";
import { FacebookView } from "./views/FacebookView";
import { FeesView } from "./views/FeesView";
import { NotificationsView } from "./views/NotificationsView";
import { RulesView } from "./views/RulesView";
import { UtmView } from "./views/UtmView";

export function TraffikApp({
  brandName = "Traffik",
  liveUpdates = true,
  user,
  trackingId,
  appUrl,
  initialWebhooks,
  dashboardPrefs,
  initialProfiles,
  initialPixels,
  initialRules,
}: {
  brandName?: string;
  liveUpdates?: boolean;
  user?: SidebarUser;
  trackingId?: string;
  appUrl?: string;
  initialWebhooks?: WebhookRowDTO[];
  dashboardPrefs?: DashboardPrefsDTO | null;
  initialProfiles?: AdProfileDTO[];
  initialPixels?: PixelConfigDTO[];
  initialRules?: RuleDTO[];
}) {
  const v = useTraffikState({ brandName, liveUpdates, trackingId, appUrl, initialWebhooks, dashboardPrefs, initialProfiles, initialPixels, initialRules });

  return (
    <div style={sx("min-height:100vh;display:flex;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)")}>
      <Sidebar v={v} user={user} />

      <div style={sx("flex:1;min-width:0;padding:var(--space-8);display:flex;flex-direction:column;gap:var(--space-6);overflow:auto")}>
        <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4)")}>
          <div>
            <h1 style={sx("margin:0")}>{v.pageTitle}</h1>
            <p style={sx("margin:0;opacity:.65;font-size:14px")}>{v.pageSubtitle}</p>
          </div>
          <div style={sx("display:flex;align-items:center;gap:8px;flex-shrink:0")}>
            <span style={sx("width:7px;height:7px;border-radius:50%;background:var(--color-accent);animation:pulse-dot 1.6s ease-in-out infinite")} />
            <span className="tag tag-outline">Ao vivo</span>
          </div>
        </div>

        {v.activeTab === "dashboard" && <DashboardView v={v} />}
        {v.activeTab === "ads" && <AdsManagerView v={v} />}
        {v.activeTab === "creatives" && <CreativesView v={v} />}
        {v.activeTab === "rules" && <RulesView v={v} />}
        {v.activeTab === "notifications" && <NotificationsView v={v} />}
        {v.activeTab === "fees" && <FeesView v={v} />}
        {v.activeTab === "facebook" && <FacebookView v={v} />}
        {v.activeTab === "utm" && <UtmView v={v} />}
      </div>

      <EditDashboardDrawer v={v} />
    </div>
  );
}
