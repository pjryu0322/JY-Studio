"use client";

import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

const variantMap: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  neutral: { bg: "#f1f5f9", color: t.textSecondary, border: t.border },
  success: { bg: "#dcfce7", color: t.success, border: "#bbf7d0" },
  warning: { bg: "#ffedd5", color: t.warning, border: "#fed7aa" },
  danger: { bg: "#fee2e2", color: t.danger, border: "#fecaca" },
  info: { bg: "#e0f2fe", color: t.info, border: "#bae6fd" },
};

export type BadgeProps = Readonly<{
  variant?: BadgeVariant;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}>;

export function Badge({ variant = "neutral", children, className, style }: BadgeProps) {
  const v = variantMap[variant];
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1.4,
        border: `1px solid ${v.border}`,
        background: v.bg,
        color: v.color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
