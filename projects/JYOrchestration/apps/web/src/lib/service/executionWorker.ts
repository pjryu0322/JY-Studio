/**
 * 실행 큐 워커: PENDING → RUNNING → DONE/FAILED.
 * git-apply 작업은 runGitApplyCoreFromBody에 위임한다.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  runGitApplyCoreFromBody,
  type RunGitApplyCoreBody,
  type RunGitApplyCoreResult,
} from "@/lib/git-apply/runApplyCore";
import { appendGitApplyAuditTrail } from "@/lib/service/taskHistoryService";

export type GitApplyExecutionPayload = RunGitApplyCoreBody & {
  actorUserId: string;
};

function serializeApplyResult(r: RunGitApplyCoreResult): Prisma.InputJsonValue {
  if (r.ok) {
    return {
      ok: true,
      data: {
        id: r.data.id,
        branchName: r.data.branchName,
        applyStatus: r.data.applyStatus,
        applyLog: r.data.applyLog,
        applyStartedAt: r.data.applyStartedAt?.toISOString() ?? null,
        applyFinishedAt: r.data.applyFinishedAt?.toISOString() ?? null,
        lastRetryAt: r.data.lastRetryAt?.toISOString() ?? null,
        retryCount: r.data.retryCount,
        lastError: r.data.lastError,
        mode: r.data.mode,
      },
      message: r.message,
      githubPr: r.githubPr,
    };
  }
  return {
    ok: false,
    code: r.code,
    message: r.message,
    httpStatus: r.httpStatus,
  };
}

async function runGitApplyJob(jobId: string, payload: unknown): Promise<void> {
  const p = payload as GitApplyExecutionPayload;
  const body: RunGitApplyCoreBody = {
    gitChangeRequestId: p.gitChangeRequestId,
    mode: p.mode,
    options: p.options,
    retry: p.retry === true,
  };

  const gitChangeRequestId = String(p.gitChangeRequestId ?? "").trim();
  const gcrBefore = await prisma.gitChangeRequest.findUnique({
    where: { id: gitChangeRequestId },
    select: {
      projectId: true,
      taskId: true,
      retryCount: true,
      lastError: true,
    },
  });

  const retryCountBeforeApply = gcrBefore?.retryCount ?? 0;
  const lastErrorBeforeApply = gcrBefore?.lastError ?? null;
  const isRetry = body.retry === true;
  const modeStr = String(body.mode ?? "mock").trim() || "mock";

  const result = await runGitApplyCoreFromBody(body);

  const afterRow = await prisma.gitChangeRequest.findUnique({
    where: { id: gitChangeRequestId },
    select: {
      applyStartedAt: true,
      applyStatus: true,
      branchName: true,
      applyLog: true,
      retryCount: true,
      lastError: true,
    },
  });

  if (afterRow && gcrBefore && p.actorUserId) {
    await appendGitApplyAuditTrail({
      actorUserId: p.actorUserId,
      projectId: gcrBefore.projectId,
      taskId: gcrBefore.taskId,
      mode: result.ok ? String(result.data.mode) : modeStr,
      isRetry,
      retryCountBeforeApply,
      lastErrorBeforeApply,
      afterRow,
      applyOk: result.ok,
      errorCode: result.ok ? undefined : result.code,
    });
  }

  const serialized = serializeApplyResult(result);

  if (result.ok) {
    await prisma.executionJob.update({
      where: { id: jobId },
      data: {
        status: "DONE",
        finishedAt: new Date(),
        result: serialized,
        error: null,
      },
    });
  } else {
    await prisma.executionJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        result: serialized,
        error: result.message,
      },
    });
  }
}

/**
 * 특정 job만 처리 (API 요청과 1:1로 매칭할 때 사용).
 */
export async function processExecutionJobById(jobId: string): Promise<void> {
  const claimed = await prisma.executionJob.updateMany({
    where: { id: jobId, status: "PENDING" },
    data: { status: "RUNNING", startedAt: new Date() },
  });
  if (claimed.count !== 1) {
    return;
  }

  const job = await prisma.executionJob.findUnique({
    where: { id: jobId },
  });
  if (!job) {
    return;
  }

  try {
    switch (job.type) {
      case "git-apply":
        await runGitApplyJob(job.id, job.payload);
        break;
      case "pipeline":
      case "cursor":
        await prisma.executionJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            error: `Job type "${job.type}" is not implemented yet`,
          },
        });
        break;
      default:
        await prisma.executionJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            error: `Unknown job type: ${job.type}`,
          },
        });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("processExecutionJobById:", e);
    await prisma.executionJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: msg,
      },
    });
  }
}

/**
 * 대기 중인 작업을 순서대로 최대 maxJobs건 처리 (배치/크론용).
 */
export async function processExecutionQueue(maxJobs = 10): Promise<number> {
  let processed = 0;
  for (let i = 0; i < maxJobs; i++) {
    const next = await prisma.executionJob.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!next) {
      break;
    }
    await processExecutionJobById(next.id);
    processed++;
  }
  return processed;
}
