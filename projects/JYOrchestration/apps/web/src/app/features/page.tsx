"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FeatureWorkspace } from "@/components/features/FeatureWorkspace";
import { WorkflowStageChrome } from "@/components/workflow/primitives/WorkflowStageChrome";

function FeaturesPageInner() {
  const search = useSearchParams();
  const projectId = String(search?.get("projectId") ?? "").trim();

  return (
    <WorkflowStageChrome
      title={null}
      subtitle={undefined}
      stageLayoutStyle={{ display: "flex", flexDirection: "column", minHeight: "min(78vh, 820px)" }}
    >
      <FeatureWorkspace projectId={projectId} />
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
