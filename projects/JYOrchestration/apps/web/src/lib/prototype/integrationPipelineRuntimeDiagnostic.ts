import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  IntegrationPipelineDomainError,
  toIntegrationPipelineErrorCode,
  userSafeMessageForIntegrationPipelineStepFailure,
} from "@/lib/prototype/implementationIntegrationErrors";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { asReadonlyArray } from "@/lib/prototype/implementationIntegrationPlanNormalize";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import { findIntegrationStep, mapIntegrationStepByKind } from "@/lib/prototype/implementationIntegrationStepMutations";
import type { ProjectIntegrationPipelineContextV1 } from "@/lib/prototype/integrationPipelineContext";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type IntegrationPipelineStepKindV1 =
  | "final_wiring"
  | "integration_branch"
  | "build"
  | "app_preview_target"
  | "persist"
  | "snapshot_refresh";

export type IntegrationRuntimeErrorDiagnosticV1 = Readonly<{
  readonly projectId: string;
  readonly stepKind: IntegrationPipelineStepKindV1;
  readonly stage: string;
  readonly trigger: string;
  readonly mode: string;
  readonly errorName: string;
  readonly errorMessage: string;
  readonly errorCode: string;
  readonly stack?: string;
  readonly contextSourceBranch?: string | null;
  readonly contextTargetBranch?: string | null;
  readonly contextIntegrationBranch?: string | null;
  readonly planStatus?: string | null;
  readonly integrationBranch?: string | null;
  readonly stepStatuses?: readonly string[];
  readonly hasPlan: boolean;
  readonly hasSteps: boolean;
  readonly hasIncluded: boolean;
  readonly includedCount: number;
  readonly hasPreviewRuntime: boolean;
  readonly nowIso: string;
}>;

export function buildIntegrationRuntimeErrorDiagnostic(input: {
  readonly projectId: string;
  readonly stepKind: IntegrationPipelineStepKindV1;
  readonly context: ProjectIntegrationPipelineContextV1;
  readonly error: unknown;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly plan: CodeTaskIntegrationPlanV1 | null | undefined;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly nowIso: string;
}): IntegrationRuntimeErrorDiagnosticV1 {
  const errorName = input.error instanceof Error ? input.error.name : "Error";
  const errorMessage = input.error instanceof Error ? input.error.message : String(input.error);
  const errorCode =
    input.error instanceof IntegrationPipelineDomainError
      ? input.error.code
      : toIntegrationPipelineErrorCode(input.error);
  const included = asReadonlyArray(input.plan?.included);
  return {
    projectId: input.projectId,
    stepKind: input.stepKind,
    stage: input.context.stage,
    trigger: input.context.trigger,
    mode: input.context.mode,
    errorName,
    errorMessage,
    errorCode,
    ...(input.error instanceof Error && input.error.stack ? { stack: input.error.stack } : {}),
    contextSourceBranch: input.context.sourceBranch ?? null,
    contextTargetBranch: input.context.targetBranch ?? null,
    contextIntegrationBranch: input.context.integrationBranch ?? null,
    planStatus: input.plan?.status ?? null,
    integrationBranch: input.plan?.integrationBranch ?? null,
    stepStatuses: input.steps.map((s) => `${s.kind}:${s.status}`),
    hasPlan: Boolean(input.plan),
    hasSteps: input.steps.length > 0,
    hasIncluded: included.length > 0,
    includedCount: included.length,
    hasPreviewRuntime: Boolean(input.previewRuntime),
    nowIso: input.nowIso,
  };
}

export function buildProjectIntegrationPipelineRuntimeErrorTimelineEntry(input: {
  readonly diagnostic: IntegrationRuntimeErrorDiagnosticV1;
}): RequirementsPromptTimelineEntry {
  const d = input.diagnostic;
  return buildImplementationExecutionLogTimelineEntry({
    action: "project_integration_pipeline_runtime_error",
    orchestrationTraceGroup: "project_integration_pipeline",
    fields: {
      projectId: d.projectId,
      stepKind: d.stepKind,
      errorCode: d.errorCode,
      errorName: d.errorName,
      errorMessage: d.errorMessage.slice(0, 400),
      planStatus: d.planStatus ?? undefined,
      integrationBranch: d.integrationBranch ?? undefined,
      includedCount: d.includedCount,
      hasPlan: d.hasPlan,
      hasSteps: d.hasSteps,
    },
    detailLines: d.stack ? [`stack=${d.stack.slice(0, 1200)}`] : [],
    nowIso: d.nowIso,
  });
}

export function markIntegrationPipelineStepRuntimeFailure(input: {
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly stepKind: IntegrationPipelineStepKindV1;
  readonly error: unknown;
  readonly nowIso: string;
}): Readonly<{
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly userSafeMessage: string;
}> {
  const userSafeMessage = userSafeMessageForIntegrationPipelineStepFailure(
    input.stepKind,
    input.error,
  );
  const kindsToFail: ImplementationIntegrationStepV1["kind"][] =
    input.stepKind === "final_wiring" || input.stepKind === "integration_branch"
      ? ["final_wiring", "integration_branch"]
      : input.stepKind === "build"
        ? ["build"]
        : input.stepKind === "app_preview_target"
          ? ["app_preview_target"]
          : [];

  let steps = [...input.steps];
  for (const kind of kindsToFail) {
    const step = findIntegrationStep(steps, kind);
    if (!step || step.status === "completed") continue;
    steps = mapIntegrationStepByKind(steps, kind, (s) => ({
      ...s,
      status: "failed",
      failedAt: input.nowIso,
      errorCode: "integration_runtime_error",
      errorMessage: userSafeMessage,
    }));
  }
  return { steps, userSafeMessage };
}

export function pipelineStatusForStepKind(stepKind: IntegrationPipelineStepKindV1):
  | "final_wiring_failed"
  | "integration_branch_failed"
  | "build_failed"
  | "app_preview_target_failed"
  | "pipeline_blocked" {
  switch (stepKind) {
    case "final_wiring":
    case "integration_branch":
      return "final_wiring_failed";
    case "build":
      return "build_failed";
    case "app_preview_target":
      return "app_preview_target_failed";
    default:
      return "pipeline_blocked";
  }
}
