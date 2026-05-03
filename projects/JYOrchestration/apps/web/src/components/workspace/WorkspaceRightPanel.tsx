"use client";

import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export function WorkspaceRightPanel({
  title,
  children,
  style,
}: {
  readonly title?: string;
  readonly children: ReactNode;
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
        maxWidth: 360,
        borderLeft: `1px solid ${t.border}`,
        background: t.bgCard,
        boxSizing: "border-box",
        ...style,
      }}
      aria-label={title ?? "결과 패널"}
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
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>{children}</div>
    </aside>
  );
}
