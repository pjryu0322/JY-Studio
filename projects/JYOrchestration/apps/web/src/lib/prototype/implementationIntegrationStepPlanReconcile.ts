import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import { mapIntegrationStepByKind } from "@/lib/prototype/implementationIntegrationStepMutations";
import { integrationPlanHasSuccessfulMerge } from "@/lib/prototype/implementationIntegrationPlanMergeStatus";

export function reconcileIntegrationStepsWithIntegrationPlan(input: {
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly plan: CodeTaskIntegrationPlanV1 | null | undefined;
  readonly nowIso: string;
}): readonly ImplementationIntegrationStepV1[] {
  if (!integrationPlanHasSuccessfulMerge(input.plan)) {
    return input.steps;
  }
  let steps = [...input.steps];
  for (const kind of ["final_wiring", "integration_branch"] as const) {
    steps = mapIntegrationStepByKind(steps, kind, (step) =>
      step.status === "completed"
        ? step
        : {
            ...step,
            status: "completed",
            completedAt: step.completedAt ?? input.nowIso,
          },
    );
  }
  return steps;
}
