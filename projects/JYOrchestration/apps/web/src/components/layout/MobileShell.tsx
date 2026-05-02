"use client";

import type { ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { MobileBottomNav, type MobileNavTabId } from "@/components/layout/MobileBottomNav";
import { MobileTopBar } from "@/components/layout/MobileTopBar";

/** Space so scrollable content clears the fixed bottom nav + safe area */
const CONTENT_PAD_BOTTOM = "max(64px, calc(56px + env(safe-area-inset-bottom, 0px)))";

export type MobileShellProps = Readonly<{
  children: ReactNode;
  /** 비어 있으면 `PlatformTopNav`만 사용하고 보조 탑바는 렌더하지 않습니다. */
  title?: string;
  currentNav: MobileNavTabId;
  onNavChange: (id: MobileNavTabId) => void;
  topLeftAction?: ReactNode;
  topRightAction?: ReactNode;
}>;

/**
 * Mobile layout: sticky top bar, scrollable content, fixed bottom nav.
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
          paddingBottom: CONTENT_PAD_BOTTOM,
          boxSizing: "border-box",
        }}
      >
        {p.children}
      </main>
      <MobileBottomNav value={p.currentNav} onChange={p.onNavChange} />
    </div>
  );
}
