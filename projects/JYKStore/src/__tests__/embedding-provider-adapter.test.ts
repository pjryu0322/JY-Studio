import { test } from "node:test";
import assert from "node:assert/strict";
import { createLocalHashEmbeddingAdapter } from "@/lib/embedding/local-hash-embedding-adapter";
import { createOpenAiEmbeddingAdapter, computeBackoffMs } from "@/lib/embedding/openai-embedding-adapter";
import { isEmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import {
  assertEmbeddingProviderProductionReady,
  resolveEmbeddingProviderAdapter,
} from "@/lib/embedding/embedding-provider-registry";
import { readEmbeddingProviderConfig } from "@/lib/embedding/embedding-provider-config";

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

test("assertEmbeddingProviderProductionReady warns for local-hash outside production", () => {
  const readiness = assertEmbeddingProviderProductionReady(
    { provider: "local-hash" },
    { NODE_ENV: "development" },
  );
  assert.equal(readiness.ok, true);
  assert.ok(readiness.warning?.includes("WARNING"));
});

test("resolveEmbeddingProviderAdapter returns local-hash by default", () => {
  const adapter = resolveEmbeddingProviderAdapter(readEmbeddingProviderConfig({}));
  assert.equal(adapter.id, "local-hash");
});

// --- OpenAI adapter (mocked fetch) ------------------------------------------

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function embeddingBody(count: number, dimension: number, shuffled = false) {
  const indices = Array.from({ length: count }, (_, i) => i);
  const order = shuffled ? [...indices].reverse() : indices;
  return {
    data: order.map((index) => ({
      index,
      embedding: Array.from({ length: dimension }, (_, d) => (index + 1) * 0.01 + d * 0.001),
    })),
  };
}

test("openai adapter: embedBatch preserves order even when the API returns shuffled indices", async () => {
  let calls = 0;
  const adapter = createOpenAiEmbeddingAdapter({
    apiKey: "sk-test",
    dimension: 4,
    fetchImpl: async (_url, init) => {
      calls += 1;
      const parsed = JSON.parse(String(init?.body)) as { input: string[] };
      return jsonResponse(embeddingBody(parsed.input.length, 4, true));
    },
  });

  const result = await adapter.embedBatch({ texts: ["a", "b", "c"] });
  assert.equal(calls, 1);
  assert.equal(result.vectors.length, 3);
  // index 0 vector should start with (0+1)*0.01 = 0.01, regardless of shuffled response order.
  assert.ok(Math.abs(result.vectors[0]![0]! - 0.01) < 1e-9);
  assert.ok(Math.abs(result.vectors[1]![0]! - 0.02) < 1e-9);
  assert.ok(Math.abs(result.vectors[2]![0]! - 0.03) < 1e-9);
});

test("openai adapter: chunks large batches according to batchSize", async () => {
  const seenBatchSizes: number[] = [];
  const adapter = createOpenAiEmbeddingAdapter({
    apiKey: "sk-test",
    dimension: 3,
    batchSize: 2,
    fetchImpl: async (_url, init) => {
      const parsed = JSON.parse(String(init?.body)) as { input: string[] };
      seenBatchSizes.push(parsed.input.length);
      return jsonResponse(embeddingBody(parsed.input.length, 3));
    },
  });

  const result = await adapter.embedBatch({ texts: ["a", "b", "c", "d", "e"] });
  assert.deepEqual(seenBatchSizes, [2, 2, 1]);
  assert.equal(result.vectors.length, 5);
});

test("openai adapter: dimension mismatch throws EMBEDDING_DIMENSION_MISMATCH", async () => {
  const adapter = createOpenAiEmbeddingAdapter({
    apiKey: "sk-test",
    dimension: 8,
    fetchImpl: async () => jsonResponse(embeddingBody(1, 4)),
  });

  await assert.rejects(
    () => adapter.embed({ text: "hi" }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "EMBEDDING_DIMENSION_MISMATCH",
  );
});

test("openai adapter: rejects empty vectors", async () => {
  const adapter = createOpenAiEmbeddingAdapter({
    apiKey: "sk-test",
    dimension: 4,
    fetchImpl: async () => jsonResponse({ data: [{ index: 0, embedding: [] }] }),
  });

  await assert.rejects(
    () => adapter.embed({ text: "hi" }),
    (error: unknown) => isEmbeddingProviderError(error) && error.code === "EMBEDDING_VECTOR_INVALID",
  );
});

test("openai adapter: rejects NaN/Infinity in vectors", async () => {
  const adapter = createOpenAiEmbeddingAdapter({
    apiKey: "sk-test",
    dimension: 3,
    fetchImpl: async () =>
      jsonResponse({ data: [{ index: 0, embedding: [1, Number.NaN, Number.POSITIVE_INFINITY] }] }),
  });

  await assert.rejects(
    () => adapter.embed({ text: "hi" }),
    (error: unknown) => isEmbeddingProviderError(error) && error.code === "EMBEDDING_VECTOR_INVALID",
  );
});

test("openai adapter: retries on 429 with backoff then succeeds", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const adapter = createOpenAiEmbeddingAdapter({
    apiKey: "sk-test",
    dimension: 2,
    maxRetries: 3,
    delayFn: async (ms) => {
      delays.push(ms);
    },
    fetchImpl: async (_url, init) => {
      attempts += 1;
      if (attempts < 3) {
        return jsonResponse({ error: "rate limited" }, 429, { "retry-after": "0" });
      }
      const parsed = JSON.parse(String(init?.body)) as { input: string[] };
      return jsonResponse(embeddingBody(parsed.input.length, 2));
    },
  });

  const result = await adapter.embed({ text: "hi" });
  assert.equal(attempts, 3);
  assert.equal(delays.length, 2);
  assert.equal(result.vector.length, 2);
});

test("openai adapter: retries on 5xx and eventually fails after maxRetries", async () => {
  let attempts = 0;
  const adapter = createOpenAiEmbeddingAdapter({
    apiKey: "sk-test",
    dimension: 2,
    maxRetries: 2,
    delayFn: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      return jsonResponse({ error: "boom" }, 503);
    },
  });

  await assert.rejects(
    () => adapter.embed({ text: "hi" }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "EMBEDDING_PROVIDER_REQUEST_FAILED",
  );
  assert.equal(attempts, 3); // 1 initial + 2 retries
});

test("openai adapter: does not retry on non-retryable 4xx", async () => {
  let attempts = 0;
  const adapter = createOpenAiEmbeddingAdapter({
    apiKey: "sk-test",
    dimension: 2,
    maxRetries: 3,
    delayFn: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      return jsonResponse({ error: "bad request" }, 400);
    },
  });

  await assert.rejects(() => adapter.embed({ text: "hi" }));
  assert.equal(attempts, 1);
});

