"use client";

import type { DashboardPrefsDTO } from "@/lib/actions/dashboardPrefs";
import type { AdProfileDTO } from "@/lib/actions/facebook";
import type { NotificationDTO, NotificationSettingsDTO } from "@/lib/actions/notifications";
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
  initialNotifSettings,
  initialNotifications,
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
  initialNotifSettings?: NotificationSettingsDTO;
  initialNotifications?: NotificationDTO[];
}) {
  const v = useTraffikState({ brandName, liveUpdates, trackingId, appUrl, initialWebhooks, dashboardPrefs, initialProfiles, initialPixels, initialRules, initialNotifSettings, initialNotifications });

  return (
    <div style={sx("min-height:100vh;display:flex;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)")}>
      <Sidebar v={v} user={user} />

      <div style={sx("flex:1;min-width:0;padding:var(--space-8);display:flex;flex-direction:column;gap:var(--space-6);overflow:auto")}>
        <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4)")}>
          <div>
            <h1 style={sx("margin:0")}>{v.pageTitle}</h1>
            <p style={sx("margin:0;opacity:.65;font-size:14px")}>{v.pageSubtitle}</p>
          </div>
          <div style={sx("display:flex;align-items:center;gap:12px;flex-shrink:0")}>
            <div style={sx("position:relative")}>
              <button
                className="btn btn-secondary btn-icon"
                type="button"
                onClick={v.toggleNotifOpen}
                aria-label="Notificações"
                style={sx("position:relative")}
              >
                <svg viewBox="0 0 256 256" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M128 32 a56 56 0 00-56 56 c0 46 -24 58 -24 72 h160 c0 -14 -24 -26 -24 -72 a56 56 0 00-56 -56 Z" />
                  <path d="M104 216 a24 24 0 0048 0" />
                </svg>
                {v.notifUnread > 0 && (
                  <span style={sx("position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--color-accent);color:var(--color-bg);font-size:10px;font-weight:700;display:grid;place-items:center")}>
                    {v.notifUnread > 9 ? "9+" : v.notifUnread}
                  </span>
                )}
              </button>

              {v.notifOpen && (
                <>
                  <div style={sx("position:fixed;inset:0;z-index:30")} onClick={v.closeNotif} />
                  <div style={sx("position:absolute;top:calc(100% + 8px);right:0;z-index:40;width:340px;max-height:440px;overflow:auto;background:var(--color-surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:var(--space-3)")}>
                    <div style={sx("display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2)")}>
                      <span className="card-title" style={sx("font-size:15px")}>Notificações</span>
                      {v.notifUnread > 0 && (
                        <button className="btn btn-ghost" type="button" onClick={v.markAllRead} style={sx("font-size:12px")}>Marcar todas como lidas</button>
                      )}
                    </div>
                    {v.notifItems.length === 0 ? (
                      <div className="text-muted" style={sx("font-size:13px;padding:var(--space-3) 0;text-align:center")}>Nenhuma notificação ainda.</div>
                    ) : (
                      v.notifItems.map((n) => (
                        <div key={n.id} style={sx(`display:flex;gap:10px;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);${n.read ? "" : "background:var(--color-bg);"}`)}>
                          <span style={sx("font-size:16px;flex:none")}>{n.icon}</span>
                          <div style={sx("min-width:0;flex:1")}>
                            <div style={sx("font-size:13px")}>{n.title}</div>
                            <div className="text-muted" style={sx("font-size:12px")}>{n.content}</div>
                            <div className="text-muted" style={sx("font-size:11px;margin-top:2px")}>{n.timeLabel}</div>
                          </div>
                          {!n.read && <span style={sx("width:7px;height:7px;border-radius:50%;background:var(--color-accent);flex:none;margin-top:6px")} />}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
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
