import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { isRunSuccessTerminalForSelectedQueueContinuation } from "@/lib/prototype/codeTaskQuickRunContinuationTerminal";
import {
  classifyCodeTaskBranchGroup,
  workBranchForGroup,
} from "@/lib/prototype/codeTaskBranchGroupPlanner";
import type { CodeTaskConflictPlanV1 } from "@/lib/prototype/codeTaskFileConflictPlanner";
import type {
  CodeTaskBranchGroupV1,
  CodeTaskBranchPlanV1,
  ImplementationBranchPlanGroupV1,
  ImplementationBranchPlanV1,
} from "@/lib/prototype/implementationBranchPlan";
import {
  DEFAULT_BRANCH_PLAN_EXECUTION_ORDER,
  IMPLEMENTATION_BRANCH_PLAN_VERSION,
} from "@/lib/prototype/implementationBranchPlan";
import type {
  ImplementationCodeTaskPlanV1,
  ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { isInFlightCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";

const GROUP_TITLES: Record<CodeTaskBranchGroupV1, string> = {
  foundation: "Foundation / App Shell",
  data: "Sample & data",
  common: "Common UI components",
  feature: "Feature logic",
  screen: "Screen UI",
  integration: "Integration wiring",
};

export function buildImplementationBranchPlan(input: {
  readonly projectId: string;
  readonly baseBranch: string;
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly conflictPlan?: CodeTaskConflictPlanV1 | null;
  readonly nowIso: string;
  readonly targetRepository?: string | null;
  readonly useProjectPrefixInWorkBranch?: boolean;
}): {
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly branchPlan: ImplementationBranchPlanV1;
} {
  const usePrefix = input.useProjectPrefixInWorkBranch === true;
  const executionOrder = [...DEFAULT_BRANCH_PLAN_EXECUTION_ORDER];
  const workBranchByGroup = new Map<CodeTaskBranchGroupV1, string>();
  for (const group of executionOrder) {
    workBranchByGroup.set(group, workBranchForGroup(group, input.projectId, usePrefix));
  }

  const baseBranchByGroup = new Map<CodeTaskBranchGroupV1, string>();
  baseBranchByGroup.set("foundation", input.baseBranch.trim() || "main");
  for (let i = 1; i < executionOrder.length; i += 1) {
    const prev = executionOrder[i - 1]!;
    const cur = executionOrder[i]!;
    baseBranchByGroup.set(cur, workBranchByGroup.get(prev) ?? input.baseBranch);
  }

  const tasksByGroup = new Map<CodeTaskBranchGroupV1, ImplementationCodeTaskV1[]>();
  for (const task of input.codeTasks) {
    const group = classifyCodeTaskBranchGroup({ codeTask: task });
    const list = tasksByGroup.get(group) ?? [];
    list.push(task);
    tasksByGroup.set(group, list);
  }

  const lastTaskIdByGroup = new Map<CodeTaskBranchGroupV1, string>();
  const patchedTasks: ImplementationCodeTaskV1[] = [];

  for (const group of executionOrder) {
    const tasksInGroup = tasksByGroup.get(group) ?? [];
    const workBranch = workBranchByGroup.get(group)!;
    const baseBranch = baseBranchByGroup.get(group)!;
    const prevGroupIndex = executionOrder.indexOf(group) - 1;
    const dependsOnBranchGroups =
      prevGroupIndex >= 0 ? [executionOrder[prevGroupIndex]!] : [];

    let prevInGroupId: string | null = null;
    for (const task of tasksInGroup) {
      const boundary = parseCodeTaskFileBoundaryV1(task.fileBoundary);
      const branchPlan: CodeTaskBranchPlanV1 = {
        branchGroup: group,
        workBranch,
        baseBranch,
        baseBranchPolicy: group === "foundation" ? "main" : "previous_group",
        executionMode: group === "integration" ? "integration_only" : "sequential",
        dependsOnBranchGroups,
        ...(boundary?.sharedFiles?.length ? { requiresIntegrationChange: false } : {}),
      };

      const codeTaskDependencies = [...(task.codeTaskDependencies ?? [])];
      const dependencies = [...(task.dependencies ?? [])];
      if (prevInGroupId) {
        if (!codeTaskDependencies.includes(prevInGroupId)) codeTaskDependencies.push(prevInGroupId);
        if (!dependencies.includes(prevInGroupId)) dependencies.push(prevInGroupId);
      } else if (prevGroupIndex >= 0) {
        const anchor = lastTaskIdByGroup.get(executionOrder[prevGroupIndex]!);
        if (anchor) {
          if (!codeTaskDependencies.includes(anchor)) codeTaskDependencies.push(anchor);
          if (!dependencies.includes(anchor)) dependencies.push(anchor);
        }
      }

      patchedTasks.push({
        ...task,
        branchPlan,
        codeTaskDependencies,
        dependencies,
      });
      prevInGroupId = task.codeTaskId;
    }
    if (prevInGroupId) lastTaskIdByGroup.set(group, prevInGroupId);
  }

  const patchedIds = new Set(patchedTasks.map((t) => t.codeTaskId));
  for (const task of input.codeTasks) {
    if (!patchedIds.has(task.codeTaskId)) patchedTasks.push(task);
  }

  const groups: ImplementationBranchPlanGroupV1[] = executionOrder
    .map((groupId) => {
      const tasksInGroup = patchedTasks.filter((t) => t.branchPlan?.branchGroup === groupId);
      if (!tasksInGroup.length) return null;
      const boundaryFiles = tasksInGroup.flatMap((t) => {
        const b = parseCodeTaskFileBoundaryV1(t.fileBoundary);
        return b ? [...b.ownedFiles] : [];
      });
      return {
        groupId,
        title: GROUP_TITLES[groupId],
        workBranch: workBranchByGroup.get(groupId)!,
        baseBranch: baseBranchByGroup.get(groupId)!,
        codeTaskIds: tasksInGroup.map((t) => t.codeTaskId),
        policy: groupId === "integration" ? ("integration_only" as const) : ("sequential" as const),
        ownedFiles: [...new Set(boundaryFiles)],
        forbiddenFiles: [],
        conflictGroupIds: [
          ...new Set(
            tasksInGroup
              .map((t) => parseCodeTaskFileBoundaryV1(t.fileBoundary)?.conflictGroupId)
              .filter(Boolean) as string[],
          ),
        ],
      };
    })
    .filter(Boolean) as ImplementationBranchPlanGroupV1[];

  const branchPlan: ImplementationBranchPlanV1 = {
    version: IMPLEMENTATION_BRANCH_PLAN_VERSION,
    projectId: input.projectId.trim(),
    baseBranch: input.baseBranch.trim() || "main",
    createdAt: input.nowIso,
    groups,
    executionOrder,
    ...(input.targetRepository ? { targetRepository: input.targetRepository } : {}),
  };

  return { codeTasks: patchedTasks, branchPlan };
}

export function applyBranchPlanToCodeTaskPlan(input: {
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly baseBranch?: string;
  readonly targetRepository?: string | null;
  readonly nowIso?: string;
}): ImplementationCodeTaskPlanV1 {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const built = buildImplementationBranchPlan({
    projectId: input.plan.projectId,
    baseBranch: input.baseBranch ?? "main",
    codeTasks: input.plan.tasks,
    conflictPlan: input.plan.codeTaskConflictPlanV1 ?? null,
    nowIso,
    targetRepository: input.targetRepository ?? null,
  });
  return {
    ...input.plan,
    tasks: built.codeTasks,
    implementationBranchPlanV1: built.branchPlan,
    updatedAt: nowIso,
  };
}

export function sortCodeTaskIdsByBranchPlan(
  plan: ImplementationCodeTaskPlanV1 | null | undefined,
  codeTaskIds: readonly string[],
): readonly string[] {
  const unique = [...new Set(codeTaskIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length || !plan?.tasks.length) return unique;
  const order = plan.implementationBranchPlanV1?.executionOrder ?? DEFAULT_BRANCH_PLAN_EXECUTION_ORDER;
  const groupRank = new Map(order.map((g, i) => [g, i] as const));
  const taskRank = new Map(plan.tasks.map((t, i) => [t.codeTaskId, i] as const));
  return unique.sort((a, b) => {
    const ta = plan.tasks.find((t) => t.codeTaskId === a);
    const tb = plan.tasks.find((t) => t.codeTaskId === b);
    const ga = groupRank.get(ta?.branchPlan?.branchGroup ?? "feature") ?? 99;
    const gb = groupRank.get(tb?.branchPlan?.branchGroup ?? "feature") ?? 99;
    if (ga !== gb) return ga - gb;
    return (taskRank.get(a) ?? 0) - (taskRank.get(b) ?? 0);
  });
}

export function codeTaskPlanHasBranchPlan(plan: ImplementationCodeTaskPlanV1 | null | undefined): boolean {
  if (!plan) return false;
  if (plan.implementationBranchPlanV1?.groups.length) return true;
  return plan.tasks.some((t) => Boolean(t.branchPlan?.workBranch));
}

export function isCodeTaskDoneForBranchPlanQueue(
  run: CodeTaskExecutionRunV1 | null | undefined,
): boolean {
  return isRunSuccessTerminalForSelectedQueueContinuation(run);
}

export function isCodeTaskRunnableByBranchPlan(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTaskId: string;
  readonly runs: readonly CodeTaskExecutionRunV1[];
}): boolean {
  if (!codeTaskPlanHasBranchPlan(input.codeTaskPlan)) return true;
  const plan = input.codeTaskPlan!;
  const codeTaskId = input.codeTaskId.trim();
  const task = plan.tasks.find((t) => t.codeTaskId === codeTaskId);
  const group = task?.branchPlan?.branchGroup;
  if (!task?.branchPlan?.workBranch) return false;

  const order = plan.implementationBranchPlanV1?.executionOrder ?? DEFAULT_BRANCH_PLAN_EXECUTION_ORDER;
  const groupIdx = order.indexOf(group!);
  const selected = new Set(input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean));

  if (groupIdx > 0) {
    for (let gi = 0; gi < groupIdx; gi += 1) {
      const priorGroup = order[gi]!;
      for (const row of plan.tasks) {
        if (row.branchPlan?.branchGroup !== priorGroup || !selected.has(row.codeTaskId)) continue;
        const run = findLatestRunForCodeTask(input.runs, row.codeTaskId);
        if (!isCodeTaskDoneForBranchPlanQueue(run)) return false;
      }
    }
  }

  const conflictGroupId = parseCodeTaskFileBoundaryV1(task.fileBoundary)?.conflictGroupId;
  if (conflictGroupId) {
    for (const row of plan.tasks) {
      if (row.codeTaskId === codeTaskId || !selected.has(row.codeTaskId)) continue;
      const otherGroup = parseCodeTaskFileBoundaryV1(row.fileBoundary)?.conflictGroupId;
      if (otherGroup !== conflictGroupId) continue;
      const run = findLatestRunForCodeTask(input.runs, row.codeTaskId);
      if (run && isInFlightCodeTaskExecutionRunStatus(run.status)) return false;
    }
  }

  return true;
}
