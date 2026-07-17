/** JYKStore 1차 운영 임베딩: dragonkue/multilingual-e5-small-ko-v2 (CPU Worker). */

export const LOCAL_E5_EMBEDDING_PROVIDER = "local-e5" as const;

export const DEFAULT_E5_MODEL_ID = "dragonkue/multilingual-e5-small-ko-v2" as const;

export const DEFAULT_E5_EMBEDDING_DIMENSION = 384 as const;

export const E5_MAX_SEQUENCE_TOKENS = 512 as const;

export const E5_DISTANCE_METRIC = "cosine" as const;

export const E5_QUERY_PREFIX = "query: " as const;

export const E5_PASSAGE_PREFIX = "passage: " as const;
