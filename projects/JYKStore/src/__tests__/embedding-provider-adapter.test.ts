import { test } from "node:test";
import assert from "node:assert/strict";
import { createLocalHashEmbeddingAdapter } from "@/lib/embedding/local-hash-embedding-adapter";
import { createLocalE5EmbeddingAdapter } from "@/lib/embedding/local-e5-embedding-adapter";
import { computeBackoffMs } from "@/lib/embedding/embedding-provider-retry";
import { isEmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import {
  assertEmbeddingProviderProductionReady,
  assertSearchGenerationEmbeddingProvider,
  resolveEmbeddingProviderAdapter,
} from "@/lib/embedding/embedding-provider-registry";
import { readEmbeddingProviderConfig } from "@/lib/embedding/embedding-provider-config";
import { DEFAULT_E5_MODEL_ID } from "@/lib/embedding/e5-embedding-constants";
import { resolveSearchGenerationEmbeddingDescriptor } from "@/lib/search-generation/search-generation-types";

const MODEL = DEFAULT_E5_MODEL_ID;
const REVISION = "rev-abc123";

// --- local-hash adapter -----------------------------------------------------

test("local-hash adapter: embed is deterministic and matches dimension", async () => {
  const adapter = createLocalHashEmbeddingAdapter(32);
  const a = await adapter.embed({ text: "hello world" });
  const b = await adapter.embed({ text: "hello world" });
  assert.deepEqual(a.vector, b.vector);
  assert.equal(a.vector.length, 32);
  assert.equal(a.provider, "local-hash");
});

test("local-hash adapter: embedBatch preserves input order", async () => {
  const adapter = createLocalHashEmbeddingAdapter(16);
  const texts = ["alpha", "beta", "gamma", "delta"];
  const result = await adapter.embedBatch({ texts });
  assert.equal(result.vectors.length, texts.length);
  for (let i = 0; i < texts.length; i++) {
    const single = await adapter.embed({ text: texts[i]! });
    assert.deepEqual(result.vectors[i], single.vector);
  }
});

test("local-hash adapter: rejects work once cancelled", async () => {
  const controller = new AbortController();
  controller.abort();
  const adapter = createLocalHashEmbeddingAdapter(8);
  await assert.rejects(
    () => adapter.embed({ text: "x", signal: controller.signal }),
    (error: unknown) => isEmbeddingProviderError(error) && error.code === "EMBEDDING_REQUEST_CANCELLED",
  );
});

// --- registry / config -------------------------------------------------------

test("readEmbeddingProviderConfig defaults to local-hash/256 when unset", () => {
  const config = readEmbeddingProviderConfig({});
  assert.equal(config.provider, "local-hash");
  assert.equal(config.dimension, 256);
});

test("readEmbeddingProviderConfig rejects openai provider", () => {
  assert.throws(
    () => readEmbeddingProviderConfig({ JYKSTORE_EMBEDDING_PROVIDER: "openai" }),
    (error: unknown) => isEmbeddingProviderError(error) && error.code === "EMBEDDING_CONFIG_INVALID",
  );
});

test("assertEmbeddingProviderProductionReady blocks local-hash in production", () => {
  assert.throws(
    () =>
      assertEmbeddingProviderProductionReady({ provider: "local-hash" }, { NODE_ENV: "production" }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "EMBEDDING_PROVIDER_UNSAFE_IN_PRODUCTION",
  );
});

test("assertEmbeddingProviderProductionReady requires revision+token for local-e5 in production", () => {
  assert.throws(
    () =>
      assertEmbeddingProviderProductionReady(
        { provider: "local-e5" },
        {
          NODE_ENV: "production",
          JYKSTORE_EMBEDDING_PROVIDER: "local-e5",
          JYKSTORE_EMBEDDING_WORKER_URL: "http://worker:8000",
        },
      ),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "EMBEDDING_PROVIDER_NOT_CONFIGURED",
  );
});

test("assertSearchGenerationEmbeddingProvider blocks local-hash", () => {
  assert.throws(
    () => assertSearchGenerationEmbeddingProvider({ provider: "local-hash" }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "EMBEDDING_PROVIDER_UNSAFE_IN_PRODUCTION",
  );
});

test("resolveSearchGenerationEmbeddingDescriptor pins revision from env", () => {
  const descriptor = resolveSearchGenerationEmbeddingDescriptor({
    JYKSTORE_EMBEDDING_PROVIDER: "local-e5",
    JYKSTORE_EMBEDDING_WORKER_URL: "http://127.0.0.1:8010",
    JYKSTORE_EMBEDDING_MODEL: MODEL,
    JYKSTORE_EMBEDDING_DIMENSION: "384",
    JYKSTORE_EMBEDDING_MODEL_REVISION: REVISION,
  });
  assert.equal(descriptor.embeddingProvider, "local-e5");
  assert.equal(descriptor.embeddingDimension, 384);
  assert.equal(descriptor.embeddingModelRevision, REVISION);
});

test("resolveEmbeddingProviderAdapter returns local-hash by default", () => {
  const adapter = resolveEmbeddingProviderAdapter(readEmbeddingProviderConfig({}));
  assert.equal(adapter.id, "local-hash");
});

// --- local-e5 adapter (mocked worker) --------------------------------------

function readyPayload(overrides: Record<string, unknown> = {}, dimension = 384) {
  return {
    ready: true,
    backend: "sentence-transformers",
    stub: false,
    model: MODEL,
    revision: REVISION,
    dimension,
    maxSequenceTokens: 512,
    normalized: true,
    device: "cpu",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function vectorsResponse(count: number, dimension: number) {
  return {
    model: MODEL,
    revision: REVISION,
    dimension,
    vectors: Array.from({ length: count }, (_, i) =>
      Array.from({ length: dimension }, (_, d) => (i + 1) * 0.01 + d * 0.0001),
    ),
  };
}

type RouteOpts = {
  ready?: Record<string, unknown>;
  dimension?: number;
  onEmbed?: (path: string, body: { texts: string[] }, headers: Headers) => Response | null;
  capture?: (info: { path: string; headers: Headers }) => void;
};

function routedFetch(opts: RouteOpts = {}): typeof fetch {
  const dimension = opts.dimension ?? 384;
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const headers = new Headers(init?.headers);
    opts.capture?.({ path: u, headers });
    if (u.endsWith("/health")) return jsonResponse({ status: "ok" });
    if (u.endsWith("/ready")) return jsonResponse(readyPayload(opts.ready, dimension));
    const body = init?.body ? (JSON.parse(String(init.body)) as { texts: string[] }) : { texts: [] };
    if (opts.onEmbed) {
      const custom = opts.onEmbed(u, body, headers);
      if (custom) return custom;
    }
    return jsonResponse(vectorsResponse(body.texts.length, dimension));
  }) as unknown as typeof fetch;
}

test("local-e5 adapter: embed adds query prefix, verifies /ready, and sends auth", async () => {
  const paths: string[] = [];
  let authSeen = "";
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 384,
    modelRevision: REVISION,
    token: "secret-token",
    fetchImpl: routedFetch({
      capture: ({ path, headers }) => {
        paths.push(path);
        if (path.endsWith("/embed/query")) authSeen = headers.get("authorization") ?? "";
      },
    }),
  });

  const result = await adapter.embed({ text: "검색 질문" });
  assert.ok(paths.some((p) => p.endsWith("/ready")));
  assert.ok(paths.some((p) => p.endsWith("/embed/query")));
  assert.equal(authSeen, "Bearer secret-token");
  assert.equal(result.vector.length, 384);
});

test("local-e5 adapter: blocks when worker reports stub=true", async () => {
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 384,
    modelRevision: REVISION,
    fetchImpl: routedFetch({ ready: { stub: true, backend: "stub", revision: "stub" } }),
  });
  await assert.rejects(
    () => adapter.embed({ text: "q" }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "EMBEDDING_WORKER_STUB_ACTIVE",
  );
});

