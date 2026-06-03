import type { TaskCursorExecutionStatus, TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import {
  canTransitionRuntimeState,
  type RuntimeState,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeStateMachine";
import {
  getImplementationRuntimeBundle,
  type ImplementationRuntimeRunView,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import {
  markImplementationRuntimeCursorRunning,
  markImplementationRuntimeCursorCompleted,
  markImplementationRuntimeDispatching,
  markImplementationRuntimeFailed,
  markImplementationRuntimeGithubVerifying,
  recordImplementationRuntimeCursorHeartbeat,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCursorService";
import {
  advanceImplementationRuntimeJob,
  completeImplementationRuntimeGithubVerifyAndAdvance,
  failImplementationRuntimeGithubVerify,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService";
import { transitionImplementationCodeTaskRun } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";

const RUNTIME_GRAPH: Readonly<Record<RuntimeState, readonly RuntimeState[]>> = {
  idle: ["queued"],
  queued: ["dispatching", "failed", "stale"],
  dispatching: ["cursor_running", "failed", "stale"],
  cursor_running: ["github_verifying", "failed", "stale"],
  github_verifying: ["completed", "failed"],
  completed: [],
  failed: ["queued"],
  stale: ["queued"],
};

export function findRuntimeTransitionPath(
  from: RuntimeState,
  to: RuntimeState,
): readonly RuntimeState[] {
  if (from === to) return [];
  const queue: RuntimeState[][] = [[from]];
  const seen = new Set<RuntimeState>([from]);
  while (queue.length) {
    const path = queue.shift()!;
    const head = path[path.length - 1]!;
    for (const next of RUNTIME_GRAPH[head] ?? []) {
      if (seen.has(next)) continue;
      const nextPath = [...path, next];
      if (next === to) return nextPath.slice(1);
      seen.add(next);
      queue.push(nextPath);
    }
  }
  return [];
}

export function mapTaskCursorStatusToRuntimeState(
  status: TaskCursorExecutionStatus,
): RuntimeState | null {
  switch (status) {
    case "cursor_requested":
      return "dispatching";
    case "cursor_running":
      return "cursor_running";
    case "cursor_completed":
      return "github_verifying";
    case "github_verifying":
      return "github_verifying";
    case "github_verified":
    case "review_pending":
      return "completed";
    case "cursor_failed":
    case "github_verify_failed":
      return "failed";
    case "status_check_stopped":
      return "stale";
    default:
      return null;
  }
}

function resolveCodeTaskId(input: {
  readonly codeTaskId?: string | null;
  readonly taskId?: string | null;
  readonly execution?: TaskCursorExecutionV1 | null;
}): string | null {
  const fromBody = String(input.codeTaskId ?? "").trim();
  if (fromBody) return fromBody;
  const fromTask = String(input.taskId ?? "").trim();
  if (fromTask) return fromTask;
  const fromExecution = String(input.execution?.taskId ?? "").trim();
  return fromExecution || null;
}

async function applyRuntimeStep(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly run: ImplementationRuntimeRunView;
  readonly step: RuntimeState;
  readonly execution: TaskCursorExecutionV1;
  readonly now?: Date;
}): Promise<ImplementationRuntimeRunView> {
  const { projectId, jobId, run, step, execution, now } = input;
  const cursorAgentId = String(execution.cursorRunId ?? "").trim() || null;
  const branchName = execution.workBranch ?? null;
  const commitSha = execution.commitSha ?? null;

  switch (step) {
    case "dispatching":
      await markImplementationRuntimeDispatching({ projectId, jobId, runId: run.id, now });
      break;
    case "cursor_running":
      await markImplementationRuntimeCursorRunning({
        projectId,
        jobId,
        runId: run.id,
        cursorAgentId: cursorAgentId ?? run.cursorAgentId ?? "pending",
        branchName,
        now,
      });
      break;
    case "github_verifying":
      if (
        execution.status === "cursor_completed" ||
        run.runtimeState === "cursor_running"
      ) {
        await markImplementationRuntimeCursorCompleted({ projectId, jobId, runId: run.id, now });
      } else {
        await markImplementationRuntimeGithubVerifying({ projectId, jobId, runId: run.id, now });
      }
      break;
    case "completed": {
      const bundle = await completeImplementationRuntimeGithubVerifyAndAdvance({
        projectId,
        jobId,
        runId: run.id,
        commitSha,
        pullRequestUrl: null,
        now,
      });
      return bundle.currentRun ?? bundle.runs.find((r) => r.id === run.id) ?? run;
    }
    case "failed":
      if (execution.status === "github_verify_failed") {
        await failImplementationRuntimeGithubVerify({
          projectId,
          jobId,
          runId: run.id,
          failureReason: "github_verify_failed",
          now,
        });
      } else {
        await markImplementationRuntimeFailed({
          projectId,
          jobId,
          runId: run.id,
          failureReason: execution.failureReason ?? execution.errorMessage ?? "cursor_failed",
          now,
        });
      }
      break;
    case "stale":
      return transitionImplementationCodeTaskRun({
        runId: run.id,
        toState: "stale",
        patch: { failureReason: "status_check_stopped" },
        now,
      });
    default:
      break;
  }
  const bundle = await getImplementationRuntimeBundle(projectId);
  return bundle.runs.find((r) => r.id === run.id) ?? run;
}

/**
 * Task Cursor API 결과 → DB Runtime (best-effort; Job/Run 없으면 no-op).
 */
export async function syncImplementationRuntimeFromTaskCursor(input: {
  readonly projectId: string;
  readonly codeTaskId?: string | null;
  readonly taskId?: string | null;
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly now?: Date;
}): Promise<void> {
  try {
    const projectId = input.projectId.trim();
    const execution = input.execution;
    if (!projectId || !execution) return;

    const codeTaskId = resolveCodeTaskId(input);
    if (!codeTaskId) return;

    const target = mapTaskCursorStatusToRuntimeState(execution.status);
    if (!target) return;

    const bundle = await getImplementationRuntimeBundle(projectId);
    if (!bundle.job) return;

    let run =
      bundle.runs.find((r) => r.codeTaskId === codeTaskId) ??
      (bundle.job.currentCodeTaskId === codeTaskId ? bundle.currentRun : null);
    if (!run) return;

    const jobId = bundle.job.id;

    if (run.runtimeState === target) {
      if (target === "completed" && bundle.job.status === "running") {
        try {
          await advanceImplementationRuntimeJob({ projectId, jobId });
        } catch {
          // already advanced or job finished
        }
      }
      if (
        target === "failed" &&
        execution.status === "github_verify_failed" &&
        bundle.job.status === "running"
      ) {
        await failImplementationRuntimeGithubVerify({
          projectId,
          jobId,
          runId: run.id,
          failureReason: "github_verify_failed",
          now: input.now,
        });
      }
      if (target === "cursor_running" || target === "dispatching" || target === "github_verifying") {
        await recordImplementationRuntimeCursorHeartbeat({
          runId: run.id,
          cursorAgentId: execution.cursorRunId ?? run.cursorAgentId,
          cursorAgentStatus: execution.cursorAgentStatus ?? null,
          now: input.now,
        });
      }
      return;
    }

    if (!canTransitionRuntimeState(run.runtimeState, target)) {
      const path = findRuntimeTransitionPath(run.runtimeState, target);
      if (!path.length) return;
      for (const step of path) {
        run = await applyRuntimeStep({
          projectId,
          jobId,
          run,
          step,
          execution,
          now: input.now,
        });
      }
      return;
    }

    await applyRuntimeStep({
      projectId,
      jobId,
      run,
      step: target,
      execution,
      now: input.now,
    });
  } catch {
    // DB runtime is supplementary; never fail the cursor API response.
  }
}
