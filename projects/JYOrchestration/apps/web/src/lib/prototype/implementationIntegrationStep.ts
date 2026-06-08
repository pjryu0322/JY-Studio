export type ImplementationIntegrationStepStatusV1 =
  | "pending"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

import type {
  ProjectIntegrationPipelineModeV1,
  ProjectIntegrationPipelineStageV1,
  ProjectIntegrationPipelineTriggerV1,
} from "@/lib/prototype/integrationPipelineContext";

export type ImplementationIntegrationStepKindV1 =
  | "final_wiring"
  | "integration_branch"
  | "build"
  | "app_preview_target";

export type ImplementationIntegrationStepV1 = Readonly<{
  readonly stepId: string;
  readonly kind: ImplementationIntegrationStepKindV1;
  readonly title: string;
  readonly status: ImplementationIntegrationStepStatusV1;
  readonly order: number;
  readonly branchGroup?: "integration";
  readonly baseBranch?: string | null;
  readonly workBranch?: string | null;
  readonly startedAt?: string | null;
  readonly completedAt?: string | null;
  readonly failedAt?: string | null;
  readonly commitSha?: string | null;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly stage?: ProjectIntegrationPipelineStageV1;
  readonly mode?: ProjectIntegrationPipelineModeV1;
  readonly trigger?: ProjectIntegrationPipelineTriggerV1;
  readonly sourceBranch?: string | null;
  readonly targetBranch?: string | null;
  readonly reviewRequestId?: string | null;
  readonly changeRequestId?: string | null;
}>;

export const INTEGRATION_FINAL_WIRING_STEP_ID = "integration-final-wiring" as const;
export const INTEGRATION_FINAL_WIRING_WORK_BRANCH = "wip/integration/final-wiring" as const;
