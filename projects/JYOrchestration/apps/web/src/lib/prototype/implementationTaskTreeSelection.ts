import type { ImplementationExecutionBoardTaskRowV1 } from "@/lib/prototype/implementationExecutionBoard";

export type ImplementationTaskTreeDependencyView = Readonly<{
  readonly depth: number;
  readonly parentTaskIds: readonly string[];
  readonly parentLabels: readonly string[];
}>;

export function collectAncestorTaskIds(
  _taskId: string,
  _taskRows: readonly ImplementationExecutionBoardTaskRowV1[],
): readonly string[] {
  return [];
}

export function computeTaskTreeDependencyViews(
  taskRows: readonly ImplementationExecutionBoardTaskRowV1[],
): ReadonlyMap<string, ImplementationTaskTreeDependencyView> {
  const flat: ImplementationTaskTreeDependencyView = {
    depth: 0,
    parentTaskIds: [],
    parentLabels: [],
  };
  return new Map(taskRows.map((row) => [row.taskId, flat]));
}

export function orderTaskRowsForTreeDisplay(
  taskRows: readonly ImplementationExecutionBoardTaskRowV1[],
): readonly ImplementationExecutionBoardTaskRowV1[] {
  return [...taskRows];
}

export function resolveDefaultSelectedTaskIds(
  taskRows: readonly ImplementationExecutionBoardTaskRowV1[],
): readonly string[] {
  return taskRows.map((row) => row.taskId);
}

export function normalizeSelectedTaskIds(input: {
  readonly selectedTaskIds: readonly string[] | null | undefined;
  readonly taskRows: readonly ImplementationExecutionBoardTaskRowV1[];
}): readonly string[] {
  const validIds = new Set(input.taskRows.map((row) => row.taskId));
  const normalized = (input.selectedTaskIds ?? [])
    .map((taskId) => String(taskId ?? "").trim())
    .filter((taskId) => validIds.has(taskId));
  if (normalized.length) return [...new Set(normalized)];
  return resolveDefaultSelectedTaskIds(input.taskRows);
}

export function resolveTaskTreeSelectionToggle(input: {
  readonly taskId: string;
  readonly checked: boolean;
  readonly selectedTaskIds: readonly string[];
  readonly taskRows: readonly ImplementationExecutionBoardTaskRowV1[];
}): readonly string[] {
  const taskId = input.taskId.trim();
  const current = new Set(input.selectedTaskIds);
  if (input.checked) {
    current.add(taskId);
  } else {
    current.delete(taskId);
  }
  const validIds = new Set(input.taskRows.map((row) => row.taskId));
  return [...current].filter((id) => validIds.has(id)).sort((a, b) => a.localeCompare(b));
}

export function resolveTaskTreeSelectAll(input: {
  readonly selectAll: boolean;
  readonly taskRows: readonly ImplementationExecutionBoardTaskRowV1[];
}): readonly string[] {
  return input.selectAll ? resolveDefaultSelectedTaskIds(input.taskRows) : [];
}

export function isTaskTreeFullySelected(input: {
  readonly selectedTaskIds: readonly string[];
  readonly taskRows: readonly ImplementationExecutionBoardTaskRowV1[];
}): boolean {
  if (!input.taskRows.length) return false;
  const selected = new Set(input.selectedTaskIds);
  return input.taskRows.every((row) => selected.has(row.taskId));
}
