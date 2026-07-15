import { Prisma, type PipelineStatus, type PipelineStepStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PipelineStatusDto } from "@/lib/pipeline-dto";

export function logPipelineRecordFailure(
  functionName: string,
  context: {
    packId: string;
    triggerType: string;
    targetStatus: PipelineStatus;
    error: unknown;
  },
): void {
  const message = context.error instanceof Error ? context.error.message : String(context.error);
  console.error(`[pipeline] ${functionName} failed`, {
    packId: context.packId,
    triggerType: context.triggerType,
    targetStatus: context.targetStatus,
    error: message,
  });
}

function countBy<T extends string>(values: T[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) {
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

export async function getPackPipelineStatus(packId: string): Promise<PipelineStatusDto | null> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    include: {
      versions: {
        include: { sourceDocuments: true },
      },
    },
  });

  if (!pack) {
    return null;
  }

  const docs = pack.versions.flatMap((v) => v.sourceDocuments);

  const latestRun = await prisma.pipelineRun.findFirst({
    where: { packId },
    orderBy: { startedAt: "desc" },
    include: {
      steps: { orderBy: { createdAt: "asc" } },
    },
  });

  return {
    packId: pack.packId,
    pipelineStatus: pack.pipelineStatus,
    pipelineUpdatedAt: pack.pipelineUpdatedAt?.toISOString() ?? null,
    sourceSummary: {
      totalCount: docs.length,
      byType: countBy(docs.map((d) => d.sourceType)),
      byFormat: countBy(docs.map((d) => d.sourceFormat)),
      byValidationStatus: countBy(docs.map((d) => d.validationStatus)),
    },
    latestRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          triggerType: latestRun.triggerType,
          summary: latestRun.summary,
          startedAt: latestRun.startedAt.toISOString(),
          finishedAt: latestRun.finishedAt?.toISOString() ?? null,
        }
      : null,
    stepLogs: (latestRun?.steps ?? []).map((step) => ({
      id: step.id,
      step: step.step,
      status: step.status,
      message: step.message,
      startedAt: step.startedAt?.toISOString() ?? null,
      finishedAt: step.finishedAt?.toISOString() ?? null,
    })),
  };
}

export async function updatePackPipelineStatus(input: {
  packId: string;
  pipelineStatus: PipelineStatus;
  message?: string;
  triggeredByClientId?: string;
}): Promise<{ ok: true } | { error: "NOT_FOUND" }> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: input.packId },
    select: { id: true },
  });

  if (!pack) {
    return { error: "NOT_FOUND" };
  }

  await prisma.knowledgePack.update({
    where: { packId: input.packId },
    data: {
      pipelineStatus: input.pipelineStatus,
      pipelineUpdatedAt: new Date(),
    },
  });

  return { ok: true };
}

export async function createPipelineRun(input: {
  packId: string;
  triggerType: string;
  triggeredByClientId?: string;
  steps?: PipelineStatus[];
  /** Default RUNNING for legacy callers; knowledge jobs may enqueue as PENDING. */
  status?: PipelineStepStatus;
  summary?: string | null;
}): Promise<{ runId: string } | { error: "NOT_FOUND" }> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: input.packId },
    select: { id: true },
  });

  if (!pack) {
    return { error: "NOT_FOUND" };
  }

  const run = await prisma.pipelineRun.create({
    data: {
      packId: input.packId,
      triggerType: input.triggerType,
      triggeredByClientId: input.triggeredByClientId ?? null,
      status: input.status ?? "RUNNING",
      summary: input.summary ?? null,
      steps: input.steps?.length
        ? {
            create: input.steps.map((step) => ({
              packId: input.packId,
              step,
              status: "PENDING",
            })),
          }
        : undefined,
    },
  });

  return { runId: run.id };
}

export async function completePipelineStep(input: {
  runId: string;
  step: PipelineStatus;
  status: PipelineStepStatus;
  message?: string;
  details?: Record<string, unknown>;
}): Promise<{ ok: true } | { error: "NOT_FOUND" }> {
  const existing = await prisma.pipelineStepLog.findFirst({
    where: { runId: input.runId, step: input.step },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const details =
    input.details === undefined
      ? undefined
      : (input.details as Prisma.InputJsonValue);

  const isTerminal =
    input.status === "PASS" ||
    input.status === "WARNING" ||
    input.status === "FAIL" ||
    input.status === "SKIPPED";
  const startedAt =
    input.status === "PENDING" ? null : existing?.startedAt ?? now;
  const finishedAt = isTerminal ? now : null;

  if (!existing) {
    const run = await prisma.pipelineRun.findUnique({
      where: { id: input.runId },
      select: { packId: true },
    });

    if (!run) {
      return { error: "NOT_FOUND" };
    }

    await prisma.pipelineStepLog.create({
      data: {
        runId: input.runId,
        packId: run.packId,
        step: input.step,
        status: input.status,
        message: input.message ?? null,
        details,
        startedAt,
        finishedAt,
      },
    });

    return { ok: true };
  }

  await prisma.pipelineStepLog.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      message: input.message ?? existing.message,
      details,
      startedAt: existing.startedAt ?? startedAt,
      finishedAt,
    },
  });

  return { ok: true };
}

export async function finishPipelineRun(input: {
  runId: string;
  status: PipelineStepStatus;
  summary?: string;
}): Promise<{ ok: true } | { error: "NOT_FOUND" }> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: input.runId },
    select: { id: true },
  });

  if (!run) {
    return { error: "NOT_FOUND" };
  }

  await prisma.pipelineRun.update({
    where: { id: input.runId },
    data: {
      status: input.status,
      summary: input.summary ?? null,
      finishedAt: new Date(),
    },
  });

  return { ok: true };
}
