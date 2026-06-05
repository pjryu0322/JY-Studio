import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { expandProcessTaskIdsToCodeTaskIds } from "@/lib/prototype/codeTaskExecutionQueue";

/** implementationCodeTaskPlanV1.tasks 문서 순서(트리/기획 순). Quick Run Job SoT. */
export function sortCodeTaskIdsByImplementationPlanOrder(
  codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined,
  codeTaskIds: readonly string[],
): readonly string[] {
  const unique = [...new Set(codeTaskIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return [];
  if (!codeTaskPlan?.tasks?.length) {
    return unique.sort((a, b) => a.localeCompare(b));
  }
  const rank = new Map<string, number>();
  for (let i = 0; i < codeTaskPlan.tasks.length; i += 1) {
    const id = codeTaskPlan.tasks[i]!.codeTaskId.trim();
    if (id && !rank.has(id)) rank.set(id, i);
  }
  return unique.sort((a, b) => {
    const ra = rank.get(a) ?? 1_000_000;
    const rb = rank.get(b) ?? 1_000_000;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

export function listCodeTaskIdsFromPlan(
  codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined,
): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of codeTaskPlan?.tasks ?? []) {
    const id = t.codeTaskId.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function resolveParentTaskIdForCodeTask(input: {
  readonly codeTaskId: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
}): string | null {
  const codeTaskId = input.codeTaskId.trim();
  if (!codeTaskId || !input.codeTaskPlan) return null;
  const task = input.codeTaskPlan.tasks.find((t) => t.codeTaskId.trim() === codeTaskId);
  const parentId = task?.parentTaskId?.trim() ?? "";
  return parentId || null;
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
    .filter(Boolean);
}

export function normalizeSelectedCodeTaskIds(input: {
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly legacySelectedTaskIds?: readonly string[] | null;
}): readonly string[] {
  const validIds = new Set(listCodeTaskIdsFromPlan(input.codeTaskPlan));
  if (!validIds.size) return [];

  // IMPORTANT:
  // - `undefined/null` means "not set yet" → fall back to legacy / default selection.
  // - `[]` means "explicitly empty selection" → keep empty (do NOT default to all).
  if (input.selectedCodeTaskIds !== undefined && input.selectedCodeTaskIds !== null) {
    const explicit = input.selectedCodeTaskIds
      .map((id) => id.trim())
      .filter((id) => validIds.has(id));
    return sortCodeTaskIdsByImplementationPlanOrder(input.codeTaskPlan, explicit);
  }

  const legacy = expandProcessTaskIdsToCodeTaskIds({
    codeTaskPlan: input.codeTaskPlan!,
    processTaskIds: (input.legacySelectedTaskIds ?? []).map((id) => id.trim()).filter(Boolean),
  }).filter((id) => validIds.has(id));
  if (legacy.length) {
    return sortCodeTaskIdsByImplementationPlanOrder(input.codeTaskPlan, legacy);
  }

  return [];
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
  if (!childIds.length) {
    return normalizeSelectedCodeTaskIds({
      selectedCodeTaskIds: input.selectedCodeTaskIds,
      codeTaskPlan: input.codeTaskPlan,
    });
  }

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
  return sortCodeTaskIdsByImplementationPlanOrder(input.codeTaskPlan, [...current]);
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
  return sortCodeTaskIdsByImplementationPlanOrder(input.codeTaskPlan, [...current]);
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
