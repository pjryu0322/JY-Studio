/**
 * Pure / lightweight judgment helpers for enqueue transaction branching.
 */
import type { SearchIndexGeneration } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { LOCAL_E5_EMBEDDING_PROVIDER } from "@/lib/embedding/e5-embedding-constants";

export type LockedGenerationLike = Pick<
  SearchIndexGeneration,
  | "id"
  | "scope"
  | "status"
  | "attempt"
  | "embeddingProvider"
  | "embeddingDimension"
  | "embeddedCount"
  | "failedCount"
  | "chunkCount"
>;

/** Scaffold (PENDING/attempt=0) is NOT running — user must enqueue first. */
export function isActivelyRunningLockedGeneration(
  locked: LockedGenerationLike | null | undefined,
): boolean {
  if (!locked) return false;
  return (
    locked.scope === "DRAFT" &&
    locked.embeddingProvider === LOCAL_E5_EMBEDDING_PROVIDER &&
    (locked.status === "EMBEDDING" ||
      (locked.status === "PENDING" && locked.attempt > 0))
  );
}

/** Candidate for already_complete short-circuit (vector count checked separately). */
export function isAlreadyCompleteCandidate(
  locked: LockedGenerationLike | null | undefined,
  forceRegenerate: boolean,
): boolean {
  if (forceRegenerate || !locked) return false;
  return (
    locked.scope === "DRAFT" &&
    locked.embeddingProvider === LOCAL_E5_EMBEDDING_PROVIDER &&
    locked.embeddingDimension === 384 &&
    (locked.status === "READY" || locked.status === "INDEXING")
  );
}

export function isCompleteVectorMatch(input: {
  locked: LockedGenerationLike;
  vectorCount: number;
  chunkCount: number;
}): boolean {
  const { locked, vectorCount, chunkCount } = input;
  return (
    vectorCount === chunkCount &&
    locked.embeddedCount >= chunkCount &&
    locked.failedCount === 0
  );
}

/** First enqueue: reuse structure scaffold row (PENDING / attempt=0 → attempt=1). */
export function isScaffoldReuseCandidate(
  locked: LockedGenerationLike | null | undefined,
  forceRegenerate: boolean,
): boolean {
  if (forceRegenerate || !locked) return false;
  return (
    locked.scope === "DRAFT" &&
    locked.status === "PENDING" &&
    locked.attempt === 0
  );
}

/** forceRegenerate=true (or incomplete/FAILED): clean DRAFT only, never PRODUCTION. */
export function assertDraftScopeForRegenerate(
  locked: LockedGenerationLike | null | undefined,
): void {
  if (locked && locked.scope !== "DRAFT") {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_TRANSITION_CONFLICT",
      "PRODUCTION 검색 세대는 재생성할 수 없습니다.",
      409,
    );
  }
}
