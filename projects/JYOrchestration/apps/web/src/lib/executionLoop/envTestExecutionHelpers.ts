import {
  ENV_TEST_TASK_KIND,
  isEnvTestFamilyTaskKind,
  isEnvTestStage1TaskKind,
  isEnvTestStage2TaskKind,
} from "@/lib/execution/envTestTaskKind";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { logStage2CatalogEvent } from "@/lib/service/envTestStage2CatalogEvents";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { createOrUpdateEnvTestPullRequest } from "@/lib/service/githubEnvTestPullRequestService";
import { fetchGithubBranchHeadExists, fetchGithubCompareSnapshot } from "@/lib/service/githubCompareService";
import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";
import { GITHUB_REST_MISSING_TOKEN_USER_MESSAGE } from "@/lib/integration/githubRestCommon";
import { executeEnvTestPrMergeSmokeTest } from "@/lib/service/environmentTestMergeService";
import {
  buildEnvTestStage2ReviewRequest,
  buildEnvTestStage2SecurityRequest,
  buildEnvTestStage2ScmRequest,
  buildPlatformToExecutorEnvTestStage2Stub,
  mergeEnvTestStage2RunValidationOutput,
  scmResultFromMergeOk,
} from "@/lib/service/envTestStage2PlatformActors";
import { getAiMemberByRole } from "@/lib/service/envTestStage2AiMemberLookup";
import {
  runEnvTestStage2ReviewerWithAiMember,
  runEnvTestStage2SecurityWithAiMember,
  runEnvTestStage2ScmDecisionWithAiMembers,
} from "@/lib/service/envTestStage2AiRoleEvaluation";
import {
  logStage2TelemetryEvent,
  parseEnvTestStage2TimingFromValidationOutput,
  patchTaskExecutionRunStage2Timing,
} from "@/lib/service/envTestStage2Telemetry";
import {
  monitorPlatformPrDone,
  monitorPlatformPrStart,
  monitorReviewDone,
  monitorReviewStart,
  monitorScmDone,
  monitorScmStart,
  monitorSecurityDone,
  monitorSecurityStart,
  patchTaskExecutionRunStage2RuntimeMonitor,
} from "@/lib/service/envTestStage2RuntimeMonitor";
import { parseStage2RuntimeMonitorFromValidationOutput } from "@/lib/service/envTestStage2RuntimeMonitor";
import { ENV_TEST_STAGE2_RUN_META_KEY } from "@/lib/service/envTestStage2Messages";
import { evaluateNextTaskReadiness } from "@/lib/executionLoop/nextTaskReadiness";
import type { LoopStepRecord, RunExecutionLoopResult } from "@/lib/executionLoop/runLoopTypes";
import { refreshWorkflowStates, updateTaskOrchestrationSnapshot } from "@/lib/executionLoop/workflowState";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";

function parsePositiveIntMs(name: string, fallback: number, bounds: { min: number; max: number }): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(bounds.max, Math.max(bounds.min, n));
}

const STAGE2_PR_CREATE_IMMEDIATE_AFTER_REFLECT_MS = parsePositiveIntMs(
  "ENV_TEST_STAGE2_PR_CREATE_IMMEDIATE_AFTER_REFLECT_MS",
  300,
  { min: 0, max: 10_000 }
);

async function failEnvTestStage2WithCode(input: {
  projectId: string;
  taskId: string;
  execRunId: string;
  code: "NO_COMMIT" | "BRANCH_NOT_REFLECTED" | "PR_NOT_OPENED";
  summaryKo: string;
}): Promise<void> {
  const rowVo = await prisma.taskExecutionRun.findUnique({
    where: { id: input.execRunId },
    select: { validationOutput: true },
  });
  const vo = mergeEnvTestStage2RunValidationOutput(rowVo?.validationOutput, {
    stage2RunSummary: {
      finalOutcome: "FAILED",
      mergeVerified: false,
    },
  });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: {
      status: "failed",
      evaluationDecision: "failed",
      evaluationReason: input.code,
      validationOutput: vo,
    },
  });
  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      status: "FAILED",
      executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
      lastEvalResult: input.code,
      lastEvalSummary: input.summaryKo,
    },
  });
  await refreshWorkflowStates(input.projectId);
}

function hasStage2CommitEvidence(input: {
  commitHash?: string | null | undefined;
  headShaHint?: string | null | undefined;
  changedFiles?: string[] | null | undefined;
}): boolean {
  const commitOk = Boolean(String(input.commitHash ?? "").trim());
  const headHintOk = Boolean(String(input.headShaHint ?? "").trim());
  const filesOk = Array.isArray(input.changedFiles) && input.changedFiles.length > 0;
  return commitOk || headHintOk || filesOk;
}

function logStage2CommitCheck(
  phase: "stage2_commit_check_started" | "stage2_commit_check_passed" | "stage2_commit_check_failed",
  ctx: { projectId: string; taskId: string; actorUserId: string; detail?: Record<string, unknown> }
): void {
  appendTaskProgressLog({
    kind: "execution",
    phase,
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: ctx.detail ?? {},
  });
}

function logStage2BranchReflectionCheck(
  phase:
    | "stage2_branch_reflection_started"
    | "stage2_branch_reflection_passed"
    | "stage2_branch_reflection_failed",
  ctx: { projectId: string; taskId: string; actorUserId: string; detail?: Record<string, unknown> }
): void {
  appendTaskProgressLog({
    kind: "execution",
    phase,
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: ctx.detail ?? {},
  });
}

function logStage2PrCreationCheck(
  phase: "stage2_pr_creation_started" | "stage2_pr_creation_passed" | "stage2_pr_creation_failed",
  ctx: { projectId: string; taskId: string; actorUserId: string; detail?: Record<string, unknown> }
): void {
  appendTaskProgressLog({
    kind: "execution",
    phase,
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: ctx.detail ?? {},
  });
}

function pickEnvTestHeadBranch(input: {
  cursorBranchName?: string | null;
  signalBranchNameHint?: string | null;
  fallbackBranchName?: string | null;
}): string {
  // Branch source of truth priority:
  // 1) Cursor 결과(branchName) 2) runtime signal hint 3) loop fallback(계획 브랜치)
  return (
    String(input.cursorBranchName ?? "").trim() ||
    String(input.signalBranchNameHint ?? "").trim() ||
    String(input.fallbackBranchName ?? "").trim()
  );
}

/** Stage1 전용: GitHub HEAD 조회 시도 순서(중복 제거). */
function uniqueNonEmptyBranchCandidates(...parts: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const s = String(p ?? "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function logEnvTestBranchSourceOfTruth(ctx: {
  projectId: string;
  taskId: string;
  actorUserId: string;
  plannedBranchName: string;
  promptBranchName: string;
  trackedBranchName: string | null;
  cursorReportedBranch: string | null | undefined;
  signalBranchNameHint: string | null;
  effectiveGithubHead: string;
}): void {
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_branch_name_alignment",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: {
      plannedBranchName: ctx.plannedBranchName || null,
      promptBranchName: ctx.promptBranchName || null,
      trackedBranchName: ctx.trackedBranchName,
      cursorReportedBranch: ctx.cursorReportedBranch ?? null,
      signalBranchNameHint: ctx.signalBranchNameHint,
      effectiveGithubHead: ctx.effectiveGithubHead,
      prHeadBranchResolved: ctx.effectiveGithubHead,
      prHeadBranchName: ctx.effectiveGithubHead,
    },
  });
}

