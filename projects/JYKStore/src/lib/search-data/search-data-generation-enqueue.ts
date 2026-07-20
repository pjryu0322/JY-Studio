import { AuditAction } from "@prisma/client";
import { isEmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import { type SearchDataStatusResponse } from "@/lib/search-data/search-data-state";
import { provisionalEnqueueLocalE5Descriptor } from "@/lib/search-data/search-data-generation-policy";
import { failureResponse } from "@/lib/search-data/search-data-generation-shared";
import { type SearchDataGenerateAccepted } from "@/lib/search-data/search-data-generation-types";
import { getSearchDataStatus } from "@/lib/search-data/search-data-generation-status";
import {
  assertSearchDataEnqueuePreflight,
  type SearchDataEnqueuePreflightOk,
} from "@/lib/search-data/search-data-generation-enqueue-preflight";
import {
  runSearchDataEnqueueTransaction,
  type EnqueueTxResult,
} from "@/lib/search-data/search-data-generation-enqueue-tx";

function mapEnqueueCatchError(error: unknown) {
  const code = isEmbeddingProviderError(error)
    ? error.code
    : error instanceof PayloadServiceError
      ? error.code
      : "SEARCH_DATA_CLEANUP_FAILED";
  const mapped =
    code === "SEARCH_DATA_CLEANUP_FAILED" ||
    (error instanceof Error &&
      /delete|foreign key|constraint|deadlock|timeout/i.test(error.message))
      ? "SEARCH_DATA_CLEANUP_FAILED"
      : code;
  return failureResponse(mapped);
}

async function resolveEnqueueAccepted(input: {
  userId: string;
  clientId: string;
  packId: string;
  preflight: SearchDataEnqueuePreflightOk;
  enqueueResult: Extract<EnqueueTxResult, { kind: "enqueued" }>;
}): Promise<SearchDataGenerateAccepted> {
  const { preflight, enqueueResult } = input;
  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      event: preflight.forceRegenerate
        ? "SEARCH_DATA_GENERATION_FORCE_ENQUEUED"
        : "SEARCH_DATA_GENERATION_ENQUEUED",
      packId: input.packId,
      versionId: preflight.versionId,
      pipelineRunId: preflight.latestPipelineRunId,
      normalizedDocumentId: preflight.binding.normalizedDocumentId,
      chunkGenerationId: preflight.indexGenerationId,
      searchIndexGenerationId: preflight.indexGenerationId,
      chunkCount: preflight.chunkCount,
      previousAttempt: enqueueResult.previousAttempt,
      attempt: enqueueResult.generation.attempt,
      forceRegenerate: enqueueResult.forceRegenerate,
      scaffoldReused: enqueueResult.scaffoldReused,
    },
  });
  return {
    accepted: true,
    state: "CREATING",
    searchIndexGenerationId: enqueueResult.generation.id,
    processedCount: 0,
    chunkCount: preflight.chunkCount,
  };
}

/**
 * Enqueues Local E5 Draft SearchIndexGeneration as PENDING (HTTP 202).
 * Embedding / pgvector preflight runs in search-data-generation-worker.
 */
export async function startSearchDataGeneration(input: {
  userId: string;
  clientId: string;
  packId: string;
  forceRegenerate?: boolean;
}): Promise<
  | { error: "NOT_FOUND" | "PROFILE_REQUIRED" | "INVALID"; message: string; code?: string }
  | SearchDataGenerateAccepted
  | SearchDataStatusResponse
> {
  const preflight = await assertSearchDataEnqueuePreflight(input);
  if (!preflight.ok) {
    return { error: preflight.error, message: preflight.message, code: preflight.code };
  }

  try {
    // No sync pgvector / Local E5 health check here — worker persists failures on Generation.
    const descriptor = provisionalEnqueueLocalE5Descriptor();
    const enqueueResult = await prisma.$transaction(async (tx) =>
      runSearchDataEnqueueTransaction({
        tx,
        packId: input.packId,
        versionId: preflight.versionId,
        latestPipelineRunId: preflight.latestPipelineRunId,
        binding: preflight.binding,
        indexGenerationId: preflight.indexGenerationId,
        chunkCount: preflight.chunkCount,
        forceRegenerate: preflight.forceRegenerate,
        descriptor,
      }),
    );

    if (enqueueResult.kind === "already_complete") {
      return getSearchDataStatus(input) as Promise<SearchDataStatusResponse>;
    }
    if (enqueueResult.kind === "already_running") {
      return {
        accepted: true,
        state: "CREATING",
        searchIndexGenerationId: enqueueResult.generation.id,
        processedCount: enqueueResult.generation.embeddedCount,
        chunkCount: enqueueResult.generation.chunkCount || preflight.chunkCount,
      };
    }
    return resolveEnqueueAccepted({ ...input, preflight, enqueueResult });
  } catch (error) {
    return mapEnqueueCatchError(error);
  }
}
