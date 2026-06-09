import { IntegrationPipelineDomainError } from "@/lib/prototype/implementationIntegrationErrors";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { asReadonlyArray } from "@/lib/prototype/implementationIntegrationPlanNormalize";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import { findIntegrationStep } from "@/lib/prototype/implementationIntegrationStepMutations";
import type { IntegrationPipelineStepKindV1 } from "@/lib/prototype/integrationPipelineRuntimeDiagnostic";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const STEP_INPUT_INVALID_MESSAGE =
  "통합 준비 상태를 다시 계산해야 합니다. 다시 시도해 주세요.";

export function validateIntegrationStepInput(input: {
  readonly projectId: string;
  readonly stepKind: IntegrationPipelineStepKindV1;
  readonly steps: readonly ImplementationIntegrationStepV1[] | null | undefined;
  readonly plan?: CodeTaskIntegrationPlanV1 | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly eligibilityCanRun?: boolean;
  readonly orchestrationPatch?: Record<string, unknown> | null;
  readonly previewRuntimePatch?: Record<string, unknown> | null;
}): Readonly<{
  readonly ok: boolean;
  readonly errorCode?: string;
  readonly userSafeMessage?: string;
  readonly diagnostic: Record<string, unknown>;
}> {
  const steps = input.steps ?? [];
  const diagnostic: Record<string, unknown> = {
    projectId: input.projectId,
    stepKind: input.stepKind,
    stepsCount: steps.length,
    hasPlan: Boolean(input.plan),
    hasCodeTaskPlan: Boolean(input.codeTaskPlan),
    hasTaskList: Boolean(input.taskList),
    codeTaskRunsCount: input.codeTaskRuns?.length ?? 0,
  };

  switch (input.stepKind) {
    case "final_wiring": {
      if (!steps.length) {
        return fail("missing_steps", diagnostic);
      }
      if (!findIntegrationStep(steps, "final_wiring")) {
        return fail("missing_final_wiring_step", diagnostic);
      }
      if (input.eligibilityCanRun === false) {
        return fail("eligibility_blocked", diagnostic);
      }
      if (!input.codeTaskPlan || !input.taskList || !input.codeTaskRuns?.length) {
        return fail("missing_codetask_context", diagnostic);
      }
      return { ok: true, diagnostic };
    }
    case "integration_branch": {
      if (!findIntegrationStep(steps, "integration_branch")) {
        return fail("missing_integration_branch_step", diagnostic);
      }
      return { ok: true, diagnostic };
    }
    case "build": {
      if (!steps.length) return fail("missing_steps", diagnostic);
      if (!findIntegrationStep(steps, "build")) return fail("missing_build_step", diagnostic);
      const plan = input.plan;
      if (!plan) return fail("missing_plan", diagnostic);
      if (!String(plan.integrationBranch ?? "").trim()) {
        return fail("missing_integration_branch", diagnostic);
      }
      const included = asReadonlyArray(plan.included);
      if (!included.length) return fail("empty_included", diagnostic);
      diagnostic.includedCount = included.length;
      return { ok: true, diagnostic };
    }
    case "app_preview_target": {
      if (!steps.length) return fail("missing_steps", diagnostic);
      if (!findIntegrationStep(steps, "app_preview_target")) {
        return fail("missing_app_preview_step", diagnostic);
      }
      if (!input.plan) return fail("missing_plan", diagnostic);
      if (!input.codeTaskPlan) return fail("missing_code_task_plan", diagnostic);
      if (!input.taskList) return fail("missing_task_list", diagnostic);
      if (!input.codeTaskRuns?.length) return fail("missing_code_task_runs", diagnostic);
      return { ok: true, diagnostic };
    }
    case "persist": {
      const hasPatch =
        Boolean(input.orchestrationPatch && Object.keys(input.orchestrationPatch).length) ||
        Boolean(input.previewRuntimePatch && Object.keys(input.previewRuntimePatch).length) ||
        steps.length > 0;
      if (!hasPatch) return fail("missing_persist_payload", diagnostic);
      return { ok: true, diagnostic };
    }
    default:
      return { ok: true, diagnostic };
  }
}

function fail(
  reason: string,
  diagnostic: Record<string, unknown>,
): Readonly<{
  readonly ok: false;
  readonly errorCode: string;
  readonly userSafeMessage: string;
  readonly diagnostic: Record<string, unknown>;
}> {
  return {
    ok: false,
    errorCode: "integration_step_input_invalid",
    userSafeMessage: STEP_INPUT_INVALID_MESSAGE,
    diagnostic: { ...diagnostic, reason },
  };
}

export function integrationStepInputInvalidError(
  validation: ReturnType<typeof validateIntegrationStepInput>,
): IntegrationPipelineDomainError | null {
  if (validation.ok) return null;
  return new IntegrationPipelineDomainError(
    "integration_step_input_invalid",
    validation.userSafeMessage,
    validation.diagnostic,
  );
}
