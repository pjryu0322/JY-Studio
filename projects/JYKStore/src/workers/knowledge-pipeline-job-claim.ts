import { createHash, randomUUID } from "node:crypto";
import {
  KNOWLEDGE_PIPELINE_LOCK_MS,
  KNOWLEDGE_PIPELINE_MAX_ATTEMPTS,
  parseKnowledgeRunBinding,
  serializeKnowledgeRunBinding,
  type KnowledgeRunBinding,
  isKnowledgeRunHeartbeatStale,
} from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { prisma } from "@/lib/prisma";

export type ClaimedKnowledgePipelineRun = {
  runId: string;
  packId: string;
  binding: KnowledgeRunBinding;
};

const WORKER_ID =
  process.env.JYKSTORE_KNOWLEDGE_WORKER_ID?.trim() ||
  `knowledge-worker-${randomUUID()}`;

export function knowledgePipelineLockOwner(): string {
  return WORKER_ID;
}

/** Pack-scoped advisory lock for single-flight enqueue/start. */
export async function acquireKnowledgePipelineLock(packId: string): Promise<void> {
  const key = createHash("sha256").update(`knowledge-pipeline:${packId}`).digest("hex").slice(0, 16);
  await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

type ClaimRow = {
  id: string;
  packId: string;
  summary: string | null;
  status: string;
};

/**
 * Atomically claim one PENDING or lock-expired RUNNING knowledge pipeline run.
 * Uses FOR UPDATE SKIP LOCKED so two workers cannot claim the same row.
 */
export async function claimNextKnowledgePipelineRun(
  lockOwner: string = WORKER_ID,
): Promise<ClaimedKnowledgePipelineRun | null> {
  const nowIso = new Date().toISOString();
  const lockExpiresAt = new Date(Date.now() + KNOWLEDGE_PIPELINE_LOCK_MS).toISOString();
  const trigger = DOCLING_KNOWLEDGE_PIPELINE_TRIGGER;

  const rows = await prisma.$queryRaw<ClaimRow[]>`
    UPDATE "PipelineRun" AS job
    SET
      "status" = 'RUNNING'::"PipelineStepStatus",
      "finishedAt" = NULL,
      "updatedAt" = NOW()
    WHERE job.id = (
      SELECT j.id
      FROM "PipelineRun" AS j
      WHERE j."triggerType" = ${trigger}
        AND (
          j."status" = 'PENDING'::"PipelineStepStatus"
          OR (
            j."status" = 'RUNNING'::"PipelineStepStatus"
            AND j."summary" IS NOT NULL
            AND left(j."summary", 1) = '{'
            AND (
              COALESCE(
                NULLIF(j."summary"::json->>'lockExpiresAt', ''),
                '1970-01-01T00:00:00.000Z'
              )::timestamptz
            ) < NOW()
          )
        )
      ORDER BY j."startedAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING job.id, job."packId", job.summary, job.status::text AS status
  `;

  const row = rows[0];
  if (!row) return null;

  const binding = parseKnowledgeRunBinding(row.summary);
  if (!binding) {
    await prisma.pipelineRun.update({
      where: { id: row.id },
      data: {
        status: "FAIL",
        finishedAt: new Date(),
        summary: "Invalid knowledge run binding JSON",
      },
    });
    return null;
  }

  const nextAttempt = binding.attempt + 1;
  if (nextAttempt > KNOWLEDGE_PIPELINE_MAX_ATTEMPTS) {
    const failed: KnowledgeRunBinding = {
      ...binding,
      attempt: nextAttempt,
      failureCode: "PIPELINE_RETRY_EXHAUSTED",
      failureMessage: "max attempts exceeded",
      userMessage: "재시도 횟수를 초과했습니다. 다시 생성해 주세요.",
      lockOwner: null,
      lockExpiresAt: null,
      heartbeatAt: nowIso,
    };
    await prisma.pipelineRun.update({
      where: { id: row.id },
      data: {
        status: "FAIL",
        finishedAt: new Date(),
        summary: serializeKnowledgeRunBinding(failed),
      },
    });
    await prisma.knowledgePack.updateMany({
      where: { packId: row.packId },
      data: { pipelineStatus: "FAILED", pipelineUpdatedAt: new Date() },
    });
    return null;
  }

  const next: KnowledgeRunBinding = {
    ...binding,
    attempt: nextAttempt,
    lockOwner,
    lockExpiresAt,
    heartbeatAt: nowIso,
    userMessage: "실행 중",
  };

  await prisma.pipelineRun.update({
    where: { id: row.id },
    data: { summary: serializeKnowledgeRunBinding(next) },
  });

  return { runId: row.id, packId: row.packId, binding: next };
}

/**
 * Extend heartbeat + lock expiry only when caller still owns the lock.
 */
export async function touchKnowledgeRunHeartbeat(input: {
  runId: string;
  lockOwner: string;
  userMessage?: string;
}): Promise<KnowledgeRunBinding | null> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: input.runId },
    select: { status: true, summary: true },
  });
  if (!run || run.status !== "RUNNING") return null;
  const binding = parseKnowledgeRunBinding(run.summary);
  if (!binding) return null;
  if (binding.lockOwner !== input.lockOwner) return null;
  if (binding.cancelRequestedAt) return null;

  const next: KnowledgeRunBinding = {
    ...binding,
    heartbeatAt: new Date().toISOString(),
    lockExpiresAt: new Date(Date.now() + KNOWLEDGE_PIPELINE_LOCK_MS).toISOString(),
    lockOwner: input.lockOwner,
    userMessage: input.userMessage ?? binding.userMessage,
  };

  const updated = await prisma.pipelineRun.updateMany({
    where: { id: input.runId, status: "RUNNING" },
    data: { summary: serializeKnowledgeRunBinding(next) },
  });
  if (updated.count !== 1) return null;
  return next;
}

