"use client";

import type { ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export function BottomSheet({
  open,
  onClose,
  ariaLabel,
  children,
  zIndex = 76,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly zIndex?: number;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label={`${ariaLabel} 닫기`}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: zIndex - 1,
          border: 0,
          padding: 0,
          margin: 0,
          background: "rgba(15, 23, 42, 0.35)",
          cursor: "pointer",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderTop: `1px solid ${t.border}`,
          background: t.bgCard,
          padding: "10px 12px 18px",
          boxShadow: "0 -8px 32px rgba(15, 23, 42, 0.12)",
          maxHeight: "min(70vh, 420px)",
          overflowY: "auto",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 999, background: t.border, margin: "4px auto 12px" }} aria-hidden />
        {children}
      </div>
    </>
  );
}

