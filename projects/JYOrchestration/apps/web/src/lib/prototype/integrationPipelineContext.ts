export type ProjectIntegrationPipelineStageV1 =
  | "implementation"
  | "review"
  | "pre_deploy"
  | "deploy";

export type ProjectIntegrationPipelineTriggerV1 =
  | "manual_integration_button"
  | "implementation_codetasks_completed"
  | "review_change_request_completed"
  | "manual_preview_refresh"
  | "pre_deploy_check"
  | "deploy_prepare"
  | "auto_after_codetasks_verified";

export type ProjectIntegrationPipelineModeV1 =
  | "initial_preview"
  | "review_refresh"
  | "pre_deploy_validation"
  | "deployment_prepare";

export type ProjectIntegrationPipelineContextV1 = Readonly<{
  readonly projectId: string;
  readonly stage: ProjectIntegrationPipelineStageV1;
  readonly trigger: ProjectIntegrationPipelineTriggerV1;
  readonly mode: ProjectIntegrationPipelineModeV1;

  readonly sourceBranch: string;
  readonly targetBranch: string;
  readonly baseBranch: string;

  readonly integrationBranch: string;
  readonly createPullRequest: boolean;

  readonly requestedBy?: "user" | "system" | "reviewer" | "security" | null;
  readonly reviewRequestId?: string | null;
  readonly changeRequestId?: string | null;
  readonly runSessionId?: string | null;

  readonly nowIso?: string;
}>;

export function projectIntegrationPipelineContextLogFields(
  context: ProjectIntegrationPipelineContextV1,
): Readonly<Record<string, string>> {
  const fields: Record<string, string> = {
    projectId: context.projectId,
    stage: context.stage,
    trigger: context.trigger,
    mode: context.mode,
    sourceBranch: context.sourceBranch,
    targetBranch: context.targetBranch,
    integrationBranch: context.integrationBranch,
    baseBranch: context.baseBranch,
  };
  if (context.reviewRequestId) fields.reviewRequestId = context.reviewRequestId;
  if (context.changeRequestId) fields.changeRequestId = context.changeRequestId;
  if (context.runSessionId) fields.runSessionId = context.runSessionId;
  return fields;
}
