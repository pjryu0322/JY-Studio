import type { TaskCursorExecutionStatus, TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type {
  TaskCursorGithubVerifyInput,
  TaskCursorGithubVerifyResult,
} from "@/lib/prototype/taskCursorGithubVerify";
import {
  canTransitionRuntimeState,
  type RuntimeState,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeStateMachine";
import {
  getImplementationRuntimeBundle,
  type ImplementationRuntimeRunView,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import {
  markImplementationRuntimeCursorCompleted,
  markImplementationRuntimeCursorRunning,
  markImplementationRuntimeDispatching,
  markImplementationRuntimeFailed,
  markImplementationRuntimeGithubVerifying,
  recordImplementationRuntimeCursorHeartbeat,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCursorService";
import {
  failImplementationRuntimeGithubVerify,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService";
import {
  applyImplementationRuntimeGithubVerifyResult,
  completeImplementationRuntimeFromRecordedGithubOutcome,
  verifyImplementationRuntimeRunOnGithub,
} from "@/lib/runtime/implementationRuntime/implementationGithubVerificationService";
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

/**
 * Cursor status → DB runtimeState (completed 제외; 완료는 GitHub outcome 전용).
 */
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
      return "github_verifying";
    case "cursor_failed":
    case "github_verify_failed":
      return "failed";
    case "status_check_stopped":
      return "stale";
    default:
      return null;
  }
}

export function hasRecordedGithubVerifyOutcome(execution: TaskCursorExecutionV1): boolean {
  return execution.status === "github_verified" && Boolean(String(execution.commitSha ?? "").trim());
}

export function shouldApplyRuntimeGithubVerifyInput(
  execution: TaskCursorExecutionV1,
  githubVerify?: TaskCursorGithubVerifyInput | null,
): boolean {
  if (!githubVerify) return false;
  const status = execution.status;
  return (
    status === "cursor_completed" ||
    status === "github_verifying" ||
    status === "github_verified" ||
    status === "review_pending"
  );
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

async function applyGithubOutcomeIfReady(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly run: ImplementationRuntimeRunView;
  readonly execution: TaskCursorExecutionV1;
  readonly githubVerifyResult?: TaskCursorGithubVerifyResult | null;
  readonly githubVerify?: TaskCursorGithubVerifyInput | null;
}): Promise<void> {
  if (input.run.runtimeState === "completed") return;

  if (input.githubVerifyResult) {
    await applyImplementationRuntimeGithubVerifyResult({
      projectId: input.projectId,
      jobId: input.jobId,
      runId: input.run.id,
      verifyResult: input.githubVerifyResult,
      pullRequestUrl: null,
    });
    return;
  }

  if (shouldApplyRuntimeGithubVerifyInput(input.execution, input.githubVerify)) {
    await verifyImplementationRuntimeRunOnGithub({
      projectId: input.projectId,
      jobId: input.jobId,
      runId: input.run.id,
      verify: input.githubVerify!,
    });
    return;
  }

  if (!hasRecordedGithubVerifyOutcome(input.execution)) return;

  await completeImplementationRuntimeFromRecordedGithubOutcome({
    projectId: input.projectId,
    jobId: input.jobId,
    runId: input.run.id,
    commitSha: String(input.execution.commitSha ?? "").trim(),
    pullRequestUrl: null,
  });
}

/**
 * Task Cursor API 결과 → DB Runtime (best-effort; Job/Run 없으면 no-op).
 * Runtime completed는 GitHub verify outcome으로만 확정한다.
 */
export async function syncImplementationRuntimeFromTaskCursor(input: {
  readonly projectId: string;
  readonly codeTaskId?: string | null;
  readonly taskId?: string | null;
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly githubVerify?: TaskCursorGithubVerifyInput | null;
  readonly githubVerifyResult?: TaskCursorGithubVerifyResult | null;
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
      if (input.githubVerifyResult) {
        await applyGithubOutcomeIfReady({
          projectId,
          jobId,
          run,
          execution,
          githubVerifyResult: input.githubVerifyResult,
          githubVerify: input.githubVerify,
        });
        return;
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
      if (target === "github_verifying") {
        await applyGithubOutcomeIfReady({
          projectId,
          jobId,
          run,
          execution,
          githubVerifyResult: input.githubVerifyResult,
          githubVerify: input.githubVerify,
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
    } else {
      run = await applyRuntimeStep({
        projectId,
        jobId,
        run,
        step: target,
        execution,
        now: input.now,
      });
    }

    if (target === "github_verifying" || execution.status === "github_verified") {
      const refreshed = await getImplementationRuntimeBundle(projectId);
      const current =
        refreshed.runs.find((r) => r.id === run.id) ??
        refreshed.runs.find((r) => r.codeTaskId === codeTaskId);
      if (current) {
        await applyGithubOutcomeIfReady({
          projectId,
          jobId,
          run: current,
          execution,
          githubVerifyResult: input.githubVerifyResult,
          githubVerify: input.githubVerify,
        });
      }
    }
  } catch {
    // DB runtime is supplementary; never fail the cursor API response.
  }
}
