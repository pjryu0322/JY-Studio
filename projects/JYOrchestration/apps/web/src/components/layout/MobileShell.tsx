"use client";

import type { ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { MobileTopBar } from "@/components/layout/MobileTopBar";

export type MobileShellProps = Readonly<{
  children: ReactNode;
  /** 비어 있으면 `PlatformTopNav`만 사용하고 보조 탑바는 렌더하지 않습니다. */
  title?: string;
  topLeftAction?: ReactNode;
  topRightAction?: ReactNode;
}>;

/**
 * Mobile layout: optional sticky top bar, scrollable content.
 */
export function MobileShell(p: MobileShellProps) {
  const barTitle = (p.title ?? "").trim();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: t.bgPage,
        boxSizing: "border-box",
      }}
    >
      {barTitle ? <MobileTopBar title={barTitle} leftAction={p.topLeftAction} rightAction={p.topRightAction} /> : null}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
          boxSizing: "border-box",
        }}
      >
        {p.children}
      </main>
    </div>
  );
}
