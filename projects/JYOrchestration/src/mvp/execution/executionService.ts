/**
 * MVP — fully independent sequential execution engine (in-memory, no DB, no prod wiring).
 */

import { getExecutableTasks } from "../task/taskService";
import { generatePrompt, regeneratePrompt } from "../prompt/promptService";
import { submitTaskPrompt, waitForCompletion } from "../cursor/cursorService";
import { verifyBranchExists, getLatestCommit, getCommitDiff } from "../git/gitService";
import { reviewTaskResult } from "../reviewer/reviewerService";
import { mvpAppendExecutionStep, mvpClearAllExecutionSteps } from "./executionStepLog";

export const DEFAULT_MAX_RETRY_COUNT = 2;

const MVP_DEFAULT_REPO_URL = "https://mvp.local/repo.git";
const MVP_DEFAULT_BRANCH = "main";

export type MvpFailureCode =
  | "CURSOR_FAILED"
  | "GIT_BRANCH_MISSING"
  | "REVIEW_FAILED"
  | "TASK_NOT_FOUND"
  | "UNHANDLED";

/** All classified failure codes used by the MVP execution engine. */
export const MVP_FAILURE_CODES: readonly MvpFailureCode[] = [
  "CURSOR_FAILED",
  "GIT_BRANCH_MISSING",
  "REVIEW_FAILED",
  "TASK_NOT_FOUND",
  "UNHANDLED",
] as const;

/** Per-code default retryability (same-task, in-run retries only). `REVIEW_FAILED` defers to `review.retryable`. */
export function mvpFailureCodeDefaultRetryable(code: MvpFailureCode): boolean {
  switch (code) {
    case "CURSOR_FAILED":
    case "GIT_BRANCH_MISSING":
      return true;
    case "REVIEW_FAILED":
    case "TASK_NOT_FOUND":
    case "UNHANDLED":
      return false;
  }
}

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
  /**
   * When true, the last terminal failure for this task was non-retryable (e.g. review with `retryable: false`).
   * Used so `retryTask()` cannot bypass policy after a hard stop.
   */
  lastFailureWasNonRetryable?: boolean;
  lastFailureCode?: MvpFailureCode;
  lastFailureMessage?: string;
  lastFailureRetryable?: boolean;
  /** Times `executeTask` entered the pipeline for this task (includes automatic retries). */
  totalExecuteAttempts?: number;
};

type RunMeta = { failureReason?: string };

const runs = new Map<string, ExecutionRun>();
const runMeta = new Map<string, RunMeta>();
/** Last failure detail for prompt regeneration (review, cursor, git). */
const lastFailureDetail = new Map<string, string>();

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

function classifyFromMessage(msg: string): MvpFailureCode {
  const m = msg.trim();
  if (m === "TASK_NOT_FOUND" || m.includes("TASK_NOT_FOUND")) return "TASK_NOT_FOUND";
  if (m === "GIT_BRANCH_MISSING" || m.includes("GIT_BRANCH_MISSING")) return "GIT_BRANCH_MISSING";
  if (m === "CURSOR_FAILED" || m.toUpperCase().includes("CURSOR_FAILED")) return "CURSOR_FAILED";
  return "UNHANDLED";
}

/** Whether this failure code (and optional review flag) may trigger an in-run same-task retry. */
export function mvpFailureIsRetryable(code: MvpFailureCode, reviewRetryable?: boolean): boolean {
  if (code === "REVIEW_FAILED") {
    return reviewRetryable === true;
  }
  return mvpFailureCodeDefaultRetryable(code);
}

/**
 * Test-only: register a run snapshot into the in-memory engine (used by `testing/mvpExecutionFixtures`).
 */
