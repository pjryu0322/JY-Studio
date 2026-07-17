import { sha256Hex } from "@/lib/distribution/payload-checksum";
import { canonicalJsonStringify } from "@/lib/docling-import/normalized-document-fingerprint";

export const SEARCH_GENERATION_FINGERPRINT_VERSION = "search-generation-v1" as const;

export type SearchGenerationFingerprintChunk = {
  /** Retrieval chunk id included in this generation. */
  chunkId: string;
  /** Stable content hash for the chunk (KnowledgeChunkEmbedding.contentHash). */
  contentHash: string;
};

export type SearchGenerationFingerprintInput = {
  packId: string;
  versionId: string;
  pipelineRunId: string;
  normalizedDocumentId: string;
  chunkGenerationId: string;
  /** NormalizedDocument fingerprint (already excludes raw content/secrets). */
  normalizedDocumentFingerprint: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
  distanceMetric: string;
  /** Retrieval chunks; order is normalized deterministically by chunkId. */
  chunks: readonly SearchGenerationFingerprintChunk[];
};

/**
 * Deterministic SHA-256 over the generation's binding + embedding descriptor +
 * sorted retrieval chunk ids and their content hashes. No raw content or secrets.
 * §25 — same input always yields the same fingerprint.
 */
export function computeSearchGenerationFingerprint(
  input: SearchGenerationFingerprintInput,
): string {
  const sortedChunks = [...input.chunks]
    .map((c) => ({ chunkId: c.chunkId, contentHash: c.contentHash }))
    .sort((a, b) => (a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0));

  const payload = {
    v: SEARCH_GENERATION_FINGERPRINT_VERSION,
    packId: input.packId,
    versionId: input.versionId,
    pipelineRunId: input.pipelineRunId,
    normalizedDocumentId: input.normalizedDocumentId,
    chunkGenerationId: input.chunkGenerationId,
    normalizedDocumentFingerprint: input.normalizedDocumentFingerprint,
    embeddingProvider: input.embeddingProvider,
    embeddingModel: input.embeddingModel,
    embeddingDimension: input.embeddingDimension,
    distanceMetric: input.distanceMetric,
    chunks: sortedChunks,
  };

  const canonical = canonicalJsonStringify(payload);
  return sha256Hex(new TextEncoder().encode(canonical));
}
