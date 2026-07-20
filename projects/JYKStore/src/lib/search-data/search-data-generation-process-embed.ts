/**
 * Embedding rebuild + indexing completion / mismatch failure writes.
 */
import { AuditAction } from "@prisma/client";
import { rebuildPackEmbeddings } from "@/lib/chunk-embedding-service";
import { DOCLING_RETRIEVAL_CHUNK_TYPE } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { LOCAL_E5_EMBEDDING_PROVIDER } from "@/lib/embedding/e5-embedding-constants";
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
import {
  assertPgvectorRuntimeReady,
  countVectorsForGeneration,
} from "@/lib/search-data/search-data-generation-shared";
import type { ClaimedSearchDataGeneration } from "@/lib/search-data/search-data-generation-types";

export async function assertClaimReadyForEmbedding(
  claimed: ClaimedSearchDataGeneration,
): Promise<boolean> {
  await assertPgvectorRuntimeReady();
  const runtime = await resolveSearchGenerationEmbeddingDescriptor();
  const generation = await prisma.searchIndexGeneration.findUnique({
    where: { id: claimed.id },
  });
  if (!generation || generation.attempt !== claimed.attempt) return false;
  if (generation.status !== "EMBEDDING") return false;
  // Immutable Generation descriptor — never mutate; fail-closed on mismatch.
  assertGenerationDescriptorMatchesRuntime({ generation, runtime });
  return true;
}

export async function markIndexingStepRunning(
  claimed: ClaimedSearchDataGeneration,
): Promise<void> {
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
}

export async function rebuildClaimedPackEmbeddings(
  claimed: ClaimedSearchDataGeneration,
) {
  return rebuildPackEmbeddings({
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
}

export async function completeEmbeddingIndexing(input: {
  claimed: ClaimedSearchDataGeneration;
  embedded: number;
  processedCount: number;
}): Promise<void> {
  const { claimed, embedded, processedCount } = input;

  const stillOwned = await prisma.searchIndexGeneration.findFirst({
    where: { id: claimed.id, attempt: claimed.attempt, status: "EMBEDDING" },
  });
  if (!stillOwned) return;

  await markSearchGenerationIndexing(claimed.id, {
    embeddedCount: embedded,
    chunkCount: processedCount,
    failedCount: 0,
    expectedAttempt: claimed.attempt,
  });

  const vectorCount = await countVectorsForGeneration(claimed.id);
  const expectedChunks = claimed.chunkCount > 0 ? claimed.chunkCount : processedCount;
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
      processedCount,
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
