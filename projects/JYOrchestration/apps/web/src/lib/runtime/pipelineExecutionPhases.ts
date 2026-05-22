/**
 * Pipeline worker phases: reviewer → security (team runtime) → SCM → merge.
 */

import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { evaluateExecutionResult } from "@/lib/execution/evaluateTaskExecution";
import {
  countExecutionReviewAiMembers,
  type ExecutionReviewerStepRecord,
} from "@/lib/execution/executionReviewWithAiMembers";
import { parseCriteria } from "@/lib/executionLoop/loopJsonUtils";
import { countScmManagerAiMembers, tryRunScmManagerWithAiMembers } from "@/lib/execution/scmManagerWithAiMembers";
import { fetchGithubCompareSnapshot } from "@/lib/service/githubCompareService";
import { createGithubPullRequestFromBranch } from "@/lib/service/githubPullRequestFromBranchService";
import { autoMergePullRequest, isAutoMergeEnabled } from "@/lib/service/githubAutoMergeService";
import { formatOpenPrStatusValue, resolvePrForScmMerge } from "@/lib/ai-team-runtime/scmPrResolve";
import { persistScmBlockReasonOnRun } from "@/lib/ai-team-runtime/scmBlockReason";
import {
  applyTeamRuntimeAfterReviewHarness,
  markTeamRuntimeReviewFailed,
  markTeamRuntimeReviewRunning,
  markTeamRuntimeMergeRunning,
  markTeamRuntimeCompleted,
} from "@/lib/ai-team-runtime/teamRuntimeLoopBridge";
import { buildCursorResultFromExecutionRun } from "@/lib/ai-team-runtime/roleSeparatedMergeResume";
import { prisma } from "@/lib/prisma";
import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";

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

