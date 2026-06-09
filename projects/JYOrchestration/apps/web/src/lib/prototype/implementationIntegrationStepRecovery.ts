import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import {
  integrationPlanHasExistingBranchResumeEvidence,
  integrationPlanHasSuccessfulMerge,
} from "@/lib/prototype/implementationIntegrationPlanMergeStatus";
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
  const hasMergeEvidence = integrationPlanHasSuccessfulMerge(input.plan);
  const hasBranchEvidence = integrationPlanHasExistingBranchResumeEvidence(input.plan);
  if (!hasMergeEvidence && !hasBranchEvidence) {
    return {
      steps: input.steps,
      recovered: false,
      recoveredKinds: [],
      timelineEntries: [],
    };
  }

  const recoveredKinds: IntegrationPipelineStepKindV1[] = [];
  let steps = [...input.steps];
  const timelineEntries: RequirementsPromptTimelineEntry[] = [];

  if (hasBranchEvidence) {
    const branchStep = findIntegrationStep(steps, "integration_branch");
    if (branchStep && branchStep.status !== "completed") {
      recoveredKinds.push("integration_branch");
      steps = mapIntegrationStepByKind(steps, "integration_branch", (s) => ({
        ...s,
        status: "completed",
        completedAt: s.completedAt ?? input.nowIso,
        ...(input.plan?.integrationBranch ? { workBranch: input.plan.integrationBranch } : {}),
      }));
      timelineEntries.push(
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_integration_branch_state_recovered",
          orchestrationTraceGroup: "implementation_integration",
          fields: {
            projectId: input.projectId,
            integrationBranch: input.plan?.integrationBranch ?? undefined,
            reason: "integration_branch_exists_with_included_targets",
          },
          nowIso: input.nowIso,
        }),
      );
    }
  }

  if (hasMergeEvidence) {
    const wiringStep = findIntegrationStep(steps, "final_wiring");
    if (wiringStep && wiringStep.status !== "completed") {
      recoveredKinds.push("final_wiring");
      steps = mapIntegrationStepByKind(steps, "final_wiring", (s) => ({
        ...s,
        status: "completed",
        completedAt: s.completedAt ?? input.nowIso,
        commitSha: input.plan?.baseCommitSha ?? s.commitSha ?? null,
      }));
      timelineEntries.push(
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_integration_final_wiring_state_recovered",
          orchestrationTraceGroup: "implementation_integration",
          fields: {
            projectId: input.projectId,
            integrationBranch: input.plan?.integrationBranch ?? undefined,
            reason: "merge_or_preview_evidence",
          },
          nowIso: input.nowIso,
        }),
      );
    }
  }

  if (!recoveredKinds.length) {
    return {
      steps: input.steps,
      recovered: false,
      recoveredKinds: [],
      timelineEntries: [],
    };
  }

  timelineEntries.push(
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
  );

  return {
    steps,
    recovered: true,
    recoveredKinds,
    timelineEntries,
  };
}
