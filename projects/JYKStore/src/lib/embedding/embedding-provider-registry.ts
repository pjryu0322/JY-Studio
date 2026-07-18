// P5: resolves the configured EmbeddingProviderAdapter and enforces production rules.

import type { EmbeddingDescriptor, EmbeddingProviderAdapter } from "@/lib/embedding/embedding-provider-adapter";
import {
  readEmbeddingProviderConfig,
  type EmbeddingProviderConfig,
} from "@/lib/embedding/embedding-provider-config";
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { LOCAL_E5_EMBEDDING_PROVIDER } from "@/lib/embedding/e5-embedding-constants";
import { assertPinnedModelRevision } from "@/lib/embedding/e5-model-revision";
import {
  createLocalE5EmbeddingAdapter,
  LOCAL_E5_PRODUCTION_WARNING,
} from "@/lib/embedding/local-e5-embedding-adapter";
import {
  createLocalHashEmbeddingAdapter,
  LOCAL_HASH_PRODUCTION_WARNING,
} from "@/lib/embedding/local-hash-embedding-adapter";

export type EmbeddingProviderReadiness = {
  ok: boolean;
  provider: string;
  warning?: string;
};

function isProductionMode(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production";
}

export function assertEmbeddingProviderProductionReady(
  config: { provider: string },
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingProviderReadiness {
  if (config.provider === "local-hash") {
    if (isProductionMode(env)) {
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_UNSAFE_IN_PRODUCTION",
        "운영 환경에서 local-hash embedding provider를 사용할 수 없습니다. " +
          "JYKSTORE_EMBEDDING_PROVIDER=local-e5 와 Embedding Worker를 설정하세요.",
      );
    }
    return { ok: true, provider: config.provider, warning: LOCAL_HASH_PRODUCTION_WARNING };
  }
  if (config.provider === LOCAL_E5_EMBEDDING_PROVIDER) {
    const full = readEmbeddingProviderConfig(env);
    if (!full.workerUrl) {
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_NOT_CONFIGURED",
        "local-e5: JYKSTORE_EMBEDDING_WORKER_URL이 설정되지 않았습니다.",
      );
    }
    // Production requires pinned revision + worker token. Non-production still
    // validates the revision format whenever it is set.
    if (isProductionMode(env)) {
      if (!full.workerToken) {
        throw new EmbeddingProviderError(
          "EMBEDDING_PROVIDER_NOT_CONFIGURED",
          "local-e5: 운영 환경에서는 JYKSTORE_EMBEDDING_WORKER_TOKEN이 필요합니다.",
        );
      }
      assertPinnedModelRevision(full.modelRevision, "JYKSTORE_EMBEDDING_MODEL_REVISION");
    } else if (full.modelRevision) {
      assertPinnedModelRevision(full.modelRevision, "JYKSTORE_EMBEDDING_MODEL_REVISION");
    }
    return { ok: true, provider: config.provider, warning: LOCAL_E5_PRODUCTION_WARNING };
  }
  return { ok: true, provider: config.provider };
}

/** Search-index generations must not use local-hash (any environment). */
export function assertSearchGenerationEmbeddingProvider(config: { provider: string }): void {
  if (config.provider === "local-hash") {
    throw new EmbeddingProviderError(
      "EMBEDDING_PROVIDER_UNSAFE_IN_PRODUCTION",
      "검색 Generation에는 local-hash를 사용할 수 없습니다. JYKSTORE_EMBEDDING_PROVIDER=local-e5 를 설정하세요.",
    );
  }
}

/**
 * Resolve an adapter for an existing Generation descriptor.
 * The Generation's modelRevision is authoritative — env revision is NEVER used as a fallback.
 * Empty / legacy-unknown revisions are rejected (operational Generation path).
 */
export function resolveEmbeddingProviderAdapterForDescriptor(
  descriptor: EmbeddingDescriptor,
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingProviderAdapter {
  if (descriptor.provider === LOCAL_E5_EMBEDDING_PROVIDER) {
    const config = readEmbeddingProviderConfig(env);
    if (!config.workerUrl) {
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_NOT_CONFIGURED",
        "local-e5: JYKSTORE_EMBEDDING_WORKER_URL이 설정되지 않았습니다.",
      );
    }
    // Generation descriptor is the authority — require a pinned SHA, no env fallback.
    assertPinnedModelRevision(descriptor.modelRevision, "SearchIndexGeneration.embeddingModelRevision");
    return createLocalE5EmbeddingAdapter({
      workerBaseUrl: config.workerUrl,
      model: descriptor.model,
      dimension: descriptor.dimension,
      modelRevision: descriptor.modelRevision!.trim(),
      token: config.workerToken ?? null,
      batchSize: config.batchSize,
    });
  }
  return createLocalHashEmbeddingAdapter(descriptor.dimension, descriptor.model);
}

/**
 * Resolve an adapter from ambient env config (no Generation).
 * Used for readiness probes and ad-hoc embedding outside a Generation pipeline.
 * Env revision must be a pinned SHA when set / in production.
 */
export function resolveEmbeddingProviderAdapter(
  config: EmbeddingProviderConfig = readEmbeddingProviderConfig(),
): EmbeddingProviderAdapter {
  if (config.provider === LOCAL_E5_EMBEDDING_PROVIDER) {
    if (!config.workerUrl) {
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_NOT_CONFIGURED",
        "local-e5: JYKSTORE_EMBEDDING_WORKER_URL이 설정되지 않았습니다.",
      );
    }
    if (config.modelRevision) {
      assertPinnedModelRevision(config.modelRevision, "JYKSTORE_EMBEDDING_MODEL_REVISION");
    }
    return createLocalE5EmbeddingAdapter({
      workerBaseUrl: config.workerUrl,
      model: config.model,
      dimension: config.dimension,
      modelRevision: config.modelRevision ?? null,
      token: config.workerToken ?? null,
      batchSize: config.batchSize,
    });
  }
  return createLocalHashEmbeddingAdapter(config.dimension, config.model);
}
