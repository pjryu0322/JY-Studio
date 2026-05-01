"use client";

import { useMemo } from "react";
import type { ParticipantOption } from "@/components/requirements/RequirementsParticipantBar";

function sortForModal(participants: readonly ParticipantOption[]): ParticipantOption[] {
  const ais = participants.filter((p) => p.kind === "ai");
  const self = participants.filter((p) => p.kind === "human" && p.onlineHint);
  const others = participants.filter((p) => p.kind === "human" && !p.onlineHint);
  return [...ais, ...self, ...others];
}

function statusSubtitle(p: ParticipantOption): string {
  const parts: string[] = [];
  if (p.kind === "ai") {
    const s = p.aiStatusLabel?.trim();
    if (s) parts.push(s.length > 36 ? `${s.slice(0, 36)}…` : s);
    else parts.push("AI");
  } else {
    const role = p.roleLabel?.trim();
    if (role) parts.push(role);
    if (p.invited) parts.push("초대됨");
    parts.push(p.onlineHint ? "온라인" : "오프라인");
  }
  return parts.join(" · ");
}

export function RequirementsMembersModal(p: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly participants: readonly ParticipantOption[];
  readonly showInvite: boolean;
  readonly inviteDisabled: boolean;
  readonly onInviteClick: () => void;
}) {
  const ordered = useMemo(() => sortForModal(p.participants), [p.participants]);

  if (!p.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="참여 멤버"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 55,
        background: "rgba(15, 23, 42, 0.48)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          maxWidth: "100%",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.28)",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #e2e8f0",
            background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", lineHeight: 1.2 }}>참여 멤버</div>
            <div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 700, color: "#64748b" }}>{ordered.length}명</div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {p.showInvite ? (
              <button
                type="button"
                disabled={p.inviteDisabled}
                onClick={() => p.onInviteClick()}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #0f766e",
                  background: "#0f766e",
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 900,
                  cursor: p.inviteDisabled ? "not-allowed" : "pointer",
                  opacity: p.inviteDisabled ? 0.55 : 1,
                }}
              >
                멤버 초대
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => p.onClose()}
              aria-label="닫기"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#0f172a",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: 12, maxHeight: "min(60vh, 520px)", overflowY: "auto" }}>
          <div role="list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ordered.map((m) => (
              <div
                key={m.id}
                role="listitem"
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "#fff",
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.name}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: "#64748b", lineHeight: 1.35 }}>{statusSubtitle(m)}</div>
              </div>
            ))}
            {!ordered.length ? (
              <div style={{ padding: 18, textAlign: "center", color: "#64748b", fontSize: 13, fontWeight: 700 }}>표시할 멤버가 없습니다.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

