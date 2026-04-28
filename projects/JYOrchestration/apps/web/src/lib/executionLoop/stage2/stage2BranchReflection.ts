/**
 * Stage2 branch reflection: GitHub compare vs Cursor signals before platform PR.
 *
 * STAGE1 PROTECTION: entry functions assert ENV_TEST_STAGE2; Stage1 uses `runStage1EnvTestSimplePipeline` only.
 */
import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";
import { isEnvTestStage2TaskKind } from "@/lib/execution/envTestTaskKind";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { logStage2CatalogEvent } from "@/lib/service/envTestStage2CatalogEvents";
import { prisma } from "@/lib/prisma";
import { fetchGithubCompareSnapshot } from "@/lib/service/githubCompareService";
import { parseStage2RuntimeMonitorFromValidationOutput } from "@/lib/service/envTestStage2RuntimeMonitor";
import type { LoopStepRecord, RunExecutionLoopResult } from "@/lib/executionLoop/runLoopTypes";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import {
  pickEnvTestHeadBranch,
  requireEnvTestFamilyTaskKindForFinalize,
  runEnvTestPlatformPrPhase,
} from "@/lib/executionLoop/envTestCommonHelpers";
import { finalizeEnvTestPrOpenedFromGithubOnly, type EnvTestGithubFinalizeReturn } from "@/lib/executionLoop/envTestGithubFinalize";
import { runEnvTestAfterGithubPushConfirmed } from "@/lib/executionLoop/stage2/stage2PrFlow";
import {
  failEnvTestStage2WithCode,
  hasStage2CommitEvidence,
  logStage2BranchReflectionCheck,
  logStage2CommitCheck,
  logStage2PrCreationCheck,
} from "@/lib/executionLoop/envTestStage2Helpers";
import { appendStage2ProgressPhase, STAGE2_PROGRESS_PHASE } from "@/lib/executionLoop/stage2/stage2CanonicalProgressPhases";
import {
  ENV_TEST_ROLE_SEPARATION_BRANCH_NOT_REFLECTED,
  ENV_TEST_ROLE_SEPARATION_NO_COMMIT,
  ENV_TEST_ROLE_SEPARATION_NO_PR,
} from "@/lib/service/envTestUserFacingMessages";

export type EnvTestReflectionNotConfirmedBypassResult =
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" };

/**
 * Stage 2 (ENV_TEST_STAGE2) 전용: reflection 미확인 시 GitHub compare·Stage2 게이트로 PR 경로 시도.
 * Stage 1은 `runStage1EnvTestSimplePipeline`(스모크: PR 단일 프로브).
 */
