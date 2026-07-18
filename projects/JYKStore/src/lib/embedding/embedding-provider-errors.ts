// P5: typed errors for the async embedding provider adapters and pgvector search runtime.
// NEVER include API keys or raw provider request/response bodies in messages here.

export const EMBEDDING_PROVIDER_ERROR_CODES = [
  /** Runtime cannot serve search (pgvector unavailable in production, missing generation, etc). */
  "SEARCH_RUNTIME_UNAVAILABLE",
  "EMBEDDING_PROVIDER_NOT_CONFIGURED",
  "EMBEDDING_PROVIDER_UNSAFE_IN_PRODUCTION",
  "EMBEDDING_PROVIDER_TIMEOUT",
  "EMBEDDING_PROVIDER_RATE_LIMITED",
  "EMBEDDING_PROVIDER_REQUEST_FAILED",
  "EMBEDDING_DIMENSION_MISMATCH",
  "EMBEDDING_VECTOR_INVALID",
  "EMBEDDING_REQUEST_CANCELLED",
  "EMBEDDING_CONFIG_INVALID",
  "EMBEDDING_TOKEN_LIMIT_EXCEEDED",
  "EMBEDDING_PREFIX_INVALID",
  /** Worker /ready returned ready=false or was unreachable. */
  "EMBEDDING_WORKER_NOT_READY",
  /** Worker /ready reported stub=true — never allowed for real search generations. */
  "EMBEDDING_WORKER_STUB_ACTIVE",
  "EMBEDDING_MODEL_MISMATCH",
  "EMBEDDING_MODEL_REVISION_MISMATCH",
  /** Revision is missing, legacy-unknown, stub, or not a 40-char commit SHA. */
  "EMBEDDING_MODEL_REVISION_INVALID",
  "EMBEDDING_NORMALIZATION_MISMATCH",
] as const;

export type EmbeddingProviderErrorCode = (typeof EMBEDDING_PROVIDER_ERROR_CODES)[number];

export class EmbeddingProviderError extends Error {
  readonly code: EmbeddingProviderErrorCode;
  /** Whether the caller may reasonably retry the same request. */
  readonly retryable: boolean;
  /** Server-provided retry delay hint (from a Retry-After header), if any. */
  readonly retryAfterMs?: number;

  constructor(
    code: EmbeddingProviderErrorCode,
    message: string,
    options: { retryable?: boolean; cause?: unknown; retryAfterMs?: number } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "EmbeddingProviderError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export function isEmbeddingProviderError(error: unknown): error is EmbeddingProviderError {
  return error instanceof EmbeddingProviderError;
}

export function isEmbeddingProviderErrorCode(
  error: unknown,
  code: EmbeddingProviderErrorCode,
): boolean {
  return isEmbeddingProviderError(error) && error.code === code;
}
