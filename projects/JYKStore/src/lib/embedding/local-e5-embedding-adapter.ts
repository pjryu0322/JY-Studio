// P5 E5: HTTP client to the local CPU embedding worker (multilingual-e5-small-ko-v2).
// No external paid APIs; never log request bodies or full vectors.

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
  fetchImpl?: FetchLike;
  maxRetries?: number;
  connectionTimeoutMs?: number;
  requestTimeoutMs?: number;
  batchSize?: number;
  delayFn?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

type WorkerVectorsResponse = {
  model: string;
  dimension: number;
  vectors: number[][];
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

async function fetchWithTimeouts(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  connectionTimeoutMs: number,
  requestTimeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  assertNotCancelled(signal);
  const controller = new AbortController();
  const linkAbort = () => controller.abort();
  signal?.addEventListener("abort", linkAbort, { once: true });

  const deadlineMs = Math.max(connectionTimeoutMs, requestTimeoutMs);
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (signal?.aborted || controller.signal.aborted) {
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
    fetchImpl = fetch,
    maxRetries = 3,
    connectionTimeoutMs = 5_000,
    requestTimeoutMs = 120_000,
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
  const descriptor = { provider: LOCAL_E5_EMBEDDING_PROVIDER, model, dimension };

  async function postVectors(
    path: "/embed/passages" | "/embed/query",
    body: Record<string, unknown>,
    signal?: AbortSignal,
    expectedCount = 1,
  ): Promise<WorkerVectorsResponse> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      assertNotCancelled(signal);
      try {
        const response = await fetchWithTimeouts(
          fetchImpl,
          `${base}${path}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
          connectionTimeoutMs,
          requestTimeoutMs,
          signal,
        );

        if (response.status === 429) {
          const retryAfterMs = parseRetryAfterMs(response);
          if (attempt <= maxRetries) {
            await delayFn(computeBackoffMs(attempt, retryAfterMs), signal);
            continue;
          }
          throw new EmbeddingProviderError(
            "EMBEDDING_PROVIDER_RATE_LIMITED",
            "local-e5: worker rate limited.",
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
            "EMBEDDING_CONFIG_INVALID",
            "local-e5: worker model mismatch.",
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
          await delayFn(computeBackoffMs(attempt), signal);
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

  return {
    id: LOCAL_E5_EMBEDDING_PROVIDER,
    resolveDescriptor() {
      return descriptor;
    },
    async embed(input: EmbeddingRequest): Promise<EmbeddingResult> {
      const text = buildQueryEmbeddingText(input.text);
      assertE5QueryText(text);
      const result = await postVectors(
        "/embed/query",
        { model, texts: [text], normalize: true },
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

      const vectors: number[][] = [];
      for (let offset = 0; offset < input.texts.length; offset += batchSize) {
        const slice = input.texts.slice(offset, offset + batchSize);
        const result = await postVectors(
          "/embed/passages",
          { model, texts: slice, normalize: true },
          input.signal,
          slice.length,
        );
        vectors.push(...result.vectors);
      }
      return { provider: LOCAL_E5_EMBEDDING_PROVIDER, model, dimension, vectors };
    },
    async healthCheck(): Promise<EmbeddingProviderHealth> {
      try {
        const response = await fetchWithTimeouts(
          fetchImpl,
          `${base}/health`,
          { method: "GET" },
          connectionTimeoutMs,
          requestTimeoutMs,
        );
        if (!response.ok) {
          return {
            ok: false,
            provider: LOCAL_E5_EMBEDDING_PROVIDER,
            checkedAt: new Date().toISOString(),
            message: `worker health ${response.status}`,
          };
        }
        const ready = await fetchWithTimeouts(
          fetchImpl,
          `${base}/ready`,
          { method: "GET" },
          connectionTimeoutMs,
          requestTimeoutMs,
        );
        return {
          ok: ready.ok,
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          checkedAt: new Date().toISOString(),
          ...(ready.ok ? {} : { message: "worker not ready" }),
        };
      } catch (error) {
        return {
          ok: false,
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          checkedAt: new Date().toISOString(),
          message: error instanceof Error ? error.message.slice(0, 200) : "worker unreachable",
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
