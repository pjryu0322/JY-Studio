"use client";

import type { CSSProperties } from "react";
import { ProjectRightDrawerShell } from "@/components/ui/ProjectRightDrawerShell";
import { UserProjectKnowledgeMemoryControlPanel } from "@/components/project-knowledge/UserProjectKnowledgeMemoryControlPanel";
import { uiTokens as t } from "@/components/ui/tokens";

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 16px",
  borderBottom: `1px solid ${t.border}`,
  flexShrink: 0,
};

const bodyStyle: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "12px 16px 24px",
};

export function ProjectKnowledgeMemorySettingsDrawer(p: {
  readonly projectId: string;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  return (
    <ProjectRightDrawerShell open={p.open} onClose={p.onClose} ariaLabel="지식 반영 설정">
      <div
        data-testid="knowledge-memory-settings-drawer"
        style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
      >
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: t.textPrimary }}>지식 반영 설정</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
              과거 프로젝트 지식 자동 반영 및 AI 멤버별 설정
            </div>
          </div>
          <button
            type="button"
            aria-label="닫기"
            data-testid="knowledge-memory-settings-close"
            onClick={p.onClose}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.bgPage,
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
        <div style={bodyStyle}>
          <UserProjectKnowledgeMemoryControlPanel projectId={p.projectId} embedded />
        </div>
      </div>
    </ProjectRightDrawerShell>
  );
}
