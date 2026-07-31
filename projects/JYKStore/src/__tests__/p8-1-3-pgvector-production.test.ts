import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  handlePgvectorUnavailable,
  isJsonVectorFallbackAllowed,
  isPgvectorRequired,
} from "@/lib/search-vector/search-vector-runtime";
import { isEmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";

describe("P8.1.3 pgvector production policy", () => {
  it("does not silently allow JSON fallback in development", () => {
    assert.equal(isJsonVectorFallbackAllowed({ NODE_ENV: "development" }), false);
    assert.throws(
      () => handlePgvectorUnavailable("hybrid", { NODE_ENV: "development" }),
      (e: unknown) => isEmbeddingProviderError(e) && e.code === "SEARCH_RUNTIME_UNAVAILABLE",
    );
  });

  it("allows JSON fallback only for test or explicit allow flag", () => {
    assert.equal(isJsonVectorFallbackAllowed({ NODE_ENV: "test" }), true);
    assert.equal(
      isJsonVectorFallbackAllowed({
        NODE_ENV: "development",
        JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK: "1",
      }),
      true,
    );
    assert.equal(
      isJsonVectorFallbackAllowed({
        NODE_ENV: "development",
        JYKSTORE_REQUIRE_PGVECTOR: "true",
        JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK: "1",
      }),
      false,
    );
    assert.equal(isPgvectorRequired({ NODE_ENV: "production" }), true);
  });

  it("hybrid ranking surfaces vectorBackend diagnostic fields", () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "..",
        "lib",
        "retrieval",
        "hybrid-ranking-service.ts",
      ),
      "utf8",
    );
    assert.ok(source.includes('vectorBackend: "pgvector"'));
    assert.ok(source.includes('vectorBackend: "json_fallback"'));
    assert.ok(source.includes("isJsonVectorFallbackAllowed"));
  });

  it("usage DTO includes vectorBackend for hybrid diagnostics", () => {
    const dto = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "retrieval-dto.ts"),
      "utf8",
    );
    assert.ok(dto.includes("vectorBackend"));
    assert.ok(dto.includes("vectorQueryLatencyMs"));
  });
});
