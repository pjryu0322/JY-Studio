// P5: pgvector write path. Dual-writes alongside KnowledgeChunkEmbedding.vector (JSON) —
// this module never replaces the JSON column, it only mirrors it into SearchIndexVector
// via raw SQL so cosine search can eventually use HNSW/ivfflat instead of a full JS scan.

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { resolveChunkGenerationId } from "@/lib/search-generation/search-generation-binding";
import { prisma } from "@/lib/prisma";
import {
  handlePgvectorUnavailable,
  isFiniteNumberVector,
  isPgvectorUnavailableError,
  toVectorLiteral,
} from "@/lib/search-vector/search-vector-runtime";

export type SearchVectorWriteInput = {
  searchIndexGenerationId: string;
  chunkId: string;
  provider: string;
  model: string;
  dimension: number;
  contentHash: string;
  vector: number[];
};

export type SearchVectorWriteResult =
  | { ok: true; skipped: false }
  | { ok: true; skipped: true; reason: string };

type WriteClient = Prisma.TransactionClient | typeof prisma;

/**
 * Upserts one SearchIndexVector row. Validates:
 *  - vector is finite (no NaN/Infinity) and non-empty
 *  - vector.length === input.dimension
 *  - the chunk actually belongs to the generation's chunk binding
 *  - the generation exists
 * On pgvector-unavailable errors: throws SEARCH_RUNTIME_UNAVAILABLE in production,
 * returns { ok: true, skipped: true } in development/test (JSON-only fallback).
 */
