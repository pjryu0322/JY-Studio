/**
 * Node client for Local E5 Worker /tokenize/* APIs.
 * Uses the same tokenizer / model / revision as /embed/* (truncation=false).
 * Never logs passage/query text or auth tokens.
 */

import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  E5_LIVE_BACKEND,
  E5_MAX_SEQUENCE_TOKENS,
  E5_TOKENIZE_BATCH_SIZE,
  LEGACY_MODEL_REVISION,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "@/lib/embedding/e5-embedding-constants";
import { assertE5PassageText, assertE5QueryText } from "@/lib/embedding/e5-embedding-text";
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { readEmbeddingProviderConfig } from "@/lib/embedding/embedding-provider-config";

type FetchLike = typeof fetch;

export type TokenizeItem = {
  index: number;
  tokenCount: number;
  withinLimit: boolean;
};

export type TokenizePassagesResponse = {
  model: string;
  revision: string;
  maxSequenceTokens: number;
  items: TokenizeItem[];
};

export type TokenizeClientOptions = {
  workerBaseUrl?: string;
  model?: string;
  modelRevision?: string | null;
  token?: string | null;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  batchSize?: number;
  signal?: AbortSignal;
};

type WorkerReadyResponse = {
  ready: boolean;
  backend: string;
  stub: boolean;
  model: string;
  revision: string;
  dimension: number;
  maxSequenceTokens: number;
  maxBatchSize?: number;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const linkAbort = () => controller.abort();
  signal?.addEventListener("abort", linkAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (signal?.aborted) {
      throw new EmbeddingProviderError(
        "EMBEDDING_REQUEST_CANCELLED",
        "local-e5: tokenize request was cancelled.",
      );
    }
    throw new EmbeddingProviderError(
      "EMBEDDING_PROVIDER_TIMEOUT",
      "local-e5: tokenize request timed out.",
      { retryable: true, cause: error },
    );
  } finally {
    signal?.removeEventListener("abort", linkAbort);
    clearTimeout(timer);
  }
}

