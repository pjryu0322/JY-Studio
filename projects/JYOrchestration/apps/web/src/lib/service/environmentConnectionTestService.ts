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
import { assertEnvTestStartReadiness } from "@/lib/service/envTestServerReadiness";

export const ENV_TEST_TASK_KIND = "ENV_TEST" as const;

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

async function resetEnvTestTaskForNewRun(projectId: string, taskId: string): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "TODO",
      executionWorkflowStatus: EXECUTION_WORKFLOW.READY,
      lastEvalResult: null,
      lastEvalSummary: null,
      lastOrchestrationBranch: null,
      lastOrchestrationCommitStatus: null,
      lastOrchestrationPushStatus: null,
      lastOrchestrationCommitSha: null,
      lastOrchestrationChangedFileCount: null,
      loopRetryCount: 0,
    },
  });
  await refreshWorkflowStates(projectId);
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

  const allEnv = await prisma.task.findMany({
    where: { projectId, taskKind: ENV_TEST_TASK_KIND, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, sourceSpecVersionId: true },
  });
  const forCurrent = allEnv.filter((t) => t.sourceSpecVersionId === specId);
  const canonicalId = forCurrent[0]?.id ?? null;
  const now = new Date();

  for (const t of allEnv) {
    if (t.id !== canonicalId) {
      await prisma.task.update({ where: { id: t.id }, data: { archivedAt: now } });
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_archive_previous_task",
        projectId,
        userId: actorUserId,
        detail: { archivedTaskId: t.id, reasonCode: "ENV_TEST_DEDUP" },
      });
    }
  }

  if (canonicalId) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_reuse_existing_task",
      projectId,
      userId: actorUserId,
      detail: { taskId: canonicalId },
    });
    await resetEnvTestTaskForNewRun(projectId, canonicalId);
    return { ok: true, taskId: canonicalId };
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
          orderBy: { createdAt: "asc" },
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
      orderBy: { createdAt: "asc" },
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
