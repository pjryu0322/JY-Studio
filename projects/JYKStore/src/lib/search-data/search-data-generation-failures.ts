/**
 * Search-data generation failure codes + mark-failed write helper.
 * Provider-facing copy stays in search-data-error.ts (mapSearchDataFailureCode).
 */
import { markSearchGenerationFailed } from "@/lib/search-generation/search-generation-service";

export const SEARCH_DATA_FAILURE = {
  PACK_NOT_DRAFT: "PACK_NOT_DRAFT",
  BINDING_STALE: "SEARCH_DATA_BINDING_STALE",
  VECTOR_COUNT_MISMATCH: "VECTOR_COUNT_MISMATCH",
  INDEX_BUILD_FAILED: "INDEX_BUILD_FAILED",
  RECOVERY_FAILED: "SEARCH_DATA_RECOVERY_FAILED",
  RETRIEVAL_EVALUATION_FAILED: "RETRIEVAL_EVALUATION_FAILED",
  CLEANUP_FAILED: "SEARCH_DATA_CLEANUP_FAILED",
} as const;

export type SearchDataFailureCode =
  (typeof SEARCH_DATA_FAILURE)[keyof typeof SEARCH_DATA_FAILURE];

export async function markSearchDataGenerationFailed(input: {
  generationId: string;
  failureCode: string;
  failureMessage?: string | null;
  expectedAttempt?: number;
}): Promise<void> {
  await markSearchGenerationFailed(input.generationId, {
    failureCode: input.failureCode,
    failureMessage: input.failureMessage ?? null,
    expectedAttempt: input.expectedAttempt,
  }).catch(() => undefined);
}
