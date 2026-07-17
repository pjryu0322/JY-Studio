// P5: async embedding provider adapter interface.
// Every concrete adapter (local-hash, openai, ...) implements this so callers can
// swap providers without touching chunk-embedding-service / hybrid-ranking-service.

import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";

export type EmbeddingDescriptor = {
  provider: string;
  model: string;
  dimension: number;
};

export type EmbeddingRequest = {
  text: string;
  signal?: AbortSignal;
};

export type EmbeddingResult = {
  provider: string;
  model: string;
  dimension: number;
  vector: number[];
};

export type EmbeddingBatchRequest = {
  texts: string[];
  signal?: AbortSignal;
};

export type EmbeddingBatchResult = {
  provider: string;
  model: string;
  dimension: number;
  vectors: number[][];
};

export type EmbeddingProviderHealth = {
  ok: boolean;
  provider: string;
  checkedAt: string;
  /** Present when ok === false. Never includes secrets. */
  message?: string;
  /** Present for providers that are usable but not production-grade (e.g. local-hash). */
  warning?: string;
};

export interface EmbeddingProviderAdapter {
  readonly id: string;
  resolveDescriptor(): EmbeddingDescriptor;
  embed(input: EmbeddingRequest): Promise<EmbeddingResult>;
  embedBatch(input: EmbeddingBatchRequest): Promise<EmbeddingBatchResult>;
  healthCheck(): Promise<EmbeddingProviderHealth>;
}

export function isFiniteNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

/**
 * Shared guard used by every adapter: rejects empty vectors and vectors that
 * contain NaN/Infinity, and enforces the declared dimension.
 */
export function assertFiniteVector(
  vector: unknown,
  dimension: number,
  context: string,
): asserts vector is number[] {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new EmbeddingProviderError(
      "EMBEDDING_VECTOR_INVALID",
      `${context}: embedding vector is empty.`,
    );
  }
  if (!isFiniteNumberArray(vector)) {
    throw new EmbeddingProviderError(
      "EMBEDDING_VECTOR_INVALID",
      `${context}: embedding vector contains NaN/Infinity or non-numeric values.`,
    );
  }
  if (vector.length !== dimension) {
    throw new EmbeddingProviderError(
      "EMBEDDING_DIMENSION_MISMATCH",
      `${context}: embedding dimension mismatch (expected ${dimension}, got ${vector.length}).`,
    );
  }
}

export function assertNotCancelled(signal: AbortSignal | undefined, context: string): void {
  if (signal?.aborted) {
    throw new EmbeddingProviderError(
      "EMBEDDING_REQUEST_CANCELLED",
      `${context}: embedding request was cancelled.`,
    );
  }
}
