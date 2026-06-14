"use client";

import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { WorkflowStageChrome } from "@/components/workflow/primitives/WorkflowStageChrome";

export function PrototypeReviewPlaceholderPageClient() {
  const search = useSearchParams();
  const projectId = search?.get("projectId")?.trim() ?? "";

  return (
    <WorkflowStageChrome
      title="프로토타입 검토"
      hideWorkflowNav
      workNoteProjectId={projectId || undefined}
    >
      <EmptyState
        title="검토 단계를 준비 중입니다"
        description={
          projectId
            ? "프로젝트 레일의 검토 단계 화면은 곧 새로 제공됩니다. 구현·통합·Preview는 프로토타입 생성 단계에서 이어서 진행할 수 있습니다."
            : "URL에 ?projectId= 를 붙여 프로젝트를 선택한 뒤 다시 열어 주세요."
        }
      />
    </WorkflowStageChrome>
  );
}
