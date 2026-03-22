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
import type { ProjectObservabilitySnapshot } from "@/lib/metrics/projectObservabilityTypes";

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

/**
 * 운영 관측용 스냅샷 (읽기 전용 집계). Task는 최신 Run 상태를 우선해 running/failed를 구분하고,
 * 그 외는 Task.status 기준으로 done/todo를 나눈다.
 */
export async function getProjectObservabilitySnapshot(
  projectId: string
): Promise<ProjectObservabilitySnapshot | null> {
  if (!(await projectIdExists(projectId))) {
    return null;
  }

  const [tasks, latestRuns, taskRunTotal, gitTotal, gitRows, retriedCount] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      select: { id: true, status: true },
    }),
    prisma.taskRun.findMany({
      where: { task: { projectId } },
      orderBy: [{ taskId: "asc" }, { createdAt: "desc" }],
      distinct: ["taskId"],
      select: { taskId: true, status: true },
    }),
    prisma.taskRun.count({ where: { task: { projectId } } }),
    prisma.gitChangeRequest.count({ where: { projectId } }),
    prisma.gitChangeRequest.findMany({
      where: { projectId },
      select: { status: true, applyStatus: true },
    }),
    prisma.gitChangeRequest.count({
      where: { projectId, retryCount: { gt: 0 } },
    }),
  ]);

  const latestByTask = new Map(latestRuns.map((r) => [r.taskId, r.status]));

  let todo = 0;
  let running = 0;
  let done = 0;
  let failed = 0;

  for (const t of tasks) {
    const runStatus = latestByTask.get(t.id);
    if (runStatus === "PENDING") {
      running += 1;
    } else if (runStatus === "FAILED") {
      failed += 1;
    } else if (t.status === "DONE") {
      done += 1;
    } else {
      todo += 1;
    }
  }

  let gitRequested = 0;
  let gitApplying = 0;
  let gitDone = 0;
  let gitFailed = 0;

  for (const row of gitRows) {
    const a = row.applyStatus ?? "PENDING";
    if (a === "APPLYING") {
      gitApplying += 1;
    } else if (a === "DONE") {
      gitDone += 1;
    } else if (a === "FAILED") {
      gitFailed += 1;
    } else {
      // PENDING·null 등 아직 반영 전·대기 중인 요청
      gitRequested += 1;
    }
  }

  return {
    task: {
      total: tasks.length,
      todo,
      running,
      done,
      failed,
    },
    taskRun: { total: taskRunTotal },
    git: {
      total: gitTotal,
      requested: gitRequested,
      applying: gitApplying,
      done: gitDone,
      failed: gitFailed,
    },
    retry: { total: retriedCount },
  };
}

export type { ProjectObservabilitySnapshot } from "@/lib/metrics/projectObservabilityTypes";

export { GIT_APPLY_ERROR_CODES };
