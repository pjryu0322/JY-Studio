"use client";

import type { ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type FixedToastTone = "save" | "success" | "error";

const toneStyle: Record<
  FixedToastTone,
  { top: number; bg: string; fg: string; shadow: string; zIndex: number; maxWidth?: number; fontWeight: 700 | 800 }
> = {
  save: {
    top: 72,
    bg: t.textPrimary,
    fg: "#fff",
    shadow: "0 12px 32px -8px rgba(15, 23, 42, 0.45)",
    zIndex: 60,
    fontWeight: 700,
  },
  success: {
    top: 120,
    bg: t.accentTealFg,
    fg: "#fff",
    shadow: "0 12px 32px -8px rgba(15, 118, 110, 0.45)",
    zIndex: 60,
    fontWeight: 800,
  },
  error: {
    top: 176,
    bg: t.danger,
    fg: "#fff",
    shadow: "0 12px 32px -8px rgba(185, 28, 28, 0.45)",
    zIndex: 61,
    maxWidth: 360,
    fontWeight: 800,
  },
};

export function FixedToast({
  tone,
  children,
  role = "status",
  "aria-live": ariaLive = "polite",
}: {
  readonly tone: FixedToastTone;
  readonly children: ReactNode;
  readonly role?: "status" | "alert";
  readonly "aria-live"?: "polite" | "assertive";
}) {
  const s = toneStyle[tone];
  return (
    <div
      role={role}
      aria-live={ariaLive}
      style={{
        position: "fixed",
        top: s.top,
        right: 24,
        zIndex: s.zIndex,
        padding: "10px 16px",
        borderRadius: t.radiusMd + 2,
        background: s.bg,
        color: s.fg,
        fontSize: 14,
        fontWeight: s.fontWeight,
        boxShadow: s.shadow,
        maxWidth: s.maxWidth,
      }}
    >
      {children}
    </div>
  );
}
