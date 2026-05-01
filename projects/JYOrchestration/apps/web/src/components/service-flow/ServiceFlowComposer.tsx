"use client";

import { useId, type MutableRefObject, type ReactNode, type Ref } from "react";

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ServiceFlowComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder,
  onOpenActions,
  textAreaRef,
  actionMenu,
  actionsOpen,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSubmit: () => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly onOpenActions: () => void;
  readonly textAreaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  readonly actionMenu: ReactNode;
  readonly actionsOpen: boolean;
}) {
  const id = useId();
  const controlsId = actionsOpen ? `${id}-actions` : undefined;

  return (
    <div
      className="jyo-service-flow-composer-shell"
      style={{
        flex: "0 0 auto",
        padding: "12px 18px 16px",
        borderTop: "1px solid #e2e8f0",
        background: "#f8fafc",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 660, margin: "0 auto", width: "100%", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
            borderRadius: 999,
            border: "1px solid #e2e8f0",
            background: "#fff",
            boxShadow: "0 10px 40px -18px rgba(15, 23, 42, 0.18)",
            padding: "8px 10px",
          }}
        >
          <div className="relative" style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              aria-label="작업 메뉴"
              aria-expanded={actionsOpen}
              aria-controls={controlsId}
              onClick={() => onOpenActions()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                border: "none",
                background: "#f1f5f9",
                color: "#475569",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <PlusIcon />
            </button>
            {actionMenu}
          </div>
          <textarea
            ref={textAreaRef as Ref<HTMLTextAreaElement> | undefined}
            value={value}
            disabled={disabled}
            rows={1}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (disabled) return;
                onSubmit();
              }
            }}
            placeholder={placeholder ?? "메시지를 입력하세요"}
            style={{
              width: "100%",
              boxSizing: "border-box",
              flex: 1,
              minHeight: 44,
              maxHeight: 160,
              resize: "none",
              border: "none",
              outline: "none",
              background: "transparent",
              borderRadius: 0,
              fontSize: 16,
              lineHeight: 1.5,
              fontFamily: "inherit",
              padding: "10px 6px",
            }}
          />
          <button
            type="button"
            onClick={() => onSubmit()}
            disabled={disabled}
            aria-label="전송"
            title="전송"
            style={{
              flex: "0 0 auto",
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "none",
              background: disabled ? "#cbd5e1" : "linear-gradient(180deg, #0f766e 0%, #0d5c56 100%)",
              color: "#fff",
              cursor: disabled ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              lineHeight: 1,
              boxShadow: disabled ? "none" : "0 8px 20px -6px rgba(13, 92, 86, 0.45)",
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
