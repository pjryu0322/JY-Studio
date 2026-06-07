import type { CodeTaskConflictPlanV1 } from "@/lib/prototype/codeTaskFileConflictPlanner";
import {
  INTEGRATION_WIRING_CODE_TASK_ID,
  appendIntegrationWiringCodeTaskToPlan,
  normalizeIntegrationTasksInPlan,
  planHasIntegrationWiringCodeTask,
} from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { repairCodeTaskPlanFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import { normalizeProductionCodeTaskPlan } from "@/lib/prototype/implementationCodeTaskPlanNormalizer";
import type { ImplementationBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import { applyBranchPlanToCodeTaskPlan } from "@/lib/prototype/implementationBranchPlanBuilder";
import type {
  ImplementationCodeTaskPlanV1,
  ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import {
  evaluateStageOnePromptPlanReadiness,
  type StageOnePromptPreparationDiagnosticV1,
} from "@/lib/prototype/stageOnePromptReadiness";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

function isIntegrationLikeTask(task: ImplementationCodeTaskV1): boolean {
  if (task.codeTaskId === INTEGRATION_WIRING_CODE_TASK_ID) return true;
  if (task.changeType === "integration") return true;
  if (task.branchPlan?.branchGroup === "integration") return true;
  return /최종 연결|통합\s*wiring/i.test(task.title);
}

export function stripIntegrationTasksForReappend(
  tasks: readonly ImplementationCodeTaskV1[],
): ImplementationCodeTaskV1[] {
  return tasks.filter((t) => !isIntegrationLikeTask(t));
}

export function sortCodeTasksByBranchPlanOrder(
  plan: ImplementationCodeTaskPlanV1,
): ImplementationCodeTaskPlanV1 {
  const order = plan.implementationBranchPlanV1?.executionOrder ?? [];
  if (!order.length) return plan;
  const groupRank = new Map(order.map((g, i) => [g, i] as const));
  const indexInOriginal = new Map(plan.tasks.map((t, i) => [t.codeTaskId, i] as const));
  const sorted = [...plan.tasks].sort((a, b) => {
    const ga = groupRank.get(a.branchPlan?.branchGroup ?? "feature") ?? 99;
    const gb = groupRank.get(b.branchPlan?.branchGroup ?? "feature") ?? 99;
    if (ga !== gb) return ga - gb;
    return (indexInOriginal.get(a.codeTaskId) ?? 0) - (indexInOriginal.get(b.codeTaskId) ?? 0);
  });
  return { ...plan, tasks: sorted };
}

export function prepareCodeTaskPlanForStageOnePrompt(input: {
  readonly projectId: string;
  readonly baseBranch: string;
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly targetRepository?: string | null;
  readonly nowIso?: string;
  readonly envOk?: boolean;
  readonly designOk?: boolean;
}): Readonly<{
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly branchPlan: ImplementationBranchPlanV1 | null;
  readonly conflictPlan: CodeTaskConflictPlanV1 | null;
  readonly diagnostics: readonly StageOnePromptPreparationDiagnosticV1[];
  readonly readiness: ReturnType<typeof evaluateStageOnePromptPlanReadiness>;
}> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const strippedTasks = stripIntegrationTasksForReappend(input.plan.tasks);
  let plan: ImplementationCodeTaskPlanV1 = {
    ...input.plan,
    tasks: strippedTasks,
    codeTaskCount: strippedTasks.length,
    updatedAt: nowIso,
  };

  plan = appendIntegrationWiringCodeTaskToPlan({
    plan,
    taskList: input.taskList ?? null,
    envOk: input.envOk ?? true,
    designOk: input.designOk ?? true,
  });

  const fileRepair = repairCodeTaskPlanFileBoundaries({
    plan,
    taskList: input.taskList ?? null,
  });
  plan = fileRepair.plan;

  const normalized = normalizeProductionCodeTaskPlan({ plan, nowIso });
  plan = normalized.plan;

  plan = applyBranchPlanToCodeTaskPlan({
    plan,
    baseBranch: input.baseBranch.trim() || "main",
    targetRepository: input.targetRepository ?? null,
    nowIso,
  });

  plan = sortCodeTasksByBranchPlanOrder(plan);

  plan = normalizeIntegrationTasksInPlan(plan);

  if (!planHasIntegrationWiringCodeTask(plan.tasks)) {
    plan = appendIntegrationWiringCodeTaskToPlan({
      plan,
      taskList: input.taskList ?? null,
      envOk: input.envOk ?? true,
      designOk: input.designOk ?? true,
    });
    plan = applyBranchPlanToCodeTaskPlan({
      plan,
      baseBranch: input.baseBranch.trim() || "main",
      targetRepository: input.targetRepository ?? null,
      nowIso,
    });
    plan = sortCodeTasksByBranchPlanOrder(plan);
  }

  const readiness = evaluateStageOnePromptPlanReadiness({ plan });

  return {
    plan,
    branchPlan: plan.implementationBranchPlanV1 ?? null,
    conflictPlan: plan.codeTaskConflictPlanV1 ?? fileRepair.conflictPlan ?? null,
    diagnostics: readiness.diagnostics,
    readiness,
  };
}
