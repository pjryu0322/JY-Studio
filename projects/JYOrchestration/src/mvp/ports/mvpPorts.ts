/**
 * MVP — internal port interfaces for future wiring (in-memory adapters today).
 */

import type { ExecutionRun } from "../contracts/mvpExecutionTypes";
import type { Task } from "../task/taskService";
import type { ReviewResult, ReviewTaskInput } from "../reviewer/reviewerService";
import type { MvpExecutionStepRecord } from "../execution/executionStepLog";
import type { MvpStructuredFailure } from "../contracts/mvpStructuredFailure";

export type RunMeta = { failureReason?: string };

export interface TaskProvider {
  getExecutableTasks(projectId: string): Promise<Task[]>;
}

export interface PromptProvider {
  generatePrompt(taskId: string): Promise<string>;
  regeneratePrompt(taskId: string, failureReason: string): Promise<string>;
}

export type CursorSubmitInput = { projectId: string; taskId: string; prompt: string };
export type CursorSubmitResult = { jobId: string };
export type CursorWaitResult = { ok: boolean; summary: string; changedFiles: string[] };

export interface CursorExecutor {
  submitTaskPrompt(input: CursorSubmitInput): Promise<CursorSubmitResult>;
  waitForCompletion(jobId: string): Promise<CursorWaitResult>;
}

export interface GitVerifier {
  verifyBranchExists(input: { repoUrl: string; branchName: string }): Promise<boolean>;
  getLatestCommit(input: { repoUrl: string; branch: string }): Promise<{ sha: string }>;
  getCommitDiff(input: { repoUrl: string; baseSha: string; headSha: string }): Promise<string>;
}

export interface ReviewEngine {
  reviewTaskResult(input: ReviewTaskInput): Promise<ReviewResult>;
}

export interface RunStore {
  get(runId: string): ExecutionRun | undefined;
  put(run: ExecutionRun): void;
  clear(): void;
  getMeta(runId: string): RunMeta | undefined;
  setMeta(runId: string, meta: RunMeta): void;
  deleteMeta(runId: string): void;
}

export type StepAppendInput = Omit<MvpExecutionStepRecord, "timestamp" | "sequence"> & {
  timestamp?: number;
  failurePayload?: MvpStructuredFailure;
};

export interface StepStore {
  append(record: StepAppendInput): void;
  getStepsForRun(runId: string): readonly MvpExecutionStepRecord[];
  clearAll(): void;
}

/** Bundled ports used by the sequential execution engine. */
export type MvpExecutionPortsBundle = {
  tasks: TaskProvider;
  prompt: PromptProvider;
  cursor: CursorExecutor;
  git: GitVerifier;
  review: ReviewEngine;
  runStore: RunStore;
  stepStore: StepStore;
};
