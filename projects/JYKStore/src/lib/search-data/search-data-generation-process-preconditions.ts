/**
 * Process-job precondition guards for claimed search-data generations.
 */
import { AuditAction, PackStatus } from "@prisma/client";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { isDoclingStructurePassed } from "@/lib/docling-knowledge/docling-knowledge-pipeline-service";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import { markSearchGenerationFailed } from "@/lib/search-generation/search-generation-service";
import { countRetrievalChunksForGeneration } from "@/lib/search-data/search-data-generation-shared";
import type { ClaimedSearchDataGeneration } from "@/lib/search-data/search-data-generation-types";

async function releaseClaimToPending(claimed: ClaimedSearchDataGeneration): Promise<void> {
  await prisma.searchIndexGeneration.updateMany({
    where: { id: claimed.id, attempt: claimed.attempt, status: "EMBEDDING" },
    data: { status: "PENDING", startedAt: null },
  });
}

export async function ensureDraftPackForClaim(
  claimed: ClaimedSearchDataGeneration,
): Promise<boolean> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: claimed.packId },
    select: { status: true },
  });
  if (!pack || pack.status !== PackStatus.DRAFT) {
    await markSearchGenerationFailed(claimed.id, {
      failureCode: "PACK_NOT_DRAFT",
      failureMessage: "pack is not DRAFT",
      expectedAttempt: claimed.attempt,
    }).catch(() => undefined);
    return false;
  }
  return true;
}

export async function ensureDoclingStructureReadyForClaim(
  claimed: ClaimedSearchDataGeneration,
): Promise<boolean> {
  const structureOk = await isDoclingStructurePassed(claimed.packId);
  if (!structureOk) {
    // Structure still running or incomplete — release claim; do not fail the generation.
    await releaseClaimToPending(claimed);
    return false;
  }
  return true;
}

export async function ensurePipelineRunNotActive(
  claimed: ClaimedSearchDataGeneration,
): Promise<boolean> {
  const pipelineRun = await prisma.pipelineRun.findUnique({
    where: { id: claimed.pipelineRunId },
    select: { status: true },
  });
  if (pipelineRun && (pipelineRun.status === "RUNNING" || pipelineRun.status === "PENDING")) {
    // Structure pipeline still running — release claim until structure finishes.
    await releaseClaimToPending(claimed);
    return false;
  }
  return true;
}

export function isClaimBindingStale(input: {
  latestId: string | undefined;
  binding: {
    indexGenerationId?: string;
    fingerprint?: string;
    normalizedDocumentId?: string;
  } | null;
  claimed: ClaimedSearchDataGeneration;
}): boolean {
  const { latestId, binding, claimed } = input;
  return (
    !latestId ||
    !binding?.indexGenerationId ||
    !binding.fingerprint ||
    !binding.normalizedDocumentId ||
    latestId !== claimed.pipelineRunId ||
    binding.normalizedDocumentId !== claimed.normalizedDocumentId ||
    binding.fingerprint !== claimed.fingerprint ||
    binding.indexGenerationId !== claimed.chunkGenerationId ||
    claimed.id !== claimed.chunkGenerationId
  );
}

export async function ensureLatestBindingMatchesClaim(
  claimed: ClaimedSearchDataGeneration,
): Promise<boolean> {
  const latest = await prisma.pipelineRun.findFirst({
    where: { packId: claimed.packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER },
    orderBy: { startedAt: "desc" },
  });
  const binding = latest ? parseKnowledgeRunBinding(latest.summary) : null;
  if (isClaimBindingStale({ latestId: latest?.id, binding, claimed })) {
    await markSearchGenerationFailed(claimed.id, {
      failureCode: "SEARCH_DATA_BINDING_STALE",
      failureMessage: "binding mismatch at worker start",
      expectedAttempt: claimed.attempt,
    }).catch(() => undefined);
    await recordProviderAudit({
      action: AuditAction.PROVIDER_PACK_UPDATE,
      entityType: "KnowledgePack",
      entityId: claimed.packId,
      actorUserId: null,
      metadata: {
        event: "SEARCH_DATA_GENERATION_STALE_BINDING",
        packId: claimed.packId,
        searchIndexGenerationId: claimed.id,
        attempt: claimed.attempt,
        failureCode: "SEARCH_DATA_BINDING_STALE",
      },
    }).catch(() => undefined);
    return false;
  }
  return true;
}

export async function ensureLiveChunkCountMatchesClaim(
  claimed: ClaimedSearchDataGeneration,
): Promise<boolean> {
  const liveChunkCount = await countRetrievalChunksForGeneration({
    versionId: claimed.versionId,
    indexGenerationId: claimed.chunkGenerationId,
  });
  if (
    liveChunkCount < 1 ||
    (claimed.chunkCount > 0 && liveChunkCount !== claimed.chunkCount)
  ) {
    await markSearchGenerationFailed(claimed.id, {
      failureCode: "SEARCH_DATA_BINDING_STALE",
      failureMessage: `chunkCount mismatch live=${liveChunkCount} claimed=${claimed.chunkCount}`,
      expectedAttempt: claimed.attempt,
    }).catch(() => undefined);
    return false;
  }
  return true;
}

/** Returns true if the job should continue to embedding. */
export async function assertProcessJobPreconditions(
  claimed: ClaimedSearchDataGeneration,
): Promise<boolean> {
  if (!(await ensureDraftPackForClaim(claimed))) return false;
  if (!(await ensureDoclingStructureReadyForClaim(claimed))) return false;
  if (!(await ensurePipelineRunNotActive(claimed))) return false;
  if (!(await ensureLatestBindingMatchesClaim(claimed))) return false;
  if (!(await ensureLiveChunkCountMatchesClaim(claimed))) return false;
  return true;
}
