"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectRole } from "@/lib/auth/roles";
import { PlatformUserSearchCombobox, type PlatformUserRow } from "@/components/requirements/PlatformUserSearchCombobox";

const ROLE_OPTIONS: readonly { value: ProjectRole; label: string; description: string }[] = [
  { value: "EDITOR", label: "편집자", description: "프로젝트 내용을 편집할 수 있습니다." },
  { value: "REVIEWER", label: "검토자", description: "검토·승인 중심 권한입니다." },
  { value: "VIEWER", label: "조회자", description: "읽기 위주로 참여합니다." },
] as const;

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
  const [inviteRole, setInviteRole] = useState<ProjectRole>("EDITOR");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [optimisticJoined, setOptimisticJoined] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) {
      setInviteRole("EDITOR");
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
            role: inviteRole,
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
    [projectId, onInvited, inviteRole, mergedMemberIds]
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
        zIndex: 50,
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
        <h3 id="member-invite-title" style={{ margin: "0 0 6px 0", fontSize: 19, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
          멤버 초대
        </h3>
        <p style={{ margin: "0 0 18px 0", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
          플랫폼에 가입된 사용자를 골라 이 프로젝트에 초대합니다. 목록에서 바로 선택하거나 검색해 주세요.
        </p>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 8 }}>초대 권한 선택</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ROLE_OPTIONS.map((opt) => {
              const active = inviteRole === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={busy}
                  onClick={() => setInviteRole(opt.value)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: active ? "2px solid #0d7377" : "1px solid #e2e8f0",
                    background: active ? "#ecfdf5" : "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#0f172a",
                    cursor: busy ? "wait" : "pointer",
                  }}
                >
                  {opt.label}
                  {opt.value === "EDITOR" ? (
                    <span style={{ fontWeight: 600, color: "#64748b", marginLeft: 4 }}>(기본)</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8" }}>{ROLE_OPTIONS.find((o) => o.value === inviteRole)?.description}</div>
        </div>

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
