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

test("local-hash adapter: healthCheck reports a production warning", async () => {
  const adapter = createLocalHashEmbeddingAdapter(8);
  const health = await adapter.healthCheck();
  assert.equal(health.ok, true);
  assert.ok(health.warning?.includes("WARNING"));
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

test("readEmbeddingProviderConfig rejects an invalid dimension", () => {
  assert.throws(
    () => readEmbeddingProviderConfig({ JYKSTORE_EMBEDDING_DIMENSION: "not-a-number" }),
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

test("assertSearchGenerationEmbeddingProvider blocks local-hash", () => {
  assert.throws(
    () => assertSearchGenerationEmbeddingProvider({ provider: "local-hash" }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "EMBEDDING_PROVIDER_UNSAFE_IN_PRODUCTION",
  );
});

test("resolveSearchGenerationEmbeddingDescriptor requires local-e5 worker URL", () => {
  const descriptor = resolveSearchGenerationEmbeddingDescriptor({
    JYKSTORE_EMBEDDING_PROVIDER: "local-e5",
    JYKSTORE_EMBEDDING_WORKER_URL: "http://127.0.0.1:8010",
    JYKSTORE_EMBEDDING_MODEL: DEFAULT_E5_MODEL_ID,
    JYKSTORE_EMBEDDING_DIMENSION: "384",
  });
  assert.equal(descriptor.embeddingProvider, "local-e5");
  assert.equal(descriptor.embeddingDimension, 384);
});

test("resolveEmbeddingProviderAdapter returns local-hash by default", () => {
  const adapter = resolveEmbeddingProviderAdapter(readEmbeddingProviderConfig({}));
  assert.equal(adapter.id, "local-hash");
});

// --- local-e5 adapter (mocked worker) --------------------------------------

function workerVectorsResponse(count: number, dimension: number) {
  return {
    model: DEFAULT_E5_MODEL_ID,
    dimension,
    vectors: Array.from({ length: count }, (_, i) =>
      Array.from({ length: dimension }, (_, d) => (i + 1) * 0.01 + d * 0.0001),
    ),
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

test("local-e5 adapter: embed adds query prefix and calls /embed/query", async () => {
  let path = "";
  let body: { texts: string[] } | null = null;
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 384,
    fetchImpl: async (url, init) => {
      path = String(url);
      body = JSON.parse(String(init?.body)) as { texts: string[] };
      return jsonResponse(workerVectorsResponse(1, 384));
    },
  });

  const result = await adapter.embed({ text: "검색 질문" });
  assert.ok(path.endsWith("/embed/query"));
  assert.ok(body!.texts[0]!.startsWith("query:"));
  assert.equal(result.vector.length, 384);
});

test("local-e5 adapter: embedBatch requires passage prefix", async () => {
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 384,
    fetchImpl: async () => jsonResponse(workerVectorsResponse(1, 384)),
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
    batchSize: 2,
    fetchImpl: async (_url, init) => {
      const parsed = JSON.parse(String(init?.body)) as { texts: string[] };
      seenLengths.push(parsed.texts.length);
      return jsonResponse(workerVectorsResponse(parsed.texts.length, 4));
    },
  });

  const result = await adapter.embedBatch({
    texts: ["passage: a", "passage: b", "passage: c"],
  });
  assert.deepEqual(seenLengths, [2, 1]);
  assert.equal(result.vectors.length, 3);
});

test("local-e5 adapter: dimension mismatch throws EMBEDDING_DIMENSION_MISMATCH", async () => {
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 8,
    fetchImpl: async () => jsonResponse(workerVectorsResponse(1, 4)),
  });

  await assert.rejects(
    () => adapter.embed({ text: "q" }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "EMBEDDING_DIMENSION_MISMATCH",
  );
});

test("local-e5 adapter: retries on 5xx then succeeds", async () => {
  let attempts = 0;
  const adapter = createLocalE5EmbeddingAdapter({
    workerBaseUrl: "http://worker.test",
    dimension: 2,
    maxRetries: 2,
    delayFn: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 2) return jsonResponse({ error: "boom" }, 503);
      return jsonResponse(workerVectorsResponse(1, 2));
    },
  });

  const result = await adapter.embed({ text: "hello" });
  assert.equal(attempts, 2);
  assert.equal(result.vector.length, 2);
});

test("computeBackoffMs honors a retry-after hint and otherwise grows exponentially", () => {
  assert.equal(computeBackoffMs(1, 2000), 2000);
  const first = computeBackoffMs(1);
  const second = computeBackoffMs(2);
  assert.ok(second >= first);
});
