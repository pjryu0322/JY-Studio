// P5: shared pgvector-availability detection + prod/dev gating used by both
// search-vector-store.ts (writes) and search-vector-query.ts (reads).

import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";

/**
 * Heuristically detects "pgvector is not installed/available on this Postgres
 * instance" from a raw-SQL error message. Covers:
 *  - relation "SearchIndexVector" does not exist (table skipped by the migration)
 *  - type "vector" does not exist (extension never created)
 *  - access method "hnsw"/"ivfflat" does not exist (older pgvector, no index — not
 *    a hard failure by itself, but grouped here defensively since it implies an
 *    incomplete pgvector install)
 */
export function isPgvectorUnavailableError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const missingRelation =
    message.includes("does not exist") ||
    message.includes("없습니다") ||
    message.includes("undefined_table") ||
    message.includes("42p01");
  return (
    (message.includes("searchindexvector") && missingRelation) ||
    (message.includes('"vector"') && missingRelation) ||
    message.includes("type vector does not exist") ||
    (message.includes("access method") && missingRelation)
  );
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production";
}

function isTruthyEnv(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

/**
 * When true, missing pgvector must hard-fail even outside production
 * (P5.2 integration / local retrieval verification).
 */
export function isPgvectorRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return isProductionRuntime(env) || isTruthyEnv(env.JYKSTORE_REQUIRE_PGVECTOR);
}

/**
 * Central policy for "what happens when pgvector is unavailable":
 *  - production OR JYKSTORE_REQUIRE_PGVECTOR: hard fail — SEARCH_RUNTIME_UNAVAILABLE.
 *  - development/test otherwise: return a sentinel so the caller can fall back to JSON-only.
 */
export function handlePgvectorUnavailable(
  context: string,
  env: NodeJS.ProcessEnv = process.env,
): "fallback" {
  if (isPgvectorRequired(env)) {
    throw new EmbeddingProviderError(
      "SEARCH_RUNTIME_UNAVAILABLE",
      `${context}: pgvector runtime is unavailable` +
        (isProductionRuntime(env)
          ? " in production. No fallback to JSON-only/local-hash search is permitted."
          : " (JYKSTORE_REQUIRE_PGVECTOR=true). No JSON-only fallback is permitted."),
    );
  }
  return "fallback";
}

export function isFiniteNumberVector(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

/** Serializes a numeric vector into the pgvector text literal format, e.g. "[0.1,0.2]". */
export function toVectorLiteral(vector: number[]): string {
  if (!isFiniteNumberVector(vector)) {
    throw new EmbeddingProviderError(
      "EMBEDDING_VECTOR_INVALID",
      "toVectorLiteral: vector is empty or contains NaN/Infinity/non-numeric values.",
    );
  }
  return `[${vector.join(",")}]`;
}

/** Parses a pgvector text representation (e.g. "[0.1,0.2]") back into a number[]. */
export function parseVectorLiteral(literal: string): number[] {
  const trimmed = literal.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (trimmed.length === 0) return [];
  return trimmed.split(",").map((part) => Number(part));
}
