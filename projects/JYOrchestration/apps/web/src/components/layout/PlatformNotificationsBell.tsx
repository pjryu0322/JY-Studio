"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLayoutMobileBreakpoint } from "@/components/ui/breakpoints";
import type { NotificationRow } from "@/components/layout/notificationList";

/**
 * 알림은 `/notifications` 본문 라우트로 이동합니다(드롭다운·오버레이 없음).
 * 배지용으로 목록을 한 번 불러옵니다.
 */
export function PlatformNotificationsBell({ enabled }: { readonly enabled: boolean }) {
  const narrow = useLayoutMobileBreakpoint();
  const [items, setItems] = useState<NotificationRow[]>([]);

  const load = useCallback(async () => {
    if (!enabled) return;
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
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onFocus() {
      void load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  useEffect(() => {
    function onMembership() {
      void load();
    }
    window.addEventListener("jy:project-membership-changed", onMembership);
    return () => window.removeEventListener("jy:project-membership-changed", onMembership);
  }, [load]);

  if (!enabled) return null;

  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <Link
      href="/notifications"
      prefetch={false}
      aria-label={unreadCount > 0 ? `알림, 읽지 않음 ${unreadCount}건` : "알림"}
      title="알림"
      style={{
        position: "relative",
        width: narrow ? 44 : 40,
        height: narrow ? 40 : 36,
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        background: "#fff",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        boxSizing: "border-box",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <span aria-hidden style={{ fontSize: narrow ? 20 : 18, lineHeight: 1 }}>
        🔔
      </span>
      {unreadCount > 0 ? (
        <span
          style={{
            position: "absolute",
            top: narrow ? 3 : 4,
            right: narrow ? 4 : 6,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 999,
            background: "#dc2626",
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