export async function runEnvTestReflectionNotConfirmedGithubBypass(input: {
  projectId: string;
  taskId: string;
  taskKind: string | null;
  actorUserId: string;
  execRunId: string;
  repoUrl: string;
  baseBranch: string;
  githubAccessToken?: string | null;
  cr: CursorRunResult;
  headPending: string;
  execRunCreatedAt: Date;
  steps: LoopStepRecord[];
  singleTaskId?: string;
  effectiveAutoAdvance: boolean;
}): Promise<EnvTestReflectionNotConfirmedBypassResult> {
  requireEnvTestFamilyTaskKindForFinalize(input.taskKind, "runEnvTestReflectionNotConfirmedGithubBypass", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });
  if (!isEnvTestStage2TaskKind(input.taskKind)) {
    throw new Error(
      "[runEnvTestReflectionNotConfirmedGithubBypass] ENV_TEST_STAGE2 only; ENV_TEST uses runStage1EnvTestSimplePipeline"
    );
  }

  const runMonRow = await prisma.taskExecutionRun.findUnique({
    where: { id: input.execRunId },
    select: { validationOutput: true },
  });
  const runtimeMon = parseStage2RuntimeMonitorFromValidationOutput(runMonRow?.validationOutput ?? null);
  const signal = runtimeMon?.cursorSignal ?? null;

  const hintedHeadSha = String(signal?.headShaHint ?? "").trim() || null;
  const hintedBranchName = String(signal?.branchNameHint ?? "").trim() || null;
  const headPending = pickEnvTestHeadBranch({
    cursorBranchName: input.cr.branchName,
    signalBranchNameHint: hintedBranchName,
    fallbackBranchName: input.headPending,
  });

  const { projectId, taskId, actorUserId, execRunId, cr } = input;

  logStage2CommitCheck("stage2_commit_check_started", {
    projectId,
    taskId,
    actorUserId,
    detail: {
      commitHash: cr.commitHash ?? null,
      headShaHint: hintedHeadSha,
      changedFilesCount: cr.changedFiles.length,
    },
  });
  const commitEvidenceOk = hasStage2CommitEvidence({
    commitHash: cr.commitHash,
    headShaHint: hintedHeadSha,
    changedFiles: cr.changedFiles,
  });
  if (!commitEvidenceOk) {
    logStage2CommitCheck("stage2_commit_check_failed", {
      projectId,
      taskId,
      actorUserId,
      detail: { reason: "no_commit_hash_no_head_sha_hint_no_changed_files" },
    });
    await failEnvTestStage2WithCode({
      projectId,
      taskId,
      execRunId,
      code: "NO_COMMIT",
      summaryKo: ENV_TEST_ROLE_SEPARATION_NO_COMMIT,
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: ENV_TEST_ROLE_SEPARATION_NO_COMMIT,
      },
    };
  }
  logStage2CommitCheck("stage2_commit_check_passed", {
    projectId,
    taskId,
    actorUserId,
    detail: { commitEvidence: "commitHash|headShaHint|changedFiles" },
  });

  if (!headPending) {
    logStage2BranchReflectionCheck("stage2_branch_reflection_started", {
      projectId,
      taskId,
      actorUserId,
      detail: { reason: "missing_head_branch" },
    });
    logStage2BranchReflectionCheck("stage2_branch_reflection_failed", {
      projectId,
      taskId,
      actorUserId,
      detail: { reason: "missing_head_branch" },
    });
    await failEnvTestStage2WithCode({
      projectId,
      taskId,
      execRunId,
      code: "BRANCH_NOT_REFLECTED",
      summaryKo: ENV_TEST_ROLE_SEPARATION_BRANCH_NOT_REFLECTED,
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: ENV_TEST_ROLE_SEPARATION_BRANCH_NOT_REFLECTED,
      },
    };
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_branch_reflection_check_started",
    projectId,
    taskId,
    userId: actorUserId,
    detail: { base: input.baseBranch, head: headPending, step: "reflection_bypass" },
  });
  logStage2BranchReflectionCheck("stage2_branch_reflection_started", {
    projectId,
    taskId,
    actorUserId,
    detail: { base: input.baseBranch, head: headPending, step: "reflection_bypass" },
  });
  const branchCompareStartedAt = Date.now();
  const comparePa = await fetchGithubCompareSnapshot({
    repoUrl: input.repoUrl,
    base: input.baseBranch,
    head: headPending,
    maxFiles: 80,
    githubAccessToken: input.githubAccessToken ?? null,
    projectId,
    allowUnauthenticated: true,
  });
  const branchDetectElapsedMs = Date.now() - branchCompareStartedAt;

  if (comparePa.ok && comparePa.data.aheadBy > 0) {
    logStage2BranchReflectionCheck("stage2_branch_reflection_passed", {
      projectId,
      taskId,
      actorUserId,
      detail: { aheadBy: comparePa.data.aheadBy, headSha: comparePa.data.headSha ?? null },
    });
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_branch_reflection_confirmed",
      projectId,
      taskId,
      userId: actorUserId,
      detail: {
        aheadBy: comparePa.data.aheadBy,
        headSha: comparePa.data.headSha ?? null,
        step: "reflection_bypass",
      },
    });
    input.steps.push({
      phase: "git_reflection_gate",
      taskId,
      runId: cr.runId,
      branch: headPending,
      commitHash: cr.commitHash ?? null,
      changedFileCount: cr.changedFiles.length,
      passed: true,
      reason: "github_compare_ahead_by",
    });
    const outPa = await runEnvTestAfterGithubPushConfirmed({
      projectId,
      taskId,
      taskKind: input.taskKind,
      execRunId,
      actorUserId,
      branchName: headPending,
      repoUrl: input.repoUrl,
      baseBranch: input.baseBranch,
      githubAccessToken: input.githubAccessToken ?? null,
      compareData: {
        headSha: comparePa.data.headSha ?? cr.commitHash ?? null,
        changedFiles: comparePa.data.changedFiles,
        diffSummary: comparePa.data.diffSummary,
      },
      steps: input.steps,
      singleTaskId: input.singleTaskId,
      effectiveAutoAdvance: input.effectiveAutoAdvance,
      cursorRunId: cr.runId,
      cursorSummary: cr.summary,
      via: "reflection_bypass",
      pushDetectedSource: "reflection_bypass_compare",
      executionRunCreatedAt: input.execRunCreatedAt,
      branchDetectElapsedMs,
    });
    if (outPa.kind === "return") {
      return { kind: "return", result: outPa.result };
    }
    if (outPa.kind === "continue_loop") {
      return { kind: "continue_loop" };
    }
    if (outPa.kind === "pr_failed") {
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_pr_create_failed",
        projectId,
        taskId,
        userId: actorUserId,
        detail: { message: outPa.message.slice(0, 800), via: "reflection_bypass" },
      });
      await failEnvTestStage2WithCode({
        projectId,
        taskId,
        execRunId,
        code: "PR_NOT_OPENED",
        summaryKo: ENV_TEST_ROLE_SEPARATION_NO_PR,
      });
      return {
        kind: "return",
        result: {
          ok: false,
          steps: input.steps,
          message: ENV_TEST_ROLE_SEPARATION_NO_PR,
        },
      };
    }
  }

  if (!comparePa.ok && comparePa.code === "GITHUB_TOKEN_MISSING_IN_PROJECT_SETTINGS") {
    await failEnvTestStage2WithCode({
      projectId: input.projectId,
      taskId: input.taskId,
      execRunId: input.execRunId,
      code: "BRANCH_NOT_REFLECTED",
      summaryKo: ENV_TEST_ROLE_SEPARATION_BRANCH_NOT_REFLECTED,
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: ENV_TEST_ROLE_SEPARATION_BRANCH_NOT_REFLECTED,
      },
    };
  }

  logStage2BranchReflectionCheck("stage2_branch_reflection_failed", {
    projectId,
    taskId,
    actorUserId,
    detail: {
      compareOk: comparePa.ok,
      compareCode: comparePa.ok ? null : comparePa.code,
      aheadBy: comparePa.ok ? comparePa.data.aheadBy : null,
    },
  });
  await failEnvTestStage2WithCode({
    projectId,
    taskId,
    execRunId,
    code: "BRANCH_NOT_REFLECTED",
    summaryKo: ENV_TEST_ROLE_SEPARATION_BRANCH_NOT_REFLECTED,
  });
  return {
    kind: "return",
    result: {
      ok: false,
      steps: input.steps,
      message: ENV_TEST_ROLE_SEPARATION_BRANCH_NOT_REFLECTED,
    },
  };
}

