"use client";

import { useMemo } from "react";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import {
  formatParticipantStatusSubtitle,
  sortParticipantsForPresenceList,
} from "@/components/workspace/participantOptionPresentation";
import { WorkspaceAiParticipantAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";

/**
 * 아이디어 구체화 협업 영역 좌측: 참여 멤버 표시(프레즌스) + 멤버 초대(프로젝트 연결 시).
 */
export function RequirementsMemberSidebar({
  participants,
  showInvite,
  inviteDisabled,
  inviteEmphasis,
  onInviteClick,
  fillRail = false,
}: {
  readonly participants: readonly ParticipantOption[];
  readonly showInvite: boolean;
  readonly inviteDisabled: boolean;
  readonly inviteEmphasis: boolean;
  readonly onInviteClick: () => void;
  /** 가로 플렉스 형제가 아닌(예: 그리드 열) 레이아웃에서 레일 높이를 채울 때 true */
  readonly fillRail?: boolean;
}) {  const ordered = useMemo(() => sortParticipantsForPresenceList(participants), [participants]);

  return (
    <aside
      className="jyo-requirements-member-sidebar"
      data-testid="requirements-participant-bar"
      aria-label="참여 멤버"
      style={{
        width: 220,
        boxSizing: "border-box",
        borderRight: "1px solid #e2e8f0",
        background: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        ...(fillRail ? { height: "100%" } : { flex: "0 0 220px" }),
      }}
    >
      <div className="relative" style={{ position: "relative", padding: "12px 12px 8px" }}>        <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.02em", textTransform: "uppercase" }}>참여 멤버</div>
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
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              minWidth: 0,
            }}
          >
            {p.kind === "ai" ? <WorkspaceAiParticipantAvatar participant={p} size={30} /> : null}
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
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
                {formatParticipantStatusSubtitle(p, "sidebar")}
              </div>
            </div>
          </div>
        ))}
      </div>
      {showInvite ? (
        <div className="relative" style={{ position: "relative", padding: "10px 10px 12px", borderTop: "1px solid #e2e8f0", background: "rgba(255,255,255,0.65)" }}>          <button
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
