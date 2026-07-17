import type {
  SearchIndexGeneration,
  SearchIndexGenerationScope,
  SearchIndexGenerationStatus,
} from "@prisma/client";

export type {
  SearchIndexGeneration,
  SearchIndexGenerationScope,
  SearchIndexGenerationStatus,
};

/** Default local (non-external) embedding descriptor used by JYKStore today. */
export const LOCAL_EMBEDDING_PROVIDER = "local-hash" as const;
export const LOCAL_EMBEDDING_MODEL = "local-hash-v1" as const;
export const LOCAL_EMBEDDING_DIMENSION = 256 as const;
export const LOCAL_DISTANCE_METRIC = "cosine" as const;

/** Statuses that make a generation eligible for draft validation. */
export const SEARCH_GENERATION_VALIDATABLE_STATUSES: readonly SearchIndexGenerationStatus[] = [
  "READY",
];

/** Statuses that are terminal / no longer active for the current binding. */
export const SEARCH_GENERATION_INACTIVE_STATUSES: readonly SearchIndexGenerationStatus[] = [
  "FAILED",
  "STALE",
  "RETIRED",
];

export type SearchGenerationEmbeddingDescriptor = {
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
  distanceMetric: string;
};

export function defaultLocalEmbeddingDescriptor(): SearchGenerationEmbeddingDescriptor {
  return {
    embeddingProvider: LOCAL_EMBEDDING_PROVIDER,
    embeddingModel: LOCAL_EMBEDDING_MODEL,
    embeddingDimension: LOCAL_EMBEDDING_DIMENSION,
    distanceMetric: LOCAL_DISTANCE_METRIC,
  };
}

/** Input identifying a generation's binding to a specific pipeline output. */
export type SearchGenerationBindingInput = {
  packId: string;
  versionId: string;
  pipelineRunId: string;
  normalizedDocumentId: string;
  chunkGenerationId: string;
  /** NormalizedDocument.fingerprint at generation time. */
  fingerprint: string;
};

export function isSearchGenerationCurrentForBinding(
  generation: Pick<
    SearchIndexGeneration,
    | "packId"
    | "versionId"
    | "pipelineRunId"
    | "normalizedDocumentId"
    | "chunkGenerationId"
    | "fingerprint"
    | "status"
  >,
  binding: SearchGenerationBindingInput,
): boolean {
  if (SEARCH_GENERATION_INACTIVE_STATUSES.includes(generation.status)) return false;
  return (
    generation.packId === binding.packId &&
    generation.versionId === binding.versionId &&
    generation.pipelineRunId === binding.pipelineRunId &&
    generation.normalizedDocumentId === binding.normalizedDocumentId &&
    generation.chunkGenerationId === binding.chunkGenerationId &&
    generation.fingerprint === binding.fingerprint
  );
}