/**
 * ENV_TEST 전용 헬퍼 진입 방어. 위반 시 로그 후 throw(부분 DB 갱신 없음).
 * Shared compare/PR 서비스는 그대로 두고, 이 모듈의 오케스트레이션만 게이트한다.
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
  /** Stage 2: 런타임 모니터(platform_pr_create) */
  execRunId?: string | null;
}): Promise<
  | { ok: true; prUrl: string; prNumber: number; reusedExisting: boolean; prElapsedMs: number }
  | { ok: false; message: string }
> {
  // ENV_TEST(Stage1/2) PR 책임: 항상 플랫폼(createOrUpdateEnvTestPullRequest).
  // Cursor는 PR 생성/merge를 수행하지 않는다.
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
    projectId: input.projectId,
    envTestStage: isEnvTestStage2TaskKind(input.taskKind) ? "stage2" : "stage1",
  });
  if (!prRes.ok) {
    return { ok: false, message: prRes.message };
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
    prElapsedMs,
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
  /** Stage 2: GitHub compare(브랜치 반영) 구간 ms — runExecutionLoop 등에서 전달 */
  branchDetectElapsedMs?: number | null;
}): Promise<
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" }
  | { kind: "pr_failed"; message: string }
> {
  requireEnvTestFamilyTaskKindForFinalize(input.taskKind, "runEnvTestAfterGithubPushConfirmed", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });
  const elapsedMsSinceRunStart = elapsedSinceRun(input.executionRunCreatedAt ?? undefined);

  const existingRunVo = await prisma.taskExecutionRun.findUnique({
    where: { id: input.execRunId },
    select: { validationOutput: true },
  });
  const preserveValidationOutput = isEnvTestStage2TaskKind(input.taskKind) ? existingRunVo?.validationOutput : null;

  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: {
      ...(input.cursorRunId ? { cursorRunId: input.cursorRunId } : {}),
      ...(input.cursorSummary != null ? { cursorSummary: input.cursorSummary.slice(0, 24_000) } : {}),
      branchName: input.branchName,
      commitSha: input.compareData.headSha ?? null,
      changedFiles: input.compareData.changedFiles as unknown as object,
      gitSummary: input.compareData.diffSummary.slice(0, 24_000),
      validationOutput: preserveValidationOutput ?? null,
      commitStatus: input.compareData.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
      pushStatus: "pushed_by_github_compare",
      status: "running",
      evaluationReason: null,
    },
  });

  if (isEnvTestStage2TaskKind(input.taskKind)) {
    logStage2CatalogEvent({
      phase: "branch_reflected",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { via: input.via },
    });
  }

  const committedSummary =
    input.via === "cursor_error_recovery"
      ? "ENV_TEST: GitHub compare로 푸시 확인 후 플랫폼 PR 처리."
      : input.via === "reflection_bypass"
        ? "ENV_TEST: Cursor 메타 미확인, GitHub compare로 푸시 확인 후 플랫폼 PR."
        : input.via === "cursor_poll_early_github"
          ? "ENV_TEST: Cursor 폴링 중 GitHub compare로 푸시 확인 후 플랫폼 PR 처리."
          : input.via === "cursor_poll_stage1_branch_head"
            ? "ENV_TEST(Stage1): Cursor 폴링 중 원격 브랜치 HEAD 확인 후 플랫폼 PR 처리."
            : input.via === "cursor_poll_stage2_branch_head"
              ? "ENV_TEST Stage 2: GitHub 브랜치 HEAD 확인 후 플랫폼 PR 처리(Cursor 터미널 대기 없음)."
              : input.via === "stage1_post_cursor_compare"
                ? "ENV_TEST(Stage1): GitHub compare로 원격 변경(ahead_by) 확인. 플랫폼이 PR을 생성·갱신합니다."
                : input.via === "stage1_post_cursor_branch_exists"
                  ? "ENV_TEST(Stage1): 원격 브랜치 존재 확인. 플랫폼이 PR을 생성·갱신합니다."
                  : "ENV_TEST: GitHub에서 브랜치가 베이스보다 앞서 있음(ahead_by). 플랫폼이 PR을 처리합니다.";

  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      executionWorkflowStatus: EXECUTION_WORKFLOW.COMMITTED,
      lastEvalResult: "committed",
      lastEvalSummary: committedSummary.slice(0, 2000),
    },
  });

  if (isEnvTestStage2TaskKind(input.taskKind) && STAGE2_PR_CREATE_IMMEDIATE_AFTER_REFLECT_MS > 0) {
    await new Promise((r) => setTimeout(r, STAGE2_PR_CREATE_IMMEDIATE_AFTER_REFLECT_MS));
  }

  if (isEnvTestStage2TaskKind(input.taskKind)) {
    logStage2PrCreationCheck("stage2_pr_creation_started", {
      projectId: input.projectId,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      detail: { headBranch: input.branchName },
    });
  }
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
    execRunId: input.execRunId,
  });
  if (!prPhase.ok) {
    if (isEnvTestStage2TaskKind(input.taskKind)) {
      logStage2PrCreationCheck("stage2_pr_creation_failed", {
        projectId: input.projectId,
        taskId: input.taskId,
        actorUserId: input.actorUserId,
        detail: { message: prPhase.message.slice(0, 800) },
      });
    }
    return { kind: "pr_failed", message: prPhase.message };
  }
  if (isEnvTestStage2TaskKind(input.taskKind)) {
    logStage2PrCreationCheck("stage2_pr_creation_passed", {
      projectId: input.projectId,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      detail: { prNumber: prPhase.prNumber, prUrl: prPhase.prUrl },
    });
  }

  if (isEnvTestStage2TaskKind(input.taskKind)) {
    await patchTaskExecutionRunStage2Timing(input.execRunId, {
      executionId: input.execRunId,
      branchDetectTimeMs: input.branchDetectElapsedMs ?? undefined,
      prCreationTimeMs: prPhase.prElapsedMs,
    });
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage2_pr_phase_timings",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: {
        executionId: input.execRunId,
        branchDetectElapsedMs: input.branchDetectElapsedMs ?? null,
        prCreationElapsedMs: prPhase.prElapsedMs,
      },
    });
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

/**
 * Stage 1 (ENV_TEST) 전용: 원격 브랜치 HEAD 존재만 확인하면 즉시 플랫폼 PR → PR_OPENED → merge/readiness.
 * - compare / ahead_by / Stage2식 커밋 증거는 요구하지 않음.
 * - 후보 순서: TaskExecutionRun.branchName(추적) → 계획 브랜치 → Cursor·signal; 첫 성공 ref로 PR head.
 * - Cursor: commit/push만. PR·Stage1 merge는 플랫폼.
 */
