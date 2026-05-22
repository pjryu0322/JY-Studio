/**
 * Runtime dashboard snapshot (ExecutionRun-centric observability).
 */

import { readTeamExecutionStatus } from "@/lib/ai-team-runtime/persist";
import { prisma } from "@/lib/prisma";

export type RuntimeDashboardSnapshot = {
  readonly execRunId: string;
  readonly taskId: string;
  readonly projectId: string;
  readonly currentPhase: string;
  readonly currentWorker: string | null;
  readonly currentExecutionRunStatus: string;
  readonly teamExecutionStatus: string | null;
  readonly retryCount: number;
  readonly lastRuntimeEvent: string | null;
  readonly reviewerResult: string | null;
  readonly securityResult: string | null;
  readonly scmResult: string | null;
  readonly mergeResult: string | null;
};

export async function buildRuntimeDashboardSnapshot(execRunId: string): Promise<RuntimeDashboardSnapshot | null> {
  const run = await prisma.taskExecutionRun.findUnique({
    where: { id: execRunId },
    select: {
      id: true,
      taskId: true,
      projectId: true,
      status: true,
      retryCount: true,
      evaluationDecision: true,
      evaluationReason: true,
      prStatus: true,
      pushStatus: true,
      runError: true,
      teamExecutionStatus: true,
    },
  });
  if (!run) return null;

  const teamStatus = run.teamExecutionStatus ?? (await readTeamExecutionStatus(run.id));

  const lastLog = await prisma.executionEventLog.findFirst({
    where: { taskId: run.taskId },
    orderBy: { createdAt: "desc" },
    select: { message: true, stage: true, status: true },
  });

  const lastRuntimeEvent: string | null = lastLog?.message ?? lastLog?.stage ?? null;

  const currentPhase = (() => {
    if (run.status === "running") return "CURSOR";
    if (run.status === "reviewing") return "REVIEW";
    if (teamStatus?.includes("merge")) return "SCM";
    if (run.prStatus === "merged") return "MERGED";
    if (run.status === "failed") return "FAILED";
    return run.status;
  })();

  const currentWorker = (() => {
    if (run.status === "running") return "cursor";
    if (run.status === "reviewing") return "pipeline:reviewer";
    if (teamStatus === "merge_running") return "pipeline:scm";
    return null;
  })();

  return {
    execRunId: run.id,
    taskId: run.taskId,
    projectId: run.projectId,
    currentPhase,
    currentWorker,
    currentExecutionRunStatus: run.status,
    teamExecutionStatus: teamStatus,
    retryCount: run.retryCount,
    lastRuntimeEvent,
    reviewerResult: run.evaluationDecision,
    securityResult: teamStatus?.includes("security") ? teamStatus : null,
    scmResult: run.prStatus,
    mergeResult: run.prStatus === "merged" ? "merged" : run.pushStatus,
  };
}

export type RuntimeTimelineEntry = {
  readonly at: Date;
  readonly message: string | null;
  readonly stage: string | null;
  readonly status: string | null;
  readonly executionJobId: string | null;
};

/** Recent execution event log rows for a Task (execRun-scoped via taskId). */
export async function listRuntimeTimelineForExecRun(
  execRunId: string,
  limit = 40
): Promise<RuntimeTimelineEntry[]> {
  const run = await prisma.taskExecutionRun.findUnique({
    where: { id: execRunId },
    select: { taskId: true, projectId: true },
  });
  if (!run) return [];

  const rows = await prisma.executionEventLog.findMany({
    where: { taskId: run.taskId, projectId: run.projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      createdAt: true,
      message: true,
      stage: true,
      status: true,
      executionJobId: true,
    },
  });

  return rows.map((r) => ({
    at: r.createdAt,
    message: r.message,
    stage: r.stage,
    status: r.status,
    executionJobId: r.executionJobId,
  }));
}
