"use client";

import { useEffect, type CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import {
  messengerChatRoomDeleteModalCopy,
  type MessengerChatRoomDeleteModalVariant,
} from "@/lib/messenger/messengerChatRoomDeleteModalCopy";

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 70,
  background: t.overlayScrim,
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
  background: t.bgCard,
  boxShadow: t.shadowModal,
  border: `1px solid ${t.border}`,
  padding: "20px 22px 18px",
};

export function MessengerChatRoomDeleteConfirmModal({
  open,
  variant,
  busy,
  onClose,
  onConfirm,
}: {
  readonly open: boolean;
  readonly variant: MessengerChatRoomDeleteModalVariant;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  const copy = messengerChatRoomDeleteModalCopy(variant);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      data-testid="messenger-chat-room-delete-modal"
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800, color: t.textPrimary }}>{copy.title}</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: t.textSecondary, lineHeight: 1.55, whiteSpace: "pre-line" }}>
          {copy.body}
        </p>
        {copy.bullets?.length ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textSecondary, marginBottom: 6 }}>삭제 대상</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
              {copy.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: t.danger, fontWeight: 700 }}>
              이 작업은 복구할 수 없습니다.
            </p>
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            style={{
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.bgCard,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              fontSize: 13,
              fontWeight: 800,
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${t.danger}`,
              background: t.danger,
              color: "#fff",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "삭제 중…" : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
