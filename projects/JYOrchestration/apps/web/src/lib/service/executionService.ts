/**
 * Git 반영 / 실행 관련 조회·적용 (projectId 스코프).
 * 기존 runGitApplyCoreFromBody 등 실행 코어는 그대로 위임만 한다.
 */
import type { Prisma } from "@prisma/client";
import {
  TaskHistoryActorType,
  TaskHistoryEventType,
} from "@/lib/history/taskHistoryConstants";
import { prisma } from "@/lib/prisma";
import { isManualGitApprovalMode } from "@/lib/git-apply/retry";
import {
  runGitApplyCoreFromBody,
  GIT_APPLY_ERROR_CODES,
  type RunGitApplyCoreResult,
} from "@/lib/git-apply/runApplyCore";
import { syncPullRequestStatus } from "@/lib/service/githubPullRequestService";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";
import { projectIdExists } from "@/lib/service/projectService";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import {
  countTaskRunsByProjectId,
  countTasksByProjectId,
} from "@/lib/service/taskService";
import {
  getExecutionQueueStatus,
  type ExecutionQueueStatusSnapshot,
} from "@/lib/service/executionQueue";
import type { ProjectObservabilitySnapshot } from "@/lib/metrics/projectObservabilityTypes";

export type GitApplyApiBody = {
  gitChangeRequestId?: string;
  mode?: string;
  options?: { push?: boolean; simulateFailure?: boolean };
  retry?: boolean;
  actorUserId?: string;
};

async function requireGitChangeRequestOwnedByUser(
  gitChangeRequestId: string,
  actorUserId: string,
  permission: "canRun" | "canApprove",
  action: string
): Promise<{ projectId: string; taskId: string; executionId: string | null }> {
  const row = await prisma.gitChangeRequest.findUnique({
    where: { id: gitChangeRequestId },
    select: { projectId: true, taskId: true },
  });
  if (!row) {
    throw new Error("GIT_CHANGE_REQUEST_NOT_FOUND");
  }
  await requireProjectPermission(row.projectId, actorUserId, permission, action);
  return { projectId: row.projectId, taskId: row.taskId, executionId: null };
}

/** GitHub PR 상태를 GCR에 반영 (수동 동기화·테스트) */
export async function syncGitChangeRequestPullRequestFromGithub(input: {
  gitChangeRequestId: string;
  actorUserId?: string | null;
}) {
  return syncPullRequestStatus(input);
}

/** git-apply GET과 동일 select / projectId 필터 */
export async function listGitChangeRequestsForProject(
  projectId: string,
  actorUserId?: string
) {
  if (actorUserId) {
    await requireProjectPermission(
      projectId,
      actorUserId,
      "canView",
      "executionService.listGitChangeRequestsForProject"
    );
  }
  const rows = await prisma.gitChangeRequest.findMany({
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
      rejectionReason: true,
      pullRequestUrl: true,
      pullRequestNumber: true,
      pullRequestState: true,
      reviewStatus: true,
      mergedAt: true,
      createdAt: true,
      updatedAt: true,
      project: { select: { gitApprovalMode: true, gitPushMode: true } },
    },
  });
  const jobRows = await prisma.executionJob.findMany({
    where: { projectId, type: "git-apply" },
    orderBy: { createdAt: "desc" },
    select: { id: true, payload: true },
  });
  const latestJobByGcrId = new Map<string, string>();
  for (const row of jobRows) {
    const payload = row.payload as { gitChangeRequestId?: unknown } | null;
    const gcrId = typeof payload?.gitChangeRequestId === "string" ? payload.gitChangeRequestId : null;
    if (!gcrId || latestJobByGcrId.has(gcrId)) {
      continue;
    }
    latestJobByGcrId.set(gcrId, row.id);
  }
  return rows.map((row) => ({
    ...row,
    latestExecutionJobId: latestJobByGcrId.get(row.id) ?? null,
  }));
}

export function serializeGitChangeRequestList(
  rows: Awaited<ReturnType<typeof listGitChangeRequestsForProject>>
) {
  return rows.map((item) => {
    const { project, ...rest } = item;
    return {
      ...rest,
      gitApprovalMode: project.gitApprovalMode,
      gitPushMode: project.gitPushMode,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      applyStartedAt: item.applyStartedAt?.toISOString() ?? null,
      applyFinishedAt: item.applyFinishedAt?.toISOString() ?? null,
      lastRetryAt: item.lastRetryAt?.toISOString() ?? null,
      mergedAt: item.mergedAt?.toISOString() ?? null,
    };
  });
}

