/** JYKStore 1차 운영 임베딩: dragonkue/multilingual-e5-small-ko-v2 (CPU Worker). */

export const LOCAL_E5_EMBEDDING_PROVIDER = "local-e5" as const;

export const DEFAULT_E5_MODEL_ID = "dragonkue/multilingual-e5-small-ko-v2" as const;

export const DEFAULT_E5_EMBEDDING_DIMENSION = 384 as const;

export const E5_MAX_SEQUENCE_TOKENS = 512 as const;

/** Preferred passage budget during Retrieval Chunk generation (hard limit remains 512).
 * P4.2: aligned with Worker ZIP chunk_policy.json targetPassageTokens=480. */
export const E5_TARGET_PASSAGE_TOKENS = 480 as const;

/** Approximate overlap between adjacent passage splits (tokenizer tokens). */
export const E5_OVERLAP_TOKENS = 48 as const;

export const E5_TOKENIZE_BATCH_SIZE = 16 as const;

export const E5_DISTANCE_METRIC = "cosine" as const;

export const E5_QUERY_PREFIX = "query: " as const;

export const E5_PASSAGE_PREFIX = "passage: " as const;

/** Worker backend identifier expected for operational (non-stub) embedding. */
export const E5_LIVE_BACKEND = "sentence-transformers" as const;

/** All operational vectors are L2-normalized (cosine similarity). */
export const E5_NORMALIZED = true as const;

/** CPU-only execution. */
export const E5_DEVICE = "cpu" as const;

/** Explicit compatibility value for legacy generations without a pinned revision. */
export const LEGACY_MODEL_REVISION = "legacy-unknown" as const;
