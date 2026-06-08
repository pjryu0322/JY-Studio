import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { findLatestRunForCodeTask } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { isCodeTaskRunnableByBranchPlan } from "@/lib/prototype/implementationBranchPlanBuilder";
import {
  isRunBlockingSelectedQueueContinuation,
  isRunSuccessTerminalForSelectedQueueContinuation,
} from "@/lib/prototype/codeTaskQuickRunContinuationTerminal";
import {
  resolveNextExecutableUnit,
  mapSelectedCodeTaskIdsToExecutionUnitIds,
} from "@/lib/prototype/implementationExecutionScheduler";
import { loadImplementationExecutionUnitsFromState } from "@/lib/prototype/implementationExecutionUnitStore";
import { ensurePersistedImplementationExecutionUnits } from "@/lib/prototype/implementationExecutionRuntime";
import { buildExecutionUnitsFromLegacyState } from "@/lib/prototype/implementationExecutionUnitBuilder";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ResolveNextSelectedCodeTaskResultV1 =
  | Readonly<{ readonly status: "next_ready"; readonly codeTaskId: string }>
  | Readonly<{ readonly status: "all_completed" }>
  | Readonly<{
      readonly status: "blocked_by_dependency";
      readonly codeTaskId: string;
      readonly blockedBy: readonly string[];
    }>
  | Readonly<{
      readonly status: "blocked_by_failed_previous";
      readonly codeTaskId: string;
      readonly failedCodeTaskId: string;
    }>
  | Readonly<{ readonly status: "no_selected_queue" }>
  | Readonly<{ readonly status: "current_not_in_selected_queue" }>
  | Readonly<{
      readonly status: "current_not_success_terminal";
      readonly codeTaskId: string;
    }>;

export function resolveNextSelectedCodeTaskAfterVerified(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly currentCodeTaskId: string;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly executionRuns: readonly CodeTaskExecutionRunV1[];
  readonly projectId?: string | null;
  readonly requirementsState?: RequirementsStateJson | null;
}): ResolveNextSelectedCodeTaskResultV1 {
  const ids = input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  if (!ids.length) return { status: "no_selected_queue" };

  const current = input.currentCodeTaskId.trim();
  if (!current) return { status: "current_not_in_selected_queue" };
  const currentIdx = ids.indexOf(current);
  if (currentIdx < 0) return { status: "current_not_in_selected_queue" };

  const currentRun = findLatestRunForCodeTask(input.executionRuns, current);
  if (!isRunSuccessTerminalForSelectedQueueContinuation(currentRun)) {
    return { status: "current_not_success_terminal", codeTaskId: current };
  }

  const persisted = loadImplementationExecutionUnitsFromState(input.requirementsState);
  const units =
    persisted.length > 0
      ? persisted
      : input.projectId?.trim()
        ? ensurePersistedImplementationExecutionUnits({
            projectId: input.projectId.trim(),
            requirementsState: input.requirementsState,
            codeTaskPlan: input.codeTaskPlan,
            runs: input.executionRuns,
          }).units
        : buildExecutionUnitsFromLegacyState({
            codeTaskPlan: input.codeTaskPlan,
            runs: input.executionRuns,
          }).units;
  const selectedUnitIds = mapSelectedCodeTaskIdsToExecutionUnitIds(ids);
  const resolved = resolveNextExecutableUnit({ units, selectedUnitIds });
  if (resolved.status === "next") {
    return { status: "next_ready", codeTaskId: resolved.unit.codeTaskId };
  }
  if (resolved.status === "complete") {
    return { status: "all_completed" };
  }
  if (resolved.status === "blocked") {
    return {
      status: "blocked_by_dependency",
      codeTaskId: resolved.unit.codeTaskId,
      blockedBy: resolved.unit.dependencies,
    };
  }
  if (resolved.status === "in_flight") {
    return { status: "current_not_success_terminal", codeTaskId: current };
  }

  for (let i = currentIdx + 1; i < ids.length; i += 1) {
    const codeTaskId = ids[i]!;
    const run = findLatestRunForCodeTask(input.executionRuns, codeTaskId);
    if (isRunSuccessTerminalForSelectedQueueContinuation(run)) continue;
    if (isRunBlockingSelectedQueueContinuation(run)) {
      return {
        status: "blocked_by_failed_previous",
        codeTaskId,
        failedCodeTaskId: codeTaskId,
      };
    }
    const runnable = isCodeTaskRunnableByBranchPlan({
      codeTaskPlan: input.codeTaskPlan,
      selectedCodeTaskIds: ids,
      codeTaskId,
      runs: input.executionRuns,
    });
    if (!runnable) {
      return {
        status: "blocked_by_dependency",
        codeTaskId,
        blockedBy: ids.slice(0, i),
      };
    }
    return { status: "next_ready", codeTaskId };
  }

  return { status: "all_completed" };
}
