"use client";

import { Suspense, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { WorkflowStageChrome } from "@/components/workflow/primitives/WorkflowStageChrome";
import { ProjectKnowledgeGraphWorkspace } from "@/components/project-graph/ProjectKnowledgeGraphWorkspace";
import { ProjectKnowledgeGraphCloseButton } from "@/components/project-graph/ProjectKnowledgeGraphCloseButton";
import { exitProjectKnowledgeGraphView } from "@/lib/project-graph/projectKnowledgeGraphClose";
import { uiTokens as t } from "@/components/ui/tokens";

export default function ProjectKnowledgeGraphPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = typeof params?.projectId === "string" ? params.projectId.trim() : "";

  const handleExit = useCallback(() => {
    exitProjectKnowledgeGraphView(router, projectId);
  }, [router, projectId]);

  if (!projectId) {
    return <p style={{ padding: 24, color: t.textMuted }}>projectId가 필요합니다.</p>;
  }

  return (
    <WorkflowStageChrome
      title="프로젝트 지식 그래프"
      right={<ProjectKnowledgeGraphCloseButton projectId={projectId} onClose={handleExit} />}
      workNoteProjectId={projectId}
      hideWorkflowNav
      stageLayoutStyle={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}
    >
      <Suspense fallback={<p style={{ fontSize: 13, color: t.textMuted }}>그래프 UI 준비 중…</p>}>
        <ProjectKnowledgeGraphWorkspace projectId={projectId} onExit={handleExit} />
      </Suspense>
    </WorkflowStageChrome>
  );
}