export async function upsertSearchIndexVector(
  input: SearchVectorWriteInput,
  client: WriteClient = prisma,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SearchVectorWriteResult> {
  if (!isFiniteNumberVector(input.vector)) {
    throw new EmbeddingProviderError(
      "EMBEDDING_VECTOR_INVALID",
      "upsertSearchIndexVector: vector is empty or contains NaN/Infinity.",
    );
  }
  if (input.vector.length !== input.dimension) {
    throw new EmbeddingProviderError(
      "EMBEDDING_DIMENSION_MISMATCH",
      `upsertSearchIndexVector: expected dimension ${input.dimension}, got ${input.vector.length}.`,
    );
  }

  const generation = await client.searchIndexGeneration.findUnique({
    where: { id: input.searchIndexGenerationId },
    select: { id: true, chunkGenerationId: true },
  });
  if (!generation) {
    throw new EmbeddingProviderError(
      "SEARCH_RUNTIME_UNAVAILABLE",
      "upsertSearchIndexVector: search index generation not found.",
    );
  }

  const chunk = await client.knowledgeChunk.findUnique({
    where: { id: input.chunkId },
    select: { chunkGenerationId: true, metadata: true },
  });
  if (!chunk) {
    throw new EmbeddingProviderError(
      "SEARCH_RUNTIME_UNAVAILABLE",
      "upsertSearchIndexVector: chunk not found.",
    );
  }
  const chunkGenerationId = resolveChunkGenerationId(chunk);
  if (chunkGenerationId !== generation.chunkGenerationId) {
    throw new EmbeddingProviderError(
      "SEARCH_RUNTIME_UNAVAILABLE",
      "upsertSearchIndexVector: chunk does not belong to this search index generation.",
    );
  }

  const vectorLiteral = toVectorLiteral(input.vector);
  const id = randomUUID();

  try {
    await client.$executeRaw`
      INSERT INTO "SearchIndexVector"
        ("id", "searchIndexGenerationId", "chunkId", "provider", "model", "dimension", "contentHash", "vector", "createdAt", "updatedAt")
      VALUES
        (${id}, ${input.searchIndexGenerationId}, ${input.chunkId}, ${input.provider}, ${input.model}, ${input.dimension}, ${input.contentHash}, ${vectorLiteral}::vector, now(), now())
      ON CONFLICT ("searchIndexGenerationId", "chunkId", "provider", "model")
      DO UPDATE SET
        "dimension" = EXCLUDED."dimension",
        "contentHash" = EXCLUDED."contentHash",
        "vector" = EXCLUDED."vector",
        "updatedAt" = now()
    `;
    return { ok: true, skipped: false };
  } catch (error) {
    if (isPgvectorUnavailableError(error)) {
      handlePgvectorUnavailable("upsertSearchIndexVector", env);
      return {
        ok: true,
        skipped: true,
        reason: "pgvector unavailable in this environment — JSON-only fallback (dev/test).",
      };
    }
    throw error;
  }
}

export type SearchVectorBatchWriteResult = {
  upsertedCount: number;
  skippedCount: number;
  /** Present only when the whole batch was skipped (pgvector unavailable, dev/test). */
  skippedReason?: string;
};

/**
 * Batched variant of {@link upsertSearchIndexVector} for bulk import.
 *
 * Motivation: the worker-output DB import used to call the single-row upsert once
 * per chunk, so a large pack issued thousands of sequential round-trips inside one
 * interactive transaction and could exceed the transaction timeout. This helper
 * collapses those into one multi-row `INSERT ... ON CONFLICT` per `batchSize`
 * rows, so the same time budget covers far more data.
 *
 * Differences from the single-row upsert (intentional):
 *  - It does NOT re-verify per row that the chunk exists / belongs to the
 *    generation. Callers (worker-output DB import) create the chunks in the SAME
 *    transaction and have already asserted the generation descriptor, so those
 *    lookups would only re-introduce the O(n) round-trips this path removes.
 *  - It still validates every vector (finite + dimension) up front and preserves
 *    the pgvector-unavailable fallback policy (throws in prod / require mode,
 *    reports all rows skipped in dev/test).
 */
export async function upsertSearchIndexVectorsBatch(
  inputs: SearchVectorWriteInput[],
  client: WriteClient = prisma,
  env: NodeJS.ProcessEnv = process.env,
  batchSize = 500,
): Promise<SearchVectorBatchWriteResult> {
  if (inputs.length === 0) {
    return { upsertedCount: 0, skippedCount: 0 };
  }

  for (const input of inputs) {
    if (!isFiniteNumberVector(input.vector)) {
      throw new EmbeddingProviderError(
        "EMBEDDING_VECTOR_INVALID",
        `upsertSearchIndexVectorsBatch: vector for chunk ${input.chunkId} is empty or contains NaN/Infinity.`,
      );
    }
    if (input.vector.length !== input.dimension) {
      throw new EmbeddingProviderError(
        "EMBEDDING_DIMENSION_MISMATCH",
        `upsertSearchIndexVectorsBatch: expected dimension ${input.dimension}, got ${input.vector.length} for chunk ${input.chunkId}.`,
      );
    }
  }

  const effectiveBatchSize = Math.max(1, Math.floor(batchSize));
  let upsertedCount = 0;
  try {
    for (let start = 0; start < inputs.length; start += effectiveBatchSize) {
      const batch = inputs.slice(start, start + effectiveBatchSize);
      const rows = batch.map(
        (input) =>
          Prisma.sql`(${randomUUID()}, ${input.searchIndexGenerationId}, ${input.chunkId}, ${input.provider}, ${input.model}, ${input.dimension}, ${input.contentHash}, ${toVectorLiteral(input.vector)}::vector, now(), now())`,
      );
      await client.$executeRaw`
        INSERT INTO "SearchIndexVector"
          ("id", "searchIndexGenerationId", "chunkId", "provider", "model", "dimension", "contentHash", "vector", "createdAt", "updatedAt")
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("searchIndexGenerationId", "chunkId", "provider", "model")
        DO UPDATE SET
          "dimension" = EXCLUDED."dimension",
          "contentHash" = EXCLUDED."contentHash",
          "vector" = EXCLUDED."vector",
          "updatedAt" = now()
      `;
      upsertedCount += batch.length;
    }
    return { upsertedCount, skippedCount: 0 };
  } catch (error) {
    if (isPgvectorUnavailableError(error)) {
      handlePgvectorUnavailable("upsertSearchIndexVectorsBatch", env);
      return {
        upsertedCount: 0,
        skippedCount: inputs.length,
        skippedReason:
          "pgvector unavailable in this environment — JSON-only fallback (dev/test).",
      };
    }
    throw error;
  }
}

/**
 * Deletes SearchIndexVector rows for a chunk (used when a chunk is retired/replaced).
 * Silently no-ops when pgvector is unavailable outside production.
 */
export async function deleteSearchIndexVectorsForChunk(
  chunkId: string,
  client: WriteClient = prisma,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  try {
    await client.$executeRaw`DELETE FROM "SearchIndexVector" WHERE "chunkId" = ${chunkId}`;
  } catch (error) {
    if (isPgvectorUnavailableError(error)) {
      handlePgvectorUnavailable("deleteSearchIndexVectorsForChunk", env);
      return;
    }
    throw error;
  }
}

/**
 * Deletes all SearchIndexVector rows for a search index generation.
 *
 * KnowledgeChunk deletion cascades to KnowledgeChunkEmbedding but NOT to
 * SearchIndexVector (no chunk FK), so a generation re-import must clear the
 * generation's vectors up front to avoid orphaned/stale rows. Silently no-ops
 * when pgvector is unavailable outside production.
 */
export async function deleteSearchIndexVectorsForGeneration(
  searchIndexGenerationId: string,
  client: WriteClient = prisma,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  try {
    await client.$executeRaw`DELETE FROM "SearchIndexVector" WHERE "searchIndexGenerationId" = ${searchIndexGenerationId}`;
  } catch (error) {
    if (isPgvectorUnavailableError(error)) {
      handlePgvectorUnavailable("deleteSearchIndexVectorsForGeneration", env);
      return;
    }
    throw error;
  }
}
