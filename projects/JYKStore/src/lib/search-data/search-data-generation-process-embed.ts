/**
 * P7.6: Legacy Docling embed step is fail-closed.
 *
 * TS document/chunk embedding GENERATION has been removed — the Python Worker
 * (ZIP pipeline) is the single source of embeddings (`embeddings.json`) and the
 * Store only validates/persists/reflects that output. The former TS
 * chunk-embedding generator therefore no longer exists; the legacy Docling
 * search-data generation embed step throws `LEGACY_BUILDER_DISABLED` instead of
 * re-embedding on the TS side.
 *
 * Indexing completion / mismatch failure writes are retained for the
 * Worker-driven generation lifecycle bookkeeping.
 */
import type { EmbeddingRebuildResultDto } from "@/lib/embedding-dto";
import { LEGACY_BUILDER_DISABLED_ERROR } from "@/lib/legacy-builder-disabled";
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

/**
 * P7.6: fail-closed. TS document/chunk embedding generation is removed. The
 * Python Worker (ZIP pipeline) produces `embeddings.json`; the Store never
 * re-embeds on the TS side. The legacy Docling search-data generation embed
 * step therefore refuses to run instead of generating vectors in TypeScript.
 */
export async function rebuildClaimedPackEmbeddings(
  claimed: ClaimedSearchDataGeneration,
): Promise<EmbeddingRebuildResultDto> {
  void claimed;
  throw new Error(
    `${LEGACY_BUILDER_DISABLED_ERROR}: 내부 TS 문서/청크 임베딩 생성은 종료되었습니다. ` +
      "임베딩은 ZIP Worker(embeddings.json)에서만 생성됩니다.",
  );
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
