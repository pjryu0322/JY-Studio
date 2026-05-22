/**
 * Runtime dashboard snapshot (ExecutionRun-centric observability).
 */

import { readFile } from "node:fs/promises";
import { readTeamExecutionStatus } from "@/lib/ai-team-runtime/persist";
import { isTaskProgressLogEnabled } from "@/lib/observability/taskProgressLog";
import { prisma } from "@/lib/prisma";
import { getRuntimeTimelineFromStore } from "@/lib/runtime/runtimeTimelineStore";

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
  readonly timelineCount: number;
  readonly lastEventAt: string | null;
};

export type RuntimeTimelineRow = {
  readonly createdAt: string;
  readonly source: "execution_event" | "task_history" | "progress_log" | "runtime_event";
  readonly eventType: string;
  readonly status?: string;
  readonly workerName?: string | null;
  readonly message?: string | null;
  readonly detail?: unknown;
};

async function readProgressLogTimelineForExecRun(
  execRunId: string,
  taskId: string,
  limit: number
): Promise<RuntimeTimelineRow[]> {
  const path = process.env.JY_TASK_PROGRESS_LOG_FILE?.trim();
  if (!path) return [];
  try {
    const raw = await readFile(path, "utf8");
    const rows: RuntimeTimelineRow[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as {
          ts?: string;
          phase?: string;
          taskId?: string;
          detail?: { execRunId?: string; eventType?: string; workerName?: string | null };
        };
        if (parsed.taskId !== taskId) continue;
        const detailExec = parsed.detail?.execRunId;
        if (detailExec && detailExec !== execRunId) continue;
        rows.push({
          createdAt: parsed.ts ?? new Date().toISOString(),
          source: "progress_log",
          eventType: parsed.detail?.eventType ?? parsed.phase ?? "progress",
          workerName: parsed.detail?.workerName ?? null,
          message: parsed.phase ?? null,
          detail: parsed.detail,
        });
      } catch {
        // skip malformed line
      }
    }
    return rows.slice(-limit);
  } catch {
    return [];
  }
}

export async function listRuntimeTimelineForExecRun(
  execRunId: string,
  limit = 40
): Promise<RuntimeTimelineRow[]> {
  const run = await prisma.taskExecutionRun.findUnique({
    where: { id: execRunId },
    select: { taskId: true, projectId: true, createdAt: true },
  });
  if (!run) return [];

  const memoryRows: RuntimeTimelineRow[] = getRuntimeTimelineFromStore(execRunId).map((r) => ({
    createdAt: r.createdAt,
    source: r.source,
    eventType: r.eventType,
    status: r.status,
    workerName: r.workerName,
    message: r.message,
    detail: r.detail,
  }));

  const eventRows = await prisma.executionEventLog.findMany({
    where: { taskId: run.taskId, projectId: run.projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      createdAt: true,
      message: true,
      stage: true,
      status: true,
      executionJobId: true,
      detailJson: true,
    },
  });

  const dbRows: RuntimeTimelineRow[] = eventRows.map((r) => ({
    createdAt: r.createdAt.toISOString(),
    source: "execution_event" as const,
    eventType: r.message ?? r.stage ?? "execution_event",
    status: r.status ?? undefined,
    workerName: null,
    message: r.message,
    detail: r.detailJson,
  }));

  const progressRows = isTaskProgressLogEnabled()
    ? await readProgressLogTimelineForExecRun(execRunId, run.taskId, limit)
    : [];

  const merged = [...memoryRows, ...progressRows, ...dbRows];
  merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return merged.slice(-limit);
}

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
  const timeline = await listRuntimeTimelineForExecRun(execRunId, 40);
  const lastTimeline = timeline.length > 0 ? timeline[timeline.length - 1] : null;

  const lastLog = await prisma.executionEventLog.findFirst({
    where: { taskId: run.taskId },
    orderBy: { createdAt: "desc" },
    select: { message: true, stage: true, status: true },
  });

  const lastRuntimeEvent: string | null =
    lastTimeline?.eventType ?? lastLog?.message ?? lastLog?.stage ?? null;

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
    timelineCount: timeline.length,
    lastEventAt: lastTimeline?.createdAt ?? null,
  };
}
