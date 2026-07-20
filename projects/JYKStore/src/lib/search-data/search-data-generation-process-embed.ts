/**
 * Embedding rebuild + indexing completion / mismatch failure writes.
 */
import { rebuildPackEmbeddings } from "@/lib/chunk-embedding-service";
import { DOCLING_RETRIEVAL_CHUNK_TYPE } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { prisma } from "@/lib/prisma";
import { markSearchGenerationIndexing } from "@/lib/search-generation/search-generation-service";
import {
  assertGenerationDescriptorMatchesRuntime,
  resolveSearchGenerationEmbeddingDescriptor,
} from "@/lib/search-generation/search-generation-types";
import {
  assertPgvectorRuntimeReady,
  countVectorsForGeneration,
} from "@/lib/search-data/search-data-generation-shared";
import type { ClaimedSearchDataGeneration } from "@/lib/search-data/search-data-generation-types";
import { recordSearchDataGenerationCompleted } from "@/lib/search-data/search-data-generation-events";
import {
  markSearchDataGenerationFailed,
  SEARCH_DATA_FAILURE,
} from "@/lib/search-data/search-data-generation-failures";
import {
  markSearchDataIndexingPassed,
  markSearchDataIndexingRunning,
  markSearchDataIndexingVectorMismatch,
} from "@/lib/search-data/search-data-generation-transitions";

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
  await markSearchDataIndexingRunning({
    runId: claimed.pipelineRunId,
    searchIndexGenerationId: claimed.id,
    attempt: claimed.attempt,
  });
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
    await markSearchDataGenerationFailed({
      generationId: claimed.id,
      failureCode: SEARCH_DATA_FAILURE.VECTOR_COUNT_MISMATCH,
      failureMessage: `vectors=${vectorCount} chunks=${expectedChunks} embedded=${embedded}`,
      expectedAttempt: claimed.attempt,
    });
    await markSearchDataIndexingVectorMismatch({
      runId: claimed.pipelineRunId,
      vectorCount,
      expectedChunks,
    });
    return;
  }

  await markSearchDataIndexingPassed({
    runId: claimed.pipelineRunId,
    searchIndexGenerationId: claimed.id,
    attempt: claimed.attempt,
    processedCount,
    vectorCount,
  });

  await recordSearchDataGenerationCompleted({
    packId: claimed.packId,
    versionId: claimed.versionId,
    searchIndexGenerationId: claimed.id,
    chunkCount: expectedChunks,
    vectorCount,
    attempt: claimed.attempt,
  });
}
