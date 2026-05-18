import type { ExecutionReviewerStepRecord } from "@/lib/execution/executionReviewWithAiMembers";
import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";
import { AI_TEAM_EXECUTION_STATUS } from "./status";
import { parsePrStatusForTeamRuntime } from "./prStatusParse";

export type ExecutionRunResumeRow = Readonly<{
  id: string;
  cursorRunId?: string | null;
  branchName?: string | null;
  commitSha?: string | null;
  changedFiles?: unknown;
  cursorSummary?: string | null;
  evaluationReason?: string | null;
  evaluationDecision?: string | null;
  evaluationReviewerSteps?: unknown;
  prStatus?: string | null;
}>;

export function buildCursorResultFromExecutionRun(run: ExecutionRunResumeRow): CursorRunResult {
  const changedFiles = Array.isArray(run.changedFiles)
    ? run.changedFiles.map((f) => String(f))
    : [];
  const pr = parsePrStatusForTeamRuntime(run.prStatus);
  return {
    runId: run.cursorRunId ?? "",
    branchName: run.branchName ?? "",
    commitHash: run.commitSha ?? undefined,
    changedFiles,
    summary: run.cursorSummary ?? "",
    prUrl: pr?.pullRequestUrl ?? undefined,
    executionStatus: "completed",
  };
}

export function buildEvalPackFromExecutionRun(run: ExecutionRunResumeRow): Readonly<{
  result: { decision: string; reason: string; score?: number };
  reviewerSteps: ExecutionReviewerStepRecord[];
}> {
  const reviewerSteps = Array.isArray(run.evaluationReviewerSteps)
    ? (run.evaluationReviewerSteps as ExecutionReviewerStepRecord[])
    : [];
  return {
    result: {
      decision: run.evaluationDecision ?? "done",
      reason: run.evaluationReason ?? "resumed_after_runtime_approval",
    },
    reviewerSteps,
  };
}

export function isMergeRunningResumeStatus(teamExecutionStatus: string | null | undefined): boolean {
  return teamExecutionStatus?.trim() === AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING;
}

/** Single-task execution may resume SCM when user approved AI team runtime (merge_running + merge_pending). */
export function canResumeTeamRuntimeMerge(input: Readonly<{
  singleTaskId?: string | null;
  isEnvTestTask: boolean;
  workflowStatus?: string | null;
  teamExecutionStatus?: string | null;
}>): boolean {
  return (
    Boolean(input.singleTaskId?.trim()) &&
    !input.isEnvTestTask &&
    input.workflowStatus === "merge_pending" &&
    input.teamExecutionStatus === AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING
  );
}
