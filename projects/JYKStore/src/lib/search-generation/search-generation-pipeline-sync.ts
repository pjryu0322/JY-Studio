import { type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE,
  DOCLING_RETRIEVAL_CHUNK_TYPE,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { computeSearchGenerationFingerprint } from "@/lib/search-generation/search-generation-fingerprint";
import { defaultLocalEmbeddingDescriptor } from "@/lib/search-generation/search-generation-types";

type SyncClient = Prisma.TransactionClient | typeof prisma;

function metaRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function metaString(meta: Record<string, unknown> | null, key: string): string | null {
  if (!meta) return null;
  const v = meta[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Derive the binding + embedding descriptor for a generation from its chunks.
 * Returns null when metadata is insufficient (legacy pre-P4 chunks).
 */
async function resolveGenerationContext(
  client: SyncClient,
  versionId: string,
  indexGenerationId: string,
) {
  const version = await client.knowledgePackVersion.findUnique({
    where: { id: versionId },
    select: { packId: true },
  });
  if (!version) return null;

  const chunks = await client.knowledgeChunk.findMany({
    where: {
      versionId,
      chunkType: {
        in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
      },
      metadata: { path: ["indexGenerationId"], equals: indexGenerationId },
    },
    select: { id: true, chunkType: true, metadata: true },
  });
  if (chunks.length === 0) return null;

  const sample = metaRecord(chunks[0]!.metadata);
  const pipelineRunId = metaString(sample, "pipelineRunId");
  const normalizedDocumentId = metaString(sample, "normalizedDocumentId");
  const fingerprint =
    metaString(sample, "normalizedDocumentFingerprint") ?? metaString(sample, "fingerprint");
  if (!pipelineRunId || !normalizedDocumentId || !fingerprint) return null;

  const retrievalChunkIds = chunks
    .filter((c) => c.chunkType === DOCLING_RETRIEVAL_CHUNK_TYPE)
    .map((c) => c.id);
  const embeddings = await client.knowledgeChunkEmbedding.findMany({
    where: { chunkId: { in: retrievalChunkIds.length ? retrievalChunkIds : chunks.map((c) => c.id) } },
    select: { chunkId: true, provider: true, model: true, dimension: true, contentHash: true },
  });
  const contentHashByChunk = new Map(embeddings.map((e) => [e.chunkId, e.contentHash]));
  const descriptor = embeddings[0]
    ? {
        embeddingProvider: embeddings[0].provider,
        embeddingModel: embeddings[0].model,
        embeddingDimension: embeddings[0].dimension,
        distanceMetric: defaultLocalEmbeddingDescriptor().distanceMetric,
      }
    : defaultLocalEmbeddingDescriptor();

  const fingerprintChunkIds = retrievalChunkIds.length ? retrievalChunkIds : chunks.map((c) => c.id);
  const generationFingerprint = computeSearchGenerationFingerprint({
    packId: version.packId,
    versionId,
    pipelineRunId,
    normalizedDocumentId,
    chunkGenerationId: indexGenerationId,
    normalizedDocumentFingerprint: fingerprint,
    ...descriptor,
    chunks: fingerprintChunkIds.map((id) => ({
      chunkId: id,
      contentHash: contentHashByChunk.get(id) ?? "",
    })),
  });

  return {
    packId: version.packId,
    pipelineRunId,
    normalizedDocumentId,
    fingerprint,
    descriptor,
    generationFingerprint,
    chunkCount: retrievalChunkIds.length,
    embeddedCount: embeddings.length,
  };
}

/**
 * §31/§33 — On draft-index activation (SEARCH_EVALUATING PASS): upsert the
 * generation to READY/DRAFT and mark other active drafts for the version STALE.
 * Best-effort: never throws (tracking only).
 */
export async function syncSearchGenerationReady(input: {
  versionId: string;
  indexGenerationId: string;
}): Promise<void> {
  try {
    const ctx = await resolveGenerationContext(prisma, input.versionId, input.indexGenerationId);
    if (!ctx) return;

    await prisma.searchIndexGeneration.upsert({
      where: { id: input.indexGenerationId },
      create: {
        id: input.indexGenerationId,
        packId: ctx.packId,
        versionId: input.versionId,
        pipelineRunId: ctx.pipelineRunId,
        normalizedDocumentId: ctx.normalizedDocumentId,
        chunkGenerationId: input.indexGenerationId,
        fingerprint: ctx.fingerprint,
        ...ctx.descriptor,
        chunkCount: ctx.chunkCount,
        embeddedCount: ctx.embeddedCount,
        generationFingerprint: ctx.generationFingerprint,
        status: "READY",
        scope: "DRAFT",
        completedAt: new Date(),
      },
      update: {
        status: "READY",
        scope: "DRAFT",
        chunkCount: ctx.chunkCount,
        embeddedCount: ctx.embeddedCount,
        generationFingerprint: ctx.generationFingerprint,
        completedAt: new Date(),
        staleAt: null,
      },
    });

    await prisma.searchIndexGeneration.updateMany({
      where: {
        versionId: input.versionId,
        scope: "DRAFT",
        status: { notIn: ["FAILED", "STALE", "RETIRED"] },
        id: { not: input.indexGenerationId },
      },
      data: { status: "STALE", staleAt: new Date() },
    });
  } catch {
    // Tracking only — never break the pipeline.
  }
}

/** §32 — Mark the generation FAILED when the draft build fails. Best-effort. */
export async function syncSearchGenerationFailed(input: {
  versionId: string;
  indexGenerationId: string;
  failureCode?: string;
  failureMessage?: string | null;
}): Promise<void> {
  try {
    const existing = await prisma.searchIndexGeneration.findUnique({
      where: { id: input.indexGenerationId },
      select: { id: true },
    });
    if (!existing) return;
    await prisma.searchIndexGeneration.update({
      where: { id: input.indexGenerationId },
      data: {
        status: "FAILED",
        failureCode: input.failureCode ?? "PIPELINE_FAILED",
        failureMessage: input.failureMessage ?? null,
      },
    });
  } catch {
    // Tracking only.
  }
}

/**
 * §36 — Promote the validated generation to PRODUCTION within the admin approval
 * transaction. The validated generation must equal the promoted generation.
 * No-op when the generation row does not exist (legacy packs pre-backfill).
 */
export async function syncSearchGenerationPromotion(input: {
  versionId: string;
  indexGenerationId: string;
  tx: Prisma.TransactionClient;
}): Promise<void> {
  const generation = await input.tx.searchIndexGeneration.findUnique({
    where: { id: input.indexGenerationId },
    select: { id: true, versionId: true, status: true, scope: true },
  });
  if (!generation) return;
  if (generation.versionId !== input.versionId) return;
  if (generation.scope === "PRODUCTION" && generation.status === "PROMOTED") return;

  await input.tx.searchIndexGeneration.updateMany({
    where: {
      versionId: input.versionId,
      scope: "PRODUCTION",
      status: "PROMOTED",
      id: { not: input.indexGenerationId },
    },
    data: { status: "RETIRED", retiredAt: new Date() },
  });
  await input.tx.searchIndexGeneration.update({
    where: { id: input.indexGenerationId },
    data: { scope: "PRODUCTION", status: "PROMOTED", promotedAt: new Date() },
  });
}
