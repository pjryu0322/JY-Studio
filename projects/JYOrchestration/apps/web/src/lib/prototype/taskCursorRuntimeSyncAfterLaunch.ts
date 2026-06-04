import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { buildTaskCursorRuntimeSyncTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import {
  markImplementationRuntimeCodeTaskQueueItemCursorRequested,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueService";
import { markImplementationRuntimeCursorRunning } from "@/lib/runtime/implementationRuntime/implementationRuntimeCursorService";
import { scheduleImplementationRuntimePoll } from "@/lib/runtime/implementationRuntime/implementationRuntimePollRepository";
import { syncImplementationRuntimeFromTaskCursor } from "@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync";

export type SyncCursorLaunchToDbRuntimeInput = Readonly<{
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly taskId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly agentId: string;
  readonly targetRepository?: ProjectTargetRepository | string | null;
  readonly baseBranch?: string | null;
  readonly workBranch?: string | null;
  readonly now?: Date;
}>;

/** Cursor Agent launch 성공 직후 DB Run/Queue/JSON runtime을 같은 agentId·branch로 맞춘다. */
export async function syncCursorLaunchToDbRuntime(
  input: SyncCursorLaunchToDbRuntimeInput,
): Promise<{ readonly synced: boolean; readonly runId: string | null }> {
  const pid = input.projectId.trim();
  const codeTaskId = input.codeTaskId.trim();
  const agentId = input.agentId.trim();
  if (!pid || !codeTaskId || !agentId) {
    return { synced: false, runId: null };
  }

  const now = input.now ?? new Date();
  const bundle = await getImplementationRuntimeBundle(pid);
  const job = bundle.job;
  if (!job || job.status !== "running") {
    return { synced: false, runId: null };
  }

  const run =
    bundle.runs.find((r) => r.codeTaskId === codeTaskId) ??
    (job.currentCodeTaskId === codeTaskId ? bundle.currentRun : null);
  if (!run) {
    return { synced: false, runId: null };
  }

  const repoFullName =
    typeof input.targetRepository === "string"
      ? input.targetRepository
      : input.targetRepository?.repoFullName ?? input.execution.targetRepository ?? null;
  const baseBranch = input.baseBranch ?? input.execution.baseBranch ?? null;
  const workBranch =
    input.workBranch ?? input.execution.workBranch ?? run.branchName ?? null;

  if (run.runtimeState === "queued" || run.runtimeState === "dispatching") {
    await markImplementationRuntimeCursorRunning({
      projectId: pid,
      jobId: job.id,
      runId: run.id,
      cursorAgentId: agentId,
      branchName: workBranch,
      now,
    });
  }

  await markImplementationRuntimeCodeTaskQueueItemCursorRequested({
    jobId: job.id,
    codeTaskId,
    cursorRequestId: agentId,
    cursorRunId: agentId,
    targetRepository: repoFullName,
    baseBranch,
    workBranch,
    now,
  });

  await syncImplementationRuntimeFromTaskCursor({
    projectId: pid,
    codeTaskId,
    taskId: input.taskId,
    execution: input.execution,
    now,
  });

  await scheduleImplementationRuntimePoll({ runId: run.id, now });

  return { synced: true, runId: run.id };
}

export function buildRuntimeSyncAfterLaunchTimelineEntry(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly codeTaskId: string;
  readonly agentId: string;
  readonly nowIso?: string;
}) {
  return buildTaskCursorRuntimeSyncTimelineEntry({
    action: "task_cursor_runtime_sync_after_launch",
    projectId: input.projectId,
    taskId: input.taskId,
    codeTaskId: input.codeTaskId,
    agentId: input.agentId,
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
}
