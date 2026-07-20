/**
 * Process-job helpers: precondition checks + embed/complete + fail paths.
 */
import { AuditAction, PackStatus } from "@prisma/client";
import { rebuildPackEmbeddings } from "@/lib/chunk-embedding-service";
import {
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
  DOCLING_RETRIEVAL_CHUNK_TYPE,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { isDoclingStructurePassed } from "@/lib/docling-knowledge/docling-knowledge-pipeline-service";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { LOCAL_E5_EMBEDDING_PROVIDER } from "@/lib/embedding/e5-embedding-constants";
import { isEmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import { completePipelineStep } from "@/lib/pipeline-service";
import {
  markSearchGenerationFailed,
  markSearchGenerationIndexing,
} from "@/lib/search-generation/search-generation-service";
import {
  assertGenerationDescriptorMatchesRuntime,
  resolveSearchGenerationEmbeddingDescriptor,
} from "@/lib/search-generation/search-generation-types";
import { mapSearchDataFailureCode } from "@/lib/search-data/search-data-error";
import {
  assertPgvectorRuntimeReady,
  countRetrievalChunksForGeneration,
  countVectorsForGeneration,
} from "@/lib/search-data/search-data-generation-shared";
import type { ClaimedSearchDataGeneration } from "@/lib/search-data/search-data-generation-types";

async function releaseClaimToPending(claimed: ClaimedSearchDataGeneration): Promise<void> {
  await prisma.searchIndexGeneration.updateMany({
    where: { id: claimed.id, attempt: claimed.attempt, status: "EMBEDDING" },
    data: { status: "PENDING", startedAt: null },
  });
}

/** Returns true if the job should continue to embedding. */
export async function assertProcessJobPreconditions(
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

  const structureOk = await isDoclingStructurePassed(claimed.packId);
  if (!structureOk) {
    // Structure still running or incomplete — release claim; do not fail the generation.
    await releaseClaimToPending(claimed);
    return false;
  }

  const pipelineRun = await prisma.pipelineRun.findUnique({
    where: { id: claimed.pipelineRunId },
    select: { status: true },
  });
  if (pipelineRun && (pipelineRun.status === "RUNNING" || pipelineRun.status === "PENDING")) {
    // Structure pipeline still running — release claim until structure finishes.
    await releaseClaimToPending(claimed);
    return false;
  }

  const latest = await prisma.pipelineRun.findFirst({
    where: { packId: claimed.packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER },
    orderBy: { startedAt: "desc" },
  });
  const binding = latest ? parseKnowledgeRunBinding(latest.summary) : null;
  const bindingStale =
    !latest ||
    !binding?.indexGenerationId ||
    !binding.fingerprint ||
    !binding.normalizedDocumentId ||
    latest.id !== claimed.pipelineRunId ||
    binding.normalizedDocumentId !== claimed.normalizedDocumentId ||
    binding.fingerprint !== claimed.fingerprint ||
    binding.indexGenerationId !== claimed.chunkGenerationId ||
    claimed.id !== claimed.chunkGenerationId;

  if (bindingStale) {
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

export async function runSearchDataEmbeddingAndIndex(
  claimed: ClaimedSearchDataGeneration,
): Promise<void> {
  await assertPgvectorRuntimeReady();

  const runtime = await resolveSearchGenerationEmbeddingDescriptor();

  const generation = await prisma.searchIndexGeneration.findUnique({
    where: { id: claimed.id },
  });
  if (!generation || generation.attempt !== claimed.attempt) {
    return;
  }
  if (generation.status !== "EMBEDDING") {
    return;
  }

  // Immutable Generation descriptor — never mutate; fail-closed on mismatch.
  assertGenerationDescriptorMatchesRuntime({
    generation,
    runtime,
  });

  await completePipelineStep({
    runId: claimed.pipelineRunId,
    step: "INDEXING",
    status: "RUNNING",
    message: "검색데이터를 생성하는 중…",
    details: {
      draft: true,
      indexGenerationId: claimed.id,
      searchIndexGenerationId: claimed.id,
      attempt: claimed.attempt,
    },
  }).catch(() => undefined);

  const embeddings = await rebuildPackEmbeddings({
    packId: claimed.packId,
    versionId: claimed.versionId,
    force: true,
    chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
    indexGenerationId: claimed.chunkGenerationId,
    searchIndexGenerationId: claimed.id,
    pipelineRunId: claimed.pipelineRunId,
    fingerprint: claimed.fingerprint,
    normalizedDocumentId: claimed.normalizedDocumentId,
    chunkGenerationId: claimed.chunkGenerationId,
    includeInactiveForGeneration: true,
    requirePgvector: true,
    onChunkProcessed: async (processedCount) => {
      await prisma.searchIndexGeneration.updateMany({
        where: {
          id: claimed.id,
          attempt: claimed.attempt,
          status: "EMBEDDING",
        },
        data: { embeddedCount: processedCount },
      });
    },
  });

  if (!embeddings) {
    throw new Error("INDEX_BUILD_FAILED:embedding rebuild returned null");
  }

  const embedded =
    embeddings.createdCount + embeddings.updatedCount + embeddings.skippedCount;

  const stillOwned = await prisma.searchIndexGeneration.findFirst({
    where: { id: claimed.id, attempt: claimed.attempt, status: "EMBEDDING" },
  });
  if (!stillOwned) return;

  await markSearchGenerationIndexing(claimed.id, {
    embeddedCount: embedded,
    chunkCount: embeddings.processedCount,
    failedCount: 0,
    expectedAttempt: claimed.attempt,
  });

  const vectorCount = await countVectorsForGeneration(claimed.id);
  const expectedChunks =
    claimed.chunkCount > 0 ? claimed.chunkCount : embeddings.processedCount;
  if (vectorCount !== expectedChunks || embedded < expectedChunks) {
    await markSearchGenerationFailed(claimed.id, {
      failureCode: "VECTOR_COUNT_MISMATCH",
      failureMessage: `vectors=${vectorCount} chunks=${expectedChunks} embedded=${embedded}`,
      expectedAttempt: claimed.attempt,
    });
    await completePipelineStep({
      runId: claimed.pipelineRunId,
      step: "INDEXING",
      status: "FAIL",
      message: "검색데이터 저장이 완료되지 않았습니다.",
      details: { failureCode: "VECTOR_COUNT_MISMATCH", vectorCount, expectedChunks },
    }).catch(() => undefined);
    return;
  }

  await completePipelineStep({
    runId: claimed.pipelineRunId,
    step: "INDEXING",
    status: "PASS",
    message: `검색데이터 ${vectorCount}건을 생성했습니다.`,
    details: {
      draft: true,
      indexGenerationId: claimed.id,
      searchIndexGenerationId: claimed.id,
      indexScope: "DRAFT",
      embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
      processedCount: embeddings.processedCount,
      vectorCount,
      attempt: claimed.attempt,
    },
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: claimed.packId,
    actorUserId: null,
    metadata: {
      event: "SEARCH_DATA_GENERATION_COMPLETED",
      packId: claimed.packId,
      versionId: claimed.versionId,
      searchIndexGenerationId: claimed.id,
      chunkCount: expectedChunks,
      vectorCount,
      attempt: claimed.attempt,
    },
  }).catch(() => undefined);
}

export async function failSearchDataProcessJob(
  claimed: ClaimedSearchDataGeneration,
  error: unknown,
): Promise<void> {
  const code = isEmbeddingProviderError(error)
    ? error.code
    : error instanceof PayloadServiceError
      ? error.code
      : error instanceof Error && error.message.startsWith("INDEX_BUILD_FAILED")
        ? "INDEX_BUILD_FAILED"
        : "INDEX_BUILD_FAILED";

  await markSearchGenerationFailed(claimed.id, {
    failureCode: code,
    failureMessage: error instanceof Error ? error.message.slice(0, 300) : null,
    expectedAttempt: claimed.attempt,
  }).catch(() => undefined);

  await completePipelineStep({
    runId: claimed.pipelineRunId,
    step: "INDEXING",
    status: "FAIL",
    message: mapSearchDataFailureCode(code).message,
    details: { failureCode: code },
  }).catch(() => undefined);

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: claimed.packId,
    actorUserId: null,
    metadata: {
      event: "SEARCH_DATA_GENERATION_FAILED",
      failureCode: code,
      searchIndexGenerationId: claimed.id,
      attempt: claimed.attempt,
    },
  }).catch(() => undefined);
}