/**
 * Stage 2 (ENV_TEST_STAGE2) 전용: Cursor reflection 게이트 통과 후 compare → COMMITTED → 플랫폼 PR → finalize → PR_OPENED.
 * Stage 1은 `runStage1EnvTestSimplePipeline` (스모크 파이프라인).
 */
export async function runEnvTestReflectionConfirmedPipeline(input: {
  projectId: string;
  taskId: string;
  taskKind: string | null;
  actorUserId: string;
  execRunId: string;
  repoUrl: string;
  baseBranch: string;
  githubAccessToken?: string | null;
  execRunCreatedAt: Date;
  cr: CursorRunResult;
  steps: LoopStepRecord[];
  singleTaskId?: string;
  effectiveAutoAdvance: boolean;
}): Promise<EnvTestGithubFinalizeReturn> {
  requireEnvTestFamilyTaskKindForFinalize(input.taskKind, "runEnvTestReflectionConfirmedPipeline", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });
  if (!isEnvTestStage2TaskKind(input.taskKind)) {
    throw new Error(
      "[runEnvTestReflectionConfirmedPipeline] ENV_TEST_STAGE2 only; ENV_TEST uses runStage1EnvTestSimplePipeline"
    );
  }

  const cr = input.cr;
  const { projectId, taskId, actorUserId, execRunId } = input;
  const runMonRow = await prisma.taskExecutionRun.findUnique({
    where: { id: execRunId },
    select: { validationOutput: true },
  });
  const runtimeMon = parseStage2RuntimeMonitorFromValidationOutput(runMonRow?.validationOutput ?? null);
  const signalHeadShaHint = String(runtimeMon?.cursorSignal?.headShaHint ?? "").trim() || null;
  const signalBranchNameHint = String(runtimeMon?.cursorSignal?.branchNameHint ?? "").trim() || null;
  const effectiveHeadBranch = pickEnvTestHeadBranch({
    cursorBranchName: cr.branchName,
    signalBranchNameHint,
    fallbackBranchName: null,
  });
  const stage2SignalHeadShaHint = signalHeadShaHint;

  logStage2CommitCheck("stage2_commit_check_started", {
    projectId,
    taskId,
    actorUserId,
    detail: {
      commitHash: cr.commitHash ?? null,
      headShaHint: stage2SignalHeadShaHint,
      changedFilesCount: cr.changedFiles.length,
    },
  });
  const commitEvidenceOk = hasStage2CommitEvidence({
    commitHash: cr.commitHash,
    headShaHint: stage2SignalHeadShaHint,
    changedFiles: cr.changedFiles,
  });
  if (!commitEvidenceOk) {
    logStage2CommitCheck("stage2_commit_check_failed", {
      projectId,
      taskId,
      actorUserId,
      detail: { reason: "no_commit_hash_no_head_sha_hint_no_changed_files" },
    });
    await failEnvTestStage2WithCode({
      projectId,
      taskId,
      execRunId,
      code: "NO_COMMIT",
      summaryKo: ENV_TEST_ROLE_SEPARATION_NO_COMMIT,
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: ENV_TEST_ROLE_SEPARATION_NO_COMMIT,
      },
    };
  }
  logStage2CommitCheck("stage2_commit_check_passed", {
    projectId,
    taskId,
    actorUserId,
    detail: { commitEvidence: "commitHash|headShaHint|changedFiles" },
  });
  // git_reflection_gate 단계 로그는 runExecutionLoop에서 이미 기록됨.

  await prisma.task.update({
    where: { id: taskId },
    data: { executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEWING },
  });

  await prisma.taskExecutionRun.update({
    where: { id: execRunId },
    data: {
      cursorRunId: cr.runId,
      cursorSummary: cr.summary,
      branchName: effectiveHeadBranch || cr.branchName,
      commitSha: cr.commitHash ?? null,
      changedFiles: cr.changedFiles as unknown as object,
      gitSummary: cr.summary.slice(0, 24_000),
      validationOutput: null,
      commitStatus: cr.commitHash ? "reported_by_cursor" : "reported_changed_files",
      pushStatus: "delegated_to_cursor",
    },
  });

  const elapsedMsSinceExecRunStart = Date.now() - input.execRunCreatedAt.getTime();
  let envTestCompareOkAtMs: number | null = null;

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_branch_reflection_check_started",
    projectId,
    taskId,
    userId: actorUserId,
    detail: {
      base: input.baseBranch,
      head: effectiveHeadBranch || cr.branchName,
      elapsedMsSinceRunStart: elapsedMsSinceExecRunStart,
      step: "post_cursor",
      pipeline: "runEnvTestReflectionConfirmedPipeline",
    },
  });
  logStage2BranchReflectionCheck("stage2_branch_reflection_started", {
    projectId,
    taskId,
    actorUserId,
    detail: { base: input.baseBranch, head: effectiveHeadBranch || cr.branchName, step: "post_cursor" },
  });

  const compare = await fetchGithubCompareSnapshot({
    repoUrl: input.repoUrl,
    base: input.baseBranch,
    head: effectiveHeadBranch || cr.branchName,
    maxFiles: 80,
    githubAccessToken: input.githubAccessToken ?? null,
    projectId,
    allowUnauthenticated: true,
  });

  if (compare.ok && compare.data.aheadBy > 0) {
    logStage2CatalogEvent({
      phase: "branch_reflected",
      projectId,
      taskId,
      userId: actorUserId,
      executionId: execRunId,
      detail: { via: "post_cursor_reflection_confirmed" },
    });
    appendStage2ProgressPhase(STAGE2_PROGRESS_PHASE.BRANCH_REFLECTED, {
      projectId,
      taskId,
      actorUserId,
      executionId: execRunId,
      detail: { via: "post_cursor_reflection_confirmed" },
    });
    logStage2BranchReflectionCheck("stage2_branch_reflection_passed", {
      projectId,
      taskId,
      actorUserId,
      detail: { aheadBy: compare.data.aheadBy, headSha: compare.data.headSha ?? null },
    });
    envTestCompareOkAtMs = Date.now();
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_branch_reflection_confirmed",
      projectId,
      taskId,
      userId: actorUserId,
      detail: {
        aheadBy: compare.data.aheadBy,
        headSha: compare.data.headSha ?? null,
        elapsedMsSinceRunStart: elapsedMsSinceExecRunStart,
        step: "post_cursor",
        pipeline: "runEnvTestReflectionConfirmedPipeline",
      },
    });
  }

  const gitEvidence = compare.ok
    ? {
        baseBranch: input.baseBranch,
        headBranch: effectiveHeadBranch || cr.branchName,
        headSha: compare.data.headSha,
        changedFiles: compare.data.changedFiles,
        diffSummary: compare.data.diffSummary,
      }
    : null;

  if (compare.ok) {
    await prisma.taskExecutionRun.update({
      where: { id: execRunId },
      data: {
        commitSha: compare.data.headSha ?? cr.commitHash ?? null,
        changedFiles: compare.data.changedFiles as unknown as object,
        gitSummary: compare.data.diffSummary.slice(0, 24_000),
        commitStatus: compare.data.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
        pushStatus: compare.data.aheadBy > 0 ? "pushed_by_github_compare" : "pushed_by_cursor",
      },
    });
  } else {
    await prisma.taskExecutionRun.update({
      where: { id: execRunId },
      data: {
        commitStatus: "pushed_commit_unknown",
        pushStatus: "unknown",
        evaluationReason: `github_compare_failed:${compare.code}:${compare.message}`.slice(0, 8000),
      },
    });
  }

  const pushDetected = compare.ok && compare.data.aheadBy > 0;
  const commitDetected =
    Boolean(gitEvidence?.headSha ?? cr.commitHash ?? null) || pushDetected;

  if (pushDetected) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.COMMITTED,
        lastEvalResult: "committed",
        lastEvalSummary:
          "ENV_TEST: 푸시 확인됨. 플랫폼이 GitHub PR을 생성·갱신합니다.".slice(0, 2000),
      },
    });

    appendTaskProgressLog({
      kind: "execution",
      phase: "state_transition: RUNNING → COMMITTED",
      projectId,
      taskId,
      userId: actorUserId,
      detail: {
        branch: effectiveHeadBranch || cr.branchName,
        headSha: gitEvidence?.headSha ?? cr.commitHash ?? null,
        changedFileCount: gitEvidence?.changedFiles.length ?? null,
        compareOk: compare.ok,
        ...(compare.ok ? { aheadBy: compare.data.aheadBy, behindBy: compare.data.behindBy } : {}),
        pipeline: "runEnvTestReflectionConfirmedPipeline",
      },
    });
  }

  if (!pushDetected) {
    logStage2BranchReflectionCheck("stage2_branch_reflection_failed", {
      projectId,
      taskId,
      actorUserId,
      detail: {
        compareOk: compare.ok,
        compareCode: compare.ok ? null : compare.code,
        aheadBy: compare.ok ? compare.data.aheadBy : null,
      },
    });
    await failEnvTestStage2WithCode({
      projectId,
      taskId,
      execRunId,
      code: "BRANCH_NOT_REFLECTED",
      summaryKo: ENV_TEST_ROLE_SEPARATION_BRANCH_NOT_REFLECTED,
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: ENV_TEST_ROLE_SEPARATION_BRANCH_NOT_REFLECTED,
      },
    };
  }

  logStage2PrCreationCheck("stage2_pr_creation_started", {
    projectId,
    taskId,
    actorUserId,
    detail: { headBranch: effectiveHeadBranch || cr.branchName },
  });
  const prPhaseMain = await runEnvTestPlatformPrPhase({
    projectId,
    taskId,
    actorUserId,
    taskKind: input.taskKind,
    repoUrl: input.repoUrl,
    baseBranch: input.baseBranch,
    headBranch: effectiveHeadBranch || cr.branchName,
    githubAccessToken: input.githubAccessToken ?? null,
    executionRunCreatedAt: input.execRunCreatedAt,
    compareOkAtMs: envTestCompareOkAtMs,
    execRunId,
  });

  if (!prPhaseMain.ok) {
    logStage2PrCreationCheck("stage2_pr_creation_failed", {
      projectId,
      taskId,
      actorUserId,
      detail: { message: prPhaseMain.message.slice(0, 800) },
    });
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_pr_create_failed",
      projectId,
      taskId,
      userId: actorUserId,
      detail: { message: prPhaseMain.message.slice(0, 800) },
    });
    await failEnvTestStage2WithCode({
      projectId,
      taskId,
      execRunId,
      code: "PR_NOT_OPENED",
      summaryKo: ENV_TEST_ROLE_SEPARATION_NO_PR,
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: ENV_TEST_ROLE_SEPARATION_NO_PR,
      },
    };
  }
  logStage2PrCreationCheck("stage2_pr_creation_passed", {
    projectId,
    taskId,
    actorUserId,
    detail: { prNumber: prPhaseMain.prNumber, prUrl: prPhaseMain.prUrl },
  });

  const prUrl = prPhaseMain.prUrl;
  const prNumber = prPhaseMain.prNumber;

  appendTaskProgressLog({
    kind: "execution",
    phase: "pr_detected",
    projectId,
    taskId,
    userId: actorUserId,
    detail: {
      prUrl,
      prNumber,
      branch: effectiveHeadBranch || cr.branchName,
      pipeline: "runEnvTestReflectionConfirmedPipeline",
      transition: "COMMITTED_TO_PR_OPENED",
    },
  });

  return finalizeEnvTestPrOpenedFromGithubOnly({
    projectId,
    taskId,
    taskKind: input.taskKind,
    execRunId,
    actorUserId,
    branchName: effectiveHeadBranch || cr.branchName,
    prUrl,
    prNumber,
    steps: input.steps,
    singleTaskId: input.singleTaskId,
    effectiveAutoAdvance: input.effectiveAutoAdvance,
    cursorRunId: cr.runId,
    via: "post_cursor_reflection_confirmed",
    runDataPatch: {
      commitSha: gitEvidence?.headSha ?? cr.commitHash ?? null,
      changedFiles: (gitEvidence?.changedFiles ?? cr.changedFiles) as unknown as object,
      gitSummary: (gitEvidence?.diffSummary ?? cr.summary).slice(0, 24_000),
      commitStatus: gitEvidence?.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
    },
    snapshotPatch: {
      commitSha: gitEvidence?.headSha ?? cr.commitHash ?? null,
      changedFileCount: gitEvidence?.changedFiles.length ?? cr.changedFiles.length,
      commitStatus: commitDetected ? "pushed_commit_detected" : "pushed_commit_unknown",
    },
  });
}
