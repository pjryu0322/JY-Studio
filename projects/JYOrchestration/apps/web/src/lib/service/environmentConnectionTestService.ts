/**
 * 실행 환경(Git·Cursor·PR) 원클릭 검증용 ENV_TEST Task.
 * 프로덕션 워크플로가 아니라 설정 화면에서만 단일 실행한다.
 *
 * Phase 1.5: 푸시·PR 확정은 GitHub REST(compare / pulls)가 단일 근거이며 웹훅은 사용하지 않는다.
 *
 * 스코프: DB에 taskKind=ENV_TEST Task를 심을 뿐, 실제 Cursor/폴링/마무리는 runExecutionLoop + taskKind 게이트가 담당.
 */

import { evaluateNextTaskReadiness } from "@/lib/executionLoop/nextTaskReadiness";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { prisma } from "@/lib/prisma";
import { ensureTaskExecutionRunColumnsReady } from "@/lib/prisma/taskExecutionRunColumnsHeal";
import { ENV_TEST_STAGE2_TASK_KIND, ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";
import { assertEnvTestStartReadiness } from "@/lib/service/envTestServerReadiness";
import { parseEnvTestStage2UiFromValidationOutput } from "@/lib/service/envTestStage2PlatformActors";
import { parseEnvTestStage2TimingFromValidationOutput } from "@/lib/service/envTestStage2Telemetry";
import { deriveStage2LiveHints } from "@/lib/service/envTestStage2LiveHints";
import {
  bottleneckLabelKo,
  parseStage2RuntimeMonitorFromValidationOutput,
  stage2PhaseKeyForApi,
} from "@/lib/service/envTestStage2RuntimeMonitor";

function runtimePhaseElapsedMs(
  phase: { startedAtMs?: number; endedAtMs?: number; status?: string } | undefined,
  nowMs: number
): number {
  if (!phase?.startedAtMs) return 0;
  const end = typeof phase.endedAtMs === "number" ? phase.endedAtMs : phase.status === "RUNNING" ? nowMs : phase.startedAtMs;
  return Math.max(0, end - phase.startedAtMs);
}

export { ENV_TEST_STAGE2_TASK_KIND, ENV_TEST_TASK_KIND };

export const ENV_TEST_TASK_NAME = "환경 연결 테스트 - Hello World";

const ENV_TEST_DESCRIPTION = `AI-Cursor-Git 연동 상태를 확인하기 위해 테스트 파일을 작성하고 커밋·푸시까지 수행한다.

**중요 (ENV_TEST 전용 계약)**
- 플랫폼이 지정한 **정확한 브랜치 이름**을 사용한다. 브랜치 이름을 바꾸지 않는다.
- **Pull Request는 생성하지 않는다.** PR은 플랫폼이 GitHub API로 연다.
- 할 일: 아래 파일을 생성/수정 → 커밋 → 원격 브랜치로 **푸시**까지 완료한다(실행 환경에서 자동 푸시가 켜진 경우).

반드시 다음 파일을 생성하거나 내용을 아래와 같이 맞춘다:

- 경로: \`orchestration-test/hello-world.md\`
- 내용:

\`\`\`markdown
# Hello World

이 파일은 JYOrchestration 환경 연결 테스트를 통해 자동 생성되었습니다.

- 목적: AI → Cursor → Git → PR 흐름 점검
- 상태: 자동 생성
\`\`\``;

const ENV_TEST_CRITERIA = [
  "test branch created (platform branch name)",
  "hello world test file created or updated at orchestration-test/hello-world.md",
  "commit created",
  "push succeeded to remote branch",
  "platform opens GitHub PR (not Cursor)",
  "task state becomes PR_OPENED",
];

export const ENV_TEST_STAGE2_TASK_NAME = "환경 연결 테스트 Stage 2 — 역할 분리 readiness";

/** DB 표시용. 실제 Cursor 지시는 buildCursorExecutionPrompt(compactHelloWorld)가 단일 근원. */
const ENV_TEST_STAGE2_DESCRIPTION = `브랜치 이름 준수. 파일 1개 \`orchestration-test/hello-world.md\` → 커밋 → 푸시.`;

/** 리뷰/SCM 문구는 프롬프트에 넣지 않는다(Stage 1과 동일한 검증 항목만). */
const ENV_TEST_STAGE2_CRITERIA = [
  "test branch created (platform branch name)",
  "hello world test file created or updated at orchestration-test/hello-world.md",
  "commit created",
  "push succeeded to remote branch",
  "platform opens GitHub PR (not Cursor)",
];

export function parsePrUrlFromRunPrStatus(prStatus: string | null | undefined): string | null {
  const s = String(prStatus ?? "").trim();
  const lower = s.toLowerCase();
  const prefix = lower.startsWith("open:")
    ? "open:"
    : lower.startsWith("merged:")
      ? "merged:"
      : null;
  if (!prefix) return null;
  const rest = s.slice(prefix.length);
  const colon = rest.indexOf(":");
  if (colon < 0) return null;
  const url = rest.slice(colon + 1).trim();
  return /^https?:\/\//i.test(url) ? url : null;
}

export async function createEnvironmentTestTask(input: {
  projectId: string;
  actorUserId: string;
}): Promise<{ ok: true; taskId: string } | { ok: false; message: string }> {
  const projectId = String(input.projectId ?? "").trim();
  const actorUserId = String(input.actorUserId ?? "").trim();
  if (!projectId) {
    return { ok: false, message: "projectId가 필요합니다." };
  }
  if (!actorUserId) {
    return { ok: false, message: "사용자 인증이 필요합니다." };
  }

  const ready = await assertEnvTestStartReadiness({ projectId, userId: actorUserId });
  if (!ready.ok) {
    return { ok: false, message: ready.userMessage };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerUserId: true, currentSpecVersionId: true },
  });
  if (!project?.currentSpecVersionId) {
    return {
      ok: false,
      message: "확정된 Project Spec 버전이 없습니다. Spec을 확정한 뒤 연결 테스트를 실행하세요.",
    };
  }

  const specId = project.currentSpecVersionId;
  const now = new Date();

  /** 이전 ENV_TEST는 재사용하지 않는다. 같은 Spec의 기존 ENV_TEST를 보관해 stuck run이 새 실행을 막지 않게 한다. */
  const archived = await prisma.task.updateMany({
    where: {
      projectId,
      taskKind: ENV_TEST_TASK_KIND,
      archivedAt: null,
      sourceSpecVersionId: specId,
    },
    data: { archivedAt: now },
  });
  if (archived.count > 0) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_archive_previous_tasks_for_fresh_run",
      projectId,
      userId: actorUserId,
      detail: { archivedCount: archived.count, sourceSpecVersionId: specId },
    });
  }

  const maxRow = await prisma.task.aggregate({
    where: { projectId, sourceSpecVersionId: specId, archivedAt: null },
    _max: { order: true },
  });
  const nextOrder = (maxRow._max.order ?? 0) + 1;

  const task = await prisma.task.create({
    data: {
      projectId,
      ownerUserId: project.ownerUserId,
      sourceSpecVersionId: specId,
      name: ENV_TEST_TASK_NAME,
      description: ENV_TEST_DESCRIPTION,
      taskKind: ENV_TEST_TASK_KIND,
      status: "TODO",
      order: nextOrder,
      dependsOnTaskIds: [],
      acceptanceCriteria: ENV_TEST_CRITERIA,
    },
    select: { id: true },
  });

  await refreshWorkflowStates(projectId);

  return { ok: true, taskId: task.id };
}