test("local-e5 adapter: blocks on model mismatch", async () => {
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 384,
    modelRevision: REVISION,
    fetchImpl: routedFetch({ ready: { model: "other/model" } }),
  });
  await assert.rejects(
    () => adapter.embed({ text: "q" }),
    (error: unknown) => isEmbeddingProviderError(error) && error.code === "EMBEDDING_MODEL_MISMATCH",
  );
});

test("local-e5 adapter: blocks on revision mismatch", async () => {
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 384,
    modelRevision: REVISION,
    fetchImpl: routedFetch({ ready: { revision: "different" } }),
  });
  await assert.rejects(
    () => adapter.embed({ text: "q" }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "EMBEDDING_MODEL_REVISION_MISMATCH",
  );
});

test("local-e5 adapter: blocks on dimension mismatch from /ready", async () => {
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 384,
    modelRevision: REVISION,
    fetchImpl: routedFetch({ ready: { dimension: 256 } }),
  });
  await assert.rejects(
    () => adapter.embed({ text: "q" }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "EMBEDDING_DIMENSION_MISMATCH",
  );
});

test("local-e5 adapter: blocks when worker is not normalized", async () => {
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 384,
    modelRevision: REVISION,
    fetchImpl: routedFetch({ ready: { normalized: false } }),
  });
  await assert.rejects(
    () => adapter.embed({ text: "q" }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "EMBEDDING_NORMALIZATION_MISMATCH",
  );
});

