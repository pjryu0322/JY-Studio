// P5: resolves the configured EmbeddingProviderAdapter and enforces the
// production-safety rule that local-hash must never silently serve production traffic.

import type { EmbeddingDescriptor, EmbeddingProviderAdapter } from "@/lib/embedding/embedding-provider-adapter";
import {
  readEmbeddingProviderConfig,
  type EmbeddingProviderConfig,
} from "@/lib/embedding/embedding-provider-config";
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import {
  createLocalHashEmbeddingAdapter,
  LOCAL_HASH_PRODUCTION_WARNING,
} from "@/lib/embedding/local-hash-embedding-adapter";
import { createOpenAiEmbeddingAdapter } from "@/lib/embedding/openai-embedding-adapter";

export type EmbeddingProviderReadiness = {
  ok: boolean;
  provider: string;
  warning?: string;
};

function isProductionMode(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production";
}

/**
 * Production readiness gate for the local-hash provider: local-hash is a
 * deterministic, non-semantic development provider and must never be used to
 * serve production search. In production this throws; outside production it
 * returns an explicit WARNING so operators can see it in readiness output.
 */
export function assertEmbeddingProviderProductionReady(
  config: { provider: string },
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingProviderReadiness {
  if (config.provider !== "local-hash") {
    return { ok: true, provider: config.provider };
  }
  if (isProductionMode(env)) {
    throw new EmbeddingProviderError(
      "EMBEDDING_PROVIDER_UNSAFE_IN_PRODUCTION",
      "운영 환경에서 local-hash embedding provider를 사용할 수 없습니다. " +
        "JYKSTORE_EMBEDDING_PROVIDER=openai 와 OPENAI_API_KEY를 설정하세요.",
    );
  }
  return { ok: true, provider: config.provider, warning: LOCAL_HASH_PRODUCTION_WARNING };
}

/** Builds an adapter for a specific descriptor (used to match a persisted generation's provider/model/dimension). */
export function resolveEmbeddingProviderAdapterForDescriptor(
  descriptor: EmbeddingDescriptor,
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingProviderAdapter {
  if (descriptor.provider === "openai") {
    const apiKey = env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_NOT_CONFIGURED",
        "openai: OPENAI_API_KEY가 설정되지 않았습니다.",
      );
    }
    return createOpenAiEmbeddingAdapter({ apiKey, model: descriptor.model, dimension: descriptor.dimension });
  }
  return createLocalHashEmbeddingAdapter(descriptor.dimension, descriptor.model);
}

/** Resolves the adapter from the current environment configuration (JYKSTORE_EMBEDDING_PROVIDER etc). */
export function resolveEmbeddingProviderAdapter(
  config: EmbeddingProviderConfig = readEmbeddingProviderConfig(),
): EmbeddingProviderAdapter {
  if (config.provider === "openai") {
    if (!config.openaiApiKey) {
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_NOT_CONFIGURED",
        "openai: OPENAI_API_KEY가 설정되지 않았습니다.",
      );
    }
    return createOpenAiEmbeddingAdapter({
      apiKey: config.openaiApiKey,
      model: config.model,
      dimension: config.dimension,
    });
  }
  return createLocalHashEmbeddingAdapter(config.dimension, config.model);
}