/** git-apply POST 본문 → 코어 실행 (로직 변경 없음) */
export async function applyGitChangeFromApiBody(
  body: GitApplyApiBody
): Promise<RunGitApplyCoreResult> {
  const actorUserId = String(body.actorUserId ?? "").trim();
  if (actorUserId) {
    const gcrId = String(body.gitChangeRequestId ?? "").trim();
    if (!gcrId) {
      throw new Error("GIT_CHANGE_REQUEST_ID_REQUIRED");
    }
    await requireGitChangeRequestOwnedByUser(
      gcrId,
      actorUserId,
      "canRun",
      "executionService.applyGitChangeFromApiBody"
    );
  }
  return runGitApplyCoreFromBody({
    gitChangeRequestId: body.gitChangeRequestId,
    mode: body.mode,
    options: body.options,
    retry: body.retry === true,
  });
}

/**
 * 라우트 계층 승인 게이트 검사만 수행 (gitApprovalMode + GCR status).
 * 원격 push는 `gitPushMode`·`runGitApplyCoreFromBody`에서만 다룸.
 */
export function validateGitApplyPostEligibility(input: {
  isRetry: boolean;
  /** 승인 정책만; push 정책과 무관 */
  gitApprovalMode: string | null | undefined;
  status: string;
}): { code: string; message: string; httpStatus: number } | null {
  if (input.isRetry) {
    return null;
  }
  if (input.status === "APPROVAL_REQUIRED") {
    return {
      code: GIT_APPLY_ERROR_CODES.APPROVAL_NOT_GRANTED,
      message:
        "승인 대기 중입니다. 검토자가 승인한 뒤에만 Git 반영을 실행할 수 있습니다.",
      httpStatus: 403,
    };
  }
  if (input.status === "REJECTED") {
    return {
      code: GIT_APPLY_ERROR_CODES.APPROVAL_NOT_GRANTED,
      message: "반려된 요청은 Git 반영을 실행할 수 없습니다.",
      httpStatus: 403,
    };
  }
  const manual = isManualGitApprovalMode(input.gitApprovalMode);
  if (manual) {
    if (input.status !== "APPROVED") {
      return {
        code: GIT_APPLY_ERROR_CODES.APPROVAL_NOT_GRANTED,
        message: "승인(APPROVED)된 요청만 Git 반영을 실행할 수 있습니다.",
        httpStatus: 403,
      };
    }
  } else if (input.status !== "REQUESTED") {
    return {
      code: GIT_APPLY_ERROR_CODES.INVALID_STATUS,
      message:
        "승인 생략(NO_APPROVAL) 모드에서는 status가 REQUESTED인 요청만 Git 반영을 실행할 수 있습니다.",
      httpStatus: 400,
    };
  }
  return null;
}

/** TaskHistory에만 기록; 실패 시 로그만 (게이트 API는 본 업데이트는 유지). */
async function appendGitGateHistorySafe(input: {
  projectId: string;
  taskId: string;
  actorUserId: string;
  eventType: string;
  summary: string;
  detailJson: Prisma.InputJsonValue;
}) {
  try {
    await appendTaskHistory({
      projectId: input.projectId,
      taskId: input.taskId,
      actorType: TaskHistoryActorType.USER,
      actorId: input.actorUserId,
      eventType: input.eventType,
      summary: input.summary,
      detailJson: input.detailJson,
    });
  } catch (e) {
    console.error("appendGitGateHistorySafe failed:", e);
  }
}

export const GIT_GATE_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  INVALID_STATE: "INVALID_STATE",
} as const;

export type GitGateMutationResult =
  | {
      ok: true;
      data: {
        id: string;
        projectId: string;
        taskId: string;
        status: string;
        updatedAt: Date;
      };
    }
  | { ok: false; code: string; message: string; httpStatus: number };

/**
 * MANUAL_APPROVAL: REJECTED → APPROVAL_REQUIRED (승인 큐 재진입).
 * 신규 요청은 git-request에서 곧바로 APPROVAL_REQUIRED로 생성된다.
 */