export function mvpTestingRegisterRunSnapshot(run: ExecutionRun): void {
  runs.set(run.id, cloneRun(run));
  runMeta.delete(run.id);
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
      totalExecuteAttempts: 0,
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

function recordTaskFailureMeta(
  taskState: ExecutionTaskState,
  code: MvpFailureCode,
  detail: string,
  retryable: boolean
): void {
  taskState.lastFailureCode = code;
  taskState.lastFailureMessage = detail;
  taskState.lastFailureRetryable = retryable;
}

async function maybeRetryOrFail(
  runId: string,
  taskId: string,
  code: MvpFailureCode,
  detail: string,
  retryable: boolean
): Promise<void> {
  const run = runs.get(runId);
  const taskState = run?.tasks.find((t) => t.taskId === taskId);
  if (!run || !taskState) {
    await failRun(runId, `${code}:${detail}`, { causeTaskId: taskId });
    return;
  }

  const rk = runTaskKey(runId, taskId);
  lastFailureDetail.set(rk, detail);
  recordTaskFailureMeta(taskState, code, detail, retryable);

  if (retryable && taskState.retryCount < DEFAULT_MAX_RETRY_COUNT) {
    taskState.lastFailureWasNonRetryable = false;
    mvpAppendExecutionStep({
      runId,
      taskId,
      stepType: "TASK_RETRY_SCHEDULED",
      status: "INFO",
      message: `same-task retry scheduled (${code})`,
    });
    taskState.retryCount += 1;
    await executeTask(runId, taskId);
    return;
  }

  taskState.status = "FAILED";
  taskState.lastFailureWasNonRetryable = !retryable;
  await failRun(runId, `${code}:${detail}`, { causeTaskId: taskId });
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
    await failRun(runId, "TASK_NOT_FOUND", { causeTaskId: taskId });
    return;
  }

  taskState.status = "RUNNING";
  taskState.totalExecuteAttempts = (taskState.totalExecuteAttempts ?? 0) + 1;

  try {
    const rk = runTaskKey(runId, taskId);
    const promptText =
      taskState.retryCount === 0
        ? await generatePrompt(taskId)
        : await regeneratePrompt(taskId, lastFailureDetail.get(rk) ?? "previous step failed");

    mvpAppendExecutionStep({
      runId,
      taskId,
      stepType: "PROMPT_GENERATED",
      status: "SUCCESS",
      message: taskState.retryCount === 0 ? "generatePrompt" : "regeneratePrompt",
    });

    const { jobId } = await submitTaskPrompt({
      projectId: run.projectId,
      taskId,
      prompt: promptText,
    });
    mvpAppendExecutionStep({
      runId,
      taskId,
      stepType: "CURSOR_SUBMITTED",
      status: "INFO",
      message: `jobId=${jobId}`,
    });

    const cursorOutcome = await waitForCompletion(jobId);
    if (!cursorOutcome.ok) {
      const detail = cursorOutcome.summary?.trim() || "CURSOR_FAILED";
      mvpAppendExecutionStep({
        runId,
        taskId,
        stepType: "CURSOR_FAILED",
        status: "FAILURE",
        message: detail,
      });
      await maybeRetryOrFail(runId, taskId, "CURSOR_FAILED", detail, mvpFailureIsRetryable("CURSOR_FAILED"));
      return;
    }

    mvpAppendExecutionStep({
      runId,
      taskId,
      stepType: "CURSOR_COMPLETED",
      status: "SUCCESS",
      message: cursorOutcome.summary || "ok",
    });

    const branchOk = await verifyBranchExists({
      repoUrl: MVP_DEFAULT_REPO_URL,
      branchName: MVP_DEFAULT_BRANCH,
    });
    if (!branchOk) {
      mvpAppendExecutionStep({
        runId,
        taskId,
        stepType: "GIT_FAILED",
        status: "FAILURE",
        message: "branch not found",
      });
      await maybeRetryOrFail(
        runId,
        taskId,
        "GIT_BRANCH_MISSING",
        "branch not found",
        mvpFailureIsRetryable("GIT_BRANCH_MISSING")
      );
      return;
    }

    mvpAppendExecutionStep({
      runId,
      taskId,
      stepType: "GIT_VERIFIED",
      status: "SUCCESS",
      message: MVP_DEFAULT_BRANCH,
    });

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

    const review = await reviewTaskResult({
      taskId,
      prompt: promptText,
      result: {
        summary: cursorOutcome.summary,
        changedFiles: cursorOutcome.changedFiles,
        gitDiffSummary,
      },
    });

    if (review.status === "PASSED") {
      mvpAppendExecutionStep({
        runId,
        taskId,
        stepType: "REVIEW_PASSED",
        status: "SUCCESS",
        message: "review passed",
      });
      taskState.status = "SUCCESS";
      taskState.lastFailureWasNonRetryable = false;
      taskState.lastFailureCode = undefined;
      taskState.lastFailureMessage = undefined;
      taskState.lastFailureRetryable = undefined;
      lastFailureDetail.delete(rk);
      mvpAppendExecutionStep({
        runId,
        taskId,
        stepType: "TASK_COMPLETED",
        status: "SUCCESS",
        message: "task pipeline finished",
      });
      run.currentTaskIndex += 1;
      await executeNextTask(runId);
      return;
    }

    const reviewDetail = review.reason ?? "REVIEW_FAILED";
    mvpAppendExecutionStep({
      runId,
      taskId,
      stepType: "REVIEW_FAILED",
      status: "FAILURE",
      message: reviewDetail,
    });
    await maybeRetryOrFail(
      runId,
      taskId,
      "REVIEW_FAILED",
      reviewDetail,
      mvpFailureIsRetryable("REVIEW_FAILED", review.retryable)
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = classifyFromMessage(msg);
    await maybeRetryOrFail(runId, taskId, code, msg, mvpFailureIsRetryable(code));
  }
}

export async function handleStepFailure(runId: string, taskId: string, error: unknown): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  const code = classifyFromMessage(msg);
  await maybeRetryOrFail(runId, taskId, code, msg, mvpFailureIsRetryable(code));
}

