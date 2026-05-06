"use client";

import { FeaturePlanningWorkspace } from "@/components/feature-planning/FeaturePlanningWorkspace";

/**
 * Embeds the full 기능 정리 워크스페이스 inside `/requirements?stage=feature-planning`.
 * TODO: If nested `WorkspaceShell` + 상단 크롬이 과해지면, 쉘 없는 뷰 모드만 FeaturePlanningWorkspace에 추가해 정리합니다.
 */
export function RequirementsFeaturePlanningStagePanel({ projectId }: { readonly projectId: string }) {
  return <FeaturePlanningWorkspace projectId={projectId} />;
}
