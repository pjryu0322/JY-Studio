"use client";

import { useMemo } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import type { ParticipantOption } from "@/components/requirements/RequirementsParticipantBar";

function sortForSidebar(participants: readonly ParticipantOption[]): ParticipantOption[] {
  const ais = participants.filter((p) => p.kind === "ai");
  const self = participants.filter((p) => p.kind === "human" && p.onlineHint);
  const others = participants.filter((p) => p.kind === "human" && !p.onlineHint);
  return [...ais, ...self, ...others];
}

function statusSubtitle(p: ParticipantOption): string {
  const parts: string[] = [];
  if (p.kind === "ai") {
    const role = p.roleLabel?.trim();
    if (role) parts.push(role);
    else parts.push("AI");
    const s = p.aiStatusLabel?.trim();
    if (s) parts.push(s.length > 36 ? `${s.slice(0, 36)}…` : s);
  } else {
    const role = p.roleLabel?.trim();
    if (role) parts.push(role);
    if (p.invited) parts.push("초대됨");
    parts.push(p.onlineHint ? "온라인" : "오프라인");
  }
  return parts.join(" · ");
}

/**
 * 아이디어 구체화 협업 영역 좌측: 참여 멤버 표시(프레즌스) + 멤버 초대(프로젝트 연결 시).
 */
export function RequirementsMemberSidebar({
  participants,
  showInvite,
  inviteDisabled,
  inviteEmphasis,
  onInviteClick,
}: {
  readonly participants: readonly ParticipantOption[];
  readonly showInvite: boolean;
  readonly inviteDisabled: boolean;
  readonly inviteEmphasis: boolean;
  readonly onInviteClick: () => void;
}) {
  const showScreenLabels = useShowScreenLabels();
  const ordered = useMemo(() => sortForSidebar(participants), [participants]);

  return (
    <aside
      className="jyo-requirements-member-sidebar"
      data-testid="requirements-participant-bar"
      aria-label="참여 멤버"
      style={{
        width: 220,
        flex: "0 0 220px",
        boxSizing: "border-box",
        borderRight: "1px solid #e2e8f0",
        background: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div className="relative" style={{ position: "relative", padding: "12px 12px 8px" }}>
        <ScreenLabel label="요구사항-참가자영역-멤버리스트" visible={showScreenLabels} />
        <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.02em", textTransform: "uppercase" }}>참여 멤버</div>
      </div>
      <div
        role="list"
        style={{ flex: "1 1 auto", overflowY: "auto", padding: "0 10px 8px", display: "flex", flexDirection: "column", gap: 6 }}
      >
        {ordered.map((p) => (
          <div
            key={p.id}
            role="listitem"
            style={{
              textAlign: "left",
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#fff",
              boxShadow: "none",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#0f172a",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {p.name}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#64748b", marginTop: 3, lineHeight: 1.35, wordBreak: "break-word" }}>
              {statusSubtitle(p)}
            </div>
          </div>
        ))}
      </div>
      {showInvite ? (
        <div className="relative" style={{ position: "relative", padding: "10px 10px 12px", borderTop: "1px solid #e2e8f0", background: "rgba(255,255,255,0.65)" }}>
          <ScreenLabel label="요구사항-헤더-멤버초대버튼" visible={showScreenLabels} />
          <button
            type="button"
            disabled={inviteDisabled}
            onClick={onInviteClick}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 12,
              border: inviteEmphasis ? "2px solid #ea580c" : "1px solid #cbd5e1",
              background: inviteEmphasis ? "#fff7ed" : "#fff",
              color: inviteEmphasis ? "#c2410c" : "#0f172a",
              boxShadow: inviteEmphasis ? "0 0 0 3px rgba(251,146,60,0.2)" : "none",
              cursor: inviteDisabled ? "not-allowed" : "pointer",
              opacity: inviteDisabled ? 0.55 : 1,
            }}
          >
            멤버 초대
          </button>
        </div>
      ) : null}
    </aside>
  );
}