/**
 * Manual retry: same-task only; honors max retry budget and last non-retryable failure.
 * Requires `run.status === "RUNNING"` (today the engine also calls `failRun` on terminal task failure,
 * so this path is reserved for future run modes or in-process extensions that keep the run open).
 */
export async function retryTask(runId: string, taskId: string): Promise<void> {
  const run = runs.get(runId);
  if (!run || run.status !== "RUNNING") {
    return;
  }
  const idx = run.tasks.findIndex((t) => t.taskId === taskId);
  if (idx < 0) {
    return;
  }
  const st = run.tasks[idx]!;
  if (st.status !== "FAILED") {
    return;
  }
  if (st.lastFailureWasNonRetryable === true) {
    return;
  }
  if (st.retryCount >= DEFAULT_MAX_RETRY_COUNT) {
    return;
  }
  run.currentTaskIndex = idx;
  st.retryCount += 1;
  st.status = "PENDING";
  st.lastFailureWasNonRetryable = false;
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
  mvpAppendExecutionStep({
    runId,
    taskId: "",
    stepType: "RUN_SUCCESS",
    status: "SUCCESS",
    message: "all tasks completed",
  });
}

export async function failRun(
  runId: string,
  reason: string,
  ctx?: { causeTaskId?: string }
): Promise<void> {
  const run = runs.get(runId);
  if (!run) {
    return;
  }
  if (run.status === "FAILED") {
    return;
  }
  run.status = "FAILED";
  mvpAppendExecutionStep({
    runId,
    taskId: ctx?.causeTaskId ?? "",
    stepType: "RUN_FAILED",
    status: "FAILURE",
    message: reason,
  });
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

/** Test helper: clear all in-memory runs and step logs. */
export function mvpResetExecutionState(): void {
  runs.clear();
  runMeta.clear();
  lastFailureDetail.clear();
  mvpClearAllExecutionSteps();
}
