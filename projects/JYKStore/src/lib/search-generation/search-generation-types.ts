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

import { readEmbeddingProviderConfig } from "@/lib/embedding/embedding-provider-config";
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  E5_DISTANCE_METRIC,
  LEGACY_MODEL_REVISION,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "@/lib/embedding/e5-embedding-constants";
import { assertPinnedModelRevision } from "@/lib/embedding/e5-model-revision";
import { createLocalE5EmbeddingAdapter } from "@/lib/embedding/local-e5-embedding-adapter";
import { assertSearchGenerationEmbeddingProvider } from "@/lib/embedding/embedding-provider-registry";

/** Legacy dev/foundation descriptor (local-hash). Backfill-only / unit tests. */
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
  embeddingModelRevision: string;
  embeddingDimension: number;
  distanceMetric: string;
};

export function defaultLocalEmbeddingDescriptor(): SearchGenerationEmbeddingDescriptor {
  return {
    embeddingProvider: LOCAL_EMBEDDING_PROVIDER,
    embeddingModel: LOCAL_EMBEDDING_MODEL,
    embeddingModelRevision: LEGACY_MODEL_REVISION,
    embeddingDimension: LOCAL_EMBEDDING_DIMENSION,
    distanceMetric: LOCAL_DISTANCE_METRIC,
  };
}

/**
 * Static E5 defaults for unit tests only.
 * New pipeline Generations MUST use {@link resolveSearchGenerationEmbeddingDescriptor}.
 */
export function defaultE5SearchGenerationDescriptor(): SearchGenerationEmbeddingDescriptor {
  return {
    embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
    embeddingModel: DEFAULT_E5_MODEL_ID,
    embeddingModelRevision: LEGACY_MODEL_REVISION,
    embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
    distanceMetric: E5_DISTANCE_METRIC,
  };
}

/**
 * Resolve + verify the embedding descriptor stored on a new SearchIndexGeneration.
 *
 * Flow: env config → require pinned SHA → Worker /ready → store resolved revision.
 * Never stores an unverified env revision string, and never falls back to legacy-unknown.
 */
export async function resolveSearchGenerationEmbeddingDescriptor(
  env: NodeJS.ProcessEnv = process.env,
): Promise<SearchGenerationEmbeddingDescriptor> {
  const config = readEmbeddingProviderConfig(env);
  assertSearchGenerationEmbeddingProvider(config);
  if (config.provider !== LOCAL_E5_EMBEDDING_PROVIDER) {
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      `검색 Generation에는 ${LOCAL_E5_EMBEDDING_PROVIDER} provider만 사용할 수 있습니다.`,
    );
  }
  if (!config.workerUrl) {
    throw new EmbeddingProviderError(
      "EMBEDDING_PROVIDER_NOT_CONFIGURED",
      "local-e5: JYKSTORE_EMBEDDING_WORKER_URL이 설정되지 않았습니다.",
    );
  }

  // New Generations always require a pinned 40-char commit SHA (any environment).
  assertPinnedModelRevision(config.modelRevision, "JYKSTORE_EMBEDDING_MODEL_REVISION");

  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: config.workerUrl,
    model: config.model,
    dimension: config.dimension,
    modelRevision: config.modelRevision!,
    token: config.workerToken ?? null,
    batchSize: config.batchSize,
  });

  // Probe /ready — verifies stub=false, model, revision, dimension, normalized, device.
  const ready = await adapter.probeReady();
  assertPinnedModelRevision(ready.revision, "worker /ready revision");

  return {
    embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
    embeddingModel: ready.model,
    embeddingModelRevision: ready.revision,
    embeddingDimension: ready.dimension,
    distanceMetric: E5_DISTANCE_METRIC,
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
