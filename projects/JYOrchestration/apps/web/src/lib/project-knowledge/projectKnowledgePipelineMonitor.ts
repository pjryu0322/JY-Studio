import {
  appendPipelineStep,
  completePipelineRun,
  createPipelineRun,
  failPipelineRun,
  findLatestPipelineRun,
  findPipelineRuns,
  loadPipelineRunById,
  mapPipelineRunRow,
} from "@/lib/project-knowledge/projectKnowledgePipelineRepository";
import {
  memoryAppendKnowledgePipelineStep,
  memoryCompleteKnowledgePipelineRun,
  memoryGetLatestKnowledgePipelineRun,
  memoryListKnowledgePipelineRuns,
  memoryStartKnowledgePipelineRun,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorMemory";
import type {
  KnowledgePipelineRunRecord,
  KnowledgePipelineStage,
  PipelineRunMetricsInput,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

export type {
  KnowledgePipelineRunRecord,
  KnowledgePipelineRunStatus,
  KnowledgePipelineStage,
  KnowledgePipelineStepRecord,
  PipelineRunMetricsInput,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";
export { pipelineStepsToActivityItems, STAGE_USER_LABELS } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

const dbRunIds = new Set<string>();

export function isPersistedPipelineRunId(runId: string): boolean {
  return dbRunIds.has(runId);
}

export async function startKnowledgePipelineRun(
  projectId: string,
  trigger: string,
): Promise<KnowledgePipelineRunRecord> {
  try {
    const row = await createPipelineRun(projectId, trigger);
    dbRunIds.add(row.id);
    return mapPipelineRunRow(row, []);
  } catch (error) {
    console.error("Knowledge pipeline run DB create failed, using memory fallback:", error);
    return memoryStartKnowledgePipelineRun(projectId, trigger);
  }
}

export async function appendKnowledgePipelineStep(
  runId: string,
  input: Readonly<{
    stage: KnowledgePipelineStage;
    title: string;
    summary?: string;
    ok?: boolean;
    durationMs?: number;
    sourceEventId?: string;
    sourceMessageId?: string;
    metadata?: Record<string, unknown>;
  }>,
): Promise<KnowledgePipelineRunRecord | null> {
  if (dbRunIds.has(runId)) {
    try {
      await appendPipelineStep(runId, input);
      return loadPipelineRunById(runId);
    } catch (error) {
      console.error("Knowledge pipeline step DB append failed:", error);
    }
  }
  return memoryAppendKnowledgePipelineStep(runId, input);
}

export async function completeKnowledgePipelineRun(
  runId: string,
  input?: Readonly<{ failed?: boolean; summary?: string; metrics?: PipelineRunMetricsInput }>,
): Promise<KnowledgePipelineRunRecord | null> {
  if (input?.failed) {
    return failKnowledgePipelineRun(runId, { errorMessage: input.summary, metrics: input.metrics });
  }

  if (dbRunIds.has(runId)) {
    try {
      await appendPipelineStep(runId, {
        stage: "COMPLETED",
        title: "Completed",
        summary: input?.summary,
        ok: true,
      });
      await completePipelineRun(runId, { metrics: input?.metrics, errorMessage: null });
      return loadPipelineRunById(runId);
    } catch (error) {
      console.error("Knowledge pipeline run DB complete failed:", error);
    }
  }
  return memoryCompleteKnowledgePipelineRun(runId, input);
}

export async function failKnowledgePipelineRun(
  runId: string,
  input?: Readonly<{ errorMessage?: string; metrics?: PipelineRunMetricsInput }>,
): Promise<KnowledgePipelineRunRecord | null> {
  if (dbRunIds.has(runId)) {
    try {
      await appendPipelineStep(runId, {
        stage: "FAILED",
        title: "Failed",
        summary: input?.errorMessage,
        ok: false,
      });
      await failPipelineRun(runId, input);
      return loadPipelineRunById(runId);
    } catch (error) {
      console.error("Knowledge pipeline run DB fail failed:", error);
    }
  }
  return memoryCompleteKnowledgePipelineRun(runId, {
    failed: true,
    summary: input?.errorMessage,
    metrics: input?.metrics,
  });
}

export async function getLatestKnowledgePipelineRun(
  projectId: string,
): Promise<KnowledgePipelineRunRecord | null> {
  try {
    const latest = await findLatestPipelineRun(projectId);
    if (latest) return latest;
  } catch (error) {
    console.error("Knowledge pipeline latest run DB read failed:", error);
  }
  return memoryGetLatestKnowledgePipelineRun(projectId);
}

export async function listKnowledgePipelineRuns(
  projectId: string,
  limit = 20,
): Promise<readonly KnowledgePipelineRunRecord[]> {
  try {
    const rows = await findPipelineRuns(projectId, limit);
    if (rows.length) return rows;
  } catch (error) {
    console.error("Knowledge pipeline runs DB list failed:", error);
  }
  return memoryListKnowledgePipelineRuns(projectId, limit);
}

/** @deprecated sync alias for tests migrating to async */
export function getLatestKnowledgePipelineRunSync(projectId: string): KnowledgePipelineRunRecord | null {
  return memoryGetLatestKnowledgePipelineRun(projectId);
}
