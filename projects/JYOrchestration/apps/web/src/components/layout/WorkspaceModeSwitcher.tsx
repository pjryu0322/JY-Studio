"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import type { WorkspaceMode } from "@/lib/ui/workspaceMode";

const BTNS: readonly { id: WorkspaceMode; label: string }[] = [
  { id: "DESKTOP", label: "데스크톱" },
  { id: "MOBILE", label: "모바일" },
  { id: "AUTO", label: "자동" },
];

export function WorkspaceModeSwitcher({ variant = "toolbar" }: { readonly variant?: "toolbar" | "menu" }) {
  const { mode, setMode, effectiveLayout } = useWorkspaceMode();
  const menu = variant === "menu";

  return (
    <div
      role="group"
      aria-label="작업모드"
      style={{
        display: "flex",
        flexDirection: menu ? "column" : "row",
        flexWrap: menu ? "nowrap" : "wrap",
        alignItems: menu ? "stretch" : "center",
        gap: menu ? 8 : 8,
        flexShrink: 0,
        width: menu ? "100%" : undefined,
      }}
    >
      {!menu ? (
        <span style={{ fontSize: 12, fontWeight: 800, color: t.textMuted, whiteSpace: "nowrap" }}>작업모드</span>
      ) : null}
      <div
        style={{
          display: "flex",
          width: menu ? "100%" : undefined,
          borderRadius: 10,
          border: `1px solid ${t.border}`,
          overflow: "hidden",
          background: t.bgPage,
        }}
      >
        {BTNS.map((b) => {
          const active = mode === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setMode(b.id)}
              aria-pressed={active}
              data-testid={`workspace-mode-${b.id.toLowerCase()}`}
              style={{
                flex: menu ? "1 1 0" : undefined,
                minWidth: 0,
                padding: menu ? "8px 6px" : "6px 12px",
                fontSize: 12,
                fontWeight: active ? 800 : 600,
                border: "none",
                borderRight: b.id === "AUTO" ? "none" : `1px solid ${t.border}`,
                margin: 0,
                cursor: "pointer",
                background: active ? `${t.primary}22` : "transparent",
                color: active ? t.primary : t.textSecondary,
                whiteSpace: "nowrap",
              }}
            >
              {b.label}
            </button>
          );
        })}
      </div>
      {mode === "AUTO" ? (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: t.textMuted,
            whiteSpace: menu ? "normal" : "nowrap",
            lineHeight: menu ? 1.4 : undefined,
          }}
        >
          적용: {effectiveLayout === "DESKTOP" ? "넓은 화면" : "좁은 화면"}
        </span>
      ) : null}
    </div>
  );
}