export async function createEnvironmentStage2TestTask(input: {
  projectId: string;
  actorUserId: string;
}): Promise<{ ok: true; taskId: string } | { ok: false; message: string }> {
  const projectId = String(input.projectId ?? "").trim();
  const actorUserId = String(input.actorUserId ?? "").trim();
  if (!projectId) {
    return { ok: false, message: "projectId가 필요합니다." };
  }
  if (!actorUserId) {
    return { ok: false, message: "사용자 인증이 필요합니다." };
  }

  const ready = await assertEnvTestStartReadiness({ projectId, userId: actorUserId });
  if (!ready.ok) {
    return { ok: false, message: ready.userMessage };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerUserId: true, currentSpecVersionId: true },
  });
  if (!project?.currentSpecVersionId) {
    return {
      ok: false,
      message: "확정된 Project Spec 버전이 없습니다. Spec을 확정한 뒤 연결 테스트를 실행하세요.",
    };
  }

  const specId = project.currentSpecVersionId;
  const now = new Date();

  const archived = await prisma.task.updateMany({
    where: {
      projectId,
      taskKind: ENV_TEST_STAGE2_TASK_KIND,
      archivedAt: null,
      sourceSpecVersionId: specId,
    },
    data: { archivedAt: now },
  });
  if (archived.count > 0) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage2_archive_previous_tasks_for_fresh_run",
      projectId,
      userId: actorUserId,
      detail: { archivedCount: archived.count, sourceSpecVersionId: specId },
    });
  }

  const maxRow = await prisma.task.aggregate({
    where: { projectId, sourceSpecVersionId: specId, archivedAt: null },
    _max: { order: true },
  });
  const nextOrder = (maxRow._max.order ?? 0) + 1;

  const task = await prisma.task.create({
    data: {
      projectId,
      ownerUserId: project.ownerUserId,
      sourceSpecVersionId: specId,
      name: ENV_TEST_STAGE2_TASK_NAME,
      description: ENV_TEST_STAGE2_DESCRIPTION,
      taskKind: ENV_TEST_STAGE2_TASK_KIND,
      status: "TODO",
      order: nextOrder,
      dependsOnTaskIds: [],
      acceptanceCriteria: ENV_TEST_STAGE2_CRITERIA,
    },
    select: { id: true },
  });

  await refreshWorkflowStates(projectId);

  return { ok: true, taskId: task.id };
}

