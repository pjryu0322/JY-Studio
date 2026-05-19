"use client";

import Link from "next/link";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  inviteId: string | null;
  projectId: string | null;
  chatRoomId: string | null;
  readAt: string | null;
  createdAt: string;
  projectName: string | null;
  canRespond: boolean;
};

export function NotificationListBody(p: {
  readonly loadState: "idle" | "loading";
  readonly items: NotificationRow[];
  readonly busyInviteId: string | null;
  readonly narrow: boolean;
  readonly onRespond: (inviteId: string, action: "accept" | "decline", notification: NotificationRow) => void;
}) {
  const { loadState, items, busyInviteId, narrow, onRespond } = p;
  const padX = narrow ? 16 : 14;
  const btnPad = narrow ? "10px 16px" : "6px 12px";
  const btnMinH = narrow ? 44 : undefined;

  return (
    <>
      {loadState === "loading" && !items.length ? (
        <div style={{ padding: `12px ${padX}px`, fontSize: narrow ? 14 : 13, color: "#64748b" }}>불러오는 중…</div>
      ) : null}
      {loadState !== "loading" && !items.length ? (
        <div style={{ padding: `12px ${padX}px`, fontSize: narrow ? 14 : 13, color: "#64748b" }}>알림이 없습니다.</div>
      ) : null}
      {items.map((n) => (
        <div
          key={n.id}
          style={{
            padding: narrow ? `14px ${padX}px` : `10px ${padX}px`,
            borderTop: "1px solid #f1f5f9",
            background: n.readAt ? "#fafafa" : "#fff",
          }}
        >
          <div style={{ fontSize: narrow ? 14 : 12.5, fontWeight: 800, color: "#0f172a", marginBottom: 4, lineHeight: 1.35 }}>
            {n.title}
          </div>
          {n.projectName ? (
            <div style={{ fontSize: narrow ? 12.5 : 11.5, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{n.projectName}</div>
          ) : null}
          <div style={{ fontSize: narrow ? 14 : 12.5, color: "#475569", lineHeight: 1.5, marginBottom: n.canRespond ? 10 : 0 }}>
            {n.body}
          </div>
          {n.canRespond && n.inviteId ? (
            <div style={{ display: "flex", gap: narrow ? 10 : 8, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={busyInviteId === n.inviteId}
                onClick={() => void onRespond(n.inviteId!, "accept", n)}
                style={{
                  padding: btnPad,
                  minHeight: btnMinH,
                  borderRadius: 10,
                  border: "1px solid #0d9488",
                  background: "#0d9488",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: narrow ? 14 : 12,
                  cursor: busyInviteId === n.inviteId ? "wait" : "pointer",
                  boxSizing: "border-box",
                }}
              >
                수락
              </button>
              <button
                type="button"
                disabled={busyInviteId === n.inviteId}
                onClick={() => void onRespond(n.inviteId!, "decline", n)}
                style={{
                  padding: btnPad,
                  minHeight: btnMinH,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#475569",
                  fontWeight: 800,
                  fontSize: narrow ? 14 : 12,
                  cursor: busyInviteId === n.inviteId ? "wait" : "pointer",
                  boxSizing: "border-box",
                }}
              >
                거절
              </button>
            </div>
          ) : null}
          {n.type === "PROJECT_MEMBER_INVITE" && !n.canRespond && n.projectId ? (
            <Link
              href={`/requirements?projectId=${encodeURIComponent(n.projectId)}`}
              style={{
                display: "inline-block",
                marginTop: 6,
                fontSize: narrow ? 14 : 12,
                fontWeight: 700,
                color: "#2563eb",
                padding: narrow ? "4px 0" : undefined,
              }}
            >
              프로젝트로 이동
            </Link>
          ) : null}
          {n.type === "CHAT_ROOM_MEMBER_INVITE" && !n.canRespond && n.chatRoomId ? (
            <Link
              href={`/chat/${encodeURIComponent(n.chatRoomId)}`}
              style={{
                display: "inline-block",
                marginTop: 6,
                fontSize: narrow ? 14 : 12,
                fontWeight: 700,
                color: "#2563eb",
                padding: narrow ? "4px 0" : undefined,
              }}
            >
              대화방으로 이동
            </Link>
          ) : null}
        </div>
      ))}
    </>
  );
}
