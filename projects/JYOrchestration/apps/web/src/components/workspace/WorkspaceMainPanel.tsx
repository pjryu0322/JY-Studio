"use client";

import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export function WorkspaceMainPanel({ children, style }: { readonly children: ReactNode; readonly style?: CSSProperties }) {
  return (
    <main
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: t.bgPage,
        ...style,
      }}
      aria-label="워크스페이스 본문"
    >
      {children}
    </main>
  );
}
