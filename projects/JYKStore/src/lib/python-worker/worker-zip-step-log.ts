/**
 * P7.5: persist + read ZIP Worker step progress using the existing
 * `PipelineStepLog` table (no schema change).
 *
 * The Admin execute route runs the pipeline synchronously, but the pipeline's
 * `markStage` hook writes a step row per logical stage as it advances. A separate
 * status API (polled concurrently by the Admin UI while the POST is in flight)
 * reads those rows to render a live stepper — no async job queue is introduced.
 */
import type { PipelineStatus, PipelineStepStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  describeWorkerZipStage,
  type WorkerZipLogicalStage,
} from "@/lib/python-worker/worker-zip-pipeline-stages";

/** PipelineRun.triggerType for the actual generation run (kept in sync with the service). */
export const WORKER_ZIP_IMPORT_TRIGGER = "WORKER_ZIP_IMPORT";

/**
 * Ordered, user-facing steps shown in the Admin stepper. Each maps to the
 * `PipelineStatus` a logical stage records, so a persisted step row lights up the
 * matching stepper node. Non-progress statuses (FAILED, REVIEWING, …) are omitted.
 */
export const WORKER_ZIP_UI_STEPS: { step: PipelineStatus; label: string }[] = [
  { step: "SOURCE_REGISTERING", label: "접수" },
  { step: "SOURCE_VALIDATING", label: "ZIP 확인" },
  { step: "STRUCTURING", label: "문서 구조화" },
  { step: "STRUCTURE_VALIDATING", label: "구조 검증" },
  { step: "KNOWLEDGE_CHECKING", label: "지식 점검" },
  { step: "CHUNKING", label: "검색데이터 준비" },
  { step: "CHUNK_EVALUATING", label: "검색데이터 반영" },
  { step: "INDEXING", label: "검색 인덱스" },
];

const STEP_LABEL = new Map<string, string>(
  WORKER_ZIP_UI_STEPS.map((s) => [s.step, s.label]),
);

/** Friendly Korean label for a persisted PipelineStatus step (Admin-facing). */
export function describeWorkerZipStep(step: string | null | undefined): string {
  if (!step) return "";
  return STEP_LABEL.get(step) ?? step;
}

export type WorkerZipStepLogView = {
  step: PipelineStatus;
  status: PipelineStepStatus;
  message: string | null;
  createdAt: string;
};

export type WorkerZipRunSummary = {
  importedChunkCount?: number;
  importedEmbeddingCount?: number;
  excludedFiles?: number;
};

export type WorkerZipRunView = {
  runId: string;
  status: PipelineStepStatus;
  currentStep: PipelineStatus | null;
  currentStepLabel: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  message: string | null;
  errorMessage: string | null;
  summary: WorkerZipRunSummary | null;
  stepLogs: WorkerZipStepLogView[];
};

/**
 * Build a `markStage` implementation that records step progress for a run. Each
 * call closes the prior RUNNING step (PASS) and opens a new RUNNING step. All
 * writes are best-effort: step logging never fails the generation.
 */
export function createWorkerZipStepRecorder(input: {
  prismaClient?: typeof prisma;
  runId: string;
  packId: string;
}): (stage: WorkerZipLogicalStage, pipelineStatus: PipelineStatus) => Promise<void> {
  const client = input.prismaClient ?? prisma;
  return async (stage, pipelineStatus) => {
    try {
      await client.pipelineStepLog.updateMany({
        where: { runId: input.runId, status: "RUNNING" },
        data: { status: "PASS", finishedAt: new Date() },
      });
      await client.pipelineStepLog.create({
        data: {
          runId: input.runId,
          packId: input.packId,
          step: pipelineStatus,
          status: "RUNNING",
          message: describeWorkerZipStage(stage),
          startedAt: new Date(),
        },
      });
    } catch {
      // Best-effort: progress logging must never break the pipeline.
    }
  };
}

/**
 * Finalize a run's step logs after the pipeline resolves. On success the last
 * RUNNING step is closed PASS and a terminal summary is attached; on failure the
 * last RUNNING step is marked FAIL with the error message.
 */
