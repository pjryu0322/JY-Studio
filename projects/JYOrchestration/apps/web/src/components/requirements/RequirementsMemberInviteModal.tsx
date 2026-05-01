"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PlatformUserSearchCombobox, type PlatformUserRow } from "@/components/requirements/PlatformUserSearchCombobox";

/** 사람 멤버는 동일한 프로젝트 권한으로 초대합니다(추가 권한은 별도 기능에서 부여). */
const DEFAULT_INVITE_ROLE = "EDITOR" as const;

export function RequirementsMemberInviteModal({
  open,
  projectId,
  onClose,
  onInvited,
  existingHumanUserIds,
}: {
  readonly open: boolean;
  readonly projectId: string;
  readonly onClose: () => void;
  readonly onInvited: () => void;
  /** 이미 프로젝트에 참여 중인 HUMAN 사용자 id */
  readonly existingHumanUserIds?: ReadonlySet<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [optimisticJoined, setOptimisticJoined] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) {
      setToast(null);
      setOptimisticJoined(new Set());
      setBusy(false);
    }
  }, [open]);

  const mergedMemberIds = useMemo(() => {
    const s = new Set<string>(existingHumanUserIds ?? []);
    optimisticJoined.forEach((id) => s.add(id));
    return s;
  }, [existingHumanUserIds, optimisticJoined]);

  const inviteUser = useCallback(
    async (u: PlatformUserRow) => {
      if (mergedMemberIds.has(u.id)) return;
      setBusy(true);
      setToast(null);
      try {
        const res = await fetch("/api/project/members/invite", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            memberType: "HUMAN",
            userId: u.id,
            role: DEFAULT_INVITE_ROLE,
          }),
        });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !json.success) {
          setToast({ kind: "err", text: json.message || "초대에 실패했습니다." });
          return;
        }
        setOptimisticJoined((prev) => new Set(prev).add(u.id));
        onInvited();
        const displayName = (u.name || "").trim() || u.email;
        setToast({ kind: "ok", text: `${displayName}님이 추가되었습니다.` });
      } finally {
        setBusy(false);
      }
    },
    [projectId, onInvited, mergedMemberIds]
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-invite-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15, 23, 42, 0.48)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(600px, 100%)",
          maxWidth: "100%",
          background: "#fff",
          borderRadius: 16,
          padding: "22px 24px 20px",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.28)",
          border: "1px solid #e2e8f0",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="member-invite-title" style={{ margin: "0 0 18px 0", fontSize: 19, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
          멤버 초대
        </h3>

        <PlatformUserSearchCombobox
          bootstrapRecent
          disabled={busy}
          existingMemberUserIds={mergedMemberIds}
          onPick={(u) => void inviteUser(u)}
        />

        {toast ? (
          <div
            role="status"
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              background: toast.kind === "ok" ? "#ecfdf5" : "#fef2f2",
              color: toast.kind === "ok" ? "#166534" : "#b91c1c",
              border: toast.kind === "ok" ? "1px solid #bbf7d0" : "1px solid #fecaca",
            }}
          >
            {toast.text}
          </div>
        ) : null}

        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 16px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontWeight: 700,
              fontSize: 13,
              color: "#475569",
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
