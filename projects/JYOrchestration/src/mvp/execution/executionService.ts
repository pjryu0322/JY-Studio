/**
 * MVP — **target** sequential execution core (in-memory, no DB, no prod wiring).
 * Drives work through internal ports (`mvpExecutionPortsBundle`) for future substitution.
 *
 * **Stability:** behavior is frozen unless a deliberate migration is approved; new orchestration
 * belongs in `mvpOrchestrationFacade` / `src/application`, not duplicate engines.
 */

import type { ExecutionRun, ExecutionTaskState, MvpFailureCode } from "../contracts/mvpExecutionTypes";
import type { MvpStructuredFailure } from "../contracts/mvpStructuredFailure";
import { mvpExecutionPortsBundle } from "../runtime/mvpExecutionPortsBundle";

export type { ExecutionRun, ExecutionTaskState, MvpFailureCode } from "../contracts/mvpExecutionTypes";

export const DEFAULT_MAX_RETRY_COUNT = 2;

const MVP_DEFAULT_REPO_URL = "https://mvp.local/repo.git";
const MVP_DEFAULT_BRANCH = "main";

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

type RunMeta = { failureReason?: string };

/** Last failure detail for prompt regeneration (review, cursor, git). */
const lastFailureDetail = new Map<string, string>();

function ports() {
  return mvpExecutionPortsBundle();
}

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

function sourceStepForFailureCode(code: MvpFailureCode): string {
  switch (code) {
    case "CURSOR_FAILED":
      return "CURSOR_FAILED";
    case "GIT_BRANCH_MISSING":
      return "GIT_FAILED";
    case "REVIEW_FAILED":
      return "REVIEW_FAILED";
    case "TASK_NOT_FOUND":
    case "UNHANDLED":
      return "RUN_FAILED";
  }
}

function structuredFailure(
  code: MvpFailureCode,
  message: string,
  retryable: boolean,
  sourceStepType: string
): MvpStructuredFailure {
  return {
    failureCode: code,
    failureMessage: message,
    retryable,
    sourceStepType,
  };
}

function deriveStructuredFailureFromReason(reason: string): MvpStructuredFailure {
  const code = classifyFromMessage(reason);
  return structuredFailure(code, reason, mvpFailureIsRetryable(code), sourceStepForFailureCode(code));
}

/**
 * Test-only: register a run snapshot into the in-memory engine (used by `testing/mvpExecutionFixtures`).
 */
export function mvpTestingRegisterRunSnapshot(run: ExecutionRun): void {
  ports().runStore.put(cloneRun(run));
  ports().runStore.deleteMeta(run.id);
}

/**
 * Start a new sequential run for a project.
 * Loads tasks via TaskProvider, then drives the pipeline.
 */
export async function startRun(projectId: string): Promise<ExecutionRun> {
  const loaded = await ports().tasks.getExecutableTasks(projectId);
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
  ports().runStore.put(run);
  ports().runStore.deleteMeta(run.id);
  await executeNextTask(run.id);
  const final = ports().runStore.get(run.id);
  return final ? cloneRun(final) : run;
}

