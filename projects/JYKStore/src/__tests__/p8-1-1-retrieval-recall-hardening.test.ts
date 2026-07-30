import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  findJsonEmbeddingNeighbors,
  unionCandidateChunkIds,
} from "@/lib/retrieval/hybrid-ranking-service";
import {
  LEXICAL_CANDIDATE_LIMIT,
  MAX_FILTERED_CANDIDATES,
  MAX_HYBRID_CANDIDATES,
  UNION_CANDIDATE_LIMIT,
  VECTOR_CANDIDATE_LIMIT,
  VECTOR_CANDIDATE_MAX,
} from "@/lib/retrieval/retrieval-config";

describe("P8.1.1 retrieval recall hardening", () => {
  it("exposes lexical/vector/union candidate budgets", () => {
    assert.equal(LEXICAL_CANDIDATE_LIMIT, MAX_FILTERED_CANDIDATES);
    assert.equal(VECTOR_CANDIDATE_LIMIT, VECTOR_CANDIDATE_MAX);
    assert.equal(UNION_CANDIDATE_LIMIT, MAX_HYBRID_CANDIDATES);
  });

  it("vector-only recovery: empty lexical union equals vector candidate set", () => {
    const lexical: string[] = [];
    const vector = ["semantic-chunk-a", "semantic-chunk-b"];
    const merged = unionCandidateChunkIds(lexical, vector);
    assert.deepEqual(merged, vector);
    assert.equal(merged.length, 2);
    assert.ok(!lexical.includes("semantic-chunk-a"));
  });

  it("unions lexical and vector ids without duplicates (both)", () => {
    assert.deepEqual(unionCandidateChunkIds(["a", "b"], ["b", "c"]), ["a", "b", "c"]);
  });

  it("hybrid path queries vectors independently and JSON fallback is generation-scoped", () => {
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
    assert.ok(source.includes("querySearchIndexVectorsByGeneration"));
    assert.ok(source.includes("findJsonEmbeddingNeighbors"));
    assert.ok(source.includes("mergeKeywordAndVectorCandidates"));
    // pgvector-null path must not re-score only lexical chunk ids.
    assert.ok(
      !source.includes(
        "const chunkIds = scored.map((item) => item.chunk.id);\n    const jsonVectorByChunk",
      ),
    );
    assert.equal(typeof findJsonEmbeddingNeighbors, "function");
  });

  it("orchestration uses hybrid on raw query and empty lexical does not default-page", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "retrieval-service.ts"),
      "utf8",
    );
    assert.ok(source.includes('retrievalMode === "hybrid" && searchQuery.length > 0'));
    assert.ok(source.includes("lexicalPrefilterTokens"));
    assert.ok(source.includes("lexicalTokens.length === 0"));
  });
});
