"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { WorkflowStageChrome } from "@/components/workflow/primitives/WorkflowStageChrome";
import { StructureCandidateReviewWorkspace } from "@/components/project-structure/StructureCandidateReviewWorkspace";
import { uiTokens as t } from "@/components/ui/tokens";

export default function ProjectStructureReviewPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = typeof params?.projectId === "string" ? params.projectId.trim() : "";

  if (!projectId) {
    return <p style={{ padding: 24, color: t.textMuted }}>projectId가 필요합니다.</p>;
  }

  const requirementsHref = `/requirements?projectId=${encodeURIComponent(projectId)}`;

  return (
    <WorkflowStageChrome
      title="구조 후보 검토"
      subtitle="AI Structure Engine이 제안한 후보를 검토하고 승인하면 Graph에 반영됩니다."
      backHref={requirementsHref}
      backLabel="서비스 기획"
      workNoteProjectId={projectId}
      stageLayoutStyle={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}
    >
      <p style={{ fontSize: 12, color: t.textMuted, margin: "0 0 10px" }}>
        승인·거절·수정·병합은{" "}
        <Link href={requirementsHref} style={{ color: t.primary }}>
          기획 워크스페이스
        </Link>
        와 동일한 프로젝트 컨텍스트에서 동작합니다.
      </p>
      <StructureCandidateReviewWorkspace projectId={projectId} />
    </WorkflowStageChrome>
  );
}
