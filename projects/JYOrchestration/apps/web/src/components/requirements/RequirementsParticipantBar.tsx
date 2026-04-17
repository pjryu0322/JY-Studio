"use client";

import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";

export type ParticipantOption = {
  id: string;
  name: string;
  kind: "ai" | "human";
  /** 현재 앱에 로그인한 사용자 본인 여부(간이 온라인 표시) */
  onlineHint: boolean;
  /** AI 멤버: OpenAI 연결·호출 상태 한 줄(있으면 이 값을 우선 표시) */
  aiStatusLabel?: string;
};

export function RequirementsParticipantBar({
  participants,
  selectedId,
  onSelect,
}: {
  readonly participants: readonly ParticipantOption[];
  readonly selectedId: string;
  readonly onSelect: (id: string, name: string) => void;
}) {
  const showScreenLabels = useShowScreenLabels();
  return (
    <div
      data-testid="requirements-participant-bar"
      style={{
        padding: "10px 12px",
        borderTop: "1px solid #e5e7eb",
        background: "#fff",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 800, color: "#475569", marginBottom: 8 }}>참가자 · 질문 대상</div>
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
              }}
            >
              {p.name}
              <span style={{ fontWeight: 500, color: "#64748b", marginLeft: 6 }}>({status})</span>
            </button>
          );
        })}
      </div>
      {selectedId === VIRTUAL_AI_PLANNER_ID ? (
        <div style={{ marginTop: 8, color: "#64748b" }}>
          대상: <strong style={{ color: "#0f172a" }}>AI 기획자</strong> — OpenAI로 요청하며, 진행·성공·실패는 대화에 시스템 메시지로 남습니다.
        </div>
      ) : (
        <div style={{ marginTop: 8, color: "#64748b" }}>
          대상: <strong style={{ color: "#0f172a" }}>{participants.find((x) => x.id === selectedId)?.name ?? "—"}</strong>
        </div>
      )}
    </div>
  );
}
