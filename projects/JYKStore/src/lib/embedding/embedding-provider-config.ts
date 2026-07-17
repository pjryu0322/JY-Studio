// P5: reads embedding provider configuration from environment variables only.
// Never commit real values for OPENAI_API_KEY — see .env.example.

import {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
} from "@/lib/embedding-dto";
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { DEFAULT_OPENAI_EMBEDDING_MODEL } from "@/lib/embedding/openai-embedding-adapter";

export const SUPPORTED_EMBEDDING_PROVIDER_IDS = ["local-hash", "openai"] as const;
export type EmbeddingProviderConfigId = (typeof SUPPORTED_EMBEDDING_PROVIDER_IDS)[number];

export type EmbeddingProviderConfig = {
  provider: EmbeddingProviderConfigId;
  model: string;
  dimension: number;
  /** Present only when provider === "openai" and OPENAI_API_KEY is configured. */
  openaiApiKey?: string;
};

function isSupportedProvider(value: string): value is EmbeddingProviderConfigId {
  return (SUPPORTED_EMBEDDING_PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Reads JYKSTORE_EMBEDDING_PROVIDER / JYKSTORE_EMBEDDING_MODEL /
 * JYKSTORE_EMBEDDING_DIMENSION / OPENAI_API_KEY. Falls back to the local-hash
 * defaults (matching P14 foundation behavior) when unset.
 */
export function readEmbeddingProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingProviderConfig {
  const rawProvider = env.JYKSTORE_EMBEDDING_PROVIDER?.trim().toLowerCase();
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
      : provider === "openai"
        ? DEFAULT_OPENAI_EMBEDDING_MODEL
        : DEFAULT_EMBEDDING_MODEL;

  const rawDimension = env.JYKSTORE_EMBEDDING_DIMENSION?.trim();
  const dimension = rawDimension ? Number(rawDimension) : DEFAULT_EMBEDDING_DIMENSION;
  if (!Number.isFinite(dimension) || !Number.isInteger(dimension) || dimension <= 0) {
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      `JYKSTORE_EMBEDDING_DIMENSION="${rawDimension}" must be a positive integer.`,
    );
  }

  const openaiApiKey = env.OPENAI_API_KEY?.trim();
  return {
    provider,
    model,
    dimension,
    ...(openaiApiKey ? { openaiApiKey } : {}),
  };
}
