/**
 * Deterministic execution-facing parity snapshots (legacy vs bridge start).
 * Read models only; does not call executionService beyond inputs supplied by callers.
 */

import type { ExecutionReadinessResult } from "../../mvp/orchestration/orchestrationService";
import type { ExecutionRun } from "../../mvp/contracts/mvpExecutionTypes";
import type { MvpRunDetailDto, MvpRunSummaryDto, MvpExecutionStepDto } from "../../mvp/contracts/mvpDtos";
import type { MvpRunSummaryProjection } from "../../mvp/execution/mvpRunSummary";
import type { MvpRunInspectionViewModel } from "../../mvp/orchestration/mvpRunInspectionViewModel";
import type { Task } from "../../mvp/task/taskService";
import {
  postStartInspectionComparableShape,
  postStartRunDetailComparableShape,
  postStartRunSummaryComparableShape,
  postStartStepLogComparableShape,
  promptRelevantExecutableTaskShape,
} from "./bridgePostStartParitySnapshot";

export type ExecutionParitySnapshot = Readonly<{
  readiness: { projectId: string; isReady: boolean; blockers: readonly string[] };
  runLive: {
    status: ExecutionRun["status"];
    currentTaskIndex: number;
    failureReason: string;
    tasks: readonly { taskId: string; status: string; retryCount: number }[];
  };
  summaryProjection: {
    runStatus: MvpRunSummaryProjection["runStatus"];
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    currentTaskId: string | null;
    totalStepCount: number;
  } | null;
  summaryDto: ReturnType<typeof postStartRunSummaryComparableShape>;
  runDetail: ReturnType<typeof postStartRunDetailComparableShape>;
  steps: ReturnType<typeof postStartStepLogComparableShape>;
  inspection: ReturnType<typeof postStartInspectionComparableShape>;
  /** Indirect prompt/reviewer-relevant registry slice (ids, titles, screenId, purpose, order). */
  downstreamTaskInputs: ReturnType<typeof promptRelevantExecutableTaskShape>;
  visibleTaskIdsOrdered: string;
  executableTaskIdsOrdered: string;
}>;

export type BuildExecutionParitySnapshotInput = {
  readonly readiness: ExecutionReadinessResult;
  readonly runLive: ExecutionRun & { failureReason?: string };
  readonly summaryProjection: MvpRunSummaryProjection | null;
  readonly summaryDto: MvpRunSummaryDto | null;
  readonly runDetail: MvpRunDetailDto | null;
  readonly steps: readonly Pick<MvpExecutionStepDto, "sequence" | "stepType" | "taskId" | "status">[];
  readonly inspection: MvpRunInspectionViewModel;
  readonly executableTasks: readonly Task[];
  readonly visibleTaskIdsOrdered: string;
  readonly executableTaskIdsOrdered: string;
};

export function buildExecutionParitySnapshot(input: BuildExecutionParitySnapshotInput): ExecutionParitySnapshot {
  const sp = input.summaryProjection;
  return {
    readiness: {
      projectId: input.readiness.projectId,
      isReady: input.readiness.isReady,
      blockers: [...input.readiness.blockers].sort(),
    },
    runLive: {
      status: input.runLive.status,
      currentTaskIndex: input.runLive.currentTaskIndex,
      failureReason: input.runLive.failureReason ?? "",
      tasks: input.runLive.tasks.map((t) => ({
        taskId: t.taskId,
        status: t.status,
        retryCount: t.retryCount,
      })),
    },
    summaryProjection: sp
      ? {
          runStatus: sp.runStatus,
          totalTasks: sp.totalTasks,
          completedTasks: sp.completedTasks,
          failedTasks: sp.failedTasks,
          currentTaskId: sp.currentTaskId,
          totalStepCount: sp.totalStepCount,
        }
      : null,
    summaryDto: postStartRunSummaryComparableShape(input.summaryDto),
    runDetail: postStartRunDetailComparableShape(input.runDetail),
    steps: postStartStepLogComparableShape(input.steps),
    inspection: postStartInspectionComparableShape(input.inspection),
    downstreamTaskInputs: promptRelevantExecutableTaskShape(input.executableTasks),
    visibleTaskIdsOrdered: input.visibleTaskIdsOrdered,
    executableTaskIdsOrdered: input.executableTaskIdsOrdered,
  };
}

export function compareExecutionParitySnapshots(a: ExecutionParitySnapshot, b: ExecutionParitySnapshot): boolean {
  return stableJson(a) === stableJson(b);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}
