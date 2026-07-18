/** P5.1: pinned Hugging Face full commit SHA helpers for local-e5. */

import {
  LEGACY_MODEL_REVISION,
} from "@/lib/embedding/e5-embedding-constants";
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";

/** Full 40-char lowercase hex commit SHA (Hugging Face revision pin). */
export const HF_COMMIT_SHA_RE = /^[0-9a-f]{40}$/;

/** Stub-only revision string used by the E5 worker stub backend. */
export const STUB_MODEL_REVISION = "stub" as const;

export function isFullCommitSha(value: string | null | undefined): boolean {
  return typeof value === "string" && HF_COMMIT_SHA_RE.test(value);
}

export function isLegacyModelRevision(value: string | null | undefined): boolean {
  return value === LEGACY_MODEL_REVISION;
}

export function isStubModelRevision(value: string | null | undefined): boolean {
  return value === STUB_MODEL_REVISION;
}

/**
 * Assert a revision is a pinned 40-char commit SHA.
 * Rejects empty, legacy-unknown, stub, branch/tag names.
 */
export function assertPinnedModelRevision(
  revision: string | null | undefined,
  context = "embedding model revision",
): asserts revision is string {
  if (!revision || !revision.trim()) {
    throw new EmbeddingProviderError(
      "EMBEDDING_MODEL_REVISION_INVALID",
      `${context}: revision is required (40-char Hugging Face commit SHA).`,
    );
  }
  const trimmed = revision.trim();
  if (isLegacyModelRevision(trimmed)) {
    throw new EmbeddingProviderError(
      "EMBEDDING_MODEL_REVISION_INVALID",
      `${context}: "legacy-unknown" is read-compatibility only and cannot be used for new generations.`,
    );
  }
  if (isStubModelRevision(trimmed)) {
    throw new EmbeddingProviderError(
      "EMBEDDING_MODEL_REVISION_INVALID",
      `${context}: stub revision is not allowed for operational embedding.`,
    );
  }
  if (!isFullCommitSha(trimmed)) {
    throw new EmbeddingProviderError(
      "EMBEDDING_MODEL_REVISION_INVALID",
      `${context}: must be a 40-char lowercase hex commit SHA (got length ${trimmed.length}).`,
    );
  }
}

/** Normalize a revision string for comparison (trim only). */
export function normalizeModelRevision(revision: string): string {
  return revision.trim();
}
