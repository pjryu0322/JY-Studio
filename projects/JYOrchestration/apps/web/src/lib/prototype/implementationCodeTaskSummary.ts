import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { runHasVerifiedGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { isIntegrationWiringCodeTask } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import {
  listCodeTaskIdsFromPlan,
  normalizeSelectedCodeTaskIds,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";

export type ImplementationCodeTaskSummaryCountsV1 = Readonly<{
  readonly totalCodeTaskCount: number;
  readonly selectedCodeTaskCount: number;
  readonly completedCodeTaskCount: number;
  readonly reconciledSelectedCodeTaskIds: readonly string[];
  readonly removedStaleSelectedIds: readonly string[];
  readonly summaryCountReconciled: boolean;
}>;

/** Execution board / Quick Run 집계에 포함할 CodeTask (integration-only wiring 제외). */
export function listVisibleImplementationCodeTaskIds(
  codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined,
): readonly string[] {
  const visible = new Set<string>();
  for (const task of codeTaskPlan?.tasks ?? []) {
    const id = task.codeTaskId.trim();
    if (!id || visible.has(id)) continue;
    const bp = parseCodeTaskBranchPlanV1(task.branchPlan);
    if (bp?.executionMode === "integration_only" && isIntegrationWiringCodeTask(task)) continue;
    if (bp?.executionMode === "integration_only" && task.changeType === "integration") continue;
    visible.add(id);
  }
  if (visible.size) {
    return listCodeTaskIdsFromPlan(codeTaskPlan).filter((id) => visible.has(id));
  }
  return listCodeTaskIdsFromPlan(codeTaskPlan);
}

export function isCodeTaskCompletedForSummary(
  run: CodeTaskExecutionRunV1 | null | undefined,
): boolean {
  if (!run) return false;
  if (runHasVerifiedGithubOutcome(run)) return true;
  switch (run.status) {
    case "completed":
    case "no_code_change_completed":
    case "github_verified":
      return true;
    case "failed":
      return false;
    default:
      return false;
  }
}

export function countCompletedVisibleCodeTasks(input: {
  readonly visibleCodeTaskIds: readonly string[];
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
}): number {
  let n = 0;
  for (const codeTaskId of input.visibleCodeTaskIds) {
    const run = findLatestRunForCodeTask(input.runs, codeTaskId);
    if (isCodeTaskCompletedForSummary(run)) n += 1;
  }
  return n;
}

export function buildImplementationCodeTaskSummaryCounts(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly legacySelectedTaskIds?: readonly string[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
}): ImplementationCodeTaskSummaryCountsV1 {
  const visibleIds = listVisibleImplementationCodeTaskIds(input.codeTaskPlan);
  const totalCodeTaskCount = visibleIds.length;
  const visibleSet = new Set(visibleIds);

  const rawSelected = input.selectedCodeTaskIds ?? [];
  const removedStaleSelectedIds = rawSelected
    .map((id) => id.trim())
    .filter((id) => id && !visibleSet.has(id));

  const reconciledSelectedCodeTaskIds = normalizeSelectedCodeTaskIds({
    selectedCodeTaskIds: rawSelected,
    codeTaskPlan: input.codeTaskPlan,
    legacySelectedTaskIds: input.legacySelectedTaskIds,
  }).filter((id) => visibleSet.has(id));

  let selectedCodeTaskCount = reconciledSelectedCodeTaskIds.length;
  let summaryCountReconciled = removedStaleSelectedIds.length > 0;

  if (selectedCodeTaskCount > totalCodeTaskCount) {
    selectedCodeTaskCount = totalCodeTaskCount;
    summaryCountReconciled = true;
  }

  const completedInVisible = countCompletedVisibleCodeTasks({
    visibleCodeTaskIds: visibleIds,
    runs: input.runs,
  });

  const completedInSelected = countCompletedVisibleCodeTasks({
    visibleCodeTaskIds: reconciledSelectedCodeTaskIds.length ? reconciledSelectedCodeTaskIds : visibleIds,
    runs: input.runs,
  });

  let completedCodeTaskCount = reconciledSelectedCodeTaskIds.length
    ? completedInSelected
    : completedInVisible;

  if (completedCodeTaskCount > totalCodeTaskCount) {
    completedCodeTaskCount = totalCodeTaskCount;
    summaryCountReconciled = true;
  }

  return {
    totalCodeTaskCount,
    selectedCodeTaskCount,
    completedCodeTaskCount,
    reconciledSelectedCodeTaskIds,
    removedStaleSelectedIds,
    summaryCountReconciled,
  };
}
