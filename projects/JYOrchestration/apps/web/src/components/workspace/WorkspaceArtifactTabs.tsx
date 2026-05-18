"use client";

import type { ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type WorkspaceArtifactTabId =
  | "features"
  | "menu"
  | "screens"
  | "screenFunctions"
  | "workflow"
  | "taskDraft";

const TAB_LABELS: Record<WorkspaceArtifactTabId, string> = {
  features: "기능목록",
  menu: "메뉴구조",
  screens: "화면목록",
  screenFunctions: "화면별기능",
  workflow: "서비스흐름",
  taskDraft: "Task초안",
};

const ORDER: WorkspaceArtifactTabId[] = [
  "features",
  "menu",
  "screens",
  "screenFunctions",
  "workflow",
  "taskDraft",
];

export function WorkspaceArtifactTabs({
  activeId,
  onChange,
  renderPanel,
}: {
  readonly activeId: WorkspaceArtifactTabId;
  readonly onChange: (id: WorkspaceArtifactTabId) => void;
  readonly renderPanel: (id: WorkspaceArtifactTabId) => ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div
        role="tablist"
        aria-label="산출물 탭"
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          padding: "8px 8px 6px",
          borderBottom: `1px solid ${t.border}`,
          background: "#fafafa",
        }}
      >
        {ORDER.map((id) => {
          const on = id === activeId;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(id)}
              style={{
                borderRadius: 999,
                border: on ? `1px solid ${t.accentTealFg}` : `1px solid ${t.border}`,
                background: on ? t.accentTealSurface : t.bgCard,
                color: t.textPrimary,
                fontSize: 11,
                fontWeight: 800,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              {TAB_LABELS[id]}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 12,
        }}
      >
        {renderPanel(activeId)}
      </div>
    </div>
  );
}
