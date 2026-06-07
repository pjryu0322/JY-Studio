import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { runHasVerifiedGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { isIntegrationWiringCodeTask } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { listCodeTaskIdsFromPlan } from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";

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
  if (run.status === "skipped_by_user") return true;
  return runHasVerifiedGithubOutcome(run);
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
  readonly taskList?: import("@/lib/requirements/implementationTaskList").ImplementationTaskListV1 | null;
  readonly workItemCount?: number;
}): ImplementationCodeTaskSummaryCountsV1 {
  const fromUnits = buildImplementationExecutionSummaryCounts({
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    legacySelectedTaskIds: input.legacySelectedTaskIds,
    runs: input.runs,
    workItemCount: input.workItemCount,
  });
  return {
    totalCodeTaskCount: fromUnits.totalCodeTaskCount,
    selectedCodeTaskCount: fromUnits.selectedCodeTaskCount,
    completedCodeTaskCount: fromUnits.completedCodeTaskCount,
    reconciledSelectedCodeTaskIds: fromUnits.reconciledSelectedCodeTaskIds,
    removedStaleSelectedIds: fromUnits.removedStaleSelectedIds,
    summaryCountReconciled: fromUnits.summaryCountReconciled,
  };
}
