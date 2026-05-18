"use client";

import { useCallback, useEffect, useRef } from "react";
import { uiTokens as t } from "@/components/ui";

export function MessengerChatRoomRenameModal(p: {
  readonly open: boolean;
  readonly initialTitle: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onClose: () => void;
  readonly onSave: () => void | Promise<void>;
  readonly saving: boolean;
  readonly error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const revertAndClose = useCallback(() => {
    if (p.saving) return;
    p.onChange(p.initialTitle);
    p.onClose();
  }, [p.saving, p.initialTitle, p.onChange, p.onClose]);

  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || p.saving) return;
      e.preventDefault();
      revertAndClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [p.open, p.saving, revertAndClose]);

  useEffect(() => {
    if (!p.open) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.select();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [p.open, p.initialTitle]);

  if (!p.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="대화방 제목 바꾸기"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 96,
        background: t.overlayScrim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={() => {
        revertAndClose();
      }}
    >
      <div
        style={{
          width: "min(96vw, 420px)",
          borderRadius: t.radiusLg,
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          padding: 16,
          boxSizing: "border-box",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          id="messenger-room-title-input"
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!p.saving) void p.onSave();
            }
          }}
          maxLength={200}
          disabled={p.saving}
          aria-label="대화방 제목"
          placeholder="대화방 제목"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: t.radiusMd,
            border: `1px solid ${t.borderStrong}`,
            fontSize: 15,
            fontWeight: 700,
          }}
        />
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8 }}>{p.value.length}/200</div>
        {p.error ? (
          <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 10, fontWeight: 700 }}>{p.error}</div>
        ) : null}
      </div>
    </div>
  );
}