export async function finalizeWorkerZipSteps(input: {
  prismaClient?: typeof prisma;
  runId: string;
  ok: boolean;
  errorMessage?: string | null;
  summary?: WorkerZipRunSummary | null;
}): Promise<void> {
  const client = input.prismaClient ?? prisma;
  try {
    if (input.ok) {
      await client.pipelineStepLog.updateMany({
        where: { runId: input.runId, status: "RUNNING" },
        data: {
          status: "PASS",
          finishedAt: new Date(),
          ...(input.summary ? { details: input.summary } : {}),
        },
      });
    } else {
      await client.pipelineStepLog.updateMany({
        where: { runId: input.runId, status: "RUNNING" },
        data: {
          status: "FAIL",
          finishedAt: new Date(),
          message: input.errorMessage?.slice(0, 500) ?? "생성 중 오류가 발생했습니다.",
        },
      });
    }
  } catch {
    // Best-effort finalization.
  }
}

function summaryFromDetails(details: unknown): WorkerZipRunSummary | null {
  if (!details || typeof details !== "object") return null;
  const record = details as Record<string, unknown>;
  const out: WorkerZipRunSummary = {};
  if (typeof record.importedChunkCount === "number") out.importedChunkCount = record.importedChunkCount;
  if (typeof record.importedEmbeddingCount === "number")
    out.importedEmbeddingCount = record.importedEmbeddingCount;
  if (typeof record.excludedFiles === "number") out.excludedFiles = record.excludedFiles;
  return Object.keys(out).length > 0 ? out : null;
}

type PipelineRunWithSteps = {
  id: string;
  status: PipelineStepStatus;
  summary: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  steps: {
    step: PipelineStatus;
    status: PipelineStepStatus;
    message: string | null;
    details: unknown;
    createdAt: Date;
  }[];
};

/** Map a PipelineRun (+ its steps) into the Admin-facing run view. */
export function toWorkerZipRunView(run: PipelineRunWithSteps): WorkerZipRunView {
  const steps = [...run.steps].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const runningStep = steps.find((s) => s.status === "RUNNING");
  const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
  const currentStep = (runningStep ?? lastStep)?.step ?? null;
  const failStep = [...steps].reverse().find((s) => s.status === "FAIL");
  const summaryStep = [...steps].reverse().find((s) => summaryFromDetails(s.details));

  return {
    runId: run.id,
    status: run.status,
    currentStep,
    currentStepLabel: describeWorkerZipStep(currentStep),
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    durationMs: run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null,
    message: (runningStep ?? lastStep)?.message ?? run.summary ?? null,
    errorMessage: failStep?.message ?? null,
    summary: summaryStep ? summaryFromDetails(summaryStep.details) : null,
    stepLogs: steps.map((s) => ({
      step: s.step,
      status: s.status,
      message: s.message,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

const RUN_SELECT = {
  id: true,
  status: true,
  summary: true,
  startedAt: true,
  finishedAt: true,
  steps: {
    select: { step: true, status: true, message: true, details: true, createdAt: true },
  },
} as const;

/** Latest generation run (+ steps) for a pack, or null when none has run yet. */
export async function getLatestWorkerZipRun(input: {
  prismaClient?: typeof prisma;
  packId: string;
}): Promise<WorkerZipRunView | null> {
  const client = input.prismaClient ?? prisma;
  const run = await client.pipelineRun.findFirst({
    where: { packId: input.packId, triggerType: WORKER_ZIP_IMPORT_TRIGGER },
    orderBy: { createdAt: "desc" },
    select: RUN_SELECT,
  });
  return run ? toWorkerZipRunView(run as PipelineRunWithSteps) : null;
}

/** Recent generation runs (+ steps) for a pack, newest first. */
export async function listWorkerZipRuns(input: {
  prismaClient?: typeof prisma;
  packId: string;
  limit?: number;
}): Promise<WorkerZipRunView[]> {
  const client = input.prismaClient ?? prisma;
  const runs = await client.pipelineRun.findMany({
    where: { packId: input.packId, triggerType: WORKER_ZIP_IMPORT_TRIGGER },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(input.limit ?? 10, 1), 50),
    select: RUN_SELECT,
  });
  return runs.map((run) => toWorkerZipRunView(run as PipelineRunWithSteps));
}
