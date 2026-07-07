// P14 Vector Retrieval Extension - foundation only.
// NOTE: local-hash embedding은 외부 embedding API가 아니라 개발/foundation provider입니다.
// 향후 OpenAI/Claude/Gemini/EXAONE 등 external provider로 교체 가능한 interface만 제공합니다.

export const DEFAULT_EMBEDDING_PROVIDER = "local-hash";
export const DEFAULT_EMBEDDING_MODEL = "local-hash-v1";
export const DEFAULT_EMBEDDING_DIMENSION = 256;

export type EmbeddingProviderId = "local-hash";

export type EmbeddingInput = {
  text: string;
  provider?: string;
  model?: string;
  dimension?: number;
};

export type EmbeddingResult = {
  provider: string;
  model: string;
  dimension: number;
  vector: number[];
};

export type EmbeddingProvider = {
  readonly id: EmbeddingProviderId;
  readonly model: string;
  readonly dimension: number;
  embed(input: EmbeddingInput): EmbeddingResult;
};

export type PackEmbeddingSummaryDto = {
  packId: string;
  provider: string;
  model: string;
  dimension: number;
  activeChunkCount: number;
  embeddedChunkCount: number;
  missingEmbeddingCount: number;
  staleEmbeddingCount: number;
};

export type EmbeddingRebuildResultDto = {
  packId: string;
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
};
