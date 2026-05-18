import type { ExecutionReviewerStepRecord } from "@/lib/execution/executionReviewWithAiMembers";
import {
  AI_TEAM_EXECUTION_STATUS,
  AI_TEAM_EXECUTION_STATUS_LABEL_KO,
  type AiTeamExecutionStatus,
  isAiTeamExecutionStatus,
} from "./status";
import { parsePrStatusForTeamRuntime } from "./prStatusParse";
import { parseTeamReviewPhasesFromReviewerSteps, type TeamRuntimePhaseStatus } from "./reviewerSteps";
import type { AiTeamRuntimeTimelineItem } from "./timeline";

export type TeamRuntimePhaseSummary = Readonly<{
  status: TeamRuntimePhaseStatus | "waiting";
  cursorRunId?: string | null;
  commitSha?: string | null;
  branchName?: string | null;
  changedFilesCount?: number;
  issues?: readonly string[];
  configured?: boolean;
  reason?: string | null;
}>;

export type TeamRuntimeSummary = Readonly<{
  status: AiTeamExecutionStatus;
  statusKo: string;
  developer: TeamRuntimePhaseSummary;
  review: TeamRuntimePhaseSummary;
  security: TeamRuntimePhaseSummary;
  approval: Readonly<{ required: boolean; status: "waiting" | "completed" | "skipped" | "not_required" }>;
  pr?: Readonly<{
    pullRequestUrl?: string | null;
    pullRequestNumber?: number | null;
    pullRequestState?: string | null;
    mergedAt?: string | null;
  }>;
  blockReason?: string | null;
  timeline?: readonly AiTeamRuntimeTimelineItem[];
}>;

export type TaskExecutionRunTeamRuntimeSource = Readonly<{
  id?: string;
  status: string;
  teamExecutionStatus?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  cursorRunId?: string | null;
  cursorSummary?: string | null;
  branchName?: string | null;
  commitSha?: string | null;
  changedFiles?: unknown;
  gitSummary?: string | null;
  evaluationReason?: string | null;
  evaluationDecision?: string | null;
  evaluationReviewerSteps?: unknown;
  runError?: string | null;
  prStatus?: string | null;
}>;

export type TaskExecutionRunForTeamRuntime = TaskExecutionRunTeamRuntimeSource &
  Readonly<{
    id: string;
    teamExecutionStatus?: string | null;
  }>;

export type GitChangeRequestTeamRuntimeSource = Readonly<{
  pullRequestUrl?: string | null;
  pullRequestNumber?: number | null;
  pullRequestState?: string | null;
  mergedAt?: Date | string | null;
  status?: string | null;
}>;

function developerPhaseFromLegacyRun(run: TaskExecutionRunTeamRuntimeSource): TeamRuntimePhaseSummary {
  const changedFiles = Array.isArray(run.changedFiles) ? run.changedFiles : [];
  if (run.runError) {
    return { status: "failed", reason: run.runError };
  }
  if (run.status === "awaiting_git_reflection") {
    return {
      status: "running",
      cursorRunId: run.cursorRunId,
      branchName: run.branchName,
      commitSha: run.commitSha,
      changedFilesCount: changedFiles.length,
      reason: run.evaluationReason,
    };
  }
  if (run.cursorRunId || run.commitSha || changedFiles.length > 0) {
    return {
      status: "completed",
      cursorRunId: run.cursorRunId,
      branchName: run.branchName,
      commitSha: run.commitSha,
      changedFilesCount: changedFiles.length,
    };
  }
  if (run.status === "running") {
    return { status: "running", branchName: run.branchName };
  }
  return { status: "pending" };
}

export function resolveTeamExecutionStatusFromRun(
  run: TaskExecutionRunTeamRuntimeSource
): AiTeamExecutionStatus {
  const stored = run.teamExecutionStatus?.trim();
  if (stored && isAiTeamExecutionStatus(stored)) {
    return stored;
  }
  switch (run.status) {
    case "running":
      return AI_TEAM_EXECUTION_STATUS.DEVELOPER_RUNNING;
    case "awaiting_git_reflection":
      return AI_TEAM_EXECUTION_STATUS.REFLECTION_WAITING;
    case "reviewing":
      return AI_TEAM_EXECUTION_STATUS.REVIEW_RUNNING;
    case "done":
      return run.evaluationDecision === "failed"
        ? AI_TEAM_EXECUTION_STATUS.FAILED
        : AI_TEAM_EXECUTION_STATUS.COMPLETED;
    case "failed":
      return AI_TEAM_EXECUTION_STATUS.FAILED;
    case "retry_needed":
      return AI_TEAM_EXECUTION_STATUS.REVIEW_FAILED;
    case "paused":
      return AI_TEAM_EXECUTION_STATUS.CANCELED;
    default:
      return AI_TEAM_EXECUTION_STATUS.REQUESTED;
  }
}

export function buildTeamRuntimeSummaryFromRun(
  run: TaskExecutionRunTeamRuntimeSource,
  options?: Readonly<{
    reviewerSteps?: readonly ExecutionReviewerStepRecord[];
    requireApproval?: boolean;
    gitChangeRequest?: GitChangeRequestTeamRuntimeSource | null;
  }>
): TeamRuntimeSummary {
  const teamStatus = resolveTeamExecutionStatusFromRun(run);
  const steps = options?.reviewerSteps ?? coerceReviewerSteps(run.evaluationReviewerSteps);
  const phases = parseTeamReviewPhasesFromReviewerSteps(steps);
  const changedFiles = Array.isArray(run.changedFiles) ? run.changedFiles : [];

  const approvalRequired = options?.requireApproval === true;
  const approvalStatus =
    teamStatus === AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING
      ? "waiting"
      : teamStatus === AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING || teamStatus === AI_TEAM_EXECUTION_STATUS.COMPLETED
        ? "completed"
        : approvalRequired
          ? "not_required"
          : "skipped";

  const gcr = options?.gitChangeRequest;
  const prFromGcr =
    gcr && (gcr.pullRequestUrl || gcr.pullRequestNumber != null)
      ? {
          pullRequestUrl: gcr.pullRequestUrl ?? null,
          pullRequestNumber: gcr.pullRequestNumber ?? null,
          pullRequestState: gcr.pullRequestState ?? gcr.status ?? null,
          mergedAt:
            gcr.mergedAt instanceof Date
              ? gcr.mergedAt.toISOString()
              : typeof gcr.mergedAt === "string"
                ? gcr.mergedAt
                : null,
        }
      : undefined;
  const prFromStatus = parsePrStatusForTeamRuntime(run.prStatus);
  const pr =
    prFromGcr && prFromStatus
      ? { ...prFromStatus, ...prFromGcr }
      : prFromGcr ?? prFromStatus;

  return {
    status: teamStatus,
    statusKo: AI_TEAM_EXECUTION_STATUS_LABEL_KO[teamStatus],
    developer: developerPhaseFromLegacyRun(run),
    review: {
      status: phases.reviewer.status,
      issues: phases.reviewer.issues,
      configured: phases.reviewer.configured,
    },
    security: {
      status: phases.security.status,
      issues: phases.security.issues,
      configured: phases.security.configured,
    },
    approval: {
      required: approvalRequired,
      status: approvalStatus,
    },
    ...(pr ? { pr } : {}),
    blockReason: run.runError ?? run.evaluationReason ?? null,
  };
}

function coerceReviewerSteps(raw: unknown): readonly ExecutionReviewerStepRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is ExecutionReviewerStepRecord => {
    return typeof row === "object" && row !== null && typeof (row as { role?: unknown }).role === "string";
  });
}