export type EnvironmentTestLastDto = {
  taskId: string;
  name: string;
  taskStatus: string;
  workflowStatus: string | null;
  branchName: string | null;
  prUrl: string | null;
  updatedAt: string;
  mergeCommitSha?: string | null;
  mergedAt?: string | null;
  envTestRemoteBranchDeletedAt?: string | null;
  envTestMergeBlockedReason?: string | null;
  envTestMergeStartedAt?: string | null;
  nextTaskReady?: boolean | null;
  nextTaskId?: string | null;
  nextTaskName?: string | null;
  nextTaskBlockedReason?: string | null;
  /** Stage 2 전용(UI): validationOutput 에서 파생 */
  stage2ExecutorResult?: "PASS" | "FAIL" | null;
  stage2FinalOutcome?: "COMPLETED" | "PARTIAL" | "FAILED" | null;
  stage2ScmParticipant?: "AI" | "PLATFORM" | null;
  stage2ScmDisplay?: "PASS" | "BLOCKED" | "PLATFORM_FALLBACK" | "VERIFY_FAILED" | null;
  stage2ReviewerResult?: "PASS" | "FAIL" | "MISSING" | "DISABLED" | null;
  stage2ReviewerReason?: string | null;
  stage2SecurityResult?: "PASS" | "FAIL" | "MISSING" | "DISABLED" | null;
  stage2SecurityReason?: string | null;
  stage2ScmResult?: "MERGED" | "BLOCKED" | "VERIFY_FAILED" | null;
  stage2ScmReason?: string | null;
  stage2TotalTimeMs?: number | null;
  stage2TopBottleneckStage?: string | null;
  stage2TopBottleneckMs?: number | null;
  /** 진행 중일 때 패널용(Reviewer 로그 전 등) */
  stage2UiHint?: string | null;
  stage2EstimatedBottleneck?: string | null;
  stage2LivePhaseLabel?: string | null;
  /** 패널 currentStep (git_reflect | cursor | review …) */
  stage2CurrentStep?: string | null;
  /** 세분화된 현재 단계 (예: cursor_push, git_branch_detect) */
  stage2CurrentPhase?: string | null;
  stage2CursorStatus?: {
    prepare: "PENDING" | "RUNNING" | "DONE";
    generate: "PENDING" | "RUNNING" | "DONE";
    commit: "PENDING" | "RUNNING" | "DONE";
    push: "PENDING" | "RUNNING" | "DONE";
  } | null;
  stage2GitStatus?: { branchDetected: boolean; branchReflected: boolean } | null;
  stage2PlatformStatus?: { prCreated: boolean } | null;
  stage2CursorSignal?: {
    agentLaunchedAtMs?: number;
    pushStartedAtMs?: number;
    pushCompletedHintAtMs?: number;
    branchNameHint?: string;
    headShaHint?: string;
    commitHashHint?: string;
    changedFilesCountHint?: number;
  } | null;
  stage2RuntimeBottleneckPhase?: string | null;
  stage2RuntimeBottleneckMs?: number | null;
  stage2CurrentBottleneckHint?: string | null;
  /** 진행 중 런 기준 경과 ms (서버 시각) */
  stage2RunElapsedMs?: number | null;
  stage2TimingBreakdown?: Record<string, number> | null;
  cursorPromptRaw?: string | null;
  cursorPromptLength?: number | null;
  cursorPromptPreview?: string | null;
  stage2CursorPromptRaw?: string | null;
  stage2CursorPromptCanViewRaw?: boolean | null;
  stage2FailureMessage?: string | null;
};

