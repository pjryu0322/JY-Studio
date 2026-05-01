"use client";

import { uiTokens as t } from "@/components/ui/tokens";

export type MobileNavTabId = "home" | "projects" | "chat" | "runs" | "settings";

const TABS: ReadonlyArray<{ id: MobileNavTabId; label: string }> = [
  { id: "home", label: "홈" },
  { id: "projects", label: "프로젝트" },
  { id: "chat", label: "채팅" },
  { id: "runs", label: "실행" },
  { id: "settings", label: "설정" },
];

export type MobileBottomNavProps = Readonly<{
  value: MobileNavTabId;
  onChange: (id: MobileNavTabId) => void;
}>;

export function MobileBottomNav(p: MobileBottomNavProps) {
  return (
    <nav
      role="tablist"
      aria-label="주요 메뉴"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-around",
        gap: 0,
        minHeight: 56,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        borderTop: `1px solid ${t.border}`,
        background: t.bgCard,
        boxSizing: "border-box",
        boxShadow: "0 -4px 24px -8px rgba(15, 23, 42, 0.12)",
      }}
    >
      {TABS.map((tab) => {
        const active = p.value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => p.onChange(tab.id)}
            style={{
              flex: 1,
              minHeight: 44,
              margin: 0,
              padding: "8px 4px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: active ? 800 : 600,
              color: active ? t.primary : t.textMuted,
              lineHeight: 1.2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              boxSizing: "border-box",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
