import type { ImplementationExecutionBoardTaskRowV1 } from "@/lib/prototype/implementationExecutionBoard";

export type ImplementationTaskCriticality =
  | "foundation"
  | "common"
  | "mock"
  | "screen"
  | "feature"
  | "leaf";

export function classifyImplementationTaskCriticality(input: {
  readonly taskId: string;
  readonly taskType?: string;
}): ImplementationTaskCriticality {
  const taskId = input.taskId.trim().toUpperCase();
  const taskType = String(input.taskType ?? "").trim().toLowerCase();
  if (taskId.startsWith("DEV-MOCK") || taskType === "mock") return "mock";
  if (taskId.startsWith("DEV-COMMON")) return "common";
  if (taskType === "mock" || taskType === "state" || taskType === "security" || taskType === "scm") {
    return "foundation";
  }
  if (taskId.startsWith("DEV-SCREEN") || taskType === "screen") return "screen";
  if (taskType === "feature") return "feature";
  return "leaf";
}

export function collectDependentTaskIds(input: {
  readonly taskRows: readonly ImplementationExecutionBoardTaskRowV1[];
  readonly failedTaskIds: readonly string[];
  readonly transitive?: boolean;
}): readonly string[] {
  const failed = new Set(
    input.failedTaskIds.map((id) => String(id ?? "").trim()).filter(Boolean),
  );
  if (!failed.size) return [];

  const byId = new Map(input.taskRows.map((row) => [row.taskId, row]));
  const blocked = new Set<string>();
  let frontier = [...failed];

  while (frontier.length) {
    const nextFrontier: string[] = [];
    for (const row of input.taskRows) {
      if (blocked.has(row.taskId) || failed.has(row.taskId)) continue;
      if (!row.dependencies.some((dep) => failed.has(dep) || blocked.has(dep))) continue;
      blocked.add(row.taskId);
      if (input.transitive !== false) nextFrontier.push(row.taskId);
    }
    frontier = nextFrontier;
  }

  return [...blocked].sort((a, b) => a.localeCompare(b));
}

export function isTaskBlockedByFailedDependencies(input: {
  readonly row: ImplementationExecutionBoardTaskRowV1;
  readonly failedTaskIds: readonly string[];
  readonly blockedTaskIds?: readonly string[];
}): boolean {
  const failed = new Set(
    input.failedTaskIds.map((id) => String(id ?? "").trim()).filter(Boolean),
  );
  const blocked = new Set(
    (input.blockedTaskIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean),
  );
  return input.row.dependencies.some((dep) => failed.has(dep) || blocked.has(dep));
}

export function countTasksBlockedByDependency(input: {
  readonly taskRows: readonly ImplementationExecutionBoardTaskRowV1[];
}): number {
  const failedTaskIds = input.taskRows
    .filter((row) => row.developerStatus === "failed")
    .map((row) => row.taskId);
  const blockedIds = new Set(
    collectDependentTaskIds({ taskRows: input.taskRows, failedTaskIds }),
  );
  return input.taskRows.filter(
    (row) =>
      row.developerStatus !== "done" &&
      row.developerStatus !== "skipped" &&
      row.developerStatus !== "failed" &&
      blockedIds.has(row.taskId),
  ).length;
}

export function shouldStopAutoChainForFoundationFailure(input: {
  readonly failedTaskId: string;
  readonly taskRows: readonly ImplementationExecutionBoardTaskRowV1[];
  readonly nextTaskId: string | null;
}): boolean {
  if (input.nextTaskId) return false;
  const criticality = classifyImplementationTaskCriticality({ taskId: input.failedTaskId });
  if (criticality === "foundation" || criticality === "common") return true;
  const dependents = collectDependentTaskIds({
    taskRows: input.taskRows,
    failedTaskIds: [input.failedTaskId],
  });
  const remaining = input.taskRows.filter(
    (row) =>
      row.taskId !== input.failedTaskId &&
      row.developerStatus !== "done" &&
      row.developerStatus !== "skipped" &&
      row.developerStatus !== "failed",
  );
  if (!remaining.length) return true;
  return remaining.every((row) => dependents.includes(row.taskId));
}
