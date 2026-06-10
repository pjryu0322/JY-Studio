import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  codeTaskPlanHasBranchPlan,
  sortCodeTaskIdsByBranchPlan,
} from "@/lib/prototype/implementationBranchPlanBuilder";
import { expandProcessTaskIdsToCodeTaskIds } from "@/lib/prototype/codeTaskExecutionQueue";
import {
  isMockCodeTaskId,
  remapSelectedCodeTaskIdFromMockToPlan,
} from "@/lib/prototype/codeTaskCanonicalId";
import {
  ensureSampleDataCodeTaskIncludedInSelection,
} from "@/lib/prototype/sampleDataCodeTaskPlanner";
import { listVisibleImplementationCodeTaskIds } from "@/lib/prototype/implementationCodeTaskSummary";
/** implementationCodeTaskPlanV1.tasks 문서 순서(트리/기획 순). Quick Run Job SoT. */
export function sortCodeTaskIdsByImplementationPlanOrder(
  codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined,
  codeTaskIds: readonly string[],
): readonly string[] {
  const unique = [...new Set(codeTaskIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return [];
  if (codeTaskPlan && codeTaskPlanHasBranchPlan(codeTaskPlan)) {
    return sortCodeTaskIdsByBranchPlan(codeTaskPlan, unique);
  }
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

export const QUICK_RUN_MOCK_CODE_TASK_ID_BLOCKED_MESSAGE =
  "선택된 CodeTask에 테스트용 mock ID가 포함되어 Quick 실행을 시작할 수 없습니다.";

export type PrepareSelectedCodeTaskIdsForQuickRunResult =
  | Readonly<{
      readonly status: "ok";
      readonly selectedCodeTaskIds: readonly string[];
      readonly repairs: readonly Readonly<{ readonly fromCodeTaskId: string; readonly toCodeTaskId: string }>[];
    }>
  | Readonly<{
      readonly status: "blocked";
      readonly codeTaskId: string;
      readonly message: string;
    }>;

/** Quick Run 시작 전: mock ID repair 또는 차단 (P3-M60). */
export function prepareSelectedCodeTaskIdsForQuickRun(input: {
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly legacySelectedTaskIds?: readonly string[] | null;
}): PrepareSelectedCodeTaskIdsForQuickRunResult {
  const codeTasks = input.codeTaskPlan?.tasks ?? [];
  const repairs: Array<{ fromCodeTaskId: string; toCodeTaskId: string }> = [];

  if (input.selectedCodeTaskIds !== undefined && input.selectedCodeTaskIds !== null) {
    for (const raw of input.selectedCodeTaskIds) {
      const id = raw.trim();
      if (!id || !isMockCodeTaskId(id)) continue;
      const remapped = remapSelectedCodeTaskIdFromMockToPlan({ codeTaskId: id, codeTasks });
      if (!remapped || isMockCodeTaskId(remapped)) {
        return {
          status: "blocked",
          codeTaskId: id,
          message: `${QUICK_RUN_MOCK_CODE_TASK_ID_BLOCKED_MESSAGE}\ncodeTaskId: ${id}\nCodeTask 계획을 다시 생성하거나 normalization을 실행하세요.`,
        };
      }
      if (remapped !== id) {
        repairs.push({ fromCodeTaskId: id, toCodeTaskId: remapped });
      }
    }
  }

  const selectedCodeTaskIds = normalizeSelectedCodeTaskIds(input);
  const mockInSelection = selectedCodeTaskIds.find((id) => isMockCodeTaskId(id));
  if (mockInSelection) {
    return {
      status: "blocked",
      codeTaskId: mockInSelection,
      message: `${QUICK_RUN_MOCK_CODE_TASK_ID_BLOCKED_MESSAGE}\ncodeTaskId: ${mockInSelection}\nCodeTask 계획을 다시 생성하거나 normalization을 실행하세요.`,
    };
  }

  return { status: "ok", selectedCodeTaskIds, repairs };
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
      .map((id) => remapSelectedCodeTaskIdFromMockToPlan({ codeTaskId: id, codeTasks: input.codeTaskPlan?.tasks ?? [] }) ?? id)
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
  const merged = ensureSampleDataCodeTaskIncludedInSelection({
    selectedCodeTaskIds: [...current],
    codeTaskPlan: input.codeTaskPlan,
  });
  return sortCodeTaskIdsByImplementationPlanOrder(input.codeTaskPlan, merged);
}

/** Plan-visible CodeTasks in document order (excludes integration-only wiring). Not board runnable SoT. */
export function selectAllVisibleCodeTaskIdsInPlan(input: {
  readonly selectAll: boolean;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
}): readonly string[] {
  if (!input.selectAll) return [];
  return sortCodeTaskIdsByImplementationPlanOrder(
    input.codeTaskPlan,
    listVisibleImplementationCodeTaskIds(input.codeTaskPlan),
  );
}

export function resolveCodeTaskTreeSelectionToggle(input: {
  readonly codeTaskId: string;
  readonly checked: boolean;
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  /** CodeTask ids with status 대기 — only these may be checked by the user. */
  readonly userSelectableCodeTaskIds: readonly string[];
}): readonly string[] {
  const codeTaskId = input.codeTaskId.trim();
  if (!codeTaskId) {
    return normalizeSelectedCodeTaskIds({
      selectedCodeTaskIds: input.selectedCodeTaskIds,
      codeTaskPlan: input.codeTaskPlan,
    });
  }
  const selectableSet = new Set(input.userSelectableCodeTaskIds.map((id) => id.trim()).filter(Boolean));
  if (input.checked && !selectableSet.has(codeTaskId)) {
    return sortCodeTaskIdsByImplementationPlanOrder(
      input.codeTaskPlan,
      (input.selectedCodeTaskIds ?? []).map((id) => id.trim()).filter(Boolean),
    );
  }
  const current = new Set(
    (input.selectedCodeTaskIds ?? []).map((id) => id.trim()).filter(Boolean),
  );
  if (input.checked) current.add(codeTaskId);
  else current.delete(codeTaskId);
  return sortCodeTaskIdsByImplementationPlanOrder(input.codeTaskPlan, [...current]);
}

export function resolveCodeTaskTreeSelectAll(input: {
  readonly selectAll: boolean;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  /** All 대기 CodeTask ids on the board (select-all targets these). */
  readonly userSelectableCodeTaskIds: readonly string[];
}): readonly string[] {
  if (!input.selectAll) return [];
  return sortCodeTaskIdsByImplementationPlanOrder(input.codeTaskPlan, input.userSelectableCodeTaskIds);
}

export function resolveCodeTaskTreeSelectAllHeaderState(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly userSelectableCodeTaskIds: readonly string[];
}): Readonly<{
  readonly allChecked: boolean;
  readonly indeterminate: boolean;
  readonly selectedSelectableCount: number;
  readonly selectableCount: number;
}> {
  const selectable = input.userSelectableCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  const selected = new Set(input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean));
  const selectedSelectableCount = selectable.filter((id) => selected.has(id)).length;
  const selectableCount = selectable.length;
  return {
    allChecked: selectableCount > 0 && selectedSelectableCount === selectableCount,
    indeterminate: selectedSelectableCount > 0 && selectedSelectableCount < selectableCount,
    selectedSelectableCount,
    selectableCount,
  };
}

export function isCodeTaskTreeFullySelected(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly userSelectableCodeTaskIds: readonly string[];
}): boolean {
  return resolveCodeTaskTreeSelectAllHeaderState({
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    userSelectableCodeTaskIds: input.userSelectableCodeTaskIds,
  }).allChecked;
}

/** Next selection when the user activates the select-all checkbox (supports indeterminate). */
export function resolveCodeTaskTreeSelectAllToggleChecked(input: {
  readonly header: Readonly<{
    readonly allChecked: boolean;
    readonly indeterminate: boolean;
  }>;
  readonly nextInputChecked: boolean;
}): boolean {
  if (input.header.allChecked) {
    return false;
  }
  return input.nextInputChecked;
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
