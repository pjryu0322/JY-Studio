import {
  CODE_TASK_EXECUTION_QUEUE_VERSION,
  type CodeTaskExecutionQueueStatus,
  type CodeTaskExecutionQueueV1,
} from "@/lib/prototype/codeTaskExecutionQueue";
import { isTerminalRuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeStateMachine";
import type {
  ImplementationRuntimeBundleView,
  ImplementationRuntimeRunView,
  RuntimeState,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import { isRuntimeInFlight } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

function mapJobStatusToQueueStatus(jobStatus: string): CodeTaskExecutionQueueStatus {
  switch (jobStatus) {
    case "running":
      return "running";
    case "paused":
      return "paused";
    case "completed":
      return "completed";
    case "completed_with_issues":
      return "completed_with_issues";
    case "failed":
      return "failed";
    default:
      return "idle";
  }
}

function latestRunPerCodeTaskId(
  runs: readonly ImplementationRuntimeRunView[],
): ReadonlyMap<string, ImplementationRuntimeRunView> {
  const map = new Map<string, ImplementationRuntimeRunView>();
  for (const run of runs) {
    map.set(run.codeTaskId, run);
  }
  return map;
}

function resolveCurrentIndex(
  selectedCodeTaskIds: readonly string[],
  currentCodeTaskId: string | null,
  runsByTask: ReadonlyMap<string, ImplementationRuntimeRunView>,
): number {
  if (!selectedCodeTaskIds.length) return 0;
  if (currentCodeTaskId) {
    const idx = selectedCodeTaskIds.indexOf(currentCodeTaskId);
    if (idx >= 0) return idx;
  }
  const firstOpen = selectedCodeTaskIds.findIndex((id) => {
    const run = runsByTask.get(id);
    return !run || !isTerminalRuntimeState(run.runtimeState);
  });
  if (firstOpen >= 0) return firstOpen;
  return Math.max(0, selectedCodeTaskIds.length - 1);
}

function jobHasInFlightRun(
  selectedCodeTaskIds: readonly string[],
  runsByTask: ReadonlyMap<string, ImplementationRuntimeRunView>,
): boolean {
  for (const codeTaskId of selectedCodeTaskIds) {
    const state = (runsByTask.get(codeTaskId)?.runtimeState ?? "queued") as RuntimeState;
    if (isRuntimeInFlight(state) || state === "dispatching") return true;
  }
  return false;
}

/**
 * DB Job이 순차 실행의 유일한 SoT. 아래 JSON 큐는 예전 requirementsState 호환용 뷰일 뿐이다.
 * 화면 선택 N개 → start_job selectedCodeTaskIds N개 → Job.selectedCodeTaskIdsJson.
 */
/** DB job + runs → legacy JSON queue snapshot (UI cache only). */
export function buildCodeTaskExecutionQueueSnapshotFromDbJob(input: {
  readonly bundle: ImplementationRuntimeBundleView;
  readonly nowIso?: string;
}): CodeTaskExecutionQueueV1 | null {
  const job = input.bundle.job;
  if (!job?.id) return null;
  const selectedCodeTaskIds = job.selectedCodeTaskIds;
  if (!selectedCodeTaskIds.length) return null;

  const runsByTask = latestRunPerCodeTaskId(input.bundle.runs);
  const nowIso = input.nowIso ?? new Date().toISOString();
  let status = mapJobStatusToQueueStatus(job.status);
  if (job.status === "running" && jobHasInFlightRun(selectedCodeTaskIds, runsByTask)) {
    status = "running";
  }

  return {
    version: CODE_TASK_EXECUTION_QUEUE_VERSION,
    projectId: job.projectId,
    selectedCodeTaskIds,
    currentIndex: resolveCurrentIndex(
      selectedCodeTaskIds,
      job.currentCodeTaskId,
      runsByTask,
    ),
    status,
    createdAt: nowIso,
    updatedAt: job.updatedAt ?? nowIso,
    stopOnFailure: true,
  };
}

/** DB Job만 SoT. requirementsState JSON 큐는 사용하지 않는다. */
export function resolveEffectiveCodeTaskExecutionQueue(input: {
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
}): CodeTaskExecutionQueueV1 | null {
  if (!input.dbBundle?.job?.id) return null;
  return buildCodeTaskExecutionQueueSnapshotFromDbJob({ bundle: input.dbBundle });
}