export async function executeNextTask(runId: string): Promise<void> {
  const run = ports().runStore.get(runId);
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
  const run = ports().runStore.get(runId);
  const taskState = run?.tasks.find((t) => t.taskId === taskId);
  if (!run || !taskState) {
    await failRun(runId, `${code}:${detail}`, {
      causeTaskId: taskId,
      failure: structuredFailure(code, detail, retryable, sourceStepForFailureCode(code)),
    });
    return;
  }

  const rk = runTaskKey(runId, taskId);
  lastFailureDetail.set(rk, detail);
  recordTaskFailureMeta(taskState, code, detail, retryable);

  if (retryable && taskState.retryCount < DEFAULT_MAX_RETRY_COUNT) {
    taskState.lastFailureWasNonRetryable = false;
    ports().stepStore.append({
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
  await failRun(runId, `${code}:${detail}`, {
    causeTaskId: taskId,
    failure: structuredFailure(code, detail, retryable, sourceStepForFailureCode(code)),
  });
}

export async function executeTask(runId: string, taskId: string): Promise<void> {
  const run = ports().runStore.get(runId);
  if (!run || run.status !== "RUNNING") {
    return;
  }

  const taskState = run.tasks.find((t) => t.taskId === taskId);
  if (!taskState) {
    await failRun(runId, "TASK_NOT_FOUND", {
      causeTaskId: taskId,
      failure: structuredFailure("TASK_NOT_FOUND", "task not in run", false, "RUN_FAILED"),
    });
    return;
  }

  taskState.status = "RUNNING";
  taskState.totalExecuteAttempts = (taskState.totalExecuteAttempts ?? 0) + 1;
  const p = ports();

  try {
    const rk = runTaskKey(runId, taskId);
    const promptText =
      taskState.retryCount === 0
        ? await p.prompt.generatePrompt(taskId)
        : await p.prompt.regeneratePrompt(taskId, lastFailureDetail.get(rk) ?? "previous step failed");

    p.stepStore.append({
      runId,
      taskId,
      stepType: "PROMPT_GENERATED",
      status: "SUCCESS",
      message: taskState.retryCount === 0 ? "generatePrompt" : "regeneratePrompt",
    });

    const { jobId } = await p.cursor.submitTaskPrompt({
      projectId: run.projectId,
      taskId,
      prompt: promptText,
    });
    p.stepStore.append({
      runId,
      taskId,
      stepType: "CURSOR_SUBMITTED",
      status: "INFO",
      message: `jobId=${jobId}`,
    });

    const cursorOutcome = await p.cursor.waitForCompletion(jobId);
    if (!cursorOutcome.ok) {
      const detail = cursorOutcome.summary?.trim() || "CURSOR_FAILED";
      const r = mvpFailureIsRetryable("CURSOR_FAILED");
      p.stepStore.append({
        runId,
        taskId,
        stepType: "CURSOR_FAILED",
        status: "FAILURE",
        message: detail,
        failurePayload: structuredFailure("CURSOR_FAILED", detail, r, "CURSOR_FAILED"),
      });
      await maybeRetryOrFail(runId, taskId, "CURSOR_FAILED", detail, r);
      return;
    }

    p.stepStore.append({
      runId,
      taskId,
      stepType: "CURSOR_COMPLETED",
      status: "SUCCESS",
      message: cursorOutcome.summary || "ok",
    });

    const branchOk = await p.git.verifyBranchExists({
      repoUrl: MVP_DEFAULT_REPO_URL,
      branchName: MVP_DEFAULT_BRANCH,
    });
    if (!branchOk) {
      const r = mvpFailureIsRetryable("GIT_BRANCH_MISSING");
      p.stepStore.append({
        runId,
        taskId,
        stepType: "GIT_FAILED",
        status: "FAILURE",
        message: "branch not found",
        failurePayload: structuredFailure("GIT_BRANCH_MISSING", "branch not found", r, "GIT_FAILED"),
      });
      await maybeRetryOrFail(runId, taskId, "GIT_BRANCH_MISSING", "branch not found", r);
      return;
    }

    p.stepStore.append({
      runId,
      taskId,
      stepType: "GIT_VERIFIED",
      status: "SUCCESS",
      message: MVP_DEFAULT_BRANCH,
    });

    const { sha: headSha } = await p.git.getLatestCommit({
      repoUrl: MVP_DEFAULT_REPO_URL,
      branch: MVP_DEFAULT_BRANCH,
    });
    const baseSha = `${headSha}^`;
    const gitDiffSummary = await p.git.getCommitDiff({
      repoUrl: MVP_DEFAULT_REPO_URL,
      baseSha,
      headSha,
    });

    const review = await p.review.reviewTaskResult({
      taskId,
      prompt: promptText,
      result: {
        summary: cursorOutcome.summary,
        changedFiles: cursorOutcome.changedFiles,
        gitDiffSummary,
      },
    });

    if (review.status === "PASSED") {
      p.stepStore.append({
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
      p.stepStore.append({
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
    const rr = mvpFailureIsRetryable("REVIEW_FAILED", review.retryable);
    p.stepStore.append({
      runId,
      taskId,
      stepType: "REVIEW_FAILED",
      status: "FAILURE",
      message: reviewDetail,
      failurePayload: structuredFailure("REVIEW_FAILED", reviewDetail, rr, "REVIEW_FAILED"),
    });
    await maybeRetryOrFail(runId, taskId, "REVIEW_FAILED", reviewDetail, rr);
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

export async function retryTask(runId: string, taskId: string): Promise<void> {
  const run = ports().runStore.get(runId);
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
  const run = ports().runStore.get(runId);
  if (!run) {
    return;
  }
  if (run.status !== "RUNNING") {
    return;
  }
  run.status = "SUCCESS";
  ports().stepStore.append({
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
  ctx?: { causeTaskId?: string; failure?: MvpStructuredFailure }
): Promise<void> {
  const run = ports().runStore.get(runId);
  if (!run) {
    return;
  }
  if (run.status === "FAILED") {
    return;
  }
  run.status = "FAILED";
  const failure = ctx?.failure ?? deriveStructuredFailureFromReason(reason);
  ports().stepStore.append({
    runId,
    taskId: ctx?.causeTaskId ?? "",
    stepType: "RUN_FAILED",
    status: "FAILURE",
    message: reason,
    failurePayload: failure,
  });
  ports().runStore.setMeta(runId, { failureReason: reason });
}

export async function getRunStatus(
  runId: string
): Promise<ExecutionRun & { failureReason?: string }> {
  const run = ports().runStore.get(runId);
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
  return { ...cloneRun(run), failureReason: ports().runStore.getMeta(runId)?.failureReason };
}

export function mvpResetExecutionState(): void {
  ports().runStore.clear();
  ports().stepStore.clearAll();
  lastFailureDetail.clear();
}
