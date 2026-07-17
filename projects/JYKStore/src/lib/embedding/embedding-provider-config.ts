// P5: reads embedding provider configuration from environment variables only.

import {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
} from "@/lib/embedding-dto";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "@/lib/embedding/e5-embedding-constants";
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";

export const SUPPORTED_EMBEDDING_PROVIDER_IDS = ["local-hash", "local-e5"] as const;
export type EmbeddingProviderConfigId = (typeof SUPPORTED_EMBEDDING_PROVIDER_IDS)[number];

export type EmbeddingProviderConfig = {
  provider: EmbeddingProviderConfigId;
  model: string;
  dimension: number;
  workerUrl?: string;
  modelRevision?: string;
  batchSize?: number;
};

function isSupportedProvider(value: string): value is EmbeddingProviderConfigId {
  return (SUPPORTED_EMBEDDING_PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Reads JYKSTORE_EMBEDDING_* env. Unset provider defaults to local-hash (unit tests / dev).
 * Operational search generations require local-e5 — see resolveSearchGenerationEmbeddingDescriptor.
 */
export function readEmbeddingProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingProviderConfig {
  const rawProvider = env.JYKSTORE_EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (rawProvider === "openai") {
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      "OpenAI embedding provider는 더 이상 지원되지 않습니다. JYKSTORE_EMBEDDING_PROVIDER=local-e5 를 사용하세요.",
    );
  }

  const provider: EmbeddingProviderConfigId =
    rawProvider && isSupportedProvider(rawProvider) ? rawProvider : DEFAULT_EMBEDDING_PROVIDER;

  if (rawProvider && !isSupportedProvider(rawProvider)) {
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      `JYKSTORE_EMBEDDING_PROVIDER="${rawProvider}" is not supported (expected one of: ${SUPPORTED_EMBEDDING_PROVIDER_IDS.join(", ")}).`,
    );
  }

  const rawModel = env.JYKSTORE_EMBEDDING_MODEL?.trim();
  const model =
    rawModel && rawModel.length > 0
      ? rawModel
      : provider === LOCAL_E5_EMBEDDING_PROVIDER
        ? DEFAULT_E5_MODEL_ID
        : DEFAULT_EMBEDDING_MODEL;

  const rawDimension = env.JYKSTORE_EMBEDDING_DIMENSION?.trim();
  const dimension = rawDimension
    ? Number(rawDimension)
    : provider === LOCAL_E5_EMBEDDING_PROVIDER
      ? DEFAULT_E5_EMBEDDING_DIMENSION
      : DEFAULT_EMBEDDING_DIMENSION;

  if (!Number.isFinite(dimension) || !Number.isInteger(dimension) || dimension <= 0) {
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      `JYKSTORE_EMBEDDING_DIMENSION="${rawDimension}" must be a positive integer.`,
    );
  }

  const workerUrl = env.JYKSTORE_EMBEDDING_WORKER_URL?.trim();
  const modelRevision = env.JYKSTORE_EMBEDDING_MODEL_REVISION?.trim();
  const batchSizeRaw = env.JYKSTORE_EMBEDDING_BATCH_SIZE?.trim();
  const batchSize = batchSizeRaw ? Number(batchSizeRaw) : undefined;

  return {
    provider,
    model,
    dimension,
    ...(workerUrl ? { workerUrl } : {}),
    ...(modelRevision ? { modelRevision } : {}),
    ...(batchSize && Number.isFinite(batchSize) ? { batchSize } : {}),
  };
}
