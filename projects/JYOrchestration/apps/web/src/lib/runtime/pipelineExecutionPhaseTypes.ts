/**
 * Pipeline worker phase types (read-only).
 */

import type { evaluateExecutionResult } from "@/lib/execution/evaluateTaskExecution";

export type PipelinePhaseContext = {
  readonly projectId: string;
  readonly taskId: string;
  readonly actorUserId: string;
  readonly execRunId: string;
  readonly executionJobId?: string;
  readonly repoUrl: string;
  readonly baseBranch: string;
  readonly githubAccessToken: string | null;
  readonly requireApprovalBeforeApply: boolean;
  readonly mergedAllowedGlobs: readonly string[];
  readonly stopOnTestFailure: boolean;
  readonly stopOnOutOfScopeChange: boolean;
  readonly taskTitle: string;
  readonly taskDescription: string | null;
  readonly acceptanceCriteriaJson: unknown;
};

export type ReviewerPhaseResult =
  | { ok: true; verdict: "done"; evalPack: Awaited<ReturnType<typeof evaluateExecutionResult>> }
  | { ok: false; code: string; message: string; verdict?: string };

export type ScmPhaseResult =
  | { ok: true; evalReason: string }
  | { ok: false; code: string; message: string; hold?: boolean };

export type MergePhaseResult =
  | { ok: true; merged: true; prUrl: string }
  | { ok: true; merged: false; message: string }
  | { ok: false; code: string; message: string };
