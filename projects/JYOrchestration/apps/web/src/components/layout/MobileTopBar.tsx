"use client";

import type { ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type MobileTopBarProps = Readonly<{
  title: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}>;

export function MobileTopBar(p: MobileTopBarProps) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: 48,
        padding: "10px 16px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgCard,
        boxSizing: "border-box",
      }}
    >
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", minWidth: 44, minHeight: 44 }}>{p.leftAction}</div>
      <h1
        style={{
          flex: 1,
          margin: 0,
          fontSize: 17,
          fontWeight: 800,
          color: t.textPrimary,
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        {p.title}
      </h1>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", minWidth: 44, minHeight: 44 }}>
        {p.rightAction}
      </div>
    </header>
  );
}
