import {
  appendPipelineStep,
  completePipelineRun,
  completePipelineStep,
  createPipelineRun,
  createPipelineStep,
  failPipelineRun,
  failPipelineStep,
  findLatestPipelineRun,
  findPipelineRuns,
  loadPipelineRunById,
  mapPipelineRunRow,
} from "@/lib/project-knowledge/projectKnowledgePipelineRepository";
import {
  memoryAppendKnowledgePipelineStep,
  memoryCompleteKnowledgePipelineRun,
  memoryCompleteKnowledgePipelineStep,
  memoryFailKnowledgePipelineStep,
  memoryGetLatestKnowledgePipelineRun,
  memoryListKnowledgePipelineRuns,
  memoryStartKnowledgePipelineRun,
  memoryStartKnowledgePipelineStep,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorMemory";
import type {
  KnowledgePipelineRunRecord,
  KnowledgePipelineStage,
  PipelineRunMetricsInput,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

export type {
  KnowledgePipelinePersistenceMode,
  KnowledgePipelineRunRecord,
  KnowledgePipelineRunStatus,
  KnowledgePipelineStage,
  KnowledgePipelineStepRecord,
  KnowledgePipelineStepStatus,
  PipelineRunMetricsInput,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";
export {
  pipelineStepsToActivityItems,
  STAGE_USER_LABELS,
  normalizePipelineRunMetrics,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

const dbRunIds = new Set<string>();

export function isPersistedPipelineRunId(runId: string): boolean {
  return dbRunIds.has(runId);
}

function isMemoryPipelineStepId(stepId: string): boolean {
  return stepId.startsWith("run:") && stepId.includes(":step:");
}

export async function startKnowledgePipelineRun(
  projectId: string,
  trigger: string,
): Promise<KnowledgePipelineRunRecord> {
  try {
    const row = await createPipelineRun(projectId, trigger, "DATABASE");
    dbRunIds.add(row.id);
    return mapPipelineRunRow(row, []);
  } catch (error) {
    console.error("Knowledge pipeline run DB create failed, using memory fallback:", error);
    return memoryStartKnowledgePipelineRun(projectId, trigger, "MEMORY_FALLBACK");
  }
}

export async function startKnowledgePipelineStep(
  runId: string,
  input: Readonly<{
    stage: KnowledgePipelineStage;
    title: string;
    sourceEventId?: string;
    sourceMessageId?: string;
  }>,
): Promise<string | null> {
  if (dbRunIds.has(runId)) {
    try {
      const row = await createPipelineStep(runId, input);
      return row.id;
    } catch (error) {
      console.error("Knowledge pipeline step DB create failed:", error);
    }
  }
  return memoryStartKnowledgePipelineStep(runId, input);
}

export async function completeKnowledgePipelineStep(
  stepId: string,
  input?: Readonly<{ summary?: string; durationMs?: number }>,
): Promise<void> {
  if (!isMemoryPipelineStepId(stepId)) {
    try {
      await completePipelineStep(stepId, input);
      return;
    } catch (error) {
      console.error("Knowledge pipeline step DB complete failed:", error);
    }
  }
  memoryCompleteKnowledgePipelineStep(stepId, input);
}

export async function failKnowledgePipelineStep(
  stepId: string,
  input?: Readonly<{ summary?: string; durationMs?: number }>,
): Promise<void> {
  if (!isMemoryPipelineStepId(stepId)) {
    try {
      await failPipelineStep(stepId, input);
      return;
    } catch (error) {
      console.error("Knowledge pipeline step DB fail failed:", error);
    }
  }
  memoryFailKnowledgePipelineStep(stepId, input);
}

/** @deprecated use startKnowledgePipelineStep + complete/fail */
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

async function finishTerminalRunStep(
  runId: string,
  input: Readonly<{ stage: "COMPLETED" | "FAILED"; title: string; summary?: string; ok: boolean }>,
): Promise<void> {
  const stepId = await startKnowledgePipelineStep(runId, {
    stage: input.stage,
    title: input.title,
  });
  if (!stepId) return;
  if (input.ok) {
    await completeKnowledgePipelineStep(stepId, { summary: input.summary });
  } else {
    await failKnowledgePipelineStep(stepId, { summary: input.summary });
  }
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
      await finishTerminalRunStep(runId, {
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
      await finishTerminalRunStep(runId, {
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
