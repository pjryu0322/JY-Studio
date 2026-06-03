import {
  CODE_TASK_EXECUTION_QUEUE_VERSION,
  parseCodeTaskExecutionQueueV1,
  type CodeTaskExecutionQueueStatus,
  type CodeTaskExecutionQueueV1,
} from "@/lib/prototype/codeTaskExecutionQueue";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import { getImplementationRuntimeCodeTaskQueue } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueService";
import {
  isImplementationRuntimeQueueItemInFlight,
  isImplementationRuntimeQueueItemTerminal,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueTypes";

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

function resolveCurrentIndexFromQueueItems(
  items: readonly { readonly codeTaskId: string; readonly status: string }[],
  currentCodeTaskId: string | null,
): number {
  if (!items.length) return 0;
  if (currentCodeTaskId) {
    const idx = items.findIndex((i) => i.codeTaskId === currentCodeTaskId);
    if (idx >= 0) return idx;
  }
  const firstOpen = items.findIndex((i) => !isImplementationRuntimeQueueItemTerminal(i.status));
  if (firstOpen >= 0) return firstOpen;
  return Math.max(0, items.length - 1);
}

/** DB snapshot wins; JSON only before job / idle UI. No JSON advance when DB job is active. */
export function resolveEffectiveCodeTaskExecutionQueue(input: {
  readonly dbQueueSnapshot: CodeTaskExecutionQueueV1 | null | undefined;
  readonly jsonQueue: unknown;
  readonly dbJobStatus?: string | null;
}): CodeTaskExecutionQueueV1 | null {
  if (input.dbQueueSnapshot) return input.dbQueueSnapshot;
  const jobStatus = input.dbJobStatus?.trim() ?? "";
  if (jobStatus === "running" || jobStatus === "paused") {
    return null;
  }
  return parseCodeTaskExecutionQueueV1(input.jsonQueue) ?? null;
}

/** DB Runtime Queue → legacy JSON snapshot for UI (cache only, not SoT). */
export async function buildCodeTaskExecutionQueueSnapshotFromDbJob(input: {
  readonly bundle: ImplementationRuntimeBundleView;
  readonly nowIso?: string;
}): Promise<CodeTaskExecutionQueueV1 | null> {
  const job = input.bundle.job;
  if (!job?.id) return null;
  const items = await getImplementationRuntimeCodeTaskQueue(job.id);
  if (!items.length) {
    const selected = job.selectedCodeTaskIds;
    if (!selected.length) return null;
    const nowIso = input.nowIso ?? new Date().toISOString();
    return {
      version: CODE_TASK_EXECUTION_QUEUE_VERSION,
      projectId: job.projectId,
      selectedCodeTaskIds: selected,
      currentIndex: resolveCurrentIndexFromQueueItems(
        selected.map((id) => ({ codeTaskId: id, status: "queued" })),
        job.currentCodeTaskId,
      ),
      status: mapJobStatusToQueueStatus(job.status),
      createdAt: nowIso,
      updatedAt: job.updatedAt ?? nowIso,
      stopOnFailure: true,
    };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const inFlight = items.some((i) => isImplementationRuntimeQueueItemInFlight(i.status));
  let status = mapJobStatusToQueueStatus(job.status);
  if (job.status === "running" && inFlight) status = "running";

  return {
    version: CODE_TASK_EXECUTION_QUEUE_VERSION,
    projectId: job.projectId,
    selectedCodeTaskIds: items.map((i) => i.codeTaskId),
    currentIndex: resolveCurrentIndexFromQueueItems(items, job.currentCodeTaskId),
    status,
    createdAt: nowIso,
    updatedAt: job.updatedAt ?? nowIso,
    stopOnFailure: true,
  };
}
