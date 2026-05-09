"use client";

import { useEffect } from "react";
import { uiTokens as t } from "@/components/ui";
import type { MessengerAiMode } from "@/lib/messenger/messengerAiParticipation";

const OPTIONS: readonly { mode: MessengerAiMode; title: string; desc: string }[] = [
  {
    mode: "NONE",
    title: "AI 참여 안 함",
    desc: "AI 응답 없이 아이디어를 자유롭게 기록합니다.",
  },
  {
    mode: "AUTO",
    title: "AI기획자 자동응답",
    desc: "AI기획자가 사용자 입력에 응답하며 아이디어를 함께 정리합니다.",
  },
  {
    mode: "MENTION_ONLY",
    title: "AI기획자 멘션 시만 응답",
    desc: "AI기획자는 대화방에 있지만 @AI기획자로 부를 때만 응답합니다.",
  },
];

export function MessengerRoomAiSettingsModal(p: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly currentMode: MessengerAiMode;
  readonly saving: boolean;
  readonly disabled: boolean;
  /** 선택 즉시 서버에 반영합니다. */
  readonly onSave: (mode: MessengerAiMode) => void | Promise<void>;
}) {
  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (!p.saving) p.onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [p.open, p.saving, p.onClose]);

  if (!p.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI 기획자 참여 방식"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 92,
        background: t.overlayScrim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={() => {
        if (!p.saving) p.onClose();
      }}
    >
      <div
        style={{
          width: "min(96vw, 440px)",
          maxHeight: "min(88vh, 520px)",
          overflowY: "auto",
          borderRadius: t.radiusLg,
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          padding: 16,
          boxSizing: "border-box",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: 13, fontWeight: 800, color: t.textPrimary, margin: "0 0 14px", lineHeight: 1.45 }}>AI 기획자 참여 방식을 바꿉니다.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {OPTIONS.map((opt) => {
            const selected = p.currentMode === opt.mode;
            const locked = p.disabled || p.saving;
            return (
              <label
                key={opt.mode}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: 12,
                  borderRadius: t.radiusMd,
                  border: `1px solid ${selected ? t.accentTealFg : t.border}`,
                  background: selected ? t.accentTealSurface : t.bgCard,
                  cursor: locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.55 : 1,
                }}
              >
                <input
                  type="radio"
                  name="messenger-ai-mode"
                  checked={selected}
                  disabled={locked}
                  onChange={() => {
                    if (opt.mode === p.currentMode || p.disabled || p.saving) return;
                    void p.onSave(opt.mode);
                  }}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <span style={{ fontWeight: 900, fontSize: 14, color: t.textPrimary }}>{opt.title}</span>
                  <span style={{ display: "block", fontSize: 12, color: t.textSecondary, marginTop: 4, lineHeight: 1.45 }}>{opt.desc}</span>
                </span>
              </label>
            );
          })}
        </div>
        {p.saving ? (
          <p style={{ fontSize: 12, color: t.textMuted, margin: "12px 0 0", textAlign: "center" }}>저장 중…</p>
        ) : null}
      </div>
    </div>
  );
}
