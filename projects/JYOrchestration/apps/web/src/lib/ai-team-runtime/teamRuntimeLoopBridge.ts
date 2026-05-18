/**
 * runExecutionLoop ↔ AI Team Runtime status bridge (normal Task path; ENV_TEST uses legacy status only).
 */

import type { ExecutionReviewerStepRecord } from "@/lib/execution/executionReviewWithAiMembers";
import { parseTeamReviewPhasesFromReviewerSteps } from "./reviewerSteps";
import { patchTeamExecutionStatus } from "./persist";
import { AI_TEAM_EXECUTION_STATUS, type AiTeamExecutionStatus } from "./status";

export type TeamRuntimeLoopContext = Readonly<{
  execRunId: string;
  projectId: string;
  taskId: string;
  actorUserId: string;
}>;

/** Non-fatal: team runtime must not break the execution loop. */
export async function runTeamRuntimeSafe(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.warn("[execution-loop][team-runtime]", label, e instanceof Error ? e.message : e);
  }
}

async function markPhaseThenFailed(
  ctx: TeamRuntimeLoopContext,
  phase: AiTeamExecutionStatus,
  phaseSummaryKo: string,
  detail?: Record<string, unknown>
): Promise<void> {
  await patchTeamExecutionStatus({
    ...ctx,
    to: phase,
    historySummaryKo: phaseSummaryKo,
    historyDetail: detail,
  });
  await patchTeamExecutionStatus({
    ...ctx,
    to: AI_TEAM_EXECUTION_STATUS.FAILED,
    historySummaryKo: "실행 실패",
    historyDetail: detail,
  });
}

export async function markTeamRuntimeDeveloperRunning(ctx: TeamRuntimeLoopContext): Promise<void> {
  await patchTeamExecutionStatus({
    ...ctx,
    to: AI_TEAM_EXECUTION_STATUS.DEVELOPER_RUNNING,
    historySummaryKo: "AI개발자 실행 중",
  });
}

export async function markTeamRuntimeDeveloperFailed(
  ctx: TeamRuntimeLoopContext,
  detail?: Record<string, unknown>
): Promise<void> {
  await markPhaseThenFailed(ctx, AI_TEAM_EXECUTION_STATUS.DEVELOPER_FAILED, "AI개발자 실행 실패", detail);
}

export async function markTeamRuntimeReflectionWaiting(
  ctx: TeamRuntimeLoopContext,
  detail?: Record<string, unknown>
): Promise<void> {
  await patchTeamExecutionStatus({
    ...ctx,
    to: AI_TEAM_EXECUTION_STATUS.REFLECTION_WAITING,
    historySummaryKo: "Git 반영 미확인 — 확인 대기",
    historyDetail: detail,
  });
}

export async function markTeamRuntimeReviewRunning(ctx: TeamRuntimeLoopContext): Promise<void> {
  await patchTeamExecutionStatus({
    ...ctx,
    to: AI_TEAM_EXECUTION_STATUS.REVIEW_RUNNING,
    historySummaryKo: "AI검수자 검토 시작",
  });
}

export async function markTeamRuntimeReviewFailed(
  ctx: TeamRuntimeLoopContext,
  detail?: Record<string, unknown>
): Promise<void> {
  await markPhaseThenFailed(ctx, AI_TEAM_EXECUTION_STATUS.REVIEW_FAILED, "AI검수자 검토 실패", detail);
}

export async function markTeamRuntimeSecurityFailed(
  ctx: TeamRuntimeLoopContext,
  detail?: Record<string, unknown>
): Promise<void> {
  await markPhaseThenFailed(ctx, AI_TEAM_EXECUTION_STATUS.SECURITY_FAILED, "AI보안관 점검 실패", detail);
}

export async function markTeamRuntimeApprovalWaiting(
  ctx: TeamRuntimeLoopContext,
  detail?: Record<string, unknown>
): Promise<void> {
  await patchTeamExecutionStatus({
    ...ctx,
    to: AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING,
    historySummaryKo: "사용자 승인 대기",
    historyDetail: detail,
  });
}

export async function markTeamRuntimeMergeRunning(ctx: TeamRuntimeLoopContext): Promise<void> {
  await patchTeamExecutionStatus({
    ...ctx,
    to: AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING,
    historySummaryKo: "PR/Merge 진행",
  });
}

export async function markTeamRuntimeCompleted(ctx: TeamRuntimeLoopContext): Promise<void> {
  await patchTeamExecutionStatus({
    ...ctx,
    to: AI_TEAM_EXECUTION_STATUS.COMPLETED,
    historySummaryKo: "실행 완료",
  });
}

/** After review harness: derive security/review phase and set runtime status before SCM. */
export async function applyTeamRuntimeAfterReviewHarness(
  ctx: TeamRuntimeLoopContext,
  reviewerSteps: readonly ExecutionReviewerStepRecord[],
  options?: Readonly<{ requireApprovalBeforeMerge?: boolean }>
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const phases = parseTeamReviewPhasesFromReviewerSteps(reviewerSteps);
  if (phases.reviewer.status === "failed") {
    await markTeamRuntimeReviewFailed(ctx, { reviewerIssues: phases.reviewer.issues });
    return { ok: false, reason: "reviewer_failed" };
  }
  if (phases.security.configured) {
    await patchTeamExecutionStatus({
      ...ctx,
      to: AI_TEAM_EXECUTION_STATUS.SECURITY_RUNNING,
      historySummaryKo: "AI보안관 점검 시작",
    });
    if (phases.security.status === "failed") {
      await markTeamRuntimeSecurityFailed(ctx, { securityIssues: phases.security.issues });
      return { ok: false, reason: "security_failed" };
    }
  }
  if (options?.requireApprovalBeforeMerge) {
    await markTeamRuntimeApprovalWaiting(ctx);
  }
  return { ok: true };
}
