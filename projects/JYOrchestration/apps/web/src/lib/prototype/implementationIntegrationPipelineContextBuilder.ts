import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import { isIntegrationWiringCodeTask } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  INTEGRATION_FINAL_WIRING_WORK_BRANCH,
  type ImplementationIntegrationStepV1,
} from "@/lib/prototype/implementationIntegrationStep";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";
import type {
  ProjectIntegrationPipelineContextV1,
  ProjectIntegrationPipelineTriggerV1,
} from "@/lib/prototype/integrationPipelineContext";

function resolveLatestVerifiedWorkBranch(snapshot: ImplementationRuntimeSnapshotV1): string {
  const verified = [...snapshot.units]
    .filter((u) => u.displayStatus === "verified")
    .sort((a, b) => b.order - a.order);
  const fromUnit = verified[0]?.workBranch?.trim();
  if (fromUnit) return fromUnit;
  return snapshot.units[0]?.workBranch?.trim() || "main";
}

function resolveIntegrationTargetBranch(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly integrationSteps: readonly ImplementationIntegrationStepV1[];
}): string {
  const fromStep = input.integrationSteps.find((s) => s.kind === "final_wiring")?.workBranch?.trim();
  if (fromStep) return fromStep;
  const wiringTask = input.codeTaskPlan?.tasks?.find((t) => isIntegrationWiringCodeTask(t));
  const bp = parseCodeTaskBranchPlanV1(wiringTask?.branchPlan);
  return String(bp?.workBranch ?? INTEGRATION_FINAL_WIRING_WORK_BRANCH).trim();
}

export function buildImplementationIntegrationPipelineContext(input: {
  readonly projectId: string;
  readonly trigger: ProjectIntegrationPipelineTriggerV1;
  readonly baseBranch: string;
  readonly snapshot: ImplementationRuntimeSnapshotV1;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly integrationSteps: readonly ImplementationIntegrationStepV1[];
  readonly createPullRequest?: boolean;
  readonly nowIso?: string;
}): ProjectIntegrationPipelineContextV1 {
  const targetBranch = resolveIntegrationTargetBranch({
    codeTaskPlan: input.codeTaskPlan,
    integrationSteps: input.integrationSteps,
  });
  const trigger =
    input.trigger === "auto_after_codetasks_verified"
      ? "implementation_codetasks_completed"
      : input.trigger;

  return {
    projectId: input.projectId.trim(),
    stage: "implementation",
    trigger,
    mode: "initial_preview",
    sourceBranch: resolveLatestVerifiedWorkBranch(input.snapshot),
    targetBranch,
    baseBranch: input.baseBranch.trim() || "main",
    integrationBranch: targetBranch,
    createPullRequest: input.createPullRequest === true,
    requestedBy: "user",
    nowIso: input.nowIso,
  };
}