function authHeaders(token: string | null | undefined, base: Record<string, string> = {}) {
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

async function ensureTokenizeReady(input: {
  base: string;
  model: string;
  expectedRevision: string | null;
  token: string | null;
  fetchImpl: FetchLike;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<{ maxBatchSize: number }> {
  const response = await fetchWithTimeout(
    input.fetchImpl,
    `${input.base}/ready`,
    { method: "GET", headers: authHeaders(input.token) },
    input.timeoutMs,
    input.signal,
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
      { retryable: true },
    );
  }
  const ready = (await response.json()) as WorkerReadyResponse;
  if (!ready.ready) {
    throw new EmbeddingProviderError(
      "EMBEDDING_WORKER_NOT_READY",
      "local-e5: worker is not ready.",
      { retryable: true },
    );
  }
  if (ready.stub) {
    throw new EmbeddingProviderError(
      "EMBEDDING_WORKER_STUB_ACTIVE",
      "local-e5: stub worker cannot authorize structure token gates.",
      { retryable: false },
    );
  }
  if (ready.backend !== E5_LIVE_BACKEND) {
    throw new EmbeddingProviderError(
      "EMBEDDING_WORKER_NOT_READY",
      "local-e5: unexpected worker backend.",
      { retryable: false },
    );
  }
  if (ready.model !== input.model) {
    throw new EmbeddingProviderError(
      "EMBEDDING_MODEL_MISMATCH",
      "local-e5: worker model mismatch.",
      { retryable: false },
    );
  }
  if (input.expectedRevision && ready.revision !== input.expectedRevision) {
    throw new EmbeddingProviderError(
      "EMBEDDING_MODEL_REVISION_MISMATCH",
      "local-e5: worker model revision mismatch.",
      { retryable: false },
    );
  }
  if (ready.maxSequenceTokens !== E5_MAX_SEQUENCE_TOKENS) {
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      `local-e5: maxSequenceTokens must be ${E5_MAX_SEQUENCE_TOKENS}.`,
      { retryable: false },
    );
  }
  const maxBatchSize =
    typeof ready.maxBatchSize === "number" && ready.maxBatchSize >= 1
      ? ready.maxBatchSize
      : 32;
  return { maxBatchSize };
}

async function postTokenize(input: {
  base: string;
  path: "/tokenize/passages" | "/tokenize/query";
  model: string;
  expectedRevision: string | null;
  texts: string[];
  token: string | null;
  fetchImpl: FetchLike;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<TokenizePassagesResponse> {
  const response = await fetchWithTimeout(
    input.fetchImpl,
    `${input.base}${input.path}`,
    {
      method: "POST",
      headers: authHeaders(input.token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ model: input.model, texts: input.texts }),
    },
    input.timeoutMs,
    input.signal,
  );
  if (response.status === 401 || response.status === 403) {
    throw new EmbeddingProviderError(
      "EMBEDDING_PROVIDER_REQUEST_FAILED",
      `local-e5: worker rejected authorization (${response.status}).`,
      { retryable: false },
    );
  }
  if (response.status === 503) {
    throw new EmbeddingProviderError(
      "EMBEDDING_WORKER_NOT_READY",
      "local-e5: tokenize worker unavailable.",
      { retryable: true },
    );
  }
  if (!response.ok) {
    throw new EmbeddingProviderError(
      "EMBEDDING_PROVIDER_REQUEST_FAILED",
      `local-e5: tokenize returned ${response.status}.`,
      { retryable: false },
    );
  }
  const json = (await response.json()) as TokenizePassagesResponse;
  if (json.model !== input.model) {
    throw new EmbeddingProviderError(
      "EMBEDDING_MODEL_MISMATCH",
      "local-e5: tokenize model mismatch.",
      { retryable: false },
    );
  }
  if (input.expectedRevision && json.revision !== input.expectedRevision) {
    throw new EmbeddingProviderError(
      "EMBEDDING_MODEL_REVISION_MISMATCH",
      "local-e5: tokenize revision mismatch.",
      { retryable: false },
    );
  }
  if (json.maxSequenceTokens !== E5_MAX_SEQUENCE_TOKENS) {
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      `local-e5: tokenize maxSequenceTokens must be ${E5_MAX_SEQUENCE_TOKENS}.`,
      { retryable: false },
    );
  }
  if (!Array.isArray(json.items) || json.items.length !== input.texts.length) {
    throw new EmbeddingProviderError(
      "EMBEDDING_VECTOR_INVALID",
      "local-e5: tokenize item count mismatch.",
      { retryable: false },
    );
  }
  for (let i = 0; i < json.items.length; i++) {
    const item = json.items[i]!;
    if (item.index !== i || !Number.isInteger(item.tokenCount) || item.tokenCount < 0) {
      throw new EmbeddingProviderError(
        "EMBEDDING_CONFIG_INVALID",
        "local-e5: tokenize item is invalid.",
        { retryable: false },
      );
    }
  }
  return json;
}

/**
 * Tokenize passage texts via Local E5 Worker (batch default 16).
 * Texts must already include the `passage:` prefix (use buildPassageEmbeddingText).
 */
export async function tokenizePassages(input: {
  texts: string[];
  signal?: AbortSignal;
  options?: TokenizeClientOptions;
}): Promise<TokenizePassagesResponse> {
  const config = readEmbeddingProviderConfig();
  const options = input.options ?? {};
  const workerBaseUrl = (options.workerBaseUrl ?? config.workerUrl ?? "").trim();
  const model = options.model ?? config.model ?? DEFAULT_E5_MODEL_ID;
  const modelRevision =
    options.modelRevision !== undefined ? options.modelRevision : config.modelRevision;
  const token =
    options.token !== undefined ? options.token : (config.workerToken ?? null);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const requestedBatch = options.batchSize ?? E5_TOKENIZE_BATCH_SIZE;

  if (!workerBaseUrl) {
    throw new EmbeddingProviderError(
      "EMBEDDING_PROVIDER_NOT_CONFIGURED",
      "local-e5: JYKSTORE_EMBEDDING_WORKER_URL이 설정되지 않았습니다.",
    );
  }
  if (config.provider !== LOCAL_E5_EMBEDDING_PROVIDER && !options.workerBaseUrl) {
    throw new EmbeddingProviderError(
      "EMBEDDING_CONFIG_INVALID",
      "local-e5: tokenize requires local-e5 provider.",
    );
  }

  for (const text of input.texts) {
    assertE5PassageText(text);
  }

  const base = normalizeBaseUrl(workerBaseUrl);
  const expectedRevision =
    modelRevision && modelRevision !== LEGACY_MODEL_REVISION
      ? modelRevision.trim()
      : null;

  const { maxBatchSize } = await ensureTokenizeReady({
    base,
    model,
    expectedRevision,
    token,
    fetchImpl,
    timeoutMs,
    signal: input.signal ?? options.signal,
  });
  const batchSize = Math.max(1, Math.min(requestedBatch, maxBatchSize));

  if (input.texts.length === 0) {
    return {
      model,
      revision: expectedRevision ?? "",
      maxSequenceTokens: E5_MAX_SEQUENCE_TOKENS,
      items: [],
    };
  }

  const items: TokenizeItem[] = [];
  let revision = expectedRevision ?? "";
  for (let offset = 0; offset < input.texts.length; offset += batchSize) {
    const slice = input.texts.slice(offset, offset + batchSize);
    const part = await postTokenize({
      base,
      path: "/tokenize/passages",
      model,
      expectedRevision,
      texts: slice,
      token,
      fetchImpl,
      timeoutMs,
      signal: input.signal ?? options.signal,
    });
    if (part.revision) revision = part.revision;
    for (const item of part.items) {
      items.push({
        index: offset + item.index,
        tokenCount: item.tokenCount,
        withinLimit: item.withinLimit,
      });
    }
  }

  return {
    model,
    revision,
    maxSequenceTokens: E5_MAX_SEQUENCE_TOKENS,
    items,
  };
}

/** Tokenize query texts via Local E5 Worker. */
export async function tokenizeQueries(input: {
  texts: string[];
  signal?: AbortSignal;
  options?: TokenizeClientOptions;
}): Promise<TokenizePassagesResponse> {
  const config = readEmbeddingProviderConfig();
  const options = input.options ?? {};
  const workerBaseUrl = (options.workerBaseUrl ?? config.workerUrl ?? "").trim();
  const model = options.model ?? config.model ?? DEFAULT_E5_MODEL_ID;
  const modelRevision =
    options.modelRevision !== undefined ? options.modelRevision : config.modelRevision;
  const token =
    options.token !== undefined ? options.token : (config.workerToken ?? null);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const requestedBatch = options.batchSize ?? E5_TOKENIZE_BATCH_SIZE;

  if (!workerBaseUrl) {
    throw new EmbeddingProviderError(
      "EMBEDDING_PROVIDER_NOT_CONFIGURED",
      "local-e5: JYKSTORE_EMBEDDING_WORKER_URL이 설정되지 않았습니다.",
    );
  }

  const normalizedTexts = input.texts.map((text) => {
    assertE5QueryText(text);
    return text.startsWith("query:") ? text : `query: ${text.trim()}`;
  });

  const base = normalizeBaseUrl(workerBaseUrl);
  const expectedRevision =
    modelRevision && modelRevision !== LEGACY_MODEL_REVISION
      ? modelRevision.trim()
      : null;
  const { maxBatchSize } = await ensureTokenizeReady({
    base,
    model,
    expectedRevision,
    token,
    fetchImpl,
    timeoutMs,
    signal: input.signal ?? options.signal,
  });
  const batchSize = Math.max(1, Math.min(requestedBatch, maxBatchSize));

  const items: TokenizeItem[] = [];
  let revision = expectedRevision ?? "";
  for (let offset = 0; offset < normalizedTexts.length; offset += batchSize) {
    const slice = normalizedTexts.slice(offset, offset + batchSize);
    const part = await postTokenize({
      base,
      path: "/tokenize/query",
      model,
      expectedRevision,
      texts: slice,
      token,
      fetchImpl,
      timeoutMs,
      signal: input.signal ?? options.signal,
    });
    if (part.revision) revision = part.revision;
    for (const item of part.items) {
      items.push({
        index: offset + item.index,
        tokenCount: item.tokenCount,
        withinLimit: item.withinLimit,
      });
    }
  }

  return {
    model,
    revision,
    maxSequenceTokens: E5_MAX_SEQUENCE_TOKENS,
    items,
  };
}

/** Snapshot recorded into PipelineRun / chunk metadata (no schema change). */
export function buildLocalE5EmbeddingProfile(input?: {
  model?: string;
  revision?: string | null;
  dimension?: number;
}): {
  provider: typeof LOCAL_E5_EMBEDDING_PROVIDER;
  model: string;
  revision: string;
  dimension: number;
  targetPassageTokens: number;
  maxSequenceTokens: number;
  overlapTokens: number;
  distanceMetric: "cosine";
} {
  const config = readEmbeddingProviderConfig();
  const revision =
    (input?.revision !== undefined ? input.revision : config.modelRevision)?.trim() ||
    "";
  return {
    provider: LOCAL_E5_EMBEDDING_PROVIDER,
    model: input?.model ?? config.model ?? DEFAULT_E5_MODEL_ID,
    revision,
    dimension: input?.dimension ?? config.dimension ?? DEFAULT_E5_EMBEDDING_DIMENSION,
    targetPassageTokens: 480,
    maxSequenceTokens: E5_MAX_SEQUENCE_TOKENS,
    overlapTokens: 48,
    distanceMetric: "cosine",
  };
}

/** Injectable counter for unit tests (avoids live worker). */
export type PassageTokenCounter = (texts: string[]) => Promise<number[]>;

export function createEstimatePassageTokenCounter(): PassageTokenCounter {
  return async (texts) => {
    const { estimateEmbeddingTokenCount: est } = await import(
      "@/lib/embedding/e5-embedding-text"
    );
    return texts.map((t) => est(t));
  };
}

export function createWorkerPassageTokenCounter(
  options?: TokenizeClientOptions,
): PassageTokenCounter {
  return async (texts) => {
    if (texts.length === 0) return [];
    const result = await tokenizePassages({ texts, options });
    return result.items.map((item) => item.tokenCount);
  };
}
