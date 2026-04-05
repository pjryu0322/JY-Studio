/**
 * ENV_TEST 전용: 사용자 트리거 PR 머지 스모크(DB·로그). 일반 Task에는 적용하지 않는다.
 */

import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { withTaskExecutionRunSchemaHealRetry } from "@/lib/prisma/taskExecutionRunColumnsHeal";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { refreshWorkflowStates, updateTaskOrchestrationSnapshot } from "@/lib/executionLoop/workflowState";
import {
  assertEnvTestMergeNotSafeMode,
  envTestMergeGuardAllowedPathGlobsForTaskKind,
  envTestMergeGuardAllowedPathsForTaskKind,
  envTestMergeGuardAllowedRuleForTaskKind,
  evaluateEnvTestMergeGuards,
  fetchEnvTestPullDetail,
  fetchEnvTestPullFiles,
  putEnvTestSquashMerge,
  resolveEnvTestMergeGithubToken,
  verifyEnvTestPullMergedWithRetry,
} from "@/lib/service/githubEnvTestMergeService";
import {
  ENV_TEST_STAGE2_TASK_KIND,
  ENV_TEST_TASK_KIND,
  isEnvTestStage2TaskKind,
} from "@/lib/execution/envTestTaskKind";
import { parseGithubPrUrl } from "@/lib/service/githubAutoMergeService";
import { parsePrUrlFromRunPrStatus } from "@/lib/service/environmentConnectionTestService";

const ENV_TEST_MERGE_VERIFIED_SUMMARY = "ENV_TEST: GitHub에서 머지 완료가 확인되었습니다.";
const ENV_TEST_MERGE_SUCCESS_USER_MESSAGE = "환경 연결 테스트가 완료되었습니다. GitHub 머지가 확인되었습니다.";
const ENV_TEST_STAGE1_MERGE_VERIFIED_SUMMARY = "Stage1: 브랜치·PR·머지 확인 완료.";
const ENV_TEST_STAGE1_MERGE_SUCCESS_USER_MESSAGE = "환경 연결 테스트가 정상 완료되었습니다.";

function envTestMergeVerifiedSummaryForTaskKind(taskKind: string | null | undefined): string {
  return isEnvTestStage2TaskKind(taskKind) ? ENV_TEST_MERGE_VERIFIED_SUMMARY : ENV_TEST_STAGE1_MERGE_VERIFIED_SUMMARY;
}

function envTestMergeSuccessUserMessageForTaskKind(taskKind: string | null | undefined): string {
  return isEnvTestStage2TaskKind(taskKind)
    ? ENV_TEST_MERGE_SUCCESS_USER_MESSAGE
    : ENV_TEST_STAGE1_MERGE_SUCCESS_USER_MESSAGE;
}

export type EnvTestMergeExecutionResult =
  | { ok: true; message: string; mergeCommitSha: string | null; branchDeleted: boolean }
  | { ok: false; message: string; blockedReason?: string };

