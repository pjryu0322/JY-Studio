import { createHash, randomUUID } from "node:crypto";
import {
  KNOWLEDGE_PIPELINE_LOCK_MS,
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
export async function acquireKnowledgePipelineLock(
  packId: string,
): Promise<void> {
  const key = createHash("sha256").update(`knowledge-pipeline:${packId}`).digest("hex").slice(0, 16);
  await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

export async function touchKnowledgeRunHeartbeat(input: {
  runId: string;
  binding: KnowledgeRunBinding;
  userMessage?: string;
}): Promise<KnowledgeRunBinding> {
  const next: KnowledgeRunBinding = {
    ...input.binding,
    heartbeatAt: new Date().toISOString(),
    userMessage: input.userMessage ?? input.binding.userMessage,
  };
  await prisma.pipelineRun.update({
    where: { id: input.runId },
    data: { summary: serializeKnowledgeRunBinding(next) },
  });
  return next;
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

/**
 * Claim next pending or stale RUNNING knowledge pipeline job.
 * Uses row update conditioned on status for atomicity.
 */
export async function claimNextKnowledgePipelineRun(
  lockOwner: string = WORKER_ID,
): Promise<ClaimedKnowledgePipelineRun | null> {
  const candidates = await prisma.pipelineRun.findMany({
    where: {
      triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
      status: { in: ["PENDING", "RUNNING"] },
    },
    orderBy: { startedAt: "asc" },
    take: 20,
    select: { id: true, packId: true, status: true, summary: true },
  });

  const now = Date.now();
  const lockExpiresAt = new Date(now + KNOWLEDGE_PIPELINE_LOCK_MS).toISOString();

  for (const candidate of candidates) {
    const binding = parseKnowledgeRunBinding(candidate.summary);
    if (!binding) continue;

    const eligiblePending = candidate.status === "PENDING";
    const eligibleStale =
      candidate.status === "RUNNING" &&
      (isKnowledgeRunHeartbeatStale(binding, now) ||
        (binding.lockExpiresAt != null && Date.parse(binding.lockExpiresAt) < now));

    if (!eligiblePending && !eligibleStale) continue;

    const next: KnowledgeRunBinding = {
      ...binding,
      attempt: binding.attempt + 1,
      lockOwner,
      lockExpiresAt,
      heartbeatAt: new Date().toISOString(),
      userMessage: "실행 중",
    };

    const updated = await prisma.pipelineRun.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
      },
      data: {
        status: "RUNNING",
        summary: serializeKnowledgeRunBinding(next),
        finishedAt: null,
      },
    });

    if (updated.count !== 1) continue;

    return {
      runId: candidate.id,
      packId: candidate.packId,
      binding: next,
    };
  }

  return null;
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
    // Leave reclaimable for claimNext (lock expired). Also surface as timeout if very stale (>2x).
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
      where: { packId: run.packId, pipelineStatus: { not: "FAILED" } },
      data: { pipelineStatus: "FAILED", pipelineUpdatedAt: new Date() },
    });
    recovered += 1;
  }
  return recovered;
}
