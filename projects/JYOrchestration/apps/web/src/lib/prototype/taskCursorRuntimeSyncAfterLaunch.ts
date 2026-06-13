import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { ensureQueuedRuntimeRunForCodeTask } from "@/lib/prototype/implementationRuntimeRunMaterialization";
import { buildTaskCursorRuntimeSyncTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
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

/** Cursor Agent launch 성공 직후 DB Run(+ task cursor sync)을 같은 agentId·branch로 맞춘다. */
export async function syncCursorLaunchToDbRuntime(
  input: SyncCursorLaunchToDbRuntimeInput,
): Promise<{ readonly synced: boolean; readonly runId: string | null; readonly note?: string }> {
  const pid = input.projectId.trim();
  const codeTaskId = input.codeTaskId.trim();
  const agentId = input.agentId.trim();
  if (!pid || !codeTaskId || !agentId) {
    return { synced: false, runId: null, note: "missing_launch_context" };
  }

  const now = input.now ?? new Date();
  let bundle = await getImplementationRuntimeBundle(pid);
  let job = bundle.job;
  if (!job?.id || job.status !== "running") {
    return { synced: false, runId: null, note: "active_implementation_runtime_job_missing" };
  }

  let run =
    bundle.runs.find((r) => r.codeTaskId === codeTaskId) ??
    (job.currentCodeTaskId === codeTaskId ? bundle.currentRun : null);

  if (!run) {
    try {
      const ensured = await ensureQueuedRuntimeRunForCodeTask({
        projectId: pid,
        codeTaskId,
        processTaskId: input.taskId.trim() || null,
      });
      bundle = ensured.bundle;
      job = bundle.job;
      run =
        bundle.runs.find((r) => r.id === ensured.runId) ??
        bundle.runs.find((r) => r.codeTaskId === codeTaskId) ??
        bundle.currentRun;
    } catch {
      return { synced: false, runId: null, note: "runtime_queued_run_materialization_failed" };
    }
  }

  if (!run || !job?.id) {
    return { synced: false, runId: null, note: "runtime_run_not_found" };
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

  await syncImplementationRuntimeFromTaskCursor({
    projectId: pid,
    codeTaskId,
    taskId: input.taskId,
    execution: input.execution,
    now,
  });

  await scheduleImplementationRuntimePoll({
    runId: run.id,
    now,
    firstPollAfterCursorDispatch: true,
  });

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
