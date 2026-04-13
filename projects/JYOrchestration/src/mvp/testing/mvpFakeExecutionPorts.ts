/**
 * MVP — deterministic fake `MvpExecutionPortsBundle` for adapter-injection tests (in-memory only).
 */

import type { ExecutionRun } from "../contracts/mvpExecutionTypes";
import type { MvpExecutionStepRecord } from "../execution/executionStepLog";
import type {
  CursorExecutor,
  GitVerifier,
  MvpExecutionPortsBundle,
  PromptProvider,
  ReviewEngine,
  RunStore,
  StepStore,
  TaskProvider,
} from "../ports/mvpPorts";
import type { Task } from "../task/taskService";
import type { ReviewResult } from "../reviewer/reviewerService";

export type MvpFakeExecutionPortsOptions = {
  /** When false, first review returns FAILED with retryable false (run should fail). Default true. */
  reviewPass?: boolean;
  /** Project id string only used for assertions; TaskProvider ignores it by default. */
  fakeTaskId?: string;
  /** When true, `getExecutableTasks` returns [] so readiness reports no executable tasks. */
  emptyExecutableSet?: boolean;
};

export type MvpFakeExecutionPortsBundleResult = {
  bundle: MvpExecutionPortsBundle;
  /** Monotonic counters incremented when fake adapters are invoked (proves injection). */
  counters: {
    getExecutableTasks: number;
    generatePrompt: number;
    regeneratePrompt: number;
    submitTaskPrompt: number;
    waitForCompletion: number;
    verifyBranchExists: number;
    getLatestCommit: number;
    getCommitDiff: number;
    reviewTaskResult: number;
    stepAppend: number;
  };
};

function createIsolatedRunStore(): RunStore {
  const runs = new Map<string, ExecutionRun>();
  const runMeta = new Map<string, { failureReason?: string }>();
  return {
    get: (runId) => runs.get(runId),
    put: (run) => {
      runs.set(run.id, run);
    },
    clear: () => {
      runs.clear();
      runMeta.clear();
    },
    getMeta: (runId) => runMeta.get(runId),
    setMeta: (runId, meta) => {
      runMeta.set(runId, meta);
    },
    deleteMeta: (runId) => {
      runMeta.delete(runId);
    },
  };
}

function createIsolatedStepStore(onAppend?: () => void): StepStore {
  const stepsByRun = new Map<string, MvpExecutionStepRecord[]>();
  return {
    append: (record) => {
      onAppend?.();
      const list = stepsByRun.get(record.runId) ?? [];
      const sequence = list.length + 1;
      const row: MvpExecutionStepRecord = {
        runId: record.runId,
        taskId: record.taskId,
        sequence,
        stepType: record.stepType,
        status: record.status,
        message: record.message,
        timestamp: record.timestamp ?? Date.now(),
        failurePayload: record.failurePayload,
      };
      list.push(row);
      stepsByRun.set(record.runId, list);
    },
    getStepsForRun: (runId) => [...(stepsByRun.get(runId) ?? [])],
    clearAll: () => {
      stepsByRun.clear();
    },
  };
}

/**
 * Builds a bundle backed by isolated run/step stores and fake domain adapters (no task registry, no global step log).
 */
export function createMvpFakeExecutionPortsBundle(
  options: MvpFakeExecutionPortsOptions = {}
): MvpFakeExecutionPortsBundleResult {
  const reviewPass = options.reviewPass !== false;
  const emptyExecutableSet = options.emptyExecutableSet === true;
  const fakeTaskId = options.fakeTaskId ?? "fake-task-1";

  const counters: MvpFakeExecutionPortsBundleResult["counters"] = {
    getExecutableTasks: 0,
    generatePrompt: 0,
    regeneratePrompt: 0,
    submitTaskPrompt: 0,
    waitForCompletion: 0,
    verifyBranchExists: 0,
    getLatestCommit: 0,
    getCommitDiff: 0,
    reviewTaskResult: 0,
    stepAppend: 0,
  };

  const fakeTask: Task = {
    id: fakeTaskId,
    title: "Fake",
    description: "injected",
    type: "FUNCTIONAL",
    status: "CONFIRMED",
    finalOrder: 0,
    projectId: "fake-project",
  };

  const tasks: TaskProvider = {
    getExecutableTasks: async (_projectId) => {
      counters.getExecutableTasks += 1;
      return emptyExecutableSet ? [] : [fakeTask];
    },
  };

  const prompt: PromptProvider = {
    generatePrompt: async (_taskId) => {
      counters.generatePrompt += 1;
      return "fake-prompt-body";
    },
    regeneratePrompt: async (_taskId, _failureReason) => {
      counters.regeneratePrompt += 1;
      return "fake-prompt-regenerated";
    },
  };

  const cursor: CursorExecutor = {
    submitTaskPrompt: async (_input) => {
      counters.submitTaskPrompt += 1;
      return { jobId: "fake-job" };
    },
    waitForCompletion: async (_jobId) => {
      counters.waitForCompletion += 1;
      return { ok: true, summary: "fake cursor ok", changedFiles: ["fake.ts"] };
    },
  };

  const git: GitVerifier = {
    verifyBranchExists: async (_input) => {
      counters.verifyBranchExists += 1;
      return true;
    },
    getLatestCommit: async (_input) => {
      counters.getLatestCommit += 1;
      return { sha: "deadbeef" };
    },
    getCommitDiff: async (_input) => {
      counters.getCommitDiff += 1;
      return "fake diff";
    },
  };

  const reviewOutcome: ReviewResult = reviewPass
    ? { status: "PASSED", retryable: false }
    : { status: "FAILED", reason: "fake review rejected", retryable: false };

  const review: ReviewEngine = {
    reviewTaskResult: async (_input) => {
      counters.reviewTaskResult += 1;
      return reviewOutcome;
    },
  };

  const runStore = createIsolatedRunStore();
  const stepStore = createIsolatedStepStore(() => {
    counters.stepAppend += 1;
  });

  const bundle: MvpExecutionPortsBundle = {
    tasks,
    prompt,
    cursor,
    git,
    review,
    runStore,
    stepStore,
  };

  return { bundle, counters };
}
