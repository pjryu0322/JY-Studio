/**
 * Runtime dashboard snapshot (ExecutionRun-centric observability).
 */

import { readFile } from "node:fs/promises";
import { readTeamExecutionStatus } from "@/lib/ai-team-runtime/persist";
import { isTaskProgressLogEnabled } from "@/lib/observability/taskProgressLog";
import { prisma } from "@/lib/prisma";
import { isRuntimeEventCompatExecutionLogEnabled } from "@/lib/runtime/runtimeEventPersistence";
import { listRuntimeEventsForExecRun } from "@/lib/runtime/runtimeEventRepository";
import { dedupeRuntimeTimelineRows } from "@/lib/runtime/runtimeTimelineDedupe";
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

function detailRecord(detail: unknown): Record<string, unknown> | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  return detail as Record<string, unknown>;
}

export function isRuntimeTimelineIncludeLegacyTaskEventsEnabled(): boolean {
  return process.env.RUNTIME_TIMELINE_INCLUDE_LEGACY_TASK_EVENTS === "1";
}

/** Strict execRun-scoped timeline rows (runtime events + holder-job persistence). */
export function isRuntimeTimelineEventForExecRun(detail: unknown, execRunId: string): boolean {
  const d = detailRecord(detail);
  if (!d) return false;
  if (d.execRunId !== execRunId) return false;
  if (d.runtimeTimeline === true) return true;
  if (typeof d.eventType === "string" && d.eventType.length > 0) return true;
  return false;
}

function isLegacyTaskTimelineFallback(detail: unknown, execRunId: string): boolean {
  if (!isRuntimeTimelineIncludeLegacyTaskEventsEnabled()) return false;
  const d = detailRecord(detail);
  if (!d) return false;
  const id = d.execRunId;
  return typeof id === "string" ? id === execRunId : false;
}

export function inferPhaseAndWorkerFromEventType(eventType: string): {
  phase: string;
  worker: string | null;
} {
  if (eventType.startsWith("SELF_HEALING") || eventType.startsWith("AUTO_HEALING")) {
    return { phase: "SELF_HEALING", worker: "self-healing" };
  }
  if (
    eventType === "CURSOR_PIPELINE_CHAINED" ||
    eventType === "CURSOR_PIPELINE_CHAIN_SKIPPED" ||
    eventType === "CURSOR_PIPELINE_CHAIN_PROCESS_FAILED"
  ) {
    return { phase: "PIPELINE", worker: "cursor" };
  }
  if (eventType === "CURSOR_STARTED") return { phase: "CURSOR", worker: "cursor" };
  if (eventType === "CURSOR_COMPLETED") return { phase: "REFLECTION", worker: "cursor" };
  if (eventType === "CURSOR_FAILED") return { phase: "CURSOR", worker: "cursor" };
  if (eventType.startsWith("REVIEW_")) return { phase: "REVIEW", worker: "pipeline:reviewer" };
  if (eventType.startsWith("SECURITY_")) return { phase: "SECURITY", worker: "pipeline:security" };
  if (eventType.startsWith("SCM_")) return { phase: "SCM", worker: "pipeline:scm" };
  if (eventType.startsWith("MERGE_")) return { phase: "MERGE", worker: "pipeline:merge" };
  if (eventType.startsWith("PIPELINE_")) return { phase: "PIPELINE", worker: "pipeline" };
  return { phase: "RUNTIME", worker: null };
}

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

  const runtimeEventRows = await listRuntimeEventsForExecRun({ execRunId, limit });

  const eventRows = isRuntimeEventCompatExecutionLogEnabled()
    ? await prisma.executionEventLog.findMany({
    where: { taskId: run.taskId, projectId: run.projectId },
    orderBy: { createdAt: "desc" },
    take: limit * 3,
    select: {
      createdAt: true,
      message: true,
      stage: true,
      status: true,
      executionJobId: true,
      detailJson: true,
    },
  })
    : [];

  const dbRows: RuntimeTimelineRow[] = eventRows
    .filter((r) => {
      if (isRuntimeTimelineEventForExecRun(r.detailJson, execRunId)) return true;
      return isLegacyTaskTimelineFallback(r.detailJson, execRunId);
    })
    .map((r) => {
      const detail = r.detailJson as { eventType?: string; workerName?: string | null } | null;
      return {
        createdAt: r.createdAt.toISOString(),
        source: "execution_event" as const,
        eventType: detail?.eventType ?? r.message ?? r.stage ?? "execution_event",
        status: r.status ?? undefined,
        workerName: detail?.workerName ?? null,
        message: r.message,
        detail: r.detailJson,
      };
    })
    .slice(0, limit);

  const progressRows = isTaskProgressLogEnabled()
    ? await readProgressLogTimelineForExecRun(execRunId, run.taskId, limit)
    : [];

  const merged = dedupeRuntimeTimelineRows([
    ...runtimeEventRows,
    ...memoryRows,
    ...progressRows,
    ...dbRows,
  ]);
  merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return merged.slice(-limit);
}

function inferSnapshotPhaseFromRun(
  run: {
    status: string;
    prStatus: string | null;
    evaluationDecision: string | null;
  },
  teamStatus: string | null,
  lastEventType: string | null
): { phase: string; worker: string | null } {
  if (lastEventType) {
    const fromEvent = inferPhaseAndWorkerFromEventType(lastEventType);
    if (fromEvent.phase !== "RUNTIME") {
      return fromEvent;
    }
  }
  if (run.status === "running") return { phase: "CURSOR", worker: "cursor" };
  if (run.status === "reviewing") return { phase: "REVIEW", worker: "pipeline:reviewer" };
  if (teamStatus?.includes("merge")) return { phase: "SCM", worker: "pipeline:scm" };
  if (run.prStatus === "merged") return { phase: "MERGED", worker: null };
  if (run.status === "failed") return { phase: "FAILED", worker: null };
  return { phase: run.status, worker: null };
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
  const lastEventType = lastTimeline?.eventType ?? null;

  const { phase: currentPhase, worker: currentWorker } = inferSnapshotPhaseFromRun(
    run,
    teamStatus,
    lastEventType
  );

  return {
    execRunId: run.id,
    taskId: run.taskId,
    projectId: run.projectId,
    currentPhase,
    currentWorker,
    currentExecutionRunStatus: run.status,
    teamExecutionStatus: teamStatus,
    retryCount: run.retryCount,
    lastRuntimeEvent: lastEventType,
    reviewerResult: run.evaluationDecision,
    securityResult: teamStatus?.includes("security") ? teamStatus : null,
    scmResult: run.prStatus,
    mergeResult: run.prStatus === "merged" ? "merged" : run.pushStatus,
    timelineCount: timeline.length,
    lastEventAt: lastTimeline?.createdAt ?? null,
  };
}
