import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import { updateBoardSelectedCodeTaskIds } from "@/lib/prototype/implementationExecutionBoardState";
import { normalizeSelectedCodeTaskIds } from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";

/** Persisted JSON field remains `selectedCodeTaskIds`; UI/checkbox SoT name is checked. */
export function readBoardCheckedCodeTaskIds(
  boardState: ImplementationExecutionBoardStateV1 | null | undefined,
): readonly string[] {
  if (!boardState) return [];
  if (Object.prototype.hasOwnProperty.call(boardState, "selectedCodeTaskIds")) {
    return boardState.selectedCodeTaskIds ?? [];
  }
  return [];
}

/** Alias for persist — writes `implementationExecutionBoardStateV1.selectedCodeTaskIds`. */
/** Checkbox selection normalized against plan (persist field: selectedCodeTaskIds). */
export function normalizeCheckedCodeTaskIds(input: {
  readonly checkedCodeTaskIds?: readonly string[] | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly legacySelectedTaskIds?: readonly string[] | null;
}): readonly string[] {
  return normalizeSelectedCodeTaskIds({
    selectedCodeTaskIds: input.checkedCodeTaskIds,
    codeTaskPlan: input.codeTaskPlan,
    legacySelectedTaskIds: input.legacySelectedTaskIds,
  });
}

export function updateBoardCheckedCodeTaskIds(input: {
  readonly state: ImplementationExecutionBoardStateV1 | null | undefined;
  readonly projectId: string;
  readonly checkedCodeTaskIds: readonly string[];
  readonly nowIso?: string;
}): ImplementationExecutionBoardStateV1 {
  return updateBoardSelectedCodeTaskIds({
    state: input.state,
    projectId: input.projectId,
    selectedCodeTaskIds: input.checkedCodeTaskIds,
    nowIso: input.nowIso,
  });
}
