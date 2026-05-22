/**
 * Cursor git reflection / compare confirmation (normal Task worker path).
 */

import type { Prisma } from "@prisma/client";
import { AI_TEAM_EXECUTION_STATUS } from "@/lib/ai-team-runtime/status";
import {
  markTeamRuntimeReflectionWaiting,
  type TeamRuntimeLoopContext,
} from "@/lib/ai-team-runtime/teamRuntimeLoopBridge";
import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";
import { isCursorCodeReflectionConfirmed } from "@/lib/execution/cursorReflectionPolicy";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { updateTaskOrchestrationSnapshot } from "@/lib/executionLoop/workflowState";
import { prisma } from "@/lib/prisma";
import { fetchGithubCompareSnapshot } from "@/lib/service/githubCompareService";
import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";

export type CursorGitReflectionInput = {
  readonly execRunId: string;
  readonly projectId: string;
  readonly taskId: string;
  readonly actorUserId: string;
  readonly repoUrl: string;
  readonly baseBranch: string;
  readonly headBranch: string;
  readonly cursorResult: CursorRunResult;
  readonly githubAccessToken?: string | null;
  readonly executionJobId?: string | null;
};

export type CursorGitReflectionResult = {
  readonly confirmed: boolean;
  readonly reason: string;
  readonly headSha?: string | null;
  readonly changedFiles?: unknown[];
  readonly diffSummary?: string;
};

async function runTeamRuntimeSafe(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.warn(`[runtime-reflection][team-runtime] ${label}`, e);
  }
}

export async function confirmCursorGitReflection(
  input: CursorGitReflectionInput
): Promise<CursorGitReflectionResult> {
  const cr = input.cursorResult;
  const reflectionOk = isCursorCodeReflectionConfirmed(cr);

  if (!reflectionOk) {
    const gateReason = "no_commit_and_no_changed_files";
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.PENDING_APPLY,
        lastEvalResult: "pending_apply",
        lastEvalSummary:
          "Cursor 에이전트는 종료되었으나 commit·변경 파일이 보고되지 않아 코드 반영을 확인할 수 없습니다.",
      },
    });

    await prisma.taskExecutionRun.update({
      where: { id: input.execRunId },
      data: {
        cursorRunId: cr.runId,
        cursorSummary: cr.summary,
        branchName: cr.branchName,
        commitSha: cr.commitHash ?? null,
        changedFiles: cr.changedFiles as unknown as Prisma.InputJsonValue,
        gitSummary: cr.summary.slice(0, 24_000),
        validationOutput: null,
        commitStatus: "no_commit_hash",
        pushStatus: "delegated_to_cursor",
        status: "awaiting_git_reflection",
        teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.REFLECTION_WAITING,
        evaluationReason:
          "git_reflection_unconfirmed: commitHash 없음 · changedFiles=0 — pending_apply",
      },
    });

    const teamCtx: TeamRuntimeLoopContext = {
      execRunId: input.execRunId,
      projectId: input.projectId,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
    };
    await runTeamRuntimeSafe("reflection_waiting", () =>
      markTeamRuntimeReflectionWaiting(teamCtx, { gateReason })
    );

    await updateTaskOrchestrationSnapshot(input.taskId, {
      branch: cr.branchName,
      commitStatus: "no_commit_hash",
      pushStatus: "delegated_to_cursor",
      commitSha: cr.commitHash ?? null,
      changedFileCount: cr.changedFiles.length,
    });

    await appendRuntimeEvent({
      eventType: "RUNTIME_DEFERRED",
      severity: "warning",
      projectId: input.projectId,
      taskId: input.taskId,
      execRunId: input.execRunId,
      actorUserId: input.actorUserId,
      workerName: "cursor",
      executionJobId: input.executionJobId ?? null,
      runtimeState: "reflection_waiting",
      detail: { gateReason, passed: false },
    });

    return { confirmed: false, reason: gateReason };
  }

  await prisma.task.update({
    where: { id: input.taskId },
    data: { executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEWING },
  });

  const compare = await fetchGithubCompareSnapshot({
    repoUrl: input.repoUrl,
    base: input.baseBranch,
    head: input.headBranch,
    maxFiles: 80,
    githubAccessToken: input.githubAccessToken ?? null,
    projectId: input.projectId,
  });

  let headSha: string | null = cr.commitHash ?? null;
  let changedFiles: unknown[] = cr.changedFiles;
  let diffSummary: string | undefined;

  if (compare.ok) {
    headSha = compare.data.headSha ?? cr.commitHash ?? null;
    changedFiles = compare.data.changedFiles;
    diffSummary = compare.data.diffSummary;
    await prisma.taskExecutionRun.update({
      where: { id: input.execRunId },
      data: {
        commitSha: headSha,
        changedFiles: changedFiles as Prisma.InputJsonValue,
        gitSummary: diffSummary.slice(0, 24_000),
        commitStatus: headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
        pushStatus: "pushed_by_cursor",
      },
    });
  } else {
    await prisma.taskExecutionRun.update({
      where: { id: input.execRunId },
      data: {
        commitStatus: "pushed_commit_unknown",
        pushStatus: "unknown",
        evaluationReason: `github_compare_failed:${compare.code}:${compare.message}`.slice(0, 8000),
      },
    });
  }

  const commitDetected = Boolean(headSha);
  if (commitDetected) {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.COMMITTED,
        lastEvalResult: "committed",
        lastEvalSummary: "Cursor commit/push 완료 (runtime worker path).",
      },
    });
    await prisma.taskExecutionRun.update({
      where: { id: input.execRunId },
      data: {
        status: "reviewing",
        evaluationReason: "git_reflection_confirmed",
      },
    });
  }

  await updateTaskOrchestrationSnapshot(input.taskId, {
    branch: input.headBranch,
    commitStatus: headSha ? "pushed_commit_detected" : "reported_by_cursor",
    pushStatus: compare.ok ? "pushed_by_cursor" : "delegated_to_cursor",
    commitSha: headSha,
    changedFileCount: Array.isArray(changedFiles) ? changedFiles.length : cr.changedFiles.length,
  });

  return {
    confirmed: true,
    reason: "commit_or_changed_files_or_summary_evidence",
    headSha,
    changedFiles,
    diffSummary,
  };
}
