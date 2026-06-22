"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { WorkflowStageChrome } from "@/components/workflow/primitives/WorkflowStageChrome";
import { ProjectKnowledgeGraphWorkspace } from "@/components/project-graph/ProjectKnowledgeGraphWorkspace";
import { uiTokens as t } from "@/components/ui/tokens";

export default function ProjectKnowledgeGraphPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = typeof params?.projectId === "string" ? params.projectId.trim() : "";

  if (!projectId) {
    return <p style={{ padding: 24, color: t.textMuted }}>projectId가 필요합니다.</p>;
  }

  const requirementsHref = `/requirements?projectId=${encodeURIComponent(projectId)}`;
  const structureReviewHref = `/projects/${encodeURIComponent(projectId)}/structure-review`;

  return (
    <WorkflowStageChrome
      title="프로젝트 지식 그래프"
      subtitle="Event Store에서 투영된 프로젝트 구조를 탐색하고 노드별 생성 근거를 확인합니다."
      backHref={requirementsHref}
      backLabel="서비스 기획"
      workNoteProjectId={projectId}
      stageLayoutStyle={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}
    >
      <p style={{ fontSize: 12, color: t.textMuted, margin: "0 0 10px" }}>
        구조 후보 검토는{" "}
        <Link href={structureReviewHref} style={{ color: t.primary }}>
          구조 후보 검토
        </Link>
        에서 진행할 수 있습니다.
      </p>
      <ProjectKnowledgeGraphWorkspace projectId={projectId} />
    </WorkflowStageChrome>
  );
}
