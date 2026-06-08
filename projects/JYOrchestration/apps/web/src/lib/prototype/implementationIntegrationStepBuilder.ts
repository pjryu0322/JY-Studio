import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import { isIntegrationWiringCodeTask } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { INTEGRATION_WIRING_PROCESS_TASK_TITLE } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import {
  INTEGRATION_FINAL_WIRING_STEP_ID,
  INTEGRATION_FINAL_WIRING_WORK_BRANCH,
  type ImplementationIntegrationStepV1,
} from "@/lib/prototype/implementationIntegrationStep";

function resolveFinalWiringTask(plan: ImplementationCodeTaskPlanV1 | null | undefined) {
  if (!plan?.tasks?.length) return null;
  for (const task of plan.tasks) {
    const bp = parseCodeTaskBranchPlanV1(task.branchPlan);
    if (bp?.branchGroup === "integration" && bp.workBranch?.includes("final-wiring")) {
      return task;
    }
  }
  return plan.tasks.find((t) => isIntegrationWiringCodeTask(t)) ?? null;
}

export function buildDefaultIntegrationStepsFromBranchPlan(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly baseBranchFallback?: string | null;
}): readonly ImplementationIntegrationStepV1[] {
  const wiringTask = resolveFinalWiringTask(input.codeTaskPlan);
  if (!wiringTask) return [];
  const bp = parseCodeTaskBranchPlanV1(wiringTask.branchPlan);
  const baseBranch =
    String(bp?.baseBranch ?? input.baseBranchFallback ?? "wip/screen/workspace").trim() ||
    "wip/screen/workspace";
  const workBranch = String(bp?.workBranch ?? INTEGRATION_FINAL_WIRING_WORK_BRANCH).trim();
  return [
    {
      stepId: INTEGRATION_FINAL_WIRING_STEP_ID,
      kind: "final_wiring",
      title: INTEGRATION_WIRING_PROCESS_TASK_TITLE,
      status: "pending",
      order: 0,
      branchGroup: "integration",
      baseBranch,
      workBranch,
    },
    {
      stepId: "integration-branch",
      kind: "integration_branch",
      title: "통합 branch",
      status: "pending",
      order: 1,
      branchGroup: "integration",
      baseBranch,
      workBranch,
    },
    {
      stepId: "integration-build",
      kind: "build",
      title: "Build 검증",
      status: "pending",
      order: 2,
    },
    {
      stepId: "integration-app-preview-target",
      kind: "app_preview_target",
      title: "실제 앱 Preview",
      status: "pending",
      order: 3,
    },
  ];
}

export function buildIntegrationStepsBuiltTimeline(input: {
  readonly projectId: string;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const finalWiring = input.steps.find((s) => s.kind === "final_wiring");
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_integration_steps_built",
    orchestrationTraceGroup: "implementation_integration",
    fields: {
      projectId: input.projectId,
      stepCount: input.steps.length,
      finalWiringStepId: finalWiring?.stepId ?? null,
      finalWiringWorkBranch: finalWiring?.workBranch ?? null,
      source: "branch_plan",
    },
    nowIso: input.nowIso,
  });
}
