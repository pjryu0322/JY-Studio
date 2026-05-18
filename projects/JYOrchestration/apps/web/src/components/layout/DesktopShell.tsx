"use client";

import type { ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type DesktopShellProps = Readonly<{
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
}>;

/**
 * Desktop layout wrapper: top header, optional actions, centered main region.
 */
export function DesktopShell(p: DesktopShellProps) {
  return (
    <div
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: t.bgPage,
        boxSizing: "border-box",
      }}
    >
      {(p.title || p.actions) && (
        <header
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "14px 24px",
            borderBottom: `1px solid ${t.border}`,
            background: t.bgCard,
            boxSizing: "border-box",
          }}
        >
          {p.title ? (
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.textPrimary, lineHeight: 1.2 }}>{p.title}</h1>
          ) : (
            <span />
          )}
          {p.actions ? <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{p.actions}</div> : null}
        </header>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>{p.children}</div>
    </div>
  );
}
