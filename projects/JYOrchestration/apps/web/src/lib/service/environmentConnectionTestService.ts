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

const ENV_TEST_STAGE2_DESCRIPTION = `Stage 1과 동일한 브랜치·파일 계약으로 \`orchestration-test/hello-world.md\` 를 생성/수정하고 커밋·푸시한다.
PR 이후 플랫폼이 최소 리뷰(PASS/FAIL)를 거친 뒤, PASS일 때만 머지·검증한다. Executor·리뷰어·SCM은 서로 직접 통신하지 않는다.`;

const ENV_TEST_STAGE2_CRITERIA = [
  "platform branch name (same as Stage 1)",
  "orchestration-test/hello-world.md",
  "push; platform PR with Stage2 title",
  "platform reviewer PASS",
  "platform SCM merge + verify",
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
  stage2ReviewerResult?: "PASS" | "FAIL" | null;
  stage2ReviewerReason?: string | null;
  stage2SecurityResult?: "PASS" | "FAIL" | null;
  stage2SecurityReason?: string | null;
  stage2ScmResult?: "MERGED" | "BLOCKED" | "VERIFY_FAILED" | null;
  stage2ScmReason?: string | null;
  stage2TotalTimeMs?: number | null;
  stage2TopBottleneckStage?: string | null;
  stage2TopBottleneckMs?: number | null;
};

export async function getLatestEnvironmentTestTask(
  projectId: string
): Promise<EnvironmentTestLastDto | null> {
  const pid = String(projectId ?? "").trim();
  if (!pid) return null;

  await ensureTaskExecutionRunColumnsReady();

  const project = await prisma.project.findUnique({
    where: { id: pid },
    select: { currentSpecVersionId: true },
  });
  const specId = project?.currentSpecVersionId ?? null;

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
            lastOrchestrationBranch: true,
            updatedAt: true,
            taskExecutionRuns: {
              where: { archivedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                prStatus: true,
                branchName: true,
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
        lastOrchestrationBranch: true,
        updatedAt: true,
        taskExecutionRuns: {
          where: { archivedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            prStatus: true,
            branchName: true,
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
  projectId: string
): Promise<EnvironmentTestLastDto | null> {
  const pid = String(projectId ?? "").trim();
  if (!pid) return null;

  await ensureTaskExecutionRunColumnsReady();

  const project = await prisma.project.findUnique({
    where: { id: pid },
    select: { currentSpecVersionId: true },
  });
  const specId = project?.currentSpecVersionId ?? null;

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
            lastOrchestrationBranch: true,
            updatedAt: true,
            taskExecutionRuns: {
              where: { archivedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                prStatus: true,
                branchName: true,
                mergeCommitSha: true,
                mergedAt: true,
                envTestRemoteBranchDeletedAt: true,
                envTestMergeBlockedReason: true,
                envTestMergeStartedAt: true,
                validationOutput: true,
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
        lastOrchestrationBranch: true,
        updatedAt: true,
        taskExecutionRuns: {
          where: { archivedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            prStatus: true,
            branchName: true,
            mergeCommitSha: true,
            mergedAt: true,
            envTestRemoteBranchDeletedAt: true,
            envTestMergeBlockedReason: true,
            envTestMergeStartedAt: true,
            validationOutput: true,
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
  };

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
