// P5: OpenAI embeddings adapter — batch requests, timeout, retry (429 backoff, 5xx retry),
// cancellation, dimension validation, and rejection of empty/NaN/Infinity vectors.
// NEVER log the API key or include it in thrown error messages.

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
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";

export const OPENAI_EMBEDDING_PROVIDER = "openai" as const;
export const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

type FetchLike = typeof fetch;

export type OpenAiEmbeddingAdapterOptions = {
  apiKey: string;
  model?: string;
  dimension: number;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  /** Max retry attempts after the first try (default 3). */
  maxRetries?: number;
  /** Per-attempt timeout in ms (default 15000). */
  timeoutMs?: number;
  /** Max texts per HTTP request (default 100 — OpenAI supports large batches, kept conservative). */
  batchSize?: number;
  /** Test hook: overrides the delay implementation (default real setTimeout-based). */
  delayFn?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

type OpenAiEmbeddingsResponse = {
  data: Array<{ embedding: number[]; index: number }>;
};

function defaultDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new EmbeddingProviderError("EMBEDDING_REQUEST_CANCELLED", "openai: request was cancelled."),
      );
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(
        new EmbeddingProviderError("EMBEDDING_REQUEST_CANCELLED", "openai: request was cancelled."),
      );
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function computeBackoffMs(attempt: number, retryAfterMs?: number): number {
  if (typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
    return Math.min(retryAfterMs, 30_000);
  }
  const base = Math.min(500 * 2 ** (attempt - 1), 8_000);
  const jitter = Math.floor(Math.random() * 100);
  return base + jitter;
}

function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return seconds * 1000;
}

/**
 * Creates an OpenAI embeddings adapter. `apiKey` is only ever placed in the
 * Authorization header — it is never included in error messages or logs.
 */
export function createOpenAiEmbeddingAdapter(
  options: OpenAiEmbeddingAdapterOptions,
): EmbeddingProviderAdapter {
  const {
    apiKey,
    model = DEFAULT_OPENAI_EMBEDDING_MODEL,
    dimension,
    baseUrl = DEFAULT_OPENAI_BASE_URL,
    fetchImpl = fetch,
    maxRetries = 3,
    timeoutMs = 15_000,
    batchSize = 100,
    delayFn = defaultDelay,
  } = options;

  if (!apiKey || !apiKey.trim()) {
    throw new EmbeddingProviderError(
      "EMBEDDING_PROVIDER_NOT_CONFIGURED",
      "openai: OPENAI_API_KEY가 설정되지 않았습니다.",
    );
  }
  if (!Number.isInteger(dimension) || dimension <= 0) {
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      "openai: embedding dimension must be a positive integer.",
    );
  }

  const descriptor = { provider: OPENAI_EMBEDDING_PROVIDER, model, dimension };

  async function handleResponse(
    response: Response,
    expectedCount: number,
  ): Promise<OpenAiEmbeddingsResponse> {
    if (response.status === 429) {
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_RATE_LIMITED",
        "openai: rate limited (429).",
        { retryable: true, retryAfterMs: parseRetryAfterMs(response) },
      );
    }
    if (response.status >= 500) {
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_REQUEST_FAILED",
        `openai: server error (${response.status}).`,
        { retryable: true },
      );
    }
    if (!response.ok) {
      // 4xx (not 429): never retryable, never include response body (may echo input text).
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_REQUEST_FAILED",
        `openai: request rejected (${response.status}).`,
      );
    }
    let json: OpenAiEmbeddingsResponse;
    try {
      json = (await response.json()) as OpenAiEmbeddingsResponse;
    } catch (error) {
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_REQUEST_FAILED",
        "openai: response body was not valid JSON.",
        { cause: error },
      );
    }
    if (!json || !Array.isArray(json.data) || json.data.length !== expectedCount) {
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_REQUEST_FAILED",
        "openai: response shape did not match the request batch size.",
      );
    }
    return json;
  }

  async function requestEmbeddingsOnce(
    inputs: string[],
    signal: AbortSignal | undefined,
  ): Promise<OpenAiEmbeddingsResponse> {
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener("abort", onExternalAbort, { once: true });
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: inputs, dimensions: dimension }),
        signal: controller.signal,
      });
      return await handleResponse(response, inputs.length);
    } catch (error) {
      if (signal?.aborted) {
        throw new EmbeddingProviderError(
          "EMBEDDING_REQUEST_CANCELLED",
          "openai: embedding request was cancelled.",
        );
      }
      if (controller.signal.aborted) {
        throw new EmbeddingProviderError("EMBEDDING_PROVIDER_TIMEOUT", "openai: request timed out.", {
          retryable: true,
        });
      }
      if (error instanceof EmbeddingProviderError) throw error;
      throw new EmbeddingProviderError(
        "EMBEDDING_PROVIDER_REQUEST_FAILED",
        `openai: request failed (${error instanceof Error ? error.name : "unknown error"}).`,
        { retryable: true, cause: error },
      );
    } finally {
      clearTimeout(timeoutHandle);
      signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  async function requestEmbeddingsWithRetry(
    inputs: string[],
    signal: AbortSignal | undefined,
  ): Promise<number[][]> {
    let attempt = 0;
    // attempt 1 = first try; retries happen while attempt <= maxRetries.
    while (true) {
      attempt += 1;
      try {
        const json = await requestEmbeddingsOnce(inputs, signal);
        return [...json.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
      } catch (error) {
        assertNotCancelled(signal, "openai.embedBatch");
        const retryable = error instanceof EmbeddingProviderError && error.retryable;
        if (!retryable || attempt > maxRetries) {
          throw error;
        }
        const retryAfterMs =
          error instanceof EmbeddingProviderError ? error.retryAfterMs : undefined;
        await delayFn(computeBackoffMs(attempt, retryAfterMs), signal);
      }
    }
  }

  async function embedBatch(input: EmbeddingBatchRequest): Promise<EmbeddingBatchResult> {
    assertNotCancelled(input.signal, "openai.embedBatch");
    if (input.texts.length === 0) {
      return { ...descriptor, vectors: [] };
    }
    const vectors: number[][] = [];
    for (let start = 0; start < input.texts.length; start += batchSize) {
      assertNotCancelled(input.signal, "openai.embedBatch");
      const slice = input.texts.slice(start, start + batchSize);
      const embeddings = await requestEmbeddingsWithRetry(slice, input.signal);
      for (const vector of embeddings) {
        assertFiniteVector(vector, dimension, "openai");
        vectors.push(vector);
      }
    }
    return { ...descriptor, vectors };
  }

  return {
    id: OPENAI_EMBEDDING_PROVIDER,
    resolveDescriptor: () => ({ ...descriptor }),
    async embed(input: EmbeddingRequest): Promise<EmbeddingResult> {
      const result = await embedBatch({ texts: [input.text], signal: input.signal });
      return { ...descriptor, vector: result.vectors[0]! };
    },
    embedBatch,
    async healthCheck(): Promise<EmbeddingProviderHealth> {
      try {
        await requestEmbeddingsWithRetry(["healthcheck"], undefined);
        return { ok: true, provider: descriptor.provider, checkedAt: new Date().toISOString() };
      } catch (error) {
        const message =
          error instanceof EmbeddingProviderError ? error.message : "openai: health check failed.";
        return { ok: false, provider: descriptor.provider, checkedAt: new Date().toISOString(), message };
      }
    },
  };
}
