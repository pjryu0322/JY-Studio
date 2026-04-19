"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

export function RequirementsComposerGpt({
  value,
  onChange,
  onSend,
  busy,
  disabled,
  toolbarAbove,
  placeholder,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSend: () => void;
  readonly busy: boolean;
  readonly disabled?: boolean;
  /** 입력창 위 액션 행(정리 요청 등) */
  readonly toolbarAbove?: ReactNode;
  readonly placeholder?: string;
}) {
  const showScreenLabels = useShowScreenLabels();
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 220;
    el.style.height = `${Math.min(max, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [value, autoGrow]);

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid #e2e8f0",
        background: "#fff",
        boxShadow: "0 10px 40px -18px rgba(15, 23, 42, 0.18)",
        padding: "12px 14px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {toolbarAbove ? <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>{toolbarAbove}</div> : null}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        <div className="relative" style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <ScreenLabel label="요구사항-채팅영역-입력창" visible={showScreenLabels} />
          <textarea
            ref={taRef}
            data-testid="requirements-chat-input"
            value={value}
            disabled={disabled}
            rows={1}
            onChange={(e) => onChange(e.target.value)}
            onInput={autoGrow}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={placeholder ?? "무엇을 만들고 싶은지 입력하세요"}
            style={{
              width: "100%",
              boxSizing: "border-box",
              flex: 1,
              minHeight: 52,
              maxHeight: 220,
              resize: "none",
              border: "none",
              outline: "none",
              background: "#f8fafc",
              borderRadius: 14,
              fontSize: 16,
              lineHeight: 1.5,
              fontFamily: "inherit",
              padding: "12px 14px",
            }}
          />
        </div>
        <div className="relative" style={{ position: "relative", flex: "0 0 auto" }}>
          <ScreenLabel label="요구사항-채팅영역-전송버튼" visible={showScreenLabels} />
          <button
            type="button"
            disabled={busy || disabled}
            title="전송"
            aria-label="전송"
            onClick={onSend}
            style={{
              flex: "0 0 auto",
              width: 48,
              height: 48,
              borderRadius: 14,
              border: "none",
              background: busy || disabled ? "#cbd5e1" : "linear-gradient(180deg, #0f766e 0%, #0d5c56 100%)",
              color: "#fff",
              cursor: busy || disabled ? "wait" : "pointer",
              display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            lineHeight: 1,
            boxShadow: busy || disabled ? "none" : "0 8px 20px -6px rgba(13, 92, 86, 0.55)",
          }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
