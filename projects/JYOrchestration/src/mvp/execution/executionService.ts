/**
 * MVP — fully independent sequential execution engine (in-memory, no DB, no prod wiring).
 */

import { getExecutableTasks } from "../task/taskService";
import { generatePrompt, regeneratePrompt } from "../prompt/promptService";
import { submitTaskPrompt, waitForCompletion } from "../cursor/cursorService";
import { verifyBranchExists, getLatestCommit, getCommitDiff } from "../git/gitService";
import { reviewTaskResult } from "../reviewer/reviewerService";

const DEFAULT_MAX_RETRY_COUNT = 2;
const MVP_DEFAULT_REPO_URL = "https://mvp.local/repo.git";
const MVP_DEFAULT_BRANCH = "main";

export type ExecutionRun = {
  id: string;
  projectId: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  currentTaskIndex: number;
  tasks: ExecutionTaskState[];
};

export type ExecutionTaskState = {
  taskId: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  retryCount: number;
};

type RunMeta = { failureReason?: string };

const runs = new Map<string, ExecutionRun>();
const runMeta = new Map<string, RunMeta>();
const lastReviewFailure = new Map<string, string>();

function runTaskKey(runId: string, taskId: string): string {
  return `${runId}::${taskId}`;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mvp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function cloneRun(run: ExecutionRun): ExecutionRun {
  return {
    ...run,
    tasks: run.tasks.map((t) => ({ ...t })),
  };
}

/**
 * Start a new sequential run for a project.
 * Loads tasks via taskService (FUNCTIONAL + CONFIRMED, sorted by finalOrder), then drives the pipeline.
 */
export async function startRun(projectId: string): Promise<ExecutionRun> {
  const loaded = await getExecutableTasks(projectId);
  const run: ExecutionRun = {
    id: newId(),
    projectId,
    status: "RUNNING",
    currentTaskIndex: 0,
    tasks: loaded.map((t) => ({
      taskId: t.id,
      status: "PENDING",
      retryCount: 0,
    })),
  };
  runs.set(run.id, run);
  runMeta.delete(run.id);
  await executeNextTask(run.id);
  const final = runs.get(run.id);
  return final ? cloneRun(final) : run;
}

/**
 * Advance the run: if all tasks finished, complete; otherwise execute the current task.
 */
export async function executeNextTask(runId: string): Promise<void> {
  const run = runs.get(runId);
  if (!run || run.status !== "RUNNING") {
    return;
  }

  if (run.currentTaskIndex >= run.tasks.length) {
    await completeRun(runId);
    return;
  }

  const state = run.tasks[run.currentTaskIndex]!;
  if (state.status === "SUCCESS") {
    run.currentTaskIndex += 1;
    await executeNextTask(runId);
    return;
  }

  await executeTask(runId, state.taskId);
}

/**
 * Execute the full per-task pipeline: prompt → cursor → git → review (+ retry rules).
 */
export async function executeTask(runId: string, taskId: string): Promise<void> {
  const run = runs.get(runId);
  if (!run || run.status !== "RUNNING") {
    return;
  }

  const taskState = run.tasks.find((t) => t.taskId === taskId);
  if (!taskState) {
    await handleStepFailure(runId, taskId, new Error("TASK_NOT_FOUND"));
    return;
  }

  taskState.status = "RUNNING";

  try {
    // STEP 1 — Generate Prompt
    const rk = runTaskKey(runId, taskId);
    const promptText =
      taskState.retryCount === 0
        ? await generatePrompt(taskId)
        : await regeneratePrompt(taskId, lastReviewFailure.get(rk) ?? "review failed");

    // STEP 2–3 — Cursor
    const { jobId } = await submitTaskPrompt({
      projectId: run.projectId,
      taskId,
      prompt: promptText,
    });
    const cursorOutcome = await waitForCompletion(jobId);
    if (!cursorOutcome.ok) {
      await handleStepFailure(runId, taskId, new Error(cursorOutcome.summary || "CURSOR_FAILED"));
      return;
    }

    // STEP 4 — Git verification
    const branchOk = await verifyBranchExists({
      repoUrl: MVP_DEFAULT_REPO_URL,
      branchName: MVP_DEFAULT_BRANCH,
    });
    if (!branchOk) {
      await handleStepFailure(runId, taskId, new Error("GIT_BRANCH_MISSING"));
      return;
    }
    const { sha: headSha } = await getLatestCommit({
      repoUrl: MVP_DEFAULT_REPO_URL,
      branch: MVP_DEFAULT_BRANCH,
    });
    const baseSha = `${headSha}^`;
    const gitDiffSummary = await getCommitDiff({
      repoUrl: MVP_DEFAULT_REPO_URL,
      baseSha,
      headSha,
    });

    // STEP 5 — Review
    const review = await reviewTaskResult({
      taskId,
      prompt: promptText,
      result: {
        summary: cursorOutcome.summary,
        changedFiles: cursorOutcome.changedFiles,
        gitDiffSummary,
      },
    });

    // STEP 6 — Decision / retry
    if (review.status === "PASSED") {
      taskState.status = "SUCCESS";
      lastReviewFailure.delete(rk);
      run.currentTaskIndex += 1;
      await executeNextTask(runId);
      return;
    }

    if (
      review.retryable &&
      taskState.retryCount < DEFAULT_MAX_RETRY_COUNT
    ) {
      taskState.retryCount += 1;
      lastReviewFailure.set(rk, review.reason ?? "review failed");
      await executeTask(runId, taskId);
      return;
    }

    taskState.status = "FAILED";
    await failRun(runId, review.reason ?? "REVIEW_FAILED_MAX_RETRIES");
  } catch (e) {
    await handleStepFailure(runId, taskId, e);
  }
}

export async function handleStepFailure(runId: string, taskId: string, error: unknown): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  const run = runs.get(runId);
  const t = run?.tasks.find((x) => x.taskId === taskId);
  if (t) {
    t.status = "FAILED";
  }
  await failRun(runId, msg);
}

export async function retryTask(runId: string, taskId: string): Promise<void> {
  const run = runs.get(runId);
  if (!run || run.status !== "RUNNING") {
    return;
  }
  const idx = run.tasks.findIndex((t) => t.taskId === taskId);
  if (idx < 0) {
    return;
  }
  run.currentTaskIndex = idx;
  const st = run.tasks[idx]!;
  st.retryCount += 1;
  st.status = "PENDING";
  await executeTask(runId, taskId);
}

export async function completeRun(runId: string): Promise<void> {
  const run = runs.get(runId);
  if (!run) {
    return;
  }
  if (run.status !== "RUNNING") {
    return;
  }
  run.status = "SUCCESS";
}

export async function failRun(runId: string, reason: string): Promise<void> {
  const run = runs.get(runId);
  if (!run) {
    return;
  }
  if (run.status === "FAILED") {
    return;
  }
  run.status = "FAILED";
  runMeta.set(runId, { failureReason: reason });
}

export async function getRunStatus(
  runId: string
): Promise<ExecutionRun & { failureReason?: string }> {
  const run = runs.get(runId);
  if (!run) {
    return {
      id: runId,
      projectId: "",
      status: "FAILED",
      currentTaskIndex: 0,
      tasks: [],
      failureReason: "RUN_NOT_FOUND",
    };
  }
  return { ...cloneRun(run), failureReason: runMeta.get(runId)?.failureReason };
}

/** Test helper: clear all in-memory runs. */
export function mvpResetExecutionState(): void {
  runs.clear();
  runMeta.clear();
  lastReviewFailure.clear();
}
