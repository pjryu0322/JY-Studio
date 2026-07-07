import { test } from "node:test";
import assert from "node:assert/strict";
import { embedText } from "@/lib/embedding-service";
import {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
} from "@/lib/embedding-dto";
import { clampedCosineSimilarity, isValidVector } from "@/lib/vector-similarity";

// chunk-embedding-service는 @/lib/prisma를 import하므로 DB 접근 없는 순수 함수 테스트를 위해
// dummy DATABASE_URL만 세팅하고, prisma 생성 시점을 늦추기 위해 dynamic import를 사용한다.
// (PrismaClient는 lazy connect라 쿼리 없이는 연결하지 않는다)
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

let modPromise: Promise<typeof import("@/lib/chunk-embedding-service")> | null = null;
function loadChunkEmbeddingService() {
  return (modPromise ??= import("@/lib/chunk-embedding-service"));
}

test("embedText is deterministic for the same text", () => {
  assert.deepEqual(embedText({ text: "callback 처리" }).vector, embedText({ text: "callback 처리" }).vector);
});

test("embedText returns default dimension / provider / model", () => {
  const result = embedText({ text: "hello" });
  assert.equal(result.dimension, DEFAULT_EMBEDDING_DIMENSION);
  assert.equal(result.vector.length, DEFAULT_EMBEDDING_DIMENSION);
  assert.equal(result.provider, DEFAULT_EMBEDDING_PROVIDER);
  assert.equal(result.model, DEFAULT_EMBEDDING_MODEL);
});

test("clampedCosineSimilarity of identical vector is ~1", () => {
  const { vector } = embedText({ text: "인증 결과 callback 처리" });
  const similarity = clampedCosineSimilarity(vector, vector);
  assert.ok(similarity > 0.999, `expected ~1, got ${similarity}`);
});

test("clampedCosineSimilarity stays within 0..1 and handles zero vectors", () => {
  const a = embedText({ text: "callback" }).vector;
  const b = embedText({ text: "완전히 다른 주제 문장" }).vector;
  const similarity = clampedCosineSimilarity(a, b);
  assert.ok(similarity >= 0 && similarity <= 1);

  const zero = new Array(DEFAULT_EMBEDDING_DIMENSION).fill(0);
  assert.equal(clampedCosineSimilarity(zero, a), 0);
});

test("isValidVector rejects empty and non-numeric arrays", () => {
  assert.equal(isValidVector([]), false);
  assert.equal(isValidVector([1, 2, 3]), true);
  assert.equal(isValidVector(["a", 1] as unknown), false);
  assert.equal(isValidVector(null), false);
});

test("computeChunkContentHash changes when title/content/section/tags change", async () => {
  const { computeChunkContentHash } = await loadChunkEmbeddingService();
  const base = { title: "Callback 처리", content: "본문", section: "s", tags: ["callback", "java"] };
  const hash = computeChunkContentHash(base);

  assert.notEqual(hash, computeChunkContentHash({ ...base, title: "다른 제목" }));
  assert.notEqual(hash, computeChunkContentHash({ ...base, content: "다른 본문" }));
  assert.notEqual(hash, computeChunkContentHash({ ...base, section: "other" }));
  assert.notEqual(hash, computeChunkContentHash({ ...base, tags: ["callback"] }));
});

test("computeChunkContentHash is stable for metadata-only changes", async () => {
  const { computeChunkContentHash } = await loadChunkEmbeddingService();
  const base = { title: "Callback 처리", content: "본문", section: "s", tags: ["callback", "java"] };
  const withMeta = { ...base, metadata: { documentType: "SAMPLE_CODE" } };
  assert.equal(computeChunkContentHash(base), computeChunkContentHash(withMeta));
});

test("computeChunkContentHash is order-independent for tags", async () => {
  const { computeChunkContentHash } = await loadChunkEmbeddingService();
  const a = computeChunkContentHash({ title: "t", content: "c", section: null, tags: ["a", "b"] });
  const b = computeChunkContentHash({ title: "t", content: "c", section: null, tags: ["b", "a"] });
  assert.equal(a, b);
});
