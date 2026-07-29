/**
 * P4.2 — Canonical chunk policy mirror (python-worker/config/chunk_policy.json).
 * Preferred target for Worker ZIP Generation is 480 (under hard max 512).
 */
export const CHUNK_POLICY_VERSION = "chunk-policy-v1" as const;

export const CANONICAL_CHUNK_POLICY = {
  policyVersion: CHUNK_POLICY_VERSION,
  hardMaxTokens: 512,
  /** Preferred passage target — aligned with Worker ZIP chunker. */
  targetPassageTokens: 480,
  /** Worker ZIP path uses 0; Docling split may still pass overlap separately. */
  overlapTokens: 0,
  smallChunkMaxChars: 120,
  minContentTokens: 48,
  charsPerTokenEstimate: 4,
} as const;

export type CanonicalChunkPolicy = typeof CANONICAL_CHUNK_POLICY;