test("local-e5 adapter: embedBatch requires passage prefix", async () => {
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 384,
    modelRevision: REVISION,
    fetchImpl: routedFetch(),
  });
  await assert.rejects(
    () => adapter.embedBatch({ texts: ["no-prefix"] }),
    (error: unknown) => isEmbeddingProviderError(error) && error.code === "EMBEDDING_PREFIX_INVALID",
  );
});

test("local-e5 adapter: embedBatch preserves order across worker chunks", async () => {
  const seenLengths: number[] = [];
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 4,
    modelRevision: REVISION,
    batchSize: 2,
    fetchImpl: routedFetch({
      dimension: 4,
      onEmbed: (_path, body) => {
        seenLengths.push(body.texts.length);
        return null;
      },
    }),
  });

  const result = await adapter.embedBatch({
    texts: ["passage: a", "passage: b", "passage: c"],
  });
  assert.deepEqual(seenLengths, [2, 1]);
  assert.equal(result.vectors.length, 3);
});

test("local-e5 adapter: converts worker token-limit 400 into EMBEDDING_TOKEN_LIMIT_EXCEEDED", async () => {
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 384,
    modelRevision: REVISION,
    fetchImpl: routedFetch({
      onEmbed: (path) => {
        if (path.endsWith("/embed/passages")) {
          return jsonResponse(
            {
              detail: {
                code: "EMBEDDING_TOKEN_LIMIT_EXCEEDED",
                index: 0,
                tokenCount: 900,
                maxSequenceTokens: 512,
              },
            },
            400,
          );
        }
        return null;
      },
    }),
  });

  await assert.rejects(
    () => adapter.embedBatch({ texts: ["passage: too long"] }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "EMBEDDING_TOKEN_LIMIT_EXCEEDED",
  );
});

test("local-e5 adapter: does not retry on 401", async () => {
  let embedCalls = 0;
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 384,
    modelRevision: REVISION,
    token: "bad",
    delayFn: async () => {},
    fetchImpl: routedFetch({
      onEmbed: (path) => {
        if (path.endsWith("/embed/query")) {
          embedCalls += 1;
          return jsonResponse({ detail: "unauthorized" }, 401);
        }
        return null;
      },
    }),
  });

  await assert.rejects(() => adapter.embed({ text: "q" }));
  assert.equal(embedCalls, 1);
});

test("local-e5 adapter: retries on 503 with Retry-After then succeeds", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 2,
    modelRevision: REVISION,
    maxRetries: 3,
    delayFn: async (ms) => {
      delays.push(ms);
    },
    fetchImpl: routedFetch({
      dimension: 2,
      onEmbed: (path) => {
        if (path.endsWith("/embed/query")) {
          attempts += 1;
          if (attempts < 3) return jsonResponse({ detail: "busy" }, 503, { "retry-after": "0" });
        }
        return null;
      },
    }),
  });

  const result = await adapter.embed({ text: "q" });
  assert.equal(attempts, 3);
  assert.equal(delays.length, 2);
  assert.equal(result.vector.length, 2);
});

test("local-e5 adapter: healthCheck fails when worker is stub", async () => {
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 384,
    modelRevision: REVISION,
    fetchImpl: routedFetch({ ready: { stub: true, backend: "stub" } }),
  });
  const health = await adapter.healthCheck();
  assert.equal(health.ok, false);
  assert.ok(health.message?.includes("EMBEDDING_WORKER_STUB_ACTIVE"));
});

test("computeBackoffMs honors a retry-after hint and otherwise grows exponentially", () => {
  assert.equal(computeBackoffMs(1, 2000), 2000);
  const first = computeBackoffMs(1);
  const second = computeBackoffMs(2);
  assert.ok(second >= first);
});