export async function runStage1EnvTestBranchToPrPipeline(input: {
  projectId: string;
  taskId: string;
  taskKind: string | null;
  actorUserId: string;
  execRunId: string;
  repoUrl: string;
  baseBranch: string;
  githubAccessToken?: string | null;
  execRunCreatedAt: Date;
  plannedBranchName: string;
  promptBranchName: string;
  cr: CursorRunResult;
  steps: LoopStepRecord[];
  singleTaskId?: string;
  effectiveAutoAdvance: boolean;
}): Promise<
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" }
> {
  requireEnvTestFamilyTaskKindForFinalize(input.taskKind, "runStage1EnvTestBranchToPrPipeline", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });
  if (!isEnvTestStage1TaskKind(input.taskKind)) {
    throw new Error(
      "[runStage1EnvTestBranchToPrPipeline] taskKind must be ENV_TEST (Stage 1); Stage 2 uses reflection/bypass pipelines."
    );
  }

  const { projectId, taskId, actorUserId, execRunId, cr } = input;
  const runMonRow = await prisma.taskExecutionRun.findUnique({
    where: { id: execRunId },
    select: { validationOutput: true, branchName: true },
  });
  const runtimeMon = parseStage2RuntimeMonitorFromValidationOutput(runMonRow?.validationOutput ?? null);
  const signalBranchNameHint = String(runtimeMon?.cursorSignal?.branchNameHint ?? "").trim() || null;
  const trackedBranchName = String(runMonRow?.branchName ?? "").trim();

  const planned = String(input.plannedBranchName ?? "").trim();
  const promptBr = String(input.promptBranchName ?? "").trim();
  const cursorPick = pickEnvTestHeadBranch({
    cursorBranchName: cr.branchName,
    signalBranchNameHint,
    fallbackBranchName: null,
  });
  const candidates = uniqueNonEmptyBranchCandidates(trackedBranchName, planned, cursorPick);
  const primaryHead = candidates[0] ?? "";

  if (!primaryHead) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage1_branch_unknown",
      projectId,
      taskId,
      userId: actorUserId,
      detail: {
        plannedBranchName: planned || null,
        trackedBranchName: trackedBranchName || null,
        cursorReportedBranch: cr.branchName ?? null,
      },
    });
    await prisma.taskExecutionRun.update({
      where: { id: execRunId },
      data: {
        status: "failed",
        evaluationDecision: "failed",
        evaluationReason: "env_test_stage1_branch_unknown",
      },
    });
    await prisma.task.update({
      where: { id: taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
        lastEvalResult: "failed",
        lastEvalSummary: "ENV_TEST(Stage1): 플랫폼이 부여한 브랜치 이름을 확인할 수 없습니다.",
      },
    });
    await refreshWorkflowStates(projectId);
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: "ENV_TEST(Stage1): 브랜치 이름을 확인할 수 없습니다.",
      },
    };
  }

  logEnvTestBranchSourceOfTruth({
    projectId,
    taskId,
    actorUserId,
    plannedBranchName: planned,
    promptBranchName: promptBr,
    trackedBranchName: trackedBranchName || null,
    cursorReportedBranch: cr.branchName,
    signalBranchNameHint,
    effectiveGithubHead: primaryHead,
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage1_branch_probe_candidates",
    projectId,
    taskId,
    userId: actorUserId,
    detail: { candidateBranches: candidates, primaryHead },
  });

  if (planned && trackedBranchName && planned !== trackedBranchName) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_branch_name_mismatch_warning",
      projectId,
      taskId,
      userId: actorUserId,
      detail: {
        plannedBranchName: planned,
        trackedBranchName,
        note: "TaskExecutionRun.branchName differs from planned branch at pipeline entry",
      },
    });
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage1_github_probe_started",
    projectId,
    taskId,
    userId: actorUserId,
    detail: { base: input.baseBranch, primaryHead, candidateBranches: candidates },
  });

  await prisma.task.update({
    where: { id: taskId },
    data: { executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEWING },
  });

  await prisma.taskExecutionRun.update({
    where: { id: execRunId },
    data: {
      cursorRunId: cr.runId,
      cursorSummary: cr.summary,
      branchName: primaryHead,
      commitSha: cr.commitHash ?? null,
      changedFiles: cr.changedFiles as unknown as object,
      gitSummary: cr.summary.slice(0, 24_000),
      validationOutput: null,
      commitStatus: cr.commitHash ? "reported_by_cursor" : "reported_changed_files",
      pushStatus: "delegated_to_cursor",
    },
  });

  input.steps.push({
    phase: "git_reflection_gate",
    taskId,
    runId: cr.runId,
    branch: primaryHead,
    commitHash: cr.commitHash ?? null,
    changedFileCount: cr.changedFiles.length,
    passed: true,
    reason: "stage1_remote_branch_head_probe",
  });

  const handleStage1PushOutcome = async (
    out: Awaited<ReturnType<typeof runEnvTestAfterGithubPushConfirmed>>
  ): Promise<
    | { kind: "return"; result: RunExecutionLoopResult }
    | { kind: "continue_loop" }
  > => {
    if (out.kind === "pr_failed") {
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_stage1_pr_create_failed",
        projectId,
        taskId,
        userId: actorUserId,
        detail: { message: out.message.slice(0, 800) },
      });
      await prisma.taskExecutionRun.update({
        where: { id: execRunId },
        data: {
          status: "failed",
          evaluationDecision: "failed",
          evaluationReason: `env_test_stage1_platform_pr_failed:${out.message}`.slice(0, 8000),
        },
      });
      await prisma.task.update({
        where: { id: taskId },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
          lastEvalResult: "failed",
          lastEvalSummary: `ENV_TEST(Stage1): 플랫폼 PR 실패 — ${out.message}`.slice(0, 1500),
        },
      });
      await refreshWorkflowStates(projectId);
      return {
        kind: "return",
        result: {
          ok: false,
          steps: input.steps,
          message: "ENV_TEST(Stage1): 플랫폼이 GitHub PR을 생성·갱신하지 못했습니다.",
        },
      };
    }
    if (out.kind === "return") return { kind: "return", result: out.result };
    return { kind: "continue_loop" };
  };

  const branchProbeStartedAt = Date.now();
  let resolvedHead: string | null = null;
  let resolvedHeadSha: string | null = null;
  for (const name of candidates) {
    const ex = await fetchGithubBranchHeadExists({
      repoUrl: input.repoUrl,
      branch: name,
      githubAccessToken: input.githubAccessToken ?? null,
      projectId,
      allowUnauthenticated: true,
    });
    if (ex.ok) {
      resolvedHead = name;
      resolvedHeadSha = ex.headSha ?? null;
      break;
    }
  }
  const branchDetectElapsedMs = Date.now() - branchProbeStartedAt;

  if (resolvedHead) {
    if (resolvedHead !== primaryHead) {
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_stage1_branch_resolved_via_alternate_candidate",
        projectId,
        taskId,
        userId: actorUserId,
        detail: { primaryHead, resolvedHead, candidateBranches: candidates },
      });
    }
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage1_remote_branch_exists",
      projectId,
      taskId,
      userId: actorUserId,
      detail: {
        headBranch: resolvedHead,
        headSha: resolvedHeadSha,
        candidateBranchesProbed: candidates,
        branchDetectElapsedMs,
        detectedRemoteBranchName: resolvedHead,
        prHeadBranchName: resolvedHead,
      },
    });
    await prisma.taskExecutionRun.update({
      where: { id: execRunId },
      data: {
        commitSha: resolvedHeadSha ?? cr.commitHash ?? null,
        commitStatus: resolvedHeadSha ? "pushed_commit_detected" : "pushed_commit_unknown",
        pushStatus: "pushed_by_cursor",
        branchName: resolvedHead,
      },
    });
    const outExists = await runEnvTestAfterGithubPushConfirmed({
      projectId,
      taskId,
      taskKind: ENV_TEST_TASK_KIND,
      execRunId,
      actorUserId,
      branchName: resolvedHead,
      repoUrl: input.repoUrl,
      baseBranch: input.baseBranch,
      githubAccessToken: input.githubAccessToken ?? null,
      compareData: {
        headSha: resolvedHeadSha ?? cr.commitHash ?? null,
        changedFiles: cr.changedFiles,
        diffSummary: cr.summary.slice(0, 24_000),
      },
      steps: input.steps,
      singleTaskId: input.singleTaskId,
      effectiveAutoAdvance: input.effectiveAutoAdvance,
      cursorRunId: cr.runId,
      cursorSummary: cr.summary,
      via: "stage1_post_cursor_branch_exists",
      pushDetectedSource: "stage1_remote_branch_head_exists",
      executionRunCreatedAt: input.execRunCreatedAt,
      branchDetectElapsedMs,
    });
    return handleStage1PushOutcome(outExists);
  }

  const compareProbe = await fetchGithubCompareSnapshot({
    repoUrl: input.repoUrl,
    base: input.baseBranch,
    head: primaryHead,
    maxFiles: 80,
    githubAccessToken: input.githubAccessToken ?? null,
    projectId,
    allowUnauthenticated: true,
  });

  if (!compareProbe.ok && compareProbe.code === "GITHUB_TOKEN_MISSING_IN_PROJECT_SETTINGS") {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage1_github_compare_missing_token",
      projectId,
      taskId,
      userId: actorUserId,
      detail: { head: primaryHead, baseBranch: input.baseBranch, candidateBranches: candidates },
    });
    appendTaskProgressLog({
      kind: "execution",
      phase: "git_reflection_gate_blocked_no_token",
      projectId,
      taskId,
      userId: actorUserId,
      detail: {
        branchName: primaryHead,
        baseBranch: input.baseBranch,
        gateReason: "github_compare_unavailable_no_token",
        pipeline: "runStage1EnvTestBranchToPrPipeline",
      },
    });
    const gateReason = "github_compare_unavailable_no_token";
    await prisma.task.update({
      where: { id: taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.PENDING_APPLY,
        lastEvalResult: "pending_apply",
        lastEvalSummary: GITHUB_REST_MISSING_TOKEN_USER_MESSAGE,
      },
    });
    await prisma.taskExecutionRun.update({
      where: { id: execRunId },
      data: {
        cursorRunId: cr.runId,
        cursorSummary: cr.summary,
        branchName: primaryHead,
        commitSha: cr.commitHash ?? null,
        changedFiles: cr.changedFiles as unknown as object,
        gitSummary: cr.summary.slice(0, 24_000),
        validationOutput: null,
        commitStatus: "github_compare_missing_token",
        pushStatus: "delegated_to_cursor",
        status: "awaiting_git_reflection",
        evaluationReason: "git_reflection_gate_blocked: github_compare_unavailable_no_token",
      },
    });
    await updateTaskOrchestrationSnapshot(taskId, {
      branch: primaryHead,
      commitStatus: "github_compare_missing_token",
      pushStatus: "delegated_to_cursor",
      commitSha: cr.commitHash ?? null,
      changedFileCount: cr.changedFiles.length,
    });
    await refreshWorkflowStates(projectId);
    input.steps.push({
      phase: "git_reflection_gate",
      taskId,
      runId: cr.runId,
      branch: primaryHead,
      commitHash: cr.commitHash ?? null,
      changedFileCount: cr.changedFiles.length,
      passed: false,
      reason: gateReason,
    });
    return {
      kind: "return",
      result: {
        ok: true,
        steps: input.steps,
        message: GITHUB_REST_MISSING_TOKEN_USER_MESSAGE,
      },
    };
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage1_remote_branch_not_visible",
    projectId,
    taskId,
    userId: actorUserId,
    detail: {
      candidateBranchesTried: candidates,
      primaryHead,
      compareOk: compareProbe.ok,
      compareCode: compareProbe.ok ? null : compareProbe.code,
      aheadBy: compareProbe.ok ? compareProbe.data.aheadBy : null,
      branchDetectElapsedMs,
    },
  });
  await prisma.taskExecutionRun.update({
    where: { id: execRunId },
    data: {
      status: "failed",
      evaluationDecision: "failed",
      evaluationReason: compareProbe.ok
        ? "env_test_stage1_remote_branch_not_visible"
        : `env_test_stage1_remote_branch_not_visible:${compareProbe.code}:${compareProbe.message}`.slice(0, 8000),
      commitStatus: "pushed_commit_unknown",
      pushStatus: "unknown",
    },
  });
  await prisma.task.update({
    where: { id: taskId },
    data: {
      executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
      lastEvalResult: "failed",
      lastEvalSummary:
        "ENV_TEST(Stage1): GitHub에서 계획 브랜치를 확인하지 못했습니다. Cursor 푸시·저장소 URL·베이스 브랜치·토큰을 확인하세요.".slice(
          0,
          2000
        ),
    },
  });
  await refreshWorkflowStates(projectId);
  return {
    kind: "return",
    result: {
      ok: false,
      steps: input.steps,
      message:
        "ENV_TEST(Stage1): 원격 브랜치가 GitHub에서 보이지 않습니다. 푸시·브랜치 이름·토큰을 확인하세요.",
    },
  };
}

