/**
 * Process-job orchestration: preconditions + embed/complete + fail paths.
 */
import { isEmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { ClaimedSearchDataGeneration } from "@/lib/search-data/search-data-generation-types";
import { assertProcessJobPreconditions } from "@/lib/search-data/search-data-generation-process-preconditions";
import {
  assertClaimReadyForEmbedding,
  completeEmbeddingIndexing,
  markIndexingStepRunning,
  rebuildClaimedPackEmbeddings,
} from "@/lib/search-data/search-data-generation-process-embed";
import { recordSearchDataGenerationFailed } from "@/lib/search-data/search-data-generation-events";
import {
  markSearchDataGenerationFailed,
  SEARCH_DATA_FAILURE,
} from "@/lib/search-data/search-data-generation-failures";
import { markSearchDataIndexingFailed } from "@/lib/search-data/search-data-generation-transitions";

export { assertProcessJobPreconditions };

export async function runSearchDataEmbeddingAndIndex(
  claimed: ClaimedSearchDataGeneration,
): Promise<void> {
  const ready = await assertClaimReadyForEmbedding(claimed);
  if (!ready) return;

  await markIndexingStepRunning(claimed);

  const embeddings = await rebuildClaimedPackEmbeddings(claimed);
  if (!embeddings) {
    throw new Error(`${SEARCH_DATA_FAILURE.INDEX_BUILD_FAILED}:embedding rebuild returned null`);
  }

  const embedded =
    embeddings.createdCount + embeddings.updatedCount + embeddings.skippedCount;

  await completeEmbeddingIndexing({
    claimed,
    embedded,
    processedCount: embeddings.processedCount,
  });
}

export async function failSearchDataProcessJob(
  claimed: ClaimedSearchDataGeneration,
  error: unknown,
): Promise<void> {
  const code = isEmbeddingProviderError(error)
    ? error.code
    : error instanceof PayloadServiceError
      ? error.code
      : error instanceof Error &&
          error.message.startsWith(SEARCH_DATA_FAILURE.INDEX_BUILD_FAILED)
        ? SEARCH_DATA_FAILURE.INDEX_BUILD_FAILED
        : SEARCH_DATA_FAILURE.INDEX_BUILD_FAILED;

  await markSearchDataGenerationFailed({
    generationId: claimed.id,
    failureCode: code,
    failureMessage: error instanceof Error ? error.message.slice(0, 300) : null,
    expectedAttempt: claimed.attempt,
  });

  await markSearchDataIndexingFailed({
    runId: claimed.pipelineRunId,
    failureCode: code,
  });

  await recordSearchDataGenerationFailed({
    packId: claimed.packId,
    searchIndexGenerationId: claimed.id,
    attempt: claimed.attempt,
    failureCode: code,
  });
}