test("openai adapter: cancellation via AbortSignal stops in-flight batches", async () => {
  const controller = new AbortController();
  let calls = 0;
  const adapter = createOpenAiEmbeddingAdapter({
    apiKey: "sk-test",
    dimension: 2,
    batchSize: 1,
    fetchImpl: async (_url, init) => {
      calls += 1;
      if (calls === 2) controller.abort();
      const parsed = JSON.parse(String(init?.body)) as { input: string[] };
      return jsonResponse(embeddingBody(parsed.input.length, 2));
    },
  });

  await assert.rejects(
    () => adapter.embedBatch({ texts: ["a", "b", "c", "d"], signal: controller.signal }),
    (error: unknown) => isEmbeddingProviderError(error) && error.code === "EMBEDDING_REQUEST_CANCELLED",
  );
  assert.ok(calls <= 3, "should not continue issuing requests well past cancellation");
});

test("openai adapter: never includes the API key in thrown error messages", async () => {
  const secret = "sk-super-secret-value";
  const adapter = createOpenAiEmbeddingAdapter({
    apiKey: secret,
    dimension: 2,
    fetchImpl: async () => jsonResponse({ error: "bad request" }, 400),
  });

  try {
    await adapter.embed({ text: "hi" });
    assert.fail("expected rejection");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.ok(!message.includes(secret));
  }
});

test("computeBackoffMs honors a retry-after hint and otherwise grows exponentially", () => {
  assert.equal(computeBackoffMs(1, 2000), 2000);
  const first = computeBackoffMs(1);
  const second = computeBackoffMs(2);
  assert.ok(second >= first);
});
