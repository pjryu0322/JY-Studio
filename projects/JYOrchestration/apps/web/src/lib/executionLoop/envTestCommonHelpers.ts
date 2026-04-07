/**
 * ENV_TEST family: shared utilities only (PR platform phase, guards, branch pick).
 * Stage1/Stage2 orchestration lives in envTestStage1Helpers / stage2/* / envTestGithubFinalize.
 */
import {
  isEnvTestFamilyTaskKind,
  isEnvTestStage1TaskKind,
  isEnvTestStage2TaskKind,
} from "@/lib/execution/envTestTaskKind";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import {
  createOrUpdateEnvTestPullRequest,
  isEnvTestPullRequestCreateRetryableForStage1HeadDelay,
  type EnvTestPrCreateFailed,
} from "@/lib/service/githubEnvTestPullRequestService";
import {
  monitorPlatformPrDone,
  monitorPlatformPrStart,
  patchTaskExecutionRunStage2RuntimeMonitor,
} from "@/lib/service/envTestStage2RuntimeMonitor";
import { patchTaskExecutionRunStage2Timing } from "@/lib/service/envTestStage2Telemetry";

/**
 * ENV_TEST 전용 헬퍼 진입 방어. 위반 시 로그 후 throw(부분 DB 갱신 없음).
 */
export function requireEnvTestFamilyTaskKindForFinalize(
  taskKind: string | null | undefined,
  callee: string,
  ctx: { projectId: string; taskId: string; actorUserId?: string | null }
): void {
  if (isEnvTestFamilyTaskKind(taskKind)) return;
  appendTaskProgressLog({
    kind: "execution",
    phase: "execution_scope_guard_blocked",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId ?? undefined,
    detail: {
      callee,
      taskKindReceived: taskKind ?? null,
      expectedTaskKinds: "ENV_TEST | ENV_TEST_STAGE2",
    },
  });
  throw new Error(`[${callee}] execution scope guard: requires ENV_TEST family taskKind`);
}

export function pickEnvTestHeadBranch(input: {
  cursorBranchName?: string | null;
  signalBranchNameHint?: string | null;
  fallbackBranchName?: string | null;
}): string {
  return (
    String(input.cursorBranchName ?? "").trim() ||
    String(input.signalBranchNameHint ?? "").trim() ||
    String(input.fallbackBranchName ?? "").trim()
  );
}

export function elapsedSinceRun(createdAt: Date | null | undefined): number | undefined {
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
  executionRunCreatedAt?: Date | null;
  compareOkAtMs?: number | null;
  execRunId?: string | null;
  stage1PrCreateRetry?: { intervalMs: number; maxAttempts: number } | null;
  suppressPrServiceLogs?: boolean;
}): Promise<
  | { ok: true; prUrl: string; prNumber: number; reusedExisting: boolean; prElapsedMs: number }
  | {
      ok: false;
      message: string;
      httpStatus?: number;
      githubPrCode?: string;
      headSentToGithub?: string | null;
      headBranchRaw?: string | null;
      headBranchNormalized?: string | null;
      githubHeadFieldInvalid?: boolean | null;
    }
