import type { Prisma } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  parseKnowledgeRunBinding,
  type KnowledgeRunBinding,
} from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "@/lib/docling-knowledge/docling-knowledge-stages";

export type CurrentValidationBinding = {
  pipelineRunId: string;
  versionId: string;
  indexGenerationId: string;
  normalizedDocumentId: string;
  fingerprint: string;
};

type TxClient = Prisma.TransactionClient | typeof import("@/lib/prisma").prisma;

function staleError(): PayloadServiceError {
  return new PayloadServiceError(
    "SERVICE_VALIDATION_STALE",
    "지식 데이터가 변경되어 다운로드 검증을 다시 실행해야 합니다.",
    400,
  );
}

function toCurrentBinding(
  pipelineRunId: string,
  binding: KnowledgeRunBinding,
): CurrentValidationBinding {
  return {
    pipelineRunId,
    versionId: binding.versionId,
    indexGenerationId: binding.indexGenerationId,
    normalizedDocumentId: binding.normalizedDocumentId,
    fingerprint: binding.fingerprint,
  };
}

/**
 * Resolve the current PASS knowledge pipeline binding for a pack version.
 * Prefer the latest PASS whose summary binding.versionId matches.
 */
export async function resolveCurrentValidationBindingTx(
  tx: TxClient,
  input: {
    packId: string;
    versionId: string;
    expectedPipelineRunId?: string | null;
  },
): Promise<CurrentValidationBinding> {
  const candidates = await tx.pipelineRun.findMany({
    where: {
      packId: input.packId,
      triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
      status: "PASS",
    },
    orderBy: { startedAt: "desc" },
    take: 40,
    select: { id: true, packId: true, summary: true },
  });

  let matched: CurrentValidationBinding | null = null;
  for (const run of candidates) {
    if (run.packId !== input.packId) continue;
    const binding = parseKnowledgeRunBinding(run.summary);
    if (!binding || binding.versionId !== input.versionId) continue;
    matched = toCurrentBinding(run.id, binding);
    break;
  }

  if (!matched) throw staleError();

  if (
    input.expectedPipelineRunId &&
    input.expectedPipelineRunId.trim() &&
    input.expectedPipelineRunId !== matched.pipelineRunId
  ) {
    throw staleError();
  }

  return matched;
}

/** Load binding stored on a specific PipelineRun (historical evidence). */
export async function resolvePipelineRunBindingTx(
  tx: TxClient,
  pipelineRunId: string | null | undefined,
): Promise<CurrentValidationBinding | null> {
  if (!pipelineRunId?.trim()) return null;
  const run = await tx.pipelineRun.findUnique({
    where: { id: pipelineRunId },
    select: { id: true, packId: true, summary: true },
  });
  if (!run) return null;
  const binding = parseKnowledgeRunBinding(run.summary);
  if (!binding) return null;
  return toCurrentBinding(run.id, binding);
}

export function runMatchesBinding(
  run: {
    indexGenerationId?: string | null;
    fingerprint?: string | null;
    normalizedDocumentId?: string | null;
    pipelineRunId?: string | null;
  },
  binding: CurrentValidationBinding | null | undefined,
): boolean {
  if (!binding) return false;
  if (run.pipelineRunId && run.pipelineRunId !== binding.pipelineRunId) return false;
  if (
    run.indexGenerationId &&
    binding.indexGenerationId &&
    run.indexGenerationId !== binding.indexGenerationId
  ) {
    return false;
  }
  if (run.fingerprint && binding.fingerprint && run.fingerprint !== binding.fingerprint) {
    return false;
  }
  if (
    run.normalizedDocumentId &&
    binding.normalizedDocumentId &&
    run.normalizedDocumentId !== binding.normalizedDocumentId
  ) {
    return false;
  }
  return true;
}

export function evidenceIntegrityForRun(
  run: {
    status: string;
    pipelineRunId?: string | null;
    indexGenerationId?: string | null;
    fingerprint?: string | null;
    normalizedDocumentId?: string | null;
    invalidatedAt?: Date | null;
  },
  runPipelineBinding: CurrentValidationBinding | null,
): "VALID" | "INVALID" {
  if (run.invalidatedAt) return "INVALID";
  if (run.status !== "PASS") return "VALID";
  if (!run.pipelineRunId || !runPipelineBinding) return "INVALID";
  if (runPipelineBinding.pipelineRunId !== run.pipelineRunId) return "INVALID";
  if (!runMatchesBinding(run, runPipelineBinding)) return "INVALID";
  return "VALID";
}
