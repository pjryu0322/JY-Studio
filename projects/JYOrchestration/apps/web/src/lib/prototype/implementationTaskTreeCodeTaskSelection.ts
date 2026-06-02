import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { expandProcessTaskIdsToCodeTaskIds } from "@/lib/prototype/codeTaskExecutionQueue";

export function listCodeTaskIdsFromPlan(
  codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined,
): readonly string[] {
  return [...new Set((codeTaskPlan?.tasks ?? []).map((t) => t.codeTaskId.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
}

export function resolveCodeTaskIdsForParentTask(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly parentTaskId: string;
}): readonly string[] {
  const parentId = input.parentTaskId.trim();
  if (!parentId || !input.codeTaskPlan) return [];
  return input.codeTaskPlan.tasks
    .filter((t) => t.parentTaskId.trim() === parentId)
    .map((t) => t.codeTaskId.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function normalizeSelectedCodeTaskIds(input: {
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly legacySelectedTaskIds?: readonly string[] | null;
}): readonly string[] {
  const validIds = new Set(listCodeTaskIdsFromPlan(input.codeTaskPlan));
  if (!validIds.size) return [];

  const explicit = (input.selectedCodeTaskIds ?? [])
    .map((id) => id.trim())
    .filter((id) => validIds.has(id));
  if (explicit.length) return [...new Set(explicit)].sort((a, b) => a.localeCompare(b));

  const legacy = expandProcessTaskIdsToCodeTaskIds({
    codeTaskPlan: input.codeTaskPlan!,
    processTaskIds: (input.legacySelectedTaskIds ?? []).map((id) => id.trim()).filter(Boolean),
  }).filter((id) => validIds.has(id));
  if (legacy.length) return [...new Set(legacy)].sort((a, b) => a.localeCompare(b));

  return listCodeTaskIdsFromPlan(input.codeTaskPlan);
}

export function resolveProcessTaskCodeTaskSelectionToggle(input: {
  readonly parentTaskId: string;
  readonly checked: boolean;
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
}): readonly string[] {
  const childIds = resolveCodeTaskIdsForParentTask({
    codeTaskPlan: input.codeTaskPlan,
    parentTaskId: input.parentTaskId,
  });
  if (!childIds.length) return normalizeSelectedCodeTaskIds({
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    codeTaskPlan: input.codeTaskPlan,
  });

  const current = new Set(
    normalizeSelectedCodeTaskIds({
      selectedCodeTaskIds: input.selectedCodeTaskIds,
      codeTaskPlan: input.codeTaskPlan,
    }),
  );
  for (const id of childIds) {
    if (input.checked) current.add(id);
    else current.delete(id);
  }
  return [...current].sort((a, b) => a.localeCompare(b));
}

export function resolveCodeTaskTreeSelectionToggle(input: {
  readonly codeTaskId: string;
  readonly checked: boolean;
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
}): readonly string[] {
  const codeTaskId = input.codeTaskId.trim();
  const current = new Set(
    normalizeSelectedCodeTaskIds({
      selectedCodeTaskIds: input.selectedCodeTaskIds,
      codeTaskPlan: input.codeTaskPlan,
    }),
  );
  if (input.checked) current.add(codeTaskId);
  else current.delete(codeTaskId);
  return [...current].sort((a, b) => a.localeCompare(b));
}

export function resolveCodeTaskTreeSelectAll(input: {
  readonly selectAll: boolean;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
}): readonly string[] {
  return input.selectAll ? listCodeTaskIdsFromPlan(input.codeTaskPlan) : [];
}

export function isCodeTaskTreeFullySelected(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
}): boolean {
  const all = listCodeTaskIdsFromPlan(input.codeTaskPlan);
  if (!all.length) return false;
  const selected = new Set(
    normalizeSelectedCodeTaskIds({
      selectedCodeTaskIds: input.selectedCodeTaskIds,
      codeTaskPlan: input.codeTaskPlan,
    }),
  );
  return all.every((id) => selected.has(id));
}

export function isProcessTaskCodeTasksFullySelected(input: {
  readonly parentTaskId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
}): boolean {
  const childIds = resolveCodeTaskIdsForParentTask({
    codeTaskPlan: input.codeTaskPlan,
    parentTaskId: input.parentTaskId,
  });
  if (!childIds.length) return false;
  const selected = new Set(
    normalizeSelectedCodeTaskIds({
      selectedCodeTaskIds: input.selectedCodeTaskIds,
      codeTaskPlan: input.codeTaskPlan,
    }),
  );
  return childIds.every((id) => selected.has(id));
}