> {
  requireEnvTestFamilyTaskKindForFinalize(input.taskKind, "runEnvTestPlatformPrPhase", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });
  const prPhaseStartedAt = Date.now();
  const elapsedMsSinceRunStart = elapsedSinceRun(input.executionRunCreatedAt ?? undefined);
  if (isEnvTestStage2TaskKind(input.taskKind) && input.execRunId) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "pr_create_started",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: { headBranch: input.headBranch },
    });
    await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorPlatformPrStart(m, Date.now()));
  }
  if (!isEnvTestStage1TaskKind(input.taskKind)) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_pr_lookup_started",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: { headBranch: input.headBranch, elapsedMsSinceRunStart },
    });
  }
  const retryCfg =
    isEnvTestStage1TaskKind(input.taskKind) && input.stage1PrCreateRetry
      ? input.stage1PrCreateRetry
      : null;
  const suppressGithubPrServiceLogs =
    input.suppressPrServiceLogs === true || isEnvTestStage1TaskKind(input.taskKind);
  const prArgs = {
    repoUrl: input.repoUrl,
    baseBranch: input.baseBranch,
    headBranch: input.headBranch,
    githubAccessToken: input.githubAccessToken ?? null,
    projectId: input.projectId,
    taskId: input.taskId,
    execRunId: input.execRunId ?? null,
    envTestStage: isEnvTestStage2TaskKind(input.taskKind) ? ("stage2" as const) : ("stage1" as const),
    ...(suppressGithubPrServiceLogs ? { suppressProgressLogs: true as const } : {}),
  };

  let prRes: Awaited<ReturnType<typeof createOrUpdateEnvTestPullRequest>>;
  let stage1PrFailureSuffix: string | null = null;

  if (retryCfg) {
    let attemptCount = 0;
    while (true) {
      attemptCount += 1;
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_pr_create_attempt",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        detail: {
          attemptCount,
          maxAttempts: retryCfg.maxAttempts,
          headBranch: input.headBranch,
          executionId: input.execRunId ?? null,
        },
      });

      prRes = await createOrUpdateEnvTestPullRequest(prArgs);

      if (prRes.ok) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "env_test_pr_create_success",
          projectId: input.projectId,
          taskId: input.taskId,
          userId: input.actorUserId,
          detail: {
            attemptCount,
            errorType: null,
            httpStatus: null,
            prUrl: prRes.data.pullRequestUrl,
            prNumber: prRes.data.pullRequestNumber,
            reusedExisting: prRes.data.reusedExisting,
            headBranch: input.headBranch,
            executionId: input.execRunId ?? null,
          },
        });
        break;
      }

      const retryable = isEnvTestPullRequestCreateRetryableForStage1HeadDelay(prRes, {
        attemptCount,
      });
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_pr_create_failed",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        detail: {
          attemptCount,
          errorType: prRes.code,
          httpStatus: prRes.httpStatus ?? null,
          retryable,
          message: prRes.message.slice(0, 1200),
          headBranch: input.headBranch,
          executionId: input.execRunId ?? null,
        },
      });

      const stop = !retryable || attemptCount >= retryCfg.maxAttempts;
      if (stop) {
        stage1PrFailureSuffix =
          attemptCount >= retryCfg.maxAttempts
            ? ` (${retryCfg.maxAttempts}회 시도 후 중단)`
            : " (재시도 불가 오류)";
        appendTaskProgressLog({
          kind: "execution",
          phase: "env_test_pr_create_giveup",
          projectId: input.projectId,
          taskId: input.taskId,
          userId: input.actorUserId,
          detail: {
            attemptCount,
            maxAttempts: retryCfg.maxAttempts,
            reason: !retryable ? "non_retryable_error" : "max_attempts_exhausted",
            errorType: prRes.code,
            httpStatus: prRes.httpStatus ?? null,
            headBranch: input.headBranch,
            executionId: input.execRunId ?? null,
          },
        });
        break;
      }

      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_pr_create_retry",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        detail: {
          attemptCount,
          nextAttempt: attemptCount + 1,
          intervalMs: retryCfg.intervalMs,
          errorType: prRes.code,
          httpStatus: prRes.httpStatus ?? null,
          headBranch: input.headBranch,
          executionId: input.execRunId ?? null,
        },
      });
      await new Promise((r) => setTimeout(r, retryCfg.intervalMs));
    }
  } else {
    prRes = await createOrUpdateEnvTestPullRequest(prArgs);
  }

  if (!prRes.ok) {
    const prElapsedMsOnFailure = Date.now() - prPhaseStartedAt;
    if (isEnvTestStage1TaskKind(input.taskKind) && input.execRunId) {
      await patchTaskExecutionRunStage2Timing(input.execRunId, {
        executionId: input.execRunId,
        prCreationTimeMs: prElapsedMsOnFailure,
      });
    }
    const suffix = stage1PrFailureSuffix ?? "";
    const httpStatus = "httpStatus" in prRes && typeof prRes.httpStatus === "number" ? prRes.httpStatus : undefined;
    const githubPrCode = "code" in prRes && typeof prRes.code === "string" ? prRes.code : undefined;
    const prCreateFailed =
      prRes.ok === false && prRes.code === "ENV_TEST_PR_CREATE_FAILED" ? (prRes as EnvTestPrCreateFailed) : null;
    return {
      ok: false,
      message: `${prRes.message}${suffix}`.slice(0, 4000),
      httpStatus,
      githubPrCode,
      headSentToGithub: prCreateFailed?.headSentToGithub ?? null,
      headBranchRaw: prCreateFailed?.headBranchRaw ?? null,
      headBranchNormalized: prCreateFailed?.headBranchNormalized ?? null,
      githubHeadFieldInvalid: prCreateFailed?.githubHeadFieldInvalid ?? null,
    };
  }
  if (isEnvTestStage2TaskKind(input.taskKind) && input.execRunId) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "pr_create_finished",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: { prUrl: prRes.data.pullRequestUrl, prNumber: prRes.data.pullRequestNumber },
    });
    await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorPlatformPrDone(m, Date.now()));
  }
  const prElapsedMs = Date.now() - prPhaseStartedAt;
  const elapsedMsCompareToPr =
    typeof input.compareOkAtMs === "number" ? Date.now() - input.compareOkAtMs : null;
  if (!isEnvTestStage1TaskKind(input.taskKind)) {
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
  }
  return {
    ok: true,
    prUrl: prRes.data.pullRequestUrl,
    prNumber: prRes.data.pullRequestNumber,
    reusedExisting: prRes.data.reusedExisting,
    prElapsedMs,
  };
}