export async function runReviewerPhase(ctx: PipelinePhaseContext): Promise<ReviewerPhaseResult> {
  await appendRuntimeEvent({
    eventType: "REVIEW_STARTED",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    execRunId: ctx.execRunId,
    actorUserId: ctx.actorUserId,
    workerName: "pipeline",
    executionJobId: ctx.executionJobId ?? null,
    runtimeState: "reviewing",
  });

  const executionReviewerCount = await countExecutionReviewAiMembers(ctx.projectId);
  if (executionReviewerCount === 0) {
    return {
      ok: false,
      code: "REVIEWER_NOT_CONFIGURED",
      message: "AI Reviewer가 설정되지 않았습니다.",
    };
  }

  const execRun = await prisma.taskExecutionRun.findUnique({ where: { id: ctx.execRunId } });
  if (!execRun) {
    return { ok: false, code: "EXEC_RUN_NOT_FOUND", message: "Execution run not found" };
  }

  const cr = buildCursorResultFromExecutionRun(execRun);
  const compare = await fetchGithubCompareSnapshot({
    repoUrl: ctx.repoUrl,
    base: ctx.baseBranch,
    head: cr.branchName,
    maxFiles: 80,
    githubAccessToken: ctx.githubAccessToken,
    projectId: ctx.projectId,
  });
  const gitEvidence = compare.ok
    ? {
        baseBranch: ctx.baseBranch,
        headBranch: cr.branchName,
        headSha: compare.data.headSha,
        changedFiles: compare.data.changedFiles,
        diffSummary: compare.data.diffSummary,
      }
    : null;
  const criteria = parseCriteria(ctx.acceptanceCriteriaJson);

  await markTeamRuntimeReviewRunning({
    execRunId: ctx.execRunId,
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    actorUserId: ctx.actorUserId,
  });

  let evalPack: Awaited<ReturnType<typeof evaluateExecutionResult>>;
  try {
    evalPack = await evaluateExecutionResult({
      projectId: ctx.projectId,
      task: {
        title: ctx.taskTitle,
        description: ctx.taskDescription,
        acceptanceCriteria: criteria,
      },
      cursorResult: cr,
      changedFiles: gitEvidence?.changedFiles ?? cr.changedFiles,
      summary: cr.summary,
      acceptanceCriteria: criteria,
      stopOnTestFailure: ctx.stopOnTestFailure,
      stopOnOutOfScopeChange: ctx.stopOnOutOfScopeChange,
      allowedPathGlobs: [...ctx.mergedAllowedGlobs],
      repoUrl: ctx.repoUrl,
      executionReviewerCount,
      gitEvidence,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markTeamRuntimeReviewFailed(
      {
        execRunId: ctx.execRunId,
        projectId: ctx.projectId,
        taskId: ctx.taskId,
        actorUserId: ctx.actorUserId,
      },
      { error: msg },
    );
    return { ok: false, code: "REVIEW_EXCEPTION", message: msg };
  }

  const verdict = evalPack.result.decision;
  await prisma.taskExecutionRun.update({
    where: { id: ctx.execRunId },
    data: {
      evaluationReason: evalPack.result.reason.slice(0, 8000),
      evaluationDecision: verdict,
      status: "reviewing",
      ...(evalPack.reviewerSteps.length > 0 ? { evaluationReviewerSteps: evalPack.reviewerSteps as object } : {}),
    },
  });

  if (verdict !== "done") {
    await markTeamRuntimeReviewFailed(
      {
        execRunId: ctx.execRunId,
        projectId: ctx.projectId,
        taskId: ctx.taskId,
        actorUserId: ctx.actorUserId,
      },
      { verdict },
    );
    await appendRuntimeEvent({
      eventType: "REVIEW_FAILED",
      severity: "warning",
      projectId: ctx.projectId,
      taskId: ctx.taskId,
      execRunId: ctx.execRunId,
      actorUserId: ctx.actorUserId,
      workerName: "pipeline",
      failurePhase: "REVIEW",
      executionJobId: ctx.executionJobId ?? null,
      detail: { verdict, reason: evalPack.result.reason },
    });
    return { ok: false, code: "REVIEW_REJECTED", message: evalPack.result.reason, verdict };
  }

  await appendRuntimeEvent({
    eventType: "REVIEW_APPROVED",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    execRunId: ctx.execRunId,
    actorUserId: ctx.actorUserId,
    workerName: "pipeline",
    executionJobId: ctx.executionJobId ?? null,
  });

  return { ok: true, verdict: "done", evalPack };
}

export async function runSecurityPhase(
  ctx: PipelinePhaseContext,
  reviewerSteps: readonly ExecutionReviewerStepRecord[]
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  await appendRuntimeEvent({
    eventType: "SECURITY_STARTED",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    execRunId: ctx.execRunId,
    actorUserId: ctx.actorUserId,
    workerName: "pipeline",
    executionJobId: ctx.executionJobId ?? null,
  });

  const teamAfterReview = await applyTeamRuntimeAfterReviewHarness(
    {
      execRunId: ctx.execRunId,
      projectId: ctx.projectId,
      taskId: ctx.taskId,
      actorUserId: ctx.actorUserId,
    },
    reviewerSteps,
    { requireApprovalBeforeMerge: ctx.requireApprovalBeforeApply }
  );

  if (!teamAfterReview.ok) {
    await appendRuntimeEvent({
      eventType: "SECURITY_FAILED",
      severity: "error",
      projectId: ctx.projectId,
      taskId: ctx.taskId,
      execRunId: ctx.execRunId,
      actorUserId: ctx.actorUserId,
      workerName: "pipeline",
      failurePhase: "SECURITY",
      executionJobId: ctx.executionJobId ?? null,
      detail: { reason: teamAfterReview.reason },
    });
    return { ok: false, code: "SECURITY_FAILED", message: teamAfterReview.reason ?? "security_failed" };
  }

  return { ok: true };
}

export type ScmPhaseResult =
  | { ok: true; evalReason: string }
  | { ok: false; code: string; message: string; hold?: boolean };

export async function runScmPhase(
  ctx: PipelinePhaseContext,
  input: { reviewerVerdict: string; reviewerSummary: string }
): Promise<ScmPhaseResult> {
  await appendRuntimeEvent({
    eventType: "SCM_STARTED",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    execRunId: ctx.execRunId,
    actorUserId: ctx.actorUserId,
    workerName: "pipeline",
    executionJobId: ctx.executionJobId ?? null,
  });

  const scmCount = await countScmManagerAiMembers(ctx.projectId);
  if (scmCount === 0) {
    const msg = "SCM Manager 미설정";
    await persistScmBlockReasonOnRun(ctx.execRunId, msg);
    return { ok: false, code: "SCM_NOT_CONFIGURED", message: msg, hold: true };
  }

  const execRun = await prisma.taskExecutionRun.findUnique({ where: { id: ctx.execRunId } });
  if (!execRun) {
    return { ok: false, code: "EXEC_RUN_NOT_FOUND", message: "Execution run not found" };
  }
  const cr = buildCursorResultFromExecutionRun(execRun);

  await markTeamRuntimeMergeRunning({
    execRunId: ctx.execRunId,
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    actorUserId: ctx.actorUserId,
  });

  const scmDecisionPack = await tryRunScmManagerWithAiMembers({
    projectId: ctx.projectId,
    repoUrl: ctx.repoUrl,
    taskId: ctx.taskId,
    taskTitle: ctx.taskTitle,
    taskDescription: ctx.taskDescription,
    branch: cr.branchName,
    baseBranch: ctx.baseBranch,
    reviewerDecision: input.reviewerVerdict,
    reviewerSummary: input.reviewerSummary,
  });

  if (!scmDecisionPack || scmDecisionPack.decision !== "approve_merge") {
    const msg = scmDecisionPack?.summary || "SCM hold";
    await persistScmBlockReasonOnRun(ctx.execRunId, msg);
    return { ok: false, code: "SCM_HOLD", message: msg, hold: true };
  }

  return { ok: true, evalReason: input.reviewerSummary };
}

export type MergePhaseResult =
  | { ok: true; merged: true; prUrl: string }
  | { ok: true; merged: false; message: string }
  | { ok: false; code: string; message: string };

export async function runMergePhase(
  ctx: PipelinePhaseContext,
  input: { evalReason: string }
): Promise<MergePhaseResult> {
  const execRun = await prisma.taskExecutionRun.findUnique({ where: { id: ctx.execRunId } });
  if (!execRun) {
    return { ok: false, code: "EXEC_RUN_NOT_FOUND", message: "Execution run not found" };
  }
  const cr = buildCursorResultFromExecutionRun(execRun);

  let prForMerge = await resolvePrForScmMerge({
    execRunPrStatus: execRun.prStatus,
    repoUrl: ctx.repoUrl,
    headBranch: cr.branchName,
    githubAccessToken: ctx.githubAccessToken,
    projectId: ctx.projectId,
  });

  if (!prForMerge) {
    const prCreate = await createGithubPullRequestFromBranch({
      repoUrl: ctx.repoUrl,
      baseBranch: ctx.baseBranch,
      headBranch: cr.branchName,
      title: `[auto] ${ctx.taskTitle}`.slice(0, 240),
      body: `Automated pipeline worker.\n\nTask: ${ctx.taskId}\n\n${input.evalReason}`.slice(0, 6000),
      githubAccessToken: ctx.githubAccessToken,
      projectId: ctx.projectId,
    });
    if (!prCreate.ok) {
      await persistScmBlockReasonOnRun(ctx.execRunId, prCreate.message);
      return { ok: false, code: "PR_CREATE_FAILED", message: prCreate.message };
    }
    prForMerge = {
      pullRequestUrl: prCreate.data.pullRequestUrl,
      pullRequestNumber: prCreate.data.pullRequestNumber,
    };
  }

  if (!isAutoMergeEnabled()) {
    await persistScmBlockReasonOnRun(ctx.execRunId, "PR ready; auto merge disabled");
    return { ok: true, merged: false, message: "PR ready; merge pending" };
  }

  const mr = await autoMergePullRequest({
    prUrl: prForMerge.pullRequestUrl,
    githubAccessToken: ctx.githubAccessToken,
    commitTitle: `Auto-merge: ${ctx.taskTitle}`.slice(0, 240),
  });

  if (!mr.ok) {
    await persistScmBlockReasonOnRun(ctx.execRunId, mr.message);
    await appendRuntimeEvent({
      eventType: "MERGE_FAILED",
      severity: "error",
      projectId: ctx.projectId,
      taskId: ctx.taskId,
      execRunId: ctx.execRunId,
      actorUserId: ctx.actorUserId,
      workerName: "pipeline",
      failurePhase: "MERGE",
      executionJobId: ctx.executionJobId ?? null,
      detail: { message: mr.message },
    });
    return { ok: false, code: "MERGE_FAILED", message: mr.message };
  }

  await prisma.taskExecutionRun.update({
    where: { id: ctx.execRunId },
    data: { prStatus: "merged", status: "done", evaluationDecision: "done" },
  });
  await markTeamRuntimeCompleted({
    execRunId: ctx.execRunId,
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    actorUserId: ctx.actorUserId,
  });
  await prisma.task.update({
    where: { id: ctx.taskId },
    data: {
      executionWorkflowStatus: EXECUTION_WORKFLOW.MERGED,
      status: "DONE",
      lastEvalResult: "merged",
      lastEvalSummary: "Merged to main (pipeline worker).",
    },
  });

  await appendRuntimeEvent({
    eventType: "MERGE_COMPLETED",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    execRunId: ctx.execRunId,
    actorUserId: ctx.actorUserId,
    workerName: "pipeline",
    executionJobId: ctx.executionJobId ?? null,
    detail: { prUrl: prForMerge.pullRequestUrl },
  });

  return { ok: true, merged: true, prUrl: prForMerge.pullRequestUrl };
}
