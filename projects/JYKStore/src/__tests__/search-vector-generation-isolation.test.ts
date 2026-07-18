import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchVectorQuerySql } from "@/lib/search-vector/search-vector-query";
import {
  handlePgvectorUnavailable,
  isPgvectorRequired,
  isPgvectorUnavailableError,
  parseVectorLiteral,
  toVectorLiteral,
} from "@/lib/search-vector/search-vector-runtime";
import { isEmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";

const BASE_INPUT = {
  provider: "local-hash",
  model: "local-hash-v1",
  queryVector: [0.1, 0.2, 0.3],
  limit: 5,
};

test("buildSearchVectorQuerySql always filters by searchIndexGenerationId (isolation invariant)", () => {
  const sql = buildSearchVectorQuerySql({ ...BASE_INPUT, searchIndexGenerationId: "gen-a" });
  assert.match(sql.sql, /"searchIndexGenerationId"\s*=/);
  assert.ok(sql.values.includes("gen-a"));
});

test("buildSearchVectorQuerySql rejects a missing generation id", () => {
  assert.throws(() =>
    buildSearchVectorQuerySql({ ...BASE_INPUT, searchIndexGenerationId: "" }),
  );
});

test("buildSearchVectorQuerySql scopes different generations to different bound values", () => {
  const sqlA = buildSearchVectorQuerySql({ ...BASE_INPUT, searchIndexGenerationId: "gen-a" });
  const sqlB = buildSearchVectorQuerySql({ ...BASE_INPUT, searchIndexGenerationId: "gen-b" });
  // Same query shape...
  assert.equal(sqlA.sql, sqlB.sql);
  // ...but isolated by generation id value.
  assert.ok(sqlA.values.includes("gen-a") && !sqlA.values.includes("gen-b"));
  assert.ok(sqlB.values.includes("gen-b") && !sqlB.values.includes("gen-a"));
});

test("buildSearchVectorQuerySql also filters by provider + model", () => {
  const sql = buildSearchVectorQuerySql({ ...BASE_INPUT, searchIndexGenerationId: "gen-a" });
  assert.match(sql.sql, /"provider"\s*=/);
  assert.match(sql.sql, /"model"\s*=/);
  assert.ok(sql.values.includes(BASE_INPUT.provider));
  assert.ok(sql.values.includes(BASE_INPUT.model));
});

test("buildSearchVectorQuerySql adds an optional chunkId IN filter only when chunkIds is provided", () => {
  const withoutChunks = buildSearchVectorQuerySql({
    ...BASE_INPUT,
    searchIndexGenerationId: "gen-a",
  });
  assert.doesNotMatch(withoutChunks.sql, /"chunkId"\s+IN/);

  const withChunks = buildSearchVectorQuerySql({
    ...BASE_INPUT,
    searchIndexGenerationId: "gen-a",
    chunkIds: ["c1", "c2"],
  });
  assert.match(withChunks.sql, /"chunkId"\s+IN/);
  assert.ok(withChunks.values.includes("c1"));
  assert.ok(withChunks.values.includes("c2"));
});

test("buildSearchVectorQuerySql orders by cosine distance ascending and always includes LIMIT", () => {
  const sql = buildSearchVectorQuerySql({ ...BASE_INPUT, searchIndexGenerationId: "gen-a" });
  assert.match(sql.sql, /ORDER BY/);
  assert.match(sql.sql, /<=>/);
  assert.match(sql.sql, /LIMIT/);
});

test("buildSearchVectorQuerySql clamps limit into [1, 200]", () => {
  const zero = buildSearchVectorQuerySql({ ...BASE_INPUT, searchIndexGenerationId: "gen-a", limit: 0 });
  assert.ok(zero.values.includes(1));

  const huge = buildSearchVectorQuerySql({
    ...BASE_INPUT,
    searchIndexGenerationId: "gen-a",
    limit: 10_000,
  });
  assert.ok(huge.values.includes(200));
});

test("toVectorLiteral serializes finite vectors and rejects invalid ones", () => {
  assert.equal(toVectorLiteral([0.1, 0.2, 0.3]), "[0.1,0.2,0.3]");
  assert.throws(
    () => toVectorLiteral([]),
    (error: unknown) => isEmbeddingProviderError(error) && error.code === "EMBEDDING_VECTOR_INVALID",
  );
  assert.throws(
    () => toVectorLiteral([1, Number.NaN, 3]),
    (error: unknown) => isEmbeddingProviderError(error) && error.code === "EMBEDDING_VECTOR_INVALID",
  );
  assert.throws(
    () => toVectorLiteral([1, Number.POSITIVE_INFINITY]),
    (error: unknown) => isEmbeddingProviderError(error) && error.code === "EMBEDDING_VECTOR_INVALID",
  );
});

test("parseVectorLiteral round-trips toVectorLiteral", () => {
  const original = [0.5, -0.25, 1, 0];
  const literal = toVectorLiteral(original);
  assert.deepEqual(parseVectorLiteral(literal), original);
});

test("isPgvectorUnavailableError recognizes missing table/type errors", () => {
  assert.equal(
    isPgvectorUnavailableError(new Error('relation "SearchIndexVector" does not exist')),
    true,
  );
  assert.equal(isPgvectorUnavailableError(new Error('type "vector" does not exist')), true);
  assert.equal(isPgvectorUnavailableError(new Error("unique constraint failed")), false);
});

test("handlePgvectorUnavailable throws SEARCH_RUNTIME_UNAVAILABLE in production, falls back otherwise", () => {
  assert.throws(
    () => handlePgvectorUnavailable("ctx", { NODE_ENV: "production" }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "SEARCH_RUNTIME_UNAVAILABLE",
  );
  assert.equal(handlePgvectorUnavailable("ctx", { NODE_ENV: "development" }), "fallback");
  assert.equal(handlePgvectorUnavailable("ctx", { NODE_ENV: "test" }), "fallback");
});

test("JYKSTORE_REQUIRE_PGVECTOR forces hard-fail outside production", () => {
  assert.equal(isPgvectorRequired({ NODE_ENV: "development" }), false);
  assert.equal(
    isPgvectorRequired({ NODE_ENV: "development", JYKSTORE_REQUIRE_PGVECTOR: "true" }),
    true,
  );
  assert.throws(
    () =>
      handlePgvectorUnavailable("ctx", {
        NODE_ENV: "development",
        JYKSTORE_REQUIRE_PGVECTOR: "true",
      }),
    (error: unknown) =>
      isEmbeddingProviderError(error) && error.code === "SEARCH_RUNTIME_UNAVAILABLE",
  );
});

test("buildSearchVectorQuerySql casts through vector(n) when dimension is set", () => {
  const sql = buildSearchVectorQuerySql({
    ...BASE_INPUT,
    searchIndexGenerationId: "gen-a",
    dimension: 384,
  });
  assert.match(sql.sql, /::vector\(384\)/);
  assert.doesNotMatch(sql.sql, /::vector\(\$/);
});