export type EnvTestReflectionNotConfirmedBypassResult =
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" };

/**
 * Stage 2 (ENV_TEST_STAGE2) 전용: reflection 미확인 시 GitHub compare·Stage2 게이트로 PR 경로 시도.
 * Stage 1은 `runStage1EnvTestBranchToPrPipeline`(플랫폼 브랜치 우선, reflection 비의존).
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
      "[runEnvTestReflectionNotConfirmedGithubBypass] Stage 2 (ENV_TEST_STAGE2) only; Stage 1 uses runStage1EnvTestBranchToPrPipeline"
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
      summaryKo: "Stage 2 실패: commit 미발생",
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: "Stage 2 실패: commit 미발생",
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
      summaryKo: "Stage 2 실패: Git branch 미반영",
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: "Stage 2 실패: Git branch 미반영",
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
        summaryKo: "Stage 2 실패: PR 미생성",
      });
      return {
        kind: "return",
        result: {
          ok: false,
          steps: input.steps,
          message: "Stage 2 실패: PR 미생성",
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
      summaryKo: "Stage 2 실패: Git branch 미반영",
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: "Stage 2 실패: Git branch 미반영",
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
    summaryKo: "Stage 2 실패: Git branch 미반영",
  });
  return {
    kind: "return",
    result: {
      ok: false,
      steps: input.steps,
      message: "Stage 2 실패: Git branch 미반영",
    },
  };
}

/**
 * Stage 2 (ENV_TEST_STAGE2) 전용: Cursor reflection 게이트 통과 후 compare → COMMITTED → 플랫폼 PR → finalize → PR_OPENED.
 * Stage 1은 `runStage1EnvTestBranchToPrPipeline` (플랫폼 브랜치 우선·reflection 비의존).
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
      "[runEnvTestReflectionConfirmedPipeline] Stage 2 (ENV_TEST_STAGE2) only; Stage 1 uses runStage1EnvTestBranchToPrPipeline"
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
      summaryKo: "Stage 2 실패: commit 미발생",
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: "Stage 2 실패: commit 미발생",
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
      summaryKo: "Stage 2 실패: Git branch 미반영",
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: "Stage 2 실패: Git branch 미반영",
      },
    };
  }

  if (isEnvTestStage2TaskKind(input.taskKind) && STAGE2_PR_CREATE_IMMEDIATE_AFTER_REFLECT_MS > 0) {
    await new Promise((r) => setTimeout(r, STAGE2_PR_CREATE_IMMEDIATE_AFTER_REFLECT_MS));
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
      summaryKo: "Stage 2 실패: PR 미생성",
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: "Stage 2 실패: PR 미생성",
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

/**
 * PR_OPENED·run 메타가 이미 반영된 뒤 호출: Stage2 리뷰 → (PASS 시) SCM 머지.
 * runExecutionLoop 의 비-compare PR 경로와 finalizeEnvTestPrOpenedFromGithubOnly 가 공유한다.
 */
