"use client";

import { displayedAiOrchestrator, showInternalAgents } from "@/lib/ai-member/visibleAiOrchestrator";
import type { WorkshopMessage } from "@/components/service-flow/serviceFlowWorkshopTypes";
import { messageTone } from "@/components/service-flow/serviceFlowWorkshopTypes";

export function ServiceFlowChatPanel(p: {
  readonly messages: readonly WorkshopMessage[];
  readonly replying: boolean;
  readonly generatingDraft: boolean;
  readonly structureLocked: boolean;
  readonly chatActive: boolean;
  readonly ideationReady: boolean;
}) {
  if (!(p.ideationReady && p.chatActive)) return null;

  return (
    <>
      <style>{`
        @keyframes jyo-sf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      {p.generatingDraft ? (
        <div style={{ border: "1px solid #c7d2fe", borderRadius: 14, padding: 12, background: "#eef2ff", maxWidth: 620 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              aria-hidden
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                border: "2px solid #94a3b8",
                borderTopColor: "#1d4ed8",
                animation: "jyo-sf-spin 900ms linear infinite",
              }}
            />
            <div style={{ fontSize: 13, fontWeight: 900, color: "#1e293b" }}>아이디어 내용을 바탕으로 서비스 흐름 초안을 만드는 중...</div>
          </div>
        </div>
      ) : null}
      {p.messages.map((message) => (
        <div
          key={message.id}
          style={{
            ...messageTone(message.role),
            border: "1px solid",
            borderRadius: 14,
            padding: "10px 12px",
            maxWidth: message.role === "user" ? "78%" : 620,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 900, color: "#64748b" }}>
            {message.role === "user"
              ? "사용자"
              : message.role === "member"
                ? `멤버 · ${message.name}`
                : message.role === "expert"
                  ? `업무 전문가 · ${message.name}`
                  : `AI · ${showInternalAgents ? message.name : displayedAiOrchestrator().name}`}
          </div>
          <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{message.body}</div>
        </div>
      ))}
      {p.replying ? <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>AI 기획자가 반영 중입니다...</div> : null}
      {!p.generatingDraft && !p.replying && p.messages.length === 0 ? (
        <div
          style={{
            ...messageTone("ai"),
            border: "1px solid",
            borderRadius: 14,
            padding: "10px 12px",
            maxWidth: 620,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 900, color: "#64748b" }}>AI · {displayedAiOrchestrator().name}</div>
          <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
            {p.structureLocked
              ? "서비스 흐름 구조가 확정된 상태입니다.\n\n입력창 왼쪽 + 메뉴의 「구조 편집」에서 단계별 담당을 조정할 수 있고, 이 채팅에서는 메시지를 입력해 흐름·액터·문구를 추가로 다듬을 수 있습니다."
              : "표시할 메시지가 없습니다.\n\n메시지를 입력하거나 아래 빠른 동작 칩을 눌러 AI 기획자와 흐름을 함께 정리해 보세요."}
          </div>
        </div>
      ) : null}
    </>
  );
}
