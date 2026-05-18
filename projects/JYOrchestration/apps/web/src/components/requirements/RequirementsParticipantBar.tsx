"use client";

import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import { WorkspaceAiParticipantAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import { IDEATION_AI_DISPLAY_NAME } from "@/lib/requirements/ideationAiDisplayName";

export type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";

export function RequirementsParticipantBar({
  participants,
  selectedId,
  onSelect,
  dense,
}: {
  readonly participants: readonly ParticipantOption[];
  readonly selectedId: string;
  readonly onSelect: (id: string, name: string) => void;
  /** true면 하단 안내 문구를 숨겨 입력 영역을 더 단정하게 유지합니다. */
  readonly dense?: boolean;
}) {
  const showScreenLabels = useShowScreenLabels();
  return (
    <div
      data-testid="requirements-participant-bar"
      style={{
        padding: dense ? "4px 0 0" : "10px 12px",
        borderTop: dense ? "none" : "1px solid #e5e7eb",
        background: "transparent",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 800, color: "#475569", marginBottom: dense ? 6 : 8 }}>참여 대상</div>
      <div className="relative" style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 8 }}>
        <ScreenLabel label="요구사항-참가자영역-질문대상리스트" visible={showScreenLabels} />
        {participants.map((p) => {
          const active = p.id === selectedId;
          const status =
            p.kind === "ai"
              ? (p.aiStatusLabel?.trim() ? p.aiStatusLabel.trim() : "대기")
              : p.onlineHint
                ? "로그인 중"
                : "오프라인";
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id, p.name)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: active ? "2px solid #0d7377" : "1px solid #e5e7eb",
                background: active ? "#ecfdf5" : "#fff",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                color: "#0f172a",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                maxWidth: "100%",
              }}
            >
              {p.kind === "ai" ? <WorkspaceAiParticipantAvatar participant={p} size={22} /> : null}
              <span style={{ minWidth: 0, textAlign: "left" }}>
                {p.name}
                <span style={{ fontWeight: 500, color: "#64748b", marginLeft: 6 }}>({status})</span>
              </span>
            </button>
          );
        })}
      </div>
      {dense ? null : selectedId === VIRTUAL_AI_PLANNER_ID ? (
        <div style={{ marginTop: 8, color: "#64748b" }}>
          대상: <strong style={{ color: "#0f172a" }}>{IDEATION_AI_DISPLAY_NAME}</strong> — OpenAI로 요청하며, 진행·성공·실패는 대화에 시스템 메시지로 남습니다.
        </div>
      ) : (
        <div style={{ marginTop: 8, color: "#64748b" }}>
          대상: <strong style={{ color: "#0f172a" }}>{participants.find((x) => x.id === selectedId)?.name ?? "—"}</strong>
        </div>
      )}
    </div>
  );
}