export async function submitGitChangeRequestForApproval(input: {
  gitChangeRequestId: string;
  actorUserId: string;
}): Promise<GitGateMutationResult> {
  const id = String(input.gitChangeRequestId ?? "").trim();
  if (!id) {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.INVALID_REQUEST,
      message: "gitChangeRequestId가 필요합니다.",
      httpStatus: 400,
    };
  }

  try {
    await requireGitChangeRequestOwnedByUser(
      id,
      input.actorUserId,
      "canRun",
      "executionService.submitGitChangeRequestForApproval"
    );
  } catch {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.NOT_FOUND,
      message: "대상 Git 반영 요청을 찾을 수 없거나 접근 권한이 없습니다.",
      httpStatus: 403,
    };
  }

  const row = await prisma.gitChangeRequest.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      taskId: true,
      status: true,
      applyStatus: true,
    },
  });

  if (!row) {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.NOT_FOUND,
      message: "대상 Git 반영 요청을 찾을 수 없습니다.",
      httpStatus: 404,
    };
  }

  const projectForGate = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: { gitApprovalMode: true },
  });
  if (!isManualGitApprovalMode(projectForGate?.gitApprovalMode)) {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.INVALID_STATE,
      message:
        "이 프로젝트는 승인 생략(NO_APPROVAL) 모드입니다. 승인 API를 사용할 수 없습니다.",
      httpStatus: 400,
    };
  }

  if (row.status !== "REJECTED") {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.INVALID_STATE,
      message: "반려(REJECTED) 상태의 요청만 승인 재요청할 수 있습니다.",
      httpStatus: 400,
    };
  }

  if (row.applyStatus === "APPLYING" || row.applyStatus === "DONE") {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.INVALID_STATE,
      message: "반영 진행 중이거나 완료된 요청은 승인 요청을 다시 제출할 수 없습니다.",
      httpStatus: 400,
    };
  }

  const fromStatus = row.status;
  const updated = await prisma.gitChangeRequest.update({
    where: { id: row.id },
    data: { status: "APPROVAL_REQUIRED", rejectionReason: null },
    select: {
      id: true,
      projectId: true,
      taskId: true,
      status: true,
      updatedAt: true,
    },
  });

  await appendGitGateHistorySafe({
    projectId: updated.projectId,
    taskId: updated.taskId,
    actorUserId: input.actorUserId,
    eventType: TaskHistoryEventType.GIT_APPROVAL_REQUIRED,
    summary: "Git 반영 승인 재요청(승인 대기로 복귀)",
    detailJson: {
      gitChangeRequestId: updated.id,
      fromStatus,
      toStatus: updated.status,
    },
  });

  return { ok: true, data: updated };
}

/** APPROVAL_REQUIRED → APPROVED (Git 반영 실행 가능). */
export async function approveGitChangeRequest(input: {
  gitChangeRequestId: string;
  actorUserId: string;
}): Promise<GitGateMutationResult> {
  const id = String(input.gitChangeRequestId ?? "").trim();
  if (!id) {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.INVALID_REQUEST,
      message: "gitChangeRequestId가 필요합니다.",
      httpStatus: 400,
    };
  }

  try {
    await requireGitChangeRequestOwnedByUser(
      id,
      input.actorUserId,
      "canApprove",
      "executionService.approveGitChangeRequest"
    );
  } catch {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.NOT_FOUND,
      message: "대상 Git 반영 요청을 찾을 수 없거나 접근 권한이 없습니다.",
      httpStatus: 403,
    };
  }

  const row = await prisma.gitChangeRequest.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      taskId: true,
      status: true,
      applyStatus: true,
    },
  });

  if (!row) {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.NOT_FOUND,
      message: "대상 Git 반영 요청을 찾을 수 없습니다.",
      httpStatus: 404,
    };
  }

  const projectForGate = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: { gitApprovalMode: true },
  });
  if (!isManualGitApprovalMode(projectForGate?.gitApprovalMode)) {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.INVALID_STATE,
      message:
        "승인·반려는 수동 승인(MANUAL_APPROVAL) 모드 프로젝트에서만 사용할 수 있습니다.",
      httpStatus: 400,
    };
  }

  if (row.status !== "APPROVAL_REQUIRED") {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.INVALID_STATE,
      message: "승인 대기(APPROVAL_REQUIRED) 상태의 요청만 승인할 수 있습니다.",
      httpStatus: 400,
    };
  }

  if (row.applyStatus === "APPLYING" || row.applyStatus === "DONE") {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.INVALID_STATE,
      message: "이미 반영이 진행 중이거나 완료된 요청입니다.",
      httpStatus: 400,
    };
  }

  const updated = await prisma.gitChangeRequest.update({
    where: { id: row.id },
    data: { status: "APPROVED", rejectionReason: null },
    select: {
      id: true,
      projectId: true,
      taskId: true,
      status: true,
      updatedAt: true,
    },
  });

  await appendGitGateHistorySafe({
    projectId: updated.projectId,
    taskId: updated.taskId,
    actorUserId: input.actorUserId,
    eventType: TaskHistoryEventType.GIT_APPROVED,
    summary: "Git 반영 승인",
    detailJson: {
      gitChangeRequestId: updated.id,
      fromStatus: "APPROVAL_REQUIRED",
      toStatus: updated.status,
    },
  });

  return { ok: true, data: updated };
}

