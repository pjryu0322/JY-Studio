import type { ProjectIntegrationPipelineContextV1 } from "@/lib/prototype/integrationPipelineContext";

export function buildReviewIntegrationPipelineContext(input: {
  readonly projectId: string;
  readonly reviewRequestId: string;
  readonly changeRequestId?: string | null;
  readonly reviewBranch: string;
  readonly baseIntegratedBranch: string;
  readonly targetBranch?: string | null;
  readonly nowIso?: string;
}): ProjectIntegrationPipelineContextV1 {
  const target = String(input.targetBranch ?? "wip/review/preview-refresh").trim();
  return {
    projectId: input.projectId.trim(),
    stage: "review",
    trigger: "review_change_request_completed",
    mode: "review_refresh",
    sourceBranch: input.reviewBranch.trim(),
    baseBranch: input.baseIntegratedBranch.trim(),
    targetBranch: target,
    integrationBranch: target,
    createPullRequest: false,
    requestedBy: "reviewer",
    reviewRequestId: input.reviewRequestId,
    changeRequestId: input.changeRequestId ?? null,
    nowIso: input.nowIso,
  };
}
