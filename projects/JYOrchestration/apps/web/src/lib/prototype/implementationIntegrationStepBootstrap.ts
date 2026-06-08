import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  buildDefaultIntegrationStepsFromBranchPlan,
  buildIntegrationStepsBuiltTimeline,
} from "@/lib/prototype/implementationIntegrationStepBuilder";
import {
  loadImplementationIntegrationStepsFromState,
  saveImplementationIntegrationStepsToState,
} from "@/lib/prototype/implementationIntegrationStepStore";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import type { RequirementsPromptTimelineEntry, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export function ensurePersistedImplementationIntegrationSteps(input: {
  readonly projectId: string;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly nowIso?: string;
}): Readonly<{
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly bootstrapped: boolean;
  readonly orchestrationPatch: Partial<RequirementsStateJson>;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
}> {
  const pid = input.projectId.trim();
  const persisted = loadImplementationIntegrationStepsFromState(input.requirementsState);
  if (persisted.length) {
    return { steps: persisted, bootstrapped: false, orchestrationPatch: {}, timeline: [] };
  }
  const built = buildDefaultIntegrationStepsFromBranchPlan({
    codeTaskPlan: input.codeTaskPlan,
  });
  if (!built.length) {
    return { steps: [], bootstrapped: false, orchestrationPatch: {}, timeline: [] };
  }
  const nowIso = input.nowIso ?? new Date().toISOString();
  const orchestrationPatch = saveImplementationIntegrationStepsToState({
    projectId: pid,
    steps: built,
    reason: "implementation_integration_steps_bootstrap",
    nowIso,
  });
  const timeline = [
    buildIntegrationStepsBuiltTimeline({ projectId: pid, steps: built, nowIso }),
  ];
  return { steps: built, bootstrapped: true, orchestrationPatch, timeline };
}
