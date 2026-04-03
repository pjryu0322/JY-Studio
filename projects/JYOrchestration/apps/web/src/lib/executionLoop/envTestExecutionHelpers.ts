import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { prisma } from "@/lib/prisma";
import { createOrUpdateEnvTestPullRequest } from "@/lib/service/githubEnvTestPullRequestService";
import { executeEnvTestPrMergeSmokeTest } from "@/lib/service/environmentTestMergeService";
import { evaluateNextTaskReadiness } from "@/lib/executionLoop/nextTaskReadiness";
import type { LoopStepRecord, RunExecutionLoopResult } from "@/lib/executionLoop/runLoopTypes";
import { refreshWorkflowStates, updateTaskOrchestrationSnapshot } from "@/lib/executionLoop/workflowState";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";

/** runExecutionLoop·DB taskKind와 동일. ENV_TEST 전용 finalize/PR 단계 스코프 판별에 사용. */
export const ENV_TEST_EXECUTION_SCOPE_KIND = "ENV_TEST" as const;

/**
 * ENV_TEST 전용 헬퍼 진입 방어. 위반 시 로그 후 throw(부분 DB 갱신 없음).
 * Shared compare/PR 서비스는 그대로 두고, 이 모듈의 오케스트레이션만 게이트한다.
 */
export function requireEnvTestTaskKindForFinalize(
  taskKind: string | null | undefined,
  callee: string,
  ctx: { projectId: string; taskId: string; actorUserId?: string | null }
): void {
  if (String(taskKind ?? "").trim() === ENV_TEST_EXECUTION_SCOPE_KIND) return;
  appendTaskProgressLog({
    kind: "execution",
    phase: "execution_scope_guard_blocked",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId ?? undefined,
    detail: {
      callee,
      taskKindReceived: taskKind ?? null,
      expectedTaskKind: ENV_TEST_EXECUTION_SCOPE_KIND,
    },
  });
  throw new Error(`[${callee}] execution scope guard: requires taskKind ENV_TEST`);
}

function elapsedSinceRun(createdAt: Date | null | undefined): number | undefined {
  return createdAt ? Date.now() - createdAt.getTime() : undefined;
}

/** ENV_TEST 전용: 플랫폼이 GitHub API로 테스트 PR 생성·갱신(createOrUpdateEnvTestPullRequest). */
export async function runEnvTestPlatformPrPhase(input: {
  projectId: string;
  taskId: string;
  actorUserId: string;
  taskKind: string | null;
  repoUrl: string;
  baseBranch: string;
  headBranch: string;
  githubAccessToken?: string | null;
  /** 경과 ms (compare 확정 이후 PR 단계) */
  executionRunCreatedAt?: Date | null;
  /** ENV_TEST compare ahed_by 확인 시각(밀리초). 있으면 compare→PR elapsed 로깅에 사용. */
  compareOkAtMs?: number | null;
}): Promise<
  | { ok: true; prUrl: string; prNumber: number; reusedExisting: boolean }
  | { ok: false; message: string }
> {
  requireEnvTestTaskKindForFinalize(input.taskKind, "runEnvTestPlatformPrPhase", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });
  const elapsedMsSinceRunStart = elapsedSinceRun(input.executionRunCreatedAt ?? undefined);
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_pr_lookup_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { headBranch: input.headBranch, elapsedMsSinceRunStart },
  });
  const prRes = await createOrUpdateEnvTestPullRequest({
    repoUrl: input.repoUrl,
    baseBranch: input.baseBranch,
    headBranch: input.headBranch,
    githubAccessToken: input.githubAccessToken ?? null,
  });
  if (!prRes.ok) {
    return { ok: false, message: prRes.message };
  }
  const elapsedMsCompareToPr =
    typeof input.compareOkAtMs === "number" ? Date.now() - input.compareOkAtMs : null;
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_pr_created_or_found",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: {
      prUrl: prRes.data.pullRequestUrl,
      prNumber: prRes.data.pullRequestNumber,
      headBranch: input.headBranch,
      reusedExisting: prRes.data.reusedExisting,
      elapsedMsSinceRunStart,
      elapsedMsCompareOkToPrFoundOrCreated: elapsedMsCompareToPr,
    },
  });
  return {
    ok: true,
    prUrl: prRes.data.pullRequestUrl,
    prNumber: prRes.data.pullRequestNumber,
    reusedExisting: prRes.data.reusedExisting,
  };
}

