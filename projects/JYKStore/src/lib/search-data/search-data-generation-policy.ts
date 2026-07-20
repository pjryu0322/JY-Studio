import type { SearchIndexGeneration } from "@prisma/client";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  E5_DISTANCE_METRIC,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "@/lib/embedding/e5-embedding-constants";
import { readEmbeddingProviderConfig } from "@/lib/embedding/embedding-provider-config";
import { isFullCommitSha } from "@/lib/embedding/e5-model-revision";
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import type { SearchGenerationEmbeddingDescriptor } from "@/lib/search-generation/search-generation-types";
import {
  DEFAULT_STALE_SECONDS,
  PINNED_E5_REVISION,
} from "@/lib/search-data/search-data-generation-types";

/**
 * Enqueue-only descriptor — no Worker /ready probe (preflight runs in the worker).
 * Rejects non-local-e5 provider, invalid revision SHA, and non-384 dimensions.
 */
export function provisionalEnqueueLocalE5Descriptor(
  env: NodeJS.ProcessEnv = process.env,
): SearchGenerationEmbeddingDescriptor {
  const config = readEmbeddingProviderConfig(env);
  const providerEnv = env.JYKSTORE_EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (
    (providerEnv && providerEnv !== LOCAL_E5_EMBEDDING_PROVIDER) ||
    (config.provider !== LOCAL_E5_EMBEDDING_PROVIDER && Boolean(providerEnv))
  ) {
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      "검색데이터 생성은 local-e5 provider만 지원합니다.",
      { retryable: false },
    );
  }
  if (config.provider !== LOCAL_E5_EMBEDDING_PROVIDER && !providerEnv) {
    // Unset defaults to local-hash in readEmbeddingProviderConfig — require explicit local-e5.
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      "JYKSTORE_EMBEDDING_PROVIDER=local-e5 가 필요합니다.",
      { retryable: false },
    );
  }

  const model =
    (config.provider === LOCAL_E5_EMBEDDING_PROVIDER ? config.model : null)?.trim() ||
    env.JYKSTORE_EMBEDDING_MODEL?.trim() ||
    DEFAULT_E5_MODEL_ID;
  if (!model) {
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      "embedding model is required",
      { retryable: false },
    );
  }

  const rawRevision =
    config.modelRevision?.trim() || env.JYKSTORE_EMBEDDING_MODEL_REVISION?.trim() || "";
  let revision = PINNED_E5_REVISION;
  if (rawRevision) {
    if (!isFullCommitSha(rawRevision)) {
      throw new EmbeddingProviderError(
        "EMBEDDING_MODEL_REVISION_INVALID",
        "JYKSTORE_EMBEDDING_MODEL_REVISION must be a 40-char commit SHA.",
        { retryable: false },
      );
    }
    revision = rawRevision;
  }

  const dimension =
    config.provider === LOCAL_E5_EMBEDDING_PROVIDER
      ? config.dimension
      : Number.parseInt(env.JYKSTORE_EMBEDDING_DIMENSION ?? "", 10) ||
        DEFAULT_E5_EMBEDDING_DIMENSION;
  if (dimension !== DEFAULT_E5_EMBEDDING_DIMENSION) {
    throw new EmbeddingProviderError(
      "EMBEDDING_DIMENSION_MISMATCH",
      `embedding dimension must be ${DEFAULT_E5_EMBEDDING_DIMENSION}`,
      { retryable: false },
    );
  }

  return {
    embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
    embeddingModel: model,
    embeddingModelRevision: revision,
    embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
    distanceMetric: E5_DISTANCE_METRIC,
  };
}

export function searchDataStaleSeconds(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number.parseInt(env.JYKSTORE_SEARCH_DATA_STALE_SECONDS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STALE_SECONDS;
}

/** @internal test helper */
export function __testOnlyIsLocalE5Generation(g: SearchIndexGeneration | null): boolean {
  return Boolean(g && g.embeddingProvider === LOCAL_E5_EMBEDDING_PROVIDER);
}
