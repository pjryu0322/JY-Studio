"use client";

import { useCallback, useState } from "react";
import { PlatformUserSearchCombobox, type PlatformUserRow } from "@/components/requirements/PlatformUserSearchCombobox";

export function RequirementsMemberInviteModal({
  open,
  projectId,
  onClose,
  onInvited,
}: {
  readonly open: boolean;
  readonly projectId: string;
  readonly onClose: () => void;
  readonly onInvited: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const inviteUser = useCallback(
    async (u: PlatformUserRow) => {
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch("/api/project/members/invite", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            memberType: "HUMAN",
            userId: u.id,
            role: "EDITOR",
          }),
        });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !json.success) {
          setMsg(json.message || "초대에 실패했습니다.");
          return;
        }
        onInvited();
        setMsg(`${u.name}님을 프로젝트에 추가했습니다.`);
      } finally {
        setBusy(false);
      }
    },
    [projectId, onInvited]
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(480px, 100%)",
          background: "#fff",
          borderRadius: 14,
          padding: 20,
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 8px 0", fontSize: 17, fontWeight: 800 }}>멤버 초대</h3>
        <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          가입된 사용자를 검색해 프로젝트에 추가합니다. (이메일 초대 링크는 사용하지 않습니다.)
        </p>
        <PlatformUserSearchCombobox disabled={busy} onPick={(u) => void inviteUser(u)} />
        {msg ? <p style={{ margin: "12px 0 0 0", fontSize: 13, color: "#0f172a" }}>{msg}</p> : null}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #d4d4d8",
              background: "#fff",
              fontWeight: 700,
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
