import {
  recordImplementationRuntimeEvent,
  touchImplementationCodeTaskRunHeartbeat,
  transitionImplementationCodeTaskRun,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { scheduleImplementationRuntimePoll } from "@/lib/runtime/implementationRuntime/implementationRuntimePollRepository";

/** Cursor dispatch → DB runtime 상태 반영 */
export async function markImplementationRuntimeDispatching(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly now?: Date;
}): Promise<void> {
  await transitionImplementationCodeTaskRun({
    runId: input.runId,
    toState: "dispatching",
    now: input.now,
  });
  await recordImplementationRuntimeEvent({
    projectId: input.projectId,
    jobId: input.jobId,
    runId: input.runId,
    eventType: "cursor_dispatched",
  });
  await scheduleImplementationRuntimePoll({ runId: input.runId, now: input.now });
}

export async function markImplementationRuntimeCursorRunning(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly cursorAgentId: string;
  readonly branchName?: string | null;
  readonly now?: Date;
}): Promise<void> {
  await transitionImplementationCodeTaskRun({
    runId: input.runId,
    toState: "cursor_running",
    patch: {
      cursorAgentId: input.cursorAgentId,
      branchName: input.branchName ?? null,
    },
    now: input.now,
  });
  await touchImplementationCodeTaskRunHeartbeat({
    runId: input.runId,
    cursorAgentId: input.cursorAgentId,
    now: input.now,
  });
  await scheduleImplementationRuntimePoll({ runId: input.runId, now: input.now });
}

export async function markImplementationRuntimeGithubVerifying(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly now?: Date;
}): Promise<void> {
  await transitionImplementationCodeTaskRun({
    runId: input.runId,
    toState: "github_verifying",
    now: input.now,
  });
}

/** Cursor agent 완료 → github_verifying + cursor_completed 이벤트 */
export async function markImplementationRuntimeCursorCompleted(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly now?: Date;
}): Promise<void> {
  try {
    await transitionImplementationCodeTaskRun({
      runId: input.runId,
      toState: "github_verifying",
      now: input.now,
    });
  } catch {
    // 이미 github_verifying 등 동일 단계면 이벤트만 기록
  }
  await recordImplementationRuntimeEvent({
    projectId: input.projectId,
    jobId: input.jobId,
    runId: input.runId,
    eventType: "cursor_completed",
  });
}

export async function markImplementationRuntimeCompleted(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly commitSha?: string | null;
  readonly pullRequestUrl?: string | null;
  readonly now?: Date;
}): Promise<void> {
  await transitionImplementationCodeTaskRun({
    runId: input.runId,
    toState: "completed",
    patch: {
      commitSha: input.commitSha ?? null,
      pullRequestUrl: input.pullRequestUrl ?? null,
    },
    now: input.now,
  });
  await recordImplementationRuntimeEvent({
    projectId: input.projectId,
    jobId: input.jobId,
    runId: input.runId,
    eventType: "github_verified",
    payload: { commitSha: input.commitSha, pullRequestUrl: input.pullRequestUrl },
  });
}

export async function markImplementationRuntimeFailed(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly failureReason?: string | null;
  readonly now?: Date;
}): Promise<void> {
  await transitionImplementationCodeTaskRun({
    runId: input.runId,
    toState: "failed",
    patch: { failureReason: input.failureReason ?? "cursor_failed" },
    now: input.now,
  });
  await recordImplementationRuntimeEvent({
    projectId: input.projectId,
    jobId: input.jobId,
    runId: input.runId,
    eventType: "run_failed",
    payload: { failureReason: input.failureReason },
  });
}

export async function recordImplementationRuntimeCursorHeartbeat(input: {
  readonly runId: string;
  readonly cursorAgentId?: string | null;
  readonly cursorAgentStatus?: string | null;
  readonly now?: Date;
}): Promise<void> {
  await touchImplementationCodeTaskRunHeartbeat({
    runId: input.runId,
    cursorAgentId: input.cursorAgentId ?? undefined,
    now: input.now,
  });
}
