"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { PrototypeImprovementItem, PrototypeReviewMessage } from "@/lib/prototype/prototypeReviewStore";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { uiTokens as t } from "@/components/ui/tokens";

const shell: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  minHeight: 360,
  borderRadius: t.radiusLg,
  border: `1px solid ${t.border}`,
  background: t.bgCard,
  overflow: "hidden",
};

function roleLabel(role: PrototypeReviewMessage["role"]): string {
  if (role === "planner") return "AI기획자";
  if (role === "expert") return "전문가";
  return "사용자";
}

function bubbleStyle(role: PrototypeReviewMessage["role"]): CSSProperties {
  const isPlanner = role === "planner";
  return {
    alignSelf: isPlanner ? "flex-start" : "flex-end",
    maxWidth: "92%",
    padding: "10px 12px",
    borderRadius: 12,
    background: isPlanner ? t.bgPage : `${t.primary}18`,
    border: `1px solid ${isPlanner ? t.border : `${t.primary}40`}`,
    fontSize: 13,
    lineHeight: 1.55,
    color: t.textPrimary,
    whiteSpace: "pre-wrap",
  };
}

export function ReviewChatPanel(p: {
  readonly disabled: boolean;
  readonly messages: PrototypeReviewMessage[];
  readonly improvementItems: PrototypeImprovementItem[] | null;
  readonly busy: boolean;
  readonly busyAction: "send" | "summarize" | "improvements" | "drafts" | null;
  readonly onSend: (text: string) => void;
  readonly onSummarize: () => void;
  readonly onImprovements: () => void;
  readonly onFollowUpDrafts: () => void;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [p.messages.length]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v || p.busy || p.disabled) return;
    setText("");
    p.onSend(v);
  }

  return (
    <section aria-label="프로토타입 검토 대화" style={shell}>
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${t.border}`,
          background: t.bgPage,
          fontSize: 12,
          color: t.textMuted,
        }}
      >
        대화 참여: <strong style={{ color: t.textSecondary }}>사용자</strong> ·{" "}
        <strong style={{ color: t.textSecondary }}>전문가</strong> ·{" "}
        <strong style={{ color: t.textSecondary }}>AI기획자</strong>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {!p.messages.length ? (
          <EmptyState
            title="검토 대화를 시작해 보세요"
            description="프리뷰를 보며 느낀 점을 적으면 AI기획자가 함께 정리합니다."
          />
        ) : null}
        {p.messages.map((m) => (
          <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, alignSelf: m.role === "user" ? "flex-end" : "flex-start" }}>
              {roleLabel(m.role)}
            </span>
            <div style={bubbleStyle(m.role)}>{m.content}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {p.improvementItems?.length ? (
        <div
          style={{
            borderTop: `1px solid ${t.border}`,
            padding: "10px 12px",
            maxHeight: 160,
            overflowY: "auto",
            background: t.bgPage,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary, marginBottom: 8 }}>개선안</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
            {p.improvementItems.map((it, i) => (
              <li key={`${it.title}-${i}`}>
                <strong style={{ color: t.textPrimary }}>{it.title}</strong> — {it.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={{ borderTop: `1px solid ${t.border}`, padding: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={p.disabled || p.busy}
          loading={p.busyAction === "summarize"}
          onClick={p.onSummarize}
        >
          정리요청
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={p.disabled || p.busy}
          loading={p.busyAction === "improvements"}
          onClick={p.onImprovements}
        >
          개선안 보기
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={p.disabled || p.busy}
          loading={p.busyAction === "drafts"}
          onClick={p.onFollowUpDrafts}
        >
          보완작업 생성
        </Button>
      </div>

      <form onSubmit={onSubmit} style={{ borderTop: `1px solid ${t.border}`, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={p.disabled || p.busy}
          placeholder="프로토타입을 보며 개선 요청을 입력하세요."
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            padding: 10,
            borderRadius: t.radiusMd,
            border: `1px solid ${t.borderStrong}`,
            fontSize: 13,
            lineHeight: 1.45,
            boxSizing: "border-box",
          }}
        />
        <Button type="submit" variant="primary" size="md" disabled={p.disabled || p.busy || !text.trim()} loading={p.busyAction === "send"}>
          보내기
        </Button>
      </form>
    </section>
  );
}
