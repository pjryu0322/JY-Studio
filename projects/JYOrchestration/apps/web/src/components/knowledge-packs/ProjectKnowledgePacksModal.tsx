"use client";

import { Suspense, useCallback } from "react";
import { KnowledgePacksBrowser } from "@/components/knowledge-packs/KnowledgePacksBrowser";
import { ProjectKnowledgeGraphModalShell } from "@/components/project-graph/ProjectKnowledgeGraphModalShell";
import { uiTokens as t } from "@/components/ui/tokens";

export type ProjectKnowledgePacksModalProps = Readonly<{
  readonly open: boolean;
  readonly projectId: string;
  readonly preservePlatformRail?: boolean;
  readonly onClose: () => void;
}>;

export function ProjectKnowledgePacksModal(p: ProjectKnowledgePacksModalProps) {
  const pid = p.projectId.trim();

  const handleOpenNewWindow = useCallback(() => {
    window.open("/knowledge-packs", "_blank", "noopener,noreferrer");
  }, []);

  const handleOpenGlobalManage = useCallback(() => {
    window.open("/knowledge-packs", "_blank", "noopener,noreferrer");
  }, []);

  if (!p.open || !pid) return null;

  return (
    <ProjectKnowledgeGraphModalShell
      open={p.open}
      title="프로젝트 지식팩"
      preservePlatformRail={p.preservePlatformRail}
      onClose={p.onClose}
      onOpenNewWindow={handleOpenNewWindow}
    >
      <div
        data-testid="project-knowledge-packs-modal-body"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
      >
        <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.5, flexShrink: 0 }}>
          현재 프로젝트의 AI Agent가 참조할 지식팩을 확인합니다.
        </p>
        <Suspense fallback={<p style={{ fontSize: 13, color: t.textMuted }}>지식팩 목록 준비 중…</p>}>
          <KnowledgePacksBrowser variant="project-modal" projectId={pid} />
        </Suspense>
        <div style={{ flexShrink: 0, paddingTop: 4 }}>
          <button
            type="button"
            data-testid="project-knowledge-packs-open-global"
            onClick={handleOpenGlobalManage}
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.bgPage,
              cursor: "pointer",
              color: t.primary,
            }}
          >
            전체 지식팩 관리 열기
          </button>
        </div>
      </div>
    </ProjectKnowledgeGraphModalShell>
  );
}
