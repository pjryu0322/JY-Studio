/**
 * Deterministic, execution-facing snapshots for bridge vs legacy post-start parity
 * (read models only; no executionService changes).
 */

import type { MvpRunDetailDto, MvpRunSummaryDto, MvpExecutionStepDto } from "../../mvp/contracts/mvpDtos";
import type { MvpRunInspectionViewModel } from "../../mvp/orchestration/mvpRunInspectionViewModel";
import type { Task } from "../../mvp/task/taskService";

/** Run detail fields used by inspection / status (excludes runId). */
export function postStartRunDetailComparableShape(detail: MvpRunDetailDto | null): Record<string, unknown> | null {
  if (!detail) {
    return null;
  }
  return {
    runStatus: detail.runStatus,
    currentTaskId: detail.currentTaskId,
    tasks: detail.tasks.map((t) => ({
      taskId: t.taskId,
      status: t.status,
      retryCount: t.retryCount,
    })),
    totalStepCount: detail.totalStepCount,
    retrySummary: detail.retrySummary,
    stepFlowSummary: detail.stepFlowSummary ?? "",
  };
}

/** Summary counters and flow fields (excludes runId and failure payloads). */
export function postStartRunSummaryComparableShape(summary: MvpRunSummaryDto | null): Record<string, unknown> | null {
  if (!summary) {
    return null;
  }
  return {
    runStatus: summary.runStatus,
    totalTasks: summary.totalTasks,
    completedTasks: summary.completedTasks,
    failedTasks: summary.failedTasks,
    currentTaskId: summary.currentTaskId,
    totalStepCount: summary.totalStepCount,
  };
}

/** Step log shape: sequence order, types, task linkage (no timestamps/messages). */
export function postStartStepLogComparableShape(
  steps: readonly Pick<MvpExecutionStepDto, "sequence" | "stepType" | "taskId" | "status">[]
): readonly { sequence: number; stepType: string; taskId: string; status: string }[] {
  return steps.map((s) => ({
    sequence: s.sequence,
    stepType: s.stepType,
    taskId: s.taskId,
    status: s.status,
  }));
}

/** Inspection VM without run identity fields that differ per start. */
export function postStartInspectionComparableShape(vm: MvpRunInspectionViewModel): Record<string, unknown> {
  return {
    readiness: {
      projectId: vm.readiness.projectId,
      isReady: vm.readiness.isReady,
      blockers: [...vm.readiness.blockers].sort(),
    },
    runSummary: postStartRunSummaryComparableShape(vm.runSummary),
    runDetail: postStartRunDetailComparableShape(vm.runDetail),
    steps: postStartStepLogComparableShape(vm.steps),
    stepFlowSummary: vm.stepFlowSummary,
  };
}

/** Fields that feed prompt generation for each executable task (registry snapshot). */
export function promptRelevantExecutableTaskShape(tasks: readonly Task[]): readonly Record<string, unknown>[] {
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    screenId: t.screenId ?? null,
    finalOrder: t.finalOrder,
    type: t.type,
    status: t.status,
    taskPurpose: t.taskPurpose ?? null,
  }));
}
