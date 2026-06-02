import type { ImplementationExecutionBoardTaskRowV1 } from "@/lib/prototype/implementationExecutionBoard";

export type ImplementationTaskTreeDependencyView = Readonly<{
  readonly depth: number;
  readonly parentTaskIds: readonly string[];
  readonly parentLabels: readonly string[];
}>;

export function collectAncestorTaskIds(
  taskId: string,
  taskRows: readonly ImplementationExecutionBoardTaskRowV1[],
): readonly string[] {
  const normalizedTaskId = taskId.trim();
  if (!normalizedTaskId) return [];
  const byId = new Map(taskRows.map((row) => [row.taskId, row]));
  const ancestors = new Set<string>();
  const visit = (currentId: string, visiting: Set<string>) => {
    const row = byId.get(currentId);
    if (!row) return;
    for (const dep of row.dependencies) {
      const depId = String(dep ?? "").trim();
      if (!depId || depId === normalizedTaskId || visiting.has(depId)) continue;
      if (ancestors.has(depId)) continue;
      ancestors.add(depId);
      visiting.add(depId);
      visit(depId, visiting);
      visiting.delete(depId);
    }
  };
  visit(normalizedTaskId, new Set([normalizedTaskId]));
  return [...ancestors].sort((a, b) => a.localeCompare(b));
}

export function computeTaskTreeDependencyViews(
  taskRows: readonly ImplementationExecutionBoardTaskRowV1[],
): ReadonlyMap<string, ImplementationTaskTreeDependencyView> {
  const byId = new Map(taskRows.map((row) => [row.taskId, row]));
  const cache = new Map<string, ImplementationTaskTreeDependencyView>();

  const resolve = (taskId: string, visiting: Set<string>): ImplementationTaskTreeDependencyView => {
    const cached = cache.get(taskId);
    if (cached) return cached;
    if (visiting.has(taskId)) {
      return { depth: 0, parentTaskIds: [], parentLabels: [] };
    }
    visiting.add(taskId);
    const row = byId.get(taskId);
    const parentTaskIds = [...new Set((row?.dependencies ?? []).map((dep) => String(dep ?? "").trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
    const parentLabels = parentTaskIds.map((parentId) => {
      const parent = byId.get(parentId);
      return parent ? parent.title : parentId;
    });
    const depth =
      parentTaskIds.length === 0
        ? 0
        : 1 + Math.max(...parentTaskIds.map((parentId) => resolve(parentId, visiting).depth));
    const view = { depth, parentTaskIds, parentLabels };
    cache.set(taskId, view);
    visiting.delete(taskId);
    return view;
  };

  for (const row of taskRows) {
    resolve(row.taskId, new Set());
  }
  return cache;
}

export function orderTaskRowsForTreeDisplay(
  taskRows: readonly ImplementationExecutionBoardTaskRowV1[],
): readonly ImplementationExecutionBoardTaskRowV1[] {
  const byId = new Map(taskRows.map((row) => [row.taskId, row]));
  const ordered: ImplementationExecutionBoardTaskRowV1[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (taskId: string) => {
    if (visited.has(taskId) || visiting.has(taskId)) return;
    visiting.add(taskId);
    const row = byId.get(taskId);
    if (!row) {
      visiting.delete(taskId);
      return;
    }
    for (const dep of row.dependencies) {
      const depId = String(dep ?? "").trim();
      if (depId) visit(depId);
    }
    visiting.delete(taskId);
    if (visited.has(taskId)) return;
    visited.add(taskId);
    ordered.push(row);
  };

  for (const row of taskRows) {
    visit(row.taskId);
  }
  return ordered;
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
    for (const ancestorId of collectAncestorTaskIds(taskId, input.taskRows)) {
      current.add(ancestorId);
    }
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
