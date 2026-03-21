/**
 * Git 반영 / 실행 관련 조회·적용 (projectId 스코프).
 * 기존 runGitApplyCoreFromBody 등 실행 코어는 그대로 위임만 한다.
 */
import { prisma } from "@/lib/prisma";
import {
  runGitApplyCoreFromBody,
  GIT_APPLY_ERROR_CODES,
  type RunGitApplyCoreResult,
} from "@/lib/git-apply/runApplyCore";
import { projectIdExists } from "@/lib/service/projectService";
import {
  countTaskRunsByProjectId,
  countTasksByProjectId,
} from "@/lib/service/taskService";
import { getExecutionQueueStubStatus } from "@/lib/service/executionQueue";

export type GitApplyApiBody = {
  gitChangeRequestId?: string;
  mode?: string;
  options?: { push?: boolean; simulateFailure?: boolean };
  retry?: boolean;
};

/** git-apply GET과 동일 select / projectId 필터 */
export async function listGitChangeRequestsForProject(projectId: string) {
  return prisma.gitChangeRequest.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      projectId: true,
      taskId: true,
      taskRunId: true,
      status: true,
      requestNote: true,
      files: true,
      diffText: true,
      commitMessage: true,
      applyStatus: true,
      applyLog: true,
      branchName: true,
      applyStartedAt: true,
      applyFinishedAt: true,
      retryCount: true,
      lastError: true,
      lastRetryAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export function serializeGitChangeRequestList(
  rows: Awaited<ReturnType<typeof listGitChangeRequestsForProject>>
) {
  return rows.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    applyStartedAt: item.applyStartedAt?.toISOString() ?? null,
    applyFinishedAt: item.applyFinishedAt?.toISOString() ?? null,
    lastRetryAt: item.lastRetryAt?.toISOString() ?? null,
  }));
}

/** git-apply POST 본문 → 코어 실행 (로직 변경 없음) */
export async function applyGitChangeFromApiBody(
  body: GitApplyApiBody
): Promise<RunGitApplyCoreResult> {
  return runGitApplyCoreFromBody({
    gitChangeRequestId: body.gitChangeRequestId,
    mode: body.mode,
    options: body.options,
    retry: body.retry === true,
  });
}

export type ProjectExecutionSummary = {
  projectId: string;
  gitChangeRequests: {
    total: number;
    byApplyStatus: Record<string, number>;
    applyingNow: number;
  };
  tasks: { total: number };
  taskRuns: { total: number };
  queue: ReturnType<typeof getExecutionQueueStubStatus>;
};

/**
 * 프로젝트 단위 실행 상태 요약 (멀티 프로젝트 격리: 항상 projectId로 필터).
 */
export async function getProjectExecutionSummary(
  projectId: string
): Promise<ProjectExecutionSummary | null> {
  if (!(await projectIdExists(projectId))) {
    return null;
  }

  const totalGcr = await prisma.gitChangeRequest.count({
    where: { projectId },
  });

  const rows = await prisma.gitChangeRequest.groupBy({
    by: ["applyStatus"],
    where: { projectId },
    _count: { _all: true },
  });

  const byApplyStatus: Record<string, number> = {};
  for (const row of rows) {
    const key = row.applyStatus ?? "null";
    byApplyStatus[key] = row._count._all;
  }

  const applyingNow = await prisma.gitChangeRequest.count({
    where: { projectId, applyStatus: "APPLYING" },
  });

  const [tasksTotal, runsTotal] = await Promise.all([
    countTasksByProjectId(projectId),
    countTaskRunsByProjectId(projectId),
  ]);

  return {
    projectId,
    gitChangeRequests: {
      total: totalGcr,
      byApplyStatus,
      applyingNow,
    },
    tasks: { total: tasksTotal },
    taskRuns: { total: runsTotal },
    queue: getExecutionQueueStubStatus(),
  };
}

export { GIT_APPLY_ERROR_CODES };
