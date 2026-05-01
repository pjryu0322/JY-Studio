"use client";

import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type InlineAlertVariant = "info" | "success" | "warning" | "danger";

const map: Record<InlineAlertVariant, { bg: string; border: string; title: string; text: string }> = {
  info: { bg: "#e0f2fe", border: "#bae6fd", title: t.info, text: "#0c4a6e" },
  success: { bg: "#dcfce7", border: "#bbf7d0", title: t.success, text: "#14532d" },
  warning: { bg: "#ffedd5", border: "#fed7aa", title: t.warning, text: "#7c2d12" },
  danger: { bg: "#fee2e2", border: "#fecaca", title: t.danger, text: "#7f1d1d" },
};

export type InlineAlertProps = Readonly<{
  variant?: InlineAlertVariant;
  title?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}>;

export function InlineAlert({ variant = "info", title, children, className, style }: InlineAlertProps) {
  const v = map[variant];
  return (
    <div
      role="status"
      className={className}
      style={{
        borderRadius: t.radiusMd,
        border: `1px solid ${v.border}`,
        background: v.bg,
        padding: "10px 12px",
        color: v.text,
        fontSize: 13,
        lineHeight: 1.5,
        ...style,
      }}
    >
      {title ? <div style={{ fontWeight: 800, marginBottom: children ? 6 : 0, color: v.text }}>{title}</div> : null}
      {children}
    </div>
  );
}
