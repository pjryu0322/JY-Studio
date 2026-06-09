import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { integrationPlanHasSuccessfulMerge } from "@/lib/prototype/implementationIntegrationPlanMergeStatus";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import { findIntegrationStep, mapIntegrationStepByKind } from "@/lib/prototype/implementationIntegrationStepMutations";
import type { IntegrationPipelineStepKindV1 } from "@/lib/prototype/integrationPipelineRuntimeDiagnostic";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export function recoverCompletedIntegrationStepsFromPlan(input: {
  readonly projectId: string;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly plan: CodeTaskIntegrationPlanV1 | null;
  readonly nowIso: string;
}): Readonly<{
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly recovered: boolean;
  readonly recoveredKinds: readonly IntegrationPipelineStepKindV1[];
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
}> {
  if (!integrationPlanHasSuccessfulMerge(input.plan)) {
    return {
      steps: input.steps,
      recovered: false,
      recoveredKinds: [],
      timelineEntries: [],
    };
  }

  const recoveredKinds: IntegrationPipelineStepKindV1[] = [];
  let steps = [...input.steps];

  for (const kind of ["final_wiring", "integration_branch"] as const) {
    const step = findIntegrationStep(steps, kind);
    if (!step || step.status === "completed") continue;
    recoveredKinds.push(kind);
    steps = mapIntegrationStepByKind(steps, kind, (s) => ({
      ...s,
      status: "completed",
      completedAt: s.completedAt ?? input.nowIso,
      ...(kind === "integration_branch" && input.plan?.integrationBranch
        ? { workBranch: input.plan.integrationBranch }
        : {}),
    }));
  }

  if (!recoveredKinds.length) {
    return {
      steps: input.steps,
      recovered: false,
      recoveredKinds: [],
      timelineEntries: [],
    };
  }

  const timelineEntries = [
    buildImplementationExecutionLogTimelineEntry({
      action: "project_integration_pipeline_step_state_recovered",
      orchestrationTraceGroup: "project_integration_pipeline",
      fields: {
        projectId: input.projectId,
        recoveredKinds: recoveredKinds.join(","),
        integrationBranch: input.plan?.integrationBranch ?? undefined,
        reason: "integration_branch_exists_with_included_targets",
      },
      nowIso: input.nowIso,
    }),
  ];

  return {
    steps,
    recovered: true,
    recoveredKinds,
    timelineEntries,
  };
}