export async function runEnvTestStage2ReviewScmAfterPrOpened(input: {
  projectId: string;
  taskId: string;
  execRunId: string;
  actorUserId: string;
  prNumber: number;
}): Promise<Awaited<ReturnType<typeof executeEnvTestPrMergeSmokeTest>>> {
  const runRow = await prisma.taskExecutionRun.findUnique({
    where: { id: input.execRunId },
    select: { changedFiles: true, gitSummary: true, validationOutput: true, branchName: true },
  });
  const rawCf = runRow?.changedFiles;
  const changedFiles = Array.isArray(rawCf) ? rawCf.map((x) => String(x)) : [];
  const diffSummary = String(runRow?.gitSummary ?? "").trim() || "(no summary)";

  const taskRow = await prisma.task.findUnique({
    where: { id: input.taskId },
    select: { name: true, description: true, lastOrchestrationBranch: true },
  });

  const proj = await withExecutionSetupSchemaHealRetry(() =>
    prisma.project.findUnique({
      where: { id: input.projectId },
      select: {
        executionSetup: {
          select: { gitRepoUrl: true, baseBranch: true },
        },
      },
    })
  );
  const repoUrl = String(proj?.executionSetup?.gitRepoUrl ?? "").trim();
  const baseBranch = String(proj?.executionSetup?.baseBranch ?? "").trim();
  const headBranch = String(runRow?.branchName ?? taskRow?.lastOrchestrationBranch ?? "").trim();

  const { platformToExecutor } = buildPlatformToExecutorEnvTestStage2Stub();
  const executorMember = await getAiMemberByRole({ projectId: input.projectId, role: "executor" });
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_platform_to_executor",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: platformToExecutor, executorMember },
  });

  await prisma.task.update({
    where: { id: input.taskId },
    data: { executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_PENDING },
  });
  await refreshWorkflowStates(input.projectId);

  const reviewRequest = buildEnvTestStage2ReviewRequest({
    requestedIntent: "ENV_TEST Stage2 smoke",
    changedFiles,
    diffSummary,
  });
  let vOut = mergeEnvTestStage2RunValidationOutput(runRow?.validationOutput, { reviewRequest });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: vOut },
  });

  const reviewerMember = await getAiMemberByRole({ projectId: input.projectId, role: "reviewer" });
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_platform_to_reviewer",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: reviewRequest, reviewerMember },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_review_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { executionId: input.execRunId },
  });
  logStage2CatalogEvent({
    phase: "review_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorReviewStart(m, Date.now()));

  const reviewStarted = Date.now();
  const reviewStartIso = new Date(reviewStarted).toISOString();
  const reviewResult = await runEnvTestStage2ReviewerWithAiMember({
    projectId: input.projectId,
    request: reviewRequest,
  });
  const reviewEnded = Date.now();
  const reviewMs = reviewEnded - reviewStarted;
  await patchTaskExecutionRunStage2Timing(input.execRunId, { reviewTimeMs: reviewMs });
  logStage2TelemetryEvent({
    executionId: input.execRunId,
    stage: "REVIEWER",
    event: "REVIEW_COMPLETED",
    startTime: reviewStartIso,
    endTime: new Date(reviewEnded).toISOString(),
    elapsedMs: reviewMs,
    result: reviewResult.result,
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
  });
  logStage2CatalogEvent({
    phase: "review_finished",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
    elapsedMs: reviewMs,
    detail: { result: reviewResult.result },
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorReviewDone(m, Date.now()));
  vOut = mergeEnvTestStage2RunValidationOutput(vOut, { reviewResult });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: vOut },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_reviewer_to_platform",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: reviewResult },
  });

  const reviewPhase =
    reviewResult.result === "PASS"
      ? "env_test_stage2_review_passed"
      : reviewResult.result === "FAIL"
        ? "env_test_stage2_review_failed"
        : reviewResult.result === "MISSING"
          ? "env_test_stage2_review_missing"
          : "env_test_stage2_review_disabled";
  appendTaskProgressLog({
    kind: "execution",
    phase: reviewPhase,
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { result: reviewResult.result, reason: reviewResult.reason.slice(0, 500) },
  });
  logStage2CatalogEvent({
    phase:
      reviewResult.result === "PASS"
        ? "review_passed"
        : reviewResult.result === "FAIL"
          ? "review_failed"
          : reviewResult.result === "MISSING"
            ? "review_missing"
            : "review_disabled",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
    detail: { result: reviewResult.result, reason: reviewResult.reason.slice(0, 500) },
  });

  if (reviewResult.result === "FAIL") {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_REJECTED,
        status: "FAILED",
        lastEvalResult: "review_failed",
        lastEvalSummary: reviewResult.reason.slice(0, 1500),
      },
    });
    await refreshWorkflowStates(input.projectId);
    vOut = mergeEnvTestStage2RunValidationOutput(vOut, {
      stage2RunSummary: { finalOutcome: "FAILED", reviewOutcome: reviewResult.result },
    });
    await prisma.taskExecutionRun.update({
      where: { id: input.execRunId },
      data: { validationOutput: vOut },
    });
    logStage2CatalogEvent({
      phase: "stage2_failed",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { step: "review", result: "FAIL" },
    });
    return {
      ok: false,
      message: `Stage 2: 리뷰 실패 — ${reviewResult.reason}`,
      blockedReason: "REVIEW_FAILED",
    };
  }

  if (reviewResult.result === "PASS") {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_APPROVED,
        lastEvalResult: "review_passed",
        lastEvalSummary: reviewResult.reason.slice(0, 1500),
      },
    });
    await refreshWorkflowStates(input.projectId);
  } else {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.SECURITY_PENDING,
        lastEvalResult: reviewResult.result === "MISSING" ? "review_missing" : "review_disabled",
        lastEvalSummary: reviewResult.reason.slice(0, 1500),
      },
    });
    await refreshWorkflowStates(input.projectId);
  }

  await prisma.task.update({
    where: { id: input.taskId },
    data: { executionWorkflowStatus: EXECUTION_WORKFLOW.SECURITY_PENDING },
  });
  await refreshWorkflowStates(input.projectId);

  const securityRequest = buildEnvTestStage2SecurityRequest({ changedFiles, diffSummary });
  vOut = mergeEnvTestStage2RunValidationOutput(vOut, { securityRequest });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: vOut },
  });

  const securityMember = await getAiMemberByRole({ projectId: input.projectId, role: "security" });
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_platform_to_security",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: securityRequest, securityMember },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_security_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { executionId: input.execRunId },
  });
  logStage2CatalogEvent({
    phase: "security_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorSecurityStart(m, Date.now()));

  const secStarted = Date.now();
  const secStartIso = new Date(secStarted).toISOString();
  const securityResult = await runEnvTestStage2SecurityWithAiMember({
    projectId: input.projectId,
    request: securityRequest,
  });
  const secEnded = Date.now();
  const secMs = secEnded - secStarted;
  await patchTaskExecutionRunStage2Timing(input.execRunId, { securityTimeMs: secMs });
  logStage2TelemetryEvent({
    executionId: input.execRunId,
    stage: "SECURITY",
    event: "SECURITY_COMPLETED",
    startTime: secStartIso,
    endTime: new Date(secEnded).toISOString(),
    elapsedMs: secMs,
    result: securityResult.result,
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
  });
  logStage2CatalogEvent({
    phase: "security_finished",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
    elapsedMs: secMs,
    detail: { result: securityResult.result },
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorSecurityDone(m, Date.now()));
  vOut = mergeEnvTestStage2RunValidationOutput(vOut, { securityResult });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: vOut },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_security_to_platform",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: securityResult },
  });

  const secPhase =
    securityResult.result === "PASS"
      ? "env_test_stage2_security_passed"
      : securityResult.result === "FAIL"
        ? "env_test_stage2_security_failed"
        : securityResult.result === "MISSING"
          ? "env_test_stage2_security_missing"
          : "env_test_stage2_security_disabled";
  appendTaskProgressLog({
    kind: "execution",
    phase: secPhase,
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { result: securityResult.result, reason: securityResult.reason.slice(0, 500) },
  });
  logStage2CatalogEvent({
    phase:
      securityResult.result === "PASS"
        ? "security_passed"
        : securityResult.result === "FAIL"
          ? "security_failed"
          : securityResult.result === "MISSING"
            ? "security_missing"
            : "security_disabled",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
    detail: { result: securityResult.result, reason: securityResult.reason.slice(0, 500) },
  });

  if (securityResult.result === "FAIL") {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.SECURITY_FAILED,
        status: "FAILED",
        lastEvalResult: "security_failed",
        lastEvalSummary: securityResult.reason.slice(0, 1500),
      },
    });
    await refreshWorkflowStates(input.projectId);
    vOut = mergeEnvTestStage2RunValidationOutput(vOut, {
      stage2RunSummary: {
        finalOutcome: "FAILED",
        reviewOutcome: reviewResult.result,
        securityOutcome: securityResult.result,
      },
    });
    await prisma.taskExecutionRun.update({
      where: { id: input.execRunId },
      data: { validationOutput: vOut },
    });
    logStage2CatalogEvent({
      phase: "stage2_failed",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { step: "security", result: "FAIL" },
    });
    return {
      ok: false,
      message: `Stage 2: Security 실패 — ${securityResult.reason}`,
      blockedReason: "SECURITY_FAILED",
    };
  }

  if (securityResult.result === "PASS") {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.SECURITY_PASSED,
        lastEvalResult: "security_passed",
        lastEvalSummary: securityResult.reason.slice(0, 1500),
      },
    });
    await refreshWorkflowStates(input.projectId);
  } else {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.SCM_PENDING,
        lastEvalResult: securityResult.result === "MISSING" ? "security_missing" : "security_disabled",
        lastEvalSummary: securityResult.reason.slice(0, 1500),
      },
    });
    await refreshWorkflowStates(input.projectId);
  }

  await prisma.task.update({
    where: { id: input.taskId },
    data: { executionWorkflowStatus: EXECUTION_WORKFLOW.SCM_PENDING },
  });
  await refreshWorkflowStates(input.projectId);

  const scmMember = await getAiMemberByRole({ projectId: input.projectId, role: "scm" });
  const scmRequest = buildEnvTestStage2ScmRequest({
    prNumber: input.prNumber,
    prStateOpen: true,
    review: reviewResult,
    security: securityResult,
  });
  vOut = mergeEnvTestStage2RunValidationOutput(vOut, { scmRequest });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: vOut },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_platform_to_scm",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: scmRequest, scmMember },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_scm_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { executionId: input.execRunId, scmMemberAvailable: scmMember.available },
  });
  logStage2CatalogEvent({
    phase: "scm_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    executionId: input.execRunId,
    detail: { scmMemberAvailable: scmMember.available },
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorScmStart(m, Date.now()));

  let mergeRes: Awaited<ReturnType<typeof executeEnvTestPrMergeSmokeTest>>;

  if (!scmMember.available) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage2_scm_platform_fallback",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: { message: "SCM 미등록 — 플랫폼이 merge·verify 수행" },
    });
    logStage2CatalogEvent({
      phase: "scm_platform_fallback",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { platform_fallback: true },
    });
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_PENDING,
        lastEvalResult: "merge_pending",
        lastEvalSummary: "Stage 2: SCM 미설정 — 플랫폼 직접 merge",
      },
    });
    await refreshWorkflowStates(input.projectId);

    await patchTaskExecutionRunStage2Timing(input.execRunId, { scmTimeMs: 0 });
    const mergeStarted = Date.now();
    const mergeStartIso = new Date(mergeStarted).toISOString();
    mergeRes = await executeEnvTestPrMergeSmokeTest({
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      taskId: input.taskId,
    });
    const mergeEnded = Date.now();
    const mergePipelineMs = mergeEnded - mergeStarted;
    await patchTaskExecutionRunStage2Timing(input.execRunId, {
      mergeTimeMs: mergePipelineMs,
      mergeVerifyTimeMs: 0,
    });
    logStage2TelemetryEvent({
      executionId: input.execRunId,
      stage: "MERGE",
      event: "MERGE_PIPELINE_COMPLETED",
      startTime: mergeStartIso,
      endTime: new Date(mergeEnded).toISOString(),
      elapsedMs: mergePipelineMs,
      result: mergeRes.ok ? "ok" : "fail",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
    });
  } else {
    if (!repoUrl || !baseBranch || !headBranch || !taskRow?.name) {
      vOut = mergeEnvTestStage2RunValidationOutput(vOut, {
        stage2RunSummary: {
          finalOutcome: "FAILED",
          reviewOutcome: reviewResult.result,
          securityOutcome: securityResult.result,
          scmParticipant: "AI",
          scmMergeResult: "BLOCKED",
          mergeVerified: false,
        },
      });
      await prisma.taskExecutionRun.update({
        where: { id: input.execRunId },
        data: { validationOutput: vOut },
      });
      await prisma.task.update({
        where: { id: input.taskId },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_BLOCKED,
          status: "FAILED",
          lastEvalResult: "scm_blocked",
          lastEvalSummary: "Stage 2 SCM 판단에 필요한 repo/base/branch 정보가 부족합니다.",
        },
      });
      await refreshWorkflowStates(input.projectId);
      logStage2CatalogEvent({
        phase: "stage2_failed",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        executionId: input.execRunId,
        detail: { step: "scm_preflight", reason: "missing_repo_branch" },
      });
      await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorScmDone(m, Date.now()));
      return { ok: false, message: "Stage 2: SCM 판단 불가(저장소/브랜치 정보 부족)", blockedReason: "SCM_BLOCKED" };
    }

    const scmDecStarted = Date.now();
    const scmDecStartIso = new Date(scmDecStarted).toISOString();
    const scmDecision = await runEnvTestStage2ScmDecisionWithAiMembers({
      projectId: input.projectId,
      repoUrl,
      taskId: input.taskId,
      taskTitle: taskRow.name,
      taskDescription: taskRow.description ?? null,
      branch: headBranch,
      baseBranch,
      reviewResult: reviewResult.result,
      securityResult: securityResult.result,
      reviewReason: reviewResult.reason,
      securityReason: securityResult.reason,
    });
    const scmDecisionMs = Date.now() - scmDecStarted;
    await patchTaskExecutionRunStage2Timing(input.execRunId, { scmTimeMs: scmDecisionMs });
    logStage2TelemetryEvent({
      executionId: input.execRunId,
      stage: "SCM",
      event: "SCM_DECISION_COMPLETED",
      startTime: scmDecStartIso,
      endTime: new Date().toISOString(),
      elapsedMs: scmDecisionMs,
      result: scmDecision.decision ?? "n/a",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
    });

    if (scmDecision.decision && scmDecision.decision !== "approve_merge") {
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_stage2_scm_blocked",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        detail: { decision: scmDecision.decision, summary: (scmDecision.summary ?? "").slice(0, 500) },
      });
      logStage2CatalogEvent({
        phase: "scm_blocked",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        executionId: input.execRunId,
        detail: { decision: scmDecision.decision },
      });
      vOut = mergeEnvTestStage2RunValidationOutput(vOut, {
        stage2RunSummary: {
          finalOutcome: "FAILED",
          reviewOutcome: reviewResult.result,
          securityOutcome: securityResult.result,
          scmParticipant: "AI",
          scmMergeResult: "BLOCKED",
          mergeVerified: false,
        },
      });
      await prisma.taskExecutionRun.update({
        where: { id: input.execRunId },
        data: { validationOutput: vOut },
      });
      await prisma.task.update({
        where: { id: input.taskId },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_BLOCKED,
          status: "FAILED",
          lastEvalResult: "scm_blocked",
          lastEvalSummary: (scmDecision.summary ?? "SCM Manager가 merge를 승인하지 않았습니다.").slice(0, 1500),
        },
      });
      await refreshWorkflowStates(input.projectId);
      logStage2CatalogEvent({
        phase: "stage2_failed",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        executionId: input.execRunId,
        detail: { step: "scm_decision", blockedReason: "SCM_BLOCKED" },
      });
      await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorScmDone(m, Date.now()));
      return {
        ok: false,
        message: `Stage 2: SCM 차단 — ${(scmDecision.summary ?? "hold/reject").slice(0, 800)}`,
        blockedReason: "SCM_BLOCKED",
      };
    }

    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_PENDING,
        lastEvalResult: "merge_pending",
        lastEvalSummary: "Stage 2: SCM approve_merge — 플랫폼 merge",
      },
    });
    await refreshWorkflowStates(input.projectId);

    const mergeStarted = Date.now();
    const mergeStartIso = new Date(mergeStarted).toISOString();
    mergeRes = await executeEnvTestPrMergeSmokeTest({
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      taskId: input.taskId,
    });
    const mergeEnded = Date.now();
    const mergePipelineMs = mergeEnded - mergeStarted;
    await patchTaskExecutionRunStage2Timing(input.execRunId, {
      mergeTimeMs: mergePipelineMs,
      mergeVerifyTimeMs: 0,
    });
    logStage2TelemetryEvent({
      executionId: input.execRunId,
      stage: "MERGE",
      event: "MERGE_PIPELINE_COMPLETED",
      startTime: mergeStartIso,
      endTime: new Date(mergeEnded).toISOString(),
      elapsedMs: mergePipelineMs,
      result: mergeRes.ok ? "ok" : "fail",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
    });
  }

  const scmResult = scmResultFromMergeOk(
    mergeRes.ok,
    !mergeRes.ok && "blockedReason" in mergeRes ? mergeRes.blockedReason : undefined,
    { platformScmFallback: !scmMember.available }
  );
  vOut = mergeEnvTestStage2RunValidationOutput(vOut, { scmResult });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: vOut },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_scm_to_platform",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: { payload: scmResult },
  });

  await patchTaskExecutionRunStage2Timing(input.execRunId, {
    pipelineFinishedAtMs: Date.now(),
  });

  const runFresh = await prisma.taskExecutionRun.findUnique({
    where: { id: input.execRunId },
    select: { validationOutput: true },
  });
  const voFresh = runFresh?.validationOutput ?? vOut;
  const timing = parseEnvTestStage2TimingFromValidationOutput(voFresh);
  const finalOutcome = !mergeRes.ok
    ? "FAILED"
    : reviewResult.result === "PASS" && securityResult.result === "PASS" && scmMember.available
      ? "COMPLETED"
      : "PARTIAL";
  const executorFromMeta = (() => {
    try {
      const j = JSON.parse(String(voFresh ?? "{}")) as Record<string, unknown>;
      const m = j[ENV_TEST_STAGE2_RUN_META_KEY] as Record<string, unknown> | undefined;
      const e = m?.executorAck as { result?: string } | undefined;
      return e?.result === "PASS" || e?.result === "FAIL" ? (e.result as "PASS" | "FAIL") : undefined;
    } catch {
      return undefined;
    }
  })();
  const scmMergeSummary =
    scmResult.result === "MERGED" ? "MERGED" : scmResult.result === "VERIFY_FAILED" ? "VERIFY_FAILED" : "BLOCKED";
  const nextVo = mergeEnvTestStage2RunValidationOutput(voFresh, {
    stage2RunSummary: {
      executorResult: executorFromMeta,
      reviewOutcome: reviewResult.result,
      securityOutcome: securityResult.result,
      scmParticipant: scmMember.available ? "AI" : "PLATFORM",
      scmMergeResult: scmMergeSummary,
      finalOutcome,
      mergeVerified: mergeRes.ok,
    },
  });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: { validationOutput: nextVo },
  });

  if (mergeRes.ok) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage2_scm_merged",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: { platformScmFallback: !scmMember.available },
    });
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage2_merge_verified",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: { ok: true },
    });
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage2_total_elapsed_ms",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: {
        total_elapsed_ms: timing.totalTimeMs,
        bottleneck_top1: timing.topBottleneck,
      },
    });
    logStage2CatalogEvent({
      phase: "scm_merged",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { platformScmFallback: !scmMember.available },
    });
    logStage2CatalogEvent({
      phase: "merge_verified",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { ok: true },
    });
    const completionPhase =
      finalOutcome === "COMPLETED"
        ? "stage2_completed"
        : finalOutcome === "PARTIAL"
          ? "stage2_partial"
          : "stage2_failed";
    logStage2CatalogEvent({
      phase: completionPhase,
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: {
        finalOutcome,
        total_elapsed_ms: timing.totalTimeMs,
        bottleneck_top1: timing.topBottleneck,
      },
    });
    logStage2CatalogEvent({
      phase: "scm_finished",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { mergeOk: mergeRes.ok, finalOutcome },
    });
    logStage2CatalogEvent({
      phase: "total_elapsed_ms",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      elapsedMs: typeof timing.totalTimeMs === "number" ? timing.totalTimeMs : undefined,
      detail: {
        total_elapsed_ms: timing.totalTimeMs,
        executorTime: timing.breakdown?.["executor"],
        cursorTime: timing.breakdown?.["cursor"],
        branchDetectTime: timing.breakdown?.["branchDetect"],
        prCreationTime: timing.breakdown?.["prCreation"],
        reviewTime: timing.breakdown?.["review"],
        securityTime: timing.breakdown?.["security"],
        scmTime: timing.breakdown?.["scm"],
        mergeTime: timing.breakdown?.["merge"],
        mergeVerifyTime: timing.breakdown?.["mergeVerify"],
        bottleneckTop1: timing.topBottleneck,
      },
    });
    await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorScmDone(m, Date.now()));
  } else {
    if (scmResult.result === "VERIFY_FAILED") {
      logStage2CatalogEvent({
        phase: "scm_verify_failed",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        executionId: input.execRunId,
        detail: { scmResult: scmResult.result },
      });
    }
    logStage2CatalogEvent({
      phase: "stage2_failed",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { mergeOk: false, scmResult: scmResult.result },
    });
    await patchTaskExecutionRunStage2RuntimeMonitor(input.execRunId, (m) => monitorScmDone(m, Date.now()));
  }

  return mergeRes;
}

