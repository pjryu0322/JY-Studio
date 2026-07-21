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
