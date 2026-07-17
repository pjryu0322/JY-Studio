// P5 E5: HTTP client to the local CPU embedding worker (multilingual-e5-small-ko-v2).
// No external paid APIs; never log request bodies, auth tokens, or full vectors.

import {
  assertFiniteVector,
  assertNotCancelled,
  type EmbeddingBatchRequest,
  type EmbeddingBatchResult,
  type EmbeddingProviderAdapter,
  type EmbeddingProviderHealth,
  type EmbeddingRequest,
  type EmbeddingResult,
} from "@/lib/embedding/embedding-provider-adapter";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  E5_DEVICE,
  E5_LIVE_BACKEND,
  LEGACY_MODEL_REVISION,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "@/lib/embedding/e5-embedding-constants";
import { assertE5PassageText, assertE5QueryText, buildQueryEmbeddingText } from "@/lib/embedding/e5-embedding-text";
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import {
  computeBackoffMs,
  defaultEmbeddingDelay,
} from "@/lib/embedding/embedding-provider-retry";

type FetchLike = typeof fetch;

export type LocalE5EmbeddingAdapterOptions = {
  workerBaseUrl: string;
  model?: string;
  dimension: number;
  modelRevision?: string | null;
  /** Internal bearer token (E5_WORKER_TOKEN). Omitted in dev/test. */
  token?: string | null;
  fetchImpl?: FetchLike;
  maxRetries?: number;
  /** Timeout for a single /embed/query call. */
  queryTimeoutMs?: number;
  /** Timeout for a single /embed/passages batch call. */
  passageBatchTimeoutMs?: number;
  /** Timeout for /ready and /health probes. */
  readyTimeoutMs?: number;
  batchSize?: number;
  delayFn?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

type WorkerVectorsResponse = {
  model: string;
  revision?: string;
  dimension: number;
  vectors: number[][];
};

type WorkerReadyResponse = {
  ready: boolean;
  backend: string;
  stub: boolean;
  model: string;
  revision: string;
  dimension: number;
  maxSequenceTokens: number;
  normalized: boolean;
  device: string;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return seconds * 1000;
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  assertNotCancelled(signal, "local-e5");
  const controller = new AbortController();
  const linkAbort = () => controller.abort();
  signal?.addEventListener("abort", linkAbort, { once: true });

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    // Distinguish a caller-initiated abort (cancel) from our own timeout abort.
    if (signal?.aborted) {
      throw new EmbeddingProviderError(
        "EMBEDDING_REQUEST_CANCELLED",
        "local-e5: request was cancelled.",
      );
    }
    throw new EmbeddingProviderError(
      "EMBEDDING_PROVIDER_TIMEOUT",
      "local-e5: worker request timed out.",
      { retryable: true, cause: error },
    );
  } finally {
    signal?.removeEventListener("abort", linkAbort);
    clearTimeout(timer);
  }
}

