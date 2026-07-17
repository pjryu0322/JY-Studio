import { type Prisma, type SearchIndexGeneration } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  DOCLING_RETRIEVAL_CHUNK_TYPE,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { prisma } from "@/lib/prisma";
import { computeSearchGenerationFingerprint } from "@/lib/search-generation/search-generation-fingerprint";
import {
  createDraftSearchGeneration,
  loadSearchGeneration,
  markSearchGenerationFailed,
  markSearchGenerationReady,
  markSearchGenerationStale,
  promoteSearchGeneration,
} from "@/lib/search-generation/search-generation-service";
import { resolveSearchGenerationEmbeddingDescriptor } from "@/lib/search-generation/search-generation-types";

type SyncClient = Prisma.TransactionClient | typeof prisma;

/**
 * Create authoritative DRAFT/PENDING SearchIndexGeneration for a Docling pipeline run.
 * Stales prior active drafts for the version. Failures propagate to the pipeline.
 */
export async function createSearchGenerationForPipeline(input: {
  id: string;
  packId: string;
  versionId: string;
  pipelineRunId: string;
  normalizedDocumentId: string;
  fingerprint: string;
  chunkGenerationId: string;
  descriptor?: ReturnType<typeof resolveSearchGenerationEmbeddingDescriptor>;
}): Promise<SearchIndexGeneration> {
  const descriptor = input.descriptor ?? resolveSearchGenerationEmbeddingDescriptor();
  const provisionalFingerprint = computeSearchGenerationFingerprint({
    packId: input.packId,
    versionId: input.versionId,
    pipelineRunId: input.pipelineRunId,
    normalizedDocumentId: input.normalizedDocumentId,
    chunkGenerationId: input.chunkGenerationId,
    normalizedDocumentFingerprint: input.fingerprint,
    ...descriptor,
    chunks: [],
  });

  await markSearchGenerationStale(input.versionId, prisma, { exceptId: input.id });

  return createDraftSearchGeneration({
    id: input.id,
    packId: input.packId,
    versionId: input.versionId,
    pipelineRunId: input.pipelineRunId,
    normalizedDocumentId: input.normalizedDocumentId,
    chunkGenerationId: input.chunkGenerationId,
    fingerprint: input.fingerprint,
    ...descriptor,
    generationFingerprint: provisionalFingerprint,
  });
}

async function resolveReadyFingerprint(
  client: SyncClient,
  generation: SearchIndexGeneration,
): Promise<{ generationFingerprint: string; chunkCount: number; embeddedCount: number }> {
  const chunks = await client.knowledgeChunk.findMany({
    where: {
      versionId: generation.versionId,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
      OR: [
        { chunkGenerationId: generation.chunkGenerationId },
        {
          AND: [
            { chunkGenerationId: null },
            { metadata: { path: ["indexGenerationId"], equals: generation.chunkGenerationId } },
          ],
        },
      ],
    },
    select: { id: true },
  });
  const embeddings = await client.knowledgeChunkEmbedding.findMany({
    where: { searchIndexGenerationId: generation.id },
    select: { chunkId: true, contentHash: true, provider: true, model: true, dimension: true },
  });
  const contentHashByChunk = new Map(embeddings.map((e) => [e.chunkId, e.contentHash]));
  const generationFingerprint = computeSearchGenerationFingerprint({
    packId: generation.packId,
    versionId: generation.versionId,
    pipelineRunId: generation.pipelineRunId,
    normalizedDocumentId: generation.normalizedDocumentId,
    chunkGenerationId: generation.chunkGenerationId,
    normalizedDocumentFingerprint: generation.fingerprint,
    embeddingProvider: generation.embeddingProvider,
    embeddingModel: generation.embeddingModel,
    embeddingDimension: generation.embeddingDimension,
    distanceMetric: generation.distanceMetric,
    chunks: chunks.map((c) => ({
      chunkId: c.id,
      contentHash: contentHashByChunk.get(c.id) ?? "",
    })),
  });
  return {
    generationFingerprint,
    chunkCount: chunks.length,
    embeddedCount: embeddings.length,
  };
}

/**
 * On draft-index activation (SEARCH_EVALUATING PASS): transition generation to READY/DRAFT
 * and mark other active drafts STALE. Failures propagate — never swallowed.
 */
export async function syncSearchGenerationReady(input: {
  versionId: string;
  indexGenerationId: string;
}): Promise<SearchIndexGeneration> {
  const generation = await loadSearchGeneration(input.indexGenerationId);
  if (!generation) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_FOUND",
      "검색 인덱스 생성 세대가 없어 READY로 전환할 수 없습니다.",
      404,
    );
  }
  if (generation.versionId !== input.versionId) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_MISMATCH",
      "검색 세대 version 바인딩이 일치하지 않습니다.",
      409,
    );
  }
  if (generation.status === "READY" && generation.scope === "DRAFT") {
    await markSearchGenerationStale(input.versionId, prisma, {
      exceptId: input.indexGenerationId,
    });
    return generation;
  }

  const resolved = await resolveReadyFingerprint(prisma, generation);
  await prisma.searchIndexGeneration.update({
    where: { id: generation.id },
    data: {
      chunkCount: resolved.chunkCount,
      embeddedCount: resolved.embeddedCount,
      generationFingerprint: resolved.generationFingerprint,
    },
  });

  const ready = await markSearchGenerationReady(input.indexGenerationId, {
    chunkCount: resolved.chunkCount,
    embeddedCount: resolved.embeddedCount,
    generationFingerprint: resolved.generationFingerprint,
  });

  await markSearchGenerationStale(input.versionId, prisma, {
    exceptId: input.indexGenerationId,
  });
  return ready;
}

/** Mark the generation FAILED when the draft build fails. Propagates errors. */
export async function syncSearchGenerationFailed(input: {
  versionId: string;
  indexGenerationId: string;
  failureCode?: string;
  failureMessage?: string | null;
}): Promise<void> {
  const existing = await loadSearchGeneration(input.indexGenerationId);
  if (!existing) {
    // Generation was never created (failed before PENDING) — nothing to mark.
    return;
  }
  if (existing.versionId !== input.versionId) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_MISMATCH",
      "검색 세대 version 바인딩이 일치하지 않습니다.",
      409,
    );
  }
  if (existing.status === "FAILED" || existing.status === "STALE" || existing.status === "RETIRED") {
    return;
  }
  if (existing.status === "READY" || existing.status === "PROMOTED") {
    // Activation already succeeded; do not demote.
    return;
  }
  await markSearchGenerationFailed(input.indexGenerationId, {
    failureCode: input.failureCode ?? "PIPELINE_FAILED",
    failureMessage: input.failureMessage ?? null,
  });
}

/**
 * Promote the validated generation to PRODUCTION within the admin approval transaction.
 * Missing generation is a hard failure (no silent no-op).
 */
export async function syncSearchGenerationPromotion(input: {
  versionId: string;
  indexGenerationId: string;
  tx: Prisma.TransactionClient;
}): Promise<SearchIndexGeneration> {
  const generation = await input.tx.searchIndexGeneration.findUnique({
    where: { id: input.indexGenerationId },
  });
  if (!generation) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_FOUND",
      "승인할 검색 인덱스 생성 세대가 없습니다.",
      404,
    );
  }
  if (generation.versionId !== input.versionId) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_MISMATCH",
      "검색 세대 version 바인딩이 일치하지 않습니다.",
      409,
    );
  }
  if (generation.scope === "PRODUCTION" && generation.status === "PROMOTED") {
    return generation;
  }
  return promoteSearchGeneration(input.indexGenerationId, input.tx);
}
