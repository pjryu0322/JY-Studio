import type {
  ProjectKnowledgePipelineRun,
  ProjectKnowledgePipelineStep,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  KnowledgePipelinePersistenceMode,
  KnowledgePipelineRunRecord,
  KnowledgePipelineStage,
  KnowledgePipelineStepRecord,
  PipelineRunMetricsInput,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";
import { normalizePipelineRunMetrics } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

export type PipelineRunMetrics = PipelineRunMetricsInput;

function mapStep(row: ProjectKnowledgePipelineStep): KnowledgePipelineStepRecord {
  const status = row.status as KnowledgePipelineStepRecord["status"];
  const ok = status === "SUCCESS";
  const startedAt = row.startedAt.toISOString();
  return {
    id: row.id,
    stage: row.stage as KnowledgePipelineStage,
    title: row.title,
    summary: row.summary ?? undefined,
    startedAt,
    occurredAt: row.completedAt?.toISOString() ?? startedAt,
    ok,
    durationMs: row.durationMs ?? undefined,
    status,
  };
}

function metricsToDbData(metrics?: PipelineRunMetricsInput) {
  const m = normalizePipelineRunMetrics(metrics);
  if (!m) return {};
  return {
    eventCount: m.eventCount ?? undefined,
    candidateNodeCount: m.candidateNodeCount ?? undefined,
    candidateEdgeCount: m.candidateEdgeCount ?? undefined,
    graphNodeCount: m.graphNodeCount ?? undefined,
    graphEdgeCount: m.graphEdgeCount ?? undefined,
    candidateCount: m.candidateCount ?? m.candidateNodeCount ?? undefined,
    nodeCount: m.nodeCount ?? m.graphNodeCount ?? undefined,
    edgeCount: m.edgeCount ?? m.graphEdgeCount ?? undefined,
  };
}

export function mapPipelineRunRow(
  run: ProjectKnowledgePipelineRun,
  steps: readonly ProjectKnowledgePipelineStep[],
): KnowledgePipelineRunRecord {
  const sorted = [...steps].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const lastStage = sorted[sorted.length - 1]?.stage as KnowledgePipelineStage | undefined;
  const persistenceMode = (run.persistenceMode ?? "DATABASE") as KnowledgePipelinePersistenceMode;
  return {
    id: run.id,
    projectId: run.projectId,
    trigger: run.triggerType,
    status: run.status as KnowledgePipelineRunRecord["status"],
    persistenceMode,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString(),
    durationMs: run.durationMs ?? undefined,
    currentStage: lastStage ?? "EVENT_SYNC",
    steps: sorted.map(mapStep),
    eventCount: run.eventCount ?? undefined,
    candidateCount: run.candidateCount ?? run.candidateNodeCount ?? undefined,
    nodeCount: run.nodeCount ?? run.graphNodeCount ?? undefined,
    edgeCount: run.edgeCount ?? run.graphEdgeCount ?? undefined,
    candidateNodeCount: run.candidateNodeCount ?? run.candidateCount ?? undefined,
    candidateEdgeCount: run.candidateEdgeCount ?? undefined,
    graphNodeCount: run.graphNodeCount ?? run.nodeCount ?? undefined,
    graphEdgeCount: run.graphEdgeCount ?? run.edgeCount ?? undefined,
    errorMessage: run.errorMessage ?? undefined,
  };
}

export async function createPipelineRun(
  projectId: string,
  triggerType: string,
  persistenceMode: KnowledgePipelinePersistenceMode = "DATABASE",
) {
  return prisma.projectKnowledgePipelineRun.create({
    data: {
      projectId: projectId.trim(),
      triggerType: triggerType.trim() || "unknown",
      status: "RUNNING",
      persistenceMode,
    },
  });
}

export async function createPipelineStep(
  runId: string,
  input: Readonly<{
    stage: string;
    title: string;
    sourceEventId?: string;
    sourceMessageId?: string;
    metadata?: Record<string, unknown>;
  }>,
) {
  return prisma.projectKnowledgePipelineStep.create({
    data: {
      runId,
      stage: input.stage,
      status: "RUNNING",
      title: input.title,
      sourceEventId: input.sourceEventId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      metadata: input.metadata ?? undefined,
      startedAt: new Date(),
      completedAt: null,
      durationMs: null,
    },
  });
}

export async function completePipelineStep(
  stepId: string,
  input?: Readonly<{ summary?: string; durationMs?: number }>,
) {
  const step = await prisma.projectKnowledgePipelineStep.findUnique({ where: { id: stepId } });
  if (!step) return null;
  const completedAt = new Date();
  const durationMs =
    input?.durationMs ?? Math.max(0, completedAt.getTime() - step.startedAt.getTime());
  return prisma.projectKnowledgePipelineStep.update({
    where: { id: stepId },
    data: {
      status: "SUCCESS",
      summary: input?.summary ?? step.summary,
      completedAt,
      durationMs,
    },
  });
}

export async function failPipelineStep(
  stepId: string,
  input?: Readonly<{ summary?: string; durationMs?: number }>,
) {
  const step = await prisma.projectKnowledgePipelineStep.findUnique({ where: { id: stepId } });
  if (!step) return null;
  const completedAt = new Date();
  const durationMs =
    input?.durationMs ?? Math.max(0, completedAt.getTime() - step.startedAt.getTime());
  return prisma.projectKnowledgePipelineStep.update({
    where: { id: stepId },
    data: {
      status: "FAILED",
      summary: input?.summary ?? step.summary,
      completedAt,
      durationMs,
    },
  });
}

export async function appendPipelineStep(
  runId: string,
  input: Readonly<{
    stage: string;
    title: string;
    summary?: string;
    ok?: boolean;
    durationMs?: number;
    sourceEventId?: string;
    sourceMessageId?: string;
    metadata?: Record<string, unknown>;
  }>,
) {
  const created = await createPipelineStep(runId, input);
  if (input.ok === false) {
    await failPipelineStep(created.id, { summary: input.summary, durationMs: input.durationMs });
  } else {
    await completePipelineStep(created.id, { summary: input.summary, durationMs: input.durationMs });
  }
  return created;
}

export async function completePipelineRun(
  runId: string,
  input?: Readonly<{
    metrics?: PipelineRunMetrics;
    errorMessage?: string | null;
  }>,
) {
  const run = await prisma.projectKnowledgePipelineRun.findUnique({ where: { id: runId } });
  if (!run) return null;
  const completedAt = new Date();
  const durationMs = Math.max(0, completedAt.getTime() - run.startedAt.getTime());
  return prisma.projectKnowledgePipelineRun.update({
    where: { id: runId },
    data: {
      status: "COMPLETED",
      completedAt,
      durationMs,
      errorMessage: input?.errorMessage ?? null,
      ...metricsToDbData(input?.metrics),
    },
  });
}

export async function failPipelineRun(
  runId: string,
  input?: Readonly<{ errorMessage?: string; metrics?: PipelineRunMetrics }>,
) {
  const run = await prisma.projectKnowledgePipelineRun.findUnique({ where: { id: runId } });
  if (!run) return null;
  const completedAt = new Date();
  const durationMs = Math.max(0, completedAt.getTime() - run.startedAt.getTime());
  return prisma.projectKnowledgePipelineRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      completedAt,
      durationMs,
      errorMessage: input?.errorMessage ?? null,
      ...metricsToDbData(input?.metrics),
    },
  });
}

export async function findLatestPipelineRun(projectId: string): Promise<KnowledgePipelineRunRecord | null> {
  const row = await prisma.projectKnowledgePipelineRun.findFirst({
    where: { projectId: projectId.trim() },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });
  if (!row) return null;
  return mapPipelineRunRow(row, row.steps);
}

export async function findPipelineRuns(
  projectId: string,
  limit = 20,
): Promise<readonly KnowledgePipelineRunRecord[]> {
  const rows = await prisma.projectKnowledgePipelineRun.findMany({
    where: { projectId: projectId.trim() },
    orderBy: { startedAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
    include: { steps: true },
  });
  return rows.map((r) => mapPipelineRunRow(r, r.steps));
}

export async function loadPipelineRunById(runId: string): Promise<KnowledgePipelineRunRecord | null> {
  const row = await prisma.projectKnowledgePipelineRun.findUnique({
    where: { id: runId },
    include: { steps: true },
  });
  if (!row) return null;
  return mapPipelineRunRow(row, row.steps);
}
