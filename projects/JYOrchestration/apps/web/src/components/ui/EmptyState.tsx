"use client";

import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type EmptyStateProps = Readonly<{
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
}>;

export function EmptyState({ title, description, action, className, style }: EmptyStateProps) {
  return (
    <div
      className={className}
      style={{
        padding: "20px 16px",
        borderRadius: t.radiusMd,
        border: `1px dashed ${t.borderStrong}`,
        background: t.bgPage,
        textAlign: "center",
        ...style,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: t.textPrimary }}>{title}</div>
      {description ? (
        <div style={{ marginTop: 8, fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{description}</div>
      ) : null}
      {action ? <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>{action}</div> : null}
    </div>
  );
}