export type EnvTestGithubFinalizeReturn =
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" };

/**
 * PR_OPENED DB 반영 이후 고정 분기: Stage 1은 direct merge smoke, Stage 2는 reviewer→security→scm.
 * `finalizeEnvTestPrOpenedFromGithubOnly`와 `runExecutionLoop` 메인 PR 경로가 동일 로직을 공유한다.
 */
export async function runEnvTestPostPrOpenedMergeAndReadiness(input: {
  projectId: string;
  taskId: string;
  taskKind: string | null;
  execRunId: string;
  actorUserId: string;
  prNumber: number;
  /** Stage 2 카탈로그 `pr_opened` 로그용(선택). */
  prUrl?: string | null;
  steps: LoopStepRecord[];
  singleTaskId?: string;
  effectiveAutoAdvance: boolean;
}): Promise<EnvTestGithubFinalizeReturn> {
  requireEnvTestFamilyTaskKindForFinalize(input.taskKind, "runEnvTestPostPrOpenedMergeAndReadiness", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });

  if (isEnvTestStage2TaskKind(input.taskKind)) {
    logStage2CatalogEvent({
      phase: "pr_opened",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: {
        prNumber: input.prNumber,
        prUrl: input.prUrl ?? undefined,
      },
    });
  }

  const readiness = await evaluateNextTaskReadiness({
    projectId: input.projectId,
    excludeTaskExecutionRunId: input.execRunId,
  });

  let mergeRes: Awaited<ReturnType<typeof executeEnvTestPrMergeSmokeTest>>;

  if (isEnvTestStage2TaskKind(input.taskKind)) {
    // Stage2: PR_OPENED 이후에만 Reviewer→Security→SCM.
    // - SCM 멤버가 있으면 SCM 의사결정이 merge 진행/차단을 결정
    // - SCM 멤버가 없으면 플랫폼 merge fallback
    mergeRes = await runEnvTestStage2ReviewScmAfterPrOpened({
      projectId: input.projectId,
      taskId: input.taskId,
      execRunId: input.execRunId,
      actorUserId: input.actorUserId,
      prNumber: input.prNumber,
    });
  } else {
    // Stage1: PR_OPENED 이후 즉시 플랫폼 merge smoke 수행.
    mergeRes = await executeEnvTestPrMergeSmokeTest({
      projectId: input.projectId,
      actorUserId: input.actorUserId,
    });
  }

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
  requireEnvTestFamilyTaskKindForFinalize(input.taskKind, "finalizeEnvTestPrOpenedFromGithubOnly", {
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

  return runEnvTestPostPrOpenedMergeAndReadiness({
    projectId: input.projectId,
    taskId: input.taskId,
    taskKind: input.taskKind,
    execRunId: input.execRunId,
    actorUserId: input.actorUserId,
    prNumber: input.prNumber,
    prUrl: input.prUrl,
    steps: input.steps,
    singleTaskId: input.singleTaskId,
    effectiveAutoAdvance: input.effectiveAutoAdvance,
  });
}
