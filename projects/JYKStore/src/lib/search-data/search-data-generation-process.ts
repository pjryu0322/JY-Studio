/**
 * Process-job orchestration: preconditions + embed/complete + fail paths.
 */
import { AuditAction } from "@prisma/client";
import { isEmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { recordProviderAudit } from "@/lib/provider-audit";
import { completePipelineStep } from "@/lib/pipeline-service";
import { markSearchGenerationFailed } from "@/lib/search-generation/search-generation-service";
import { mapSearchDataFailureCode } from "@/lib/search-data/search-data-error";
import type { ClaimedSearchDataGeneration } from "@/lib/search-data/search-data-generation-types";
import { assertProcessJobPreconditions } from "@/lib/search-data/search-data-generation-process-preconditions";
import {
  assertClaimReadyForEmbedding,
  completeEmbeddingIndexing,
  markIndexingStepRunning,
  rebuildClaimedPackEmbeddings,
} from "@/lib/search-data/search-data-generation-process-embed";

export { assertProcessJobPreconditions };

export async function runSearchDataEmbeddingAndIndex(
  claimed: ClaimedSearchDataGeneration,
): Promise<void> {
  const ready = await assertClaimReadyForEmbedding(claimed);
  if (!ready) return;

  await markIndexingStepRunning(claimed);

  const embeddings = await rebuildClaimedPackEmbeddings(claimed);
  if (!embeddings) {
    throw new Error("INDEX_BUILD_FAILED:embedding rebuild returned null");
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
