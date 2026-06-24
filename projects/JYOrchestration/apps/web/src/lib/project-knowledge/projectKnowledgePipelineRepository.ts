import type {
  ProjectKnowledgePipelineRun,
  ProjectKnowledgePipelineStep,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  KnowledgePipelineRunRecord,
  KnowledgePipelineStage,
  KnowledgePipelineStepRecord,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

export type PipelineRunMetrics = Readonly<{
  eventCount?: number;
  candidateCount?: number;
  nodeCount?: number;
  edgeCount?: number;
}>;

function mapStep(row: ProjectKnowledgePipelineStep): KnowledgePipelineStepRecord {
  const ok = row.status !== "FAILED";
  return {
    id: row.id,
    stage: row.stage as KnowledgePipelineStage,
    title: row.title,
    summary: row.summary ?? undefined,
    occurredAt: row.completedAt?.toISOString() ?? row.startedAt.toISOString(),
    ok,
    durationMs: row.durationMs ?? undefined,
    status: row.status,
  };
}

export function mapPipelineRunRow(
  run: ProjectKnowledgePipelineRun,
  steps: readonly ProjectKnowledgePipelineStep[],
): KnowledgePipelineRunRecord {
  const sorted = [...steps].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const lastStage = sorted[sorted.length - 1]?.stage as KnowledgePipelineStage | undefined;
  return {
    id: run.id,
    projectId: run.projectId,
    trigger: run.triggerType,
    status: run.status as KnowledgePipelineRunRecord["status"],
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString(),
    durationMs: run.durationMs ?? undefined,
    currentStage: lastStage ?? "EVENT_SYNC",
    steps: sorted.map(mapStep),
    eventCount: run.eventCount ?? undefined,
    candidateCount: run.candidateCount ?? undefined,
    nodeCount: run.nodeCount ?? undefined,
    edgeCount: run.edgeCount ?? undefined,
    errorMessage: run.errorMessage ?? undefined,
  };
}

export async function createPipelineRun(projectId: string, triggerType: string) {
  return prisma.projectKnowledgePipelineRun.create({
    data: {
      projectId: projectId.trim(),
      triggerType: triggerType.trim() || "unknown",
      status: "RUNNING",
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
  const status = input.ok === false ? "FAILED" : "SUCCESS";
  const now = new Date();
  return prisma.projectKnowledgePipelineStep.create({
    data: {
      runId,
      stage: input.stage,
      status,
      title: input.title,
      summary: input.summary ?? null,
      sourceEventId: input.sourceEventId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      metadata: input.metadata ?? undefined,
      startedAt: now,
      completedAt: now,
      durationMs: input.durationMs ?? null,
    },
  });
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
      eventCount: input?.metrics?.eventCount ?? undefined,
      candidateCount: input?.metrics?.candidateCount ?? undefined,
      nodeCount: input?.metrics?.nodeCount ?? undefined,
      edgeCount: input?.metrics?.edgeCount ?? undefined,
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
      eventCount: input?.metrics?.eventCount ?? undefined,
      candidateCount: input?.metrics?.candidateCount ?? undefined,
      nodeCount: input?.metrics?.nodeCount ?? undefined,
      edgeCount: input?.metrics?.edgeCount ?? undefined,
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