/**
 * GitHub compare로 푸시가 확인된 뒤 ENV_TEST 전용: run 메타 갱신 → 플랫폼 PR → PR_OPENED.
 * (Cursor payload에 commit/files가 없어도 동일)
 */
export async function runEnvTestAfterGithubPushConfirmed(input: {
  projectId: string;
  taskId: string;
  taskKind: string | null;
  execRunId: string;
  actorUserId: string;
  branchName: string;
  repoUrl: string;
  baseBranch: string;
  githubAccessToken?: string | null;
  compareData: {
    headSha: string | null;
    changedFiles: string[];
    diffSummary: string;
    compareOkAtMs?: number | null;
  };
  steps: LoopStepRecord[];
  singleTaskId?: string;
  effectiveAutoAdvance: boolean;
  cursorRunId?: string | null;
  cursorSummary?: string | null;
  /** finalize·이력용: reflection_bypass | cursor_error_recovery | post_cursor_compare | cursor_poll_early_github */
  via: string;
  /** env_test_push_detected.detail.source */
  pushDetectedSource: string;
  executionRunCreatedAt?: Date | null;
}): Promise<
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" }
  | { kind: "pr_failed"; message: string }
> {
  requireEnvTestTaskKindForFinalize(input.taskKind, "runEnvTestAfterGithubPushConfirmed", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });
  const elapsedMsSinceRunStart = elapsedSinceRun(input.executionRunCreatedAt ?? undefined);

  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: {
      ...(input.cursorRunId ? { cursorRunId: input.cursorRunId } : {}),
      ...(input.cursorSummary != null ? { cursorSummary: input.cursorSummary.slice(0, 24_000) } : {}),
      branchName: input.branchName,
      commitSha: input.compareData.headSha ?? null,
      changedFiles: input.compareData.changedFiles as unknown as object,
      gitSummary: input.compareData.diffSummary.slice(0, 24_000),
      validationOutput: null,
      commitStatus: input.compareData.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
      pushStatus: "pushed_by_github_compare",
      status: "running",
      evaluationReason: null,
    },
  });

  const committedSummary =
    input.via === "cursor_error_recovery"
      ? "ENV_TEST: GitHub compare로 푸시 확인 후 플랫폼 PR 처리."
      : input.via === "reflection_bypass"
        ? "ENV_TEST: Cursor 메타 미확인, GitHub compare로 푸시 확인 후 플랫폼 PR."
        : input.via === "cursor_poll_early_github"
          ? "ENV_TEST: Cursor 폴링 중 GitHub compare로 푸시 확인 후 플랫폼 PR 처리."
          : "ENV_TEST: GitHub에서 브랜치가 베이스보다 앞서 있음(ahead_by). 플랫폼이 PR을 처리합니다.";

  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      executionWorkflowStatus: EXECUTION_WORKFLOW.COMMITTED,
      lastEvalResult: "committed",
      lastEvalSummary: committedSummary.slice(0, 2000),
    },
  });

  const prPhase = await runEnvTestPlatformPrPhase({
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    taskKind: input.taskKind,
    repoUrl: input.repoUrl,
    baseBranch: input.baseBranch,
    headBranch: input.branchName,
    githubAccessToken: input.githubAccessToken ?? null,
    executionRunCreatedAt: input.executionRunCreatedAt ?? null,
    compareOkAtMs: input.compareData.compareOkAtMs ?? null,
  });
  if (!prPhase.ok) {
    return { kind: "pr_failed", message: prPhase.message };
  }

  const fin = await finalizeEnvTestPrOpenedFromGithubOnly({
    projectId: input.projectId,
    taskId: input.taskId,
    taskKind: input.taskKind,
    execRunId: input.execRunId,
    actorUserId: input.actorUserId,
    branchName: input.branchName,
    prUrl: prPhase.prUrl,
    prNumber: prPhase.prNumber,
    steps: input.steps,
    singleTaskId: input.singleTaskId,
    effectiveAutoAdvance: input.effectiveAutoAdvance,
    cursorRunId: input.cursorRunId ?? undefined,
    via: input.via,
    runDataPatch: {
      commitSha: input.compareData.headSha ?? null,
      changedFiles: input.compareData.changedFiles as unknown as object,
      gitSummary: input.compareData.diffSummary.slice(0, 24_000),
      commitStatus: input.compareData.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
    },
    snapshotPatch: {
      commitSha: input.compareData.headSha ?? null,
      changedFileCount: input.compareData.changedFiles.length,
      commitStatus: input.compareData.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
    },
  });
  if (fin.kind === "return") return { kind: "return", result: fin.result };
  return { kind: "continue_loop" };
}

