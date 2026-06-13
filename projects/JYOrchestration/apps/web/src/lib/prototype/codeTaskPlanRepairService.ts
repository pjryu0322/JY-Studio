import {
  dataBranchFileBoundaryNeedsSanitize,
  sanitizeDataBranchGroupFileBoundary,
} from "@/lib/prototype/codeTaskDataBoundaryNormalization";
import {
  planContainsLegacyMockCodeTaskId,
  repairLegacyMockCodeTaskIdsInPlan,
} from "@/lib/prototype/codeTaskCanonicalId";
import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { inferCodeTaskFileBoundary } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import { normalizeCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundaryNormalize";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import { ensureIntegrationWiringCodeTask, resolveCodeTaskPlanAggregateCounts } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { ensurePreviewUxWiringCodeTaskInPlan } from "@/lib/prototype/previewUxWiringCodeTaskPlanner";
import { prepareCodeTaskPlanForStageOnePrompt } from "@/lib/prototype/prepareCodeTaskPlanForStageOnePrompt";
import { integrationTaskIsLast } from "@/lib/prototype/stageOnePromptReadiness";
import {
  buildCodeTaskFileConflictPlan,
  type CodeTaskConflictPlanV1,
  storedConflictPlanHasStaleForbiddenBlocking,
} from "@/lib/prototype/codeTaskFileConflictPlanner";
import type {
  ImplementationCodeTaskPlanV1,
  ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export type RepairCodeTaskPlanFileBoundariesResult = Readonly<{
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly conflictPlan: CodeTaskConflictPlanV1;
  readonly summaryLines: readonly string[];
}>;

function taskTitleById(
  taskList: ImplementationTaskListV1 | null | undefined,
  parentTaskId: string,
): string | undefined {
  return taskList?.tasks?.find((t) => t.taskId === parentTaskId)?.title;
}

export function repairCodeTaskPlanFileBoundaries(input: {
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly taskList?: ImplementationTaskListV1 | null;
}): RepairCodeTaskPlanFileBoundariesResult {
  const mockRepairedTasks = repairLegacyMockCodeTaskIdsInPlan(input.plan.tasks);
  const tasks: ImplementationCodeTaskV1[] = mockRepairedTasks.map((task) => {
    const normalizedTask = ensureIntegrationWiringCodeTask(task);
    const existing = parseCodeTaskFileBoundaryV1(normalizedTask.fileBoundary) ?? null;
    if (existing) {
      return {
        ...normalizedTask,
        fileBoundary: normalizeCodeTaskFileBoundaryV1(existing)!,
      };
    }
    const parentTitle = taskTitleById(input.taskList, normalizedTask.parentTaskId);
    const fileBoundary = normalizeCodeTaskFileBoundaryV1(
      inferCodeTaskFileBoundary({
        codeTask: normalizedTask,
        parentTaskTitle: parentTitle ?? null,
      }),
    )!;
    const forbiddenPaths = [
      ...new Set([...(task.forbiddenPaths ?? []), ...fileBoundary.forbiddenFiles.slice(0, 8)]),
    ];
    return { ...normalizedTask, fileBoundary, forbiddenPaths };
  }).map((task) => {
    const branchGroup = parseCodeTaskBranchPlanV1(task.branchPlan)?.branchGroup;
    if (branchGroup !== "data" || !task.fileBoundary) return task;
    const boundary = parseCodeTaskFileBoundaryV1(task.fileBoundary);
    if (!boundary) return task;
    if (!dataBranchFileBoundaryNeedsSanitize(boundary)) return task;
    const sanitized = sanitizeDataBranchGroupFileBoundary(boundary);
    if (sanitized.blocked) return task;
    return {
      ...task,
      fileBoundary: sanitized.boundary,
      forbiddenPaths: [
        ...new Set([...(task.forbiddenPaths ?? []), ...sanitized.boundary.forbiddenFiles.slice(0, 12)]),
      ],
    };
  });

  let patchedTasks = [...tasks];
  const conflictPlan = buildCodeTaskFileConflictPlan(patchedTasks);
  for (const patch of conflictPlan.dependencyPatches) {
    patchedTasks = patchedTasks.map((t) => {
      if (t.codeTaskId !== patch.codeTaskId) return t;
      const codeTaskDependencies = [
        ...new Set([...(t.codeTaskDependencies ?? []), ...patch.addDependencies]),
      ];
      const dependencies = [
        ...new Set([...(t.dependencies ?? []), ...codeTaskDependencies]),
      ];
      return { ...t, codeTaskDependencies, dependencies };
    });
  }

  const withGroups = patchedTasks.map((t) => {
    const group = conflictPlan.conflictGroups.find((g) =>
      g.codeTaskIds.includes(t.codeTaskId),
    );
    if (!group || t.fileBoundary?.conflictGroupId) return t;
    return {
      ...t,
      fileBoundary: t.fileBoundary
        ? { ...t.fileBoundary, conflictGroupId: group.groupId }
        : t.fileBoundary,
    };
  });

  const groupedCount = conflictPlan.conflictGroups.reduce(
    (n, g) => n + g.codeTaskIds.length,
    0,
  );
  const shellForbiddenCount = withGroups.filter((t) =>
    (t.fileBoundary?.forbiddenFiles ?? []).some((p) => p.includes("WorkspaceShell")),
  ).length;

  const summaryLines: string[] = [];
  if (groupedCount) {
    summaryLines.push(
      `${input.plan.codeTaskCount}개 CodeTask 중 ${groupedCount}개가 conflict group으로 정리되었습니다.`,
    );
  }
  if (shellForbiddenCount) {
    summaryLines.push(`${shellForbiddenCount}개 Task는 Shell 직접 수정이 금지되었습니다.`);
  }
  if (conflictPlan.issues.some((i) => i.recommendation === "create_integration_task")) {
    summaryLines.push("Shell 연결은 Integration Task 또는 통합 단계에서 처리해야 합니다.");
  }

  return {
    plan: {
      ...input.plan,
      tasks: withGroups,
      codeTaskConflictPlanV1: conflictPlan,
      updatedAt: new Date().toISOString(),
    },
    conflictPlan,
    summaryLines,
  };
}

export function repairCodeTaskPlanWithBranchPlan(input: {
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly baseBranch?: string;
}): RepairCodeTaskPlanFileBoundariesResult {
  const prepared = prepareCodeTaskPlanForStageOnePrompt({
    projectId: input.plan.projectId,
    baseBranch: input.baseBranch ?? "main",
    plan: input.plan,
    taskList: input.taskList ?? null,
  });
  const groupSummary = prepared.branchPlan?.groups.map(
    (g) => `${g.groupId}: ${g.codeTaskIds.length}개`,
  );
  const readiness = prepared.readiness;
  const execTotal = resolveCodeTaskPlanAggregateCounts(prepared.plan.tasks).executableCodeTaskCount;
  return {
    plan: prepared.plan,
    conflictPlan: prepared.conflictPlan ?? input.plan.codeTaskConflictPlanV1 ?? buildCodeTaskFileConflictPlan(prepared.plan.tasks),
    summaryLines: [
      `Branch Plan 생성: ${readiness.branchPlanCount}/${execTotal}`,
      `File Boundary 생성: ${readiness.fileBoundaryCount}/${execTotal}`,
      `ready CodeTask: ${readiness.readyCodeTaskCount}/${execTotal}`,
      ...(groupSummary?.length
        ? [`Branch Plan 보정 완료 · ${groupSummary.join(" · ")}`]
        : []),
    ],
  };
}

function withRecomputedConflictPlanIfStale(
  plan: ImplementationCodeTaskPlanV1,
): ImplementationCodeTaskPlanV1 {
  if (!storedConflictPlanHasStaleForbiddenBlocking(plan.codeTaskConflictPlanV1)) {
    return plan;
  }
  return {
    ...plan,
    codeTaskConflictPlanV1: buildCodeTaskFileConflictPlan(plan.tasks),
    updatedAt: new Date().toISOString(),
  };
}

function finalizeCodeTaskPlanForRuntime(plan: ImplementationCodeTaskPlanV1): ImplementationCodeTaskPlanV1 {
  return ensurePreviewUxWiringCodeTaskInPlan(plan);
}

export function ensureCodeTaskPlanWithFileBoundaries(input: {
  readonly plan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly baseBranch?: string;
}): ImplementationCodeTaskPlanV1 | null {
  if (!input.plan) return null;
  const needsFileRepair = input.plan.tasks.some((t) => !parseCodeTaskFileBoundaryV1(t.fileBoundary));
  const needsBranch = input.plan.tasks.some((t) => !t.branchPlan?.workBranch?.trim());
  const needsSort =
    input.plan.tasks.length > 1 &&
    !integrationTaskIsLast(input.plan);
  const needsDataSanitize = input.plan.tasks.some((t) => {
    if (parseCodeTaskBranchPlanV1(t.branchPlan)?.branchGroup !== "data") return false;
    return dataBranchFileBoundaryNeedsSanitize(parseCodeTaskFileBoundaryV1(t.fileBoundary));
  });
  const needsMockIdRepair = planContainsLegacyMockCodeTaskId(input.plan.tasks);
  const needsConflictRecompute = storedConflictPlanHasStaleForbiddenBlocking(
    input.plan.codeTaskConflictPlanV1,
  );
  if (
    !needsFileRepair &&
    !needsBranch &&
    input.plan.codeTaskConflictPlanV1 &&
    !needsSort &&
    !needsDataSanitize &&
    !needsMockIdRepair &&
    !needsConflictRecompute
  ) {
    return finalizeCodeTaskPlanForRuntime(input.plan);
  }
  if (
    !needsFileRepair &&
    !needsBranch &&
    !needsSort &&
    !needsDataSanitize &&
    !needsMockIdRepair &&
    needsConflictRecompute
  ) {
    return finalizeCodeTaskPlanForRuntime(withRecomputedConflictPlanIfStale(input.plan));
  }
  return finalizeCodeTaskPlanForRuntime(
    repairCodeTaskPlanWithBranchPlan({
      plan: input.plan,
      taskList: input.taskList,
      baseBranch: input.baseBranch,
    }).plan,
  );
}
