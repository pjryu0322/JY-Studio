"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FeaturePlanningWorkspace } from "@/components/feature-planning/FeaturePlanningWorkspace";
import { EmptyState } from "@/components/ui/EmptyState";
import { WorkflowStageChrome } from "@/components/workflow/primitives/WorkflowStageChrome";

function FeaturesPageInner() {
  const search = useSearchParams();
  const projectId = String(search?.get("projectId") ?? "").trim();

  return (
    <WorkflowStageChrome
      title={null}
      subtitle={undefined}
      stageLayoutStyle={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        border: "none",
        background: "transparent",
        borderRadius: 0,
        overflow: "visible",
      }}
    >
      {projectId ? (
        <FeaturePlanningWorkspace projectId={projectId} />
      ) : (
        <EmptyState title="프로젝트가 필요합니다" description="URL에 ?projectId= 를 지정해 주세요." />
      )}
    </WorkflowStageChrome>
  );
}

export default function FeaturesPage() {
  return (
    <Suspense fallback={null}>
      <FeaturesPageInner />
    </Suspense>
  );
}