export async function assertKnowledgeRunLock(input: {
  runId: string;
  lockOwner: string;
}): Promise<KnowledgeRunBinding | null> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: input.runId },
    select: { status: true, summary: true },
  });
  if (!run || run.status !== "RUNNING") return null;
  const binding = parseKnowledgeRunBinding(run.summary);
  if (!binding) return null;
  if (binding.lockOwner !== input.lockOwner) return null;
  if (binding.cancelRequestedAt) return null;
  if (binding.lockExpiresAt && Date.parse(binding.lockExpiresAt) <= Date.now()) {
    return null;
  }
  return binding;
}

export async function markKnowledgeRunCancelRequested(runId: string): Promise<boolean> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: runId },
    select: { summary: true, status: true },
  });
  if (!run || (run.status !== "RUNNING" && run.status !== "PENDING")) return false;
  const binding = parseKnowledgeRunBinding(run.summary);
  if (!binding) return false;
  binding.cancelRequestedAt = new Date().toISOString();
  binding.userMessage = "취소 요청됨";
  await prisma.pipelineRun.update({
    where: { id: runId },
    data: { summary: serializeKnowledgeRunBinding(binding) },
  });
  return true;
}

export async function recoverStaleKnowledgePipelineRuns(limit = 10): Promise<number> {
  const running = await prisma.pipelineRun.findMany({
    where: {
      triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
      status: "RUNNING",
    },
    orderBy: { startedAt: "asc" },
    take: limit,
    select: { id: true, packId: true, summary: true },
  });

  let recovered = 0;
  for (const run of running) {
    const binding = parseKnowledgeRunBinding(run.summary);
    if (!binding || !isKnowledgeRunHeartbeatStale(binding)) continue;
    const hb = binding.heartbeatAt ? Date.parse(binding.heartbeatAt) : 0;
    if (Date.now() - hb < KNOWLEDGE_PIPELINE_LOCK_MS * 2) continue;

    binding.failureCode = "PIPELINE_TIMEOUT";
    binding.failureMessage = "heartbeat timeout";
    binding.userMessage = "작업이 시간 초과되어 중단되었습니다. 다시 생성해 주세요.";
    binding.lockOwner = null;
    binding.lockExpiresAt = null;
    await prisma.pipelineRun.update({
      where: { id: run.id },
      data: {
        status: "FAIL",
        finishedAt: new Date(),
        summary: serializeKnowledgeRunBinding(binding),
      },
    });
    await prisma.knowledgePack.updateMany({
      where: { packId: run.packId },
      data: { pipelineStatus: "FAILED", pipelineUpdatedAt: new Date() },
    });
    recovered += 1;
  }
  return recovered;
}