/** APPROVAL_REQUIRED → REJECTED */
export async function rejectGitChangeRequest(input: {
  gitChangeRequestId: string;
  actorUserId: string;
  reason?: string | null;
}): Promise<GitGateMutationResult> {
  const id = String(input.gitChangeRequestId ?? "").trim();
  if (!id) {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.INVALID_REQUEST,
      message: "gitChangeRequestId가 필요합니다.",
      httpStatus: 400,
    };
  }

  try {
    await requireGitChangeRequestOwnedByUser(
      id,
      input.actorUserId,
      "canApprove",
      "executionService.rejectGitChangeRequest"
    );
  } catch {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.NOT_FOUND,
      message: "대상 Git 반영 요청을 찾을 수 없거나 접근 권한이 없습니다.",
      httpStatus: 403,
    };
  }

  const row = await prisma.gitChangeRequest.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      taskId: true,
      status: true,
      applyStatus: true,
    },
  });

  if (!row) {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.NOT_FOUND,
      message: "대상 Git 반영 요청을 찾을 수 없습니다.",
      httpStatus: 404,
    };
  }

  const projectForGate = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: { gitApprovalMode: true },
  });
  if (!isManualGitApprovalMode(projectForGate?.gitApprovalMode)) {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.INVALID_STATE,
      message:
        "승인·반려는 수동 승인(MANUAL_APPROVAL) 모드 프로젝트에서만 사용할 수 있습니다.",
      httpStatus: 400,
    };
  }

  if (row.status !== "APPROVAL_REQUIRED") {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.INVALID_STATE,
      message: "승인 대기(APPROVAL_REQUIRED) 상태의 요청만 반려할 수 있습니다.",
      httpStatus: 400,
    };
  }

  if (row.applyStatus === "APPLYING" || row.applyStatus === "DONE") {
    return {
      ok: false,
      code: GIT_GATE_ERROR_CODES.INVALID_STATE,
      message: "이미 반영이 진행 중이거나 완료된 요청은 반려할 수 없습니다.",
      httpStatus: 400,
    };
  }

  const reason = String(input.reason ?? "").trim() || null;

  const updated = await prisma.gitChangeRequest.update({
    where: { id: row.id },
    data: { status: "REJECTED", rejectionReason: reason },
    select: {
      id: true,
      projectId: true,
      taskId: true,
      status: true,
      updatedAt: true,
    },
  });

  await appendGitGateHistorySafe({
    projectId: updated.projectId,
    taskId: updated.taskId,
    actorUserId: input.actorUserId,
    eventType: TaskHistoryEventType.GIT_REJECTED,
    summary: "Git 반영 반려",
    detailJson: {
      gitChangeRequestId: updated.id,
      fromStatus: "APPROVAL_REQUIRED",
      toStatus: updated.status,
      reason,
    },
  });

  return { ok: true, data: updated };
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
  queue: ExecutionQueueStatusSnapshot;
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

  const [tasksTotal, runsTotal, queue] = await Promise.all([
    countTasksByProjectId(projectId),
    countTaskRunsByProjectId(projectId),
    getExecutionQueueStatus(projectId),
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
    queue,
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
      select: {
        status: true,
        applyStatus: true,
        pullRequestNumber: true,
        pullRequestState: true,
        mergedAt: true,
      },
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
  let prLinked = 0;
  let prOpen = 0;
  let prMerged = 0;

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
    if (row.pullRequestNumber != null) {
      prLinked += 1;
    }
    const prSt = String(row.pullRequestState ?? "").toUpperCase();
    if (prSt === "OPEN") {
      prOpen += 1;
    }
    if (prSt === "MERGED" || row.mergedAt != null) {
      prMerged += 1;
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
      pullRequest: {
        linked: prLinked,
        open: prOpen,
        merged: prMerged,
      },
    },
    retry: { total: retriedCount },
  };
}

export type { ProjectObservabilitySnapshot } from "@/lib/metrics/projectObservabilityTypes";

export { GIT_APPLY_ERROR_CODES };

/** Run→Git: 프로젝트 `autoCreateGitRequest` + 전역 env(JY_AUTO_GIT_REQUEST_AFTER_RUN) 보조 */
export {
  buildGitChangeRequestPayloadFromExecutionResult,
  buildGitChangeRequestPayloadFromTaskRun,
  createGitChangeRequestForTaskRun,
  createGitChangeRequestFromExecutionResult,
  GIT_CHANGE_REQUEST_FROM_RUN_CODES,
  isAutoGitRequestAfterRunEnabled,
} from "./gitChangeRequestFromTaskRun";
export type {
  CreateGitChangeRequestForTaskRunInput,
  CreateGitChangeRequestForTaskRunResult,
  CreateGitChangeRequestForTaskRunSource,
  CreateGitChangeRequestFromExecutionResultInput,
} from "./gitChangeRequestFromTaskRun";
export type { TaskRunExecutionResult } from "@/lib/integration/taskRunResultTypes";