export async function executeEnvTestPrMergeSmokeTest(input: {
  projectId: string;
  actorUserId: string;
  /** Stage 2: 리뷰 PASS 후 명시적 taskId 로 머지(최신 ENV_TEST 자동 선택과 구분) */
  taskId?: string | null;
}): Promise<EnvTestMergeExecutionResult> {
  const projectId = String(input.projectId ?? "").trim();
  const actorUserId = String(input.actorUserId ?? "").trim();
  const explicitTaskId = String(input.taskId ?? "").trim();

  const proj = await prisma.project.findUnique({
    where: { id: projectId },
    select: { currentSpecVersionId: true },
  });
  const currentSpecId = proj?.currentSpecVersionId ?? null;

  const envKinds = [ENV_TEST_TASK_KIND, ENV_TEST_STAGE2_TASK_KIND] as string[];

  const task = explicitTaskId
    ? await prisma.task.findFirst({
        where: {
          id: explicitTaskId,
          projectId,
          archivedAt: null,
          taskKind: { in: envKinds },
        },
        select: {
          id: true,
          taskKind: true,
          executionWorkflowStatus: true,
          name: true,
          lastOrchestrationBranch: true,
        },
      })
    : await prisma.task.findFirst({
        where: {
          projectId,
          taskKind: ENV_TEST_TASK_KIND,
          archivedAt: null,
          ...(currentSpecId ? { sourceSpecVersionId: currentSpecId } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          taskKind: true,
          executionWorkflowStatus: true,
          name: true,
          lastOrchestrationBranch: true,
        },
      });

  if (!task) {
    return { ok: false, message: "ENV_TEST 작업을 찾을 수 없습니다." };
  }

  const wf = String(task.executionWorkflowStatus ?? "").trim().toLowerCase();
  if (wf === EXECUTION_WORKFLOW.MERGED) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_done",
      projectId,
      taskId: task.id,
      userId: actorUserId,
      detail: { reason: "already_merged_task_workflow" },
    });
    return {
      ok: true,
      message: envTestMergeSuccessUserMessageForTaskKind(task.taskKind),
      mergeCommitSha: null,
      branchDeleted: false,
    };
  }
  const stage2 = isEnvTestStage2TaskKind(task.taskKind);
  const mergeAllowed = stage2
    ? wf === EXECUTION_WORKFLOW.MERGE_PENDING
    : wf === EXECUTION_WORKFLOW.PR_OPENED;
  if (!mergeAllowed) {
    return {
      ok: false,
      message: stage2
        ? "Stage 2: 리뷰 통과 후 MERGE_PENDING 상태에서만 SCM 머지를 실행합니다."
        : "PR_OPENED 상태에서만 테스트 머지를 실행할 수 있습니다.",
      blockedReason: `현재 워크플로: ${task.executionWorkflowStatus ?? "없음"}`,
    };
  }

  const run = await withTaskExecutionRunSchemaHealRetry(() =>
    prisma.taskExecutionRun.findFirst({
      where: { projectId, taskId: task.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        prStatus: true,
        branchName: true,
        repoUrlSnapshot: true,
        mergedAt: true,
        mergeCommitSha: true,
        completedAt: true,
      },
    })
  );

  if (!run) {
    return { ok: false, message: "실행 기록(TaskExecutionRun)을 찾을 수 없습니다." };
  }

  if (run.mergedAt) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_done",
      projectId,
      taskId: task.id,
      userId: actorUserId,
      detail: { reason: "already_merged_run_record" },
    });
    return {
      ok: true,
      message: envTestMergeSuccessUserMessageForTaskKind(task.taskKind),
      mergeCommitSha: run.mergeCommitSha ?? null,
      branchDeleted: false,
    };
  }

  const safe = assertEnvTestMergeNotSafeMode();
  if (!safe.ok) {
    await withTaskExecutionRunSchemaHealRetry(() =>
      prisma.taskExecutionRun.update({
        where: { id: run.id },
        data: {
          envTestMergeBlockedReason: safe.message.slice(0, 2000),
          envTestMergeStartedAt: null,
        },
      })
    );
    await prisma.task.update({
      where: { id: task.id },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.PR_OPENED,
        lastEvalResult: "merge_blocked",
        lastEvalSummary: safe.message.slice(0, 1500),
      },
    });
    return { ok: false, message: safe.message, blockedReason: safe.message };
  }

  // PR_OPENED 이후 머지 진행 중 UI 표시에 사용: executionWorkflowStatus는 PR_OPENED를 유지한다.
  const prOpenedAt = run.completedAt ? run.completedAt.getTime() : null;
  await withTaskExecutionRunSchemaHealRetry(() =>
    prisma.taskExecutionRun.update({
      where: { id: run.id },
      data: {
        envTestMergeBlockedReason: null,
        envTestMergeStartedAt: new Date(),
      },
    })
  );

  // blockedReason을 UI에 표시하기 위한 helper
  const persistMergeBlocked = async (reason: string, blockedCode?: string) => {
    const fullReason = blockedCode ? `${blockedCode}: ${reason}` : reason;
    await withTaskExecutionRunSchemaHealRetry(() =>
      prisma.taskExecutionRun.update({
        where: { id: run.id },
        data: {
          envTestMergeBlockedReason: fullReason.slice(0, 4000),
          envTestMergeStartedAt: null,
          status: "done",
        },
      })
    );
    await prisma.task.update({
      where: { id: task.id },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.PR_OPENED,
        status: "DONE",
        lastEvalResult: "merge_blocked",
        lastEvalSummary: fullReason.slice(0, 1500),
      },
    });
  };

  const prUrl = parsePrUrlFromRunPrStatus(run.prStatus ?? null);
  if (!prUrl) {
    const msg = "PR 정보(prStatus)를 찾을 수 없습니다.";
    await persistMergeBlocked(msg);
    return { ok: false, message: msg, blockedReason: msg };
  }
  const parsedPr = parseGithubPrUrl(prUrl);
  if (!parsedPr) {
    const msg = "PR URL 형식이 올바르지 않습니다.";
    await persistMergeBlocked(msg);
    return { ok: false, message: msg, blockedReason: msg };
  }

  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({
      where: { projectId },
      select: {
        gitRepoUrl: true,
        baseBranch: true,
        githubAccessToken: true,
      },
    })
  );

  if (!setup?.gitRepoUrl?.trim()) {
    return { ok: false, message: "Execution setup에 저장소 URL이 없습니다." };
  }

  const repoUrl = setup.gitRepoUrl.trim();
  const requiredBaseRef = String(setup.baseBranch ?? "").trim();
  if (!requiredBaseRef) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_base_branch_missing",
      projectId,
      taskId: task.id,
      userId: actorUserId,
      detail: { reasonCode: "BASE_BRANCH_MISSING", context: "merge_guard" },
    });
    const msg = "기본 브랜치 설정이 없어 ENV_TEST를 진행할 수 없습니다";
    await persistMergeBlocked(msg, "BASE_BRANCH_MISSING");
    return { ok: false, message: msg, blockedReason: msg };
  }

  const token = resolveEnvTestMergeGithubToken(setup.githubAccessToken ?? null, projectId);
  if (!token) {
    return { ok: false, message: "실행 환경(Execution setup)에 저장된 GitHub 토큰이 필요합니다." };
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_merge_guard_check_started",
    projectId,
    taskId: task.id,
    userId: actorUserId,
    detail: {
      prNumber: parsedPr.number,
      prUrl,
      elapsedMsSincePrOpened: prOpenedAt ? Date.now() - prOpenedAt : null,
    },
  });

  const pullDetail = await fetchEnvTestPullDetail({
    repoUrl,
    pullNumber: parsedPr.number,
    token,
  });
  if (!pullDetail.ok) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_merge_guard_blocked",
      projectId,
      taskId: task.id,
      userId: actorUserId,
      detail: { reason: pullDetail.message, step: "fetch_pr" },
    });
    await persistMergeBlocked(pullDetail.message, pullDetail.code);
    return { ok: false, message: pullDetail.message, blockedReason: pullDetail.code };
  }

  const filesRes = await fetchEnvTestPullFiles({
    repoUrl,
    pullNumber: parsedPr.number,
    token,
  });
  if (!filesRes.ok) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_merge_guard_blocked",
      projectId,
      taskId: task.id,
      userId: actorUserId,
      detail: { reason: filesRes.message, step: "fetch_files" },
    });
    await persistMergeBlocked(filesRes.message, filesRes.code);
    return { ok: false, message: filesRes.message, blockedReason: filesRes.code };
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_merge_base_branch_used",
    projectId,
    taskId: task.id,
    userId: actorUserId,
    detail: { baseBranch: requiredBaseRef, prNumber: parsedPr.number },
  });

  const branchNameForGuard = String(task.lastOrchestrationBranch ?? run.branchName ?? "").trim();
  const allowedPaths = envTestMergeGuardAllowedPathsForTaskKind(task.taskKind);
  const allowedPathGlobs = envTestMergeGuardAllowedPathGlobsForTaskKind(task.taskKind);
  const allowedRule = envTestMergeGuardAllowedRuleForTaskKind(task.taskKind);
  const guardStage = isEnvTestStage2TaskKind(task.taskKind) ? "stage2" : "stage1";

  appendTaskProgressLog({
    kind: "execution",
    phase: "merge_scope_guard_started",
    projectId,
    taskId: task.id,
    userId: actorUserId,
    detail: {
      executionId: run.id,
      taskKind: task.taskKind,
      branchName: branchNameForGuard || null,
      envTestGuardStage: guardStage,
      allowedPaths,
      allowedPathGlobs,
      allowedRule,
      evaluatedScopeRule: allowedRule,
      prFileCount: filesRes.files.length,
    },
  });

  const guard = evaluateEnvTestMergeGuards({
    taskKind: task.taskKind,
    localBranchName: task.lastOrchestrationBranch ?? run.branchName,
    pr: pullDetail.pr,
    files: filesRes.files,
    requiredBaseRef,
  });

  if (!guard.ok) {
    const scopeFailDetail =
      guard.blockedCode === "FILE_OUT_OF_SCOPE" && guard.diagnostics
        ? {
            blockedFiles: guard.diagnostics.blockedFiles ?? null,
            allowedPaths: guard.diagnostics.allowedPaths,
            allowedPathGlobs: guard.diagnostics.allowedPathGlobs,
            allowedRule: guard.diagnostics.allowedRule,
            evaluatedScopeRule: guard.diagnostics.evaluatedScopeRule,
            ruleEvaluation: guard.diagnostics.ruleEvaluation,
            envTestGuardStage: guard.diagnostics.guardStage,
          }
        : null;
    appendTaskProgressLog({
      kind: "execution",
      phase: "merge_scope_guard_failed",
      projectId,
      taskId: task.id,
      userId: actorUserId,
      detail: {
        executionId: run.id,
        taskKind: task.taskKind,
        branchName: branchNameForGuard || null,
        blockedCode: guard.blockedCode,
        blockedReason: guard.blockedReason,
        blockedFiles: scopeFailDetail?.blockedFiles ?? null,
        allowedPaths: scopeFailDetail?.allowedPaths ?? allowedPaths,
        allowedPathGlobs: scopeFailDetail?.allowedPathGlobs ?? allowedPathGlobs,
        allowedRule: scopeFailDetail?.allowedRule ?? allowedRule,
        evaluatedScopeRule: scopeFailDetail?.evaluatedScopeRule ?? allowedRule,
        ruleEvaluation: scopeFailDetail?.ruleEvaluation ?? null,
        envTestGuardStage: scopeFailDetail?.envTestGuardStage ?? guardStage,
        prTitle: pullDetail.pr.title ?? null,
        baseRef: pullDetail.pr.base?.ref ?? null,
        headRef: pullDetail.pr.head?.ref ?? null,
      },
    });
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_merge_guard_blocked",
      projectId,
      taskId: task.id,
      userId: actorUserId,
      detail: {
        executionId: run.id,
        taskKind: task.taskKind,
        branchName: branchNameForGuard || null,
        blockedCode: guard.blockedCode,
        blockedReason: guard.blockedReason,
        blockedFiles: scopeFailDetail?.blockedFiles ?? null,
        allowedPaths: scopeFailDetail?.allowedPaths ?? allowedPaths,
        allowedPathGlobs: scopeFailDetail?.allowedPathGlobs ?? allowedPathGlobs,
        allowedRule: scopeFailDetail?.allowedRule ?? allowedRule,
        evaluatedScopeRule: scopeFailDetail?.evaluatedScopeRule ?? allowedRule,
        ruleEvaluation: scopeFailDetail?.ruleEvaluation ?? null,
        envTestGuardStage: scopeFailDetail?.envTestGuardStage ?? guardStage,
        prTitle: pullDetail.pr.title ?? null,
        baseRef: pullDetail.pr.base?.ref ?? null,
        headRef: pullDetail.pr.head?.ref ?? null,
      },
    });
    await persistMergeBlocked(guard.blockedReason, guard.blockedCode);
    const userMsg =
      guard.blockedCode === "FILE_OUT_OF_SCOPE"
        ? guard.blockedReason
        : `테스트 PR은 안전 조건을 충족하지 않아 머지할 수 없습니다. (${guard.blockedReason})`;
    return {
      ok: false,
      message: userMsg,
      blockedReason: guard.blockedReason,
    };
  }

  const whitelistPatterns = [
    ...new Set(guard.envTestFileWhitelistMatches.map((m) => m.matchedPathPattern)),
  ];
  appendTaskProgressLog({
    kind: "execution",
    phase: "merge_scope_guard_passed",
    projectId,
    taskId: task.id,
    userId: actorUserId,
    detail: {
      executionId: run.id,
      taskKind: task.taskKind,
      branchName: branchNameForGuard || null,
      envTestGuardStage: guardStage,
      blockedFiles: [],
      allowedRule,
      allowedPathGlobs,
      evaluatedScopeRule: allowedRule,
      prFileCount: filesRes.files.length,
      matchedPathPattern:
        whitelistPatterns.length === 1 ? whitelistPatterns[0] : whitelistPatterns.join(" | "),
    },
  });
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_merge_whitelist_passed",
    projectId,
    taskId: task.id,
    userId: actorUserId,
    detail: {
      executionId: run.id,
      taskKind: task.taskKind,
      branchName: branchNameForGuard || null,
      envTestWhitelistMatched: true,
      allowedRule,
      allowedPathGlobs,
      matchedPathPattern:
        whitelistPatterns.length === 1 ? whitelistPatterns[0] : whitelistPatterns.join(" | "),
      envTestFileWhitelistMatches: guard.envTestFileWhitelistMatches,
    },
  });

  const prLive = guard.pr;
  const mergedEarly =
    prLive.merged === true || String(prLive.state ?? "").toUpperCase() === "MERGED";
  if (mergedEarly) {
    const mergeCommitShaEarly = String(prLive.merge_commit_sha ?? "").trim() || null;
    const mergedAt = new Date();
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_merge_verified",
      projectId,
      taskId: task.id,
      userId: actorUserId,
      detail: {
        prNumber: parsedPr.number,
        mergeCommitSha: mergeCommitShaEarly,
        source: "already_merged_on_github",
        elapsedMsSincePrOpened: prOpenedAt ? Date.now() - prOpenedAt : null,
      },
    });
    await withTaskExecutionRunSchemaHealRetry(() =>
      prisma.taskExecutionRun.update({
        where: { id: run.id },
        data: {
          mergeCommitSha: mergeCommitShaEarly,
          mergedAt,
          pushStatus: "pr_merged",
          prStatus: `merged:${parsedPr.number}:${prUrl}`,
          status: "MERGED",
          envTestMergeBlockedReason: null,
          envTestMergeStartedAt: null,
          evaluationDecision: "done",
          completedAt: mergedAt,
        },
      })
    );
    await prisma.task.update({
      where: { id: task.id },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.MERGED,
        status: "DONE",
        lastEvalResult: "merged",
        lastEvalSummary: envTestMergeVerifiedSummaryForTaskKind(task.taskKind),
      },
    });
    await updateTaskOrchestrationSnapshot(task.id, {
      pushStatus: "pr_merged",
      commitSha: mergeCommitShaEarly,
    });
    await refreshWorkflowStates(projectId);
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_done",
      projectId,
      taskId: task.id,
      userId: actorUserId,
      detail: {
        prNumber: parsedPr.number,
        mergeCommitSha: mergeCommitShaEarly,
        source: "already_merged_on_github",
      },
    });
    return {
      ok: true,
      message: envTestMergeSuccessUserMessageForTaskKind(task.taskKind),
      mergeCommitSha: mergeCommitShaEarly,
      branchDeleted: false,
    };
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_merge_started",
    projectId,
    taskId: task.id,
    userId: actorUserId,
    detail: {
      prNumber: parsedPr.number,
      mergeMethod: "squash",
      elapsedMsSincePrOpened: prOpenedAt ? Date.now() - prOpenedAt : null,
    },
  });

  const mergePut = await putEnvTestSquashMerge({
    repoUrl,
    pullNumber: parsedPr.number,
    token,
  });

  if (!mergePut.ok) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_merge_guard_blocked",
      projectId,
      taskId: task.id,
      userId: actorUserId,
      detail: {
        reason: mergePut.message,
        step: "merge_api",
        httpStatus: mergePut.httpStatus,
        body: mergePut.body?.slice(0, 500),
      },
    });
    await persistMergeBlocked(mergePut.message, mergePut.code);
    return { ok: false, message: mergePut.message, blockedReason: mergePut.code };
  }

  const verified = await verifyEnvTestPullMergedWithRetry({
    repoUrl,
    pullNumber: parsedPr.number,
    token,
    ...(stage2
      ? { maxAttempts: 10, delayMs: 500, envTestMergeVerifyPreset: "default" as const }
      : { envTestMergeVerifyPreset: "stage1_fast" as const }),
  });
  if (!verified.ok || !verified.merged) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_merge_guard_blocked",
      projectId,
      taskId: task.id,
      userId: actorUserId,
      detail: { reason: verified.ok ? "not merged" : verified.message, step: "verify_merge" },
    });
    await persistMergeBlocked(
      verified.ok ? "not merged" : verified.message,
      verified.ok ? "MERGE_NOT_VERIFIED" : verified.code
    );
    return {
      ok: false,
      message: verified.ok ? "머지 API는 성공했으나 GitHub에서 merged 확인에 실패했습니다." : verified.message,
      blockedReason: verified.ok ? "MERGE_VERIFY_FAILED" : verified.code,
    };
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_merge_verified",
    projectId,
    taskId: task.id,
    userId: actorUserId,
    detail: {
      prNumber: parsedPr.number,
      mergeCommitSha: verified.mergeCommitSha ?? null,
      elapsedMsSincePrOpened: prOpenedAt ? Date.now() - prOpenedAt : null,
    },
  });

  const mergedAt = new Date();
  const headBranch = String(guard.pr.head?.ref ?? run.branchName ?? "").trim();

  await withTaskExecutionRunSchemaHealRetry(() =>
    prisma.taskExecutionRun.update({
      where: { id: run.id },
      data: {
        mergeCommitSha: verified.mergeCommitSha,
        mergedAt,
        pushStatus: "pr_merged",
        prStatus: `merged:${parsedPr.number}:${prUrl}`,
        status: "MERGED",
        envTestMergeBlockedReason: null,
        envTestMergeStartedAt: null,
        evaluationDecision: "done",
        completedAt: mergedAt,
      },
    })
  );

  await prisma.task.update({
    where: { id: task.id },
    data: {
      executionWorkflowStatus: EXECUTION_WORKFLOW.MERGED,
      status: "DONE",
      lastEvalResult: "merged",
      lastEvalSummary: envTestMergeVerifiedSummaryForTaskKind(task.taskKind),
    },
  });

  await updateTaskOrchestrationSnapshot(task.id, {
    pushStatus: "pr_merged",
    commitSha: verified.mergeCommitSha ?? null,
  });

  await refreshWorkflowStates(projectId);

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_done",
    projectId,
    taskId: task.id,
    userId: actorUserId,
    detail: {
      prNumber: parsedPr.number,
      mergeCommitSha: verified.mergeCommitSha ?? null,
      headBranch: headBranch || null,
    },
  });

  return {
    ok: true,
    message: envTestMergeSuccessUserMessageForTaskKind(task.taskKind),
    mergeCommitSha: verified.mergeCommitSha ?? null,
    branchDeleted: false,
  };
}
