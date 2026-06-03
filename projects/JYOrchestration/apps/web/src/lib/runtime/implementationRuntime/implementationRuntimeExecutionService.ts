import {
  completeImplementationRuntimeJob,
  createImplementationCodeTaskRun,
  createImplementationRuntimeJobWithFirstRun,
  getImplementationRuntimeBundleByJobId,
  getImplementationRuntimeJobWithRuns,
  pauseImplementationRuntimeJob,
  transitionImplementationCodeTaskRun,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import {
  markImplementationRuntimeCursorRunning,
  markImplementationRuntimeDispatching,
  markImplementationRuntimeFailed,
  markImplementationRuntimeCompleted,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCursorService";
import { isTerminalRuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeStateMachine";
import {
  advanceImplementationRuntimeCodeTaskQueue,
  applyGithubVerifyToImplementationRuntimeCodeTaskQueueItem,
  assertQueueItemDispatchAllowed,
  getImplementationRuntimeCodeTaskQueue,
  markImplementationRuntimeCodeTaskQueueItemCursorRequested,
  markImplementationRuntimeCodeTaskQueueItemDispatching,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueService";
import type {
  ImplementationRuntimeBundleView,
  ImplementationRuntimeRunView,
  RuntimeState,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

function normalizeSelectedCodeTaskIds(ids: readonly string[]): readonly string[] {
  const normalized = ids.map((id) => id.trim()).filter(Boolean);
  if (!normalized.length) {
    throw new Error("selectedCodeTaskIds is required");
  }
  return normalized;
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

function resolveJobCompletionStatus(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly runs: readonly ImplementationRuntimeRunView[];
}): "completed" | "completed_with_issues" | "failed" {
  const latest = latestRunPerCodeTaskId(input.runs);
  const states: RuntimeState[] = [];
  for (const codeTaskId of input.selectedCodeTaskIds) {
    const run = latest.get(codeTaskId);
    if (!run) {
      throw new Error(`Missing run for CodeTask ${codeTaskId}`);
    }
    if (!isTerminalRuntimeState(run.runtimeState)) {
      throw new Error(`CodeTask ${codeTaskId} is not in a terminal runtime state`);
    }
    states.push(run.runtimeState);
  }

  const completedCount = states.filter((s) => s === "completed").length;
  const issueCount = states.filter((s) => s === "failed" || s === "stale").length;

  if (issueCount === states.length) return "failed";
  if (completedCount === states.length) return "completed";
  if (completedCount > 0 && issueCount > 0) return "completed_with_issues";
  return "failed";
}

export async function startImplementationRuntimeJobFromCodeTasks(input: {
  readonly projectId: string;
  readonly selectedCodeTaskIds: readonly string[];
}): Promise<ImplementationRuntimeBundleView> {
  const selectedCodeTaskIds = normalizeSelectedCodeTaskIds(input.selectedCodeTaskIds);
  return createImplementationRuntimeJobWithFirstRun({
    projectId: input.projectId,
    selectedCodeTaskIds,
  });
}

export async function advanceImplementationRuntimeJob(input: {
  readonly projectId: string;
  readonly jobId: string;
}): Promise<ImplementationRuntimeBundleView> {
  const pid = input.projectId.trim();
  const jobId = input.jobId.trim();
  const queueItems = await getImplementationRuntimeCodeTaskQueue(jobId);
  if (queueItems.length) {
    await advanceImplementationRuntimeCodeTaskQueue({
      projectId: pid,
      jobId,
      stopOnFailure: true,
    });
    return getImplementationRuntimeBundleByJobId({ projectId: pid, jobId });
  }
  const job = await getImplementationRuntimeJobWithRuns({ projectId: pid, jobId });
  if (!job) {
    throw new Error(`ImplementationExecutionJob not found: ${jobId}`);
  }
  if (job.status !== "running") {
    return getImplementationRuntimeBundleByJobId({ projectId: pid, jobId });
  }

  const selected = job.selectedCodeTaskIds;
  if (!selected.length) {
    throw new Error("Job has no selectedCodeTaskIds");
  }

  const currentCodeTaskId = job.currentCodeTaskId?.trim() ?? "";
  if (!currentCodeTaskId) {
    throw new Error("Job has no currentCodeTaskId");
  }

  const latest = latestRunPerCodeTaskId(job.runs);
  const currentRun = latest.get(currentCodeTaskId);
  if (!currentRun) {
    throw new Error(`No run for current CodeTask ${currentCodeTaskId}`);
  }
  if (!isTerminalRuntimeState(currentRun.runtimeState)) {
    throw new Error(
      `Current run must be terminal before advance (state=${currentRun.runtimeState})`,
    );
  }

  const currentIndex = selected.indexOf(currentCodeTaskId);
  if (currentIndex < 0) {
    throw new Error(`currentCodeTaskId ${currentCodeTaskId} is not in selectedCodeTaskIds`);
  }

  const nextCodeTaskId = selected[currentIndex + 1];
  if (nextCodeTaskId) {
    await createImplementationCodeTaskRun({
      projectId: pid,
      jobId,
      codeTaskId: nextCodeTaskId,
    });
    return getImplementationRuntimeBundleByJobId({ projectId: pid, jobId });
  }

  const completionStatus = resolveJobCompletionStatus({
    selectedCodeTaskIds: selected,
    runs: job.runs,
  });
  await completeImplementationRuntimeJob({ jobId, status: completionStatus });
  return getImplementationRuntimeBundleByJobId({ projectId: pid, jobId });
}

export async function failCurrentImplementationRuntimeRun(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly failureReason: string;
}): Promise<ImplementationRuntimeBundleView> {
  await transitionImplementationCodeTaskRun({
    runId: input.runId,
    toState: "failed",
    patch: { failureReason: input.failureReason.trim() || "failed" },
  });
  return getImplementationRuntimeBundleByJobId({
    projectId: input.projectId,
    jobId: input.jobId,
  });
}

export async function dispatchNextQueuedImplementationRuntimeRun(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly buildCursorRequest: (ctx: {
    readonly codeTaskId: string;
  }) => Promise<{
    readonly agentId: string;
    readonly branchName?: string | null;
  }>;
}): Promise<ImplementationRuntimeBundleView> {
  const pid = input.projectId.trim();
  const jobId = input.jobId.trim();
  const job = await getImplementationRuntimeJobWithRuns({ projectId: pid, jobId });
  if (!job) {
    throw new Error(`ImplementationExecutionJob not found: ${jobId}`);
  }
  if (job.status !== "running") {
    throw new Error(`Job is not running (status=${job.status})`);
  }

  const currentCodeTaskId = job.currentCodeTaskId?.trim() ?? "";
  if (!currentCodeTaskId) {
    throw new Error("Job has no currentCodeTaskId");
  }

  const currentRun = latestRunPerCodeTaskId(job.runs).get(currentCodeTaskId);
  if (!currentRun) {
    throw new Error(`No run for current CodeTask ${currentCodeTaskId}`);
  }
  if (currentRun.runtimeState !== "queued") {
    throw new Error(
      `Only queued runs can be dispatched (current=${currentRun.runtimeState})`,
    );
  }

  await assertQueueItemDispatchAllowed({ jobId, codeTaskId: currentCodeTaskId });
  await markImplementationRuntimeCodeTaskQueueItemDispatching({
    jobId,
    codeTaskId: currentCodeTaskId,
  });

  await markImplementationRuntimeDispatching({
    projectId: pid,
    jobId,
    runId: currentRun.id,
  });

  try {
    const cursor = await input.buildCursorRequest({ codeTaskId: currentCodeTaskId });
    const agentId = cursor.agentId.trim();
    if (!agentId) {
      throw new Error("Cursor agentId is empty");
    }
    await markImplementationRuntimeCursorRunning({
      projectId: pid,
      jobId,
      runId: currentRun.id,
      cursorAgentId: agentId,
      branchName: cursor.branchName ?? null,
    });
    await markImplementationRuntimeCodeTaskQueueItemCursorRequested({
      jobId,
      codeTaskId: currentCodeTaskId,
      cursorRunId: agentId,
      workBranch: cursor.branchName ?? null,
    });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error);
    await markImplementationRuntimeFailed({
      projectId: pid,
      jobId,
      runId: currentRun.id,
      failureReason,
    });
    await pauseImplementationRuntimeJob({ jobId, failureReason });
    throw error;
  }

  return getImplementationRuntimeBundleByJobId({ projectId: pid, jobId });
}

export async function completeImplementationRuntimeGithubVerifyAndAdvance(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly commitSha?: string | null;
  readonly pullRequestUrl?: string | null;
  readonly now?: Date;
}): Promise<ImplementationRuntimeBundleView> {
  const pid = input.projectId.trim();
  const jobId = input.jobId.trim();
  const runId = input.runId.trim();
  const job = await getImplementationRuntimeJobWithRuns({ projectId: pid, jobId });
  const run = job?.runs.find((r) => r.id === runId);
  const commitSha = input.commitSha?.trim() ?? "";
  if (run?.codeTaskId && commitSha) {
    await applyGithubVerifyToImplementationRuntimeCodeTaskQueueItem({
      jobId,
      codeTaskId: run.codeTaskId,
      verify: { ok: true, verifiedCommitSha: commitSha, reason: "github_verified" },
      now: input.now,
    });
  }
  await markImplementationRuntimeCompleted({
    projectId: pid,
    jobId,
    runId,
    commitSha: input.commitSha ?? null,
    pullRequestUrl: input.pullRequestUrl ?? null,
    now: input.now,
  });
  return advanceImplementationRuntimeJob({
    projectId: input.projectId,
    jobId: input.jobId,
  });
}

export async function failImplementationRuntimeGithubVerify(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly failureReason?: string | null;
  readonly now?: Date;
}): Promise<ImplementationRuntimeBundleView> {
  const reason = input.failureReason?.trim() || "github_verify_failed";
  const pid = input.projectId.trim();
  const jobId = input.jobId.trim();
  const runId = input.runId.trim();
  const job = await getImplementationRuntimeJobWithRuns({ projectId: pid, jobId });
  const run = job?.runs.find((r) => r.id === runId);
  if (run?.codeTaskId) {
    await applyGithubVerifyToImplementationRuntimeCodeTaskQueueItem({
      jobId,
      codeTaskId: run.codeTaskId,
      verify: { ok: false, reason, message: reason },
      now: input.now,
    });
  }
  await markImplementationRuntimeFailed({
    projectId: input.projectId.trim(),
    jobId: input.jobId.trim(),
    runId: input.runId.trim(),
    failureReason: reason,
    now: input.now,
  });
  await pauseImplementationRuntimeJob({
    jobId: input.jobId.trim(),
    failureReason: reason,
    now: input.now,
  });
  return getImplementationRuntimeBundleByJobId({
    projectId: input.projectId.trim(),
    jobId: input.jobId.trim(),
  });
}
