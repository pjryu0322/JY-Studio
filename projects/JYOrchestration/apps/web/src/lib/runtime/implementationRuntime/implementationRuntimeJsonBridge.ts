import { getCurrentQueueCodeTaskId, parseCodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import {
  findLatestRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { isRuntimeInFlight } from "@/lib/prototype/implementationRuntimeState";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import {
  createImplementationCodeTaskRun,
  createImplementationRuntimeJob,
  findActiveImplementationRuntimeJob,
  getImplementationRuntimeBundle,
  transitionImplementationCodeTaskRun,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import {
  markImplementationRuntimeCompleted,
  markImplementationRuntimeCursorRunning,
  markImplementationRuntimeDispatching,
  markImplementationRuntimeFailed,
  markImplementationRuntimeGithubVerifying,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCursorService";
import type { RuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

function mapLegacyRunStatusToRuntimeState(
  status: string,
  taskCursor: ReturnType<typeof parseTaskCursorExecutionV1>,
): RuntimeState {
  if (taskCursor && taskCursor.status === "github_verifying") return "github_verifying";
  if (taskCursor && (taskCursor.status === "cursor_running" || taskCursor.status === "cursor_requested")) {
    return taskCursor.status === "cursor_requested" ? "dispatching" : "cursor_running";
  }
  switch (status) {
    case "queued":
    case "prompt_ready":
      return "queued";
    case "prompt_building":
    case "cursor_requested":
      return "dispatching";
    case "cursor_running":
      return "cursor_running";
    case "github_verifying":
      return "github_verifying";
    case "completed":
    case "no_code_change_completed":
      return "completed";
    case "failed":
    case "blocked_by_dependency":
      return "failed";
    case "status_check_stopped":
      return "stale";
    default:
      return "queued";
  }
}

/** requirementsStateJson → DB (2차: DB 우선, JSON은 UI 스냅샷) */
export async function syncImplementationRuntimeFromRequirementsJson(input: {
  readonly projectId: string;
  readonly requirementsState: Record<string, unknown>;
  readonly force?: boolean;
}): Promise<{ readonly synced: boolean; readonly bundle: Awaited<ReturnType<typeof getImplementationRuntimeBundle>> }> {
  const pid = input.projectId.trim();
  const existing = await findActiveImplementationRuntimeJob(pid);
  if (existing && !input.force) {
    return { synced: false, bundle: await getImplementationRuntimeBundle(pid) };
  }

  const queue = parseCodeTaskExecutionQueueV1(input.requirementsState.codeTaskExecutionQueueV1);
  const runs = parseCodeTaskExecutionRunsV1(input.requirementsState.codeTaskExecutionRunsV1) ?? [];
  const taskCursor = parseTaskCursorExecutionV1(input.requirementsState.taskCursorExecutionV1);

  if (!queue || queue.status !== "running" || !runs.length) {
    return { synced: false, bundle: await getImplementationRuntimeBundle(pid) };
  }

  const job =
    existing ??
    (await createImplementationRuntimeJob({
      projectId: pid,
      selectedCodeTaskIds: queue.selectedCodeTaskIds,
    }));

  for (const codeTaskId of queue.selectedCodeTaskIds) {
    const legacyRun = findLatestRunForCodeTask(runs, codeTaskId);
    if (!legacyRun) continue;
    const runtimeState = mapLegacyRunStatusToRuntimeState(legacyRun.status, taskCursor);
    let dbRun = job.runs.find((r) => r.codeTaskId === codeTaskId);
    if (!dbRun) {
      dbRun = await createImplementationCodeTaskRun({
        projectId: pid,
        jobId: job.id,
        codeTaskId,
      });
    }
    if (dbRun.runtimeState === runtimeState) continue;

    if (runtimeState === "dispatching") {
      await markImplementationRuntimeDispatching({
        projectId: pid,
        jobId: job.id,
        runId: dbRun.id,
      });
    } else if (runtimeState === "cursor_running") {
      await markImplementationRuntimeCursorRunning({
        projectId: pid,
        jobId: job.id,
        runId: dbRun.id,
        cursorAgentId: taskCursor?.cursorRunId ?? legacyRun.cursorRunId ?? "",
        branchName: legacyRun.workBranch ?? taskCursor?.workBranch,
      });
    } else if (runtimeState === "github_verifying") {
      await markImplementationRuntimeGithubVerifying({
        projectId: pid,
        jobId: job.id,
        runId: dbRun.id,
      });
    } else if (runtimeState === "completed") {
      await markImplementationRuntimeCompleted({
        projectId: pid,
        jobId: job.id,
        runId: dbRun.id,
        commitSha: legacyRun.commitSha,
        pullRequestUrl: legacyRun.pullRequestUrl,
      });
    } else if (runtimeState === "failed" || runtimeState === "stale") {
      await markImplementationRuntimeFailed({
        projectId: pid,
        jobId: job.id,
        runId: dbRun.id,
        failureReason: legacyRun.failureReason ?? runtimeState,
      });
      if (runtimeState === "stale") {
        await transitionImplementationCodeTaskRun({
          runId: dbRun.id,
          toState: "stale",
          patch: { failureReason: legacyRun.failureReason ?? "execution_stale" },
        });
      }
    } else {
      await transitionImplementationCodeTaskRun({
        runId: dbRun.id,
        toState: runtimeState,
      });
    }
  }

  const headId = getCurrentQueueCodeTaskId(queue);
  const headRun = headId ? findLatestRunForCodeTask(runs, headId) : null;
  if (headId && headRun && isRuntimeInFlight(mapLegacyRunStatusToRuntimeState(headRun.status, taskCursor))) {
    // ensure current head is represented
    const bundle = await getImplementationRuntimeBundle(pid);
    return { synced: true, bundle };
  }

  return { synced: true, bundle: await getImplementationRuntimeBundle(pid) };
}

export { buildImplementationRuntimeUiSnapshotFromBundle as buildImplementationRuntimeUiSnapshot } from "@/lib/runtime/implementationRuntime/implementationRuntimeUiSnapshot";