export type EnvTestGithubFinalizeReturn =
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" };

/** ENV_TEST 전용: GitHub API 기준 PR_OPENED·run 완료 정리. */
export async function finalizeEnvTestPrOpenedFromGithubOnly(input: {
  projectId: string;
  taskId: string;
  taskKind: string | null;
  execRunId: string;
  actorUserId: string;
  branchName: string;
  prUrl: string;
  prNumber: number;
  steps: LoopStepRecord[];
  singleTaskId?: string;
  effectiveAutoAdvance: boolean;
  cursorRunId?: string | null;
  via?: string;
  runDataPatch?: {
    commitSha?: string | null;
    changedFiles?: object;
    gitSummary?: string | null;
    commitStatus?: string | null;
  };
  snapshotPatch?: {
    commitSha?: string | null;
    changedFileCount?: number | null;
    commitStatus?: string | null;
  };
}): Promise<EnvTestGithubFinalizeReturn> {
  requireEnvTestTaskKindForFinalize(input.taskKind, "finalizeEnvTestPrOpenedFromGithubOnly", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });
  const lastEvalSummary =
    "플랫폼이 GitHub API로 ENV_TEST PR을 생성·갱신하고 PR_OPENED로 처리했습니다.";

  const runMeta = await prisma.taskExecutionRun.findUnique({
    where: { id: input.execRunId },
    select: { createdAt: true },
  });
  const completedAt = new Date();
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: {
      status: "done",
      evaluationDecision: "done",
      prStatus: `open:${input.prNumber}:${input.prUrl}`,
      pushStatus: "pr_opened",
      completedAt,
      ...(input.cursorRunId ? { cursorRunId: input.cursorRunId } : {}),
      ...(input.runDataPatch ?? {}),
    },
  });

  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      executionWorkflowStatus: EXECUTION_WORKFLOW.PR_OPENED,
      status: "DONE",
      lastEvalResult: "pr_opened",
      lastEvalSummary: lastEvalSummary.slice(0, 2000),
      loopRetryCount: 0,
    },
  });

  await updateTaskOrchestrationSnapshot(input.taskId, {
    branch: input.branchName,
    pushStatus: "pr_opened",
    ...(input.snapshotPatch ?? {}),
  });

  await refreshWorkflowStates(input.projectId);

  // ENV_TEST 전용: PR_OPENED 직후 머지를 자동 실행(스모크 테스트용).
  const mergeRes = await executeEnvTestPrMergeSmokeTest({
    projectId: input.projectId,
    actorUserId: input.actorUserId,
  });

  const readiness = await evaluateNextTaskReadiness({ projectId: input.projectId });

  if (input.singleTaskId || !input.effectiveAutoAdvance || !mergeRes.ok) {
    const mergeOk = mergeRes.ok === true;
    return {
      kind: "return",
      result: {
        ok: mergeOk,
        steps: input.steps,
        message: mergeOk
          ? (mergeRes.message ?? "환경 연결 테스트가 완료되었습니다. GitHub 머지가 확인되었습니다.")
          : (mergeRes.message ?? "환경 연결 테스트: 머지 단계에서 실패했습니다."),
        nextTaskReadiness: readiness,
      },
    };
  }
  return { kind: "continue_loop" };
}
