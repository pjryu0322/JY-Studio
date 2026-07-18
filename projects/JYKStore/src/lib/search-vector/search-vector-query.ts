// P5: pgvector read path. Every query is ALWAYS scoped by searchIndexGenerationId —
// this is the isolation invariant that keeps DRAFT/PRODUCTION/retired generations from
// ever leaking into each other's search results (§ P3/P4 generation invariants).

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  handlePgvectorUnavailable,
  isPgvectorUnavailableError,
  parseVectorLiteral,
  toVectorLiteral,
} from "@/lib/search-vector/search-vector-runtime";

export const SEARCH_VECTOR_SNIPPET_MAX_LENGTH = 240;

export type SearchVectorQueryInput = {
  /** Required — every vector query is isolated to exactly one generation. */
  searchIndexGenerationId: string;
  provider: string;
  model: string;
  queryVector: number[];
  limit: number;
  /**
   * When set (e.g. 384 for local-e5), distance expressions cast through
   * `vector(n)` so they can use the matching expression/partial HNSW index.
   */
  dimension?: number;
  /** Optional: restrict to this candidate set (used by hybrid re-ranking). */
  chunkIds?: string[];
};

export type SearchVectorQueryResult = {
  chunkId: string;
  score: number;
  title: string;
  snippet: string;
};

function assertIsolationScope(input: Pick<SearchVectorQueryInput, "searchIndexGenerationId">): void {
  if (!input.searchIndexGenerationId || !input.searchIndexGenerationId.trim()) {
    throw new Error(
      "buildSearchVectorQuerySql: searchIndexGenerationId is required (generation isolation invariant).",
    );
  }
}

function resolveVectorTypmod(dimension: number | undefined): number | null {
  if (
    typeof dimension !== "number" ||
    !Number.isInteger(dimension) ||
    dimension <= 0 ||
    dimension > 16_000
  ) {
    return null;
  }
  return dimension;
}

/**
 * Builds the cosine-distance HNSW-ready SQL for a top-K vector search, always
 * filtered by searchIndexGenerationId (+ provider/model, + optional chunkId set).
 * Pure/side-effect-free so it can be unit tested without a database.
 */
export function buildSearchVectorQuerySql(input: SearchVectorQueryInput): Prisma.Sql {
  assertIsolationScope(input);
  const vectorLiteral = toVectorLiteral(input.queryVector);
  const limit = Math.max(1, Math.min(Math.trunc(input.limit) || 1, 200));
  const typmod = resolveVectorTypmod(input.dimension);

  const chunkFilter =
    input.chunkIds && input.chunkIds.length > 0
      ? Prisma.sql`AND sv."chunkId" IN (${Prisma.join(input.chunkIds)})`
      : Prisma.empty;

  // Typmod must be a SQL literal (not a bind param) to match expression indexes.
  const left =
    typmod === null
      ? Prisma.sql`sv."vector"`
      : Prisma.sql`(sv."vector"::vector(${Prisma.raw(String(typmod))}))`;
  const right =
    typmod === null
      ? Prisma.sql`${vectorLiteral}::vector`
      : Prisma.sql`(${vectorLiteral}::vector(${Prisma.raw(String(typmod))}))`;

  return Prisma.sql`
    SELECT
      sv."chunkId" AS "chunkId",
      kc."title" AS "title",
      kc."content" AS "content",
      (${left} <=> ${right}) AS "distance"
    FROM "SearchIndexVector" sv
    JOIN "KnowledgeChunk" kc ON kc."id" = sv."chunkId"
    WHERE sv."searchIndexGenerationId" = ${input.searchIndexGenerationId}
      AND sv."provider" = ${input.provider}
      AND sv."model" = ${input.model}
      ${chunkFilter}
    ORDER BY ${left} <=> ${right} ASC
    LIMIT ${limit}
  `;
}

function toSnippet(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= SEARCH_VECTOR_SNIPPET_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, SEARCH_VECTOR_SNIPPET_MAX_LENGTH)}…`;
}

/**
 * pgvector `<=>` with `vector_cosine_ops` returns cosine distance = `1 - cosine_similarity`.
 * Convert to clamped similarity in [0, 1] (negative similarities map to 0).
 */
export function cosineDistanceToSimilarity(distance: number): number {
  if (!Number.isFinite(distance)) return 0;
  const similarity = 1 - distance;
  if (Number.isNaN(similarity)) return 0;
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Runs the top-K cosine search, always scoped to searchIndexGenerationId.
 * Returns `null` when pgvector is unavailable in development/test (signal to fall
 * back to JSON-only ranking); throws SEARCH_RUNTIME_UNAVAILABLE in production.
 */
export async function querySearchIndexVectorsByGeneration(
  input: SearchVectorQueryInput,
  client: typeof prisma = prisma,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SearchVectorQueryResult[] | null> {
  try {
    const sql = buildSearchVectorQuerySql(input);
    const rows = await client.$queryRaw<
      Array<{ chunkId: string; title: string; content: string; distance: number }>
    >(sql);
    return rows.map((row) => ({
      chunkId: row.chunkId,
      score: cosineDistanceToSimilarity(row.distance),
      title: row.title,
      snippet: toSnippet(row.content),
    }));
  } catch (error) {
    if (isPgvectorUnavailableError(error)) {
      handlePgvectorUnavailable("querySearchIndexVectorsByGeneration", env);
      return null;
    }
    throw error;
  }
}

/**
 * Loads raw vectors for a specific chunk-id set within one generation — used by
 * hybrid-ranking-service to re-score already keyword/metadata-filtered candidates
 * without a second full HNSW top-K search. Same isolation + unavailability rules
 * as querySearchIndexVectorsByGeneration.
 */
export async function loadSearchIndexVectorsByChunkIds(
  input: {
    searchIndexGenerationId: string;
    provider: string;
    model: string;
    chunkIds: string[];
  },
  client: typeof prisma = prisma,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Map<string, number[]> | null> {
  assertIsolationScope(input);
  if (input.chunkIds.length === 0) return new Map();
  try {
    const rows = await client.$queryRaw<Array<{ chunkId: string; vectorText: string }>>`
      SELECT sv."chunkId" AS "chunkId", sv."vector"::text AS "vectorText"
      FROM "SearchIndexVector" sv
      WHERE sv."searchIndexGenerationId" = ${input.searchIndexGenerationId}
        AND sv."provider" = ${input.provider}
        AND sv."model" = ${input.model}
        AND sv."chunkId" IN (${Prisma.join(input.chunkIds)})
    `;
    const map = new Map<string, number[]>();
    for (const row of rows) {
      map.set(row.chunkId, parseVectorLiteral(row.vectorText));
    }
    return map;
  } catch (error) {
    if (isPgvectorUnavailableError(error)) {
      handlePgvectorUnavailable("loadSearchIndexVectorsByChunkIds", env);
      return null;
    }
    throw error;
  }
}
