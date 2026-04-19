"use client";

import { useRef, useEffect } from "react";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

function roleLabel(role: RequirementsMessage["role"]): string {
  if (role === "user") return "나";
  if (role === "ai") return "AI";
  if (role === "human") return "멤버";
  return "시스템";
}

const msgBubble = (mine: boolean) =>
  ({
    maxWidth: "min(92%, 720px)",
    marginLeft: mine ? "auto" : 0,
    marginRight: mine ? 0 : "auto",
    padding: "14px 16px",
    borderRadius: mine ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
    background: mine ? "linear-gradient(180deg, #0f766e 0%, #0d5c56 100%)" : "#fff",
    color: mine ? "#fff" : "#0f172a",
    border: mine ? "none" : "1px solid #e2e8f0",
    fontSize: 15,
    lineHeight: 1.55,
    boxShadow: mine ? "0 10px 28px -14px rgba(13, 92, 86, 0.45)" : "0 8px 24px -16px rgba(15, 23, 42, 0.12)",
    whiteSpace: "pre-wrap" as const,
  }) as const;

export function RequirementsChatPanel({
  messages,
  composer,
  typingIndicator,
}: {
  readonly messages: readonly RequirementsMessage[] | null;
  readonly composer: React.ReactNode;
  /** AI 응답 대기 중 표시(채팅 타임라인에는 저장되지 않음) */
  readonly typingIndicator?: boolean;
}) {
  const showScreenLabels = useShowScreenLabels();
  const endRef = useRef<HTMLDivElement | null>(null);

  const firstIsOnboarding = Boolean(
    messages &&
      messages[0] &&
      messages[0].role === "ai" &&
      messages[0].speakerId === VIRTUAL_AI_PLANNER_ID &&
      messages[0].messageType === "NOTICE" &&
      messages[0].content.includes("먼저 아래 질문")
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  return (
    <section
      data-testid="requirements-chat-panel"
      style={{
        flex: "1 1 70%",
        minWidth: 280,
        display: "flex",
        flexDirection: "column",
        minHeight: 440,
      }}
      aria-label="아이디어 구체화 채팅"
    >
      <div
        className="relative"
        style={{
          position: "relative",
          flex: 1,
          overflowY: "auto",
          padding: "20px 18px",
          background: "linear-gradient(180deg, #f1f5f9 0%, #eef2f7 50%, #f8fafc 100%)",
        }}
      >
        <ScreenLabel label="요구사항-채팅영역-메시지타임라인" visible={showScreenLabels} />
        {firstIsOnboarding ? <ScreenLabel label="요구사항-채팅영역-초기안내메시지" visible={showScreenLabels} /> : null}
        {messages === null ? (
          <div style={{ fontSize: 13, color: "#71717a", marginBottom: 12 }}>
            <ScreenLabel label="요구사항-채팅영역-로딩상태" visible={showScreenLabels} />
            <ScreenLabel label="요구사항-불러오기상태" visible={showScreenLabels} />
            대화 이력을 불러오는 중입니다…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: 13, color: "#71717a", marginBottom: 12 }}>
            메시지가 여기에 쌓입니다. 아래에서 입력해 협의를 시작하세요.
          </div>
        ) : null}
        {(messages ?? []).map((m) => {
          const mine = m.role === "user";
          const directed = mine && m.targetName ? `@${m.targetName}에게 질문` : null;
          return (
            <div key={m.id} style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "#71717a",
                  paddingLeft: mine ? 0 : 4,
                  paddingRight: mine ? 4 : 0,
                  textAlign: mine ? "right" : "left",
                }}
              >
                {roleLabel(m.role)}
                {m.speakerName ? ` · ${m.speakerName}` : ""} ·{" "}
                {new Date(m.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              {directed ? (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: mine ? "#99f6e4" : "#0f766e",
                    textAlign: mine ? "right" : "left",
                    paddingLeft: mine ? 0 : 4,
                    paddingRight: mine ? 4 : 0,
                  }}
                >
                  {directed}
                </div>
              ) : null}
              <div style={msgBubble(mine)}>{m.content}</div>
            </div>
          );
        })}
        {typingIndicator ? (
          <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, color: "#71717a", paddingLeft: 4, textAlign: "left" }}>
              AI · AI 기획자 ·{" "}
              {new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div style={msgBubble(false)}>
              <span style={{ fontWeight: 800, marginRight: 6 }}>AI 기획자가 생각 중입니다</span>
              <span className="jyo-typing" aria-label="typing indicator">
                <span className="jyo-dot" />
                <span className="jyo-dot" />
                <span className="jyo-dot" />
              </span>
              <style>{`
                .jyo-typing { display: inline-flex; gap: 4px; vertical-align: middle; }
                .jyo-dot { width: 6px; height: 6px; border-radius: 999px; background: #0f766e; opacity: 0.35; animation: jyoDot 1.2s infinite; }
                .jyo-dot:nth-child(2) { animation-delay: 0.15s; }
                .jyo-dot:nth-child(3) { animation-delay: 0.3s; }
                @keyframes jyoDot { 0%, 80%, 100% { transform: translateY(0); opacity: 0.25; } 40% { transform: translateY(-3px); opacity: 0.9; } }
              `}</style>
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      {composer}
    </section>
  );
}
