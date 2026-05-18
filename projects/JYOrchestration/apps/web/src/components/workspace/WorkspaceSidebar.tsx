"use client";

import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export function WorkspaceSidebar({
  title,
  children,
  footer,
  style,
}: {
  readonly title?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly style?: CSSProperties;
}) {
  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        width: "100%",
        maxWidth: 280,
        borderRight: `1px solid ${t.border}`,
        background: t.bgCard,
        boxSizing: "border-box",
        ...style,
      }}
      aria-label={title ?? "워크스페이스 사이드바"}
    >
      {title ? (
        <div
          style={{
            flexShrink: 0,
            padding: "10px 12px",
            borderBottom: `1px solid ${t.border}`,
            fontSize: 12,
            fontWeight: 900,
            color: t.textPrimary,
          }}
        >
          {title}
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px 12px" }}>{children}</div>
      {footer ? (
        <div style={{ flexShrink: 0, padding: "10px 12px", borderTop: `1px solid ${t.border}`, fontSize: 12, color: t.textMuted }}>{footer}</div>
      ) : null}
    </aside>
  );
}
