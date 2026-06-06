import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { inferCodeTaskFileBoundary } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import {
  buildCodeTaskFileConflictPlan,
  type CodeTaskConflictPlanV1,
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
  const tasks: ImplementationCodeTaskV1[] = input.plan.tasks.map((task) => {
    const existing = parseCodeTaskFileBoundaryV1(task.fileBoundary) ?? null;
    if (existing) return task;
    const parentTitle = taskTitleById(input.taskList, task.parentTaskId);
    const fileBoundary = inferCodeTaskFileBoundary({
      codeTask: task,
      parentTaskTitle: parentTitle ?? null,
    });
    const forbiddenPaths = [
      ...new Set([...(task.forbiddenPaths ?? []), ...fileBoundary.forbiddenFiles.slice(0, 8)]),
    ];
    return { ...task, fileBoundary, forbiddenPaths };
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

export function ensureCodeTaskPlanWithFileBoundaries(input: {
  readonly plan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
}): ImplementationCodeTaskPlanV1 | null {
  if (!input.plan) return null;
  const needsRepair = input.plan.tasks.some((t) => !parseCodeTaskFileBoundaryV1(t.fileBoundary));
  if (!needsRepair && input.plan.codeTaskConflictPlanV1) return input.plan;
  return repairCodeTaskPlanFileBoundaries({
    plan: input.plan,
    taskList: input.taskList,
  }).plan;
}