export async function getLatestEnvironmentTestTask(
  projectId: string,
  opts?: { viewerUserId?: string | null }
): Promise<EnvironmentTestLastDto | null> {
  const pid = String(projectId ?? "").trim();
  if (!pid) return null;

  await ensureTaskExecutionRunColumnsReady();

  const viewerUserId = String(opts?.viewerUserId ?? "").trim() || null;
  const project = await prisma.project.findUnique({
    where: { id: pid },
    select: { currentSpecVersionId: true, ownerUserId: true },
  });
  const specId = project?.currentSpecVersionId ?? null;
  const canViewPromptRaw = Boolean(viewerUserId && project?.ownerUserId && viewerUserId === project.ownerUserId);

  const row =
    specId != null
      ? await prisma.task.findFirst({
          where: {
            projectId: pid,
            taskKind: ENV_TEST_TASK_KIND,
            archivedAt: null,
            sourceSpecVersionId: specId,
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            executionWorkflowStatus: true,
            lastEvalSummary: true,
            lastOrchestrationBranch: true,
            updatedAt: true,
            taskExecutionRuns: {
              where: { archivedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                prStatus: true,
                branchName: true,
                promptSnapshot: true,
                mergeCommitSha: true,
                mergedAt: true,
                envTestRemoteBranchDeletedAt: true,
                envTestMergeBlockedReason: true,
                envTestMergeStartedAt: true,
              },
            },
          },
        })
      : null;

  const rowResolved =
    row ??
    (await prisma.task.findFirst({
      where: {
        projectId: pid,
        taskKind: ENV_TEST_TASK_KIND,
        archivedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        executionWorkflowStatus: true,
        lastEvalSummary: true,
        lastOrchestrationBranch: true,
        updatedAt: true,
        taskExecutionRuns: {
          where: { archivedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            prStatus: true,
            branchName: true,
            promptSnapshot: true,
            mergeCommitSha: true,
            mergedAt: true,
            envTestRemoteBranchDeletedAt: true,
            envTestMergeBlockedReason: true,
            envTestMergeStartedAt: true,
          },
        },
      },
    }));

  if (!rowResolved) return null;

  const run0 = rowResolved.taskExecutionRuns[0];
  const prUrl = parsePrUrlFromRunPrStatus(run0?.prStatus ?? null);
  const branchName = rowResolved.lastOrchestrationBranch ?? run0?.branchName ?? null;

  const base: EnvironmentTestLastDto = {
    taskId: rowResolved.id,
    name: rowResolved.name,
    taskStatus: rowResolved.status,
    workflowStatus: rowResolved.executionWorkflowStatus,
    branchName,
    prUrl,
    updatedAt: rowResolved.updatedAt.toISOString(),
    mergeCommitSha: run0?.mergeCommitSha ?? null,
    mergedAt: run0?.mergedAt?.toISOString() ?? null,
    envTestRemoteBranchDeletedAt: run0?.envTestRemoteBranchDeletedAt?.toISOString() ?? null,
    envTestMergeBlockedReason: run0?.envTestMergeBlockedReason ?? null,
    envTestMergeStartedAt: run0?.envTestMergeStartedAt?.toISOString() ?? null,
    cursorPromptLength: run0?.promptSnapshot?.length ?? null,
    cursorPromptPreview: run0?.promptSnapshot ? run0.promptSnapshot.slice(0, 500) : null,
    cursorPromptRaw: canViewPromptRaw ? run0?.promptSnapshot ?? null : null,
    stage2CursorPromptRaw: canViewPromptRaw ? run0?.promptSnapshot ?? null : null,
    stage2CursorPromptCanViewRaw: canViewPromptRaw,
    stage2FailureMessage:
      String(rowResolved.lastEvalSummary ?? "").trim().startsWith("Stage 2 실패:")
        ? String(rowResolved.lastEvalSummary ?? "").trim()
        : null,
  };

  const wfNorm = String(rowResolved.executionWorkflowStatus ?? "").trim();
  const mergeInProgress = wfNorm === EXECUTION_WORKFLOW.PR_OPENED && Boolean(run0?.envTestMergeStartedAt) && !run0?.mergedAt;
  if (wfNorm === EXECUTION_WORKFLOW.MERGED || (!mergeInProgress && wfNorm === EXECUTION_WORKFLOW.PR_OPENED)) {
    const r = await evaluateNextTaskReadiness({ projectId: pid });
    return {
      ...base,
      nextTaskReady: r.nextTaskReady,
      nextTaskId: r.nextTaskId,
      nextTaskName: r.nextTaskName,
      nextTaskBlockedReason: r.nextTaskBlockedReason,
    };
  }

  return base;
}

