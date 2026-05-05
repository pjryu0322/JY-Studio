"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  inviteId: string | null;
  projectId: string | null;
  readAt: string | null;
  createdAt: string;
  projectName: string | null;
  canRespond: boolean;
};

export function PlatformNotificationsBell({ enabled }: { readonly enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading">("idle");
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
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
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el || !(e.target instanceof Node) || el.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const unreadCount = items.filter((n) => !n.readAt).length;

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

  if (!enabled) return null;

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative",
          width: 40,
          height: 36,
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          background: "#fff",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
        title="알림"
      >
        <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
          🔔
        </span>
        {unreadCount > 0 ? (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 6,
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
      </button>

      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "min(380px, calc(100vw - 32px))",
            maxHeight: 420,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 18px 40px -12px rgba(15, 23, 42, 0.18)",
            zIndex: 60,
            padding: "10px 0",
          }}
        >
          <div style={{ padding: "4px 14px 10px", fontSize: 13, fontWeight: 800, color: "#0f172a" }}>알림</div>
          {loadState === "loading" && !items.length ? (
            <div style={{ padding: "12px 14px", fontSize: 13, color: "#64748b" }}>불러오는 중…</div>
          ) : null}
          {loadState !== "loading" && !items.length ? (
            <div style={{ padding: "12px 14px", fontSize: 13, color: "#64748b" }}>알림이 없습니다.</div>
          ) : null}
          {items.map((n) => (
            <div
              key={n.id}
              style={{
                padding: "10px 14px",
                borderTop: "1px solid #f1f5f9",
                background: n.readAt ? "#fafafa" : "#fff",
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{n.title}</div>
              {n.projectName ? (
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{n.projectName}</div>
              ) : null}
              <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.45, marginBottom: n.canRespond ? 8 : 0 }}>
                {n.body}
              </div>
              {n.canRespond && n.inviteId ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={busyInviteId === n.inviteId}
                    onClick={() => void respond(n.inviteId!, "accept")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #0d9488",
                      background: "#0d9488",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: busyInviteId === n.inviteId ? "wait" : "pointer",
                    }}
                  >
                    수락
                  </button>
                  <button
                    type="button"
                    disabled={busyInviteId === n.inviteId}
                    onClick={() => void respond(n.inviteId!, "decline")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      color: "#475569",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: busyInviteId === n.inviteId ? "wait" : "pointer",
                    }}
                  >
                    거절
                  </button>
                </div>
              ) : null}
              {n.type === "PROJECT_MEMBER_INVITE" && !n.canRespond && n.projectId ? (
                <Link
                  href={`/requirements?projectId=${encodeURIComponent(n.projectId)}`}
                  style={{ fontSize: 12, fontWeight: 700, color: "#2563eb" }}
                >
                  프로젝트로 이동
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
