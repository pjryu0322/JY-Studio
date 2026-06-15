"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import type { ImplementationResetScope } from "@/lib/requirements/implementationResetScope";

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 62,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panel: CSSProperties = {
  width: "min(520px, 100%)",
  maxHeight: "min(90vh, 640px)",
  overflow: "auto",
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.35)",
  border: "1px solid #e2e8f0",
  padding: "20px 22px 18px",
};

const optionCard = (selected: boolean): CSSProperties => ({
  border: `1px solid ${selected ? "#0f172a" : "#e2e8f0"}`,
  borderRadius: 12,
  padding: "12px 14px",
  background: selected ? "#f8fafc" : "#fff",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
});

const btnBase: CSSProperties = {
  fontSize: 13,
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  cursor: "pointer",
  background: "#fff",
};

export function ImplementationResetScopeDialog(props: {
  readonly open: boolean;
  readonly busy?: boolean;
  readonly conversationOnlyDisabled?: boolean;
  readonly codeTaskResetDisabled?: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (scope: ImplementationResetScope) => void;
}): ReactNode {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !props.busy) {
        e.preventDefault();
        props.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.busy, props.onClose]);

  if (!props.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="초기화 범위 선택"
      data-testid="implementation-reset-scope-dialog"
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !props.busy) props.onClose();
      }}
    >
      <div style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
          초기화 범위 선택
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          초기화할 범위를 선택하세요. CodeTask까지 초기화하면 대화내용도 함께 삭제됩니다.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          <button
            type="button"
            data-testid="implementation-reset-option-conversation"
            disabled={props.busy || props.conversationOnlyDisabled}
            style={{
              ...optionCard(false),
              opacity: props.conversationOnlyDisabled ? 0.55 : 1,
            }}
            onClick={() => props.onConfirm("conversation_only")}
          >
            <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>대화내용만 초기화</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.45 }}>
              구현단계 채팅 기록만 삭제합니다.
              <br />
              CodeTask, 실행상태, GitHub 확인 기록, Preview는 유지됩니다.
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>위험도: 일반</div>
          </button>

          <button
            type="button"
            data-testid="implementation-reset-option-codetask"
            disabled={props.busy || props.codeTaskResetDisabled}
            style={{
              ...optionCard(false),
              opacity: props.codeTaskResetDisabled ? 0.55 : 1,
            }}
            onClick={() => props.onConfirm("codetask_with_conversation")}
          >
            <div style={{ fontWeight: 600, fontSize: 14, color: "#b91c1c" }}>CodeTask까지 초기화</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.45 }}>
              대화내용, CodeTask, 실행상태, GitHub 확인 기록, Preview 실행 정보를 초기화합니다.
              <br />
              기획 산출물 기준으로 CodeTask를 다시 생성합니다.
            </div>
            <div style={{ fontSize: 11, color: "#dc2626", marginTop: 8 }}>위험도: 위험 작업</div>
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            data-testid="implementation-reset-cancel"
            disabled={props.busy}
            style={btnBase}
            onClick={props.onClose}
          >
            취소
          </button>
          <button
            type="button"
            data-testid="implementation-reset-conversation-action"
            disabled={props.busy || props.conversationOnlyDisabled}
            style={btnBase}
            onClick={() => props.onConfirm("conversation_only")}
          >
            대화내용만 초기화
          </button>
          <button
            type="button"
            data-testid="implementation-reset-codetask-action"
            disabled={props.busy || props.codeTaskResetDisabled}
            style={{
              ...btnBase,
              background: "#b91c1c",
              borderColor: "#b91c1c",
              color: "#fff",
            }}
            onClick={() => props.onConfirm("codetask_with_conversation")}
          >
            CodeTask까지 초기화
          </button>
        </div>
      </div>
    </div>
  );
}