export async function getLatestEnvironmentStage2TestTask(
  projectId: string,
  opts?: { viewerUserId?: string | null }
): Promise<EnvironmentTestLastDto | null> {
  const pid = String(projectId ?? "").trim();
  if (!pid) return null;

  await ensureTaskExecutionRunColumnsReady();

  const viewerUserId = String(opts?.viewerUserId ?? "").trim() || null;
  const project = await prisma.project.findUnique({
    where: { id: pid },
    select: { currentSpecVersionId: true, ownerUserId: true },
  });
  const specId = project?.currentSpecVersionId ?? null;
  const canViewPromptRaw = Boolean(viewerUserId && project?.ownerUserId && viewerUserId === project.ownerUserId);

  const row =
    specId != null
      ? await prisma.task.findFirst({
          where: {
            projectId: pid,
            taskKind: ENV_TEST_STAGE2_TASK_KIND,
            archivedAt: null,
            sourceSpecVersionId: specId,
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            executionWorkflowStatus: true,
            lastEvalSummary: true,
            lastOrchestrationBranch: true,
            lastOrchestrationCommitStatus: true,
            lastOrchestrationPushStatus: true,
            updatedAt: true,
            taskExecutionRuns: {
              where: { archivedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                status: true,
                commitStatus: true,
                pushStatus: true,
                prStatus: true,
                branchName: true,
                promptSnapshot: true,
                mergeCommitSha: true,
                mergedAt: true,
                envTestRemoteBranchDeletedAt: true,
                envTestMergeBlockedReason: true,
                envTestMergeStartedAt: true,
                validationOutput: true,
                createdAt: true,
                completedAt: true,
              },
            },
          },
        })
      : null;

  const rowResolved =
    row ??
    (await prisma.task.findFirst({
      where: {
        projectId: pid,
        taskKind: ENV_TEST_STAGE2_TASK_KIND,
        archivedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        executionWorkflowStatus: true,
        lastEvalSummary: true,
        lastOrchestrationBranch: true,
        lastOrchestrationCommitStatus: true,
        lastOrchestrationPushStatus: true,
        updatedAt: true,
        taskExecutionRuns: {
          where: { archivedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
            commitStatus: true,
            pushStatus: true,
            prStatus: true,
            branchName: true,
            promptSnapshot: true,
            mergeCommitSha: true,
            mergedAt: true,
            envTestRemoteBranchDeletedAt: true,
            envTestMergeBlockedReason: true,
            envTestMergeStartedAt: true,
            validationOutput: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    }));

  if (!rowResolved) return null;

  const run0 = rowResolved.taskExecutionRuns[0];
  const prUrl = parsePrUrlFromRunPrStatus(run0?.prStatus ?? null);
  const branchName = rowResolved.lastOrchestrationBranch ?? run0?.branchName ?? null;
  const s2 = parseEnvTestStage2UiFromValidationOutput(run0?.validationOutput ?? null);
  const t2 = parseEnvTestStage2TimingFromValidationOutput(run0?.validationOutput ?? null);
  const runtimeMon = parseStage2RuntimeMonitorFromValidationOutput(run0?.validationOutput ?? null);
  const nowMs = Date.now();

  const wfNormPre = String(rowResolved.executionWorkflowStatus ?? "").trim();
  const runInFlight =
    Boolean(run0?.createdAt) &&
    run0?.status !== "done" &&
    run0?.status !== "failed" &&
    wfNormPre !== EXECUTION_WORKFLOW.MERGED &&
    wfNormPre !== EXECUTION_WORKFLOW.FAILED;
  const stage2RunElapsedMs =
    runInFlight && run0?.createdAt ? Date.now() - run0.createdAt.getTime() : null;

  const live = deriveStage2LiveHints({
    executionWorkflowStatus: rowResolved.executionWorkflowStatus,
    taskStatus: rowResolved.status,
    runStatus: run0?.status ?? null,
    commitStatus: run0?.commitStatus ?? null,
    pushStatus: run0?.pushStatus ?? null,
    prUrl,
    lastOrchestrationCommitStatus: rowResolved.lastOrchestrationCommitStatus ?? null,
    lastOrchestrationPushStatus: rowResolved.lastOrchestrationPushStatus ?? null,
    stage2RunElapsedMs,
  });

  const base: EnvironmentTestLastDto = {
    taskId: rowResolved.id,
    name: rowResolved.name,
    taskStatus: rowResolved.status,
    workflowStatus: rowResolved.executionWorkflowStatus,
    branchName,
    prUrl,
    updatedAt: rowResolved.updatedAt.toISOString(),
    mergeCommitSha: run0?.mergeCommitSha ?? null,
    mergedAt: run0?.mergedAt?.toISOString() ?? null,
    envTestRemoteBranchDeletedAt: run0?.envTestRemoteBranchDeletedAt?.toISOString() ?? null,
    envTestMergeBlockedReason: run0?.envTestMergeBlockedReason ?? null,
    envTestMergeStartedAt: run0?.envTestMergeStartedAt?.toISOString() ?? null,
    ...s2,
    stage2TotalTimeMs: t2.totalTimeMs,
    stage2TopBottleneckStage: t2.topBottleneck?.stage ?? null,
    stage2TopBottleneckMs: t2.topBottleneck?.ms ?? null,
    stage2UiHint: live.stage2UiHint,
    stage2EstimatedBottleneck: live.stage2EstimatedBottleneck,
    stage2LivePhaseLabel: live.stage2LivePhaseLabel,
    stage2CurrentStep: live.stage2CurrentStep,
    stage2CurrentBottleneckHint: live.stage2CurrentBottleneckHint,
    stage2RunElapsedMs,
    stage2TimingBreakdown: t2.breakdown,
    cursorPromptLength: run0?.promptSnapshot?.length ?? null,
    cursorPromptPreview: run0?.promptSnapshot ? run0.promptSnapshot.slice(0, 500) : null,
    cursorPromptRaw: canViewPromptRaw ? run0?.promptSnapshot ?? null : null,
    stage2CursorPromptRaw: canViewPromptRaw ? run0?.promptSnapshot ?? null : null,
    stage2CursorPromptCanViewRaw: canViewPromptRaw,
    stage2FailureMessage:
      String(rowResolved.lastEvalSummary ?? "").trim().startsWith("Stage 2 실패:")
        ? String(rowResolved.lastEvalSummary ?? "").trim()
        : null,
  };
  if (runtimeMon) {
    const runtimeBreakdown = {
      cursorPrepare: runtimePhaseElapsedMs(runtimeMon.phases.cursor_prepare, nowMs),
      cursorGenerate: runtimePhaseElapsedMs(runtimeMon.phases.cursor_generate, nowMs),
      cursorCommit: runtimePhaseElapsedMs(runtimeMon.phases.cursor_commit, nowMs),
      cursorPush: runtimePhaseElapsedMs(runtimeMon.phases.cursor_push, nowMs),
      branchDetect: runtimePhaseElapsedMs(runtimeMon.phases.git_branch_detect, nowMs),
      prCreation: runtimePhaseElapsedMs(runtimeMon.phases.platform_pr_create, nowMs),
      review: runtimePhaseElapsedMs(runtimeMon.phases.review, nowMs),
      security: runtimePhaseElapsedMs(runtimeMon.phases.security, nowMs),
      scm: runtimePhaseElapsedMs(runtimeMon.phases.scm, nowMs),
    } as Record<string, number>;
    base.stage2TimingBreakdown = {
      ...(base.stage2TimingBreakdown ?? {}),
      ...runtimeBreakdown,
    };
  }
  if (runInFlight && runtimeMon) {
    const apiPhase = stage2PhaseKeyForApi(runtimeMon.currentPhase);
    const apiBn = runtimeMon.bottleneckPhase ? stage2PhaseKeyForApi(runtimeMon.bottleneckPhase) : null;
    base.stage2CurrentPhase = apiPhase;
    base.stage2CursorStatus = runtimeMon.cursorStatus;
    base.stage2GitStatus = runtimeMon.gitStatus;
    base.stage2PlatformStatus = runtimeMon.platformStatus;
    base.stage2CursorSignal = runtimeMon.cursorSignal ?? null;
    base.stage2RuntimeBottleneckPhase = apiBn;
    base.stage2RuntimeBottleneckMs = runtimeMon.bottleneckElapsedMs;
    base.stage2CurrentStep = apiPhase;
    base.stage2LivePhaseLabel = bottleneckLabelKo(runtimeMon.currentPhase) ?? apiPhase;
    base.stage2UiHint = null;
    if (apiBn) {
      base.stage2EstimatedBottleneck = apiBn;
      base.stage2CurrentBottleneckHint = bottleneckLabelKo(runtimeMon.bottleneckPhase);
      base.stage2TopBottleneckStage = apiBn;
    }
    if (typeof runtimeMon.bottleneckElapsedMs === "number") {
      base.stage2TopBottleneckMs = runtimeMon.bottleneckElapsedMs;
    }
    const gd = runtimeMon.phases.git_branch_detect;
    if (gd?.status === "RUNNING" && gd.startedAtMs != null && Date.now() - gd.startedAtMs > 5_000) {
      base.stage2LivePhaseLabel = "Git 반영 대기";
      const bnKey = stage2PhaseKeyForApi(runtimeMon.bottleneckPhase ?? "");
      if (bnKey === "git_branch_detect" || apiPhase === "git_branch_detect") {
        base.stage2CurrentBottleneckHint = "Git 반영 대기";
      }
    }
  }
  if (s2.stage2FinalOutcome) {
    base.stage2UiHint = null;
    base.stage2EstimatedBottleneck = null;
    base.stage2LivePhaseLabel = null;
    base.stage2CurrentStep = null;
    base.stage2CurrentBottleneckHint = null;
    base.stage2RunElapsedMs = null;
    base.stage2CurrentPhase = null;
    base.stage2CursorStatus = null;
    base.stage2GitStatus = null;
    base.stage2PlatformStatus = null;
    base.stage2CursorSignal = null;
    base.stage2RuntimeBottleneckPhase = null;
    base.stage2RuntimeBottleneckMs = null;
  }

  const wfNorm = String(rowResolved.executionWorkflowStatus ?? "").trim();
  const mergeInProgress =
    (wfNorm === EXECUTION_WORKFLOW.PR_OPENED || wfNorm === EXECUTION_WORKFLOW.MERGE_PENDING) &&
    Boolean(run0?.envTestMergeStartedAt) &&
    !run0?.mergedAt;
  if (wfNorm === EXECUTION_WORKFLOW.MERGED || (!mergeInProgress && wfNorm === EXECUTION_WORKFLOW.PR_OPENED)) {
    const r = await evaluateNextTaskReadiness({ projectId: pid });
    return {
      ...base,
      nextTaskReady: r.nextTaskReady,
      nextTaskId: r.nextTaskId,
      nextTaskName: r.nextTaskName,
      nextTaskBlockedReason: r.nextTaskBlockedReason,
    };
  }

  return base;
}
