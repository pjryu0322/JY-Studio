"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { openWorkspaceModePreviewWindow, type WorkspaceMode } from "@/lib/ui/workspaceMode";

const BTNS: readonly { id: WorkspaceMode; label: string }[] = [
  { id: "DESKTOP", label: "데스크톱" },
  { id: "MOBILE", label: "모바일" },
  { id: "AUTO", label: "자동" },
];

function inactiveButtonStyle(menu: boolean, b: (typeof BTNS)[number]): CSSProperties {
  return {
    flex: menu ? "1 1 0" : undefined,
    minWidth: 0,
    padding: menu ? "8px 6px" : "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    border: "none",
    borderRight: b.id === "AUTO" ? "none" : `1px solid ${t.border}`,
    margin: 0,
    cursor: "default",
    background: "transparent",
    color: t.textSecondary,
    whiteSpace: "nowrap",
  };
}

export function WorkspaceModeSwitcher({ variant = "toolbar" }: { readonly variant?: "toolbar" | "menu" }) {
  const [clientMounted, setClientMounted] = useState(false);
  useEffect(() => {
    setClientMounted(true);
  }, []);

  const { mode, setMode, effectiveLayout } = useWorkspaceMode();
  const menu = variant === "menu";

  const shellStyle: CSSProperties = {
    display: "flex",
    flexDirection: menu ? "column" : "row",
    flexWrap: menu ? "nowrap" : "wrap",
    alignItems: menu ? "stretch" : "center",
    gap: menu ? 8 : 8,
    flexShrink: 0,
    width: menu ? "100%" : undefined,
  };

  const barStyle: CSSProperties = {
    display: "flex",
    width: menu ? "100%" : undefined,
    borderRadius: 10,
    border: `1px solid ${t.border}`,
    overflow: "hidden",
    background: t.bgPage,
  };

  /** SSR·첫 하이드레이트: 저장 모드와 무관하게 동일한 DOM(모두 비선택)으로 맞춘다. */
  if (!clientMounted) {
    return (
      <div role="group" aria-label="화면 레이아웃" style={shellStyle}>
        {!menu ? (
          <span style={{ fontSize: 12, fontWeight: 800, color: t.textMuted, whiteSpace: "nowrap" }}>화면 레이아웃</span>
        ) : null}
        <div style={barStyle}>
          {BTNS.map((b) => (
            <button
              key={b.id}
              type="button"
              tabIndex={-1}
              aria-pressed="false"
              aria-disabled
              data-testid={`workspace-mode-${b.id.toLowerCase()}`}
              style={inactiveButtonStyle(menu, b)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: t.textMuted,
            whiteSpace: menu ? "normal" : "nowrap",
            lineHeight: menu ? 1.4 : undefined,
          }}
        >
          적용: 넓은 화면
        </span>
      </div>
    );
  }

  return (
    <div role="group" aria-label="화면 레이아웃" style={shellStyle}>
      {!menu ? (
        <span style={{ fontSize: 12, fontWeight: 800, color: t.textMuted, whiteSpace: "nowrap" }}>화면 레이아웃</span>
      ) : null}
      <div style={barStyle}>
        {BTNS.map((b) => {
          const active = mode === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                const prev = mode;
                setMode(b.id);
                if (prev !== b.id) openWorkspaceModePreviewWindow(b.id);
              }}
              aria-pressed={active ? "true" : "false"}
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