export function createLocalE5EmbeddingAdapter(
  options: LocalE5EmbeddingAdapterOptions,
): EmbeddingProviderAdapter {
  const {
    workerBaseUrl,
    model = DEFAULT_E5_MODEL_ID,
    dimension,
    modelRevision = null,
    token = null,
    fetchImpl = fetch,
    maxRetries = 3,
    queryTimeoutMs = 30_000,
    passageBatchTimeoutMs = 120_000,
    readyTimeoutMs = 5_000,
    batchSize = Number(process.env.JYKSTORE_EMBEDDING_BATCH_SIZE ?? "16") || 16,
    delayFn = defaultEmbeddingDelay,
  } = options;

  if (!workerBaseUrl?.trim()) {
    throw new EmbeddingProviderError(
      "EMBEDDING_PROVIDER_NOT_CONFIGURED",
      "local-e5: JYKSTORE_EMBEDDING_WORKER_URL이 설정되지 않았습니다.",
    );
  }
  if (!Number.isInteger(dimension) || dimension <= 0) {
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      "local-e5: embedding dimension must be a positive integer.",
    );
  }

  const base = normalizeBaseUrl(workerBaseUrl);
  const expectedRevision = modelRevision && modelRevision !== LEGACY_MODEL_REVISION ? modelRevision : null;
  const descriptor = { provider: LOCAL_E5_EMBEDDING_PROVIDER, model, dimension, modelRevision };

  function authHeaders(base: Record<string, string> = {}): Record<string, string> {
    return token ? { ...base, Authorization: `Bearer ${token}` } : base;
  }

  /** Verify a /ready payload against the adapter's expected descriptor. Throws typed errors. */
  function verifyReady(ready: WorkerReadyResponse): void {
    if (!ready.ready) {
      throw new EmbeddingProviderError("EMBEDDING_WORKER_NOT_READY", "local-e5: worker not ready.");
    }
    if (ready.stub || ready.backend === "stub") {
      throw new EmbeddingProviderError(
        "EMBEDDING_WORKER_STUB_ACTIVE",
        "local-e5: worker is running in stub mode — not allowed for search generations.",
      );
    }
    if (ready.backend !== E5_LIVE_BACKEND) {
      throw new EmbeddingProviderError(
        "EMBEDDING_WORKER_NOT_READY",
        `local-e5: unexpected worker backend "${ready.backend}".`,
      );
    }
    if (ready.model !== model) {
      throw new EmbeddingProviderError(
        "EMBEDDING_MODEL_MISMATCH",
        `local-e5: worker model mismatch (expected ${model}).`,
      );
    }
    if (expectedRevision && ready.revision !== expectedRevision) {
      throw new EmbeddingProviderError(
        "EMBEDDING_MODEL_REVISION_MISMATCH",
        "local-e5: worker model revision mismatch.",
      );
    }
    if (ready.dimension !== dimension) {
      throw new EmbeddingProviderError(
        "EMBEDDING_DIMENSION_MISMATCH",
        `local-e5: expected dimension ${dimension}, got ${ready.dimension}.`,
      );
    }
    if (!ready.normalized) {
      throw new EmbeddingProviderError(
        "EMBEDDING_NORMALIZATION_MISMATCH",
        "local-e5: worker must return normalized vectors.",
      );
    }
    if (ready.device !== E5_DEVICE) {
      throw new EmbeddingProviderError(
        "EMBEDDING_WORKER_NOT_READY",
        `local-e5: unexpected worker device "${ready.device}".`,
      );
    }
  }

  async function fetchReady(signal?: AbortSignal): Promise<WorkerReadyResponse> {
    const response = await fetchWithTimeout(
      fetchImpl,
      `${base}/ready`,
      { method: "GET", headers: authHeaders() },
      readyTimeoutMs,
      signal,
    );
    if (response.status === 401 || response.status === 403) {
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_REQUEST_FAILED",
        `local-e5: worker rejected authorization (${response.status}).`,
        { retryable: false },
      );
    }
    if (!response.ok) {
      throw new EmbeddingProviderError(
        "EMBEDDING_WORKER_NOT_READY",
        `local-e5: /ready returned ${response.status}.`,
      );
    }
    return (await response.json()) as WorkerReadyResponse;
  }

  /** Fetch + verify /ready. Called before every embed / embedBatch operation. */
  async function ensureWorkerReady(signal?: AbortSignal): Promise<void> {
    const ready = await fetchReady(signal);
    verifyReady(ready);
  }

  async function postVectors(
    path: "/embed/passages" | "/embed/query",
    body: Record<string, unknown>,
    timeoutMs: number,
    signal?: AbortSignal,
    expectedCount = 1,
  ): Promise<WorkerVectorsResponse> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      assertNotCancelled(signal, "local-e5");
      try {
        const response = await fetchWithTimeout(
          fetchImpl,
          `${base}${path}`,
          {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(body),
          },
          timeoutMs,
          signal,
        );

        // 401/403 are non-retryable (bad/missing token).
        if (response.status === 401 || response.status === 403) {
          throw new EmbeddingProviderError(
            "EMBEDDING_PROVIDER_REQUEST_FAILED",
            `local-e5: worker rejected authorization (${response.status}).`,
            { retryable: false },
          );
        }

        if (response.status === 429 || response.status === 503) {
          const retryAfterMs = parseRetryAfterMs(response);
          if (attempt <= maxRetries) {
            await delayFn(computeBackoffMs(attempt, retryAfterMs), signal);
            continue;
          }
          throw new EmbeddingProviderError(
            "EMBEDDING_PROVIDER_RATE_LIMITED",
            "local-e5: worker unavailable (busy/rate limited).",
            { retryable: true, retryAfterMs },
          );
        }

        if (response.status >= 500) {
          if (attempt <= maxRetries) {
            await delayFn(computeBackoffMs(attempt), signal);
            continue;
          }
          throw new EmbeddingProviderError(
            "EMBEDDING_PROVIDER_REQUEST_FAILED",
            `local-e5: worker returned ${response.status}.`,
            { retryable: true },
          );
        }

        if (response.status === 400) {
          // Token limit / prefix / validation — non-retryable, surfaced to the pipeline.
          const detail = await extractErrorDetail(response);
          if (detail?.code === "EMBEDDING_TOKEN_LIMIT_EXCEEDED") {
            throw new EmbeddingProviderError(
              "EMBEDDING_TOKEN_LIMIT_EXCEEDED",
              `local-e5: input[${detail.index}] exceeds ${detail.maxSequenceTokens} tokens (${detail.tokenCount}).`,
              { retryable: false },
            );
          }
          throw new EmbeddingProviderError(
            "EMBEDDING_PROVIDER_REQUEST_FAILED",
            "local-e5: worker rejected the request (400).",
            { retryable: false },
          );
        }

        if (!response.ok) {
          throw new EmbeddingProviderError(
            "EMBEDDING_PROVIDER_REQUEST_FAILED",
            `local-e5: worker returned ${response.status}.`,
            { retryable: false },
          );
        }

        const json = (await response.json()) as WorkerVectorsResponse;
        if (json.model !== model) {
          throw new EmbeddingProviderError(
            "EMBEDDING_MODEL_MISMATCH",
            "local-e5: worker model mismatch.",
            { retryable: false },
          );
        }
        if (expectedRevision && json.revision && json.revision !== expectedRevision) {
          throw new EmbeddingProviderError(
            "EMBEDDING_MODEL_REVISION_MISMATCH",
            "local-e5: worker model revision mismatch.",
            { retryable: false },
          );
        }
        if (json.dimension !== dimension) {
          throw new EmbeddingProviderError(
            "EMBEDDING_DIMENSION_MISMATCH",
            `local-e5: expected dimension ${dimension}, got ${json.dimension}.`,
            { retryable: false },
          );
        }
        if (!Array.isArray(json.vectors) || json.vectors.length !== expectedCount) {
          throw new EmbeddingProviderError(
            "EMBEDDING_VECTOR_INVALID",
            "local-e5: worker returned an unexpected vector count.",
            { retryable: false },
          );
        }
        for (let i = 0; i < json.vectors.length; i++) {
          assertFiniteVector(json.vectors[i], dimension, `local-e5 batch[${i}]`);
        }
        return json;
      } catch (error) {
        lastError = error;
        if (error instanceof EmbeddingProviderError) {
          if (!error.retryable || attempt > maxRetries) throw error;
          await delayFn(computeBackoffMs(attempt, error.retryAfterMs), signal);
          continue;
        }
        if (attempt > maxRetries) throw error;
        await delayFn(computeBackoffMs(attempt), signal);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new EmbeddingProviderError(
          "EMBEDDING_PROVIDER_REQUEST_FAILED",
          "local-e5: worker request failed.",
          { retryable: false },
        );
  }

  async function extractErrorDetail(
    response: Response,
  ): Promise<{ code?: string; index?: number; tokenCount?: number; maxSequenceTokens?: number } | null> {
    try {
      const body = (await response.json()) as { detail?: unknown };
      const detail = body?.detail;
      if (detail && typeof detail === "object") {
        return detail as { code?: string; index?: number; tokenCount?: number; maxSequenceTokens?: number };
      }
    } catch {
      // ignore parse failures — treat as a generic 400.
    }
    return null;
  }

  return {
    id: LOCAL_E5_EMBEDDING_PROVIDER,
    resolveDescriptor() {
      return descriptor;
    },
    async embed(input: EmbeddingRequest): Promise<EmbeddingResult> {
      await ensureWorkerReady(input.signal);
      const text = buildQueryEmbeddingText(input.text);
      assertE5QueryText(text);
      const result = await postVectors(
        "/embed/query",
        { model, texts: [text], normalize: true },
        queryTimeoutMs,
        input.signal,
        1,
      );
      return {
        provider: LOCAL_E5_EMBEDDING_PROVIDER,
        model,
        dimension,
        vector: result.vectors[0]!,
      };
    },
    async embedBatch(input: EmbeddingBatchRequest): Promise<EmbeddingBatchResult> {
      if (input.texts.length === 0) {
        return { provider: LOCAL_E5_EMBEDDING_PROVIDER, model, dimension, vectors: [] };
      }
      for (const text of input.texts) {
        assertE5PassageText(text);
      }
      await ensureWorkerReady(input.signal);

      const vectors: number[][] = [];
      for (let offset = 0; offset < input.texts.length; offset += batchSize) {
        const slice = input.texts.slice(offset, offset + batchSize);
        const result = await postVectors(
          "/embed/passages",
          { model, texts: slice, normalize: true },
          passageBatchTimeoutMs,
          input.signal,
          slice.length,
        );
        vectors.push(...result.vectors);
      }
      return { provider: LOCAL_E5_EMBEDDING_PROVIDER, model, dimension, vectors };
    },
    async healthCheck(): Promise<EmbeddingProviderHealth> {
      try {
        const health = await fetchWithTimeout(
          fetchImpl,
          `${base}/health`,
          { method: "GET" },
          readyTimeoutMs,
        );
        if (!health.ok) {
          return {
            ok: false,
            provider: LOCAL_E5_EMBEDDING_PROVIDER,
            checkedAt: new Date().toISOString(),
            message: `worker health ${health.status}`,
          };
        }
        const ready = await fetchReady();
        verifyReady(ready);
        return {
          ok: true,
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          checkedAt: new Date().toISOString(),
        };
      } catch (error) {
        return {
          ok: false,
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          checkedAt: new Date().toISOString(),
          message:
            error instanceof EmbeddingProviderError
              ? `${error.code}: ${error.message.slice(0, 160)}`
              : error instanceof Error
                ? error.message.slice(0, 200)
                : "worker unreachable",
        };
      }
    },
  };
}

export const LOCAL_E5_PRODUCTION_WARNING =
  "local-e5 worker must be reachable for operational search embedding.";

export function defaultLocalE5Dimension(): number {
  return DEFAULT_E5_EMBEDDING_DIMENSION;
}
