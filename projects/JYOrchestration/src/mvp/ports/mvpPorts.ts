/**
 * MVP — internal port interfaces for future wiring (in-memory adapters today).
 */

import type { ExecutionRun } from "../contracts/mvpExecutionTypes";
import type { Task } from "../task/taskService";
import type { ReviewResult, ReviewTaskInput } from "../reviewer/reviewerService";
import type { MvpExecutionStepRecord } from "../execution/executionStepLog";
import type { MvpStructuredFailure } from "../contracts/mvpStructuredFailure";

/** Opaque per-run metadata persisted beside the run aggregate (today: optional failureReason string). */
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

/**
 * Run aggregate + auxiliary metadata (Prisma-friendly shape: one row + optional side table or columns).
 *
 * Contract (unchanged engine behavior):
 * - `get` returns `undefined` only when the run id has never been `put`.
 * - `put` upserts the full `ExecutionRun` document the engine owns for that id (tasks array is authoritative).
 * - `deleteMeta` removes auxiliary meta for a run; callers use it when registering a clean snapshot.
 * - `setMeta` replaces meta for that run id; used when marking terminal failure (`failureReason` string).
 * - `clear` wipes all runs and all meta (test harness / reset).
 */
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

/**
 * Append-only step log keyed by `runId` (event-sourced style; Prisma: insert rows + query by run + order).
 *
 * Contract:
 * - `append` must assign a strictly increasing `sequence` per `runId` starting at 1 in insertion order
 *   (engine and read models rely on monotonic sequences).
 * - `append` fills `timestamp` when omitted (diagnostic only; ordering is by `sequence`).
 * - `getStepsForRun` returns steps in ascending `sequence` (stable ascending order).
 * - `clearAll` removes every step for every run (paired with `RunStore.clear` on reset).
 */
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
