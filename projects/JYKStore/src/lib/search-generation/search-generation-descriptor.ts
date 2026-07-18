/**
 * Shared SearchIndexGeneration embedding-descriptor invariants (P5.1).
 * Used by snapshot V3, review-submit, and admin-approve paths.
 */

import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  E5_DISTANCE_METRIC,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "@/lib/embedding/e5-embedding-constants";
import { isFullCommitSha, isLegacyModelRevision } from "@/lib/embedding/e5-model-revision";

export type EmbeddingDescriptorFields = {
  embeddingProvider: string | null | undefined;
  embeddingModel: string | null | undefined;
  embeddingModelRevision: string | null | undefined;
  embeddingDimension: number | null | undefined;
  distanceMetric: string | null | undefined;
};

export type DescriptorValidationResult =
  | { ok: true }
  | { ok: false; code: "SEARCH_GENERATION_DESCRIPTOR_INVALID" | "SEARCH_GENERATION_REVISION_INVALID"; reason: string };

/** Operational (non-legacy) Generation descriptor for submit / approve / production. */
export function validateOperationalEmbeddingDescriptor(
  descriptor: EmbeddingDescriptorFields,
): DescriptorValidationResult {
  if (descriptor.embeddingProvider !== LOCAL_E5_EMBEDDING_PROVIDER) {
    return {
      ok: false,
      code: "SEARCH_GENERATION_DESCRIPTOR_INVALID",
      reason: `embeddingProvider must be ${LOCAL_E5_EMBEDDING_PROVIDER}`,
    };
  }
  if (descriptor.embeddingModel !== DEFAULT_E5_MODEL_ID) {
    return {
      ok: false,
      code: "SEARCH_GENERATION_DESCRIPTOR_INVALID",
      reason: `embeddingModel must be ${DEFAULT_E5_MODEL_ID}`,
    };
  }
  if (
    typeof descriptor.embeddingDimension !== "number" ||
    descriptor.embeddingDimension !== DEFAULT_E5_EMBEDDING_DIMENSION
  ) {
    return {
      ok: false,
      code: "SEARCH_GENERATION_DESCRIPTOR_INVALID",
      reason: `embeddingDimension must be ${DEFAULT_E5_EMBEDDING_DIMENSION}`,
    };
  }
  if (descriptor.distanceMetric !== E5_DISTANCE_METRIC) {
    return {
      ok: false,
      code: "SEARCH_GENERATION_DESCRIPTOR_INVALID",
      reason: `distanceMetric must be ${E5_DISTANCE_METRIC}`,
    };
  }
  const revision = descriptor.embeddingModelRevision;
  if (!revision || isLegacyModelRevision(revision)) {
    return {
      ok: false,
      code: "SEARCH_GENERATION_REVISION_INVALID",
      reason: "embeddingModelRevision must be a pinned 40-char commit SHA (not legacy-unknown)",
    };
  }
  if (!isFullCommitSha(revision)) {
    return {
      ok: false,
      code: "SEARCH_GENERATION_REVISION_INVALID",
      reason: "embeddingModelRevision must be a 40-char lowercase hex commit SHA",
    };
  }
  return { ok: true };
}

export function embeddingDescriptorsEqual(
  a: EmbeddingDescriptorFields,
  b: EmbeddingDescriptorFields,
): boolean {
  return (
    a.embeddingProvider === b.embeddingProvider &&
    a.embeddingModel === b.embeddingModel &&
    a.embeddingModelRevision === b.embeddingModelRevision &&
    a.embeddingDimension === b.embeddingDimension &&
    a.distanceMetric === b.distanceMetric
  );
}
