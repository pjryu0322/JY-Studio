import {
  DEFAULT_BRANCH_PLAN_EXECUTION_ORDER,
  type CodeTaskBranchGroupV1,
} from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { codeTaskHasPersistedBranchPlan, codeTaskHasPersistedFileBoundary } from "@/lib/prototype/stageOnePromptReadiness";

function branchGroupSortKey(group: CodeTaskBranchGroupV1 | undefined): number {
  if (!group) return 999;
  const idx = DEFAULT_BRANCH_PLAN_EXECUTION_ORDER.indexOf(group);
  return idx >= 0 ? idx : 999;
}

export function resolveExecutionTargetCodeTaskId(input: {
  readonly selectedCodeTaskId?: string | null;
  readonly runtimeCurrentCodeTaskId?: string | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
}): string | null {
  const selected = String(input.selectedCodeTaskId ?? "").trim();
  if (selected) return selected;
  const runtimeCurrent = String(input.runtimeCurrentCodeTaskId ?? "").trim();
  if (runtimeCurrent) return runtimeCurrent;
  const tasks = input.codeTaskPlan?.tasks ?? [];
  if (!tasks.length) return null;
  const sorted = [...tasks].sort((a, b) => {
    const ga = branchGroupSortKey(a.branchPlan?.branchGroup);
    const gb = branchGroupSortKey(b.branchPlan?.branchGroup);
    if (ga !== gb) return ga - gb;
    return a.codeTaskId.localeCompare(b.codeTaskId);
  });
  const ready = sorted.find(
    (t) => codeTaskHasPersistedBranchPlan(t) && codeTaskHasPersistedFileBoundary(t),
  );
  return ready?.codeTaskId ?? sorted[0]?.codeTaskId ?? null;
}
