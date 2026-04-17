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
  leading,
  placeholder,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSend: () => void;
  readonly busy: boolean;
  readonly disabled?: boolean;
  readonly leading?: ReactNode;
  readonly placeholder?: string;
}) {
  const showScreenLabels = useShowScreenLabels();
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 200;
    el.style.height = `${Math.min(max, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [value, autoGrow]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        background: "#fafafa",
      }}
    >
      {leading ? <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>{leading}</div> : null}
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
          minHeight: 44,
          maxHeight: 200,
          resize: "none",
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 15,
          lineHeight: 1.45,
          fontFamily: "inherit",
          padding: "8px 4px",
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
            width: 40,
            height: 40,
            borderRadius: 10,
            border: "none",
            background: busy || disabled ? "#cbd5e1" : "#0d7377",
            color: "#fff",
            cursor: busy || disabled ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
