"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useLayoutMobileBreakpoint } from "@/components/ui/breakpoints";
import { NotificationListBody, type NotificationRow } from "@/components/layout/notificationList";

function shellStyle(narrow: boolean): CSSProperties {
  return {
    flex: "1 1 auto",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    width: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    background: "#fff",
    border: narrow ? undefined : "1px solid #e2e8f0",
    borderRadius: narrow ? 0 : 12,
    maxWidth: narrow ? "100%" : 720,
    margin: narrow ? 0 : "0 auto",
  };
}

export function NotificationsPageClient() {
  const narrow = useLayoutMobileBreakpoint();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading">("idle");
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const res = await fetch("/api/me/notifications", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as { success?: boolean; data?: NotificationRow[] };
      if (res.ok && json.success && Array.isArray(json.data)) {
        setItems(json.data);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoadState("idle");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = useCallback(
    async (inviteId: string, action: "accept" | "decline") => {
      setBusyInviteId(inviteId);
      try {
        const res = await fetch(`/api/me/project-invites/${encodeURIComponent(inviteId)}/${action}`, {
          method: "POST",
          credentials: "include",
        });
        const json = (await res.json()) as { success?: boolean; projectId?: string };
        await load();
        if (action === "accept" && res.ok && json.success && json.projectId) {
          window.dispatchEvent(new CustomEvent("jy:project-membership-changed", { detail: { projectId: json.projectId } }));
        }
      } finally {
        setBusyInviteId(null);
      }
    },
    [load]
  );

  return (
    <main
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        boxSizing: "border-box",
        padding: narrow ? "8px max(10px, env(safe-area-inset-left)) max(12px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-right))" : 24,
      }}
    >
      <div style={{ ...shellStyle(narrow), flex: "1 1 auto", minHeight: 0 }}>
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: narrow ? "12px 14px 10px" : "14px 18px 12px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <span aria-hidden />
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          <NotificationListBody
            loadState={loadState}
            items={items}
            busyInviteId={busyInviteId}
            narrow={narrow}
            onRespond={respond}
          />
        </div>
      </div>
    </main>
  );
}
